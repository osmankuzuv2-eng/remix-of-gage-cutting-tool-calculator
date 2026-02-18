import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the unique set of module_keys currently assigned
 * to any menu category in the database.
 * Falls back to an empty array while loading.
 */
export const useAllModules = () => {
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data } = await supabase
        .from("menu_category_modules")
        .select("module_key");
      if (data) {
        const unique = [...new Set(data.map((d) => d.module_key))].sort();
        setModules(unique);
      }
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
