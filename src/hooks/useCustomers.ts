import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Customer {
  id: string;
  name: string;
  factory: string;
  notes: string | null;
  is_active: boolean;
}

export const useCustomers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customers" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      setCustomers((data as any[]) || []);
    } catch (err) {
      console.error("Failed to load customers:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const activeCustomers = customers.filter((c) => c.is_active);

  return { customers, activeCustomers, loading, reload: loadCustomers };
};
