import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MaterialSettings {
  materialPrices: Record<string, number>;
  afkMultipliers: Record<string, number>;
}

export const useMaterialSettings = () => {
  const [materialPrices, setMaterialPrices] = useState<Record<string, number>>({});
  const [afkMultipliers, setAfkMultipliers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("material_settings")
        .select("material_id, price_per_kg, afk_multiplier");

      if (data) {
        const prices: Record<string, number> = {};
        const multipliers: Record<string, number> = {};
        for (const row of data) {
          if (row.price_per_kg != null && Number(row.price_per_kg) > 0) {
            prices[row.material_id] = Number(row.price_per_kg);
          }
          if (row.afk_multiplier != null) {
            multipliers[row.material_id] = Number(row.afk_multiplier);
          }
        }
        setMaterialPrices(prices);
        setAfkMultipliers(multipliers);
      }
    } catch (e) {
      console.error("Failed to load material settings:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updatePrice = useCallback(async (materialId: string, price: number) => {
    const oldPrice = materialPrices[materialId] ?? 0;
    setMaterialPrices((prev) => ({ ...prev, [materialId]: price }));

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("material_settings")
      .upsert(
        { material_id: materialId, price_per_kg: price, updated_by: user?.id },
        { onConflict: "material_id" }
      );

    if (error) {
      console.error("Failed to save price:", error);
      return;
    }

    // Log price change history
    if (user && oldPrice !== price) {
      await supabase.from("material_price_history").insert({
        material_id: materialId,
        old_price: oldPrice,
        new_price: price,
        changed_by: user.id,
        changed_by_name: user.user_metadata?.display_name || user.email || "Bilinmiyor",
        change_type: "price",
      } as any);
    }
  }, [materialPrices]);

  const updateAfkMultiplier = useCallback(async (materialId: string, multiplier: number) => {
    setAfkMultipliers((prev) => ({ ...prev, [materialId]: multiplier }));

    const { error } = await supabase
      .from("material_settings")
      .upsert(
        { material_id: materialId, afk_multiplier: multiplier },
        { onConflict: "material_id" }
      );

    if (error) console.error("Failed to save multiplier:", error);
  }, []);

  return { materialPrices, afkMultipliers, loading, updatePrice, updateAfkMultiplier, reload: load };
};
