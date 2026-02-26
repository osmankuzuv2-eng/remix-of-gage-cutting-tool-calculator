import { useState, useRef, useMemo } from "react";
import { Wrench, Calendar, AlertTriangle, ClipboardCheck, Plus, Trash2, ChevronDown, ChevronUp, Clock, DollarSign, User, CheckCircle2, XCircle, CircleDot, Filter, Search, Camera, Image, X, ZoomIn, Upload, BarChart3, TrendingUp, Activity, Download, FileSpreadsheet, FileText, Building2 } from "lucide-react";
import { useMaintenance, MaintenanceRecord, MaintenanceSchedule, ChecklistItem, MaintenancePhoto } from "@/hooks/useMaintenance";
import { useMachines, Machine } from "@/hooks/useMachines";
import { useFactories } from "@/hooks/useFactories";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { exportMaintenancePdf } from "@/lib/exportMaintenancePdf";
import { exportMaintenanceExcel } from "@/lib/exportMaintenanceExcel";

// ---- Sub-components ----

const StatusBadge = ({ status }: { status: string }) => {
  const { t } = useLanguage();
  const map: Record<string, { label: string; cls: string }> = {
    planned: { label: t("maintenance", "planned"), cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    in_progress: { label: t("maintenance", "inProgress"), cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    completed: { label: t("maintenance", "completed"), cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    cancelled: { label: t("maintenance", "cancelled"), cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  };
  const s = map[status] || { label: status, cls: "bg-muted text-muted-foreground" };
  return <Badge className={`${s.cls} border text-xs`}>{s.label}</Badge>;
};

const PriorityBadge = ({ priority }: { priority: string }) => {
  const { t } = useLanguage();
  const map: Record<string, { label: string; cls: string }> = {
    low: { label: t("maintenance", "low"), cls: "bg-slate-500/20 text-slate-400" },
    normal: { label: t("maintenance", "normal"), cls: "bg-blue-500/20 text-blue-400" },
    high: { label: t("maintenance", "high"), cls: "bg-orange-500/20 text-orange-400" },
    critical: { label: t("maintenance", "critical"), cls: "bg-red-500/20 text-red-400" },
  };
  const p = map[priority] || { label: priority, cls: "" };
  return <Badge className={`${p.cls} text-xs`}>{p.label}</Badge>;
};

const TypeBadge = ({ type }: { type: string }) => {
  const { t } = useLanguage();
  const map: Record<string, { label: string; cls: string }> = {
    planned_maintenance: { label: t("maintenance", "planned_maintenance"), cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    unplanned_failure: { label: t("maintenance", "unplanned_failure"), cls: "bg-red-500/20 text-red-400 border-red-500/30" },
    revision: { label: t("maintenance", "revision"), cls: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
    service: { label: t("maintenance", "service"), cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    // legacy
    preventive: { label: t("maintenance", "preventive"), cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    predictive: { label: t("maintenance", "predictive"), cls: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
    corrective: { label: t("maintenance", "corrective"), cls: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  };
  const mt = map[type] || { label: type, cls: "" };
  return <Badge className={`${mt.cls} border text-xs`}>{mt.label}</Badge>;
};

// ---- Record Form Dialog ----
interface RecordFormProps {
  machines: Machine[];
  initial?: Partial<MaintenanceRecord>;
  onSave: (data: Partial<MaintenanceRecord>) => Promise<any>;
  onClose: () => void;
  selectedFactory?: string;
}

const RecordForm = ({ machines, initial, onSave, onClose, selectedFactory }: RecordFormProps) => {
  const { t } = useLanguage();
  
  // Filter machines by selected factory + always include Yardımcı Tesisler
  const filteredMachines = useMemo(() => {
    if (!selectedFactory || selectedFactory === "all") return machines;
    return machines.filter(m => m.factory === selectedFactory);
  }, [machines, selectedFactory]);

  const [form, setForm] = useState({
    machine_id: initial?.machine_id || "",
    maintenance_type: initial?.maintenance_type || "planned_maintenance",
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
        toast({ title: t("maintenance", "uploadError"), description: error.message, variant: "destructive" });
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
    if (!form.machine_id && form.machine_id !== "yardimci_tesisler") {
      if (!form.machine_id) {
        toast({ title: t("common", "error"), description: t("maintenance", "machineAndTitleRequired"), variant: "destructive" });
        return;
      }
    }
    if (!form.title) {
      toast({ title: t("common", "error"), description: t("maintenance", "machineAndTitleRequired"), variant: "destructive" });
      return;
    }
    setSaving(true);
    const err = await onSave({ ...form, photos } as any);
    setSaving(false);
    if (!err) {
      toast({ title: t("common", "success"), description: initial ? t("maintenance", "recordUpdated") : t("maintenance", "recordCreated") });
      onClose();
    } else {
      toast({ title: t("common", "error"), description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
        <h3 className="text-lg font-bold text-foreground">{initial ? t("maintenance", "editRecord") : t("maintenance", "newRecordTitle")}</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("maintenance", "machine")} *</label>
            <select value={form.machine_id} onChange={e => setForm(p => ({ ...p, machine_id: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground">
              <option value="">{t("maintenance", "select")}</option>
              <option value="yardimci_tesisler">🏭 Yardımcı Tesisler</option>
              {filteredMachines.map(m => <option key={m.id} value={m.id}>{m.label} ({m.code})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("maintenance", "maintenanceType")}</label>
            <select value={form.maintenance_type} onChange={e => setForm(p => ({ ...p, maintenance_type: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground">
              <option value="planned_maintenance">{t("maintenance", "planned_maintenance")}</option>
              <option value="unplanned_failure">{t("maintenance", "unplanned_failure")}</option>
              <option value="revision">{t("maintenance", "revision")}</option>
              <option value="service">{t("maintenance", "service")}</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">{t("maintenance", "titleField")} *</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">{t("maintenance", "descriptionField")}</label>
            <textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground resize-none" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("maintenance", "status")}</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground">
              <option value="planned">{t("maintenance", "planned")}</option>
              <option value="in_progress">{t("maintenance", "inProgress")}</option>
              <option value="completed">{t("maintenance", "completed")}</option>
              <option value="cancelled">{t("maintenance", "cancelled")}</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("maintenance", "priority")}</label>
            <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground">
              <option value="low">{t("maintenance", "low")}</option>
              <option value="normal">{t("maintenance", "normal")}</option>
              <option value="high">{t("maintenance", "high")}</option>
              <option value="critical">{t("maintenance", "critical")}</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("maintenance", "technician")}</label>
            <input value={form.technician_name} onChange={e => setForm(p => ({ ...p, technician_name: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("maintenance", "scheduledDate")}</label>
            <input type="date" value={form.scheduled_date} onChange={e => setForm(p => ({ ...p, scheduled_date: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("maintenance", "cost")}</label>
            <div className="flex items-center rounded-lg border border-border bg-background overflow-hidden">
              <span className="px-3 py-2 text-sm font-semibold text-muted-foreground bg-muted/40 border-r border-border select-none">₺</span>
              <input type="number" min={0} value={form.cost} onChange={e => setForm(p => ({ ...p, cost: Number(e.target.value) }))} className="flex-1 bg-transparent px-3 py-2 text-sm text-foreground outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("maintenance", "duration")}</label>
            <input type="number" min={0} value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: Number(e.target.value) }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">{t("maintenance", "notes")}</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground resize-none" />
          </div>
        </div>

        {/* Photo Upload Section */}
        <div className="space-y-3">
          <label className="text-xs text-muted-foreground font-semibold block">{t("maintenance", "photos")}</label>
          
          <div className="flex items-center gap-2">
            <select value={uploadType} onChange={e => setUploadType(e.target.value as "before" | "after")} className="rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground">
              <option value="before">{t("maintenance", "before")}</option>
              <option value="after">{t("maintenance", "after")}</option>
            </select>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/20 text-primary text-sm font-medium hover:bg-primary/30 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <><Upload className="w-4 h-4 animate-pulse" /> {t("maintenance", "uploading")}</>
              ) : (
                <><Camera className="w-4 h-4" /> {t("maintenance", "addPhoto")}</>
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
                  <img src={photo.url} alt={photo.caption || `${t("maintenance", "maintenancePhoto")} ${idx + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute top-1 left-1">
                    <Badge className={`text-[10px] ${photo.type === "before" ? "bg-blue-500/80 text-white" : "bg-emerald-500/80 text-white"}`}>
                      {photo.type === "before" ? t("maintenance", "before") : t("maintenance", "after")}
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
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors">{t("maintenance", "cancelled")}</button>
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saving ? t("common", "saving") : initial ? t("maintenance", "update") : t("common", "save")}
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
  selectedFactory?: string;
}

const ScheduleForm = ({ machines, initial, onSave, onClose, selectedFactory }: ScheduleFormProps) => {
  const { t } = useLanguage();
  
  const filteredMachines = useMemo(() => {
    if (!selectedFactory || selectedFactory === "all") return machines;
    return machines.filter(m => m.factory === selectedFactory);
  }, [machines, selectedFactory]);

  const [form, setForm] = useState({
    machine_id: initial?.machine_id || "",
    title: initial?.title || "",
    maintenance_type: initial?.maintenance_type || "planned_maintenance",
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
      toast({ title: t("common", "error"), description: t("maintenance", "machineAndTitleRequired"), variant: "destructive" });
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
      toast({ title: t("common", "success"), description: t("maintenance", "planSaved") });
      onClose();
    } else {
      toast({ title: t("common", "error"), description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
        <h3 className="text-lg font-bold text-foreground">{initial ? t("maintenance", "editPlan") : t("maintenance", "newPlanTitle")}</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("maintenance", "machine")} *</label>
            <select value={form.machine_id} onChange={e => setForm(p => ({ ...p, machine_id: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground">
              <option value="">{t("maintenance", "select")}</option>
              <option value="yardimci_tesisler">🏭 Yardımcı Tesisler</option>
              {filteredMachines.map(m => <option key={m.id} value={m.id}>{m.label} ({m.code})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("maintenance", "maintenanceType")}</label>
            <select value={form.maintenance_type} onChange={e => setForm(p => ({ ...p, maintenance_type: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground">
              <option value="planned_maintenance">{t("maintenance", "planned_maintenance")}</option>
              <option value="unplanned_failure">{t("maintenance", "unplanned_failure")}</option>
              <option value="revision">{t("maintenance", "revision")}</option>
              <option value="service">{t("maintenance", "service")}</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">{t("maintenance", "titleField")} *</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("maintenance", "everyXDays")} ({t("maintenance", "intervalDays")})</label>
            <input type="number" min={0} value={form.interval_days} onChange={e => setForm(p => ({ ...p, interval_days: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("maintenance", "everyXHours")} ({t("maintenance", "intervalHours")})</label>
            <input type="number" min={0} value={form.interval_hours} onChange={e => setForm(p => ({ ...p, interval_hours: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("maintenance", "nextDueDate")}</label>
            <input type="date" value={form.next_due_date} onChange={e => setForm(p => ({ ...p, next_due_date: e.target.value }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("maintenance", "currentHours")}</label>
            <input type="number" min={0} value={form.current_hours} onChange={e => setForm(p => ({ ...p, current_hours: Number(e.target.value) }))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground" />
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="rounded" />
            <label htmlFor="is_active" className="text-sm text-foreground">{t("maintenance", "active")}</label>
          </div>
        </div>

        {/* Checklist Builder */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground font-semibold block">{t("maintenance", "checklist")}</label>
          <div className="flex gap-2">
            <input
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addChecklistItem()}
              placeholder={t("maintenance", "addChecklistItem")}
              className="flex-1 rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground"
            />
            <button onClick={addChecklistItem} className="px-3 py-2 rounded-lg bg-primary/20 text-primary text-sm hover:bg-primary/30 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {checklistItems.length > 0 && (
            <div className="space-y-1">
              {checklistItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                  <CircleDot className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground flex-1">{item}</span>
                  <button onClick={() => setChecklistItems(p => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors">{t("maintenance", "cancelled")}</button>
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saving ? t("common", "saving") : initial ? t("maintenance", "update") : t("common", "save")}
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
  onComplete: (results: ChecklistItem[], duration: number, notes?: string) => Promise<any>;
  onClose: () => void;
}

const ChecklistExec = ({ schedule, machineName, onComplete, onClose }: ChecklistExecProps) => {
  const { t } = useLanguage();
  const [items, setItems] = useState<ChecklistItem[]>(
    schedule.checklist.map(c => ({ ...c, checked: false }))
  );
  const [duration, setDuration] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const toggle = (i: number) => {
    setItems(p => p.map((item, idx) => idx === i ? { ...item, checked: !item.checked } : item));
  };

  const allChecked = items.every(i => i.checked);

  const handleSubmit = async () => {
    setSaving(true);
    const err = await onComplete(items, duration, notes || undefined);
    setSaving(false);
    if (!err) {
      toast({ title: t("common", "success"), description: t("maintenance", "checklistCompleted") });
      onClose();
    } else {
      toast({ title: t("common", "error"), description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
        <h3 className="text-lg font-bold text-foreground">{t("maintenance", "applyChecklist")}</h3>
        <p className="text-sm text-muted-foreground">{schedule.title} — <span className="text-foreground font-medium">{machineName}</span></p>

        <div className="space-y-2">
          {items.map((item, i) => (
            <div
              key={i}
              onClick={() => toggle(i)}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${item.checked ? "bg-emerald-500/10 border-emerald-500/30" : "bg-muted/20 border-border hover:bg-muted/40"}`}
            >
              {item.checked ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <CircleDot className="w-5 h-5 text-muted-foreground shrink-0" />}
              <span className={`text-sm ${item.checked ? "text-foreground" : "text-muted-foreground"}`}>{item.item}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("maintenance", "duration")} (dk)</label>
            <input type="number" min={0} value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("maintenance", "notes")}</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground" />
          </div>
        </div>

        <div className="flex justify-between items-center pt-2">
          <span className="text-xs text-muted-foreground">{items.filter(i => i.checked).length}/{items.length} {t("maintenance", "checklistItems")}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors">{t("maintenance", "cancelled")}</button>
            <button onClick={handleSubmit} disabled={saving || !allChecked} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50">
              {saving ? t("common", "saving") : t("maintenance", "complete")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---- Main Module ----
const MaintenanceModule = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { canEdit } = useAdminPermissions();
  const { records, schedules, checklistLogs, loading, addRecord, updateRecord, deleteRecord, addSchedule, updateSchedule, deleteSchedule, completeChecklist, getAlerts } = useMaintenance();
  const { machines } = useMachines();
  const { activeFactories } = useFactories();
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<MaintenanceSchedule | null>(null);
  const [checklistSchedule, setChecklistSchedule] = useState<MaintenanceSchedule | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterFactory, setFilterFactory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const locale = language === "fr" ? "fr-FR" : language === "en" ? "en-US" : "tr-TR";
  const alerts = getAlerts();

  // Can this user edit maintenance?
  const userCanEdit = canEdit("admin_maintenance");

  const getMachineName = (id: string) => {
    if (id === "yardimci_tesisler") return "Yardımcı Tesisler";
    return machines.find(m => m.id === id)?.label || "—";
  };

  const getMachineFactory = (id: string) => {
    if (id === "yardimci_tesisler") return "yardimci";
    return machines.find(m => m.id === id)?.factory || "";
  };

  const filteredRecords = records.filter(r => {
    if (filterFactory !== "all") {
      const mFactory = getMachineFactory(r.machine_id);
      if (filterFactory === "yardimci" && r.machine_id !== "yardimci_tesisler") return false;
      if (filterFactory !== "yardimci" && mFactory !== filterFactory) return false;
    }
    if (filterType !== "all" && r.maintenance_type !== filterType) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) && !getMachineName(r.machine_id).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const factoryLabel = useMemo(() => {
    if (filterFactory === "all") return "";
    if (filterFactory === "yardimci") return "Yardımcı Tesisler";
    return activeFactories.find(f => f.name === filterFactory)?.name || filterFactory;
  }, [filterFactory, activeFactories]);

  // Build export rows
  const buildExportRecords = () => filteredRecords.map(r => ({
    title: r.title,
    machine_name: getMachineName(r.machine_id),
    factory: getMachineFactory(r.machine_id) || factoryLabel,
    maintenance_type: r.maintenance_type,
    status: r.status,
    priority: r.priority,
    technician_name: r.technician_name,
    cost: r.cost || 0,
    duration_minutes: r.duration_minutes || 0,
    scheduled_date: r.scheduled_date,
    completed_date: r.completed_date,
    notes: r.notes,
    created_at: r.created_at,
  }));

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await exportMaintenancePdf(buildExportRecords(), factoryLabel);
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      await exportMaintenanceExcel(buildExportRecords(), factoryLabel);
    } finally {
      setExporting(false);
    }
  };

  // Dashboard data
  const dashboardData = useMemo(() => {
    const machineMap = new Map<string, { name: string; count: number; cost: number; totalDuration: number; planned_maintenance: number; unplanned_failure: number; revision: number; service: number; other: number }>();
    
    for (const r of records) {
      const existing = machineMap.get(r.machine_id) || {
        name: getMachineName(r.machine_id),
        count: 0, cost: 0, totalDuration: 0,
        planned_maintenance: 0, unplanned_failure: 0, revision: 0, service: 0, other: 0,
      };
      existing.count++;
      existing.cost += r.cost || 0;
      existing.totalDuration += r.duration_minutes || 0;
      const mt = r.maintenance_type as string;
      if (mt === "planned_maintenance") existing.planned_maintenance++;
      else if (mt === "unplanned_failure") existing.unplanned_failure++;
      else if (mt === "revision") existing.revision++;
      else if (mt === "service") existing.service++;
      else existing.other++;
      machineMap.set(r.machine_id, existing);
    }

    const perMachine = Array.from(machineMap.values()).sort((a, b) => b.count - a.count);
    const totalCount = records.length;
    const totalCost = records.reduce((s, r) => s + (r.cost || 0), 0);
    const totalDuration = records.reduce((s, r) => s + (r.duration_minutes || 0), 0);
    const avgDuration = totalCount > 0 ? Math.round(totalDuration / totalCount) : 0;
    const completedCount = records.filter(r => r.status === "completed").length;

    // Factory-based chart data
    const factoryMap = new Map<string, { name: string; count: number; cost: number; planned_maintenance: number; unplanned_failure: number; revision: number; service: number }>();
    for (const r of records) {
      const factory = getMachineFactory(r.machine_id);
      const factoryName = factory === "yardimci" ? "Yardımcı Tesisler" : (activeFactories.find(f => f.name === factory)?.name || factory || "Diğer");
      const existing = factoryMap.get(factoryName) || { name: factoryName, count: 0, cost: 0, planned_maintenance: 0, unplanned_failure: 0, revision: 0, service: 0 };
      existing.count++;
      existing.cost += r.cost || 0;
      const mt = r.maintenance_type as string;
      if (mt === "planned_maintenance") existing.planned_maintenance++;
      else if (mt === "unplanned_failure") existing.unplanned_failure++;
      else if (mt === "revision") existing.revision++;
      else if (mt === "service") existing.service++;
      factoryMap.set(factoryName, existing);
    }
    const perFactory = Array.from(factoryMap.values()).sort((a, b) => b.count - a.count);

    const typeData = [
      { name: t("maintenance", "planned_maintenance"), value: records.filter(r => r.maintenance_type === "planned_maintenance").length, color: "hsl(var(--chart-1))" },
      { name: t("maintenance", "unplanned_failure"), value: records.filter(r => r.maintenance_type === "unplanned_failure").length, color: "hsl(var(--chart-2))" },
      { name: t("maintenance", "revision"), value: records.filter(r => r.maintenance_type === "revision").length, color: "hsl(var(--chart-3))" },
      { name: t("maintenance", "service"), value: records.filter(r => r.maintenance_type === "service").length, color: "hsl(var(--chart-4))" },
    ].filter(d => d.value > 0);

    const statusData = [
      { name: t("maintenance", "planned"), value: records.filter(r => r.status === "planned").length, color: "hsl(var(--chart-4))" },
      { name: t("maintenance", "inProgress"), value: records.filter(r => r.status === "in_progress").length, color: "hsl(var(--chart-5))" },
      { name: t("maintenance", "completed"), value: completedCount, color: "hsl(var(--chart-1))" },
      { name: t("maintenance", "cancelled"), value: records.filter(r => r.status === "cancelled").length, color: "hsl(var(--chart-3))" },
    ].filter(d => d.value > 0);

    return { perMachine, perFactory, totalCount, totalCost, avgDuration, totalDuration, completedCount, typeData, statusData };
  }, [records, machines, activeFactories, t]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">{t("common", "loading")}</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
          <Wrench className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{t("maintenance", "title")}</h2>
          <p className="text-xs text-muted-foreground">{t("maintenance", "subtitle")}</p>
        </div>

        {/* Factory Filter in Header */}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-3 py-1.5">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <select
              value={filterFactory}
              onChange={e => setFilterFactory(e.target.value)}
              className="bg-card text-sm text-foreground outline-none cursor-pointer rounded px-1 [&>option]:bg-card [&>option]:text-foreground"
            >
              <option value="all">Tüm Fabrikalar</option>
              {activeFactories.map(f => (
                <option key={f.id} value={f.name}>{f.name}</option>
              ))}
              <option value="yardimci">Yardımcı Tesisler</option>
            </select>
          </div>
          {alerts.length > 0 && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 border animate-pulse">
              <AlertTriangle className="w-3 h-3 mr-1" />{alerts.length} {t("maintenance", "alertCount")}
            </Badge>
          )}
        </div>
      </div>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-2">
          <h4 className="text-sm font-semibold text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {t("maintenance", "alerts")}
          </h4>
          {alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <Badge className={a.type === "overdue" ? "bg-red-500/30 text-red-300" : "bg-yellow-500/30 text-yellow-300"}>
                {a.type === "overdue" ? t("maintenance", "overdue") : a.type === "hours_warning" ? t("maintenance", "hoursWarning") : t("maintenance", "upcoming")}
              </Badge>
              <span className="text-foreground font-medium">{a.schedule.title}</span>
              <span className="text-muted-foreground">— {getMachineName(a.schedule.machine_id)}</span>
              {a.schedule.next_due_date && <span className="text-xs text-muted-foreground ml-auto">{new Date(a.schedule.next_due_date).toLocaleDateString(locale)}</span>}
            </div>
          ))}
        </div>
      )}

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-lg bg-background border border-border">
          <TabsTrigger value="dashboard" className="text-xs">{t("maintenance", "dashboard")}</TabsTrigger>
          <TabsTrigger value="records" className="text-xs">{t("maintenance", "records")}</TabsTrigger>
          <TabsTrigger value="schedules" className="text-xs">{t("maintenance", "schedules")}</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs">{t("maintenance", "checklistHistory")}</TabsTrigger>
        </TabsList>

        {/* ---- Dashboard Tab ---- */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xs text-muted-foreground">{t("maintenance", "totalMaintenance")}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{dashboardData.totalCount}</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-accent-foreground" />
                </div>
                <span className="text-xs text-muted-foreground">{t("maintenance", "totalCost")}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">₺{dashboardData.totalCost.toLocaleString(locale)}</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-secondary-foreground" />
                </div>
                <span className="text-xs text-muted-foreground">{t("maintenance", "avgDowntime")}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{dashboardData.avgDuration} <span className="text-sm font-normal text-muted-foreground">{language === "en" ? "min" : language === "fr" ? "min" : "dk"}</span></p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-foreground" />
                </div>
                <span className="text-xs text-muted-foreground">{t("maintenance", "completedCount")}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{dashboardData.completedCount}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dashboardData.typeData.length > 0 && (
              <div className="p-4 rounded-xl bg-card border border-border">
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> {t("maintenance", "typeDistribution")}
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

            {dashboardData.statusData.length > 0 && (
              <div className="p-4 rounded-xl bg-card border border-border">
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> {t("maintenance", "statusDistribution")}
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

          {/* Factory-based chart */}
          {dashboardData.perFactory.length > 0 && (
            <div className="p-4 rounded-xl bg-card border border-border">
              <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" /> Fabrika Bazlı Bakım Dağılımı
              </h4>
              <ResponsiveContainer width="100%" height={Math.max(200, dashboardData.perFactory.length * 60)}>
                <BarChart data={dashboardData.perFactory} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={130} tick={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 600 }} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }}
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = { planned_maintenance: "Planlı Bakım", unplanned_failure: "Plansız Arıza", revision: "Revizyon", service: "Servis" };
                      return [value, labels[name] || name];
                    }}
                  />
                  <Legend formatter={(value) => {
                    const labels: Record<string, string> = { planned_maintenance: "Planlı Bakım", unplanned_failure: "Plansız Arıza", revision: "Revizyon", service: "Servis" };
                    return labels[value] || value;
                  }} />
                  <Bar dataKey="planned_maintenance" stackId="a" fill="hsl(var(--chart-1))" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="unplanned_failure" stackId="a" fill="hsl(var(--chart-2))" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="revision" stackId="a" fill="hsl(var(--chart-3))" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="service" stackId="a" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {dashboardData.perMachine.length > 0 && (
            <div className="p-4 rounded-xl bg-card border border-border">
              <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" /> {t("maintenance", "machineMaintenanceChart")}
              </h4>
              <ResponsiveContainer width="100%" height={Math.max(250, dashboardData.perMachine.length * 40)}>
                <BarChart data={dashboardData.perMachine} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }}
                    formatter={(value: number, name: string) => [name === "cost" ? `₺${value.toLocaleString(locale)}` : `${value}`, name === "cost" ? t("maintenance", "costLabel") : name === "count" ? t("maintenance", "maintenanceCount") : t("maintenance", "durationLabel")]}
                  />
                  <Legend formatter={(value) => value === "count" ? t("maintenance", "maintenanceCount") : value === "cost" ? t("maintenance", "costLabel") : t("maintenance", "durationLabel")} />
                  <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} name="count" />
                  <Bar dataKey="cost" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} name="cost" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {dashboardData.perMachine.length > 0 && (
            <div className="p-4 rounded-xl bg-card border border-border overflow-x-auto">
              <h4 className="text-sm font-semibold text-foreground mb-3">{t("maintenance", "machineSummaryTable")}</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">{t("maintenance", "machine")}</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">{t("maintenance", "total")}</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">{t("maintenance", "planned_maintenance")}</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">{t("maintenance", "unplanned_failure")}</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">{t("maintenance", "revision")}</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">{t("maintenance", "service")}</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">{t("maintenance", "costLabel")}</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">{t("maintenance", "avgDuration")}</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.perMachine.map((m, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 font-medium text-foreground">{m.name}</td>
                      <td className="py-2 px-3 text-center text-foreground">{m.count}</td>
                      <td className="py-2 px-3 text-center text-foreground">{m.planned_maintenance}</td>
                      <td className="py-2 px-3 text-center text-foreground">{m.unplanned_failure}</td>
                      <td className="py-2 px-3 text-center text-foreground">{m.revision}</td>
                      <td className="py-2 px-3 text-center text-foreground">{m.service}</td>
                      <td className="py-2 px-3 text-right text-foreground">₺{m.cost.toLocaleString(locale)}</td>
                      <td className="py-2 px-3 text-right text-foreground">{m.count > 0 ? Math.round(m.totalDuration / m.count) : 0} {language === "en" || language === "fr" ? "min" : "dk"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {dashboardData.totalCount === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>{t("maintenance", "noDashboardData")}</p>
            </div>
          )}
        </TabsContent>

        {/* ---- Records Tab ---- */}
        <TabsContent value="records" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("maintenance", "search")} className="w-full rounded-lg bg-background border border-border pl-9 pr-3 py-2 text-sm text-foreground" />
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground">
              <option value="all">{t("maintenance", "all")}</option>
              <option value="planned_maintenance">{t("maintenance", "planned_maintenance")}</option>
              <option value="unplanned_failure">{t("maintenance", "unplanned_failure")}</option>
              <option value="revision">{t("maintenance", "revision")}</option>
              <option value="service">{t("maintenance", "service")}</option>
            </select>

            {/* Export buttons */}
            <button
              onClick={handleExportPdf}
              disabled={exporting || filteredRecords.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30 transition-colors disabled:opacity-50"
              title="PDF İndir"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </button>
            <button
              onClick={handleExportExcel}
              disabled={exporting || filteredRecords.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
              title="Excel İndir"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Excel</span>
            </button>

            {user && (
              <button onClick={() => { setEditingRecord(null); setShowRecordForm(true); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                <Plus className="w-4 h-4" /> {t("maintenance", "newRecord")}
              </button>
            )}
          </div>

          {filterFactory !== "all" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
              <Building2 className="w-3 h-3" />
              <span>Fabrika filtresi: <strong className="text-foreground">{factoryLabel}</strong> — {filteredRecords.length} kayıt</span>
            </div>
          )}

          {filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wrench className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>{t("maintenance", "noRecords")}</p>
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
                                  {photo.type === "before" ? t("maintenance", "before") : t("maintenance", "after")}
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
                        {r.cost > 0 && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />₺{r.cost.toLocaleString(locale)}</span>}
                        {r.duration_minutes > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{r.duration_minutes} {language === "en" || language === "fr" ? "min" : "dk"}</span>}
                        {r.scheduled_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(r.scheduled_date).toLocaleDateString(locale)}</span>}
                      </div>
                    </div>
                    {userCanEdit && (
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { setEditingRecord(r); setShowRecordForm(true); }} className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                          <Wrench className="w-4 h-4" />
                        </button>
                        <button onClick={async () => { if (confirm(t("maintenance", "confirmDeleteRecord"))) await deleteRecord(r.id); }} className="p-2 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---- Schedules Tab ---- */}
        <TabsContent value="schedules" className="space-y-4">
          {userCanEdit && (
            <div className="flex justify-end">
              <button onClick={() => { setEditingSchedule(null); setShowScheduleForm(true); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                <Plus className="w-4 h-4" /> {t("maintenance", "newPlan")}
              </button>
            </div>
          )}

          {schedules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>{t("maintenance", "noSchedules")}</p>
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
                        <button onClick={() => setChecklistSchedule(s)} className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors" title={t("maintenance", "applyChecklist")}>
                          <ClipboardCheck className="w-4 h-4" />
                        </button>
                        {userCanEdit && (
                          <>
                            <button onClick={() => { setEditingSchedule(s); setShowScheduleForm(true); }} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors">
                              <Wrench className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={async () => { if (confirm(t("maintenance", "confirmDeletePlan"))) await deleteSchedule(s.id); }} className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground mb-2">{getMachineName(s.machine_id)}</p>

                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      {s.interval_days && <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {t("maintenance", "every")} {s.interval_days} {t("maintenance", "everyXDays")}</div>}
                      {s.interval_hours && <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {t("maintenance", "every")} {s.interval_hours} {t("maintenance", "everyXHours")}</div>}
                      {s.next_due_date && (
                        <div className={`flex items-center gap-1 font-medium ${isOverdue ? "text-red-400" : ""}`}>
                          <Calendar className="w-3 h-3" /> {t("maintenance", "next")}: {new Date(s.next_due_date).toLocaleDateString(locale)}
                          {isOverdue && <span className="text-red-400 ml-1">({t("maintenance", "overdueExcl")})</span>}
                        </div>
                      )}
                      {s.last_performed_at && <div>{t("maintenance", "lastMaintenance")}: {new Date(s.last_performed_at).toLocaleDateString(locale)}</div>}
                    </div>

                    {hoursPercent !== null && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>{t("maintenance", "workingHours")}</span>
                          <span>{Math.round(s.current_hours - s.last_performed_hours)} / {s.interval_hours} {t("maintenance", "hour")}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${hoursPercent >= 100 ? "bg-red-500" : hoursPercent >= 90 ? "bg-yellow-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, hoursPercent)}%` }} />
                        </div>
                      </div>
                    )}

                    {s.checklist.length > 0 && (
                      <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                        <ClipboardCheck className="w-3 h-3" />
                        {s.checklist.length} {t("maintenance", "checklistItems")}
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
              <p>{t("maintenance", "noChecklists")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {checklistLogs.map(log => (
                <div key={log.id} className="p-4 rounded-xl bg-card border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-foreground text-sm">{getMachineName(log.machine_id)}</span>
                    <span className="text-xs text-muted-foreground">{new Date(log.completion_date).toLocaleString(locale)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{log.completed_by_name}</span>
                    {log.duration_minutes > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{log.duration_minutes} {language === "en" || language === "fr" ? "min" : "dk"}</span>}
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
          selectedFactory={filterFactory}
        />
      )}
      {showScheduleForm && (
        <ScheduleForm
          machines={machines}
          initial={editingSchedule || undefined}
          onSave={editingSchedule ? (data) => updateSchedule(editingSchedule.id, data) : addSchedule}
          onClose={() => { setShowScheduleForm(false); setEditingSchedule(null); }}
          selectedFactory={filterFactory}
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
          <img src={lightboxPhoto} alt={t("maintenance", "maintenancePhoto")} className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};

export default MaintenanceModule;
