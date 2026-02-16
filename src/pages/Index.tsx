import { useState, useEffect } from "react";
import { safeGetItem, safeSetItem, isValidArray } from "@/lib/safeStorage";
import { Calculator, Clock, Database, DollarSign, History, Plus, GitCompare, Wrench, Circle, BotMessageSquare, FileImage, Ruler, Lock, ChevronDown, Cpu, BarChart3, FolderOpen } from "lucide-react";
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
import AdminPanel from "@/components/AdminPanel";
import { Material, materials as defaultMaterials } from "@/data/materials";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type TabId = "ai-learn" | "cutting" | "toollife" | "threading" | "drilling" | "compare" | "materials" | "cost" | "costcalc" | "history" | "drawing" | "tolerance" | "admin";

type CategoryId = "ai" | "machining" | "analysis" | "data";

interface CategoryDef {
  id: CategoryId;
  icon: any;
  tabs: { id: TabId; icon: any }[];
}

const categories: CategoryDef[] = [
  {
    id: "ai",
    icon: Cpu,
    tabs: [
      { id: "ai-learn", icon: BotMessageSquare },
      { id: "drawing", icon: FileImage },
    ],
  },
  {
    id: "machining",
    icon: Wrench,
    tabs: [
      { id: "cutting", icon: Calculator },
      { id: "toollife", icon: Clock },
      { id: "threading", icon: Wrench },
      { id: "drilling", icon: Circle },
      { id: "tolerance", icon: Ruler },
    ],
  },
  {
    id: "analysis",
    icon: BarChart3,
    tabs: [
      { id: "costcalc", icon: DollarSign },
      { id: "cost", icon: DollarSign },
      { id: "compare", icon: GitCompare },
    ],
  },
  {
    id: "data",
    icon: FolderOpen,
    tabs: [
      { id: "materials", icon: Database },
      { id: "history", icon: History },
    ],
  },
];

const ALWAYS_ACCESSIBLE = ["ai-learn", "admin"];
const CUSTOM_MATERIALS_KEY = "cnc_custom_materials";

const Index = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("ai-learn");
  const [openCategory, setOpenCategory] = useState<CategoryId | null>("ai");
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [customMaterials, setCustomMaterials] = useState<Material[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  useEffect(() => {
    const stored = safeGetItem<Material[]>(CUSTOM_MATERIALS_KEY, []);
    if (isValidArray(stored)) {
      setCustomMaterials(stored);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadPermissions = async () => {
      const [rolesRes, permsRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("user_module_permissions").select("module_key, granted").eq("user_id", user.id),
      ]);
      const roles = rolesRes.data?.map((r) => r.role) || [];
      setIsAdmin(roles.includes("admin"));
      const perms: Record<string, boolean> = {};
      permsRes.data?.forEach((p) => { perms[p.module_key] = p.granted; });
      setPermissions(perms);
      setPermissionsLoaded(true);
    };
    loadPermissions();
  }, [user]);

  const hasAccess = (tabId: string): boolean => {
    if (ALWAYS_ACCESSIBLE.includes(tabId)) return true;
    if (isAdmin) return true;
    return !!permissions[tabId];
  };

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

  const handleTabClick = (tabId: TabId) => {
    if (!hasAccess(tabId)) return;
    setActiveTab(tabId);
  };

  const toggleCategory = (catId: CategoryId) => {
    setOpenCategory(openCategory === catId ? null : catId);
  };

  // Find which category contains the active tab
  const activeCategoryId = categories.find((c) => c.tabs.some((tab) => tab.id === activeTab))?.id;

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <Header isAdmin={isAdmin} onAdminClick={() => setActiveTab("admin")} adminActive={activeTab === "admin"} />
      
      <main className="container mx-auto px-4 py-6">
        {/* Grouped Mega Menu */}
        <nav className="mb-6 space-y-1">
          {/* Category buttons row */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const CatIcon = cat.icon;
              const isOpen = openCategory === cat.id;
              const isActiveCat = activeCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActiveCat
                      ? "bg-primary text-primary-foreground"
                      : isOpen
                      ? "bg-card border border-primary/50 text-foreground"
                      : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                  }`}
                >
                  <CatIcon className="w-4 h-4" />
                  {t("categories", cat.id)}
                  <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
              );
            })}

            {/* Add Material button */}
            {(isAdmin || permissions["add_material"]) && (
              <button
                onClick={() => setShowMaterialForm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-success/10 text-success border border-success/30 hover:bg-success/20 transition-all ml-auto"
              >
                <Plus className="w-4 h-4" />
                {t("footer", "addMaterial")}
              </button>
            )}
          </div>

          {/* Expanded module items for open category */}
          {openCategory && (
            <div className="flex flex-wrap gap-1.5 pt-2 pl-1 animate-in fade-in slide-in-from-top-1 duration-200">
              {categories
                .find((c) => c.id === openCategory)
                ?.tabs.map((tab) => {
                  const Icon = tab.icon;
                  const accessible = hasAccess(tab.id);
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabClick(tab.id)}
                      disabled={!accessible}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${
                        !accessible
                          ? "text-muted-foreground/30 cursor-not-allowed"
                          : isActive
                          ? "bg-primary/15 text-primary border border-primary/30 font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      {accessible ? <Icon className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      {t("tabs", tab.id)}
                    </button>
                  );
                })}
            </div>
          )}
        </nav>

        {/* Module Content */}
        <div className="space-y-6">
          {activeTab === "ai-learn" && <AILearningModule />}
          {activeTab === "cutting" && hasAccess("cutting") && <CuttingCalculator customMaterials={customMaterials} />}
          {activeTab === "toollife" && hasAccess("toollife") && <ToolLifeCalculator customMaterials={customMaterials} />}
          {activeTab === "threading" && hasAccess("threading") && <ThreadingCalculator />}
          {activeTab === "drilling" && hasAccess("drilling") && <DrillTapCalculator customMaterials={customMaterials} />}
          {activeTab === "compare" && hasAccess("compare") && <ParameterComparison customMaterials={customMaterials} />}
          {activeTab === "materials" && hasAccess("materials") && (
            <MaterialList 
              customMaterials={customMaterials} 
              onDeleteCustom={handleDeleteMaterial}
            />
          )}
          {activeTab === "cost" && hasAccess("cost") && <CostAnalyzer />}
          {activeTab === "costcalc" && hasAccess("costcalc") && <CostCalculation />}
          {activeTab === "drawing" && hasAccess("drawing") && <DrawingAnalyzer />}
          {activeTab === "tolerance" && hasAccess("tolerance") && <ToleranceGuide />}
          {activeTab === "history" && hasAccess("history") && <CalculationHistory />}
          {activeTab === "admin" && isAdmin && <AdminPanel />}
          
          {!hasAccess(activeTab) && !ALWAYS_ACCESSIBLE.includes(activeTab) && (
            <div className="text-center py-12">
              <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{t("admin", "noPermission")}</p>
            </div>
          )}
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
