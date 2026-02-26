import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const ADMIN_PANEL_KEYS = [
  "admin_users",
  "admin_customers",
  "admin_factories",
  "admin_machines",
  "admin_modules",
  "admin_menu",
  "admin_feedback",
  "admin_improvements",
  "admin_maintenance",
  "admin_toolroom",
] as const;

export type AdminPanelKey = (typeof ADMIN_PANEL_KEYS)[number];

export const ADMIN_PANEL_LABELS: Record<AdminPanelKey, string> = {
  admin_users: "Kullanıcılar",
  admin_customers: "Müşteriler",
  admin_factories: "Fabrikalar",
  admin_machines: "Makine Parkı",
  admin_modules: "Modüller",
  admin_menu: "Menü Yönetimi",
  admin_feedback: "AI Eğitim",
  admin_improvements: "İyileştirmeler",
  admin_maintenance: "Bakım Onarım",
  admin_toolroom: "Takımhane Raporu",
};

export interface AdminPermission {
  panel_key: string;
  can_view: boolean;
  can_edit: boolean;
}

export const useAdminPermissions = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPermissions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_panel_permissions" as any)
        .select("panel_key, can_view, can_edit")
        .eq("user_id", user.id);
      if (error) throw error;
      setPermissions((data as any[]) || []);
    } catch (err) {
      console.error("Failed to load admin permissions:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const canView = (key: AdminPanelKey): boolean => {
    // If no permissions set at all, default to view-only for admins
    const perm = permissions.find((p) => p.panel_key === key);
    if (!perm) return true; // admins can always view
    return perm.can_view;
  };

  const canEdit = (key: AdminPanelKey): boolean => {
    const perm = permissions.find((p) => p.panel_key === key);
    if (!perm) return false; // no permission record = no edit
    return perm.can_edit;
  };

  return { permissions, loading, canView, canEdit, reload: loadPermissions };
};
