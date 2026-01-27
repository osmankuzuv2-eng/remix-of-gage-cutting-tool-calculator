import { useState, useMemo } from "react";
import { DollarSign, TrendingUp, BarChart3, Calculator, Info } from "lucide-react";
import { materials, toolTypes } from "@/data/materials";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import InfoPanelContent from "./InfoPanelContent";

type InfoPanel = 'costPerPart' | 'toolCost' | 'economicSpeed' | 'savings' | null;

const CostAnalyzer = () => {
  const [activeInfoPanel, setActiveInfoPanel] = useState<InfoPanel>(null);
  const [selectedMaterial, setSelectedMaterial] = useState(materials[0].id);
  const [selectedTool, setSelectedTool] = useState(toolTypes[1].id);
  const [toolPrice, setToolPrice] = useState(150);
  const [machineHourlyRate, setMachineHourlyRate] = useState(250);
  const [laborHourlyRate, setLaborHourlyRate] = useState(100);
  const [cuttingSpeed, setCuttingSpeed] = useState(150);
  const [partsPerDay, setPartsPerDay] = useState(100);
  const [workDays, setWorkDays] = useState(22);

  const material = materials.find((m) => m.id === selectedMaterial)!;
  const tool = toolTypes.find((t) => t.id === selectedTool)!;

  const calculations = useMemo(() => {
    // Taylor denklemi ile takım ömrü
    const C = material.taylorC * tool.multiplier;
    const n = material.taylorN;
    const toolLifeMinutes = Math.pow(C / cuttingSpeed, 1 / n);
    const toolLifeHours = toolLifeMinutes / 60;

    // Parça başına süre (dakika)
    const timePerPart = 5; // Basitleştirilmiş ortalama
    const partsPerTool = Math.floor(toolLifeMinutes / timePerPart);

    // Günlük takım tüketimi
    const toolsPerDay = Math.ceil(partsPerDay / partsPerTool);
    const toolsPerMonth = toolsPerDay * workDays;

    // Maliyet hesaplamaları
    const toolCostPerMonth = toolsPerMonth * toolPrice;
    const toolCostPerPart = toolPrice / partsPerTool;

    // Makine ve işçilik maliyeti
    const hoursPerDay = (partsPerDay * timePerPart) / 60;
    const machineCostPerDay = hoursPerDay * machineHourlyRate;
    const laborCostPerDay = hoursPerDay * laborHourlyRate;
    const totalCostPerDay = machineCostPerDay + laborCostPerDay + (toolsPerDay * toolPrice);

    const costPerPart = totalCostPerDay / partsPerDay;
    const totalMonthly = totalCostPerDay * workDays;

    // Optimum hız hesabı
    const economicSpeed = C * Math.pow(n / (1 - n), n);
    const optimalToolLife = Math.pow(C / economicSpeed, 1 / n);
    const optimalPartsPerTool = Math.floor(optimalToolLife / timePerPart);
    const optimalToolsPerMonth = Math.ceil((partsPerDay * workDays) / optimalPartsPerTool);
    const optimalToolCost = optimalToolsPerMonth * toolPrice;
    const savings = toolCostPerMonth - optimalToolCost;

    return {
      toolLifeMinutes: toolLifeMinutes.toFixed(1),
      toolLifeHours: toolLifeHours.toFixed(2),
      partsPerTool,
      toolsPerDay,
      toolsPerMonth,
      toolCostPerMonth: toolCostPerMonth.toFixed(0),
      toolCostPerPart: toolCostPerPart.toFixed(2),
      machineCostPerDay: machineCostPerDay.toFixed(0),
      laborCostPerDay: laborCostPerDay.toFixed(0),
      totalCostPerDay: totalCostPerDay.toFixed(0),
      costPerPart: costPerPart.toFixed(2),
      totalMonthly: totalMonthly.toFixed(0),
      economicSpeed: economicSpeed.toFixed(0),
      savings: savings.toFixed(0),
      savingsPercent: ((savings / toolCostPerMonth) * 100).toFixed(1),
    };
  }, [selectedMaterial, selectedTool, toolPrice, machineHourlyRate, laborHourlyRate, cuttingSpeed, partsPerDay, workDays]);

  return (
    <div className="industrial-card p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-emerald-500/20">
          <DollarSign className="w-5 h-5 text-emerald-400" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Maliyet Analizi</h2>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Inputs */}
        <div className="space-y-4">
          <h3 className="label-industrial flex items-center gap-2">
            <Calculator className="w-4 h-4" /> Girdi Parametreleri
          </h3>

          <div>
            <label className="label-industrial block mb-2">Malzeme</label>
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
            <label className="label-industrial block mb-2">Takım Tipi</label>
            <select
              value={selectedTool}
              onChange={(e) => setSelectedTool(e.target.value)}
              className="input-industrial w-full"
            >
              {toolTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-industrial block mb-2">Takım Fiyatı (₺)</label>
              <input
                type="number"
                value={toolPrice}
                onChange={(e) => setToolPrice(Number(e.target.value))}
                className="input-industrial w-full"
              />
            </div>
            <div>
              <label className="label-industrial block mb-2">Kesme Hızı</label>
              <input
                type="number"
                value={cuttingSpeed}
                onChange={(e) => setCuttingSpeed(Number(e.target.value))}
                className="input-industrial w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-industrial block mb-2">Makine (₺/saat)</label>
              <input
                type="number"
                value={machineHourlyRate}
                onChange={(e) => setMachineHourlyRate(Number(e.target.value))}
                className="input-industrial w-full"
              />
            </div>
            <div>
              <label className="label-industrial block mb-2">İşçilik (₺/saat)</label>
              <input
                type="number"
                value={laborHourlyRate}
                onChange={(e) => setLaborHourlyRate(Number(e.target.value))}
                className="input-industrial w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-industrial block mb-2">Günlük Üretim</label>
              <input
                type="number"
                value={partsPerDay}
                onChange={(e) => setPartsPerDay(Number(e.target.value))}
                className="input-industrial w-full"
              />
            </div>
            <div>
              <label className="label-industrial block mb-2">Aylık İş Günü</label>
              <input
                type="number"
                value={workDays}
                onChange={(e) => setWorkDays(Number(e.target.value))}
                className="input-industrial w-full"
              />
            </div>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="space-y-4">
          <h3 className="label-industrial flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Maliyet Dağılımı
          </h3>

          <div 
            className={`p-4 rounded-lg metal-surface border cursor-pointer transition-all ${activeInfoPanel === 'costPerPart' ? 'border-accent/50 bg-accent/5' : 'border-border hover:border-accent/30'}`}
            onClick={() => setActiveInfoPanel(activeInfoPanel === 'costPerPart' ? null : 'costPerPart')}
          >
            <div className="text-center mb-4">
              <div className="flex items-center justify-center gap-2">
                <span className="label-industrial">Parça Başı Maliyet</span>
                <Info className={`w-4 h-4 ${activeInfoPanel === 'costPerPart' ? 'text-accent' : 'text-muted-foreground'}`} />
              </div>
              <div className="font-mono text-4xl font-bold text-primary mt-2">
                ₺{calculations.costPerPart}
              </div>
            </div>

            <div className="space-y-3">
              <CostBar label="Takım Maliyeti" value={Number(calculations.toolCostPerPart)} max={Number(calculations.costPerPart)} color="bg-orange-500" />
              <CostBar label="Makine" value={Number(calculations.machineCostPerDay) / partsPerDay} max={Number(calculations.costPerPart)} color="bg-blue-500" />
              <CostBar label="İşçilik" value={Number(calculations.laborCostPerDay) / partsPerDay} max={Number(calculations.costPerPart)} color="bg-green-500" />
            </div>
          </div>

          <Collapsible open={activeInfoPanel === 'costPerPart'}>
            <CollapsibleContent>
              <InfoPanelContent
                title="Parça Başı Maliyet Nedir?"
                description="Bir parçayı üretmek için gereken toplam maliyettir. Takım, makine ve işçilik maliyetlerinin toplamından oluşur."
                formula="Parça Maliyeti = (Takım + Makine + İşçilik) ÷ Günlük Üretim"
                metrics={[
                  { label: "Takım Maliyeti", value: `₺${calculations.toolCostPerPart}/parça` },
                  { label: "Makine Maliyeti", value: `₺${(Number(calculations.machineCostPerDay) / partsPerDay).toFixed(2)}/parça` },
                  { label: "İşçilik Maliyeti", value: `₺${(Number(calculations.laborCostPerDay) / partsPerDay).toFixed(2)}/parça` },
                  { label: "Günlük Toplam", value: `₺${calculations.totalCostPerDay}` }
                ]}
                useCases={["Fiyatlandırma", "Kârlılık analizi", "Maliyet optimizasyonu", "Teklif hazırlama"]}
              />
            </CollapsibleContent>
          </Collapsible>

          <div className="grid grid-cols-2 gap-3">
            <StatBox 
              label="Günlük Maliyet" 
              value={`₺${calculations.totalCostPerDay}`}
              hasInfo
              isActive={activeInfoPanel === 'toolCost'}
              onInfoClick={() => setActiveInfoPanel(activeInfoPanel === 'toolCost' ? null : 'toolCost')}
            />
            <StatBox label="Aylık Maliyet" value={`₺${calculations.totalMonthly}`} highlight />
            <StatBox label="Günlük Takım" value={calculations.toolsPerDay.toString()} />
            <StatBox label="Aylık Takım" value={calculations.toolsPerMonth.toString()} />
          </div>

          <Collapsible open={activeInfoPanel === 'toolCost'}>
            <CollapsibleContent>
              <InfoPanelContent
                title="Günlük Maliyet Analizi"
                description="Bir günlük üretim için gereken toplam maliyet. Makine, işçilik ve takım maliyetlerini içerir."
                formula="Günlük Maliyet = (Saat × Makine) + (Saat × İşçilik) + (Takım × Fiyat)"
                metrics={[
                  { label: "Çalışma Saati", value: `${((partsPerDay * 5) / 60).toFixed(1)} saat` },
                  { label: "Makine Maliyeti", value: `₺${calculations.machineCostPerDay}` },
                  { label: "İşçilik Maliyeti", value: `₺${calculations.laborCostPerDay}` },
                  { label: "Takım Maliyeti", value: `₺${(calculations.toolsPerDay * toolPrice)}` }
                ]}
                useCases={["Günlük bütçe planlaması", "Kapasite kullanımı", "Vardiya planlaması"]}
              />
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Optimization */}
        <div className="space-y-4">
          <h3 className="label-industrial flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Optimizasyon Önerileri
          </h3>

          <div 
            className={`p-4 rounded-lg border cursor-pointer transition-all ${
              activeInfoPanel === 'economicSpeed' 
                ? 'bg-success/15 border-success/50' 
                : 'bg-success/10 border-success/30 hover:bg-success/15'
            }`}
            onClick={() => setActiveInfoPanel(activeInfoPanel === 'economicSpeed' ? null : 'economicSpeed')}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💡</span>
                <span className="font-medium text-foreground">Ekonomik Kesme Hızı</span>
              </div>
              <Info className={`w-4 h-4 ${activeInfoPanel === 'economicSpeed' ? 'text-success' : 'text-muted-foreground'}`} />
            </div>
            <div className="font-mono text-3xl text-success mb-2">
              {calculations.economicSpeed} m/dk
            </div>
            <p className="text-sm text-muted-foreground">
              Bu hızda çalışarak takım maliyetlerini optimize edebilirsiniz.
            </p>
          </div>

          <Collapsible open={activeInfoPanel === 'economicSpeed'}>
            <CollapsibleContent>
              <InfoPanelContent
                title="Ekonomik Kesme Hızı Nedir?"
                description="Takım maliyetleri ve işleme süresi arasında optimal dengeyi sağlayan kesme hızıdır."
                formula="V_ek = C × (n / (1-n))^n"
                metrics={[
                  { label: "Mevcut Hız", value: `${cuttingSpeed} m/dk` },
                  { label: "Ekonomik Hız", value: `${calculations.economicSpeed} m/dk` },
                  { label: "Fark", value: `${Math.abs(cuttingSpeed - Number(calculations.economicSpeed))} m/dk` },
                  { label: "Takım Ömrü", value: `${calculations.toolLifeMinutes} dk` }
                ]}
                useCases={["Maliyet optimizasyonu", "Verimlilik artışı", "Takım ömrü uzatma"]}
                tip={cuttingSpeed > Number(calculations.economicSpeed)
                  ? `Hızı düşürerek takım ömrünü artırın ve maliyetleri azaltın.`
                  : `Mevcut hız ekonomik seviyeye yakın.`}
              />
            </CollapsibleContent>
          </Collapsible>

          {Number(calculations.savings) > 0 && (
            <>
              <div 
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  activeInfoPanel === 'savings'
                    ? 'bg-primary/15 border-primary/50'
                    : 'bg-primary/10 border-primary/30 hover:bg-primary/15'
                }`}
                onClick={() => setActiveInfoPanel(activeInfoPanel === 'savings' ? null : 'savings')}
              >
                <div className="flex items-center justify-between">
                  <span className="label-industrial">Potansiyel Tasarruf</span>
                  <Info className={`w-4 h-4 ${activeInfoPanel === 'savings' ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="font-mono text-3xl font-bold text-primary">
                    ₺{calculations.savings}
                  </span>
                  <span className="text-sm text-muted-foreground">/ay</span>
                </div>
                <div className="text-sm text-success mt-1">
                  %{calculations.savingsPercent} takım maliyeti azalması
                </div>
              </div>

              <Collapsible open={activeInfoPanel === 'savings'}>
                <CollapsibleContent>
                  <InfoPanelContent
                    title="Tasarruf Potansiyeli Nedir?"
                    description="Ekonomik kesme hızına geçildiğinde elde edilecek aylık takım maliyeti tasarrufudur."
                    formula="Tasarruf = Mevcut Takım Maliyeti - Optimal Takım Maliyeti"
                    metrics={[
                      { label: "Mevcut Aylık Takım", value: `₺${calculations.toolCostPerMonth}` },
                      { label: "Optimal Maliyet", value: `₺${(Number(calculations.toolCostPerMonth) - Number(calculations.savings)).toFixed(0)}` },
                      { label: "Tasarruf", value: `₺${calculations.savings}` },
                      { label: "Tasarruf Oranı", value: `%${calculations.savingsPercent}` }
                    ]}
                    useCases={["Bütçe planlaması", "Yatırım geri dönüşü", "Maliyet raporlama"]}
                    tip="Bu tasarruf sadece kesme hızını optimize ederek elde edilebilir, ek yatırım gerektirmez."
                  />
                </CollapsibleContent>
              </Collapsible>
            </>
          )}

          <div className="p-4 rounded-lg bg-secondary/30 border border-border">
            <h4 className="font-medium text-foreground mb-3">Takım Performansı</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Takım Ömrü:</span>
                <span className="font-mono text-foreground">{calculations.toolLifeMinutes} dk</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Takım Başına Parça:</span>
                <span className="font-mono text-foreground">{calculations.partsPerTool} adet</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aylık Takım Maliyeti:</span>
                <span className="font-mono text-warning">₺{calculations.toolCostPerMonth}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CostBar = ({ label, value, max, color }: { label: string; value: number; max: number; color: string }) => {
  const percent = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">₺{value.toFixed(2)}</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

const StatBox = ({ label, value, highlight = false, hasInfo = false, isActive = false, onInfoClick }: { 
  label: string; 
  value: string; 
  highlight?: boolean;
  hasInfo?: boolean;
  isActive?: boolean;
  onInfoClick?: () => void;
}) => (
  <div 
    className={`p-3 rounded-lg transition-all ${
      isActive
        ? 'bg-accent/15 border-2 border-accent/50'
        : highlight 
          ? 'bg-primary/10 border border-primary/30' 
          : 'bg-card border border-border'
    } ${hasInfo ? 'cursor-pointer hover:border-accent/30' : ''}`}
    onClick={hasInfo ? onInfoClick : undefined}
  >
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      {hasInfo && <Info className={`w-3 h-3 ${isActive ? 'text-accent' : 'text-muted-foreground'}`} />}
    </div>
    <div className={`font-mono text-lg font-bold ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</div>
  </div>
);

export default CostAnalyzer;
