import { useState, useMemo } from "react";
import { Clock, TrendingDown, AlertTriangle, CheckCircle, Save, Info } from "lucide-react";
import { materials as defaultMaterials, toolTypes, Material } from "@/data/materials";
import { saveCalculation } from "./CalculationHistory";
import { toast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import InfoPanelContent from "./InfoPanelContent";

interface ToolLifeCalculatorProps {
  customMaterials: Material[];
}

type InfoPanel = 'partsPerTool' | 'efficiency' | 'economicSpeed' | 'dailyTools' | 'monthlyTools' | null;

const ToolLifeCalculator = ({ customMaterials }: ToolLifeCalculatorProps) => {
  const [activeInfoPanel, setActiveInfoPanel] = useState<InfoPanel>(null);
  const allMaterials = [...defaultMaterials, ...customMaterials];
  
  const [selectedMaterial, setSelectedMaterial] = useState(allMaterials[0].id);
  const [selectedTool, setSelectedTool] = useState(toolTypes[1].id);
  const [cuttingSpeed, setCuttingSpeed] = useState<number>(150);
  const [workpieceLength, setWorkpieceLength] = useState<number>(100);
  const [partsPerDay, setPartsPerDay] = useState<number>(50);

  const material = allMaterials.find((m) => m.id === selectedMaterial) || allMaterials[0];
  const tool = toolTypes.find((t) => t.id === selectedTool)!;

  const calculations = useMemo(() => {
    const C = material.taylorC * tool.multiplier;
    const n = material.taylorN;
    
    const toolLifeMinutes = Math.pow(C / cuttingSpeed, 1 / n);
    const toolLifeHours = toolLifeMinutes / 60;
    
    const timePerPart = (workpieceLength / 1000) / (cuttingSpeed / 60) * 5;
    const partsPerTool = Math.floor(toolLifeMinutes / timePerPart);
    const toolsPerDay = Math.ceil(partsPerDay / partsPerTool);
    const toolsPerMonth = toolsPerDay * 22;
    const economicSpeed = C * Math.pow(n / (1 - n), n);

    return {
      toolLifeMinutes: toolLifeMinutes.toFixed(1),
      toolLifeHours: toolLifeHours.toFixed(2),
      partsPerTool,
      toolsPerDay,
      toolsPerMonth,
      economicSpeed: economicSpeed.toFixed(0),
      efficiency: ((toolLifeMinutes / 120) * 100).toFixed(0),
    };
  }, [selectedMaterial, selectedTool, cuttingSpeed, workpieceLength, partsPerDay, material, tool]);

  const saveToHistory = () => {
    saveCalculation({
      type: "toollife",
      material: material.name,
      tool: tool.name,
      parameters: {
        cuttingSpeed: `${cuttingSpeed} m/dk`,
        workpieceLength: `${workpieceLength} mm`,
        partsPerDay: partsPerDay,
      },
      results: {
        toolLife: `${calculations.toolLifeMinutes} dk`,
        partsPerTool: calculations.partsPerTool,
        toolsPerDay: calculations.toolsPerDay,
        toolsPerMonth: calculations.toolsPerMonth,
        efficiency: `${calculations.efficiency}%`,
        economicSpeed: `${calculations.economicSpeed} m/dk`,
      },
    });
    toast({
      title: "Kaydedildi",
      description: "Hesaplama geçmişe eklendi.",
    });
  };

  const getEfficiencyColor = (eff: number) => {
    if (eff >= 80) return "text-success";
    if (eff >= 50) return "text-warning";
    return "text-destructive";
  };

  const getEfficiencyIcon = (eff: number) => {
    if (eff >= 80) return <CheckCircle className="w-5 h-5 text-success" />;
    if (eff >= 50) return <AlertTriangle className="w-5 h-5 text-warning" />;
    return <TrendingDown className="w-5 h-5 text-destructive" />;
  };

  return (
    <div className="industrial-card p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/20">
            <Clock className="w-5 h-5 text-warning" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Takım Ömrü Hesaplama (Taylor Denklemi)
          </h2>
        </div>
        <button
          onClick={saveToHistory}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:brightness-110 transition-all text-sm"
        >
          <Save className="w-4 h-4" />
          Kaydet
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-4">
          <div>
            <label className="label-industrial block mb-2">Malzeme</label>
            <select
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
              className="input-industrial w-full"
            >
              <optgroup label="Standart Malzemeler">
                {defaultMaterials.map((mat) => (
                  <option key={mat.id} value={mat.id}>{mat.name}</option>
                ))}
              </optgroup>
              {customMaterials.length > 0 && (
                <optgroup label="Özel Malzemeler">
                  {customMaterials.map((mat) => (
                    <option key={mat.id} value={mat.id}>{mat.name}</option>
                  ))}
                </optgroup>
              )}
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

          <div>
            <label className="label-industrial block mb-2">Kesme Hızı (m/dk)</label>
            <input
              type="number"
              value={cuttingSpeed}
              onChange={(e) => setCuttingSpeed(Number(e.target.value))}
              className="input-industrial w-full"
              min="10"
              max="1000"
            />
            <div className="mt-2">
              <input
                type="range"
                value={cuttingSpeed}
                onChange={(e) => setCuttingSpeed(Number(e.target.value))}
                min="10"
                max="500"
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>10</span>
                <span className="text-accent">Önerilen: {calculations.economicSpeed}</span>
                <span>500</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-industrial block mb-2">Parça Uzunluğu (mm)</label>
              <input
                type="number"
                value={workpieceLength}
                onChange={(e) => setWorkpieceLength(Number(e.target.value))}
                className="input-industrial w-full"
                min="1"
              />
            </div>
            <div>
              <label className="label-industrial block mb-2">Günlük Üretim</label>
              <input
                type="number"
                value={partsPerDay}
                onChange={(e) => setPartsPerDay(Number(e.target.value))}
                className="input-industrial w-full"
                min="1"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <span className="label-industrial text-xs">Taylor Denklemi</span>
            <div className="font-mono text-lg text-accent mt-1">
              V × T<sup>n</sup> = C
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              n = {material.taylorN} | C = {(material.taylorC * tool.multiplier).toFixed(0)}
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          <div className="p-6 rounded-lg metal-surface border border-border text-center">
            <span className="label-industrial">Tahmini Takım Ömrü</span>
            <div className="mt-2 flex items-center justify-center gap-2">
              {getEfficiencyIcon(Number(calculations.efficiency))}
              <span className={`font-mono text-4xl font-bold ${getEfficiencyColor(Number(calculations.efficiency))}`}>
                {calculations.toolLifeMinutes}
              </span>
              <span className="text-lg text-muted-foreground">dakika</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              ({calculations.toolLifeHours} saat)
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard 
              label="Takım Başına Parça" 
              value={calculations.partsPerTool.toString()} 
              icon="📦" 
              hasInfo 
              isInfoActive={activeInfoPanel === 'partsPerTool'}
              onInfoClick={() => setActiveInfoPanel(activeInfoPanel === 'partsPerTool' ? null : 'partsPerTool')} 
            />
            <StatCard 
              label="Günlük Takım" 
              value={calculations.toolsPerDay.toString()} 
              icon="📅" 
              hasInfo
              isInfoActive={activeInfoPanel === 'dailyTools'}
              onInfoClick={() => setActiveInfoPanel(activeInfoPanel === 'dailyTools' ? null : 'dailyTools')}
            />
            <StatCard 
              label="Aylık Takım" 
              value={calculations.toolsPerMonth.toString()} 
              icon="📊" 
              hasInfo
              isInfoActive={activeInfoPanel === 'monthlyTools'}
              onInfoClick={() => setActiveInfoPanel(activeInfoPanel === 'monthlyTools' ? null : 'monthlyTools')}
            />
            <StatCard 
              label="Verimlilik" 
              value={`${calculations.efficiency}%`} 
              icon="⚡" 
              highlight={Number(calculations.efficiency) >= 80}
              hasInfo
              isInfoActive={activeInfoPanel === 'efficiency'}
              onInfoClick={() => setActiveInfoPanel(activeInfoPanel === 'efficiency' ? null : 'efficiency')}
            />
          </div>

          {/* Bilgi Panelleri */}
          <div className="space-y-3">
            {/* Takım Başına Parça */}
            <Collapsible open={activeInfoPanel === 'partsPerTool'}>
              <CollapsibleContent>
                <InfoPanelContent
                  title="Takım Başına Parça Nedir?"
                  description="Bir kesici takımın aşınmadan veya değiştirilmeden önce üretebileceği ortalama parça sayısıdır."
                  formula="Takım Başına Parça = Takım Ömrü (dk) ÷ Parça Başına Süre (dk)"
                  metrics={[
                    { label: "Takım Ömrü", value: `${calculations.toolLifeMinutes} dk` },
                    { label: "Parça Başına Süre", value: `${(Number(calculations.toolLifeMinutes) / calculations.partsPerTool).toFixed(2)} dk` }
                  ]}
                  useCases={["Takım maliyeti hesaplama", "Takım değişim planlaması", "Üretim verimliliği optimizasyonu", "Stok yönetimi"]}
                />
              </CollapsibleContent>
            </Collapsible>

            {/* Günlük Takım */}
            <Collapsible open={activeInfoPanel === 'dailyTools'}>
              <CollapsibleContent>
                <InfoPanelContent
                  title="Günlük Takım Tüketimi Nedir?"
                  description="Günlük üretim hedefini karşılamak için gereken takım sayısıdır."
                  formula="Günlük Takım = ⌈Günlük Üretim ÷ Takım Başına Parça⌉"
                  metrics={[
                    { label: "Günlük Üretim", value: `${partsPerDay} adet` },
                    { label: "Takım Başına Parça", value: `${calculations.partsPerTool} adet` }
                  ]}
                  useCases={["Günlük takım stok planlaması", "Vardiya planlaması", "Takım değişim süreleri tahmini"]}
                />
              </CollapsibleContent>
            </Collapsible>

            {/* Aylık Takım */}
            <Collapsible open={activeInfoPanel === 'monthlyTools'}>
              <CollapsibleContent>
                <InfoPanelContent
                  title="Aylık Takım Tüketimi Nedir?"
                  description="Bir ay boyunca (22 iş günü) toplam takım ihtiyacıdır."
                  formula="Aylık Takım = Günlük Takım × 22 iş günü"
                  metrics={[
                    { label: "Günlük Takım", value: `${calculations.toolsPerDay} adet` },
                    { label: "Aylık İş Günü", value: "22 gün" }
                  ]}
                  useCases={["Aylık bütçe planlaması", "Tedarik siparişleri", "Maliyet tahminleri", "Stok yönetimi"]}
                />
              </CollapsibleContent>
            </Collapsible>

            {/* Verimlilik */}
            <Collapsible open={activeInfoPanel === 'efficiency'}>
              <CollapsibleContent>
                <InfoPanelContent
                  title="Verimlilik Nedir?"
                  description="Takım ömrünün referans değere (120 dk) oranıdır. %80 üzeri optimum, %50-80 arası dikkat gerektirir."
                  formula="Verimlilik = (Takım Ömrü ÷ 120 dk) × 100"
                  metrics={[
                    { label: "Mevcut Takım Ömrü", value: `${calculations.toolLifeMinutes} dk` },
                    { label: "Referans Ömür", value: "120 dk" }
                  ]}
                  useCases={["Parametre optimizasyonu", "Performans takibi", "Maliyet-verimlilik analizi"]}
                  statusInfo={{
                    value: Number(calculations.efficiency),
                    thresholds: [
                      { min: 80, label: "Optimum", color: "text-success" },
                      { min: 50, label: "Dikkat", color: "text-warning" },
                      { min: 0, label: "Kritik", color: "text-destructive" }
                    ]
                  }}
                />
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Ekonomik Kesme Hızı Paneli */}
          <div 
            className="p-4 rounded-lg bg-primary/10 border border-primary/30 cursor-pointer hover:bg-primary/15 transition-colors"
            onClick={() => setActiveInfoPanel(activeInfoPanel === 'economicSpeed' ? null : 'economicSpeed')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">💡</span>
                <span className="label-industrial">Ekonomik Kesme Hızı</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xl font-bold text-primary">{calculations.economicSpeed} m/dk</span>
                <Info className={`w-4 h-4 transition-colors ${activeInfoPanel === 'economicSpeed' ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
            </div>
          </div>

          <Collapsible open={activeInfoPanel === 'economicSpeed'}>
            <CollapsibleContent>
              <InfoPanelContent
                title="Ekonomik Kesme Hızı Nedir?"
                description="Takım maliyetleri ve işleme süresi arasında optimal dengeyi sağlayan kesme hızıdır. Taylor denklemi kullanılarak hesaplanır."
                formula="V_ek = C × (n / (1-n))^n"
                metrics={[
                  { label: "Taylor C Sabiti", value: `${(material.taylorC * tool.multiplier).toFixed(0)}` },
                  { label: "Taylor n Üssü", value: `${material.taylorN}` },
                  { label: "Mevcut Hız", value: `${cuttingSpeed} m/dk` },
                  { label: "Fark", value: `${(Number(calculations.economicSpeed) - cuttingSpeed).toFixed(0)} m/dk` }
                ]}
                useCases={["Maliyet optimizasyonu", "Takım ömrü maksimizasyonu", "Üretim planlaması", "Enerji tasarrufu"]}
                tip={cuttingSpeed > Number(calculations.economicSpeed) 
                  ? `Kesme hızını ${calculations.economicSpeed} m/dk'ya düşürerek takım ömrünü artırabilirsiniz.`
                  : cuttingSpeed < Number(calculations.economicSpeed)
                  ? `Kesme hızını ${calculations.economicSpeed} m/dk'ya çıkararak üretim hızını artırabilirsiniz.`
                  : "Mevcut kesme hızı ekonomik optimum seviyede!"}
              />
            </CollapsibleContent>
          </Collapsible>

          <div className={`p-4 rounded-lg border ${
            Number(calculations.efficiency) >= 80 
              ? "bg-success/5 border-success/20" 
              : Number(calculations.efficiency) >= 50
              ? "bg-warning/5 border-warning/20"
              : "bg-destructive/5 border-destructive/20"
          }`}>
            <p className="text-sm text-muted-foreground">
              {Number(calculations.efficiency) >= 80 ? (
                <><span className="text-success font-medium">✓ Optimum Ayarlar:</span> Mevcut parametreler verimli çalışma için uygundur.</>
              ) : Number(calculations.efficiency) >= 50 ? (
                <><span className="text-warning font-medium">⚠ Dikkat:</span> Kesme hızını {calculations.economicSpeed} m/dk'ya düşürmeyi düşünün.</>
              ) : (
                <><span className="text-destructive font-medium">✗ Uyarı:</span> Takım ömrü çok kısa. Parametreleri optimize edin.</>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon, highlight = false, hasInfo = false, isInfoActive = false, onInfoClick }: { 
  label: string; 
  value: string; 
  icon: string; 
  highlight?: boolean;
  hasInfo?: boolean;
  isInfoActive?: boolean;
  onInfoClick?: () => void;
}) => (
  <div className={`p-4 rounded-lg transition-all ${
    isInfoActive 
      ? "bg-accent/15 border-2 border-accent/50" 
      : highlight 
        ? "bg-success/10 border border-success/30" 
        : "bg-card border border-border"
  }`}>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      {hasInfo && (
        <button 
          onClick={onInfoClick}
          className={`p-1 rounded transition-colors ${isInfoActive ? 'bg-accent/30' : 'hover:bg-accent/20'}`}
          title="Detaylı bilgi"
        >
          <Info className={`w-4 h-4 ${isInfoActive ? 'text-accent' : 'text-muted-foreground'}`} />
        </button>
      )}
    </div>
    <span className={`font-mono text-2xl font-bold ${highlight ? "text-success" : "text-foreground"}`}>{value}</span>
  </div>
);

export default ToolLifeCalculator;
