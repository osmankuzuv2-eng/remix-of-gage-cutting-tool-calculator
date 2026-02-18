import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MenuCategory {
  id: string;
  name: string;
  name_en: string | null;
  name_fr: string | null;
  icon: string;
  color: string;
  bg_color: string;
  text_color: string;
  border_color: string;
  sort_order: number;
  modules: { module_key: string; sort_order: number }[];
}

export const useMenuConfig = () => {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConfig = async () => {
    try {
      const [catsRes, modsRes] = await Promise.all([
        supabase.from("menu_categories").select("*").order("sort_order"),
        supabase.from("menu_category_modules").select("*").order("sort_order"),
      ]);

      if (catsRes.data && catsRes.data.length > 0) {
        const mods = modsRes.data || [];
        const merged: MenuCategory[] = catsRes.data.map((cat) => ({
          id: cat.id,
          name: cat.name,
          name_en: cat.name_en,
          name_fr: cat.name_fr,
          icon: cat.icon,
          color: cat.color,
          bg_color: cat.bg_color,
          text_color: cat.text_color,
          border_color: cat.border_color,
          sort_order: cat.sort_order,
          modules: mods
            .filter((m) => m.category_id === cat.id)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((m) => ({ module_key: m.module_key, sort_order: m.sort_order })),
        }));
        setCategories(merged);
      }
    } catch (e) {
      console.error("Failed to load menu config:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  return { categories, loading, reload: loadConfig };
};
