import { useState, useEffect } from "react";
import { safeGetItem, safeSetItem, isValidArray } from "@/lib/safeStorage";
import { Calculator, Clock, Database, DollarSign, History, Plus, GitCompare, Wrench, Circle, BotMessageSquare, FileImage, Ruler } from "lucide-react";
import Header from "@/components/Header";
import CuttingCalculator from "@/components/CuttingCalculator";
import ToolLifeCalculator from "@/components/ToolLifeCalculator";
import MaterialList from "@/components/MaterialList";
import CostAnalyzer from "@/components/CostAnalyzer";
import CostCalculation from "@/components/CostCalculation";
import CalculationHistory from "@/components/CalculationHistory";
import MaterialForm from "@/components/MaterialForm";
import ParameterComparison from "@/components/ParameterComparison";
import ThreadingCalculator from "@/components/ThreadingCalculator";
import DrillTapCalculator from "@/components/DrillTapCalculator";
import AILearningModule from "@/components/AILearningModule";
import DrawingAnalyzer from "@/components/DrawingAnalyzer";
import ToleranceGuide from "@/components/ToleranceGuide";
import { Material, materials as defaultMaterials } from "@/data/materials";
import { useLanguage } from "@/i18n/LanguageContext";

type TabId = "ai-learn" | "cutting" | "toollife" | "threading" | "drilling" | "compare" | "materials" | "cost" | "costcalc" | "history" | "drawing" | "tolerance";

const tabDefs: { id: TabId; icon: any }[] = [
  { id: "ai-learn", icon: BotMessageSquare },
  { id: "drawing", icon: FileImage },
  { id: "costcalc", icon: DollarSign },
  { id: "cutting", icon: Calculator },
  { id: "toollife", icon: Clock },
  { id: "threading", icon: Wrench },
  { id: "drilling", icon: Circle },
  { id: "tolerance", icon: Ruler },
  { id: "compare", icon: GitCompare },
  { id: "materials", icon: Database },
  { id: "cost", icon: DollarSign },
  { id: "history", icon: History },
];

const CUSTOM_MATERIALS_KEY = "cnc_custom_materials";

const Index = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabId>("ai-learn");
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [customMaterials, setCustomMaterials] = useState<Material[]>([]);

  useEffect(() => {
    const stored = safeGetItem<Material[]>(CUSTOM_MATERIALS_KEY, []);
    if (isValidArray(stored)) {
      setCustomMaterials(stored);
    }
  }, []);

  const handleAddMaterial = (material: Material) => {
    const updated = [...customMaterials, material];
    setCustomMaterials(updated);
    safeSetItem(CUSTOM_MATERIALS_KEY, updated);
  };

  const handleDeleteMaterial = (id: string) => {
    const updated = customMaterials.filter((m) => m.id !== id);
    setCustomMaterials(updated);
    safeSetItem(CUSTOM_MATERIALS_KEY, updated);
  };

  const allMaterials = [...defaultMaterials, ...customMaterials];

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <Header />
      
      <main className="container mx-auto px-4 py-6">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabDefs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground glow-accent"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t("tabs", tab.id)}
              </button>
            );
          })}
          
          <button
            onClick={() => setShowMaterialForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium bg-success/20 text-success border border-success/30 hover:bg-success/30 transition-all whitespace-nowrap ml-auto"
          >
            <Plus className="w-4 h-4" />
            {t("footer", "addMaterial")}
          </button>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === "ai-learn" && <AILearningModule />}
          {activeTab === "cutting" && <CuttingCalculator customMaterials={customMaterials} />}
          {activeTab === "toollife" && <ToolLifeCalculator customMaterials={customMaterials} />}
          {activeTab === "threading" && <ThreadingCalculator />}
          {activeTab === "drilling" && <DrillTapCalculator customMaterials={customMaterials} />}
          {activeTab === "compare" && <ParameterComparison customMaterials={customMaterials} />}
          {activeTab === "materials" && (
            <MaterialList 
              customMaterials={customMaterials} 
              onDeleteCustom={handleDeleteMaterial}
            />
          )}
          {activeTab === "cost" && <CostAnalyzer />}
          {activeTab === "costcalc" && <CostCalculation />}
          {activeTab === "drawing" && <DrawingAnalyzer />}
          {activeTab === "tolerance" && <ToleranceGuide />}
          {activeTab === "history" && <CalculationHistory />}
        </div>

        {/* Footer Stats */}
        <footer className="mt-8 pt-6 border-t border-border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FooterStat label={t("footer", "totalMaterials")} value={allMaterials.length.toString()} />
            <FooterStat label={t("footer", "toolTypes")} value="6" />
            <FooterStat label={t("footer", "processModes")} value="4" />
            <FooterStat label={t("common", "version")} value="2.0" />
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            {t("footer", "copyright")}
          </p>
        </footer>
      </main>

      {/* Material Form Modal */}
      {showMaterialForm && (
        <MaterialForm
          onAddMaterial={handleAddMaterial}
          onClose={() => setShowMaterialForm(false)}
        />
      )}
    </div>
  );
};

const FooterStat = ({ label, value }: { label: string; value: string }) => (
  <div className="text-center p-3 rounded-lg bg-card/50 border border-border/50">
    <span className="text-2xl font-mono font-bold text-primary">{value}</span>
    <span className="block text-xs text-muted-foreground mt-1">{label}</span>
  </div>
);

export default Index;
