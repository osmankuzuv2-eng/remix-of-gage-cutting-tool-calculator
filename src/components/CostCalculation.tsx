import { useState, useMemo, useEffect } from "react";
import { DollarSign, Calculator, Percent, Package, Truck, Flame, Shield, Wrench, FileDown, Weight, Ruler, Save, Info } from "lucide-react";
import { materials, Material } from "@/data/materials";
import { useMachines } from "@/hooks/useMachines";
import { exportCostPdf } from "@/lib/exportCostPdf";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useCustomers } from "@/hooks/useCustomers";
import { useCoatings } from "@/hooks/useCoatings";

interface CostCalculationProps {
  customMaterials?: Material[];
  materialPrices?: Record<string, number>;
}

const CostCalculation = ({ customMaterials = [], materialPrices = {} }: CostCalculationProps) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { saveCalculation } = useSupabaseSync();
  const { machines, getMachinesByType, getMachineLabel } = useMachines();
  const { activeCustomers } = useCustomers();
  const { activeCoatings } = useCoatings();

  const allMaterials = useMemo(() => [...materials, ...customMaterials], [customMaterials]);
  const getMaterialName = (id: string) => { const tr = t("materialNames", id); return tr !== id ? tr : allMaterials.find(m => m.id === id)?.name || id; };

  const [referenceNo, setReferenceNo] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState(materials[0].id);
  const [customer, setCustomer] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [laborRate, setLaborRate] = useState(0);
  const [selectedTurning, setSelectedTurning] = useState("");
  const [turningRate, setTurningRate] = useState(0);
  const [selectedMilling, setSelectedMilling] = useState("");
  const [millingRate, setMillingRate] = useState(0);
  const [selected5Axis, setSelected5Axis] = useState("");
  const [fiveAxisRate, setFiveAxisRate] = useState(0);

  // Helper to get minute_rate from machine
  const getMachineRate = (machineId: string): number => {
    const machine = machines.find(m => m.id === machineId);
    return machine?.minute_rate ?? 0;
  };

  // Initialize machine selections and auto-fill rates when machines load
  useEffect(() => {
    if (machines.length > 0) {
      if (!selectedTurning) {
        const t = getMachinesByType("turning")[0];
        if (t) { setSelectedTurning(t.id); setTurningRate(getMachineRate(t.id)); }
      }
      if (!selectedMilling) {
        const m4 = getMachinesByType("milling-4axis");
        const m3 = getMachinesByType("milling-3axis");
        const m = m4[0] || m3[0];
        if (m) { setSelectedMilling(m.id); setMillingRate(getMachineRate(m.id)); }
      }
      if (!selected5Axis) {
        const a = getMachinesByType("milling-5axis")[0];
        if (a) { setSelected5Axis(a.id); setFiveAxisRate(getMachineRate(a.id)); }
      }
    }
  }, [machines]);

  // Auto-fill rate when machine selection changes
  useEffect(() => { if (selectedTurning) setTurningRate(getMachineRate(selectedTurning)); }, [selectedTurning, machines]);
  useEffect(() => { if (selectedMilling) setMillingRate(getMachineRate(selectedMilling)); }, [selectedMilling, machines]);
  useEffect(() => { if (selected5Axis) setFiveAxisRate(getMachineRate(selected5Axis)); }, [selected5Axis, machines]);
  const [setupTime, setSetupTime] = useState(0);
  const [turningTime, setTurningTime] = useState(0);
  const [millingTime, setMillingTime] = useState(0);
  const [fiveAxisTime, setFiveAxisTime] = useState(0);
  const [orderQuantity, setOrderQuantity] = useState(0);
  const [shapeType, setShapeType] = useState<"round" | "rectangular">("round");
  const [diameter, setDiameter] = useState(0);
  const [length, setLength] = useState(0);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [materialPricePerKg, setMaterialPricePerKg] = useState(0);
  const [toolCost, setToolCost] = useState(0);
  const [shippingRate, setShippingRate] = useState(5);
  const [selectedCoating, setSelectedCoating] = useState("");
  const [coatingCost, setCoatingCost] = useState(0);
  const [coatingOpen, setCoatingOpen] = useState(false);
  const [heatTreatmentCost, setHeatTreatmentCost] = useState(0);
  const [scrapRate, setScrapRate] = useState(0);
  const [profitMargin, setProfitMargin] = useState(0);

  const currentMaterial = allMaterials.find(m => m.id === selectedMaterial);

  // Auto-fill material price from database when material changes
  useEffect(() => {
    // Check material_settings prices first (for default materials)
    if (materialPrices[selectedMaterial] != null) {
      setMaterialPricePerKg(materialPrices[selectedMaterial]);
    } else if (currentMaterial?.pricePerKg) {
      // For custom materials with embedded price
      setMaterialPricePerKg(currentMaterial.pricePerKg);
    } else {
      setMaterialPricePerKg(0);
    }
  }, [selectedMaterial, materialPrices, currentMaterial]);

  // Auto-fill coating price from database when coating changes
  useEffect(() => {
    if (selectedCoating) {
      const coating = activeCoatings.find(c => c.id === selectedCoating);
      setCoatingCost(coating?.price ?? 0);
    } else {
      setCoatingCost(0);
    }
  }, [selectedCoating, activeCoatings]);

  const calculations = useMemo(() => {
    const density = currentMaterial?.density ?? 7.85;
    let volumeCm3 = 0;
    if (shapeType === "round") volumeCm3 = Math.PI * Math.pow(diameter / 20, 2) * (length / 10);
    else volumeCm3 = (length / 10) * (width / 10) * (height / 10);
    const weightKg = (volumeCm3 * density) / 1000;

    // Malzeme maliyeti: 1x çarpan (sipariş adeti çarpılmaz)
    const materialCostPerPart = weightKg * materialPricePerKg;
    const totalMaterialCost = materialCostPerPart; // 1 adet için

    // Makine işleme maliyeti: parça başı süre × ücret × adet
    const machineCost = (turningRate * turningTime + millingRate * millingTime + fiveAxisRate * fiveAxisTime) * orderQuantity;

    // Setup maliyeti: setupTime × setupRate / orderQuantity (adet başına bölünür)
    const setupCostTotal = setupTime * laborRate;
    const setupCostPerPart = orderQuantity > 0 ? setupCostTotal / orderQuantity : setupCostTotal;

    // Toplam işleme süresi: sadece makine süreleri (dakika)
    const totalMachiningMinutes = turningTime + millingTime + fiveAxisTime;

    const baseSubtotal = setupCostTotal + machineCost + totalMaterialCost * orderQuantity + toolCost + coatingCost + heatTreatmentCost;
    const shippingCost = baseSubtotal * (shippingRate / 100);
    const additionalCosts = toolCost + shippingCost + coatingCost + heatTreatmentCost;
    const subtotal = setupCostTotal + machineCost + totalMaterialCost * orderQuantity + additionalCosts;
    const scrapCost = subtotal * (scrapRate / 100);
    const totalBeforeProfit = subtotal + scrapCost;
    const profit = totalBeforeProfit * (profitMargin / 100);
    const grandTotal = totalBeforeProfit + profit;
    const costPerPart = orderQuantity > 0 ? grandTotal / orderQuantity : 0;
    return {
      volumeCm3: volumeCm3.toFixed(2),
      weightKg: weightKg.toFixed(3),
      materialCostPerPart: materialCostPerPart.toFixed(2),
      totalMaterialCost: (totalMaterialCost * orderQuantity).toFixed(2),
      totalMachiningMinutes: totalMachiningMinutes.toFixed(1),
      setupCost: setupCostTotal.toFixed(2),
      setupCostPerPart: setupCostPerPart.toFixed(2),
      machineCost: machineCost.toFixed(2),
      shippingCost: shippingCost.toFixed(2),
      additionalCosts: additionalCosts.toFixed(2),
      scrapCost: scrapCost.toFixed(2),
      profit: profit.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      costPerPart: costPerPart.toFixed(2),
    };
  }, [setupTime, turningTime, millingTime, fiveAxisTime, orderQuantity, laborRate, turningRate, millingRate, fiveAxisRate, toolCost, shippingRate, coatingCost, heatTreatmentCost, scrapRate, profitMargin, shapeType, diameter, length, width, height, materialPricePerKg, currentMaterial]);

  return (
    <div className="industrial-card p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-emerald-500/20"><DollarSign className="w-5 h-5 text-emerald-400" /></div>
        <h2 className="text-lg font-semibold text-foreground">{t("costCalc", "title")}</h2>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Column 1 */}
        <div className="space-y-4">
          <h3 className="label-industrial flex items-center gap-2"><Calculator className="w-4 h-4" /> {t("costCalc", "basicInfo")}</h3>
          <div>
            <label className="label-industrial block mb-2">{t("costCalc", "referenceNo")}</label>
            <input type="text" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="REF-2026-001" className="input-industrial w-full" />
          </div>
          <div>
            <label className="label-industrial block mb-2">{t("costCalc", "materialType")}</label>
            <select value={selectedMaterial} onChange={(e) => setSelectedMaterial(e.target.value)} className="input-industrial w-full">
              {allMaterials.map((mat) => (<option key={mat.id} value={mat.id}>{getMaterialName(mat.id)}</option>))}
            </select>
          </div>
          <div className="pt-2 border-t border-border space-y-2">
            <label className="label-industrial flex items-center gap-1"><Ruler className="w-3 h-3" /> {t("costCalc", "materialDimensions")}</label>
            <div className="text-xs text-muted-foreground">{t("costCalc", "density")}: {currentMaterial?.density ?? 7.85} g/cm³</div>
            <div className="flex gap-2">
              <button onClick={() => setShapeType("round")} className={`flex-1 text-xs py-1.5 rounded border transition-colors ${shapeType === "round" ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}>⚫ {t("costCalc", "round")}</button>
              <button onClick={() => setShapeType("rectangular")} className={`flex-1 text-xs py-1.5 rounded border transition-colors ${shapeType === "rectangular" ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}>▬ {t("costCalc", "rectangular")}</button>
            </div>
            {shapeType === "round" ? (
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label-industrial block mb-1 text-xs">{t("common", "diameter")} (mm)</label><input type="number" value={diameter} onChange={(e) => setDiameter(Number(e.target.value))} className="input-industrial w-full text-sm" /></div>
                <div><label className="label-industrial block mb-1 text-xs">{t("costCalc", "length")}</label><input type="number" value={length} onChange={(e) => setLength(Number(e.target.value))} className="input-industrial w-full text-sm" /></div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <div><label className="label-industrial block mb-1 text-xs">{t("costCalc", "width")}</label><input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} className="input-industrial w-full text-sm" /></div>
                <div><label className="label-industrial block mb-1 text-xs">{t("costCalc", "length")}</label><input type="number" value={length} onChange={(e) => setLength(Number(e.target.value))} className="input-industrial w-full text-sm" /></div>
                <div><label className="label-industrial block mb-1 text-xs">{t("costCalc", "height")}</label><input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} className="input-industrial w-full text-sm" /></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded bg-secondary/20 text-center">
                <div className="text-xs text-muted-foreground">{t("costCalc", "weight")}</div>
                <div className="font-mono text-sm font-medium text-foreground">{calculations.weightKg} kg</div>
              </div>
              <div>
                <label className="label-industrial block mb-1 text-xs">{t("costCalc", "materialPriceKg")}</label>
                <input type="number" value={materialPricePerKg} onChange={(e) => setMaterialPricePerKg(Number(e.target.value))} className="input-industrial w-full text-sm" />
              </div>
            </div>
          </div>
          <div>
            <label className="label-industrial block mb-2">{t("costCalc", "customer")}</label>
            <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
              <PopoverTrigger asChild>
                <button className="input-industrial w-full text-left flex items-center justify-between">
                  <span className={customer ? "text-foreground" : "text-muted-foreground"}>{customer || t("costCalc", "selectCustomer")}</span>
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-card border border-border z-50" align="start">
                <div className="max-h-60 overflow-y-auto">
                  {activeCustomers.map((c) => (<button key={c.id} onClick={() => { setCustomer(c.name); setCustomerOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-accent/10 ${customer === c.name ? "bg-primary/10 text-primary font-medium" : "text-foreground"}`}>{c.name} <span className="text-xs text-muted-foreground ml-1">({c.factory})</span></button>))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label className="label-industrial block mb-2">{t("costCalc", "setupRate") || "Setup Ücreti (€/dk)"}</label>
            <input type="number" value={laborRate} onChange={(e) => setLaborRate(Number(e.target.value))} className="input-industrial w-full" />
          </div>
          <div className="space-y-3">
            <label className="label-industrial block">{t("costCalc", "machineSelection")}</label>
            {([
              { label: t("costCalc", "turning"), types: ["turning"], value: selectedTurning, setValue: setSelectedTurning, rate: turningRate, setRate: setTurningRate, time: turningTime, setTime: setTurningTime },
              { label: t("costCalc", "milling"), types: ["milling-3axis", "milling-4axis"], value: selectedMilling, setValue: setSelectedMilling, rate: millingRate, setRate: setMillingRate, time: millingTime, setTime: setMillingTime },
              { label: t("costCalc", "fiveAxis"), types: ["milling-5axis"], value: selected5Axis, setValue: setSelected5Axis, rate: fiveAxisRate, setRate: setFiveAxisRate, time: fiveAxisTime, setTime: setFiveAxisTime },
            ]).map((machine) => (
              <div key={machine.types.join("-")} className="p-3 rounded-lg bg-secondary/20 border border-border space-y-2">
                <span className="text-xs font-medium text-muted-foreground">{machine.label}</span>
                <select value={machine.value} onChange={(e) => machine.setValue(e.target.value)} className="input-industrial w-full text-sm">
                  {machine.types.flatMap(t => getMachinesByType(t)).map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1">
                    <input type="number" value={machine.rate} onChange={(e) => machine.setRate(Number(e.target.value))} className="input-industrial w-full text-sm" placeholder="0" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">€/dk</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input type="number" value={machine.time} onChange={(e) => machine.setTime(Number(e.target.value))} className="input-industrial w-full text-sm" placeholder="0" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">dk</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2 */}
        <div className="space-y-4">
          <h3 className="label-industrial flex items-center gap-2"><Package className="w-4 h-4" /> {t("costCalc", "productionAndCosts")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label-industrial block mb-2">{t("costCalc", "setupTime")}</label><input type="number" value={setupTime} onChange={(e) => setSetupTime(Number(e.target.value))} className="input-industrial w-full" /></div>
            <div><label className="label-industrial block mb-2">{t("costCalc", "orderQuantity")}</label><input type="number" value={orderQuantity} onChange={(e) => setOrderQuantity(Number(e.target.value))} className="input-industrial w-full" /></div>
          </div>
          <div className="pt-2 border-t border-border">
            <h4 className="label-industrial mb-3 flex items-center gap-2">{t("costCalc", "additionalCosts")}</h4>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label-industrial block mb-2 flex items-center gap-1"><Wrench className="w-3 h-3" /> {t("costCalc", "toolCostLabel")}</label><input type="number" value={toolCost} onChange={(e) => setToolCost(Number(e.target.value))} className="input-industrial w-full" /></div>
              <div>
                <label className="label-industrial block mb-2 flex items-center gap-1">
                  <Truck className="w-3 h-3" /> {t("costCalc", "shipping")} (%)
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="ml-1 text-muted-foreground hover:text-foreground transition-colors"><Info className="w-3 h-3" /></button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 text-xs bg-card border border-border z-50" side="top">
                      <p className="font-medium mb-1">Nakliye Hesaplama</p>
                      <p className="text-muted-foreground">Nakliye ücreti, toplam maliyetin (malzeme + işçilik + tezgah + takım + kaplama + ısıl işlem) belirtilen yüzdesi olarak hesaplanır.</p>
                      <p className="mt-1 text-muted-foreground">Hesaplanan: €{calculations.shippingCost}</p>
                    </PopoverContent>
                  </Popover>
                </label>
                <input type="number" value={shippingRate} onChange={(e) => setShippingRate(Number(e.target.value))} className="input-industrial w-full" />
              </div>
              <div>
                <label className="label-industrial block mb-2 flex items-center gap-1"><Shield className="w-3 h-3" /> {t("costCalc", "coating")}</label>
                <Popover open={coatingOpen} onOpenChange={setCoatingOpen}>
                  <PopoverTrigger asChild>
                    <button className="input-industrial w-full text-left flex items-center justify-between text-sm">
                      <span className={selectedCoating ? "text-foreground" : "text-muted-foreground"}>
                        {selectedCoating ? activeCoatings.find(c => c.id === selectedCoating)?.name || "Seçiniz" : "Kaplama Seçiniz"}
                      </span>
                      <svg className="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-card border border-border z-50" align="start">
                    <div className="max-h-48 overflow-y-auto">
                      <button onClick={() => { setSelectedCoating(""); setCoatingOpen(false); }} className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-accent/10 ${!selectedCoating ? "bg-primary/10 text-primary font-medium" : "text-foreground"}`}>Kaplama Yok</button>
                      {activeCoatings.map((c) => (
                        <button key={c.id} onClick={() => { setSelectedCoating(c.id); setCoatingOpen(false); }} className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-accent/10 ${selectedCoating === c.id ? "bg-primary/10 text-primary font-medium" : "text-foreground"}`}>
                          {c.name} <span className="text-xs text-muted-foreground ml-1">€{c.price}</span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <input type="number" value={coatingCost} onChange={(e) => setCoatingCost(Number(e.target.value))} className="input-industrial w-full text-sm mt-1" placeholder="€" />
              </div>
              <div><label className="label-industrial block mb-2 flex items-center gap-1"><Flame className="w-3 h-3" /> {t("costCalc", "heatTreatment")}</label><input type="number" value={heatTreatmentCost} onChange={(e) => setHeatTreatmentCost(Number(e.target.value))} className="input-industrial w-full" /></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
            <div><label className="label-industrial block mb-2 flex items-center gap-1"><Percent className="w-3 h-3" /> {t("costCalc", "scrapRate")}</label><input type="number" value={scrapRate} onChange={(e) => setScrapRate(Number(e.target.value))} className="input-industrial w-full" /></div>
            <div><label className="label-industrial block mb-2 flex items-center gap-1"><Percent className="w-3 h-3" /> {t("costCalc", "profitMargin")}</label><input type="number" value={profitMargin} onChange={(e) => setProfitMargin(Number(e.target.value))} className="input-industrial w-full" /></div>
          </div>
        </div>

        {/* Column 3 */}
        <div className="space-y-4">
          <h3 className="label-industrial flex items-center gap-2"><DollarSign className="w-4 h-4" /> {t("costCalc", "costSummary")}</h3>
          <div className="p-4 rounded-lg metal-surface border border-border">
            <div className="text-center mb-4">
              <span className="label-industrial">{t("costCalc", "costPerPart")}</span>
              <div className="font-mono text-4xl font-bold text-primary mt-2">€{calculations.costPerPart}</div>
            </div>
          </div>
          <div className="space-y-2">
            <ResultRow label={`${t("costCalc", "totalMachining")} ${t("common", "time")}`} value={`${calculations.totalMachiningMinutes} dk`} />
            <ResultRow label={`${t("costCalc", "materialCost")} (${calculations.weightKg} kg × €${materialPricePerKg} × 1)`} value={`€${calculations.totalMaterialCost}`} />
            <ResultRow label={`${t("costCalc", "setupRate") || "Setup Maliyeti"} (${setupTime} dk × €${laborRate} ÷ ${orderQuantity} adet)`} value={`€${calculations.setupCostPerPart}/parça`} />
            <ResultRow label={t("costCalc", "machineCostLabel")} value={`€${calculations.machineCost}`} />
            <ResultRow label={t("costCalc", "totalAdditional")} value={`€${calculations.additionalCosts}`} />
            <ResultRow label={`${t("costCalc", "scrapCost")} (%${scrapRate})`} value={`€${calculations.scrapCost}`} />
            <ResultRow label={`${t("costCalc", "profit")} (%${profitMargin})`} value={`€${calculations.profit}`} highlight />
          </div>
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
            <div className="flex justify-between items-center">
              <span className="font-medium text-foreground">{t("costCalc", "grandTotal")}</span>
              <span className="font-mono text-2xl font-bold text-primary">€{calculations.grandTotal}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">{orderQuantity} {t("common", "piece")} × €{calculations.costPerPart}</div>
          </div>
          {referenceNo && (
            <div className="p-3 rounded-lg bg-secondary/30 border border-border text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t("costCalc", "referenceNo")}:</span><span className="font-mono text-foreground">{referenceNo}</span></div>
              {customer && (<div className="flex justify-between mt-1"><span className="text-muted-foreground">{t("costCalc", "customer")}:</span><span className="text-foreground">{customer}</span></div>)}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={async () => {
               const materialName = getMaterialName(selectedMaterial);
              const getMLbl = (id: string) => getMachineLabel(id);
              await exportCostPdf({ referenceNo, customer, material: materialName, density: currentMaterial?.density ?? 7.85, weightKg: calculations.weightKg, materialPricePerKg, laborRate, machines: [
                { label: t("costCalc", "turning"), name: getMLbl(selectedTurning), rate: turningRate },
                { label: t("costCalc", "milling"), name: getMLbl(selectedMilling), rate: millingRate },
                { label: t("costCalc", "fiveAxis"), name: getMLbl(selected5Axis), rate: fiveAxisRate },
              ], setupTime, machiningTime: turningTime + millingTime + fiveAxisTime, orderQuantity, toolCost, shippingCost: Number(calculations.shippingCost), coatingCost, heatTreatmentCost, scrapRate, profitMargin, calculations }, t);
            }} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors">
              <FileDown className="w-4 h-4" />{t("costCalc", "downloadPdf")}
            </button>
            {user && (
              <button onClick={async () => {
                const materialName = getMaterialName(selectedMaterial);
                await saveCalculation({
                  type: "cost",
                  material: materialName,
                  tool: customer || "-",
                  parameters: {
                    referenceNo: referenceNo || "-",
                    customer: customer || "-",
                    laborRate,
                    setupTime,
                    machiningTime: turningTime + millingTime + fiveAxisTime,
                    orderQuantity,
                    materialPricePerKg,
                    scrapRate,
                    profitMargin,
                    toolCost,
                    shippingRate,
                    coatingCost,
                    heatTreatmentCost,
                  },
                  results: {
                    weightKg: calculations.weightKg,
                    costPerPart: `€${calculations.costPerPart}`,
                    grandTotal: `€${calculations.grandTotal}`,
                    setupCost: `€${calculations.setupCost}`,
                    machineCost: `€${calculations.machineCost}`,
                    materialCost: `€${calculations.totalMaterialCost}`,
                    profit: `€${calculations.profit}`,
                  },
                });
                toast({ title: t("history", "saved"), description: t("history", "savedDesc") });
              }} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent/20 text-accent-foreground font-medium text-sm hover:bg-accent/30 transition-colors border border-accent/30">
                <Save className="w-4 h-4" />{t("history", "save")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ResultRow = ({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) => (
  <div className={`flex justify-between items-center p-2 rounded ${highlight ? 'bg-success/10' : 'bg-secondary/20'}`}>
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className={`font-mono text-sm font-medium ${highlight ? 'text-success' : 'text-foreground'}`}>{value}</span>
  </div>
);

export default CostCalculation;
