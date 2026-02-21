import { useState, useEffect, useMemo, useRef } from "react";
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
import { Loader2, Plus, Pencil, Key, Trash2, Shield, ShieldCheck, Users, Monitor, LayoutGrid, Palette, Brain, Check, X, MessageSquare, Star, TrendingUp, Building2, Factory, Lock, Camera, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import MenuManager from "@/components/MenuManager";
import ModuleManager from "@/components/ModuleManager";
import MachineManager from "@/components/MachineManager";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useCustomers } from "@/hooks/useCustomers";
import { useFactories } from "@/hooks/useFactories";
import { useAdminPermissions, ADMIN_PANEL_KEYS, ADMIN_PANEL_LABELS, type AdminPanelKey } from "@/hooks/useAdminPermissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAllModules } from "@/hooks/useAllModules";
import { useModuleTranslations } from "@/hooks/useModuleTranslations";

// All available modules loaded dynamically from DB via useAllModules hook

interface UserData {
  id: string;
  email: string;
  created_at: string;
  profile: { display_name: string | null; company: string | null; position: string | null; custom_title: string | null; title_color: string | null; avatar_url: string | null } | null;
  roles: string[];
  permissions: { module_key: string; granted: boolean }[];
  admin_permissions?: { panel_key: string; can_view: boolean; can_edit: boolean }[];
}

interface AdminPanelProps {
  onMenuUpdated?: () => void;
}

const ReadOnlyBanner = () => (
  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border text-muted-foreground mb-4">
    <Lock className="w-4 h-4" />
    <span className="text-sm">Bu sekme salt okunur modda görüntüleniyor. Düzenleme yetkiniz bulunmamaktadır.</span>
  </div>
);

const AdminPanel = ({ onMenuUpdated }: AdminPanelProps) => {
  const { t } = useLanguage();
  const { session } = useAuth();
  const { toast } = useToast();
  const { canEdit } = useAdminPermissions();
  const { modules: ALL_MODULES, reload: reloadModules } = useAllModules();
  const { getModuleName } = useModuleTranslations();

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
  const [newAdminPerms, setNewAdminPerms] = useState<Record<string, { can_view: boolean; can_edit: boolean }>>({});

  // Edit form
  const [editEmail, setEditEmail] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editPermissions, setEditPermissions] = useState<Record<string, boolean>>({});
  const [editCustomTitle, setEditCustomTitle] = useState("");
  const [editTitleColor, setEditTitleColor] = useState("");
  const [editAdminPerms, setEditAdminPerms] = useState<Record<string, { can_view: boolean; can_edit: boolean }>>({});

  // Password form
  const [changePassword, setChangePassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [uploadingEditAvatar, setUploadingEditAvatar] = useState(false);
  const editAvatarRef = useRef<HTMLInputElement>(null);

  // Customers state
  const { customers: allCustomers, reload: reloadCustomers } = useCustomers();
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [custName, setCustName] = useState("");
  const [custFactory, setCustFactory] = useState("");
  const [custNotes, setCustNotes] = useState("");
  const [custSpecs, setCustSpecs] = useState("");
  const [custActive, setCustActive] = useState(true);

  // Factories state
  const { factories: allFactories, activeFactories, reload: reloadFactories } = useFactories();
  const [showFactoryDialog, setShowFactoryDialog] = useState(false);
  const [editingFactory, setEditingFactory] = useState<any | null>(null);
  const [factName, setFactName] = useState("");
  const [factActive, setFactActive] = useState(true);
  const [factSortOrder, setFactSortOrder] = useState(0);

  // Feedback state
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [trainingInProgress, setTrainingInProgress] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingFeedbackId, setRejectingFeedbackId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

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
      const admin_panel_permissions = ADMIN_PANEL_KEYS.map((k) => ({
        panel_key: k,
        can_view: newAdminPerms[k]?.can_view ?? true,
        can_edit: newAdminPerms[k]?.can_edit ?? false,
      }));
      await callAdmin({
        action: "create_user",
        email: newEmail,
        password: newPassword,
        display_name: newDisplayName,
        is_admin: newIsAdmin,
        module_permissions,
        admin_panel_permissions,
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
      const admin_panel_permissions = ADMIN_PANEL_KEYS.map((k) => ({
        panel_key: k,
        can_view: editAdminPerms[k]?.can_view ?? true,
        can_edit: editAdminPerms[k]?.can_edit ?? false,
      }));
      await callAdmin({
        action: "update_user",
        user_id: selectedUser.id,
        email: editEmail,
        display_name: editDisplayName,
        is_admin: editIsAdmin,
        module_permissions,
        admin_panel_permissions,
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
    setEditAvatarUrl(user.profile?.avatar_url || null);
    setEditIsAdmin(user.roles.includes("admin"));
    setEditCustomTitle(user.profile?.custom_title || "");
    setEditTitleColor(user.profile?.title_color || "");
    const perms: Record<string, boolean> = {};
    ALL_MODULES.forEach((m) => {
      const found = user.permissions.find((p) => p.module_key === m);
      perms[m] = found ? found.granted : false;
    });
    setEditPermissions(perms);
    // Load admin panel permissions
    const ap: Record<string, { can_view: boolean; can_edit: boolean }> = {};
    ADMIN_PANEL_KEYS.forEach((k) => {
      const found = user.admin_permissions?.find((p) => p.panel_key === k);
      ap[k] = { can_view: found?.can_view ?? true, can_edit: found?.can_edit ?? false };
    });
    setEditAdminPerms(ap);
    setShowEditDialog(true);
  };

  const handleEditAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUser) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Sadece resim dosyası yükleyebilirsiniz", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Dosya boyutu 2MB'dan küçük olmalı", variant: "destructive" });
      return;
    }
    setUploadingEditAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${selectedUser.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl + "?t=" + Date.now();

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", selectedUser.id);
      if (updateError) throw updateError;

      setEditAvatarUrl(publicUrl);
      toast({ title: t("common", "success") });
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setUploadingEditAvatar(false);
      if (editAvatarRef.current) editAvatarRef.current.value = "";
    }
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
    const ap: Record<string, { can_view: boolean; can_edit: boolean }> = {};
    ADMIN_PANEL_KEYS.forEach((k) => { ap[k] = { can_view: true, can_edit: false }; });
    setNewAdminPerms(ap);
  };

  const openCreate = () => {
    resetCreateForm();
    const perms: Record<string, boolean> = {};
    ALL_MODULES.forEach((m) => { perms[m] = true; });
    setNewPermissions(perms);
    setShowCreateDialog(true);
  };

  const ModulePermissionToggles = ({
    permissions,
    onChange,
    disabled,
  }: {
    permissions: Record<string, boolean>;
    onChange: (key: string, value: boolean) => void;
    disabled?: boolean;
  }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
      {ALL_MODULES.map((m) => (
        <label key={m} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 border border-border text-sm cursor-pointer">
          <Switch
            checked={!!permissions[m]}
            onCheckedChange={(v) => onChange(m, v)}
            disabled={disabled}
          />
          <span className="text-foreground">{getModuleName(m)}</span>
        </label>
      ))}
    </div>
  );

  const AdminPermissionToggles = ({
    perms,
    onChange,
    disabled,
  }: {
    perms: Record<string, { can_view: boolean; can_edit: boolean }>;
    onChange: (key: string, field: "can_view" | "can_edit", value: boolean) => void;
    disabled?: boolean;
  }) => (
    <div className="space-y-2 mt-2">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 text-xs text-muted-foreground px-2">
        <span>Sekme</span>
        <span className="w-16 text-center">Görüntüle</span>
        <span className="w-16 text-center">Düzenle</span>
      </div>
      {ADMIN_PANEL_KEYS.map((k) => (
        <div key={k} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center p-2 rounded-lg bg-secondary/30 border border-border text-sm">
          <span className="text-foreground">{ADMIN_PANEL_LABELS[k]}</span>
          <div className="w-16 flex justify-center">
            <Switch
              checked={perms[k]?.can_view ?? true}
              onCheckedChange={(v) => onChange(k, "can_view", v)}
              disabled={disabled}
            />
          </div>
          <div className="w-16 flex justify-center">
            <Switch
              checked={perms[k]?.can_edit ?? false}
              onCheckedChange={(v) => onChange(k, "can_edit", v)}
              disabled={disabled}
            />
          </div>
        </div>
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

  // ── Feedback ──
  const loadFeedbacks = async () => {
    setFeedbackLoading(true);
    try {
      const { data, error } = await supabase.from("analysis_feedback" as any).select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      setFeedbacks((data as any[]) || []);
    } catch (e: any) {
      toast({ title: t("common", "error"), description: e.message, variant: "destructive" });
    } finally {
      setFeedbackLoading(false);
    }
  };

  const updateFeedbackStatus = async (id: string, status: string, reason?: string) => {
    try {
      const reviewerId = session?.user?.id;
      const { error } = await supabase.from("analysis_feedback" as any).update({
        status,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        ...(status === "approved" ? { applied_at: new Date().toISOString() } : {}),
        ...(status === "rejected" && reason ? { rejection_reason: reason } : {}),
      } as any).eq("id", id);
      if (error) throw error;
      toast({ title: t("common", "success"), description: status === "approved" ? "Onaylandı" : "Reddedildi" });
      loadFeedbacks();
    } catch (e: any) {
      toast({ title: t("common", "error"), description: e.message, variant: "destructive" });
    }
  };

  const openRejectDialog = (id: string) => {
    setRejectingFeedbackId(id);
    setRejectionReason("");
    setShowRejectDialog(true);
  };

  const confirmReject = async () => {
    if (!rejectingFeedbackId || !rejectionReason.trim()) return;
    await updateFeedbackStatus(rejectingFeedbackId, "rejected", rejectionReason.trim());
    setShowRejectDialog(false);
    setRejectingFeedbackId(null);
    setRejectionReason("");
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
    setCustName(""); setCustFactory(activeFactories[0]?.name || ""); setCustNotes(""); setCustSpecs(""); setCustActive(true);
    setShowCustomerDialog(true);
  };

  const openCustomerEdit = (c: any) => {
    setEditingCustomer(c);
    setCustName(c.name); setCustFactory(c.factory); setCustNotes(c.notes || ""); setCustSpecs(c.specs || ""); setCustActive(c.is_active);
    setShowCustomerDialog(true);
  };

  const handleSaveCustomer = async () => {
    if (!custName.trim()) return;
    setSubmitting(true);
    try {
      if (editingCustomer) {
        const { error } = await supabase.from("customers" as any).update({ name: custName.trim(), factory: custFactory, notes: custNotes.trim() || null, specs: custSpecs.trim() || null, is_active: custActive } as any).eq("id", editingCustomer.id);
        if (error) throw error;
        toast({ title: t("common", "success"), description: "Müşteri güncellendi" });
      } else {
        const { error } = await supabase.from("customers" as any).insert({ name: custName.trim(), factory: custFactory, notes: custNotes.trim() || null, specs: custSpecs.trim() || null, is_active: custActive } as any);
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

  // ── Factory CRUD ──
  const openFactoryCreate = () => {
    setEditingFactory(null);
    setFactName(""); setFactActive(true); setFactSortOrder(allFactories.length);
    setShowFactoryDialog(true);
  };

  const openFactoryEdit = (f: any) => {
    setEditingFactory(f);
    setFactName(f.name); setFactActive(f.is_active); setFactSortOrder(f.sort_order);
    setShowFactoryDialog(true);
  };

  const handleSaveFactory = async () => {
    if (!factName.trim()) return;
    setSubmitting(true);
    try {
      if (editingFactory) {
        const { error } = await supabase.from("factories" as any).update({ name: factName.trim(), is_active: factActive, sort_order: factSortOrder } as any).eq("id", editingFactory.id);
        if (error) throw error;
        toast({ title: t("common", "success"), description: "Fabrika güncellendi" });
      } else {
        const { error } = await supabase.from("factories" as any).insert({ name: factName.trim(), is_active: factActive, sort_order: factSortOrder } as any);
        if (error) throw error;
        toast({ title: t("common", "success"), description: "Fabrika eklendi" });
      }
      setShowFactoryDialog(false);
      reloadFactories();
    } catch (e: any) {
      toast({ title: t("common", "error"), description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFactory = async (id: string) => {
    if (!confirm("Bu fabrikayı silmek istediğinize emin misiniz?")) return;
    try {
      const { error } = await supabase.from("factories" as any).delete().eq("id", id);
      if (error) throw error;
      toast({ title: t("common", "success"), description: "Fabrika silindi" });
      reloadFactories();
    } catch (e: any) {
      toast({ title: t("common", "error"), description: e.message, variant: "destructive" });
    }
  };

  // Permission helpers
  const canEditUsers = canEdit("admin_users");
  const canEditCustomers = canEdit("admin_customers");
  const canEditFactories = canEdit("admin_factories");
  const canEditMachines = canEdit("admin_machines");
  const canEditModules = canEdit("admin_modules");
  const canEditMenu = canEdit("admin_menu");
  const canEditFeedback = canEdit("admin_feedback");

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">{t("admin", "title")}</h2>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" /> Kullanıcılar</TabsTrigger>
          <TabsTrigger value="customers" className="gap-2"><Building2 className="w-4 h-4" /> Müşteriler</TabsTrigger>
          <TabsTrigger value="factories" className="gap-2"><Factory className="w-4 h-4" /> Fabrikalar</TabsTrigger>
          <TabsTrigger value="machines" className="gap-2"><Monitor className="w-4 h-4" /> Makine Parkı</TabsTrigger>
          <TabsTrigger value="modules" className="gap-2"><Package className="w-4 h-4" /> Modüller</TabsTrigger>
          <TabsTrigger value="menu" className="gap-2"><LayoutGrid className="w-4 h-4" /> Menü</TabsTrigger>
          <TabsTrigger value="feedback" className="gap-2" onClick={() => { if (!feedbacks.length) loadFeedbacks(); }}><Brain className="w-4 h-4" /> AI Eğitim</TabsTrigger>
        </TabsList>

        {/* ── Users Tab ── */}
        <TabsContent value="users" className="space-y-4 mt-4">
          {!canEditUsers && <ReadOnlyBanner />}
          {canEditUsers && (
            <div className="flex justify-end">
              <Button onClick={openCreate} className="gap-2">
                <Plus className="w-4 h-4" />
                {t("admin", "createUser")}
              </Button>
            </div>
          )}

          <div className="grid gap-4">
            {users.map((user) => (
              <Card key={user.id} className="border-border bg-card">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {user.profile?.avatar_url ? (
                            <img src={user.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Users className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0">
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
                                  {getModuleName(p.module_key)}
                                </span>
                              ))}
                          </div>
                        </div>
                      </div>
                    {canEditUsers && (
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
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Customers Tab ── */}
        <TabsContent value="customers" className="space-y-4 mt-4">
          {!canEditCustomers && <ReadOnlyBanner />}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Müşteri tanımları tüm modüllerde ortak kullanılır.</p>
            {canEditCustomers && <Button onClick={openCustomerCreate} className="gap-2"><Plus className="w-4 h-4" /> Müşteri Ekle</Button>}
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
                        {c.specs && <p className="text-xs text-primary/80 mt-0.5">📋 Spec tanımlı</p>}
                      </div>
                    </div>
                    {canEditCustomers && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openCustomerEdit(c)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteCustomer(c.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {allCustomers.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Henüz müşteri tanımlanmamış.</p>}
          </div>

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
                      {activeFactories.map((f) => (
                        <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notlar (opsiyonel)</Label>
                  <Textarea value={custNotes} onChange={(e) => setCustNotes(e.target.value.slice(0, 500))} placeholder="Ek bilgi..." rows={2} />
                </div>
                <div>
                  <Label>Müşteri Specleri (opsiyonel)</Label>
                  <Textarea value={custSpecs} onChange={(e) => setCustSpecs(e.target.value.slice(0, 2000))} placeholder="Müşteri özel gereksinimleri, tolerans standartları, yüzey kalitesi beklentileri, malzeme tercihleri vb." rows={4} />
                  <p className="text-xs text-muted-foreground mt-1">Bu specler teknik resim analizinde AI tarafından otomatik olarak dikkate alınır.</p>
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

        {/* ── Factories Tab ── */}
        <TabsContent value="factories" className="space-y-4 mt-4">
          {!canEditFactories && <ReadOnlyBanner />}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Fabrika tanımları müşteri, makine ve analiz modüllerinde kullanılır.</p>
            {canEditFactories && <Button onClick={openFactoryCreate} className="gap-2"><Plus className="w-4 h-4" /> Fabrika Ekle</Button>}
          </div>
          <div className="grid gap-3">
            {allFactories.map((f) => (
              <Card key={f.id} className="border-border bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Factory className="w-5 h-5 text-primary" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{f.name}</span>
                          {!f.is_active && <Badge variant="secondary" className="text-xs">Pasif</Badge>}
                          <Badge variant="outline" className="text-xs">Sıra: {f.sort_order}</Badge>
                        </div>
                      </div>
                    </div>
                    {canEditFactories && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openFactoryEdit(f)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteFactory(f.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {allFactories.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Henüz fabrika tanımlanmamış.</p>}
          </div>

          <Dialog open={showFactoryDialog} onOpenChange={setShowFactoryDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingFactory ? "Fabrika Düzenle" : "Yeni Fabrika"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Fabrika Adı</Label>
                  <Input value={factName} onChange={(e) => setFactName(e.target.value.slice(0, 100))} placeholder="Fabrika adı..." />
                </div>
                <div>
                  <Label>Sıralama</Label>
                  <Input type="number" value={factSortOrder} onChange={(e) => setFactSortOrder(Number(e.target.value))} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={factActive} onCheckedChange={setFactActive} />
                  <Label>Aktif</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowFactoryDialog(false)}>İptal</Button>
                <Button onClick={handleSaveFactory} disabled={submitting || !factName.trim()}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  {editingFactory ? "Güncelle" : "Ekle"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── Machines Tab ── */}
        <TabsContent value="machines" className="mt-4">
          {!canEditMachines && <ReadOnlyBanner />}
          <MachineManager readOnly={!canEditMachines} />
        </TabsContent>

        {/* ── Modules Tab ── */}
        <TabsContent value="modules" className="mt-4">
          {!canEditModules && <ReadOnlyBanner />}
          <ModuleManager onUpdated={() => { reloadModules(); }} readOnly={!canEditModules} />
        </TabsContent>

        {/* ── Menu Tab ── */}
        <TabsContent value="menu" className="mt-4">
          {!canEditMenu && <ReadOnlyBanner />}
          <MenuManager onUpdated={() => { onMenuUpdated?.(); reloadModules(); }} readOnly={!canEditMenu} />
        </TabsContent>

        {/* ── Feedback Tab ── */}
        <TabsContent value="feedback" className="space-y-4 mt-4">
          {!canEditFeedback && <ReadOnlyBanner />}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Teknik resim analizlerinden gelen geri bildirimler. Onaylanan bildirimler AI eğitimi için kullanılır.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadFeedbacks} disabled={feedbackLoading}>
                {feedbackLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Yenile
              </Button>
              {canEditFeedback && (
                <Button size="sm" onClick={trainAI} disabled={trainingInProgress || !feedbacks.some(f => f.status === "approved")} className="gap-1.5">
                  {trainingInProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                  AI'yı Eğit ({feedbacks.filter(f => f.status === "approved").length})
                </Button>
              )}
            </div>
          </div>

          {/* Analytics Dashboard */}
          {feedbacks.length > 0 && (() => {
            const rated = feedbacks.filter(f => f.rating);
            const avgRating = rated.length ? (rated.reduce((s: number, f: any) => s + f.rating, 0) / rated.length) : 0;
            const pendingCount = feedbacks.filter(f => f.status === "pending").length;
            const approvedCount = feedbacks.filter(f => f.status === "approved").length;
            const rejectedCount = feedbacks.filter(f => f.status === "rejected").length;

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

            const distData = [1,2,3,4,5].map(r => ({
              star: `${r}★`,
              count: rated.filter((f: any) => f.rating === r).length,
            }));

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
                           <span>Gönderen: {(() => {
                             const u = users.find(u => u.id === fb.user_id);
                             return u?.profile?.display_name || u?.email || fb.user_id?.slice(0, 8) + "...";
                           })()}</span>
                         </div>
                         {fb.reviewed_by && (
                           <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                             <ShieldCheck className="w-3 h-3" />
                             <span>{fb.status === "approved" ? "Onaylayan" : "Reddeden"}: {(() => {
                               const u = users.find(u => u.id === fb.reviewed_by);
                               return u?.profile?.display_name || u?.email || fb.reviewed_by?.slice(0, 8) + "...";
                             })()}</span>
                             {fb.reviewed_at && <span className="ml-1">({new Date(fb.reviewed_at).toLocaleString("tr-TR")})</span>}
                           </div>
                         )}
                         {fb.file_name && <p className="text-xs text-muted-foreground">Dosya: {fb.file_name}</p>}
                         <p className="text-sm text-foreground bg-secondary/30 p-2 rounded">{fb.feedback_text}</p>
                         {fb.status === "rejected" && fb.rejection_reason && (
                           <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2 rounded">
                             <span className="font-medium">Red Açıklaması:</span> {fb.rejection_reason}
                           </div>
                         )}
                         <p className="text-xs text-muted-foreground">{new Date(fb.created_at).toLocaleString("tr-TR")}</p>
                      </div>
                      {canEditFeedback && (
                        <div className="flex gap-1 shrink-0">
                          {fb.status === "pending" && (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-success hover:text-success" onClick={() => updateFeedbackStatus(fb.id, "approved")} title="Onayla">
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openRejectDialog(fb.id)} title="Reddet">
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteFeedback(fb.id)} title="Sil">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Reject Reason Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Red Açıklaması</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Bu geri bildirimi neden reddettiğinizi açıklayın.</p>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Red açıklaması yazın..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>İptal</Button>
            <Button variant="destructive" onClick={confirmReject} disabled={!rejectionReason.trim()}>
              Reddet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            {newIsAdmin && (
              <div>
                <Label>Yönetim Paneli Yetkileri</Label>
                <AdminPermissionToggles
                  perms={newAdminPerms}
                  onChange={(k, field, v) => setNewAdminPerms((p) => ({ ...p, [k]: { ...p[k], [field]: v } }))}
                />
              </div>
            )}
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
            {/* Avatar Upload */}
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden border-2 border-border">
                  {editAvatarUrl ? (
                    <img src={editAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <button
                  onClick={() => editAvatarRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md"
                  disabled={uploadingEditAvatar}
                >
                  <Camera className="w-3.5 h-3.5 text-primary-foreground" />
                </button>
                <input ref={editAvatarRef} type="file" accept="image/*" className="hidden" onChange={handleEditAvatarUpload} />
              </div>
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{editDisplayName || editEmail}</p>
                <p>Profil fotoğrafını değiştirmek için kamera ikonuna tıklayın</p>
              </div>
            </div>
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
            {editIsAdmin && (
              <div>
                <Label>Yönetim Paneli Yetkileri</Label>
                <AdminPermissionToggles
                  perms={editAdminPerms}
                  onChange={(k, field, v) => setEditAdminPerms((p) => ({ ...p, [k]: { ...p[k], [field]: v } }))}
                />
              </div>
            )}
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
