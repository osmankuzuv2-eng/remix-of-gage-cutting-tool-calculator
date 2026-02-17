import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Pencil, Trash2, Cog, Monitor, Factory } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Machine } from "@/hooks/useMachines";

const MACHINE_TYPES = [
  { value: "turning", label: "CNC Torna" },
  { value: "milling-3axis", label: "3 Eksen CNC Freze" },
  { value: "milling-4axis", label: "4 Eksen CNC Freze" },
  { value: "milling-5axis", label: "5 Eksen CNC Freze" },
];

const FACTORIES = [
  { value: "Havacılık", label: "Havacılık" },
  { value: "Raylı Sistemler", label: "Raylı Sistemler" },
];

const emptyForm = {
  code: "", type: "turning", designation: "", brand: "", model: "",
  year: 0, label: "", max_diameter_mm: null as number | null,
  power_kw: null as number | null, max_rpm: 4500,
  taper: "", has_live_tooling: false, has_y_axis: false, has_c_axis: false,
  travel_x_mm: null as number | null, travel_y_mm: null as number | null,
  travel_z_mm: null as number | null, is_active: true, sort_order: 0,
  factory: "Raylı Sistemler",
};

const MachineManager = () => {
  const { toast } = useToast();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState("all");
  const [factoryFilter, setFactoryFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("machines").select("*").order("sort_order");
    if (data) setMachines(data as Machine[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, sort_order: machines.length + 1 });
    setShowDialog(true);
  };

  const openEdit = (m: Machine) => {
    setEditingId(m.id);
    setForm({
      code: m.code, type: m.type, designation: m.designation, brand: m.brand,
      model: m.model, year: m.year, label: m.label,
      max_diameter_mm: m.max_diameter_mm, power_kw: m.power_kw,
      max_rpm: m.max_rpm ?? 4500, taper: m.taper ?? "",
      has_live_tooling: m.has_live_tooling, has_y_axis: m.has_y_axis,
      has_c_axis: m.has_c_axis, travel_x_mm: m.travel_x_mm,
      travel_y_mm: m.travel_y_mm, travel_z_mm: m.travel_z_mm,
      is_active: m.is_active, sort_order: m.sort_order,
      factory: m.factory || "Raylı Sistemler",
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.brand || !form.model || !form.label) {
      toast({ title: "Hata", description: "Kod, marka, model ve etiket zorunlu.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        code: form.code, type: form.type, designation: form.designation,
        brand: form.brand, model: form.model, year: form.year, label: form.label,
        max_diameter_mm: form.max_diameter_mm, power_kw: form.power_kw,
        max_rpm: form.max_rpm, taper: form.taper || null,
        has_live_tooling: form.has_live_tooling, has_y_axis: form.has_y_axis,
        has_c_axis: form.has_c_axis, travel_x_mm: form.travel_x_mm,
        travel_y_mm: form.travel_y_mm, travel_z_mm: form.travel_z_mm,
        is_active: form.is_active, sort_order: form.sort_order,
        factory: form.factory,
      };
      if (editingId) {
        const { error } = await supabase.from("machines").update(payload).eq("id", editingId);
        if (error) throw error;
        toast({ title: "Başarılı", description: "Tezgah güncellendi." });
      } else {
        const { error } = await supabase.from("machines").insert(payload);
        if (error) throw error;
        toast({ title: "Başarılı", description: "Tezgah eklendi." });
      }
      setShowDialog(false);
      load();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu tezgahı silmek istediğinizden emin misiniz?")) return;
    const { error } = await supabase.from("machines").delete().eq("id", id);
    if (error) toast({ title: "Hata", description: error.message, variant: "destructive" });
    else { toast({ title: "Silindi" }); load(); }
  };

  const filtered = machines.filter(m => {
    if (filter !== "all" && m.type !== filter) return false;
    if (factoryFilter !== "all" && m.factory !== factoryFilter) return false;
    return true;
  });
  const typeLabel = (t: string) => MACHINE_TYPES.find(mt => mt.value === t)?.label ?? t;

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Monitor className="w-5 h-5" /> Makine Parkı Yönetimi
        </h3>
        <Button onClick={openCreate} size="sm" className="gap-1"><Plus className="w-4 h-4" /> Tezgah Ekle</Button>
      </div>

      {/* Factory Filter */}
      <div className="flex gap-2 flex-wrap">
        {[{ value: "all", label: "Tüm Fabrikalar" }, ...FACTORIES].map(f => (
          <button key={f.value} onClick={() => setFactoryFilter(f.value)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${factoryFilter === f.value ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
            {f.label} {f.value === "all" ? `(${machines.length})` : `(${machines.filter(m => m.factory === f.value).length})`}
          </button>
        ))}
      </div>

      {/* Type Filter */}
      <div className="flex gap-2 flex-wrap">
        {[{ value: "all", label: "Tümü" }, ...MACHINE_TYPES].map(t => (
          <button key={t.value} onClick={() => setFilter(t.value)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === t.value ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
            {t.label} {t.value === "all" ? `(${machines.length})` : `(${machines.filter(m => m.type === t.value).length})`}
          </button>
        ))}
      </div>

      {/* Machine List */}
      <div className="grid gap-2">
        {filtered.map(m => (
          <Card key={m.id} className={`border-border ${!m.is_active ? "opacity-50" : ""}`}>
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-primary">{m.code}</span>
                  <span className="font-medium text-foreground text-sm truncate">{m.brand} {m.model}</span>
                  {m.year > 0 && <span className="text-xs text-muted-foreground">({m.year})</span>}
                  <Badge variant="outline" className={`text-[10px] ${m.factory === "Havacılık" ? "border-primary/40 text-primary" : "border-muted-foreground/40 text-muted-foreground"}`}>
                    {m.factory}
                  </Badge>
                  {!m.is_active && <span className="text-xs text-destructive">(Pasif)</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>{typeLabel(m.type)}</span>
                  {m.max_rpm && <span>• {m.max_rpm} rpm</span>}
                  {m.power_kw && <span>• {m.power_kw} kW</span>}
                  {m.max_diameter_mm && <span>• Ø{m.max_diameter_mm}mm</span>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Tezgah Düzenle" : "Yeni Tezgah Ekle"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tezgah Kodu *</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="T109" /></div>
              <div>
                <Label>Tip *</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MACHINE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Fabrika *</Label>
              <Select value={form.factory} onValueChange={v => setForm(f => ({ ...f, factory: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FACTORIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tanım</Label><Input value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} placeholder="CNC Torna" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Marka *</Label><Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="DMG MORI" /></div>
              <div><Label>Model *</Label><Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="CLX 450" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Yıl</Label><Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))} /></div>
              <div><Label>Etiket *</Label><Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="T109 - DMG CLX 450" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Max Çap (mm)</Label><Input type="number" value={form.max_diameter_mm ?? ""} onChange={e => setForm(f => ({ ...f, max_diameter_mm: e.target.value ? Number(e.target.value) : null }))} /></div>
              <div><Label>Güç (kW)</Label><Input type="number" value={form.power_kw ?? ""} onChange={e => setForm(f => ({ ...f, power_kw: e.target.value ? Number(e.target.value) : null }))} /></div>
              <div><Label>Max RPM</Label><Input type="number" value={form.max_rpm} onChange={e => setForm(f => ({ ...f, max_rpm: Number(e.target.value) }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>X Travel (mm)</Label><Input type="number" value={form.travel_x_mm ?? ""} onChange={e => setForm(f => ({ ...f, travel_x_mm: e.target.value ? Number(e.target.value) : null }))} /></div>
              <div><Label>Y Travel (mm)</Label><Input type="number" value={form.travel_y_mm ?? ""} onChange={e => setForm(f => ({ ...f, travel_y_mm: e.target.value ? Number(e.target.value) : null }))} /></div>
              <div><Label>Z Travel (mm)</Label><Input type="number" value={form.travel_z_mm ?? ""} onChange={e => setForm(f => ({ ...f, travel_z_mm: e.target.value ? Number(e.target.value) : null }))} /></div>
            </div>
            <div><Label>Konik (Taper)</Label><Input value={form.taper} onChange={e => setForm(f => ({ ...f, taper: e.target.value }))} placeholder="BT40, HSK-A63..." /></div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.has_live_tooling} onCheckedChange={v => setForm(f => ({ ...f, has_live_tooling: v }))} />Canlı Takım</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.has_y_axis} onCheckedChange={v => setForm(f => ({ ...f, has_y_axis: v }))} />Y Ekseni</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.has_c_axis} onCheckedChange={v => setForm(f => ({ ...f, has_c_axis: v }))} />C Ekseni</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />Aktif</label>
            </div>
            <div><Label>Sıralama</Label><Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingId ? "Güncelle" : "Ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MachineManager;
