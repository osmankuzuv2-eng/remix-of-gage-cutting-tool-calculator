import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Pencil, Trash2, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { iconMap, getIcon } from "@/lib/iconMap";

const ALL_MODULES = [
  "ai-learn", "drawing", "cutting", "toollife", "threading",
  "drilling", "tolerance", "costcalc", "cost", "compare", "materials", "history",
];

const COLOR_PRESETS = [
  { label: "Mor", color: "from-violet-500 to-purple-700", bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/30" },
  { label: "Turuncu", color: "from-orange-500 to-amber-700", bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30" },
  { label: "Yeşil", color: "from-emerald-500 to-green-700", bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" },
  { label: "Mavi", color: "from-sky-500 to-blue-700", bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/30" },
  { label: "Kırmızı", color: "from-rose-500 to-red-700", bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/30" },
  { label: "Sarı", color: "from-yellow-500 to-amber-600", bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/30" },
  { label: "İndigo", color: "from-indigo-500 to-indigo-800", bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/30" },
  { label: "Pembe", color: "from-pink-500 to-fuchsia-700", bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/30" },
];

interface CategoryData {
  id: string;
  name: string;
  icon: string;
  color: string;
  bg_color: string;
  text_color: string;
  border_color: string;
  sort_order: number;
  modules: { module_key: string; sort_order: number }[];
}

interface MenuManagerProps {
  onUpdated?: () => void;
  readOnly?: boolean;
}

const MenuManager = ({ onUpdated }: MenuManagerProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoryData | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formNameEn, setFormNameEn] = useState("");
  const [formNameFr, setFormNameFr] = useState("");
  const [formIcon, setFormIcon] = useState("Cpu");
  const [formColorIdx, setFormColorIdx] = useState(0);
  const [formModules, setFormModules] = useState<string[]>([]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const [catsRes, modsRes] = await Promise.all([
        supabase.from("menu_categories").select("*").order("sort_order"),
        supabase.from("menu_category_modules").select("*").order("sort_order"),
      ]);
      const mods = modsRes.data || [];
      const cats: CategoryData[] = (catsRes.data || []).map((cat) => ({
        ...cat,
        modules: mods
          .filter((m) => m.category_id === cat.id)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((m) => ({ module_key: m.module_key, sort_order: m.sort_order })),
      }));
      setCategories(cats);
    } catch (e: any) {
      toast({ title: t("common", "error"), description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCategories(); }, []);

  // Get modules already assigned to other categories (excluding current editing)
  const assignedModules = categories
    .filter((c) => c.id !== editingCat?.id)
    .flatMap((c) => c.modules.map((m) => m.module_key));

  const availableModules = ALL_MODULES.filter((m) => !assignedModules.includes(m));

  const openCreate = () => {
    setEditingCat(null);
    setFormName("");
    setFormNameEn("");
    setFormNameFr("");
    setFormIcon("Cpu");
    setFormColorIdx(0);
    setFormModules([]);
    setShowDialog(true);
  };

  const openEdit = (cat: CategoryData) => {
    setEditingCat(cat);
    setFormName(cat.name);
    setFormNameEn((cat as any).name_en || "");
    setFormNameFr((cat as any).name_fr || "");
    setFormIcon(cat.icon);
    const idx = COLOR_PRESETS.findIndex((p) => p.color === cat.color);
    setFormColorIdx(idx >= 0 ? idx : 0);
    setFormModules(cat.modules.map((m) => m.module_key));
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSubmitting(true);
    const preset = COLOR_PRESETS[formColorIdx];

    try {
      if (editingCat) {
        // Update category
        await supabase.from("menu_categories").update({
          name: formName,
          name_en: formNameEn || null,
          name_fr: formNameFr || null,
          icon: formIcon,
          color: preset.color,
          bg_color: preset.bg,
          text_color: preset.text,
          border_color: preset.border,
        }).eq("id", editingCat.id);

        // Delete old modules and re-insert
        await supabase.from("menu_category_modules").delete().eq("category_id", editingCat.id);
        if (formModules.length > 0) {
          await supabase.from("menu_category_modules").insert(
            formModules.map((mk, i) => ({ category_id: editingCat.id, module_key: mk, sort_order: i }))
          );
        }
      } else {
        // Create new category
        const maxOrder = categories.length > 0 ? Math.max(...categories.map((c) => c.sort_order)) + 1 : 0;
        const { data: newCat } = await supabase.from("menu_categories").insert({
          name: formName,
          name_en: formNameEn || null,
          name_fr: formNameFr || null,
          icon: formIcon,
          color: preset.color,
          bg_color: preset.bg,
          text_color: preset.text,
          border_color: preset.border,
          sort_order: maxOrder,
        }).select().single();

        if (newCat && formModules.length > 0) {
          await supabase.from("menu_category_modules").insert(
            formModules.map((mk, i) => ({ category_id: newCat.id, module_key: mk, sort_order: i }))
          );
        }
      }

      toast({ title: t("common", "success") });
      setShowDialog(false);
      await loadCategories();
      onUpdated?.();
    } catch (e: any) {
      toast({ title: t("common", "error"), description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (catId: string) => {
    if (!confirm("Bu kategoriyi silmek istediğinize emin misiniz?")) return;
    try {
      await supabase.from("menu_categories").delete().eq("id", catId);
      toast({ title: t("common", "success") });
      await loadCategories();
      onUpdated?.();
    } catch (e: any) {
      toast({ title: t("common", "error"), description: e.message, variant: "destructive" });
    }
  };

  const moveCategory = async (catId: string, direction: "up" | "down") => {
    const idx = categories.findIndex((c) => c.id === catId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= categories.length) return;

    try {
      await Promise.all([
        supabase.from("menu_categories").update({ sort_order: categories[swapIdx].sort_order }).eq("id", categories[idx].id),
        supabase.from("menu_categories").update({ sort_order: categories[idx].sort_order }).eq("id", categories[swapIdx].id),
      ]);
      await loadCategories();
      onUpdated?.();
    } catch (e: any) {
      toast({ title: t("common", "error"), description: e.message, variant: "destructive" });
    }
  };

  const toggleModule = (moduleKey: string) => {
    setFormModules((prev) =>
      prev.includes(moduleKey) ? prev.filter((m) => m !== moduleKey) : [...prev, moduleKey]
    );
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Menü Yönetimi</h3>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Kategori Ekle
        </Button>
      </div>

      <div className="space-y-2">
        {categories.map((cat, idx) => {
          const CatIcon = getIcon(cat.icon);
          return (
            <Card key={cat.id} className={`border ${cat.border_color} ${cat.bg_color}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-0.5">
                    <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === 0} onClick={() => moveCategory(cat.id, "up")}>
                      <ArrowUp className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === categories.length - 1} onClick={() => moveCategory(cat.id, "down")}>
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${cat.color} text-white`}>
                    <CatIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${cat.text_color}`}>{cat.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {cat.modules.map((m) => (
                        <span key={m.module_key} className={`text-xs px-1.5 py-0.5 rounded ${cat.bg_color} ${cat.text_color} border ${cat.border_color}`}>
                          {t("tabs", m.module_key)}
                        </span>
                      ))}
                      {cat.modules.length === 0 && <span className="text-xs text-muted-foreground italic">Modül atanmamış</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(cat.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCat ? "Kategori Düzenle" : "Yeni Kategori"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kategori Adı (TR)</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Türkçe ad..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>English Name</Label>
                <Input value={formNameEn} onChange={(e) => setFormNameEn(e.target.value)} placeholder="English name..." />
              </div>
              <div className="space-y-2">
                <Label>Nom Français</Label>
                <Input value={formNameFr} onChange={(e) => setFormNameFr(e.target.value)} placeholder="Nom français..." />
              </div>
            </div>

            <div className="space-y-2">
              <Label>İkon</Label>
              <Select value={formIcon} onValueChange={setFormIcon}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {Object.keys(iconMap).map((name) => {
                    const Ic = iconMap[name];
                    return (
                      <SelectItem key={name} value={name}>
                        <span className="flex items-center gap-2"><Ic className="w-4 h-4" /> {name}</span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Renk</Label>
              <div className="grid grid-cols-4 gap-2">
                {COLOR_PRESETS.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => setFormColorIdx(i)}
                    className={`h-10 rounded-lg bg-gradient-to-r ${preset.color} border-2 transition-all ${
                      formColorIdx === i ? "border-white scale-105 shadow-lg" : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <span className="text-white text-xs font-medium">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Modüller</Label>
              <div className="grid grid-cols-2 gap-2">
                {availableModules.concat(formModules.filter((m) => !availableModules.includes(m))).map((m) => {
                  const selected = formModules.includes(m);
                  const preset = COLOR_PRESETS[formColorIdx];
                  return (
                    <button
                      key={m}
                      onClick={() => toggleModule(m)}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-sm transition-all ${
                        selected
                          ? `${preset.bg} ${preset.text} ${preset.border}`
                          : "bg-card border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-sm border ${selected ? `${preset.border} bg-current` : "border-muted-foreground"}`} />
                      {t("tabs", m)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>{t("common", "cancel")}</Button>
            <Button onClick={handleSave} disabled={submitting || !formName.trim()}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {t("common", "save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MenuManager;
