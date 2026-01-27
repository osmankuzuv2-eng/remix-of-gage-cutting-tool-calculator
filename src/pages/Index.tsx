import { useState, useEffect } from "react";
import { safeGetItem, safeSetItem, isValidArray } from "@/lib/safeStorage";
import { Calculator, Clock, Database, Code, DollarSign, History, Plus, GitCompare, Wrench, Circle, LayoutDashboard } from "lucide-react";
import Header from "@/components/Header";
import CuttingCalculator from "@/components/CuttingCalculator";
import ToolLifeCalculator from "@/components/ToolLifeCalculator";
import MaterialList from "@/components/MaterialList";
import GCodeGenerator from "@/components/GCodeGenerator";
import CostAnalyzer from "@/components/CostAnalyzer";
import CalculationHistory from "@/components/CalculationHistory";
import MaterialForm from "@/components/MaterialForm";


import ParameterComparison from "@/components/ParameterComparison";
import ThreadingCalculator from "@/components/ThreadingCalculator";
import DrillTapCalculator from "@/components/DrillTapCalculator";
import Dashboard from "@/components/Dashboard";
import { Material, materials as defaultMaterials } from "@/data/materials";

type TabId = "dashboard" | "cutting" | "toollife" | "threading" | "drilling" | "compare" | "materials" | "gcode" | "cost" | "history";

const tabs = [
  { id: "dashboard" as TabId, label: "Dashboard", icon: LayoutDashboard },
  { id: "cutting" as TabId, label: "Kesme", icon: Calculator },
  { id: "toollife" as TabId, label: "Takım Ömrü", icon: Clock },
  { id: "threading" as TabId, label: "Diş Açma", icon: Wrench },
  { id: "drilling" as TabId, label: "Delme", icon: Circle },
  { id: "compare" as TabId, label: "Karşılaştır", icon: GitCompare },
  { id: "materials" as TabId, label: "Malzemeler", icon: Database },
  { id: "gcode" as TabId, label: "G-Code", icon: Code },
  { id: "cost" as TabId, label: "Maliyet", icon: DollarSign },
  { id: "history" as TabId, label: "Geçmiş", icon: History },
];

const CUSTOM_MATERIALS_KEY = "cnc_custom_materials";

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
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
          {tabs.map((tab) => {
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
                {tab.label}
              </button>
            );
          })}
          
          <button
            onClick={() => setShowMaterialForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium bg-success/20 text-success border border-success/30 hover:bg-success/30 transition-all whitespace-nowrap ml-auto"
          >
            <Plus className="w-4 h-4" />
            Malzeme Ekle
          </button>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === "dashboard" && <Dashboard customMaterials={customMaterials} />}
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
          {activeTab === "gcode" && <GCodeGenerator />}
          {activeTab === "cost" && <CostAnalyzer />}
          {activeTab === "history" && <CalculationHistory />}
        </div>

        {/* Footer Stats */}
        <footer className="mt-8 pt-6 border-t border-border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FooterStat label="Toplam Malzeme" value={allMaterials.length.toString()} />
            <FooterStat label="Takım Tipi" value="6" />
            <FooterStat label="İşlem Modu" value="4" />
            <FooterStat label="Versiyon" value="2.0" />
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            GAGE Confidence Toolroom © 2026 | Hassas CNC Hesaplama Çözümleri
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
