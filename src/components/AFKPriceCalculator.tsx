import { useState, useMemo } from "react";
import { DollarSign, Circle, Percent, Package, Cpu, Clock } from "lucide-react";
import { materials } from "@/data/materials";
import { useMachines } from "@/hooks/useMachines";
import { useLanguage } from "@/i18n/LanguageContext";
import { safeGetItem } from "@/lib/safeStorage";

// Specific cutting force (Kc) by material category (N/mm²)
const getKc = (category: string): number => {
  const map: Record<string, number> = {
    "Çelik": 2100,
    "Paslanmaz Çelik": 2500,
    "Alüminyum": 800,
    "Titanyum": 1500,
    "Süper Alaşım": 3000,
    "Dökme Demir": 1200,
  };
  // Try exact match first, then partial
  if (map[category]) return map[category];
  for (const [key, val] of Object.entries(map)) {
    if (category.includes(key) || key.includes(category)) return val;
  }
  return 2000; // default for unknown
};

const MACHINE_EFFICIENCY = 0.75;

const AFKPriceCalculator = () => {
  const { t } = useLanguage();
  const { machines } = useMachines();
  const getMaterialName = (id: string) => {
    const tr = t("materialNames", id);
    return tr !== id ? tr : materials.find((m) => m.id === id)?.name || id;
  };

  const [selectedMaterial, setSelectedMaterial] = useState(materials[0].id);
  const [grossWeight, setGrossWeight] = useState(0);
  const [netWeight, setNetWeight] = useState(0);
  const [hasHoles, setHasHoles] = useState(false);
  const [smallHoles, setSmallHoles] = useState(0);
  const [largeHoles, setLargeHoles] = useState(0);
  const [profitMargin, setProfitMargin] = useState(20);
  const [quantity, setQuantity] = useState(1);
  const [selectedMachine, setSelectedMachine] = useState("");
  const [machineRate, setMachineRate] = useState(0);

  const savedPrices = safeGetItem<Record<string, number>>("cnc_material_prices", {}) || {};
  const currentMaterial = materials.find((m) => m.id === selectedMaterial);
  const materialPrice = savedPrices[selectedMaterial] ?? currentMaterial?.pricePerKg ?? 0;
  const currentMachine = machines.find((m) => m.id === selectedMachine);

  // Auto-select first machine when loaded
  useMemo(() => {
    if (machines.length > 0 && !selectedMachine) {
      setSelectedMachine(machines[0].id);
    }
  }, [machines]);

  const calculations = useMemo(() => {
    const density = currentMaterial?.density ?? 7.85;
    const chipWeight = Math.max(0, grossWeight - netWeight);
    const rawMaterialCost = grossWeight * materialPrice;
    const chipCost = chipWeight * materialPrice;

    // Calculate machining time from machine power
    const chipVolumeCm3 = (chipWeight * 1000) / density; // cm³
    const powerKw = currentMachine?.power_kw ?? 0;
    const kc = getKc(currentMaterial?.category ?? "Çelik");
    const mrrCm3PerMin = powerKw > 0 ? (powerKw * 1000 * MACHINE_EFFICIENCY * 1000) / kc / 1000 : 0;
    const machiningTimeMin = mrrCm3PerMin > 0 ? chipVolumeCm3 / mrrCm3PerMin : 0;
    const machineCost = machiningTimeMin * machineRate;

    const smallHoleCost = hasHoles ? smallHoles * 1.5 : 0;
    const largeHoleCost = hasHoles ? largeHoles * 1.0 : 0;
    const totalHoleCost = smallHoleCost + largeHoleCost;
    const subtotal = rawMaterialCost + chipCost + totalHoleCost + machineCost;
    const profit = subtotal * (profitMargin / 100);
    const unitTotal = subtotal + profit;
    const grandTotal = unitTotal * quantity;

    return {
      chipWeight: chipWeight.toFixed(3),
      chipVolumeCm3: chipVolumeCm3.toFixed(1),
      rawMaterialCost: rawMaterialCost.toFixed(2),
      chipCost: chipCost.toFixed(2),
      mrrCm3PerMin: mrrCm3PerMin.toFixed(1),
      machiningTimeMin: machiningTimeMin.toFixed(1),
      machineCost: machineCost.toFixed(2),
      smallHoleCost: smallHoleCost.toFixed(2),
      largeHoleCost: largeHoleCost.toFixed(2),
      totalHoleCost: totalHoleCost.toFixed(2),
      subtotal: subtotal.toFixed(2),
      profit: profit.toFixed(2),
      unitTotal: unitTotal.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
    };
  }, [grossWeight, netWeight, materialPrice, currentMaterial, currentMachine, hasHoles, smallHoles, largeHoles, profitMargin, quantity, machineRate]);

  return (
    <div className="industrial-card p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-amber-500/20">
          <DollarSign className="w-5 h-5 text-amber-400" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">{t("afkPrice", "title")}</h2>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="space-y-4">
          <h3 className="label-industrial">{t("afkPrice", "inputs")}</h3>

          {/* Material */}
          <div>
            <label className="label-industrial block mb-2">{t("costCalc", "materialType")}</label>
            <select
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
              className="input-industrial w-full"
            >
              {materials.map((mat) => (
                <option key={mat.id} value={mat.id}>{getMaterialName(mat.id)}</option>
              ))}
            </select>
            <div className="text-xs text-muted-foreground mt-1">
              {t("afkPrice", "materialPrice")}: €{materialPrice}/kg · {t("afkPrice", "density")}: {currentMaterial?.density ?? 7.85} g/cm³
            </div>
          </div>

          {/* Weights */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-industrial block mb-2">{t("afkPrice", "grossWeight")}</label>
              <input type="number" value={grossWeight} onChange={(e) => setGrossWeight(Number(e.target.value))} className="input-industrial w-full" min={0} step={0.001} />
            </div>
            <div>
              <label className="label-industrial block mb-2">{t("afkPrice", "netWeight")}</label>
              <input type="number" value={netWeight} onChange={(e) => setNetWeight(Number(e.target.value))} className="input-industrial w-full" min={0} step={0.001} />
            </div>
          </div>

          {/* Chip info */}
          <div className="p-3 rounded-lg bg-secondary/20 border border-border space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("afkPrice", "chipWeight")}</span>
              <span className="font-mono text-foreground">{calculations.chipWeight} kg</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("afkPrice", "chipVolume")}</span>
              <span className="font-mono text-foreground">{calculations.chipVolumeCm3} cm³</span>
            </div>
          </div>

          {/* Machine selection */}
          <div className="pt-2 border-t border-border space-y-3">
            <label className="label-industrial flex items-center gap-1"><Cpu className="w-3 h-3" /> {t("afkPrice", "machineSelection")}</label>
            <select
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value)}
              className="input-industrial w-full"
            >
              {machines.map((m) => (
                <option key={m.id} value={m.id}>{m.label} ({m.power_kw ?? 0} kW)</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-2 rounded bg-secondary/20 text-center">
                <div className="text-xs text-muted-foreground">{t("afkPrice", "mrr")}</div>
                <div className="font-mono text-sm font-medium text-foreground">{calculations.mrrCm3PerMin} cm³/dk</div>
              </div>
              <div className="p-2 rounded bg-secondary/20 text-center">
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Clock className="w-3 h-3" /> {t("afkPrice", "machiningTime")}</div>
                <div className="font-mono text-sm font-medium text-foreground">{calculations.machiningTimeMin} dk</div>
              </div>
            </div>
            <div>
              <label className="label-industrial block mb-1 text-xs">{t("afkPrice", "machineRate")}</label>
              <div className="flex items-center gap-2">
                <input type="number" value={machineRate} onChange={(e) => setMachineRate(Number(e.target.value))} className="input-industrial w-full text-sm" min={0} step={0.01} />
                <span className="text-xs text-muted-foreground whitespace-nowrap">€/{t("common", "minute")}</span>
              </div>
            </div>
          </div>

          {/* Holes toggle */}
          <div className="pt-2 border-t border-border">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={hasHoles} onChange={(e) => setHasHoles(e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
              <span className="label-industrial flex items-center gap-1">
                <Circle className="w-3 h-3" /> {t("afkPrice", "hasHoles")}
              </span>
            </label>
          </div>

          {hasHoles && (
            <div className="grid grid-cols-2 gap-3 animate-fade-in">
              <div>
                <label className="label-industrial block mb-2">{t("afkPrice", "smallHoles")} (€1,50)</label>
                <input type="number" value={smallHoles} onChange={(e) => setSmallHoles(Number(e.target.value))} className="input-industrial w-full" min={0} />
              </div>
              <div>
                <label className="label-industrial block mb-2">{t("afkPrice", "largeHoles")} (€1,00)</label>
                <input type="number" value={largeHoles} onChange={(e) => setLargeHoles(Number(e.target.value))} className="input-industrial w-full" min={0} />
              </div>
            </div>
          )}

          {/* Quantity & Profit */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
            <div>
              <label className="label-industrial block mb-2 flex items-center gap-1"><Package className="w-3 h-3" /> {t("afkPrice", "quantity")}</label>
              <input type="number" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} className="input-industrial w-full" min={1} />
            </div>
            <div>
              <label className="label-industrial block mb-2 flex items-center gap-1"><Percent className="w-3 h-3" /> {t("afkPrice", "profitMargin")}</label>
              <input type="number" value={profitMargin} onChange={(e) => setProfitMargin(Number(e.target.value))} className="input-industrial w-full" min={0} />
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          <h3 className="label-industrial">{t("afkPrice", "results")}</h3>

          <div className="p-4 rounded-lg metal-surface border border-border text-center">
            <span className="label-industrial">{t("afkPrice", "unitPrice")}</span>
            <div className="font-mono text-4xl font-bold text-primary mt-2">€{calculations.unitTotal}</div>
          </div>

          <div className="space-y-2">
            <ResultRow label={`${t("afkPrice", "rawMaterialCost")} (${grossWeight} kg × €${materialPrice})`} value={`€${calculations.rawMaterialCost}`} />
            <ResultRow label={`${t("afkPrice", "chipCost")} (${calculations.chipWeight} kg × €${materialPrice})`} value={`€${calculations.chipCost}`} />
            <ResultRow label={`${t("afkPrice", "machineCostLabel")} (${calculations.machiningTimeMin} dk × €${machineRate})`} value={`€${calculations.machineCost}`} />
            {hasHoles && (
              <>
                <ResultRow label={`${t("afkPrice", "smallHoles")} (${smallHoles} × €1,50)`} value={`€${calculations.smallHoleCost}`} />
                <ResultRow label={`${t("afkPrice", "largeHoles")} (${largeHoles} × €1,00)`} value={`€${calculations.largeHoleCost}`} />
                <ResultRow label={t("afkPrice", "totalHoleCost")} value={`€${calculations.totalHoleCost}`} />
              </>
            )}
            <ResultRow label={t("afkPrice", "subtotal")} value={`€${calculations.subtotal}`} />
            <ResultRow label={`${t("afkPrice", "profit")} (%${profitMargin})`} value={`€${calculations.profit}`} highlight />
          </div>

          <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
            <div className="flex justify-between items-center">
              <span className="font-medium text-foreground">{t("afkPrice", "grandTotal")}</span>
              <span className="font-mono text-2xl font-bold text-primary">€{calculations.grandTotal}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">{quantity} {t("common", "piece")} × €{calculations.unitTotal}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ResultRow = ({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) => (
  <div className={`flex justify-between items-center p-2 rounded ${highlight ? "bg-success/10" : "bg-secondary/20"}`}>
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className={`font-mono text-sm font-medium ${highlight ? "text-success" : "text-foreground"}`}>{value}</span>
  </div>
);

export default AFKPriceCalculator;
