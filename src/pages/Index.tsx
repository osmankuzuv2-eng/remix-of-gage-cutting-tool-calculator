import { useState, useEffect, useCallback } from "react";
import { safeGetItem, safeSetItem, isValidArray } from "@/lib/safeStorage";
import gageLogo from "@/assets/gage-logo-white.png";
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
import CurrencyRateTracker from "@/components/CurrencyRateTracker";
import CoatingList from "@/components/CoatingList";
import MaintenanceModule from "@/components/MaintenanceModule";
import QuizModule from "@/components/QuizModule";
import TimeImprovements from "@/components/TimeImprovements";

import AdminPanel from "@/components/AdminPanel";
import { Material, materials as defaultMaterials } from "@/data/materials";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMenuConfig } from "@/hooks/useMenuConfig";
import { getIcon, moduleIcons } from "@/lib/iconMap";
import { useModuleTranslations } from "@/hooks/useModuleTranslations";

type TabId = "ai-learn" | "cutting" | "toollife" | "threading" | "drilling" | "compare" | "materials" | "cost" | "costcalc" | "afkprice" | "currency-tracker" | "coatings" | "maintenance" | "history" | "drawing" | "tolerance" | "quiz" | "time-improvements" | "admin";

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
  const [visibleTab, setVisibleTab] = useState<TabId>("ai-learn");
  const [isTransitioning, setIsTransitioning] = useState(false);
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

  // Load custom materials from database
  useEffect(() => {
    if (!user) return;
    const loadCustomMaterials = async () => {
      const { data } = await supabase.from("saved_materials").select("*").eq("user_id", user.id);
      if (data && data.length > 0) {
        const mapped: Material[] = data.map((m: any) => ({
          id: `custom-${m.id}`,
          name: m.name,
          category: m.category,
          hardness: m.hardness_min && m.hardness_max ? `${m.hardness_min}-${m.hardness_max} HB` : "N/A",
          density: 7.85,
          pricePerKg: m.price_per_kg || 0,
          cuttingSpeed: { min: m.cutting_speed_min, max: m.cutting_speed_max, unit: "m/dk" },
          feedRate: { min: m.feed_rate_min, max: m.feed_rate_max, unit: "mm/dev" },
          taylorN: 0.20,
          taylorC: 300,
          color: "bg-emerald-500",
        }));
        setCustomMaterials(mapped);
      } else {
        // Fallback: load from localStorage for migration
        const stored = safeGetItem<Material[]>(CUSTOM_MATERIALS_KEY, []);
        if (isValidArray(stored)) setCustomMaterials(stored);
      }
    };
    loadCustomMaterials();
  }, [user]);

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

  const handleAddMaterial = async (material: Material) => {
    // Save to database
    if (user) {
      const hardnessParts = material.hardness.replace(' HB', '').split('-');
      const { data, error } = await supabase.from("saved_materials").insert({
        user_id: user.id,
        name: material.name,
        category: material.category,
        hardness_min: hardnessParts[0] ? Number(hardnessParts[0]) : null,
        hardness_max: hardnessParts[1] ? Number(hardnessParts[1]) : null,
        cutting_speed_min: material.cuttingSpeed.min,
        cutting_speed_max: material.cuttingSpeed.max,
        feed_rate_min: material.feedRate.min,
        feed_rate_max: material.feedRate.max,
        price_per_kg: material.pricePerKg || 0,
      } as any).select().single();
      
      if (!error && data) {
        const dbMaterial: Material = { ...material, id: `custom-${(data as any).id}` };
        setCustomMaterials(prev => [...prev, dbMaterial]);
      } else {
        // Fallback to local
        const updated = [...customMaterials, material];
        setCustomMaterials(updated);
        safeSetItem(CUSTOM_MATERIALS_KEY, updated);
      }
    } else {
      const updated = [...customMaterials, material];
      setCustomMaterials(updated);
      safeSetItem(CUSTOM_MATERIALS_KEY, updated);
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    // Delete from database if it's a DB material
    if (id.startsWith("custom-")) {
      const dbId = id.replace("custom-", "");
      await supabase.from("saved_materials").delete().eq("id", dbId);
    }
    const updated = customMaterials.filter((m) => m.id !== id);
    setCustomMaterials(updated);
    safeSetItem(CUSTOM_MATERIALS_KEY, updated);
  };

  const allMaterials = [...defaultMaterials, ...customMaterials].map((m) => 
    materialPrices[m.id] !== undefined ? { ...m, pricePerKg: materialPrices[m.id] } : m
  );

  const handleTabClick = useCallback((tabId: TabId) => {
    if (!hasAccess(tabId) || tabId === visibleTab) return;
    setActiveTab(tabId);
    setIsTransitioning(true);
    setTimeout(() => {
      setVisibleTab(tabId);
      setIsTransitioning(false);
    }, 1000);
  }, [visibleTab, permissions, isAdmin]);

  const handleAdminClick = useCallback(() => {
    if (visibleTab === "admin") return;
    setActiveTab("admin");
    setIsTransitioning(true);
    setTimeout(() => {
      setVisibleTab("admin");
      setIsTransitioning(false);
    }, 1000);
  }, [visibleTab]);

  const toggleCategory = (catId: string) => {
    setOpenCategory(openCategory === catId ? null : catId);
  };

  const activeCategoryId = categories.find((c) => c.modules.some((m) => m.module_key === activeTab))?.id;

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <Header isAdmin={isAdmin} onAdminClick={handleAdminClick} adminActive={activeTab === "admin"} />
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
          {isTransitioning && (
            <div className="flex items-center justify-center py-24">
              <img src={gageLogo} alt="GAGE" className="w-16 h-16 object-contain animate-pulse-logo" />
            </div>
          )}
          <div className={isTransitioning ? "hidden" : undefined}>
            {visibleTab === "ai-learn" && <AILearningModule />}
            {visibleTab === "cutting" && hasAccess("cutting") && <CuttingCalculator customMaterials={customMaterials} />}
            {visibleTab === "toollife" && hasAccess("toollife") && <ToolLifeCalculator customMaterials={customMaterials} />}
            {visibleTab === "threading" && hasAccess("threading") && <ThreadingCalculator />}
            {visibleTab === "drilling" && hasAccess("drilling") && <DrillTapCalculator customMaterials={customMaterials} />}
            {visibleTab === "compare" && hasAccess("compare") && <ParameterComparison customMaterials={customMaterials} />}
            {visibleTab === "materials" && hasAccess("materials") && (
              <MaterialList
                customMaterials={customMaterials}
                materialPrices={materialPrices}
                afkMultipliers={afkMultipliers}
                onDeleteCustom={handleDeleteMaterial}
                isAdmin={isAdmin}
                onAddMaterial={(isAdmin || permissions["add_material"]) ? () => setShowMaterialForm(true) : undefined}
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
            {visibleTab === "cost" && hasAccess("cost") && <CostAnalyzer customMaterials={customMaterials} />}
            {visibleTab === "costcalc" && hasAccess("costcalc") && <CostCalculation customMaterials={customMaterials} materialPrices={materialPrices} />}
            {visibleTab === "afkprice" && hasAccess("afkprice") && <AFKPriceCalculator />}
            {visibleTab === "currency-tracker" && hasAccess("currency-tracker") && <CurrencyRateTracker />}
            
            {visibleTab === "coatings" && hasAccess("coatings") && <CoatingList />}
            {visibleTab === "maintenance" && hasAccess("maintenance") && <MaintenanceModule />}
            {visibleTab === "drawing" && hasAccess("drawing") && <DrawingAnalyzer />}
            {visibleTab === "tolerance" && hasAccess("tolerance") && <ToleranceGuide />}
            {visibleTab === "quiz" && hasAccess("quiz") && <QuizModule />}
            {visibleTab === "time-improvements" && hasAccess("time-improvements") && <TimeImprovements isAdmin={isAdmin} />}
            {visibleTab === "history" && hasAccess("history") && <CalculationHistory />}
            {visibleTab === "admin" && isAdmin && <AdminPanel onMenuUpdated={reloadMenu} />}
            
            {!hasAccess(visibleTab) && !ALWAYS_ACCESSIBLE.includes(visibleTab) && (
              <div className="text-center py-12">
                <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">{t("admin", "noPermission")}</p>
              </div>
            )}
          </div>
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
