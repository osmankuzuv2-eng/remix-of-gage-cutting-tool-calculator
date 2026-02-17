import { useState, useEffect } from "react";
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
import { Loader2, Plus, Pencil, Key, Trash2, Shield, ShieldCheck, Users, Monitor, LayoutGrid, Palette, Brain, Check, X, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import MenuManager from "@/components/MenuManager";
import MachineManager from "@/components/MachineManager";

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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">{t("admin", "title")}</h2>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" /> Kullanıcılar</TabsTrigger>
          <TabsTrigger value="machines" className="gap-2"><Monitor className="w-4 h-4" /> Makine Parkı</TabsTrigger>
          <TabsTrigger value="menu" className="gap-2"><LayoutGrid className="w-4 h-4" /> Menü Yönetimi</TabsTrigger>
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
                          {feedbackStatusBadge(fb.status)}
                          {fb.applied_at && <Badge variant="outline" className="text-[10px] border-success/30 text-success">Uygulandı</Badge>}
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
