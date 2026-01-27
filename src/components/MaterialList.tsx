import { useState } from "react";
import { Database, Search, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { materials as defaultMaterials, Material } from "@/data/materials";
import { getCategoryStyle } from "@/data/categoryStyles";

interface MaterialListProps {
  customMaterials: Material[];
  onDeleteCustom: (id: string) => void;
}

const MaterialList = ({ customMaterials, onDeleteCustom }: MaterialListProps) => {
  const allMaterials = [...defaultMaterials, ...customMaterials];
  
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<"name" | "category" | "hardness">("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredMaterials = allMaterials
    .filter(
      (m) =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.category.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const comparison = aVal.localeCompare(bVal);
      return sortAsc ? comparison : -comparison;
    });

  const toggleSort = (field: "name" | "category" | "hardness") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const isCustom = (id: string) => id.startsWith("custom-");

  return (
    <div className="industrial-card p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/20">
            <Database className="w-5 h-5 text-success" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Malzeme Veritabanı
          </h2>
          <span className="px-2 py-0.5 rounded-full bg-secondary text-xs text-muted-foreground">
            {allMaterials.length} malzeme
          </span>
          {customMaterials.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-success/20 text-xs text-success">
              +{customMaterials.length} özel
            </span>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Malzeme ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-industrial w-full pl-10"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th
                className="text-left py-3 px-2 label-industrial cursor-pointer hover:text-foreground transition-colors"
                onClick={() => toggleSort("name")}
              >
                <div className="flex items-center gap-1">
                  Malzeme
                  <SortIcon active={sortField === "name"} asc={sortAsc} />
                </div>
              </th>
              <th
                className="text-left py-3 px-2 label-industrial cursor-pointer hover:text-foreground transition-colors"
                onClick={() => toggleSort("category")}
              >
                <div className="flex items-center gap-1">
                  Kategori
                  <SortIcon active={sortField === "category"} asc={sortAsc} />
                </div>
              </th>
              <th
                className="text-left py-3 px-2 label-industrial cursor-pointer hover:text-foreground transition-colors"
                onClick={() => toggleSort("hardness")}
              >
                <div className="flex items-center gap-1">
                  Sertlik
                  <SortIcon active={sortField === "hardness"} asc={sortAsc} />
                </div>
              </th>
              <th className="text-left py-3 px-2 label-industrial">Kesme Hızı</th>
              <th className="text-left py-3 px-2 label-industrial">İlerleme</th>
              <th className="py-3 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {filteredMaterials.map((material) => {
              const categoryStyle = getCategoryStyle(material.category);
              const CategoryIcon = categoryStyle.icon;
              
              return (
              <>
                <tr
                  key={material.id}
                  className={`border-b border-border/50 hover:${categoryStyle.bgColor} transition-colors cursor-pointer`}
                  onClick={() =>
                    setExpandedId(expandedId === material.id ? null : material.id)
                  }
                >
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${categoryStyle.gradient} flex items-center justify-center`}>
                        <CategoryIcon className="w-4 h-4 text-white" />
                      </div>
                      <span className="font-medium text-foreground">{material.name}</span>
                      {isCustom(material.id) && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-success/20 text-success">
                          Özel
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border ${categoryStyle.badgeClass}`}>
                      <CategoryIcon className="w-3 h-3" />
                      {material.category}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <span className="font-mono text-sm text-accent">
                      {material.hardness}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <span className="font-mono text-sm text-foreground">
                      {material.cuttingSpeed.min}-{material.cuttingSpeed.max}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      {material.cuttingSpeed.unit}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <span className="font-mono text-sm text-foreground">
                      {material.feedRate.min}-{material.feedRate.max}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      {material.feedRate.unit}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    {expandedId === material.id ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </td>
                </tr>
                {expandedId === material.id && (
                  <tr key={`${material.id}-expanded`}>
                    <td colSpan={6} className={`py-4 px-4 ${categoryStyle.bgColor} border-l-2 ${categoryStyle.borderColor}`}>
                      <div className="grid md:grid-cols-4 gap-4">
                        <div className={`p-3 rounded-lg bg-card border ${categoryStyle.borderColor}`}>
                          <span className="label-industrial text-xs">Taylor n Sabiti</span>
                          <div className={`font-mono text-xl ${categoryStyle.textColor} mt-1`}>
                            {material.taylorN}
                          </div>
                        </div>
                        <div className={`p-3 rounded-lg bg-card border ${categoryStyle.borderColor}`}>
                          <span className="label-industrial text-xs">Taylor C Sabiti</span>
                          <div className={`font-mono text-xl ${categoryStyle.textColor} mt-1`}>
                            {material.taylorC}
                          </div>
                        </div>
                        <div className={`p-3 rounded-lg bg-card border ${categoryStyle.borderColor}`}>
                          <span className="label-industrial text-xs">Önerilen İşlem</span>
                          <div className="text-sm text-foreground mt-1">
                            {material.category === "Hafif Metal"
                              ? "Yüksek hız, büyük ilerleme"
                              : material.category === "Süper Alaşım"
                              ? "Düşük hız, küçük kesme derinliği"
                              : "Standart parametreler"}
                          </div>
                        </div>
                        {isCustom(material.id) && (
                          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                            <span className="label-industrial text-xs">İşlem</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteCustom(material.id);
                                setExpandedId(null);
                              }}
                              className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground hover:brightness-110 transition-all text-sm"
                            >
                              <Trash2 className="w-4 h-4" />
                              Sil
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
        <div className="text-center py-8 text-muted-foreground">
          Aramanızla eşleşen malzeme bulunamadı.
        </div>
      )}
    </div>
  );
};

const SortIcon = ({ active, asc }: { active: boolean; asc: boolean }) => (
  <div className={`transition-opacity ${active ? "opacity-100" : "opacity-30"}`}>
    {asc ? (
      <ChevronUp className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3" />
    )}
  </div>
);

export default MaterialList;
