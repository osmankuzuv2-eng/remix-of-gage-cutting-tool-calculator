import { useState, useMemo } from "react";
import { GitCompare, Plus, Trash2, Trophy, TrendingUp, Clock, Zap, Info, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { materials, toolTypes, Material } from "@/data/materials";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from "recharts";
import { useLanguage } from "@/i18n/LanguageContext";

interface Scenario {
  id: string; name: string; materialId: string; toolId: string;
  diameter: number; depth: number; cuttingSpeed: number;
}

interface ParameterComparisonProps { customMaterials: Material[]; }

const ParameterComparison = ({ customMaterials }: ParameterComparisonProps) => {
  const { t } = useLanguage();
  const allMaterials = [...materials, ...customMaterials];

  const getMaterialName = (m: Material) => { const tr = t("materialNames", m.id); return tr !== m.id ? tr : m.name; };
  const getToolName = (id: string) => { const tr = t("toolTypeNames", id); return tr !== id ? tr : toolTypes.find(tt => tt.id === id)?.name || id; };
  
  const [scenarios, setScenarios] = useState<Scenario[]>([
    { id: crypto.randomUUID(), name: `${t("comparison", "scenario")} A`, materialId: allMaterials[0].id, toolId: toolTypes[1].id, diameter: 20, depth: 2, cuttingSpeed: 180 },
    { id: crypto.randomUUID(), name: `${t("comparison", "scenario")} B`, materialId: allMaterials[0].id, toolId: toolTypes[2].id, diameter: 20, depth: 2, cuttingSpeed: 220 },
  ]);

  const addScenario = () => {
    if (scenarios.length < 4) {
      setScenarios([...scenarios, {
        id: crypto.randomUUID(), name: `${t("comparison", "scenario")} ${String.fromCharCode(65 + scenarios.length)}`,
        materialId: allMaterials[0].id, toolId: toolTypes[1].id, diameter: 20, depth: 2, cuttingSpeed: 180,
      }]);
    }
  };

  const removeScenario = (id: string) => { if (scenarios.length > 2) setScenarios(scenarios.filter((s) => s.id !== id)); };
  const updateScenario = (id: string, field: keyof Scenario, value: string | number) => {
    setScenarios(scenarios.map((s) => s.id === id ? { ...s, [field]: value } : s));
  };

  const calculateMetrics = (scenario: Scenario) => {
    const material = allMaterials.find((m) => m.id === scenario.materialId)!;
    const tool = toolTypes.find((t) => t.id === scenario.toolId)!;
    const adjustedSpeed = scenario.cuttingSpeed * tool.multiplier;
    const spindleSpeed = (1000 * adjustedSpeed) / (Math.PI * scenario.diameter);
    const avgFeedRate = (material.feedRate.min + material.feedRate.max) / 2;
    const tableFeed = avgFeedRate * spindleSpeed;
    const mrr = (scenario.depth * (scenario.diameter * 0.6) * tableFeed) / 1000;
    const toolLife = Math.pow(material.taylorC / scenario.cuttingSpeed, 1 / material.taylorN);
    const power = (2000 * mrr) / 60;
    const speedEfficiency = Math.min(100, (scenario.cuttingSpeed / material.cuttingSpeed.max) * 100);
    const lifeScore = Math.min(100, (toolLife / 60) * 100);
    const mrrScore = Math.min(100, (mrr / 50) * 100);
    const powerScore = Math.max(0, 100 - (power / 5) * 100);
    const overallScore = (speedEfficiency * 0.25 + lifeScore * 0.3 + mrrScore * 0.3 + powerScore * 0.15);
    return { spindleSpeed: Math.round(spindleSpeed), tableFeed: Math.round(tableFeed), mrr: mrr.toFixed(2), toolLife: toolLife.toFixed(1), power: power.toFixed(2), speedEfficiency: speedEfficiency.toFixed(0), lifeScore: lifeScore.toFixed(0), mrrScore: mrrScore.toFixed(0), overallScore: overallScore.toFixed(0) };
  };

  const comparisonData = useMemo(() => scenarios.map((s) => {
    const metrics = calculateMetrics(s);
    return { name: s.name, spindleSpeed: metrics.spindleSpeed, tableFeed: metrics.tableFeed, mrr: parseFloat(metrics.mrr), toolLife: parseFloat(metrics.toolLife), power: parseFloat(metrics.power), score: parseFloat(metrics.overallScore) };
  }), [scenarios]);

  const radarData = useMemo(() => [
    { metric: t("comparison", "speed"), ...Object.fromEntries(scenarios.map((s) => [s.name, parseFloat(calculateMetrics(s).speedEfficiency)])) },
    { metric: t("comparison", "life"), ...Object.fromEntries(scenarios.map((s) => [s.name, parseFloat(calculateMetrics(s).lifeScore)])) },
    { metric: "MRR", ...Object.fromEntries(scenarios.map((s) => [s.name, parseFloat(calculateMetrics(s).mrrScore)])) },
    { metric: t("comparison", "powerEff"), ...Object.fromEntries(scenarios.map((s) => [s.name, Math.max(0, 100 - parseFloat(calculateMetrics(s).power) * 20)])) },
  ], [scenarios]);

  const bestScenario = useMemo(() => {
    let best = scenarios[0]; let bestScore = parseFloat(calculateMetrics(scenarios[0]).overallScore);
    scenarios.forEach((s) => { const score = parseFloat(calculateMetrics(s).overallScore); if (score > bestScore) { best = s; bestScore = score; } });
    return best;
  }, [scenarios]);

  const colors = ["hsl(var(--primary))", "hsl(var(--accent))", "#22c55e", "#f59e0b"];

  return (
    <div className="industrial-card p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/20"><GitCompare className="w-5 h-5 text-orange-400" /></div>
          <h2 className="text-lg font-semibold text-foreground">{t("comparison", "title")}</h2>
        </div>
        <button onClick={addScenario} disabled={scenarios.length >= 4}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent/20 text-accent hover:bg-accent/30 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
          <Plus className="w-4 h-4" />{t("comparison", "addScenario")}
        </button>
      </div>

      {/* Score Explanation Panel */}
      <Collapsible className="mb-6">
        <CollapsibleTrigger className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-sm text-muted-foreground hover:text-foreground transition-colors w-full group">
          <Info className="w-4 h-4 text-primary" />
          <span className="flex-1 text-left font-medium">Genel Skor Nasıl Hesaplanır?</span>
          <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-lg bg-card border border-border">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm font-medium text-foreground">Hız Verimliliği</span>
                <span className="text-xs text-muted-foreground ml-auto">%25</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Girilen kesme hızının, malzemenin önerilen maksimum hızına oranı. Yüksek oran = malzeme kapasitesinin iyi kullanımı.</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm font-medium text-foreground">Takım Ömrü</span>
                <span className="text-xs text-muted-foreground ml-auto">%30</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Taylor formülüyle hesaplanan takım ömrünün 60 dk referansa oranı. Uzun ömür = daha az takım değişimi ve maliyet.</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm font-medium text-foreground">MRR (Talaş Kaldırma)</span>
                <span className="text-xs text-muted-foreground ml-auto">%30</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Birim zamanda kaldırılan talaş hacmi (cm³/dk). 50 cm³/dk referansa oranlanır. Yüksek MRR = yüksek üretkenlik.</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm font-medium text-foreground">Güç Verimliliği</span>
                <span className="text-xs text-muted-foreground ml-auto">%15</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Düşük güç tüketimi yüksek skor alır. Enerji verimliliğini ödüllendirerek işleme maliyetini düşürmeyi hedefler.</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 px-1">
            <strong>Formül:</strong> Genel Skor = Hız×0.25 + Ömür×0.30 + MRR×0.30 + Güç×0.15 — En yüksek skoru alan senaryo 🏆 ile işaretlenir.
          </p>
        </CollapsibleContent>
      </Collapsible>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {scenarios.map((scenario, index) => {
          const metrics = calculateMetrics(scenario);
          const isBest = scenario.id === bestScenario.id;
          return (
            <div key={scenario.id} className={`p-4 rounded-lg border ${isBest ? "bg-primary/10 border-primary/50" : "bg-card border-border"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[index] }} />
                  <input type="text" value={scenario.name} onChange={(e) => updateScenario(scenario.id, "name", e.target.value)} className="bg-transparent border-none text-sm font-medium text-foreground focus:outline-none w-24" />
                  {isBest && <Trophy className="w-4 h-4 text-yellow-400" />}
                </div>
                {scenarios.length > 2 && (
                  <button onClick={() => removeScenario(scenario.id)} className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-muted-foreground">{t("common", "material")}</label>
                  <select value={scenario.materialId} onChange={(e) => updateScenario(scenario.id, "materialId", e.target.value)} className="input-industrial w-full text-xs py-1">
                    {allMaterials.map((m) => (<option key={m.id} value={m.id}>{getMaterialName(m)}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-muted-foreground">{t("common", "toolType")}</label>
                  <select value={scenario.toolId} onChange={(e) => updateScenario(scenario.id, "toolId", e.target.value)} className="input-industrial w-full text-xs py-1">
                    {toolTypes.map((tt) => (<option key={tt.id} value={tt.id}>{getToolName(tt.id)}</option>))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted-foreground">{t("common", "diameter")} (mm)</label>
                    <input type="number" value={scenario.diameter} onChange={(e) => updateScenario(scenario.id, "diameter", Number(e.target.value))} className="input-industrial w-full text-xs py-1" />
                  </div>
                  <div>
                    <label className="text-muted-foreground">{t("common", "cuttingSpeed")} (m/{t("common", "minute")})</label>
                    <input type="number" value={scenario.cuttingSpeed} onChange={(e) => updateScenario(scenario.id, "cuttingSpeed", Number(e.target.value))} className="input-industrial w-full text-xs py-1" />
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <div className="text-center">
                  <span className="text-xs text-muted-foreground">{t("comparison", "overallScore")}</span>
                  <div className="font-mono text-2xl text-primary">{metrics.overallScore}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="p-4 rounded-lg bg-card border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">{t("comparison", "performanceComparison")}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Legend />
              <Bar dataKey="mrr" name={`MRR (cm³/${t("common", "minute")})`} fill="hsl(var(--primary))" />
              <Bar dataKey="toolLife" name={`${t("comparison", "life")} (${t("common", "minute")})`} fill="hsl(var(--accent))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="p-4 rounded-lg bg-card border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">{t("comparison", "efficiencyAnalysis")}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="metric" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={10} />
              {scenarios.map((s, i) => (<Radar key={s.id} name={s.name} dataKey={s.name} stroke={colors[i]} fill={colors[i]} fillOpacity={0.2} />))}
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-muted-foreground font-medium">{t("comparison", "metric")}</th>
              {scenarios.map((s, i) => (
                <th key={s.id} className="text-center py-3 px-4">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i] }} />
                    <span className="text-foreground">{s.name}</span>
                    {s.id === bestScenario.id && <Trophy className="w-3 h-3 text-yellow-400" />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: t("comparison", "spindle"), key: "spindleSpeed", icon: Zap },
              { label: t("comparison", "tableFeed"), key: "tableFeed", icon: TrendingUp },
              { label: t("comparison", "mrrLabel"), key: "mrr", icon: TrendingUp },
              { label: t("comparison", "toolLifeLabel"), key: "toolLife", icon: Clock },
              { label: t("comparison", "powerLabel"), key: "power", icon: Zap },
            ].map((row) => (
              <tr key={row.key} className="border-b border-border/50 hover:bg-secondary/30">
                <td className="py-3 px-4 text-muted-foreground"><div className="flex items-center gap-2"><row.icon className="w-3 h-3" />{row.label}</div></td>
                {scenarios.map((s) => {
                  const metrics = calculateMetrics(s);
                  return (<td key={s.id} className="text-center py-3 px-4 font-mono text-foreground">{metrics[row.key as keyof typeof metrics]}</td>);
                })}
              </tr>
            ))}
            <tr className="bg-primary/5">
              <td className="py-3 px-4 font-medium text-primary">{t("comparison", "overallScore")}</td>
              {scenarios.map((s) => {
                const metrics = calculateMetrics(s);
                return (<td key={s.id} className="text-center py-3 px-4 font-mono text-xl text-primary font-bold">{metrics.overallScore}</td>);
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ParameterComparison;
