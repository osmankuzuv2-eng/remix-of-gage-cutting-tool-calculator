import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Machine {
  id: string;
  code: string;
  type: string;
  designation: string;
  brand: string;
  model: string;
  year: number;
  label: string;
  max_diameter_mm: number | null;
  power_kw: number | null;
  max_rpm: number | null;
  taper: string | null;
  has_live_tooling: boolean;
  has_y_axis: boolean;
  has_c_axis: boolean;
  travel_x_mm: number | null;
  travel_y_mm: number | null;
  travel_z_mm: number | null;
  is_active: boolean;
  sort_order: number;
}

export const useMachines = () => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMachines = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("machines")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    if (!error && data) setMachines(data as Machine[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchMachines();
  }, []);

  const getMachinesByType = (type: string) =>
    machines.filter((m) => m.type === type);

  const getMachineLabel = (id: string) =>
    machines.find((m) => m.id === id)?.label ?? id;

  return { machines, loading, fetchMachines, getMachinesByType, getMachineLabel };
};
