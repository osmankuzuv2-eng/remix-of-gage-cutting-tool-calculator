import { useState, useRef, useMemo } from "react";
import { Wrench, Calendar, AlertTriangle, ClipboardCheck, Plus, Trash2, ChevronDown, ChevronUp, Clock, DollarSign, User, CheckCircle2, XCircle, CircleDot, Filter, Search, Camera, Image, X, ZoomIn, Upload, BarChart3, TrendingUp, Activity } from "lucide-react";
import { useMaintenance, MaintenanceRecord, MaintenanceSchedule, ChecklistItem, MaintenancePhoto } from "@/hooks/useMaintenance";
import { useMachines, Machine } from "@/hooks/useMachines";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

// ---- Sub-components ----

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    planned: { label: "Planlandı", cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    in_progress: { label: "Devam Ediyor", cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    completed: { label: "Tamamlandı", cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    cancelled: { label: "İptal", cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  };
  const s = map[status] || { label: status, cls: "bg-muted text-muted-foreground" };
  return <Badge className={`${s.cls} border text-xs`}>{s.label}</Badge>;
};

const PriorityBadge = ({ priority }: { priority: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    low: { label: "Düşük", cls: "bg-slate-500/20 text-slate-400" },
    normal: { label: "Normal", cls: "bg-blue-500/20 text-blue-400" },
    high: { label: "Yüksek", cls: "bg-orange-500/20 text-orange-400" },
    critical: { label: "Kritik", cls: "bg-red-500/20 text-red-400" },
  };
  const p = map[priority] || { label: priority, cls: "" };
  return <Badge className={`${p.cls} text-xs`}>{p.label}</Badge>;
};

const TypeBadge = ({ type }: { type: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    preventive: { label: "Önleyici", cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    predictive: { label: "Kestirici", cls: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
    corrective: { label: "Düzeltici", cls: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  };
  const t = map[type] || { label: type, cls: "" };
  return <Badge className={`${t.cls} border text-xs`}>{t.label}</Badge>;
};

// ---- Record Form Dialog ----
interface RecordFormProps {
  machines: Machine[];
  initial?: Partial<MaintenanceRecord>;
  onSave: (data: Partial<MaintenanceRecord>) => Promise<any>;
  onClose: () => void;
}

const RecordForm = ({ machines, initial, onSave, onClose }: RecordFormProps) => {
  const [form, setForm] = useState({
    machine_id: initial?.machine_id || "",
    maintenance_type: initial?.maintenance_type || "preventive",
    title: initial?.title || "",
    description: initial?.description || "",
    status: initial?.status || "planned",
    priority: initial?.priority || "normal",
    technician_name: initial?.technician_name || "",
    cost: initial?.cost || 0,
    duration_minutes: initial?.duration_minutes || 0,
    scheduled_date: initial?.scheduled_date || "",
    notes: initial?.notes || "",
  });
  const [photos, setPhotos] = useState<MaintenancePhoto[]>((initial?.photos as MaintenancePhoto[]) || []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<"before" | "after">("before");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newPhotos: MaintenancePhoto[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const filePath = `${form.machine_id || "general"}/${fileName}`;

      const { error } = await supabase.storage
        .from("maintenance-photos")
        .upload(filePath, file, { upsert: true });

      if (error) {
        toast({ title: "Yükleme hatası", description: error.message, variant: "destructive" });
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("maintenance-photos")
        .getPublicUrl(filePath);

      newPhotos.push({
        url: urlData.publicUrl,
        type: uploadType,
        caption: "",
        uploaded_at: new Date().toISOString(),
      });
    }

    setPhotos(prev => [...prev, ...newPhotos]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!form.machine_id || !form.title) {
      toast({ title: "Hata", description: "Makine ve başlık gerekli", variant: "destructive" });
      return;
    }
    setSaving(true);
    const err = await onSave({ ...form, photos } as any);
    setSaving(false);
    if (!err) {
      toast({ title: "Başarılı", description: initial ? "Kayıt güncellendi" : "Bakım kaydı oluşturuldu" });
      onClose();
    } else {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
        <h3 className="text-lg font-bold text-foreground">{initial ? "Bakım Kaydı Düzenle" : "Yeni Bakım Kaydı"}</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Makine *</label>
            <select value={form.machine_id} onChange={e => setForm(p => ({ ...p, machine_id: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground">
              <option value="">Seçin...</option>
              {machines.map(m => <option key={m.id} value={m.id}>{m.label} ({m.code})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Bakım Türü</label>
            <select value={form.maintenance_type} onChange={e => setForm(p => ({ ...p, maintenance_type: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground">
              <option value="preventive">Önleyici</option>
              <option value="predictive">Kestirici</option>
              <option value="corrective">Düzeltici</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Başlık *</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Açıklama</label>
            <textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground resize-none" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Durum</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground">
              <option value="planned">Planlandı</option>
              <option value="in_progress">Devam Ediyor</option>
              <option value="completed">Tamamlandı</option>
              <option value="cancelled">İptal</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Öncelik</label>
            <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground">
              <option value="low">Düşük</option>
              <option value="normal">Normal</option>
              <option value="high">Yüksek</option>
              <option value="critical">Kritik</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Teknisyen</label>
            <input value={form.technician_name} onChange={e => setForm(p => ({ ...p, technician_name: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Planlanan Tarih</label>
            <input type="date" value={form.scheduled_date} onChange={e => setForm(p => ({ ...p, scheduled_date: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Maliyet (€)</label>
            <input type="number" min={0} value={form.cost} onChange={e => setForm(p => ({ ...p, cost: Number(e.target.value) }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Süre (dk)</label>
            <input type="number" min={0} value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: Number(e.target.value) }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Notlar</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground resize-none" />
          </div>
        </div>

        {/* Photo Upload Section */}
        <div className="space-y-3">
          <label className="text-xs text-muted-foreground font-semibold block">Fotoğraflar (Öncesi / Sonrası)</label>
          
          <div className="flex items-center gap-2">
            <select value={uploadType} onChange={e => setUploadType(e.target.value as "before" | "after")} className="rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground">
              <option value="before">Öncesi</option>
              <option value="after">Sonrası</option>
            </select>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/20 text-primary text-sm font-medium hover:bg-primary/30 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <><Upload className="w-4 h-4 animate-pulse" /> Yükleniyor...</>
              ) : (
                <><Camera className="w-4 h-4" /> Fotoğraf Ekle</>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {photos.map((photo, idx) => (
                <div key={idx} className="relative group rounded-xl overflow-hidden border border-border aspect-video bg-background">
                  <img src={photo.url} alt={photo.caption || `Fotoğraf ${idx + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute top-1 left-1">
                    <Badge className={`text-[10px] ${photo.type === "before" ? "bg-blue-500/80 text-white" : "bg-emerald-500/80 text-white"}`}>
                      {photo.type === "before" ? "Öncesi" : "Sonrası"}
                    </Badge>
                  </div>
                  <button
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors">İptal</button>
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saving ? "Kaydediliyor..." : initial ? "Güncelle" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
};
// ---- Schedule Form Dialog ----
interface ScheduleFormProps {
  machines: Machine[];
  initial?: Partial<MaintenanceSchedule>;
  onSave: (data: Partial<MaintenanceSchedule>) => Promise<any>;
  onClose: () => void;
}

const ScheduleForm = ({ machines, initial, onSave, onClose }: ScheduleFormProps) => {
  const [form, setForm] = useState({
    machine_id: initial?.machine_id || "",
    title: initial?.title || "",
    maintenance_type: initial?.maintenance_type || "preventive",
    interval_hours: initial?.interval_hours ?? "",
    interval_days: initial?.interval_days ?? "",
    next_due_date: initial?.next_due_date || "",
    current_hours: initial?.current_hours ?? 0,
    is_active: initial?.is_active ?? true,
  });
  const [checklistItems, setChecklistItems] = useState<string[]>(
    (initial?.checklist || []).map((c) => c.item)
  );
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);

  const addChecklistItem = () => {
    if (!newItem.trim()) return;
    setChecklistItems(p => [...p, newItem.trim()]);
    setNewItem("");
  };

  const handleSubmit = async () => {
    if (!form.machine_id || !form.title) {
      toast({ title: "Hata", description: "Makine ve başlık gerekli", variant: "destructive" });
      return;
    }
    setSaving(true);
    const checklist: ChecklistItem[] = checklistItems.map(item => ({ item, checked: false }));
    const payload: any = {
      ...form,
      interval_hours: form.interval_hours ? Number(form.interval_hours) : null,
      interval_days: form.interval_days ? Number(form.interval_days) : null,
      next_due_date: form.next_due_date || null,
      checklist,
    };
    const err = await onSave(payload);
    setSaving(false);
    if (!err) {
      toast({ title: "Başarılı", description: "Bakım planı kaydedildi" });
      onClose();
    } else {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
        <h3 className="text-lg font-bold text-foreground">{initial ? "Bakım Planı Düzenle" : "Yeni Bakım Planı"}</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Makine *</label>
            <select value={form.machine_id} onChange={e => setForm(p => ({ ...p, machine_id: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground">
              <option value="">Seçin...</option>
              {machines.map(m => <option key={m.id} value={m.id}>{m.label} ({m.code})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Bakım Türü</label>
            <select value={form.maintenance_type} onChange={e => setForm(p => ({ ...p, maintenance_type: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground">
              <option value="preventive">Önleyici</option>
              <option value="predictive">Kestirici</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Başlık *</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Periyot (Saat)</label>
            <input type="number" min={0} value={form.interval_hours} onChange={e => setForm(p => ({ ...p, interval_hours: e.target.value }))} placeholder="örn. 500" className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Periyot (Gün)</label>
            <input type="number" min={0} value={form.interval_days} onChange={e => setForm(p => ({ ...p, interval_days: e.target.value }))} placeholder="örn. 90" className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Mevcut Çalışma Saati</label>
            <input type="number" min={0} value={form.current_hours} onChange={e => setForm(p => ({ ...p, current_hours: Number(e.target.value) }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Sonraki Bakım Tarihi</label>
            <input type="date" value={form.next_due_date} onChange={e => setForm(p => ({ ...p, next_due_date: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground" />
          </div>
        </div>

        {/* Checklist builder */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block font-semibold">Kontrol Listesi (Checklist)</label>
          <div className="space-y-1 mb-2">
            {checklistItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-background rounded-lg border border-border">
                <ClipboardCheck className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm text-foreground flex-1">{item}</span>
                <button onClick={() => setChecklistItems(p => p.filter((_, idx) => idx !== i))} className="text-destructive hover:text-destructive/80">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === "Enter" && addChecklistItem()} placeholder="Madde ekle (ör: Yağ kontrolü)" className="flex-1 rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground" />
            <button onClick={addChecklistItem} className="px-3 py-2 rounded-lg bg-primary/20 text-primary text-sm font-medium hover:bg-primary/30 transition-colors">Ekle</button>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors">İptal</button>
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---- Checklist Execution Dialog ----
interface ChecklistExecProps {
  schedule: MaintenanceSchedule;
  machineName: string;
  onComplete: (results: ChecklistItem[], duration: number, notes: string) => Promise<any>;
  onClose: () => void;
}

const ChecklistExec = ({ schedule, machineName, onComplete, onClose }: ChecklistExecProps) => {
  const [items, setItems] = useState<ChecklistItem[]>(
    schedule.checklist.map(c => ({ ...c, checked: false, note: "" }))
  );
  const [duration, setDuration] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const toggle = (idx: number) => {
    setItems(p => p.map((item, i) => i === idx ? { ...item, checked: !item.checked } : item));
  };

  const setNote = (idx: number, note: string) => {
    setItems(p => p.map((item, i) => i === idx ? { ...item, note } : item));
  };

  const allChecked = items.every(i => i.checked);

  const handleSubmit = async () => {
    setSaving(true);
    const err = await onComplete(items, duration, notes);
    setSaving(false);
    if (!err) {
      toast({ title: "Başarılı", description: "Bakım checklist tamamlandı" });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
        <div>
          <h3 className="text-lg font-bold text-foreground">Bakım Checklist</h3>
          <p className="text-sm text-muted-foreground">{schedule.title} — {machineName}</p>
        </div>

        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className={`p-3 rounded-xl border transition-all duration-200 ${item.checked ? "bg-emerald-500/10 border-emerald-500/30" : "bg-background border-border"}`}>
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggle(i)}>
                {item.checked ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <CircleDot className="w-5 h-5 text-muted-foreground shrink-0" />}
                <span className={`text-sm font-medium ${item.checked ? "text-emerald-400 line-through" : "text-foreground"}`}>{item.item}</span>
              </div>
              <input placeholder="Not (opsiyonel)" value={item.note || ""} onChange={e => setNote(i, e.target.value)} className="mt-2 w-full rounded-lg bg-background/50 border border-border/50 px-3 py-1.5 text-xs text-foreground" onClick={e => e.stopPropagation()} />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Süre (dk)</label>
            <input type="number" min={0} value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Tamamlanan</label>
            <div className="flex items-center h-[38px] text-sm font-mono text-primary">{items.filter(i => i.checked).length} / {items.length}</div>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Genel Not</label>
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground resize-none" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors">İptal</button>
          <button onClick={handleSubmit} disabled={saving || !allChecked} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50">
            {saving ? "Kaydediliyor..." : "Tamamla"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---- Main Module ----
const MaintenanceModule = () => {
  const { records, schedules, checklistLogs, loading, addRecord, updateRecord, deleteRecord, addSchedule, updateSchedule, deleteSchedule, completeChecklist, getAlerts } = useMaintenance();
  const { machines } = useMachines();
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<MaintenanceSchedule | null>(null);
  const [checklistSchedule, setChecklistSchedule] = useState<MaintenanceSchedule | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");

  const alerts = getAlerts();
  const getMachineName = (id: string) => machines.find(m => m.id === id)?.label || "—";

  const filteredRecords = records.filter(r => {
    if (filterType !== "all" && r.maintenance_type !== filterType) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) && !getMachineName(r.machine_id).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Dashboard data
  const dashboardData = useMemo(() => {
    const machineMap = new Map<string, { name: string; count: number; cost: number; totalDuration: number; preventive: number; predictive: number; corrective: number }>();
    
    for (const r of records) {
      const existing = machineMap.get(r.machine_id) || {
        name: getMachineName(r.machine_id),
        count: 0, cost: 0, totalDuration: 0,
        preventive: 0, predictive: 0, corrective: 0,
      };
      existing.count++;
      existing.cost += r.cost || 0;
      existing.totalDuration += r.duration_minutes || 0;
      if (r.maintenance_type === "preventive") existing.preventive++;
      else if (r.maintenance_type === "predictive") existing.predictive++;
      else existing.corrective++;
      machineMap.set(r.machine_id, existing);
    }

    const perMachine = Array.from(machineMap.values()).sort((a, b) => b.count - a.count);
    const totalCount = records.length;
    const totalCost = records.reduce((s, r) => s + (r.cost || 0), 0);
    const totalDuration = records.reduce((s, r) => s + (r.duration_minutes || 0), 0);
    const avgDuration = totalCount > 0 ? Math.round(totalDuration / totalCount) : 0;
    const completedCount = records.filter(r => r.status === "completed").length;

    const typeData = [
      { name: "Önleyici", value: records.filter(r => r.maintenance_type === "preventive").length, color: "hsl(var(--chart-1))" },
      { name: "Kestirici", value: records.filter(r => r.maintenance_type === "predictive").length, color: "hsl(var(--chart-2))" },
      { name: "Düzeltici", value: records.filter(r => r.maintenance_type === "corrective").length, color: "hsl(var(--chart-3))" },
    ].filter(d => d.value > 0);

    const statusData = [
      { name: "Planlandı", value: records.filter(r => r.status === "planned").length, color: "hsl(var(--chart-4))" },
      { name: "Devam Ediyor", value: records.filter(r => r.status === "in_progress").length, color: "hsl(var(--chart-5))" },
      { name: "Tamamlandı", value: completedCount, color: "hsl(var(--chart-1))" },
      { name: "İptal", value: records.filter(r => r.status === "cancelled").length, color: "hsl(var(--chart-3))" },
    ].filter(d => d.value > 0);

    return { perMachine, totalCount, totalCost, avgDuration, totalDuration, completedCount, typeData, statusData };
  }, [records, machines]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
          <Wrench className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Bakım Onarım</h2>
          <p className="text-xs text-muted-foreground">Önleyici ve Kestirici Bakım Yönetimi</p>
        </div>
        {alerts.length > 0 && (
          <Badge className="ml-auto bg-red-500/20 text-red-400 border-red-500/30 border animate-pulse">
            <AlertTriangle className="w-3 h-3 mr-1" />{alerts.length} Uyarı
          </Badge>
        )}
      </div>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-2">
          <h4 className="text-sm font-semibold text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Bakım Uyarıları
          </h4>
          {alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <Badge className={a.type === "overdue" ? "bg-red-500/30 text-red-300" : "bg-yellow-500/30 text-yellow-300"}>
                {a.type === "overdue" ? "Gecikmiş" : a.type === "hours_warning" ? "Saat Uyarısı" : "Yaklaşıyor"}
              </Badge>
              <span className="text-foreground font-medium">{a.schedule.title}</span>
              <span className="text-muted-foreground">— {getMachineName(a.schedule.machine_id)}</span>
              {a.schedule.next_due_date && <span className="text-xs text-muted-foreground ml-auto">{new Date(a.schedule.next_due_date).toLocaleDateString("tr-TR")}</span>}
            </div>
          ))}
        </div>
      )}

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-lg bg-background border border-border">
          <TabsTrigger value="dashboard" className="text-xs">Dashboard</TabsTrigger>
          <TabsTrigger value="records" className="text-xs">Bakım Kayıtları</TabsTrigger>
          <TabsTrigger value="schedules" className="text-xs">Bakım Planları</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs">Checklist Geçmişi</TabsTrigger>
        </TabsList>

        {/* ---- Dashboard Tab ---- */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xs text-muted-foreground">Toplam Bakım</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{dashboardData.totalCount}</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-accent-foreground" />
                </div>
                <span className="text-xs text-muted-foreground">Toplam Maliyet</span>
              </div>
              <p className="text-2xl font-bold text-foreground">€{dashboardData.totalCost.toLocaleString("tr-TR")}</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-secondary-foreground" />
                </div>
                <span className="text-xs text-muted-foreground">Ort. Arıza Süresi</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{dashboardData.avgDuration} <span className="text-sm font-normal text-muted-foreground">dk</span></p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-foreground" />
                </div>
                <span className="text-xs text-muted-foreground">Tamamlanan</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{dashboardData.completedCount}</p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Type Distribution Pie */}
            {dashboardData.typeData.length > 0 && (
              <div className="p-4 rounded-xl bg-card border border-border">
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Bakım Türü Dağılımı
                </h4>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={dashboardData.typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {dashboardData.typeData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend />
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Status Distribution Pie */}
            {dashboardData.statusData.length > 0 && (
              <div className="p-4 rounded-xl bg-card border border-border">
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Durum Dağılımı
                </h4>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={dashboardData.statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {dashboardData.statusData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend />
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Per-Machine Bar Chart */}
          {dashboardData.perMachine.length > 0 && (
            <div className="p-4 rounded-xl bg-card border border-border">
              <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" /> Makine Bazlı Bakım Sayısı & Maliyet
              </h4>
              <ResponsiveContainer width="100%" height={Math.max(250, dashboardData.perMachine.length * 40)}>
                <BarChart data={dashboardData.perMachine} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }}
                    formatter={(value: number, name: string) => [name === "cost" ? `€${value}` : `${value}`, name === "cost" ? "Maliyet" : name === "count" ? "Bakım Sayısı" : "Süre (dk)"]}
                  />
                  <Legend formatter={(value) => value === "count" ? "Bakım Sayısı" : value === "cost" ? "Maliyet (€)" : "Süre (dk)"} />
                  <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} name="count" />
                  <Bar dataKey="cost" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} name="cost" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Per-Machine Detail Table */}
          {dashboardData.perMachine.length > 0 && (
            <div className="p-4 rounded-xl bg-card border border-border overflow-x-auto">
              <h4 className="text-sm font-semibold text-foreground mb-3">Makine Özet Tablosu</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Makine</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">Toplam</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">Önleyici</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">Kestirici</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">Düzeltici</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Maliyet</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Ort. Süre</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.perMachine.map((m, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 font-medium text-foreground">{m.name}</td>
                      <td className="py-2 px-3 text-center text-foreground">{m.count}</td>
                      <td className="py-2 px-3 text-center text-foreground">{m.preventive}</td>
                      <td className="py-2 px-3 text-center text-foreground">{m.predictive}</td>
                      <td className="py-2 px-3 text-center text-foreground">{m.corrective}</td>
                      <td className="py-2 px-3 text-right text-foreground">€{m.cost.toLocaleString("tr-TR")}</td>
                      <td className="py-2 px-3 text-right text-foreground">{m.count > 0 ? Math.round(m.totalDuration / m.count) : 0} dk</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {dashboardData.totalCount === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Henüz bakım kaydı yok. Dashboard verisi bakım kayıtları oluştukça dolacaktır.</p>
            </div>
          )}
        </TabsContent>

        {/* ---- Records Tab ---- */}
        <TabsContent value="records" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara..." className="w-full rounded-lg bg-background border border-border pl-9 pr-3 py-2 text-sm text-foreground" />
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground">
              <option value="all">Tümü</option>
              <option value="preventive">Önleyici</option>
              <option value="predictive">Kestirici</option>
              <option value="corrective">Düzeltici</option>
            </select>
            <button onClick={() => { setEditingRecord(null); setShowRecordForm(true); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Yeni Kayıt
            </button>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wrench className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Henüz bakım kaydı yok.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecords.map(r => (
                <div key={r.id} className="p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all duration-200">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-foreground">{r.title}</span>
                        <TypeBadge type={r.maintenance_type} />
                        <StatusBadge status={r.status} />
                        <PriorityBadge priority={r.priority} />
                      </div>
                      <p className="text-sm text-muted-foreground">{getMachineName(r.machine_id)}</p>
                      {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                      
                      {/* Photo thumbnails */}
                      {r.photos && (r.photos as MaintenancePhoto[]).length > 0 && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {(r.photos as MaintenancePhoto[]).map((photo, pi) => (
                            <button
                              key={pi}
                              onClick={() => setLightboxPhoto(photo.url)}
                              className="relative w-14 h-14 rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-all group"
                            >
                              <img src={photo.url} alt="" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              <div className="absolute bottom-0 left-0 right-0">
                                <div className={`text-[8px] text-center text-white font-medium py-0.5 ${photo.type === "before" ? "bg-blue-500/80" : "bg-emerald-500/80"}`}>
                                  {photo.type === "before" ? "Önce" : "Sonra"}
                                </div>
                              </div>
                            </button>
                          ))}
                          <span className="flex items-center text-xs text-muted-foreground gap-1">
                            <Image className="w-3 h-3" />{(r.photos as MaintenancePhoto[]).length}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {r.technician_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{r.technician_name}</span>}
                        {r.cost > 0 && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />€{r.cost}</span>}
                        {r.duration_minutes > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{r.duration_minutes} dk</span>}
                        {r.scheduled_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(r.scheduled_date).toLocaleDateString("tr-TR")}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setEditingRecord(r); setShowRecordForm(true); }} className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                        <Wrench className="w-4 h-4" />
                      </button>
                      <button onClick={async () => { if (confirm("Bu kaydı silmek istediğinize emin misiniz?")) await deleteRecord(r.id); }} className="p-2 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---- Schedules Tab ---- */}
        <TabsContent value="schedules" className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setEditingSchedule(null); setShowScheduleForm(true); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Yeni Plan
            </button>
          </div>

          {schedules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Henüz bakım planı yok.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {schedules.map(s => {
                const isOverdue = s.next_due_date && new Date(s.next_due_date) < new Date();
                const hoursPercent = s.interval_hours ? Math.min(100, ((s.current_hours - s.last_performed_hours) / s.interval_hours) * 100) : null;

                return (
                  <div key={s.id} className={`p-4 rounded-xl border transition-all duration-200 ${isOverdue ? "bg-red-500/5 border-red-500/30" : "bg-card border-border hover:border-primary/30"}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="font-semibold text-foreground">{s.title}</span>
                        <TypeBadge type={s.maintenance_type} />
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setChecklistSchedule(s)} className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors" title="Checklist Uygula">
                          <ClipboardCheck className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setEditingSchedule(s); setShowScheduleForm(true); }} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors">
                          <Wrench className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={async () => { if (confirm("Bu planı silmek istediğinize emin misiniz?")) await deleteSchedule(s.id); }} className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground mb-2">{getMachineName(s.machine_id)}</p>

                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      {s.interval_days && <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Her {s.interval_days} günde bir</div>}
                      {s.interval_hours && <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> Her {s.interval_hours} saatte bir</div>}
                      {s.next_due_date && (
                        <div className={`flex items-center gap-1 font-medium ${isOverdue ? "text-red-400" : ""}`}>
                          <Calendar className="w-3 h-3" /> Sonraki: {new Date(s.next_due_date).toLocaleDateString("tr-TR")}
                          {isOverdue && <span className="text-red-400 ml-1">(Gecikmiş!)</span>}
                        </div>
                      )}
                      {s.last_performed_at && <div>Son bakım: {new Date(s.last_performed_at).toLocaleDateString("tr-TR")}</div>}
                    </div>

                    {/* Hours progress bar */}
                    {hoursPercent !== null && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Çalışma saati</span>
                          <span>{Math.round(s.current_hours - s.last_performed_hours)} / {s.interval_hours} saat</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${hoursPercent >= 100 ? "bg-red-500" : hoursPercent >= 90 ? "bg-yellow-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, hoursPercent)}%` }} />
                        </div>
                      </div>
                    )}

                    {/* Checklist preview */}
                    {s.checklist.length > 0 && (
                      <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                        <ClipboardCheck className="w-3 h-3" />
                        {s.checklist.length} kontrol maddesi
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ---- Checklist Logs Tab ---- */}
        <TabsContent value="logs" className="space-y-4">
          {checklistLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Henüz tamamlanan checklist yok.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {checklistLogs.map(log => (
                <div key={log.id} className="p-4 rounded-xl bg-card border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-foreground text-sm">{getMachineName(log.machine_id)}</span>
                    <span className="text-xs text-muted-foreground">{new Date(log.completion_date).toLocaleString("tr-TR")}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{log.completed_by_name}</span>
                    {log.duration_minutes > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{log.duration_minutes} dk</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {(log.checklist_results || []).map((item: ChecklistItem, i: number) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        {item.checked ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <XCircle className="w-3 h-3 text-red-400" />}
                        <span className={item.checked ? "text-foreground" : "text-red-400"}>{item.item}</span>
                      </div>
                    ))}
                  </div>
                  {log.notes && <p className="mt-2 text-xs text-muted-foreground italic">{log.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {showRecordForm && (
        <RecordForm
          machines={machines}
          initial={editingRecord || undefined}
          onSave={editingRecord ? (data) => updateRecord(editingRecord.id, data) : addRecord}
          onClose={() => { setShowRecordForm(false); setEditingRecord(null); }}
        />
      )}
      {showScheduleForm && (
        <ScheduleForm
          machines={machines}
          initial={editingSchedule || undefined}
          onSave={editingSchedule ? (data) => updateSchedule(editingSchedule.id, data) : addSchedule}
          onClose={() => { setShowScheduleForm(false); setEditingSchedule(null); }}
        />
      )}
      {checklistSchedule && (
        <ChecklistExec
          schedule={checklistSchedule}
          machineName={getMachineName(checklistSchedule.machine_id)}
          onComplete={(results, duration, notes) => completeChecklist(checklistSchedule.id, checklistSchedule.machine_id, results, duration, notes)}
          onClose={() => setChecklistSchedule(null)}
        />
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setLightboxPhoto(null)}>
          <button onClick={() => setLightboxPhoto(null)} className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors">
            <X className="w-6 h-6" />
          </button>
          <img src={lightboxPhoto} alt="Bakım fotoğrafı" className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};

export default MaintenanceModule;
