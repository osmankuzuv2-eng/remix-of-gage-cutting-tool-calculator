import { useState, useMemo } from "react";
import { Clock, TrendingDown, AlertTriangle, CheckCircle, Save, Info } from "lucide-react";
import { materials as defaultMaterials, toolTypes, Material } from "@/data/materials";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import InfoPanelContent from "./InfoPanelContent";
import { useLanguage } from "@/i18n/LanguageContext";

interface ToolLifeCalculatorProps {
  customMaterials: Material[];
}

type InfoPanel = 'partsPerTool' | 'efficiency' | 'economicSpeed' | 'dailyTools' | 'monthlyTools' | null;

const ToolLifeCalculator = ({ customMaterials }: ToolLifeCalculatorProps) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { saveCalculation } = useSupabaseSync();
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

  const saveToHistory = async () => {
    await saveCalculation({
      type: "toollife",
      material: material.name,
      tool: tool.name,
      parameters: {
        cuttingSpeed: `${cuttingSpeed} m/${t("common", "minute")}`,
        workpieceLength: `${workpieceLength} mm`,
        partsPerDay: partsPerDay,
      },
      results: {
        toolLife: `${calculations.toolLifeMinutes} ${t("common", "minute")}`,
        partsPerTool: calculations.partsPerTool,
        toolsPerDay: calculations.toolsPerDay,
        toolsPerMonth: calculations.toolsPerMonth,
        efficiency: `${calculations.efficiency}%`,
        economicSpeed: `${calculations.economicSpeed} m/${t("common", "minute")}`,
      },
    });
    toast({
      title: t("history", "saved"),
      description: t("history", "savedDesc"),
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
            {t("toolLife", "title")}
          </h2>
        </div>
        <button
          onClick={saveToHistory}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:brightness-110 transition-all text-sm"
        >
          <Save className="w-4 h-4" />
          {t("common", "save")}
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-4">
          <div>
            <label className="label-industrial block mb-2">{t("common", "material")}</label>
            <select
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
              className="input-industrial w-full"
            >
              <optgroup label={t("cutting", "standardMaterials")}>
                {defaultMaterials.map((mat) => (
                  <option key={mat.id} value={mat.id}>{mat.name}</option>
                ))}
              </optgroup>
              {customMaterials.length > 0 && (
                <optgroup label={t("cutting", "customMaterials")}>
                  {customMaterials.map((mat) => (
                    <option key={mat.id} value={mat.id}>{mat.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div>
            <label className="label-industrial block mb-2">{t("common", "toolType")}</label>
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
            <label className="label-industrial block mb-2">{t("common", "cuttingSpeed")} (m/{t("common", "minute")})</label>
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
                <span className="text-accent">{t("toolLife", "recommended")}: {calculations.economicSpeed}</span>
                <span>500</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-industrial block mb-2">{t("toolLife", "workpieceLength")}</label>
              <input
                type="number"
                value={workpieceLength}
                onChange={(e) => setWorkpieceLength(Number(e.target.value))}
                className="input-industrial w-full"
                min="1"
              />
            </div>
            <div>
              <label className="label-industrial block mb-2">{t("toolLife", "dailyProduction")}</label>
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
            <span className="label-industrial text-xs">{t("toolLife", "taylorEquation")}</span>
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
            <span className="label-industrial">{t("toolLife", "estimatedToolLife")}</span>
            <div className="mt-2 flex items-center justify-center gap-2">
              {getEfficiencyIcon(Number(calculations.efficiency))}
              <span className={`font-mono text-4xl font-bold ${getEfficiencyColor(Number(calculations.efficiency))}`}>
                {calculations.toolLifeMinutes}
              </span>
              <span className="text-lg text-muted-foreground">{t("common", "minute")}</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              ({calculations.toolLifeHours} {t("common", "hour")})
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard 
              label={t("toolLife", "partsPerTool")} 
              value={calculations.partsPerTool.toString()} 
              icon="📦" 
              hasInfo 
              isInfoActive={activeInfoPanel === 'partsPerTool'}
              onInfoClick={() => setActiveInfoPanel(activeInfoPanel === 'partsPerTool' ? null : 'partsPerTool')} 
            />
            <StatCard 
              label={t("toolLife", "dailyTools")} 
              value={calculations.toolsPerDay.toString()} 
              icon="📅" 
              hasInfo
              isInfoActive={activeInfoPanel === 'dailyTools'}
              onInfoClick={() => setActiveInfoPanel(activeInfoPanel === 'dailyTools' ? null : 'dailyTools')}
            />
            <StatCard 
              label={t("toolLife", "monthlyTools")} 
              value={calculations.toolsPerMonth.toString()} 
              icon="📊" 
              hasInfo
              isInfoActive={activeInfoPanel === 'monthlyTools'}
              onInfoClick={() => setActiveInfoPanel(activeInfoPanel === 'monthlyTools' ? null : 'monthlyTools')}
            />
            <StatCard 
              label={t("toolLife", "efficiency")} 
              value={`${calculations.efficiency}%`} 
              icon="⚡" 
              highlight={Number(calculations.efficiency) >= 80}
              hasInfo
              isInfoActive={activeInfoPanel === 'efficiency'}
              onInfoClick={() => setActiveInfoPanel(activeInfoPanel === 'efficiency' ? null : 'efficiency')}
            />
          </div>

          {/* Info Panels */}
          <div className="space-y-3">
            <Collapsible open={activeInfoPanel === 'partsPerTool'}>
              <CollapsibleContent>
                <InfoPanelContent
                  title={t("toolLife", "partsPerTool")}
                  description="Takım Başına Parça"
                  formula="Parts/Tool = Tool Life (min) ÷ Time/Part (min)"
                  metrics={[
                    { label: t("toolLife", "estimatedToolLife"), value: `${calculations.toolLifeMinutes} ${t("common", "minute")}` },
                    { label: "Time/Part", value: `${(Number(calculations.toolLifeMinutes) / calculations.partsPerTool).toFixed(2)} ${t("common", "minute")}` }
                  ]}
                  useCases={["Tool cost calculation", "Tool change planning", "Production efficiency optimization", "Stock management"]}
                />
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={activeInfoPanel === 'dailyTools'}>
              <CollapsibleContent>
                <InfoPanelContent
                  title={t("toolLife", "dailyTools")}
                  description="Daily tool consumption"
                  formula="Daily Tools = ⌈Daily Production ÷ Parts/Tool⌉"
                  metrics={[
                    { label: t("toolLife", "dailyProduction"), value: `${partsPerDay} ${t("common", "piece")}` },
                    { label: t("toolLife", "partsPerTool"), value: `${calculations.partsPerTool} ${t("common", "piece")}` }
                  ]}
                  useCases={["Daily stock planning", "Shift planning", "Tool change time estimation"]}
                />
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={activeInfoPanel === 'monthlyTools'}>
              <CollapsibleContent>
                <InfoPanelContent
                  title={t("toolLife", "monthlyTools")}
                  description="Monthly tool consumption"
                  formula="Monthly Tools = Daily Tools × 22 work days"
                  metrics={[
                    { label: t("toolLife", "dailyTools"), value: `${calculations.toolsPerDay} ${t("common", "piece")}` },
                    { label: "Work Days", value: "22" }
                  ]}
                  useCases={["Monthly budget planning", "Procurement orders", "Cost estimation", "Stock management"]}
                />
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={activeInfoPanel === 'efficiency'}>
              <CollapsibleContent>
                <InfoPanelContent
                  title={t("toolLife", "efficiency")}
                  description="Tool life efficiency relative to 120 min reference"
                  formula="Efficiency = (Tool Life ÷ 120 min) × 100"
                  metrics={[
                    { label: t("toolLife", "estimatedToolLife"), value: `${calculations.toolLifeMinutes} ${t("common", "minute")}` },
                    { label: "Reference", value: `120 ${t("common", "minute")}` }
                  ]}
                  useCases={["Parameter optimization", "Performance tracking", "Cost-efficiency analysis"]}
                  statusInfo={{
                    value: Number(calculations.efficiency),
                    thresholds: [
                      { min: 80, label: "Optimum", color: "text-success" },
                      { min: 50, label: "Warning", color: "text-warning" },
                      { min: 0, label: "Critical", color: "text-destructive" }
                    ]
                  }}
                />
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Economic Speed Panel */}
          <div 
            className="p-4 rounded-lg bg-primary/10 border border-primary/30 cursor-pointer hover:bg-primary/15 transition-colors"
            onClick={() => setActiveInfoPanel(activeInfoPanel === 'economicSpeed' ? null : 'economicSpeed')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">💡</span>
                <span className="label-industrial">{t("toolLife", "economicSpeed")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xl font-bold text-primary">{calculations.economicSpeed} m/{t("common", "minute")}</span>
                <Info className={`w-4 h-4 transition-colors ${activeInfoPanel === 'economicSpeed' ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
            </div>
          </div>

          <Collapsible open={activeInfoPanel === 'economicSpeed'}>
            <CollapsibleContent>
              <InfoPanelContent
                title={t("toolLife", "economicSpeed")}
                description="Optimal balance between tool cost and machining time"
                formula="V_ek = C × (n / (1-n))^n"
                metrics={[
                  { label: "Taylor C", value: `${(material.taylorC * tool.multiplier).toFixed(0)}` },
                  { label: "Taylor n", value: `${material.taylorN}` },
                  { label: t("common", "cuttingSpeed"), value: `${cuttingSpeed} m/${t("common", "minute")}` },
                  { label: "Δ", value: `${(Number(calculations.economicSpeed) - cuttingSpeed).toFixed(0)} m/${t("common", "minute")}` }
                ]}
                useCases={["Cost optimization", "Tool life maximization", "Production planning", "Energy savings"]}
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
                <><span className="text-success font-medium">✓</span> {t("toolLife", "optimumSettings")}</>
              ) : Number(calculations.efficiency) >= 50 ? (
                <><span className="text-warning font-medium">⚠</span> {t("toolLife", "warningSettings")} ({calculations.economicSpeed} m/{t("common", "minute")})</>
              ) : (
                <><span className="text-destructive font-medium">✗</span> {t("toolLife", "criticalSettings")}</>
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
        >
          <Info className={`w-4 h-4 ${isInfoActive ? 'text-accent' : 'text-muted-foreground'}`} />
        </button>
      )}
    </div>
    <span className={`font-mono text-2xl font-bold ${highlight ? "text-success" : "text-foreground"}`}>{value}</span>
  </div>
);

export default ToolLifeCalculator;
