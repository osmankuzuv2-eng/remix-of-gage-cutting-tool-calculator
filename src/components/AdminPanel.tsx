import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Key, Trash2, Shield, ShieldCheck, Users, Monitor, LayoutGrid, Palette, Brain, Check, X, MessageSquare, Star, TrendingUp, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import MenuManager from "@/components/MenuManager";
import MachineManager from "@/components/MachineManager";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useCustomers } from "@/hooks/useCustomers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// All available modules (ai-learn is always accessible, not listed here)
const ALL_MODULES = [
  "drawing", "costcalc", "cutting", "toollife", "threading",
  "drilling", "tolerance", "compare", "materials", "cost", "history",
  "add_material",
];

interface UserData {
  id: string;
  email: string;
  created_at: string;
  profile: { display_name: string | null; company: string | null; position: string | null; custom_title: string | null; title_color: string | null } | null;
  roles: string[];
  permissions: { module_key: string; granted: boolean }[];
}

interface AdminPanelProps {
  onMenuUpdated?: () => void;
}

const AdminPanel = ({ onMenuUpdated }: AdminPanelProps) => {
  const { t } = useLanguage();
  const { session } = useAuth();
  const { toast } = useToast();

  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  // Create form
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [newPermissions, setNewPermissions] = useState<Record<string, boolean>>({});

  // Edit form
  const [editEmail, setEditEmail] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editPermissions, setEditPermissions] = useState<Record<string, boolean>>({});
  const [editCustomTitle, setEditCustomTitle] = useState("");
  const [editTitleColor, setEditTitleColor] = useState("");

  // Password form
  const [changePassword, setChangePassword] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // Customers state
  const { customers: allCustomers, reload: reloadCustomers } = useCustomers();
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [custName, setCustName] = useState("");
  const [custFactory, setCustFactory] = useState("Havacılık");
  const [custNotes, setCustNotes] = useState("");
  const [custActive, setCustActive] = useState(true);

  // Feedback state
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [trainingInProgress, setTrainingInProgress] = useState(false);
  const callAdmin = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body,
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await callAdmin({ action: "list_users" });
      setUsers(data.users || []);
    } catch (e: any) {
      toast({ title: t("common", "error"), description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) loadUsers();
  }, [session]);

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      const module_permissions = ALL_MODULES.map((m) => ({
        module_key: m,
        granted: !!newPermissions[m],
      }));
      await callAdmin({
        action: "create_user",
        email: newEmail,
        password: newPassword,
        display_name: newDisplayName,
        is_admin: newIsAdmin,
        module_permissions,
      });
      toast({ title: t("common", "success"), description: t("admin", "userCreated") });
      setShowCreateDialog(false);
      resetCreateForm();
      loadUsers();
    } catch (e: any) {
      toast({ title: t("common", "error"), description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const module_permissions = ALL_MODULES.map((m) => ({
        module_key: m,
        granted: !!editPermissions[m],
      }));
      await callAdmin({
        action: "update_user",
        user_id: selectedUser.id,
        email: editEmail,
        display_name: editDisplayName,
        is_admin: editIsAdmin,
        module_permissions,
        custom_title: editCustomTitle,
        title_color: editTitleColor,
      });
      toast({ title: t("common", "success"), description: t("admin", "userUpdated") });
      setShowEditDialog(false);
      loadUsers();
    } catch (e: any) {
      toast({ title: t("common", "error"), description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      await callAdmin({
        action: "change_password",
        user_id: selectedUser.id,
        new_password: changePassword,
      });
      toast({ title: t("common", "success"), description: t("admin", "passwordChanged") });
      setShowPasswordDialog(false);
      setChangePassword("");
    } catch (e: any) {
      toast({ title: t("common", "error"), description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm(t("admin", "confirmDelete"))) return;
    try {
      await callAdmin({ action: "delete_user", user_id: userId });
      toast({ title: t("common", "success"), description: t("admin", "userDeleted") });
      loadUsers();
    } catch (e: any) {
      toast({ title: t("common", "error"), description: e.message, variant: "destructive" });
    }
  };

  const openEdit = (user: UserData) => {
    setSelectedUser(user);
    setEditEmail(user.email);
    setEditDisplayName(user.profile?.display_name || "");
    setEditIsAdmin(user.roles.includes("admin"));
    setEditCustomTitle(user.profile?.custom_title || "");
    setEditTitleColor(user.profile?.title_color || "");
    const perms: Record<string, boolean> = {};
    ALL_MODULES.forEach((m) => {
      const found = user.permissions.find((p) => p.module_key === m);
      perms[m] = found ? found.granted : false;
    });
    setEditPermissions(perms);
    setShowEditDialog(true);
  };

  const openPassword = (user: UserData) => {
    setSelectedUser(user);
    setChangePassword("");
    setShowPasswordDialog(true);
  };

  const resetCreateForm = () => {
    setNewEmail("");
    setNewPassword("");
    setNewDisplayName("");
    setNewIsAdmin(false);
    setNewPermissions({});
  };

  const openCreate = () => {
    resetCreateForm();
    // Default all modules to granted
    const perms: Record<string, boolean> = {};
    ALL_MODULES.forEach((m) => { perms[m] = true; });
    setNewPermissions(perms);
    setShowCreateDialog(true);
  };

  const ModulePermissionToggles = ({
    permissions,
    onChange,
  }: {
    permissions: Record<string, boolean>;
    onChange: (key: string, value: boolean) => void;
  }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
      {ALL_MODULES.map((m) => (
        <label key={m} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 border border-border text-sm cursor-pointer">
          <Switch
            checked={!!permissions[m]}
            onCheckedChange={(v) => onChange(m, v)}
          />
          <span className="text-foreground">{t("tabs", m)}</span>
        </label>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }


  const loadFeedbacks = async () => {
    setFeedbackLoading(true);
    try {
      const { data, error } = await supabase.from("analysis_feedback" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setFeedbacks((data as any[]) || []);
    } catch (e: any) {
      toast({ title: t("common", "error"), description: e.message, variant: "destructive" });
    } finally {
      setFeedbackLoading(false);
    }
  };

  const updateFeedbackStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from("analysis_feedback" as any).update({ status, ...(status === "approved" ? { applied_at: new Date().toISOString() } : {}) } as any).eq("id", id);
      if (error) throw error;
      toast({ title: t("common", "success"), description: status === "approved" ? "Onaylandı" : "Reddedildi" });
      loadFeedbacks();
    } catch (e: any) {
      toast({ title: t("common", "error"), description: e.message, variant: "destructive" });
    }
  };

  const deleteFeedback = async (id: string) => {
    if (!confirm("Bu geri bildirimi silmek istediğinize emin misiniz?")) return;
    try {
      const { error } = await supabase.from("analysis_feedback" as any).delete().eq("id", id);
      if (error) throw error;
      toast({ title: t("common", "success"), description: "Silindi" });
      loadFeedbacks();
    } catch (e: any) {
      toast({ title: t("common", "error"), description: e.message, variant: "destructive" });
    }
  };

  const trainAI = async () => {
    const approved = feedbacks.filter(f => f.status === "approved" && !f.applied_at);
    if (!approved.length) {
      // Use all approved
      const allApproved = feedbacks.filter(f => f.status === "approved");
      if (!allApproved.length) {
        toast({ title: "Bilgi", description: "Onaylanmış geri bildirim yok.", variant: "destructive" });
        return;
      }
    }
    setTrainingInProgress(true);
    try {
      const { error } = await supabase.functions.invoke("analyze-drawing", {
        body: { action: "train", feedbacks: feedbacks.filter(f => f.status === "approved") },
      });
      if (error) throw error;
      // Mark all approved as applied
      for (const fb of feedbacks.filter(f => f.status === "approved")) {
        await supabase.from("analysis_feedback" as any).update({ applied_at: new Date().toISOString() } as any).eq("id", fb.id);
      }
      toast({ title: t("common", "success"), description: "AI eğitim verileri güncellendi!" });
      loadFeedbacks();
    } catch (e: any) {
      toast({ title: t("common", "error"), description: e.message, variant: "destructive" });
    } finally {
      setTrainingInProgress(false);
    }
  };

  const feedbackTypeLabel = (type: string) => {
    switch (type) {
      case "correction": return "Düzeltme";
      case "missing": return "Eksik";
      case "strategy": return "Strateji";
      default: return "Diğer";
    }
  };

  const feedbackStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="secondary">Bekliyor</Badge>;
      case "approved": return <Badge className="bg-success/20 text-success border-success/30">Onaylı</Badge>;
      case "rejected": return <Badge variant="destructive">Reddedildi</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // ── Customer CRUD ──
  const openCustomerCreate = () => {
    setEditingCustomer(null);
    setCustName(""); setCustFactory("Havacılık"); setCustNotes(""); setCustActive(true);
    setShowCustomerDialog(true);
  };

  const openCustomerEdit = (c: any) => {
    setEditingCustomer(c);
    setCustName(c.name); setCustFactory(c.factory); setCustNotes(c.notes || ""); setCustActive(c.is_active);
    setShowCustomerDialog(true);
  };

  const handleSaveCustomer = async () => {
    if (!custName.trim()) return;
    setSubmitting(true);
    try {
      if (editingCustomer) {
        const { error } = await supabase.from("customers" as any).update({ name: custName.trim(), factory: custFactory, notes: custNotes.trim() || null, is_active: custActive } as any).eq("id", editingCustomer.id);
        if (error) throw error;
        toast({ title: t("common", "success"), description: "Müşteri güncellendi" });
      } else {
        const { error } = await supabase.from("customers" as any).insert({ name: custName.trim(), factory: custFactory, notes: custNotes.trim() || null, is_active: custActive } as any);
        if (error) throw error;
        toast({ title: t("common", "success"), description: "Müşteri eklendi" });
      }
      setShowCustomerDialog(false);
      reloadCustomers();
    } catch (e: any) {
      toast({ title: t("common", "error"), description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm("Bu müşteriyi silmek istediğinize emin misiniz?")) return;
    try {
      const { error } = await supabase.from("customers" as any).delete().eq("id", id);
      if (error) throw error;
      toast({ title: t("common", "success"), description: "Müşteri silindi" });
      reloadCustomers();
    } catch (e: any) {
      toast({ title: t("common", "error"), description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">{t("admin", "title")}</h2>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" /> Kullanıcılar</TabsTrigger>
          <TabsTrigger value="customers" className="gap-2"><Building2 className="w-4 h-4" /> Müşteriler</TabsTrigger>
          <TabsTrigger value="machines" className="gap-2"><Monitor className="w-4 h-4" /> Makine Parkı</TabsTrigger>
          <TabsTrigger value="menu" className="gap-2"><LayoutGrid className="w-4 h-4" /> Menü</TabsTrigger>
          <TabsTrigger value="feedback" className="gap-2" onClick={() => { if (!feedbacks.length) loadFeedbacks(); }}><Brain className="w-4 h-4" /> AI Eğitim</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" />
              {t("admin", "createUser")}
            </Button>
          </div>

          {/* Users List */}
          <div className="grid gap-4">
            {users.map((user) => (
              <Card key={user.id} className="border-border bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground truncate">{user.profile?.display_name || user.email}</span>
                        {user.roles.includes("admin") ? (
                          <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
                        ) : (
                          <Shield className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        )}
                        {user.profile?.custom_title ? (
                          <Badge
                            className="text-[10px] px-1.5 py-0"
                            style={user.profile?.title_color ? { backgroundColor: user.profile.title_color, color: '#fff' } : undefined}
                          >
                            {user.profile.custom_title}
                          </Badge>
                        ) : (
                          <Badge variant={user.roles.includes("admin") ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0">
                            {user.roles.includes("admin") ? "Admin" : "Personel"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {user.permissions
                          .filter((p) => p.granted)
                          .map((p) => (
                            <span key={p.module_key} className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              {t("tabs", p.module_key)}
                            </span>
                          ))}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(user)} title={t("admin", "editUser")}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openPassword(user)} title={t("admin", "changePassword")}>
                        <Key className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(user.id)} title={t("common", "delete")} className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Müşteri tanımları tüm modüllerde ortak kullanılır.</p>
            <Button onClick={openCustomerCreate} className="gap-2"><Plus className="w-4 h-4" /> Müşteri Ekle</Button>
          </div>
          <div className="grid gap-3">
            {allCustomers.map((c) => (
              <Card key={c.id} className="border-border bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-primary" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{c.name}</span>
                          <Badge variant="outline" className="text-xs">{c.factory}</Badge>
                          {!c.is_active && <Badge variant="secondary" className="text-xs">Pasif</Badge>}
                        </div>
                        {c.notes && <p className="text-xs text-muted-foreground mt-0.5">{c.notes}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openCustomerEdit(c)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteCustomer(c.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {allCustomers.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Henüz müşteri tanımlanmamış.</p>}
          </div>

          {/* Customer Dialog */}
          <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCustomer ? "Müşteri Düzenle" : "Yeni Müşteri"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Müşteri Adı</Label>
                  <Input value={custName} onChange={(e) => setCustName(e.target.value.slice(0, 100))} placeholder="Müşteri adı..." />
                </div>
                <div>
                  <Label>Fabrika</Label>
                  <Select value={custFactory} onValueChange={setCustFactory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Havacılık">Havacılık</SelectItem>
                      <SelectItem value="Raylı Sistemler">Raylı Sistemler</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notlar (opsiyonel)</Label>
                  <Textarea value={custNotes} onChange={(e) => setCustNotes(e.target.value.slice(0, 500))} placeholder="Ek bilgi..." rows={2} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={custActive} onCheckedChange={setCustActive} />
                  <Label>Aktif</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCustomerDialog(false)}>İptal</Button>
                <Button onClick={handleSaveCustomer} disabled={submitting || !custName.trim()}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  {editingCustomer ? "Güncelle" : "Ekle"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="machines" className="mt-4">
          <MachineManager />
        </TabsContent>

        <TabsContent value="menu" className="mt-4">
          <MenuManager onUpdated={onMenuUpdated} />
        </TabsContent>

        <TabsContent value="feedback" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Teknik resim analizlerinden gelen geri bildirimler. Onaylanan bildirimler AI eğitimi için kullanılır.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadFeedbacks} disabled={feedbackLoading}>
                {feedbackLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Yenile
              </Button>
              <Button size="sm" onClick={trainAI} disabled={trainingInProgress || !feedbacks.some(f => f.status === "approved")} className="gap-1.5">
                {trainingInProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                AI'yı Eğit ({feedbacks.filter(f => f.status === "approved").length})
              </Button>
            </div>
          </div>

          {/* Analytics Dashboard */}
          {feedbacks.length > 0 && (() => {
            const rated = feedbacks.filter(f => f.rating);
            const avgRating = rated.length ? (rated.reduce((s: number, f: any) => s + f.rating, 0) / rated.length) : 0;
            const pendingCount = feedbacks.filter(f => f.status === "pending").length;
            const approvedCount = feedbacks.filter(f => f.status === "approved").length;
            const rejectedCount = feedbacks.filter(f => f.status === "rejected").length;

            // Group by day for trend chart
            const dayMap: Record<string, { date: string; count: number; avgRating: number; ratings: number[] }> = {};
            feedbacks.forEach((fb: any) => {
              const day = new Date(fb.created_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });
              if (!dayMap[day]) dayMap[day] = { date: day, count: 0, avgRating: 0, ratings: [] };
              dayMap[day].count++;
              if (fb.rating) dayMap[day].ratings.push(fb.rating);
            });
            const trendData = Object.values(dayMap).map(d => ({
              ...d,
              avgRating: d.ratings.length ? +(d.ratings.reduce((a, b) => a + b, 0) / d.ratings.length).toFixed(1) : 0,
            })).reverse().slice(-14);

            // Rating distribution
            const distData = [1,2,3,4,5].map(r => ({
              star: `${r}★`,
              count: rated.filter((f: any) => f.rating === r).length,
            }));

            // Top 10 feedback contributors
            const userFbCount: Record<string, number> = {};
            feedbacks.forEach((fb: any) => {
              userFbCount[fb.user_id] = (userFbCount[fb.user_id] || 0) + 1;
            });
            const top10 = Object.entries(userFbCount)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([userId, count]) => {
                const user = users.find(u => u.id === userId);
                return {
                  userId,
                  name: user?.profile?.display_name || user?.email || userId.slice(0, 8) + "...",
                  email: user?.email || "",
                  count,
                };
              });

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Summary Cards */}
                <Card className="bg-card border-border">
                  <CardContent className="p-4 text-center space-y-1">
                    <div className="flex items-center justify-center gap-1">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`w-5 h-5 ${s <= Math.round(avgRating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                      ))}
                    </div>
                    <p className="text-2xl font-bold text-foreground">{avgRating.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">Ortalama Puan ({rated.length} değerlendirme)</p>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="p-4 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Durum Dağılımı</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-3 rounded-full bg-secondary overflow-hidden flex">
                        {feedbacks.length > 0 && (
                          <>
                            <div className="bg-yellow-500 h-full" style={{ width: `${(pendingCount / feedbacks.length) * 100}%` }} />
                            <div className="bg-success h-full" style={{ width: `${(approvedCount / feedbacks.length) * 100}%` }} />
                            <div className="bg-destructive h-full" style={{ width: `${(rejectedCount / feedbacks.length) * 100}%` }} />
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Bekliyor: {pendingCount}</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success inline-block" /> Onaylı: {approvedCount}</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive inline-block" /> Red: {rejectedCount}</span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="p-4 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Puan Dağılımı</p>
                    <div className="space-y-1">
                      {distData.reverse().map(d => (
                        <div key={d.star} className="flex items-center gap-2 text-xs">
                          <span className="w-6 text-muted-foreground">{d.star}</span>
                          <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                            <div className="bg-yellow-400 h-full rounded-full" style={{ width: rated.length ? `${(d.count / rated.length) * 100}%` : '0%' }} />
                          </div>
                          <span className="w-4 text-muted-foreground text-right">{d.count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Top 10 Contributors */}
                <Card className="bg-card border-border md:col-span-3">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-primary" />
                      <p className="text-sm font-medium text-foreground">En Çok Bildirim Yapan 10 Kullanıcı</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {top10.map((item, idx) => (
                        <div key={item.userId} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30 border border-border">
                          <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                            {item.email && <p className="text-xs text-muted-foreground truncate">{item.email}</p>}
                          </div>
                          <Badge variant="secondary" className="shrink-0">{item.count} bildirim</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Trend Chart */}
                {trendData.length > 1 && (
                  <Card className="bg-card border-border md:col-span-3">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        <p className="text-sm font-medium text-foreground">Günlük Feedback Trendi</p>
                      </div>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                            labelStyle={{ color: "hsl(var(--foreground))" }}
                          />
                          <Bar dataKey="count" name="Feedback" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                          <Bar dataKey="avgRating" name="Ort. Puan" fill="#facc15" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })()}

          {feedbackLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : feedbacks.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center text-muted-foreground">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>Henüz geri bildirim yok.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {feedbacks.map((fb) => (
                <Card key={fb.id} className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-2">
                         <div className="flex items-center gap-2 flex-wrap">
                           <span className="font-medium text-foreground text-sm">{fb.part_name}</span>
                           <Badge variant="outline" className="text-[10px]">{feedbackTypeLabel(fb.feedback_type)}</Badge>
                           {fb.rating && (
                             <span className="flex items-center gap-0.5 text-[10px]">
                               {[1,2,3,4,5].map(s => (
                                 <span key={s} className={s <= fb.rating ? "text-yellow-400" : "text-muted-foreground/30"}>★</span>
                               ))}
                             </span>
                           )}
                           {feedbackStatusBadge(fb.status)}
                           {fb.applied_at && <Badge variant="outline" className="text-[10px] border-success/30 text-success">Uygulandı</Badge>}
                         </div>
                         <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                           <Users className="w-3 h-3" />
                           <span>{(() => {
                             const u = users.find(u => u.id === fb.user_id);
                             return u?.profile?.display_name || u?.email || fb.user_id?.slice(0, 8) + "...";
                           })()}</span>
                         </div>
                         {fb.file_name && <p className="text-xs text-muted-foreground">Dosya: {fb.file_name}</p>}
                         <p className="text-sm text-foreground bg-secondary/30 p-2 rounded">{fb.feedback_text}</p>
                         <p className="text-xs text-muted-foreground">{new Date(fb.created_at).toLocaleString("tr-TR")}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {fb.status === "pending" && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-success hover:text-success" onClick={() => updateFeedbackStatus(fb.id, "approved")} title="Onayla">
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => updateFeedbackStatus(fb.id, "rejected")} title="Reddet">
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteFeedback(fb.id)} title="Sil">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("admin", "createUser")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("admin", "email")}</Label>
              <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" />
            </div>
            <div className="space-y-2">
              <Label>{t("admin", "password")}</Label>
              <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" />
            </div>
            <div className="space-y-2">
              <Label>{t("admin", "displayName")}</Label>
              <Input value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} />
            </div>
            <label className="flex items-center gap-2">
              <Switch checked={newIsAdmin} onCheckedChange={setNewIsAdmin} />
              <span className="text-foreground font-medium">{t("admin", "adminRole")}</span>
            </label>
            <div>
              <Label>{t("admin", "modulePermissions")}</Label>
              <ModulePermissionToggles
                permissions={newPermissions}
                onChange={(k, v) => setNewPermissions((p) => ({ ...p, [k]: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>{t("common", "cancel")}</Button>
            <Button onClick={handleCreate} disabled={submitting || !newEmail || !newPassword}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {t("admin", "createUser")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("admin", "editUser")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("admin", "email")}</Label>
              <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} type="email" />
            </div>
            <div className="space-y-2">
              <Label>{t("admin", "displayName")}</Label>
              <Input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} />
            </div>
            <label className="flex items-center gap-2">
              <Switch checked={editIsAdmin} onCheckedChange={setEditIsAdmin} />
              <span className="text-foreground font-medium">{t("admin", "adminRole")}</span>
            </label>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Palette className="w-4 h-4" /> Özel Ünvan (Badge)</Label>
              <Input value={editCustomTitle} onChange={(e) => setEditCustomTitle(e.target.value)} placeholder="Örn: CNC Operatör, Kalite Kontrol..." />
              <p className="text-xs text-muted-foreground">Boş bırakılırsa yetkiye göre "Admin" veya "Personel" gösterilir.</p>
            </div>
            <div className="space-y-2">
              <Label>Badge Rengi</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={editTitleColor || "#6366f1"} onChange={(e) => setEditTitleColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-border" />
                <Input value={editTitleColor} onChange={(e) => setEditTitleColor(e.target.value)} placeholder="#6366f1" className="flex-1" />
                {editTitleColor && (
                  <Button variant="ghost" size="sm" onClick={() => setEditTitleColor("")}>Temizle</Button>
                )}
              </div>
              {editCustomTitle && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">Önizleme:</span>
                  <Badge
                    className="text-[10px] px-1.5 py-0"
                    style={editTitleColor ? { backgroundColor: editTitleColor, color: '#fff' } : undefined}
                  >
                    {editCustomTitle}
                  </Badge>
                </div>
              )}
            </div>
            <div>
              <Label>{t("admin", "modulePermissions")}</Label>
              <ModulePermissionToggles
                permissions={editPermissions}
                onChange={(k, v) => setEditPermissions((p) => ({ ...p, [k]: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>{t("common", "cancel")}</Button>
            <Button onClick={handleEdit} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {t("common", "save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin", "changePassword")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{selectedUser?.email}</p>
            <div className="space-y-2">
              <Label>{t("admin", "newPassword")}</Label>
              <Input value={changePassword} onChange={(e) => setChangePassword(e.target.value)} type="password" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>{t("common", "cancel")}</Button>
            <Button onClick={handleChangePassword} disabled={submitting || changePassword.length < 6}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {t("admin", "changePassword")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPanel;
