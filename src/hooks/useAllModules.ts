import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the unique set of all known module_keys from both
 * menu_category_modules (assigned) and module_translations (registered).
 * This ensures new modules appear even before being assigned to a menu.
 */
export const useAllModules = () => {
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [assignedRes, translationsRes] = await Promise.all([
        supabase.from("menu_category_modules").select("module_key"),
        supabase.from("module_translations").select("module_key"),
      ]);
      const assignedKeys = (assignedRes.data || []).map((d) => d.module_key);
      const translationKeys = (translationsRes.data || []).map((d) => d.module_key);
      const unique = [...new Set([...assignedKeys, ...translationKeys])].sort();
      setModules(unique);
    } catch (e) {
      console.error("Failed to load modules:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return { modules, loading, reload: load };
};
