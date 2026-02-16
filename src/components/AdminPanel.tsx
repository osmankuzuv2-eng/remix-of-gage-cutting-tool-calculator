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
import { Loader2, Plus, Pencil, Key, Trash2, Shield, ShieldCheck, Users, Monitor, LayoutGrid } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  profile: { display_name: string | null; company: string | null; position: string | null } | null;
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

  // Password form
  const [changePassword, setChangePassword] = useState("");

  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">{t("admin", "title")}</h2>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" /> Kullanıcılar</TabsTrigger>
          <TabsTrigger value="machines" className="gap-2"><Monitor className="w-4 h-4" /> Makine Parkı</TabsTrigger>
          <TabsTrigger value="menu" className="gap-2"><LayoutGrid className="w-4 h-4" /> Menü Yönetimi</TabsTrigger>
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
