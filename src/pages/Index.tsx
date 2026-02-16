import { useState, useEffect } from "react";
import { safeGetItem, safeSetItem, isValidArray } from "@/lib/safeStorage";
import { Calculator, Clock, Database, DollarSign, History, Plus, GitCompare, Wrench, Circle, BotMessageSquare, FileImage, Ruler, Lock, ArrowLeft } from "lucide-react";
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

type TabId = "home" | "ai-learn" | "cutting" | "toollife" | "threading" | "drilling" | "compare" | "materials" | "cost" | "costcalc" | "history" | "drawing" | "tolerance" | "admin";

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

// Modules that don't need permission checks
const ALWAYS_ACCESSIBLE = ["ai-learn", "admin", "home"];

const CUSTOM_MATERIALS_KEY = "cnc_custom_materials";

const Index = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("home");
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

  // Load user role and permissions
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
      permsRes.data?.forEach((p) => {
        perms[p.module_key] = p.granted;
      });
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

  const visibleTabs = tabDefs;

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

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <Header isAdmin={isAdmin} onAdminClick={() => setActiveTab("admin")} adminActive={activeTab === "admin"} />
      
      <main className="container mx-auto px-4 py-6">
        {/* Back button + Active module header */}
        {activeTab !== "home" && (
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setActiveTab("home")}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">{t("common", "back") || "Geri"}</span>
            </button>
            <h2 className="text-lg font-semibold text-foreground">
              {activeTab === "admin" ? t("admin", "title") : t("tabs", activeTab)}
            </h2>
          </div>
        )}

        {/* Module Grid (Home View) */}
        {activeTab === "home" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const accessible = hasAccess(tab.id);
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  disabled={!accessible}
                  className={`group relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    !accessible
                      ? "bg-card/30 border-border/20 text-muted-foreground/30 cursor-not-allowed"
                      : "bg-card border-border hover:border-primary/60 hover:bg-primary/5 hover:shadow-md hover:shadow-primary/10 cursor-pointer"
                  }`}
                >
                  <div className={`p-2.5 rounded-lg transition-colors ${
                    accessible 
                      ? "bg-primary/10 text-primary group-hover:bg-primary/20" 
                      : "bg-muted/30 text-muted-foreground/30"
                  }`}>
                    {accessible ? <Icon className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                  </div>
                  <span className={`text-xs font-medium text-center leading-tight ${
                    accessible ? "text-foreground" : "text-muted-foreground/30"
                  }`}>
                    {t("tabs", tab.id)}
                  </span>
                </button>
              );
            })}

            {/* Add Material Card */}
            {(isAdmin || permissions["add_material"]) && (
              <button
                onClick={() => setShowMaterialForm(true)}
                className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-success/30 bg-success/5 hover:bg-success/10 hover:border-success/50 hover:shadow-md hover:shadow-success/10 transition-all cursor-pointer"
              >
                <div className="p-2.5 rounded-lg bg-success/10 text-success group-hover:bg-success/20 transition-colors">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-success text-center leading-tight">
                  {t("footer", "addMaterial")}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Module Content */}
        {activeTab !== "home" && (
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
        )}

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
