import { useState } from "react";
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
import { Loader2, Plus, Pencil, Trash2, Languages, Package } from "lucide-react";
import { useAllModules } from "@/hooks/useAllModules";
import { useModuleTranslations } from "@/hooks/useModuleTranslations";

interface ModuleManagerProps {
  onUpdated?: () => void;
  readOnly?: boolean;
}

const ModuleManager = ({ onUpdated, readOnly }: ModuleManagerProps) => {
  const { t } = useLanguage();
  const { modules, loading, reload: reloadModules } = useAllModules();
  const { translations, getModuleName, upsertTranslation, reload: reloadTranslations } = useModuleTranslations();
  const { toast } = useToast();

  // Add module dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newModuleKey, setNewModuleKey] = useState("");
  const [newNameTr, setNewNameTr] = useState("");
  const [newNameEn, setNewNameEn] = useState("");
  const [newNameFr, setNewNameFr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit translation dialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editModuleKey, setEditModuleKey] = useState("");
  const [editNameTr, setEditNameTr] = useState("");
  const [editNameEn, setEditNameEn] = useState("");
  const [editNameFr, setEditNameFr] = useState("");

  const openAdd = () => {
    setNewModuleKey("");
    setNewNameTr("");
    setNewNameEn("");
    setNewNameFr("");
    setShowAddDialog(true);
  };

  const handleAdd = async () => {
    const key = newModuleKey.trim().toLowerCase().replace(/\s+/g, "-");
    if (!key) return;
    setSubmitting(true);
    try {
      // First add a translation entry (this effectively "registers" the module)
      const error = await upsertTranslation(key, newNameTr, newNameEn, newNameFr);
      if (error) throw error;
      toast({ title: t("common", "success"), description: "Modül eklendi" });
      setShowAddDialog(false);
      await reloadModules();
      onUpdated?.();
    } catch (e: any) {
      toast({ title: t("common", "error"), description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (moduleKey: string) => {
    const trans = translations.find((t) => t.module_key === moduleKey);
    setEditModuleKey(moduleKey);
    setEditNameTr(trans?.name_tr || "");
    setEditNameEn(trans?.name_en || "");
    setEditNameFr(trans?.name_fr || "");
    setShowEditDialog(true);
  };

  const handleEditSave = async () => {
    setSubmitting(true);
    try {
      const error = await upsertTranslation(editModuleKey, editNameTr, editNameEn, editNameFr);
      if (error) throw error;
      toast({ title: t("common", "success") });
      setShowEditDialog(false);
    } catch (e: any) {
      toast({ title: t("common", "error"), description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (moduleKey: string) => {
    if (!confirm(`"${getModuleName(moduleKey)}" modülünü silmek istediğinize emin misiniz? Bu işlem modülü tüm kategorilerden de kaldırır.`)) return;
    try {
      // Remove from all categories
      await supabase.from("menu_category_modules").delete().eq("module_key", moduleKey);
      // Remove translation
      await supabase.from("module_translations").delete().eq("module_key", moduleKey);
      // Remove user permissions
      await supabase.from("user_module_permissions").delete().eq("module_key", moduleKey);
      toast({ title: t("common", "success"), description: "Modül silindi" });
      await Promise.all([reloadModules(), reloadTranslations()]);
      onUpdated?.();
    } catch (e: any) {
      toast({ title: t("common", "error"), description: e.message, variant: "destructive" });
    }
  };

  // Combine modules from DB + translations to get the full list
  const allModuleKeys = [...new Set([...modules, ...translations.map((t) => t.module_key)])].sort();

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Modül Yönetimi</h3>
        {!readOnly && (
          <Button onClick={openAdd} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" /> Modül Ekle
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {allModuleKeys.map((mk) => {
          const trans = translations.find((t) => t.module_key === mk);
          const isAssigned = modules.includes(mk);
          return (
            <Card key={mk} className="border border-border bg-card/50">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                  <Package className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{getModuleName(mk)}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{mk}</p>
                  <div className="flex gap-2 mt-0.5">
                    {trans?.name_tr && <span className="text-[10px] text-muted-foreground">🇹🇷 ✓</span>}
                    {trans?.name_en && <span className="text-[10px] text-muted-foreground">🇬🇧 ✓</span>}
                    {trans?.name_fr && <span className="text-[10px] text-muted-foreground">🇫🇷 ✓</span>}
                    {!trans?.name_tr && !trans?.name_en && !trans?.name_fr && (
                      <span className="text-[10px] text-destructive">Çeviri eksik</span>
                    )}
                    {isAssigned && (
                      <span className="text-[10px] text-primary">📂 Kategoride</span>
                    )}
                  </div>
                </div>
                {!readOnly && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(mk)} title="Çevirileri düzenle">
                      <Languages className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(mk)} title="Modülü sil">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {allModuleKeys.length === 0 && (
          <p className="text-sm text-muted-foreground italic col-span-full">Henüz modül tanımlanmamış.</p>
        )}
      </div>

      {/* Add Module Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" /> Yeni Modül Ekle
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Modül Key (benzersiz tanımlayıcı)</Label>
              <Input
                value={newModuleKey}
                onChange={(e) => setNewModuleKey(e.target.value)}
                placeholder="ör: gcode-generator"
              />
              <p className="text-[10px] text-muted-foreground">Küçük harf, tire ile ayrılmış (ör: cost-calculator)</p>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">🇹🇷 Türkçe Ad</Label>
              <Input value={newNameTr} onChange={(e) => setNewNameTr(e.target.value)} placeholder="Türkçe modül adı..." />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">🇬🇧 English Name</Label>
              <Input value={newNameEn} onChange={(e) => setNewNameEn(e.target.value)} placeholder="English module name..." />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">🇫🇷 Nom Français</Label>
              <Input value={newNameFr} onChange={(e) => setNewNameFr(e.target.value)} placeholder="Nom du module en français..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>{t("common", "cancel")}</Button>
            <Button onClick={handleAdd} disabled={submitting || !newModuleKey.trim()}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {t("common", "save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Translation Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Languages className="w-5 h-5" />
              Modül Çevirisi: <span className="font-mono text-sm text-muted-foreground">{editModuleKey}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">🇹🇷 Türkçe Ad</Label>
              <Input value={editNameTr} onChange={(e) => setEditNameTr(e.target.value)} placeholder="Türkçe modül adı..." />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">🇬🇧 English Name</Label>
              <Input value={editNameEn} onChange={(e) => setEditNameEn(e.target.value)} placeholder="English module name..." />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">🇫🇷 Nom Français</Label>
              <Input value={editNameFr} onChange={(e) => setEditNameFr(e.target.value)} placeholder="Nom du module en français..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>{t("common", "cancel")}</Button>
            <Button onClick={handleEditSave} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {t("common", "save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ModuleManager;
