import { useState } from "react";
import { Database, Search, ChevronDown, ChevronUp, Trash2, Pencil, Check, X, Plus } from "lucide-react";
import PriceHistoryTooltip from "@/components/PriceHistoryTooltip";
import { materials as defaultMaterials, Material } from "@/data/materials";
import { getCategoryStyle } from "@/data/categoryStyles";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

interface MaterialListProps {
  customMaterials: Material[];
  onDeleteCustom: (id: string) => void;
  isAdmin?: boolean;
  onAddMaterial?: () => void;
  onUpdatePrice?: (id: string, price: number) => void;
  materialPrices?: Record<string, number>;
  afkMultipliers?: Record<string, number>;
  onUpdateAfkMultiplier?: (id: string, multiplier: number) => void;
}

const MaterialList = ({ customMaterials, onDeleteCustom, isAdmin, onAddMaterial, onUpdatePrice, materialPrices = {}, afkMultipliers = {}, onUpdateAfkMultiplier }: MaterialListProps) => {
  const { t } = useLanguage();
  const allMaterials = [...defaultMaterials, ...customMaterials].map((m) =>
    materialPrices[m.id] !== undefined ? { ...m, pricePerKg: materialPrices[m.id] } : m
  );

  const getMaterialName = (m: Material) => { const tr = t("materialNames", m.id); return tr !== m.id ? tr : m.name; };
  const getCategoryName = (cat: string) => { const tr = t("materialCategories", cat); return tr !== cat ? tr : cat; };
  
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<"name" | "category" | "hardness">("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState("");
  const [editingAfkId, setEditingAfkId] = useState<string | null>(null);
  const [editAfkValue, setEditAfkValue] = useState("");

  const filteredMaterials = allMaterials
    .filter((m) => {
      const name = (() => { const tr = t("materialNames", m.id); return tr !== m.id ? tr : m.name; })().toLowerCase();
      const cat = (() => { const tr = t("materialCategories", m.category); return tr !== m.category ? tr : m.category; })().toLowerCase();
      const term = searchTerm.toLowerCase();
      return name.includes(term) || cat.includes(term) || m.name.toLowerCase().includes(term);
    })
    .sort((a, b) => {
      const comparison = a[sortField].localeCompare(b[sortField]);
      return sortAsc ? comparison : -comparison;
    });

  const toggleSort = (field: "name" | "category" | "hardness") => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const isCustom = (id: string) => id.startsWith("custom-");

  return (
    <div className="industrial-card p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/20">
            <Database className="w-5 h-5 text-success" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{t("materialList", "title")}</h2>
          <span className="px-2 py-0.5 rounded-full bg-secondary text-xs text-muted-foreground">
            {allMaterials.length} {t("materialList", "materials")}
          </span>
          {customMaterials.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-success/20 text-xs text-success">
              +{customMaterials.length} {t("common", "custom")}
            </span>
          )}
        </div>
        {onAddMaterial && (
          <button
            onClick={onAddMaterial}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-success/10 text-success border border-success/30 hover:bg-success/20 hover:scale-[1.03] hover:shadow-md active:scale-[0.97] transition-all duration-300 group"
          >
            <Plus className="w-4 h-4 transition-transform duration-300 group-hover:rotate-90" />
            {t("footer", "addMaterial")}
          </button>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder={t("materialList", "searchMaterial")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-industrial w-full pl-10"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-2 label-industrial cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort("name")}>
                <div className="flex items-center gap-1">{t("common", "material")}<SortIcon active={sortField === "name"} asc={sortAsc} /></div>
              </th>
              <th className="text-left py-3 px-2 label-industrial cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort("category")}>
                <div className="flex items-center gap-1">{t("materialList", "category")}<SortIcon active={sortField === "category"} asc={sortAsc} /></div>
              </th>
              <th className="text-left py-3 px-2 label-industrial cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort("hardness")}>
                <div className="flex items-center gap-1">{t("materialList", "hardness")}<SortIcon active={sortField === "hardness"} asc={sortAsc} /></div>
              </th>
              <th className="text-left py-3 px-2 label-industrial">{t("common", "cuttingSpeed")}</th>
              <th className="text-left py-3 px-2 label-industrial">{t("common", "feedRate")}</th>
              <th className="text-left py-3 px-2 label-industrial">{t("materialForm", "pricePerKg")}</th>
              <th className="text-left py-3 px-2 label-industrial">{t("materialList", "afkMultiplier")}</th>
              <th className="py-3 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {filteredMaterials.map((material) => {
              const categoryStyle = getCategoryStyle(material.category);
              const CategoryIcon = categoryStyle.icon;
              return (
              <>
                <tr key={material.id} className={`border-b border-border/50 hover:${categoryStyle.bgColor} transition-colors cursor-pointer`} onClick={() => setExpandedId(expandedId === material.id ? null : material.id)}>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${categoryStyle.gradient} flex items-center justify-center`}>
                        <CategoryIcon className="w-4 h-4 text-white" />
                      </div>
                      <span className="font-medium text-foreground">{getMaterialName(material)}</span>
                      {isCustom(material.id) && <span className="px-1.5 py-0.5 rounded text-[10px] bg-success/20 text-success">{t("common", "custom")}</span>}
                    </div>
                  </td>
                   <td className="py-3 px-2">
                     <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border ${categoryStyle.badgeClass}`}>
                       <CategoryIcon className="w-3 h-3" />{getCategoryName(material.category)}
                     </span>
                   </td>
                  <td className="py-3 px-2"><span className="font-mono text-sm text-accent">{material.hardness}</span></td>
                  <td className="py-3 px-2">
                    <span className="font-mono text-sm text-foreground">{material.cuttingSpeed.min}-{material.cuttingSpeed.max}</span>
                    <span className="text-xs text-muted-foreground ml-1">{material.cuttingSpeed.unit}</span>
                  </td>
                  <td className="py-3 px-2">
                    <span className="font-mono text-sm text-foreground">{material.feedRate.min}-{material.feedRate.max}</span>
                    <span className="text-xs text-muted-foreground ml-1">{material.feedRate.unit}</span>
                  </td>
                  <td className="py-3 px-2" onClick={(e) => e.stopPropagation()}>
                    {editingPriceId === material.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editPriceValue}
                          onChange={(e) => setEditPriceValue(e.target.value)}
                          className="input-industrial w-20 text-sm py-1 px-2"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              onUpdatePrice?.(material.id, Number(editPriceValue));
                              setEditingPriceId(null);
                            } else if (e.key === "Escape") {
                              setEditingPriceId(null);
                            }
                          }}
                        />
                        <button onClick={() => { onUpdatePrice?.(material.id, Number(editPriceValue)); setEditingPriceId(null); }} className="p-1 rounded hover:bg-success/20 text-success"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditingPriceId(null)} className="p-1 rounded hover:bg-destructive/20 text-destructive"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 group/price">
                        {material.pricePerKg ? (
                          <span className="font-mono text-sm text-foreground">{material.pricePerKg} <span className="text-xs text-muted-foreground">EUR/kg</span></span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                        <PriceHistoryTooltip materialId={material.id} />
                        {isAdmin && (
                          <button
                            onClick={() => { setEditingPriceId(material.id); setEditPriceValue(String(material.pricePerKg || 0)); }}
                            className="p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary opacity-0 group-hover/price:opacity-100 transition-opacity"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-2" onClick={(e) => e.stopPropagation()}>
                    {editingAfkId === material.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editAfkValue}
                          onChange={(e) => setEditAfkValue(e.target.value)}
                          className="input-industrial w-20 text-sm py-1 px-2"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              onUpdateAfkMultiplier?.(material.id, Number(editAfkValue));
                              setEditingAfkId(null);
                            } else if (e.key === "Escape") {
                              setEditingAfkId(null);
                            }
                          }}
                        />
                        <button onClick={() => { onUpdateAfkMultiplier?.(material.id, Number(editAfkValue)); setEditingAfkId(null); }} className="p-1 rounded hover:bg-success/20 text-success"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditingAfkId(null)} className="p-1 rounded hover:bg-destructive/20 text-destructive"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 group/afk">
                        <span className="font-mono text-sm text-foreground">{afkMultipliers[material.id] ?? 1.0}</span>
                        {isAdmin && (
                          <button
                            onClick={() => { setEditingAfkId(material.id); setEditAfkValue(String(afkMultipliers[material.id] ?? 1.0)); }}
                            className="p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary opacity-0 group-hover/afk:opacity-100 transition-opacity"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    {expandedId === material.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </td>
                </tr>
                {expandedId === material.id && (
                  <tr key={`${material.id}-expanded`}>
                    <td colSpan={8} className={`py-4 px-4 ${categoryStyle.bgColor} border-l-2 ${categoryStyle.borderColor}`}>
                      <div className="grid md:grid-cols-4 gap-4">
                        <div className={`p-3 rounded-lg bg-card border ${categoryStyle.borderColor}`}>
                          <span className="label-industrial text-xs">{t("materialList", "taylorN")}</span>
                          <div className={`font-mono text-xl ${categoryStyle.textColor} mt-1`}>{material.taylorN}</div>
                        </div>
                        <div className={`p-3 rounded-lg bg-card border ${categoryStyle.borderColor}`}>
                          <span className="label-industrial text-xs">{t("materialList", "taylorC")}</span>
                          <div className={`font-mono text-xl ${categoryStyle.textColor} mt-1`}>{material.taylorC}</div>
                        </div>
                        <div className={`p-3 rounded-lg bg-card border ${categoryStyle.borderColor}`}>
                          <span className="label-industrial text-xs">{t("materialList", "recommendedProcess")}</span>
                          <div className="text-sm text-foreground mt-1">
                            {material.category === "Hafif Metal" ? t("materialList", "highSpeedHighFeed")
                              : material.category === "Süper Alaşım" ? t("materialList", "lowSpeedLowDepth")
                              : t("materialList", "standardParams")}
                          </div>
                        </div>
                        {isCustom(material.id) && (
                          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                            <span className="label-industrial text-xs">{t("materialList", "operation")}</span>
                            <button onClick={(e) => { e.stopPropagation(); onDeleteCustom(material.id); setExpandedId(null); }}
                              className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground hover:brightness-110 transition-all text-sm">
                              <Trash2 className="w-4 h-4" />{t("common", "delete")}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );})}
          </tbody>
        </table>
      </div>

      {filteredMaterials.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">{t("materialList", "noResults")}</div>
      )}
    </div>
  );
};

const SortIcon = ({ active, asc }: { active: boolean; asc: boolean }) => (
  <div className={`transition-opacity ${active ? "opacity-100" : "opacity-30"}`}>
    {asc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
  </div>
);

export default MaterialList;
