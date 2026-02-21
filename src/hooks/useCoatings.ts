import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Coating {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
  sort_order: number;
}

export const useCoatings = () => {
  const [coatings, setCoatings] = useState<Coating[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCoatings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("coatings" as any)
        .select("*")
        .order("sort_order");
      if (error) throw error;
      setCoatings((data as any[]) || []);
    } catch (err) {
      console.error("Failed to load coatings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoatings();
  }, [loadCoatings]);

  const activeCoatings = coatings.filter((c) => c.is_active);

  return { coatings, activeCoatings, loading, reload: loadCoatings };
};
