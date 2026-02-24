import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TimeImprovementImage {
  url: string;
  caption: string;
  uploaded_at: string;
}

export interface TimeImprovement {
  id: string;
  user_id: string;
  factory: string;
  reference_code: string;
  customer_name: string;
  machine_id: string | null;
  machine_name: string | null;
  part_name: string;
  operation_type: string;
  old_time_minutes: number;
  new_time_minutes: number;
  improvement_percent: number;
  old_price: number;
  new_price: number;
  price_improvement_percent: number;
  improvement_details: string | null;
  tool_changes: string | null;
  parameter_changes: string | null;
  notes: string | null;
  images: TimeImprovementImage[];
  created_by_name: string | null;
  improvement_date: string;
  created_at: string;
  updated_at: string;
}

export const useTimeImprovements = () => {
  const { user } = useAuth();
  const [improvements, setImprovements] = useState<TimeImprovement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("time_improvements" as any)
      .select("*")
      .order("improvement_date", { ascending: false });
    if (!error && data) setImprovements(data as any[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async (item: Omit<TimeImprovement, "id" | "user_id" | "improvement_percent" | "created_at" | "updated_at">) => {
    if (!user) return;
    const { error } = await supabase.from("time_improvements" as any).insert({ ...item, user_id: user.id } as any);
    if (!error) await load();
    return error;
  };

  const update = async (id: string, item: Partial<TimeImprovement>) => {
    const { error } = await supabase.from("time_improvements" as any).update(item as any).eq("id", id);
    if (!error) await load();
    return error;
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("time_improvements" as any).delete().eq("id", id);
    if (!error) await load();
    return error;
  };

  return { improvements, loading, reload: load, add, update, remove };
};
