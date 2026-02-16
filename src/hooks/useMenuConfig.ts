import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MenuCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  bg_color: string;
  text_color: string;
  border_color: string;
  sort_order: number;
  modules: { module_key: string; sort_order: number }[];
}

const DEFAULT_CATEGORIES: MenuCategory[] = [
  { id: "ai", name: "AI & Analiz", icon: "Cpu", color: "from-violet-500 to-purple-700", bg_color: "bg-violet-500/10", text_color: "text-violet-400", border_color: "border-violet-500/30", sort_order: 0, modules: [{ module_key: "ai-learn", sort_order: 0 }, { module_key: "drawing", sort_order: 1 }] },
  { id: "machining", name: "İşleme", icon: "Wrench", color: "from-orange-500 to-amber-700", bg_color: "bg-orange-500/10", text_color: "text-orange-400", border_color: "border-orange-500/30", sort_order: 1, modules: [{ module_key: "cutting", sort_order: 0 }, { module_key: "toollife", sort_order: 1 }, { module_key: "threading", sort_order: 2 }, { module_key: "drilling", sort_order: 3 }, { module_key: "tolerance", sort_order: 4 }] },
  { id: "analysis", name: "Maliyet & Karşılaştırma", icon: "BarChart3", color: "from-emerald-500 to-green-700", bg_color: "bg-emerald-500/10", text_color: "text-emerald-400", border_color: "border-emerald-500/30", sort_order: 2, modules: [{ module_key: "costcalc", sort_order: 0 }, { module_key: "cost", sort_order: 1 }, { module_key: "compare", sort_order: 2 }] },
  { id: "data", name: "Veri", icon: "FolderOpen", color: "from-sky-500 to-blue-700", bg_color: "bg-sky-500/10", text_color: "text-sky-400", border_color: "border-sky-500/30", sort_order: 3, modules: [{ module_key: "materials", sort_order: 0 }, { module_key: "history", sort_order: 1 }] },
];

export const useMenuConfig = () => {
  const [categories, setCategories] = useState<MenuCategory[]>(DEFAULT_CATEGORIES);
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
