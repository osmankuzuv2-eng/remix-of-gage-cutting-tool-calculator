import { useState, useMemo } from "react";
import { Calculator, RotateCcw, Zap, Save, Cloud, Loader2 } from "lucide-react";
import { materials as defaultMaterials, toolTypes, operations, Material } from "@/data/materials";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface CuttingCalculatorProps {
  customMaterials: Material[];
}

const CuttingCalculator = ({ customMaterials }: CuttingCalculatorProps) => {
  const { t } = useLanguage();
  const allMaterials = [...defaultMaterials, ...customMaterials];
  const { user } = useAuth();
  const { saveCalculation } = useSupabaseSync();
  const [saving, setSaving] = useState(false);
  
  const [selectedMaterial, setSelectedMaterial] = useState(allMaterials[0].id);
  const [selectedTool, setSelectedTool] = useState(toolTypes[1].id);
  const [selectedOperation, setSelectedOperation] = useState(operations[0].id);
  const [diameter, setDiameter] = useState<number>(20);
  const [depth, setDepth] = useState<number>(2);

  const material = allMaterials.find((m) => m.id === selectedMaterial) || allMaterials[0];
  const tool = toolTypes.find((t) => t.id === selectedTool)!;

  const calculations = useMemo(() => {
    const avgCuttingSpeed =
      ((material.cuttingSpeed.min + material.cuttingSpeed.max) / 2) *
      tool.multiplier;
    const avgFeedRate =
      (material.feedRate.min + material.feedRate.max) / 2;
    
    const spindleSpeed = Math.round((1000 * avgCuttingSpeed) / (Math.PI * diameter));
    const tableFeed = Math.round(avgFeedRate * spindleSpeed);
    const mrr = ((depth * (diameter * 0.6) * tableFeed) / 1000).toFixed(2);
    const power = ((2000 * parseFloat(mrr)) / 60).toFixed(2);

    return {
      cuttingSpeed: avgCuttingSpeed.toFixed(0),
      spindleSpeed,
      feedRate: avgFeedRate.toFixed(3),
      tableFeed,
      mrr,
      power,
    };
  }, [selectedMaterial, selectedTool, diameter, depth, material, tool]);

  const resetForm = () => {
    setSelectedMaterial(allMaterials[0].id);
    setSelectedTool(toolTypes[1].id);
    setDiameter(20);
    setDepth(2);
  };

  const saveToHistory = async () => {
    setSaving(true);
    try {
      await saveCalculation({
        type: "cutting",
        material: material.name,
        tool: tool.name,
        parameters: {
          diameter: `${diameter} mm`,
          depth: `${depth} mm`,
          operation: operations.find(o => o.id === selectedOperation)?.name || "",
        },
        results: {
          cuttingSpeed: `${calculations.cuttingSpeed} m/${t("common", "minute")}`,
          spindleSpeed: `${calculations.spindleSpeed} dev/${t("common", "minute")}`,
          feedRate: `${calculations.feedRate} mm/dev`,
          tableFeed: `${calculations.tableFeed} mm/${t("common", "minute")}`,
          mrr: `${calculations.mrr} cm³/${t("common", "minute")}`,
          power: `${calculations.power} kW`,
        },
      });
      toast({
        title: user ? t("common", "savedCloud") : t("common", "savedLocal"),
        description: user 
          ? t("common", "savedCloud")
          : t("common", "savedLocal"),
      });
    } catch (error) {
      toast({
        title: t("common", "error"),
        description: t("common", "saveFailed"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="industrial-card p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/20">
            <Calculator className="w-5 h-5 text-accent-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            {t("cutting", "title")}
          </h2>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={saveToHistory}
            disabled={saving}
            size="sm"
            className="gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : user ? (
              <Cloud className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? t("common", "saving") : t("common", "save")}
          </Button>
          <Button
            onClick={resetForm}
            variant="secondary"
            size="sm"
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            {t("common", "reset")}
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-4">
          <div>
            <label className="label-industrial block mb-2">{t("cutting", "operationType")}</label>
            <div className="grid grid-cols-2 gap-2">
              {operations.map((op) => (
                <button
                  key={op.id}
                  onClick={() => setSelectedOperation(op.id)}
                  className={`p-3 rounded-lg border transition-all ${
                    selectedOperation === op.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <span className="text-xl">{op.icon}</span>
                  <span className="block text-sm mt-1">{op.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label-industrial block mb-2">{t("common", "material")}</label>
            <select
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
              className="input-industrial w-full"
            >
              <optgroup label={t("cutting", "standardMaterials")}>
                {defaultMaterials.map((mat) => (
                  <option key={mat.id} value={mat.id}>
                    {mat.name} ({mat.hardness})
                  </option>
                ))}
              </optgroup>
              {customMaterials.length > 0 && (
                <optgroup label={t("cutting", "customMaterials")}>
                  {customMaterials.map((mat) => (
                    <option key={mat.id} value={mat.id}>
                      {mat.name} ({mat.hardness})
                    </option>
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
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-industrial block mb-2">
                {t("cutting", "toolDiameter")}
              </label>
              <input
                type="number"
                value={diameter}
                onChange={(e) => setDiameter(Number(e.target.value))}
                className="input-industrial w-full"
                min="1"
                max="200"
              />
            </div>
            <div>
              <label className="label-industrial block mb-2">
                {t("cutting", "cuttingDepth")}
              </label>
              <input
                type="number"
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
                className="input-industrial w-full"
                min="0.1"
                max="20"
                step="0.1"
              />
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-3">
          <div className="p-4 rounded-lg metal-surface border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-primary" />
              <span className="label-industrial">{t("cutting", "calculatedValues")}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <ResultCard label={t("common", "cuttingSpeed")} value={calculations.cuttingSpeed} unit={`m/${t("common", "minute")}`} />
              <ResultCard label={t("common", "spindleSpeed")} value={calculations.spindleSpeed.toString()} unit={`dev/${t("common", "minute")}`} highlight />
              <ResultCard label={t("common", "feedRate")} value={calculations.feedRate} unit="mm/dev" />
              <ResultCard label={t("cutting", "tableFeed")} value={calculations.tableFeed.toString()} unit={`mm/${t("common", "minute")}`} highlight />
              <ResultCard label={t("cutting", "chipRemoval")} value={calculations.mrr} unit={`cm³/${t("common", "minute")}`} />
              <ResultCard label={t("cutting", "estimatedPower")} value={calculations.power} unit="kW" />
            </div>
          </div>

          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm text-muted-foreground">
              <span className="text-primary font-medium">💡 {t("cutting", "suggestion")}:</span>{" "}
              {material.name} {t("cutting", "suggestionText")}{" "}
              {material.cuttingSpeed.min}-{material.cuttingSpeed.max} m/{t("common", "minute")}{" "}
              {t("cutting", "range")}
            </p>
          </div>

          {!user && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-blue-400">
                💡 {t("cutting", "cloudLoginHint")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ResultCard = ({
  label,
  value,
  unit,
  highlight = false,
}: {
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) => (
  <div
    className={`p-3 rounded-lg ${
      highlight ? "bg-primary/10 border border-primary/30" : "bg-card"
    }`}
  >
    <span className="text-xs text-muted-foreground block mb-1">{label}</span>
    <div className="flex items-baseline gap-1">
      <span className={`font-mono text-xl font-bold ${highlight ? "text-primary" : "text-accent-foreground"}`}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{unit}</span>
    </div>
  </div>
);

export default CuttingCalculator;
