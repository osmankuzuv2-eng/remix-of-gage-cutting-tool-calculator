import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Factory {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export const useFactories = () => {
  const [factories, setFactories] = useState<Factory[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFactories = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("factories" as any)
        .select("*")
        .order("sort_order");
      if (error) throw error;
      setFactories((data as any[]) || []);
    } catch (err) {
      console.error("Failed to load factories:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFactories();
  }, [loadFactories]);

  const activeFactories = factories.filter((f) => f.is_active);

  return { factories, activeFactories, loading, reload: loadFactories };
};
