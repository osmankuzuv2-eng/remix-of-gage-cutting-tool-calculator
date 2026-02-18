import { useState, useEffect } from "react";
import { safeGetItem, safeSetItem, isValidArray } from "@/lib/safeStorage";
import { useMaterialSettings } from "@/hooks/useMaterialSettings";
import { Lock, Plus, ChevronDown } from "lucide-react";
import Header from "@/components/Header";
import LiveTicker from "@/components/LiveTicker";
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
import AFKPriceCalculator from "@/components/AFKPriceCalculator";

import AdminPanel from "@/components/AdminPanel";
import { Material, materials as defaultMaterials } from "@/data/materials";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMenuConfig } from "@/hooks/useMenuConfig";
import { getIcon, moduleIcons } from "@/lib/iconMap";
import { useModuleTranslations } from "@/hooks/useModuleTranslations";

type TabId = "ai-learn" | "cutting" | "toollife" | "threading" | "drilling" | "compare" | "materials" | "cost" | "costcalc" | "afkprice" | "history" | "drawing" | "tolerance" | "admin";

const ALWAYS_ACCESSIBLE = ["ai-learn", "admin"];
const CUSTOM_MATERIALS_KEY = "cnc_custom_materials";
// Prices and AFK multipliers are now stored in the database via useMaterialSettings

const Index = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { categories, reload: reloadMenu } = useMenuConfig();
  const { getModuleName } = useModuleTranslations();
  const { materialPrices, afkMultipliers, updatePrice, updateAfkMultiplier } = useMaterialSettings();
  const [activeTab, setActiveTab] = useState<TabId>("ai-learn");
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [customMaterials, setCustomMaterials] = useState<Material[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  // Open first category by default
  useEffect(() => {
    if (categories.length > 0 && openCategory === null) {
      setOpenCategory(categories[0].id);
    }
  }, [categories]);

  useEffect(() => {
    const stored = safeGetItem<Material[]>(CUSTOM_MATERIALS_KEY, []);
    if (isValidArray(stored)) setCustomMaterials(stored);
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

  const allMaterials = [...defaultMaterials, ...customMaterials].map((m) => 
    materialPrices[m.id] !== undefined ? { ...m, pricePerKg: materialPrices[m.id] } : m
  );

  const handleTabClick = (tabId: TabId) => {
    if (!hasAccess(tabId)) return;
    setActiveTab(tabId);
  };

  const toggleCategory = (catId: string) => {
    setOpenCategory(openCategory === catId ? null : catId);
  };

  const activeCategoryId = categories.find((c) => c.modules.some((m) => m.module_key === activeTab))?.id;

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <Header isAdmin={isAdmin} onAdminClick={() => setActiveTab("admin")} adminActive={activeTab === "admin"} />
      <LiveTicker />
      
      <main className="container mx-auto px-4 py-6">
        {/* Grouped Mega Menu */}
        <nav className="mb-6 space-y-2">
          {/* Category buttons row */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const CatIcon = getIcon(cat.icon);
              const isOpen = openCategory === cat.id;
              const isActiveCat = activeCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 border group ${
                    isActiveCat
                      ? `bg-gradient-to-r ${cat.color} text-white border-transparent shadow-lg hover:shadow-xl hover:scale-[1.03] active:scale-[0.97]`
                      : isOpen
                      ? `${cat.bg_color} ${cat.text_color} ${cat.border_color} border hover:scale-[1.02]`
                      : `bg-card border-border text-muted-foreground hover:${cat.text_color} hover:${cat.border_color} hover:scale-[1.03] hover:shadow-md active:scale-[0.97]`
                  }`}
                >
                  <CatIcon className="w-4 h-4 transition-transform duration-300 group-hover:rotate-12" />
                  {language === "en" && cat.name_en ? cat.name_en : language === "fr" && cat.name_fr ? cat.name_fr : cat.name}
                  <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isOpen ? "rotate-180" : "group-hover:translate-y-0.5"}`} />
                </button>
              );
            })}

            {(isAdmin || permissions["add_material"]) && (
              <button
                onClick={() => setShowMaterialForm(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-success/10 text-success border border-success/30 hover:bg-success/20 hover:scale-[1.03] hover:shadow-md active:scale-[0.97] transition-all duration-300 ml-auto group"
              >
                <Plus className="w-4 h-4 transition-transform duration-300 group-hover:rotate-90" />
                {t("footer", "addMaterial")}
              </button>
            )}
          </div>

          {/* Expanded module cards for open category */}
          {openCategory && (() => {
            const cat = categories.find((c) => c.id === openCategory);
            if (!cat) return null;
            return (
              <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-2 animate-in fade-in slide-in-from-top-2 duration-200`}>
                {cat.modules.map((mod, modIdx) => {
                  const ModIcon = moduleIcons[mod.module_key] || getIcon(cat.icon);
                  const accessible = hasAccess(mod.module_key);
                  const isActive = activeTab === mod.module_key;
                  return (
                    <button
                      key={mod.module_key}
                      onClick={() => handleTabClick(mod.module_key as TabId)}
                      disabled={!accessible}
                      style={{ animationDelay: `${modIdx * 50}ms` }}
                      className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-300 animate-fade-in group ${
                        !accessible
                          ? "bg-muted/20 border-border/30 text-muted-foreground/30 cursor-not-allowed"
                          : isActive
                          ? `${cat.bg_color} ${cat.border_color} border shadow-md scale-[1.02]`
                          : `bg-card/60 border-border hover:${cat.bg_color} hover:${cat.border_color} hover:shadow-lg hover:scale-[1.05] hover:-translate-y-1 active:scale-[0.95]`
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 ${
                        isActive
                          ? `bg-gradient-to-br ${cat.color} text-white shadow-lg`
                          : accessible
                          ? `${cat.bg_color} ${cat.text_color} group-hover:scale-110 group-hover:shadow-md`
                          : "bg-muted/30 text-muted-foreground/30"
                      }`}>
                        {accessible ? <ModIcon className="w-5 h-5 transition-transform duration-300 group-hover:rotate-6" /> : <Lock className="w-4 h-4" />}
                      </div>
                      <span className={`text-xs font-medium text-center leading-tight transition-colors duration-300 ${
                        isActive ? cat.text_color : accessible ? "text-foreground" : "text-muted-foreground/30"
                      }`}>
                        {getModuleName(mod.module_key)}
                      </span>
                      {isActive && (
                        <div className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full bg-gradient-to-r ${cat.color} animate-scale-in`} />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })()}
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
              materialPrices={materialPrices}
              afkMultipliers={afkMultipliers}
              onDeleteCustom={handleDeleteMaterial}
              isAdmin={isAdmin}
              onUpdatePrice={(id, price) => {
                updatePrice(id, price);
                if (id.startsWith("custom-")) {
                  const updated = customMaterials.map((m) =>
                    m.id === id ? { ...m, pricePerKg: price } : m
                  );
                  setCustomMaterials(updated);
                  safeSetItem(CUSTOM_MATERIALS_KEY, updated);
                }
              }}
              onUpdateAfkMultiplier={(id, multiplier) => {
                updateAfkMultiplier(id, multiplier);
              }}
            />
          )}
          {activeTab === "cost" && hasAccess("cost") && <CostAnalyzer />}
          {activeTab === "costcalc" && hasAccess("costcalc") && <CostCalculation />}
          {activeTab === "afkprice" && hasAccess("afkprice") && <AFKPriceCalculator />}
          
          {activeTab === "drawing" && hasAccess("drawing") && <DrawingAnalyzer />}
          {activeTab === "tolerance" && hasAccess("tolerance") && <ToleranceGuide />}
          {activeTab === "history" && hasAccess("history") && <CalculationHistory />}
          {activeTab === "admin" && isAdmin && <AdminPanel onMenuUpdated={reloadMenu} />}
          
          {!hasAccess(activeTab) && !ALWAYS_ACCESSIBLE.includes(activeTab) && (
            <div className="text-center py-12">
              <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{t("admin", "noPermission")}</p>
            </div>
          )}
        </div>

        <footer className="mt-8 pt-6 border-t border-border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FooterStat label={t("footer", "totalMaterials")} value={allMaterials.length.toString()} />
            <FooterStat label={t("footer", "toolTypes")} value="6" />
            <FooterStat label={t("footer", "processModes")} value="4" />
            <FooterStat label={t("common", "version")} value="2.0" />
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">{t("footer", "copyright")}</p>
        </footer>
      </main>

      {showMaterialForm && (
        <MaterialForm onAddMaterial={handleAddMaterial} onClose={() => setShowMaterialForm(false)} />
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
