import { useState, useMemo } from "react";
import { DollarSign, TrendingUp, BarChart3, Calculator, Info } from "lucide-react";
import { materials, toolTypes, Material } from "@/data/materials";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import InfoPanelContent from "./InfoPanelContent";
import { useLanguage } from "@/i18n/LanguageContext";

type InfoPanel = 'costPerPart' | 'toolCost' | 'economicSpeed' | 'savings' | null;

interface CostAnalyzerProps {
  customMaterials?: Material[];
}

const CostAnalyzer = ({ customMaterials = [] }: CostAnalyzerProps) => {
  const { t } = useLanguage();
  const allMaterials = useMemo(() => [...materials, ...customMaterials], [customMaterials]);
  const getMaterialName = (m: Material) => { const tr = t("materialNames", m.id); return tr !== m.id ? tr : m.name; };
  const [activeInfoPanel, setActiveInfoPanel] = useState<InfoPanel>(null);
  const [selectedMaterial, setSelectedMaterial] = useState(materials[0].id);
  const [selectedTool, setSelectedTool] = useState(toolTypes[1].id);
  const [toolPrice, setToolPrice] = useState(150);
  const [machineHourlyRate, setMachineHourlyRate] = useState(250);
  const [laborHourlyRate, setLaborHourlyRate] = useState(100);
  const [cuttingSpeed, setCuttingSpeed] = useState(150);
  const [partsPerDay, setPartsPerDay] = useState(100);
  const [workDays, setWorkDays] = useState(22);

  const material = allMaterials.find((m) => m.id === selectedMaterial)!;
  const tool = toolTypes.find((t) => t.id === selectedTool)!;

  const calculations = useMemo(() => {
    const C = material.taylorC * tool.multiplier;
    const n = material.taylorN;
    const toolLifeMinutes = Math.pow(C / cuttingSpeed, 1 / n);
    const toolLifeHours = toolLifeMinutes / 60;
    const timePerPart = 5;
    const partsPerTool = Math.floor(toolLifeMinutes / timePerPart);
    const toolsPerDay = Math.ceil(partsPerDay / partsPerTool);
    const toolsPerMonth = toolsPerDay * workDays;
    const toolCostPerMonth = toolsPerMonth * toolPrice;
    const toolCostPerPart = toolPrice / partsPerTool;
    const hoursPerDay = (partsPerDay * timePerPart) / 60;
    const machineCostPerDay = hoursPerDay * machineHourlyRate;
    const laborCostPerDay = hoursPerDay * laborHourlyRate;
    const totalCostPerDay = machineCostPerDay + laborCostPerDay + (toolsPerDay * toolPrice);
    const costPerPart = partsPerDay > 0 ? totalCostPerDay / partsPerDay : 0;
    const totalMonthly = totalCostPerDay * workDays;
    const economicSpeed = C * Math.pow(n / (1 - n), n);
    const optimalToolLife = Math.pow(C / economicSpeed, 1 / n);
    const optimalPartsPerTool = Math.floor(optimalToolLife / timePerPart);
    const optimalToolsPerMonth = Math.ceil((partsPerDay * workDays) / optimalPartsPerTool);
    const optimalToolCost = optimalToolsPerMonth * toolPrice;
    const savings = toolCostPerMonth - optimalToolCost;
    return {
      toolLifeMinutes: toolLifeMinutes.toFixed(1), toolLifeHours: toolLifeHours.toFixed(2),
      partsPerTool, toolsPerDay, toolsPerMonth,
      toolCostPerMonth: toolCostPerMonth.toFixed(0), toolCostPerPart: toolCostPerPart.toFixed(2),
      machineCostPerDay: machineCostPerDay.toFixed(0), laborCostPerDay: laborCostPerDay.toFixed(0),
      totalCostPerDay: totalCostPerDay.toFixed(0), costPerPart: costPerPart.toFixed(2),
      totalMonthly: totalMonthly.toFixed(0), economicSpeed: economicSpeed.toFixed(0),
      savings: savings.toFixed(0), savingsPercent: ((savings / toolCostPerMonth) * 100).toFixed(1),
    };
  }, [selectedMaterial, selectedTool, toolPrice, machineHourlyRate, laborHourlyRate, cuttingSpeed, partsPerDay, workDays]);

  return (
    <div className="industrial-card p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-emerald-500/20">
          <DollarSign className="w-5 h-5 text-emerald-400" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">{t("costAnalyzer", "title")}</h2>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <h3 className="label-industrial flex items-center gap-2">
            <Calculator className="w-4 h-4" /> {t("costAnalyzer", "inputParams")}
          </h3>

          <div>
            <label className="label-industrial block mb-2">{t("common", "material")}</label>
            <select
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
              className="input-industrial w-full"
            >
              {allMaterials.map((mat) => {
                const tr = t("materialNames", mat.id);
                return <option key={mat.id} value={mat.id}>{tr !== mat.id ? tr : mat.name}</option>;
              })}
            </select>
          </div>

          <div>
            <label className="label-industrial block mb-2">{t("common", "toolType")}</label>
            <select
              value={selectedTool}
              onChange={(e) => setSelectedTool(e.target.value)}
              className="input-industrial w-full"
            >
              {toolTypes.map((tt) => {
                const tr = t("toolTypeNames", tt.id);
                return <option key={tt.id} value={tt.id}>{tr !== tt.id ? tr : tt.name}</option>;
              })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-industrial block mb-2">{t("costAnalyzer", "toolPrice")}</label>
              <input
                type="number"
                value={toolPrice}
                onChange={(e) => setToolPrice(Number(e.target.value))}
                className="input-industrial w-full"
              />
            </div>
            <div>
              <label className="label-industrial block mb-2">{t("common", "cuttingSpeed")}</label>
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
              <label className="label-industrial block mb-2">{t("costAnalyzer", "machineRate")}</label>
              <input
                type="number"
                value={machineHourlyRate}
                onChange={(e) => setMachineHourlyRate(Number(e.target.value))}
                className="input-industrial w-full"
              />
            </div>
            <div>
              <label className="label-industrial block mb-2">{t("costAnalyzer", "laborRate")}</label>
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
              <label className="label-industrial block mb-2">{t("toolLife", "dailyProduction")}</label>
              <input
                type="number"
                value={partsPerDay}
                onChange={(e) => setPartsPerDay(Number(e.target.value))}
                className="input-industrial w-full"
              />
            </div>
            <div>
              <label className="label-industrial block mb-2">{t("costAnalyzer", "workDays")}</label>
              <input
                type="number"
                value={workDays}
                onChange={(e) => setWorkDays(Number(e.target.value))}
                className="input-industrial w-full"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="label-industrial flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> {t("costAnalyzer", "costBreakdown")}
          </h3>

          <div 
            className={`p-4 rounded-lg metal-surface border cursor-pointer transition-all ${activeInfoPanel === 'costPerPart' ? 'border-accent/50 bg-accent/5' : 'border-border hover:border-accent/30'}`}
            onClick={() => setActiveInfoPanel(activeInfoPanel === 'costPerPart' ? null : 'costPerPart')}
          >
            <div className="text-center mb-4">
              <div className="flex items-center justify-center gap-2">
                <span className="label-industrial">{t("costAnalyzer", "costPerPart")}</span>
                <Info className={`w-4 h-4 ${activeInfoPanel === 'costPerPart' ? 'text-accent' : 'text-muted-foreground'}`} />
              </div>
              <div className="font-mono text-4xl font-bold text-primary mt-2">
                €{calculations.costPerPart}
              </div>
            </div>

            <div className="space-y-3">
              <CostBar label={t("costAnalyzer", "toolCost")} value={Number(calculations.toolCostPerPart)} max={Number(calculations.costPerPart)} color="bg-orange-500" />
              <CostBar label={t("costAnalyzer", "machineCost")} value={Number(calculations.machineCostPerDay) / partsPerDay} max={Number(calculations.costPerPart)} color="bg-blue-500" />
              <CostBar label={t("costAnalyzer", "laborCost")} value={Number(calculations.laborCostPerDay) / partsPerDay} max={Number(calculations.costPerPart)} color="bg-green-500" />
            </div>
          </div>

          <Collapsible open={activeInfoPanel === 'costPerPart'}>
            <CollapsibleContent>
              <InfoPanelContent
                title={t("costAnalyzer", "costPerPart")}
                description={t("costAnalyzer", "costPerPartDesc")}
                formula={t("costAnalyzer", "costPerPartFormula")}
                metrics={[
                  { label: t("costAnalyzer", "toolCost"), value: `€${calculations.toolCostPerPart}` },
                  { label: t("costAnalyzer", "machineCost"), value: `€${(Number(calculations.machineCostPerDay) / partsPerDay).toFixed(2)}` },
                  { label: t("costAnalyzer", "laborCost"), value: `€${(Number(calculations.laborCostPerDay) / partsPerDay).toFixed(2)}` },
                  { label: t("costAnalyzer", "dailyCost"), value: `€${calculations.totalCostPerDay}` }
                ]}
                useCases={[t("costAnalyzer", "usePricing"), t("costAnalyzer", "useProfitability"), t("costAnalyzer", "useCostOptimization")]}
              />
            </CollapsibleContent>
          </Collapsible>

          <div className="grid grid-cols-2 gap-3">
            <StatBox 
              label={t("costAnalyzer", "dailyCost")} 
              value={`€${calculations.totalCostPerDay}`}
              hasInfo
              isActive={activeInfoPanel === 'toolCost'}
              onInfoClick={() => setActiveInfoPanel(activeInfoPanel === 'toolCost' ? null : 'toolCost')}
            />
            <StatBox label={t("costAnalyzer", "monthlyCost")} value={`€${calculations.totalMonthly}`} highlight />
            <StatBox label={t("toolLife", "dailyTools")} value={calculations.toolsPerDay.toString()} />
            <StatBox label={t("toolLife", "monthlyTools")} value={calculations.toolsPerMonth.toString()} />
          </div>

          <Collapsible open={activeInfoPanel === 'toolCost'}>
            <CollapsibleContent>
              <InfoPanelContent
                title={t("costAnalyzer", "dailyCost")}
                description={t("costAnalyzer", "dailyCostDesc")}
                formula={t("costAnalyzer", "dailyCostFormula")}
                metrics={[
                  { label: t("common", "time"), value: `${((partsPerDay * 5) / 60).toFixed(1)} ${t("common", "hour")}` },
                  { label: t("costAnalyzer", "machineCost"), value: `€${calculations.machineCostPerDay}` },
                  { label: t("costAnalyzer", "laborCost"), value: `€${calculations.laborCostPerDay}` },
                  { label: t("costAnalyzer", "toolCost"), value: `€${(calculations.toolsPerDay * toolPrice)}` }
                ]}
                useCases={[t("costAnalyzer", "useDailyBudget"), t("costAnalyzer", "useCapacity"), t("costAnalyzer", "useShiftPlanning")]}
              />
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="space-y-4">
          <h3 className="label-industrial flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> {t("costAnalyzer", "optimizationTips")}
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
                <span className="font-medium text-foreground">{t("costAnalyzer", "economicCuttingSpeed")}</span>
              </div>
              <Info className={`w-4 h-4 ${activeInfoPanel === 'economicSpeed' ? 'text-success' : 'text-muted-foreground'}`} />
            </div>
            <div className="font-mono text-3xl text-success mb-2">
              {calculations.economicSpeed} m/{t("common", "minute")}
            </div>
          </div>

          <Collapsible open={activeInfoPanel === 'economicSpeed'}>
            <CollapsibleContent>
              <InfoPanelContent
                title={t("costAnalyzer", "economicCuttingSpeed")}
                description={t("costAnalyzer", "economicSpeedDesc")}
                formula="V_ek = C × (n / (1-n))^n"
                metrics={[
                  { label: t("common", "cuttingSpeed"), value: `${cuttingSpeed} m/${t("common", "minute")}` },
                  { label: t("costAnalyzer", "economicCuttingSpeed"), value: `${calculations.economicSpeed} m/${t("common", "minute")}` },
                  { label: "Δ", value: `${Math.abs(cuttingSpeed - Number(calculations.economicSpeed))} m/${t("common", "minute")}` },
                  { label: t("costAnalyzer", "toolLifeLabel"), value: `${calculations.toolLifeMinutes} ${t("common", "minute")}` }
                ]}
                useCases={[t("costAnalyzer", "useCostOptimization"), t("costAnalyzer", "useEfficiency"), t("costAnalyzer", "useToolLifeExtension")]}
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
                  <span className="label-industrial">{t("costAnalyzer", "potentialSavings")}</span>
                  <Info className={`w-4 h-4 ${activeInfoPanel === 'savings' ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="font-mono text-3xl font-bold text-primary">
                    €{calculations.savings}
                  </span>
                  <span className="text-sm text-muted-foreground">/{t("common", "monthly").toLowerCase()}</span>
                </div>
                <div className="text-sm text-success mt-1">
                  %{calculations.savingsPercent}
                </div>
              </div>

              <Collapsible open={activeInfoPanel === 'savings'}>
                <CollapsibleContent>
                  <InfoPanelContent
                    title={t("costAnalyzer", "potentialSavings")}
                    description={t("costAnalyzer", "savingsDesc")}
                    formula={t("costAnalyzer", "savingsFormula")}
                    metrics={[
                      { label: t("costAnalyzer", "monthlyToolCost"), value: `€${calculations.toolCostPerMonth}` },
                      { label: "Optimal", value: `€${(Number(calculations.toolCostPerMonth) - Number(calculations.savings)).toFixed(0)}` },
                      { label: t("costAnalyzer", "potentialSavings"), value: `€${calculations.savings}` },
                      { label: "%", value: `${calculations.savingsPercent}` }
                    ]}
                    useCases={[t("costAnalyzer", "useBudgetPlanning"), t("costAnalyzer", "useROI"), t("costAnalyzer", "useCostReporting")]}
                  />
                </CollapsibleContent>
              </Collapsible>
            </>
          )}

          <div className="p-4 rounded-lg bg-secondary/30 border border-border">
            <h4 className="font-medium text-foreground mb-3">{t("costAnalyzer", "toolPerformance")}</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("costAnalyzer", "toolLifeLabel")}:</span>
                <span className="font-mono text-foreground">{calculations.toolLifeMinutes} {t("common", "minute")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("costAnalyzer", "partsPerTool")}:</span>
                <span className="font-mono text-foreground">{calculations.partsPerTool} {t("common", "piece")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("costAnalyzer", "monthlyToolCost")}:</span>
                <span className="font-mono text-warning">€{calculations.toolCostPerMonth}</span>
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
        <span className="font-mono text-foreground">€{value.toFixed(2)}</span>
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
