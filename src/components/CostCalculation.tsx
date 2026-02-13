import { useState, useMemo } from "react";
import { DollarSign, Calculator, Percent, Package, Truck, Flame, Shield, Wrench, FileDown } from "lucide-react";
import { machinePark } from "@/data/machinePark";
import { materials } from "@/data/materials";
import { exportCostPdf } from "@/lib/exportCostPdf";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const customers = [
  "ASELSAN", "ROKETSAN", "TAI (TUSAŞ)", "TEI", "HAVELSAN",
  "BMC", "OTOKAR", "FNSS", "MKE", "BAYKAR",
  "Diğer",
];

const CostCalculation = () => {
  const [referenceNo, setReferenceNo] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState(materials[0].id);
  const [customer, setCustomer] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [laborRate, setLaborRate] = useState(100);

  // Machines - separate selections with per-minute rates
  const [selectedTurning, setSelectedTurning] = useState(machinePark.find(m => m.type === "turning")?.id ?? "");
  const [turningRate, setTurningRate] = useState(0);
  const [selectedMilling, setSelectedMilling] = useState(machinePark.find(m => m.type === "milling-4axis")?.id ?? "");
  const [millingRate, setMillingRate] = useState(0);
  const [selected5Axis, setSelected5Axis] = useState(machinePark.find(m => m.type === "milling-5axis")?.id ?? "");
  const [fiveAxisRate, setFiveAxisRate] = useState(0);

  // Times & quantity
  const [setupTime, setSetupTime] = useState(30);
  const [machiningTime, setMachiningTime] = useState(15);
  const [orderQuantity, setOrderQuantity] = useState(100);

  // Additional costs
  const [toolCost, setToolCost] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [coatingCost, setCoatingCost] = useState(0);
  const [heatTreatmentCost, setHeatTreatmentCost] = useState(0);

  // Rates
  const [scrapRate, setScrapRate] = useState(3);
  const [profitMargin, setProfitMargin] = useState(20);

  const calculations = useMemo(() => {
    const machineCost = (turningRate + millingRate + fiveAxisRate) * machiningTime * orderQuantity;
    const totalMachiningMinutes = setupTime + machiningTime * orderQuantity;
    const totalMachiningHours = totalMachiningMinutes / 60;
    const laborCost = totalMachiningHours * laborRate;

    const additionalCosts = toolCost + shippingCost + coatingCost + heatTreatmentCost;
    const subtotal = laborCost + machineCost + additionalCosts;

    const scrapCost = subtotal * (scrapRate / 100);
    const totalBeforeProfit = subtotal + scrapCost;
    const profit = totalBeforeProfit * (profitMargin / 100);
    const grandTotal = totalBeforeProfit + profit;

    const costPerPart = orderQuantity > 0 ? grandTotal / orderQuantity : 0;

    return {
      totalMachiningHours: totalMachiningHours.toFixed(1),
      laborCost: laborCost.toFixed(2),
      machineCost: machineCost.toFixed(2),
      additionalCosts: additionalCosts.toFixed(2),
      scrapCost: scrapCost.toFixed(2),
      profit: profit.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      costPerPart: costPerPart.toFixed(2),
    };
  }, [setupTime, machiningTime, orderQuantity, laborRate, turningRate, millingRate, fiveAxisRate, toolCost, shippingCost, coatingCost, heatTreatmentCost, scrapRate, profitMargin]);

  return (
    <div className="industrial-card p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-emerald-500/20">
          <DollarSign className="w-5 h-5 text-emerald-400" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Maliyet Hesaplama</h2>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Column 1: Basic Info */}
        <div className="space-y-4">
          <h3 className="label-industrial flex items-center gap-2">
            <Calculator className="w-4 h-4" /> Temel Bilgiler
          </h3>

          <div>
            <label className="label-industrial block mb-2">Referans No</label>
            <input
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="Örn: REF-2026-001"
              className="input-industrial w-full"
            />
          </div>

          <div>
            <label className="label-industrial block mb-2">Malzeme Tipi</label>
            <select
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
              className="input-industrial w-full"
            >
              {materials.map((mat) => (
                <option key={mat.id} value={mat.id}>{mat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-industrial block mb-2">Müşteri</label>
            <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
              <PopoverTrigger asChild>
                <button className="input-industrial w-full text-left flex items-center justify-between">
                  <span className={customer ? "text-foreground" : "text-muted-foreground"}>
                    {customer || "Müşteri seçin..."}
                  </span>
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-card border border-border z-50" align="start">
                <div className="max-h-60 overflow-y-auto">
                  {customers.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setCustomer(c); setCustomerOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-accent/10 ${
                        customer === c ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="label-industrial block mb-2">İşçilik Ücreti (₺/saat)</label>
            <input
              type="number"
              value={laborRate}
              onChange={(e) => setLaborRate(Number(e.target.value))}
              className="input-industrial w-full"
            />
          </div>

          {/* Machine Selections */}
          <div className="space-y-3">
            <label className="label-industrial block">Tezgah Seçimi & dk Fiyatları</label>
            {([
              { label: "Torna", type: "turning" as const, value: selectedTurning, setValue: setSelectedTurning, rate: turningRate, setRate: setTurningRate },
              { label: "Freze", type: "milling-4axis" as const, value: selectedMilling, setValue: setSelectedMilling, rate: millingRate, setRate: setMillingRate },
              { label: "5 Eksen", type: "milling-5axis" as const, value: selected5Axis, setValue: setSelected5Axis, rate: fiveAxisRate, setRate: setFiveAxisRate },
            ]).map((machine) => (
              <div key={machine.type} className="p-3 rounded-lg bg-secondary/20 border border-border space-y-2">
                <span className="text-xs font-medium text-muted-foreground">{machine.label}</span>
                <select
                  value={machine.value}
                  onChange={(e) => machine.setValue(e.target.value)}
                  className="input-industrial w-full text-sm"
                >
                  {machinePark.filter((m) => m.type === machine.type).map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={machine.rate}
                    onChange={(e) => machine.setRate(Number(e.target.value))}
                    className="input-industrial w-full text-sm"
                    placeholder="0"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">₺/dk</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Times, Quantity, Additional Costs */}
        <div className="space-y-4">
          <h3 className="label-industrial flex items-center gap-2">
            <Package className="w-4 h-4" /> Üretim & Ek Giderler
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-industrial block mb-2">Setup Süresi (dk)</label>
              <input
                type="number"
                value={setupTime}
                onChange={(e) => setSetupTime(Number(e.target.value))}
                className="input-industrial w-full"
              />
            </div>
            <div>
              <label className="label-industrial block mb-2">İşleme Süresi (dk)</label>
              <input
                type="number"
                value={machiningTime}
                onChange={(e) => setMachiningTime(Number(e.target.value))}
                className="input-industrial w-full"
              />
            </div>
          </div>

          <div>
            <label className="label-industrial block mb-2">Sipariş Adeti</label>
            <input
              type="number"
              value={orderQuantity}
              onChange={(e) => setOrderQuantity(Number(e.target.value))}
              className="input-industrial w-full"
            />
          </div>

          <div className="pt-2 border-t border-border">
            <h4 className="label-industrial mb-3 flex items-center gap-2">
              Ek Giderler (₺)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-industrial block mb-2 flex items-center gap-1">
                  <Wrench className="w-3 h-3" /> Takım
                </label>
                <input
                  type="number"
                  value={toolCost}
                  onChange={(e) => setToolCost(Number(e.target.value))}
                  className="input-industrial w-full"
                />
              </div>
              <div>
                <label className="label-industrial block mb-2 flex items-center gap-1">
                  <Truck className="w-3 h-3" /> Nakliye
                </label>
                <input
                  type="number"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(Number(e.target.value))}
                  className="input-industrial w-full"
                />
              </div>
              <div>
                <label className="label-industrial block mb-2 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Kaplama
                </label>
                <input
                  type="number"
                  value={coatingCost}
                  onChange={(e) => setCoatingCost(Number(e.target.value))}
                  className="input-industrial w-full"
                />
              </div>
              <div>
                <label className="label-industrial block mb-2 flex items-center gap-1">
                  <Flame className="w-3 h-3" /> Isıl İşlem
                </label>
                <input
                  type="number"
                  value={heatTreatmentCost}
                  onChange={(e) => setHeatTreatmentCost(Number(e.target.value))}
                  className="input-industrial w-full"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
            <div>
              <label className="label-industrial block mb-2 flex items-center gap-1">
                <Percent className="w-3 h-3" /> Fire Oranı (%)
              </label>
              <input
                type="number"
                value={scrapRate}
                onChange={(e) => setScrapRate(Number(e.target.value))}
                className="input-industrial w-full"
              />
            </div>
            <div>
              <label className="label-industrial block mb-2 flex items-center gap-1">
                <Percent className="w-3 h-3" /> Kâr Oranı (%)
              </label>
              <input
                type="number"
                value={profitMargin}
                onChange={(e) => setProfitMargin(Number(e.target.value))}
                className="input-industrial w-full"
              />
            </div>
          </div>
        </div>

        {/* Column 3: Results */}
        <div className="space-y-4">
          <h3 className="label-industrial flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Maliyet Özeti
          </h3>

          <div className="p-4 rounded-lg metal-surface border border-border">
            <div className="text-center mb-4">
              <span className="label-industrial">Parça Başı Maliyet</span>
              <div className="font-mono text-4xl font-bold text-primary mt-2">
                ₺{calculations.costPerPart}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <ResultRow label="Toplam İşleme Süresi" value={`${calculations.totalMachiningHours} saat`} />
            <ResultRow label="İşçilik Maliyeti" value={`₺${calculations.laborCost}`} />
            <ResultRow label="Tezgah Maliyeti" value={`₺${calculations.machineCost}`} />
            <ResultRow label="Ek Giderler Toplamı" value={`₺${calculations.additionalCosts}`} />
            <ResultRow label={`Fire Maliyeti (%${scrapRate})`} value={`₺${calculations.scrapCost}`} />
            <ResultRow label={`Kâr (%${profitMargin})`} value={`₺${calculations.profit}`} highlight />
          </div>

          <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
            <div className="flex justify-between items-center">
              <span className="font-medium text-foreground">Genel Toplam</span>
              <span className="font-mono text-2xl font-bold text-primary">₺{calculations.grandTotal}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {orderQuantity} adet × ₺{calculations.costPerPart}/parça
            </div>
          </div>

          {referenceNo && (
            <div className="p-3 rounded-lg bg-secondary/30 border border-border text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Referans:</span>
                <span className="font-mono text-foreground">{referenceNo}</span>
              </div>
              {customer && (
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">Müşteri:</span>
                  <span className="text-foreground">{customer}</span>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => {
              const materialName = materials.find(m => m.id === selectedMaterial)?.name ?? selectedMaterial;
              const getMachineName = (id: string) => machinePark.find(m => m.id === id)?.label ?? id;
              exportCostPdf({
                referenceNo,
                customer,
                material: materialName,
                laborRate,
                machines: [
                  { label: "Torna", name: getMachineName(selectedTurning), rate: turningRate },
                  { label: "Freze", name: getMachineName(selectedMilling), rate: millingRate },
                  { label: "5 Eksen", name: getMachineName(selected5Axis), rate: fiveAxisRate },
                ],
                setupTime,
                machiningTime,
                orderQuantity,
                toolCost,
                shippingCost,
                coatingCost,
                heatTreatmentCost,
                scrapRate,
                profitMargin,
                calculations,
              });
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            <FileDown className="w-4 h-4" />
            PDF Olarak İndir
          </button>
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
