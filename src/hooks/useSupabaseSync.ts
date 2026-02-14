import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

import { toast } from "@/hooks/use-toast";
import { safeGetItem, safeSetItem, safeRemoveItem, isValidArray } from "@/lib/safeStorage";
import type { Json } from "@/integrations/supabase/types";

export interface CloudCalculation {
  id: string;
  user_id: string;
  calculation_type: string;
  input_data: Json;
  result_data: Json;
  notes: string | null;
  created_at: string;
}

export interface LocalCalculation {
  id: string;
  timestamp: number;
  type: "cutting" | "toollife" | "cost" | "threading" | "grinding" | "drilling";
  material: string;
  tool: string;
  parameters: Record<string, number | string>;
  results: Record<string, number | string>;
}

const LOCAL_STORAGE_KEY = "cnc_calculation_history";

// Convert local format to cloud format
const toCloudFormat = (local: LocalCalculation): { calculation_type: string; input_data: Json; result_data: Json; notes: null } => ({
  calculation_type: local.type,
  input_data: {
    material: local.material,
    tool: local.tool,
    parameters: local.parameters as unknown as Json,
  } as Json,
  result_data: local.results as unknown as Json,
  notes: null,
});

// Convert cloud format to local format
const toLocalFormat = (cloud: CloudCalculation): LocalCalculation => {
  const inputData = cloud.input_data as Record<string, unknown> | null;
  const resultData = cloud.result_data as Record<string, unknown> | null;
  
  return {
    id: cloud.id,
    timestamp: new Date(cloud.created_at).getTime(),
    type: cloud.calculation_type as LocalCalculation["type"],
    material: (inputData?.material as string) || "Bilinmiyor",
    tool: (inputData?.tool as string) || "Bilinmiyor",
    parameters: (inputData?.parameters as Record<string, string | number>) || {},
    results: (resultData as Record<string, string | number>) || {},
  };
};

export const useSupabaseSync = () => {
  const user = null; // Auth removed
  const [calculations, setCalculations] = useState<LocalCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Load calculations from appropriate source
  const loadCalculations = useCallback(async () => {
    setLoading(true);
    
    if (user) {
      // Load from cloud
      try {
        const { data, error } = await supabase
          .from("saved_calculations")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) throw error;

        const cloudCalcs = (data || []).map(toLocalFormat);
        setCalculations(cloudCalcs);
        
        // Also update localStorage as backup
        safeSetItem(LOCAL_STORAGE_KEY, cloudCalcs);
      } catch (error) {
        console.error("Cloud fetch error:", error);
        // Fallback to localStorage with safe parsing
        const stored = safeGetItem<LocalCalculation[]>(LOCAL_STORAGE_KEY, []);
        if (isValidArray(stored)) {
          setCalculations(stored);
        }
      }
    } else {
      // Load from localStorage only with safe parsing
      const stored = safeGetItem<LocalCalculation[]>(LOCAL_STORAGE_KEY, []);
      if (isValidArray(stored)) {
        setCalculations(stored);
      }
    }
    
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadCalculations();
  }, [loadCalculations]);

  // Save calculation
  const saveCalculation = useCallback(async (
    record: Omit<LocalCalculation, "id" | "timestamp">
  ): Promise<LocalCalculation> => {
    const newRecord: LocalCalculation = {
      ...record,
      id: `calc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
    };

    if (user) {
      // Save to cloud
      try {
        const { data, error } = await supabase
          .from("saved_calculations")
          .insert({
            user_id: user.id,
            ...toCloudFormat(newRecord),
          })
          .select()
          .single();

        if (error) throw error;

        const cloudRecord = toLocalFormat(data);
        setCalculations(prev => [cloudRecord, ...prev]);
        
        // Update localStorage backup
        const updated = [cloudRecord, ...calculations].slice(0, 100);
        safeSetItem(LOCAL_STORAGE_KEY, updated);
        
        return cloudRecord;
      } catch (error) {
        console.error("Cloud save error:", error);
        // Fallback to localStorage
        setCalculations(prev => [newRecord, ...prev]);
        const updated = [newRecord, ...calculations].slice(0, 100);
        safeSetItem(LOCAL_STORAGE_KEY, updated);
        
        toast({
          title: "Çevrimdışı kayıt",
          description: "Hesaplama yerel olarak kaydedildi",
          variant: "default",
        });
        
        return newRecord;
      }
    } else {
      // Save to localStorage only
      setCalculations(prev => [newRecord, ...prev]);
      const updated = [newRecord, ...calculations].slice(0, 50);
      safeSetItem(LOCAL_STORAGE_KEY, updated);
      
      return newRecord;
    }
  }, [user, calculations]);

  // Delete calculation
  const deleteCalculation = useCallback(async (id: string) => {
    if (user) {
      try {
        const { error } = await supabase
          .from("saved_calculations")
          .delete()
          .eq("id", id);

        if (error) throw error;
      } catch (error) {
        console.error("Cloud delete error:", error);
      }
    }

    setCalculations(prev => prev.filter(c => c.id !== id));
    const updated = calculations.filter(c => c.id !== id);
    safeSetItem(LOCAL_STORAGE_KEY, updated);
  }, [user, calculations]);

  // Clear all calculations
  const clearAllCalculations = useCallback(async () => {
    if (user) {
      try {
        const { error } = await supabase
          .from("saved_calculations")
          .delete()
          .eq("user_id", user.id);

        if (error) throw error;
      } catch (error) {
        console.error("Cloud clear error:", error);
      }
    }

    setCalculations([]);
    safeRemoveItem(LOCAL_STORAGE_KEY);
  }, [user]);

  // Migrate localStorage data to cloud
  const migrateToCloud = useCallback(async () => {
    if (!user) return;

    const localCalcs = safeGetItem<LocalCalculation[]>(LOCAL_STORAGE_KEY, []);
    if (!isValidArray(localCalcs) || localCalcs.length === 0) return;

    setSyncing(true);

    try {
      // Check existing cloud data
      const { data: existingData } = await supabase
        .from("saved_calculations")
        .select("id")
        .limit(1);

      // Only migrate if cloud is empty
      if (!existingData || existingData.length === 0) {
        const cloudRecords = localCalcs.map(calc => ({
          user_id: user.id,
          ...toCloudFormat(calc),
        }));

        const { error } = await supabase
          .from("saved_calculations")
          .insert(cloudRecords);

        if (error) throw error;

        toast({
          title: "Senkronizasyon tamamlandı",
          description: `${localCalcs.length} hesaplama buluta aktarıldı`,
        });
      }

      await loadCalculations();
    } catch (error) {
      console.error("Migration error:", error);
      toast({
        title: "Senkronizasyon hatası",
        description: "Veriler aktarılamadı, tekrar deneyin",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }, [user, loadCalculations]);

  return {
    calculations,
    loading,
    syncing,
    saveCalculation,
    deleteCalculation,
    clearAllCalculations,
    migrateToCloud,
    refresh: loadCalculations,
    isCloudEnabled: !!user,
  };
};

// Legacy helper for backwards compatibility
export const saveCalculationLegacy = (
  record: Omit<LocalCalculation, "id" | "timestamp">
): LocalCalculation => {
  const history = safeGetItem<LocalCalculation[]>(LOCAL_STORAGE_KEY, []);
  const validHistory = isValidArray(history) ? history : [];

  const newRecord: LocalCalculation = {
    ...record,
    id: `calc-${Date.now()}`,
    timestamp: Date.now(),
  };

  validHistory.unshift(newRecord);
  const trimmed = validHistory.slice(0, 50);
  safeSetItem(LOCAL_STORAGE_KEY, trimmed);

  return newRecord;
};
