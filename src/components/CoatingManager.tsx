import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCoatings, type Coating } from "@/hooks/useCoatings";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CoatingManagerProps {
  readOnly?: boolean;
}

const CoatingManager = ({ readOnly = false }: CoatingManagerProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { coatings, reload } = useCoatings();

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Coating | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setPrice(0);
    setIsActive(true);
    setSortOrder(coatings.length);
    setShowDialog(true);
  };

  const openEdit = (c: Coating) => {
    setEditing(c);
    setName(c.name);
    setDescription(c.description || "");
    setPrice(c.price);
    setIsActive(c.is_active);
    setSortOrder(c.sort_order);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("coatings" as any)
          .update({ name: name.trim(), description: description.trim() || null, price, is_active: isActive, sort_order: sortOrder } as any)
          .eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Başarılı", description: "Kaplama güncellendi" });
      } else {
        const { error } = await supabase
          .from("coatings" as any)
          .insert({ name: name.trim(), description: description.trim() || null, price, is_active: isActive, sort_order: sortOrder } as any);
        if (error) throw error;
        toast({ title: "Başarılı", description: "Kaplama eklendi" });
      }
      setShowDialog(false);
      reload();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu kaplamayı silmek istediğinize emin misiniz?")) return;
    try {
      const { error } = await supabase.from("coatings" as any).delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Başarılı", description: "Kaplama silindi" });
      reload();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" /> Kaplama Yönetimi
        </h3>
        {!readOnly && (
          <Button onClick={openCreate} size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> Yeni Kaplama
          </Button>
        )}
      </div>

      <div className="grid gap-3">
        {coatings.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 border border-border">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{c.name}</span>
                {!c.is_active && <Badge variant="secondary">Pasif</Badge>}
                <Badge className="bg-primary/20 text-primary border-primary/30">€{c.price}</Badge>
              </div>
              {c.description && (
                <p className="text-xs text-muted-foreground mt-1">{c.description}</p>
              )}
            </div>
            {!readOnly && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} className="text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
        {coatings.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Henüz kaplama eklenmemiş.</p>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Kaplama Düzenle" : "Yeni Kaplama Ekle"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Kaplama Adı</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sert Krom Kaplama" />
            </div>
            <div>
              <Label>Açıklama</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Kaplama özellikleri..." rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fiyat (€)</Label>
                <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
              </div>
              <div>
                <Label>Sıralama</Label>
                <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Aktif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={submitting || !name.trim()}>
              {submitting ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CoatingManager;
