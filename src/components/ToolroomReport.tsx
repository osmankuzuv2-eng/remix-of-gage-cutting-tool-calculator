import { useState, useCallback, useEffect, useRef } from "react";
import {
  BarChart3, Upload, FileDown, Trash2, Search,
  TrendingUp, Package, DollarSign, Building2, X, Percent, Edit2, Check, Plus, ArrowLeftRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFactories } from "@/hooks/useFactories";
import { toast } from "sonner";
import { exportToolroomPdf, type ToolroomPurchase } from "@/lib/exportToolroomPdf";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend
} from "recharts";
import * as ExcelJS from "exceljs";

const MONTHS = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
const COLORS = ["#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444","#ec4899","#6366f1","#84cc16"];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

type Consumption = {
  id: string; factory: string; year: number; month: number;
  supplier: string; tool_type: string; tool_code: string | null;
  quantity: number; unit_price: number; total_amount: number; notes: string | null;
};

type ConsumptionInput = Omit<Consumption, "id" | "total_amount">;

const emptyForm = (): ConsumptionInput => ({
  factory: "", year: currentYear, month: new Date().getMonth() + 1,
  supplier: "", tool_type: "", tool_code: "", quantity: 1, unit_price: 0, notes: "",
});

/* ─── Excel şablonu indir (alım) ─── */
const downloadPurchaseTemplate = async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Takımhane Alımları");
  ws.columns = [
    { header: "Fabrika", key: "factory", width: 20 },
    { header: "Yıl", key: "year", width: 8 },
    { header: "Ay (1-12)", key: "month", width: 10 },
    { header: "Tedarikçi", key: "supplier", width: 25 },
    { header: "Takım Kodu", key: "tool_code", width: 18 },
    { header: "Takım Tipi", key: "tool_type", width: 25 },
    { header: "Miktar", key: "quantity", width: 10 },
    { header: "Birim Fiyat (EUR)", key: "unit_price", width: 18 },
    { header: "Not", key: "notes", width: 30 },
  ];
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF161A26" } };
  ws.addRow(["Havacılık", currentYear, 1, "Sandvik", "R290-12T308M-PM", "Freze Ucu", 10, 45.50, "Stok tamamlama"]);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "takimhane-alim-sablon.xlsx"; a.click();
  URL.revokeObjectURL(url);
};

/* ─── Excel şablonu indir (sarfiyat) ─── */
const downloadConsumptionTemplate = async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sarfiyat");
  ws.columns = [
    { header: "Fabrika", key: "factory", width: 20 },
    { header: "Yıl", key: "year", width: 8 },
    { header: "Ay (1-12)", key: "month", width: 10 },
    { header: "Tedarikçi", key: "supplier", width: 25 },
    { header: "Takım Kodu", key: "tool_code", width: 18 },
    { header: "Takım Tipi", key: "tool_type", width: 25 },
    { header: "Miktar", key: "quantity", width: 10 },
    { header: "Birim Fiyat (EUR)", key: "unit_price", width: 18 },
    { header: "Not", key: "notes", width: 30 },
  ];
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D1B2A" } };
  ws.addRow(["Havacılık", currentYear, 1, "Sandvik", "R290-12T308M-PM", "Freze Ucu", 8, 45.50, "Ocak sarfiyatı"]);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "takimhane-sarfiyat-sablon.xlsx"; a.click();
  URL.revokeObjectURL(url);
};

const parseExcelRows = async (file: File): Promise<ConsumptionInput[]> => {
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve(ev.target?.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  const rows: ConsumptionInput[] = [];
  ws.eachRow((row, idx) => {
    if (idx === 1) return;
    const vals = row.values as any[];
    const factory = String(vals[1] ?? "").trim();
    const year = Number(vals[2]);
    const month = Number(vals[3]);
    const supplier = String(vals[4] ?? "").trim();
    const tool_code = String(vals[5] ?? "").trim() || null;
    const tool_type = String(vals[6] ?? "").trim();
    if (!factory || !supplier || !tool_type || !year || !month) return;
    rows.push({ factory, year, month, supplier, tool_type, tool_code, quantity: Number(vals[7]) || 1, unit_price: Number(vals[8]) || 0, notes: String(vals[9] ?? "").trim() || null });
  });
  return rows;
};

export default function ToolroomReport({ canEdit: canEditProp }: { canEdit?: boolean } = {}) {
  const { user } = useAuth();
  const { factories } = useFactories();
  const [activeTab, setActiveTab] = useState<"purchases" | "consumptions">("purchases");

  /* purchases */
  const [purchases, setPurchases] = useState<ToolroomPurchase[]>([]);
  /* consumptions */
  const [consumptions, setConsumptions] = useState<Consumption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  /* edit modal */
  const [editRow, setEditRow] = useState<(ToolroomPurchase | Consumption) | null>(null);
  const [editForm, setEditForm] = useState<ConsumptionInput>(emptyForm());
  const [editSaving, setEditSaving] = useState(false);

  /* filters */
  const [filterFactory, setFilterFactory] = useState("all");
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterMonth, setFilterMonth] = useState<number | null>(null);
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [search, setSearch] = useState("");

  /* revenues */
  const [revenues, setRevenues] = useState<Record<string, number>>({});
  const [editingRevenue, setEditingRevenue] = useState<string | null>(null);
  const [revenueInput, setRevenueInput] = useState("");

  /* excel import */
  const purchaseFileRef = useRef<HTMLInputElement>(null);
  const consumptionFileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ConsumptionInput[]>([]);
  const [previewMode, setPreviewMode] = useState<"purchases" | "consumptions">("purchases");
  const [showPreview, setShowPreview] = useState(false);

  /* manual consumption form */
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ConsumptionInput>(emptyForm());
  const [saving, setSaving] = useState(false);

  /* derived permission: admin OR explicitly granted from admin panel */
  const hasEditAccess = isAdmin || canEditProp === true;

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      setIsAdmin(data?.some(r => r.role === "admin") ?? false);
    });
  }, [user]);

  const openEdit = (row: ToolroomPurchase | Consumption) => {
    setEditRow(row);
    setEditForm({
      factory: row.factory, year: row.year, month: row.month,
      supplier: row.supplier, tool_type: row.tool_type, tool_code: row.tool_code || "",
      quantity: row.quantity, unit_price: row.unit_price, notes: row.notes || "",
    });
  };

  const handleEditSave = async () => {
    if (!editRow) return;
    if (!editForm.factory || !editForm.supplier || !editForm.tool_type) { toast.error("Zorunlu alanları doldurun."); return; }
    setEditSaving(true);
    const table = activeTab === "purchases" ? "toolroom_purchases" : "toolroom_consumptions";
    const { error } = await (supabase as any).from(table).update({
      factory: editForm.factory, year: editForm.year, month: editForm.month,
      supplier: editForm.supplier, tool_type: editForm.tool_type,
      tool_code: editForm.tool_code || null, quantity: editForm.quantity,
      unit_price: editForm.unit_price, notes: editForm.notes || null,
    }).eq("id", editRow.id);
    setEditSaving(false);
    if (error) { toast.error("Güncelleme hatası."); return; }
    toast.success("Kayıt güncellendi.");
    setEditRow(null); load();
  };
  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: pData }, { data: cData }, { data: rData }] = await Promise.all([
      (supabase as any).from("toolroom_purchases").select("*").order("year", { ascending: false }).order("month", { ascending: false }),
      (supabase as any).from("toolroom_consumptions").select("*").order("year", { ascending: false }).order("month", { ascending: false }),
      (supabase as any).from("factory_revenues").select("*").eq("year", filterYear),
    ]);
    if (pData) setPurchases(pData as ToolroomPurchase[]);
    if (cData) setConsumptions(cData as Consumption[]);
    if (rData) {
      const map: Record<string, number> = {};
      (rData as any[]).forEach(r => { map[r.factory] = Number(r.revenue); });
      setRevenues(map);
    }
    setLoading(false);
  }, [filterYear]);

  useEffect(() => { load(); }, [load]);

  const saveRevenue = async (factory: string) => {
    const val = Number(revenueInput);
    if (isNaN(val) || val < 0) { toast.error("Geçerli bir ciro girin."); return; }
    await (supabase as any).from("factory_revenues").upsert(
      { factory, year: filterYear, month: filterMonth ?? 0, revenue: val, created_by: user?.id },
      { onConflict: "factory,year,month" }
    );
    setRevenues(prev => ({ ...prev, [factory]: val }));
    setEditingRevenue(null);
    toast.success("Ciro kaydedildi.");
  };

  /* ─── Excel import handlers ─── */
  const handlePurchaseFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true);
    try {
      const rows = await parseExcelRows(file);
      setPreview(rows); setPreviewMode("purchases"); setShowPreview(true);
    } catch { toast.error("Excel dosyası okunamadı."); }
    finally { setImporting(false); if (purchaseFileRef.current) purchaseFileRef.current.value = ""; }
  };

  const handleConsumptionFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true);
    try {
      const rows = await parseExcelRows(file);
      setPreview(rows); setPreviewMode("consumptions"); setShowPreview(true);
    } catch { toast.error("Excel dosyası okunamadı."); }
    finally { setImporting(false); if (consumptionFileRef.current) consumptionFileRef.current.value = ""; }
  };

  const handleImportConfirm = async () => {
    if (preview.length === 0) return;
    const table = previewMode === "purchases" ? "toolroom_purchases" : "toolroom_consumptions";
    const { error } = await (supabase as any).from(table).insert(preview as any[]);
    if (error) { toast.error("Kayıt sırasında hata oluştu."); return; }
    toast.success(`${preview.length} kayıt başarıyla eklendi!`);
    setShowPreview(false); setPreview([]); load();
  };

  /* ─── Manual save ─── */
  const handleSaveConsumption = async () => {
    if (!form.factory || !form.supplier || !form.tool_type) { toast.error("Fabrika, tedarikçi ve takım tipi zorunlu."); return; }
    setSaving(true);
    const { error } = await (supabase as any).from("toolroom_consumptions").insert([{ ...form, created_by: user?.id }]);
    setSaving(false);
    if (error) { toast.error("Kayıt hatası."); return; }
    toast.success("Sarfiyat kaydedildi.");
    setForm(emptyForm()); setShowForm(false); load();
  };

  const [confirmDeleteMonth, setConfirmDeleteMonth] = useState(false);

  const handleDeleteByMonth = async () => {
    const table = activeTab === "purchases" ? "toolroom_purchases" : "toolroom_consumptions";
    const ids = currentData.map(r => r.id);
    if (ids.length === 0) return;
    const { error } = await (supabase as any).from(table).delete().in("id", ids);
    if (error) { toast.error("Silme hatası."); return; }
    toast.success(`${ids.length} kayıt silindi.`);
    setConfirmDeleteMonth(false);
    load();
  };

  const handleDeletePurchase = async (id: string) => {
    await (supabase as any).from("toolroom_purchases").delete().eq("id", id);
    toast.success("Kayıt silindi."); load();
  };

  const handleDeleteConsumption = async (id: string) => {
    await (supabase as any).from("toolroom_consumptions").delete().eq("id", id);
    toast.success("Kayıt silindi."); load();
  };

  /* ─── Filtered data ─── */
  const activeFactories = factories.filter(f => f.is_active);

  const applyFilter = <T extends { factory: string; year: number; month: number; supplier: string; tool_type: string; tool_code?: string | null }>(arr: T[]) =>
    arr.filter(p => {
      const mF = filterFactory === "all" || p.factory === filterFactory;
      const mY = p.year === filterYear;
      const mM = filterMonth === null || p.month === filterMonth;
      const mSup = filterSupplier === "all" || p.supplier === filterSupplier;
      const q = search.toLowerCase();
      const mS = !q || p.supplier.toLowerCase().includes(q) || p.tool_type.toLowerCase().includes(q) || (p.tool_code || "").toLowerCase().includes(q);
      return mF && mY && mM && mSup && mS;
    });

  const filtered = applyFilter(purchases);
  const filteredC = applyFilter(consumptions);

  const supplierOptions = [...new Set([...purchases, ...consumptions].map(p => p.supplier))].sort();

  /* ─── Chart data ─── */
  const monthlyCompareData = MONTHS.map((name, idx) => {
    const month = idx + 1;
    const p = purchases.filter(x => x.year === filterYear && (filterFactory === "all" || x.factory === filterFactory) && x.month === month);
    const c = consumptions.filter(x => x.year === filterYear && (filterFactory === "all" || x.factory === filterFactory) && x.month === month);
    return {
      name: name.slice(0, 3),
      alım: p.reduce((s, i) => s + Number(i.total_amount), 0),
      sarfiyat: c.reduce((s, i) => s + Number(i.total_amount), 0),
    };
  });

  const supplierChartData = Object.entries(
    filtered.reduce((acc, p) => { acc[p.supplier] = (acc[p.supplier] || 0) + Number(p.total_amount); return acc; }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);

  const totalFiltered = filtered.reduce((s, i) => s + Number(i.total_amount), 0);
  const totalYear = purchases.filter(p => p.year === filterYear && (filterFactory === "all" || p.factory === filterFactory)).reduce((s, i) => s + Number(i.total_amount), 0);
  const totalConsumptionYear = consumptions.filter(p => p.year === filterYear && (filterFactory === "all" || p.factory === filterFactory)).reduce((s, i) => s + Number(i.total_amount), 0);

  const currentData = activeTab === "purchases" ? filtered : filteredC;
  const currentTotal = activeTab === "purchases" ? totalFiltered : filteredC.reduce((s, i) => s + Number(i.total_amount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-amber-400" />
            Aylık Takımhane Raporu
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Fabrika bazlı takım alımları, sarfiyat ve maliyet analizi</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {activeTab === "purchases" ? (
            <>
              <Button variant="outline" size="sm" onClick={downloadPurchaseTemplate} className="gap-1.5 text-xs">
                <FileDown className="w-3.5 h-3.5" /> Alım Şablonu
              </Button>
              <Button variant="outline" size="sm" onClick={() => purchaseFileRef.current?.click()} disabled={importing} className="gap-1.5 text-xs">
                <Upload className="w-3.5 h-3.5" /> {importing ? "Yükleniyor..." : "Excel Yükle"}
              </Button>
              <input ref={purchaseFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handlePurchaseFile} />
              <Button size="sm" onClick={() => exportToolroomPdf(filtered, filterFactory, filterYear, filterMonth)} className="gap-1.5 text-xs bg-amber-600 hover:bg-amber-700">
                <FileDown className="w-3.5 h-3.5" /> PDF Rapor
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={downloadConsumptionTemplate} className="gap-1.5 text-xs">
                <FileDown className="w-3.5 h-3.5" /> Sarfiyat Şablonu
              </Button>
              <Button variant="outline" size="sm" onClick={() => consumptionFileRef.current?.click()} disabled={importing} className="gap-1.5 text-xs">
                <Upload className="w-3.5 h-3.5" /> {importing ? "Yükleniyor..." : "Excel Yükle"}
              </Button>
              <input ref={consumptionFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleConsumptionFile} />
              <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-3.5 h-3.5" /> Manuel Giriş
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/30 rounded-lg p-1 w-fit">
        {([["purchases", "Alımlar", "text-amber-400"], ["consumptions", "Sarfiyat", "text-emerald-400"]] as const).map(([key, label, color]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === key ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <span className={activeTab === key ? color : ""}>{label}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterFactory} onValueChange={setFilterFactory}>
          <SelectTrigger className="w-[170px]">
            <Building2 className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Fabrikalar</SelectItem>
            {activeFactories.map(f => <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(filterYear)} onValueChange={v => setFilterYear(Number(v))}>
          <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterMonth === null ? "all" : String(filterMonth)} onValueChange={v => setFilterMonth(v === "all" ? null : Number(v))}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Aylar</SelectItem>
            {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSupplier} onValueChange={setFilterSupplier}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Tüm Tedarikçiler" />
          </SelectTrigger>
          <SelectContent className="z-50 bg-popover border border-border shadow-lg">
            <SelectItem value="all">Tüm Tedarikçiler</SelectItem>
            {supplierOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Tedarikçi, takım ara..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Filtrelenmiş Kayıt", value: currentData.length, icon: Package, color: "text-violet-400" },
          { label: "Toplam Tutar (Filtre)", value: `€ ${currentTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-amber-400" },
          { label: `${filterYear} Alım Toplam`, value: `€ ${totalYear.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: "text-emerald-400" },
          { label: `${filterYear} Sarfiyat Toplam`, value: `€ ${totalConsumptionYear.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`, icon: ArrowLeftRight, color: "text-sky-400" },
        ].map(card => (
          <div key={card.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      {(purchases.length > 0 || consumptions.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Alım vs Sarfiyat aylık karşılaştırma */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <ArrowLeftRight className="w-4 h-4 text-amber-400" /> {filterYear} Alım vs Sarfiyat (€)
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyCompareData} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip formatter={(v: number) => [`€ ${v.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="alım" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                <Bar dataKey="sarfiyat" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Ciro etkisi */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-amber-400" /> Takım Alımının Ciroya Etkisi ({filterYear})
            </h3>
            <div className="space-y-2 mb-3 max-h-[120px] overflow-y-auto pr-1">
              {activeFactories.map(f => {
                const purchase = purchases.filter(p => p.factory === f.name && p.year === filterYear).reduce((s, i) => s + Number(i.total_amount), 0);
                const rev = revenues[f.name] || 0;
                const pct = rev > 0 ? (purchase / rev) * 100 : null;
                return (
                  <div key={f.name} className="flex items-center gap-2 text-xs">
                    <span className="w-24 truncate text-muted-foreground font-medium">{f.name}</span>
                    {editingRevenue === f.name ? (
                      <div className="flex items-center gap-1 flex-1">
                        <span className="text-muted-foreground">€</span>
                        <Input className="h-6 text-xs py-0 px-1.5 flex-1" value={revenueInput} onChange={e => setRevenueInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") saveRevenue(f.name); if (e.key === "Escape") setEditingRevenue(null); }} autoFocus />
                        <button onClick={() => saveRevenue(f.name)} className="text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditingRevenue(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-1">
                        <span className="text-foreground">€ {rev > 0 ? rev.toLocaleString("tr-TR") : "—"}</span>
                        <button onClick={() => { setEditingRevenue(f.name); setRevenueInput(rev > 0 ? String(rev) : ""); }} className="text-muted-foreground hover:text-amber-400"><Edit2 className="w-3 h-3" /></button>
                        {pct !== null && (
                          <span className={`ml-auto font-bold ${pct > 5 ? "text-red-400" : pct > 2 ? "text-amber-400" : "text-emerald-400"}`}>%{pct.toFixed(2)}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {(() => {
              const data = activeFactories.map(f => {
                const purchase = purchases.filter(p => p.factory === f.name && p.year === filterYear).reduce((s, i) => s + Number(i.total_amount), 0);
                const rev = revenues[f.name] || 0;
                return { name: f.name.length > 8 ? f.name.slice(0, 8) + "…" : f.name, pct: rev > 0 ? parseFloat(((purchase / rev) * 100).toFixed(2)) : 0 };
              }).filter(d => d.pct > 0);
              if (data.length === 0) return <p className="text-xs text-muted-foreground text-center py-8">Fabrikaların ciro bilgisini girin.</p>;
              return (
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `%${v}`} />
                    <Tooltip formatter={(v: number) => [`%${v}`, "Ciro Etkisi"]} />
                    <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                      {data.map((d, i) => <Cell key={i} fill={d.pct > 5 ? "#ef4444" : d.pct > 2 ? "#f59e0b" : "#10b981"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
        </div>
      )}

      {/* Supplier chart */}
      {supplierChartData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <Package className="w-4 h-4 text-amber-400" /> Tedarikçi Bazlı Harcama (€)
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(200, supplierChartData.length * 36)}>
            <BarChart data={supplierChartData} layout="vertical" margin={{ top: 0, right: 60, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
              <Tooltip formatter={(v: number) => [`€ ${v.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`, "Tutar"]} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 10, fill: "hsl(var(--muted-foreground))", formatter: (v: number) => `€${(v / 1000).toFixed(1)}k` }}>
                {supplierChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">{currentData.length} kayıt</span>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-amber-400">€ {currentTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span>
            {hasEditAccess && currentData.length > 0 && (
              <button
                onClick={() => setConfirmDeleteMonth(true)}
                className="flex items-center gap-1.5 text-xs text-destructive/70 hover:text-destructive border border-destructive/30 hover:border-destructive/60 rounded-lg px-2.5 py-1 transition-colors"
                title="Filtredeki tüm kayıtları sil"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Tümünü Sil
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Yükleniyor...</div>
        ) : currentData.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Package className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground text-sm">
              {activeTab === "purchases" ? "Excel şablonunu indirip yükleyin." : "Manuel giriş veya Excel ile sarfiyat ekleyin."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Fabrika","Ay","Tedarikçi","Takım Tipi","Takım Kodu","Miktar","Birim Fiyat","Toplam","Not",""].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentData.map((row, idx) => (
                  <tr key={row.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Badge variant="outline" className={`text-xs border-amber-500/30 ${activeTab === "purchases" ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"}`}>{row.factory}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{MONTHS[(row.month ?? 1) - 1]} {row.year}</td>
                    <td className="px-3 py-2 text-xs font-medium text-foreground">{row.supplier}</td>
                    <td className="px-3 py-2 text-xs text-foreground">{row.tool_type}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground font-mono">{row.tool_code || "—"}</td>
                    <td className="px-3 py-2 text-xs text-right text-foreground">{row.quantity}</td>
                    <td className="px-3 py-2 text-xs text-right text-foreground">€ {Number(row.unit_price).toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs text-right font-semibold text-amber-400">€ {Number(row.total_amount).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-[120px] truncate">{row.notes || "—"}</td>
                    <td className="px-3 py-2">
                      {hasEditAccess && (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openEdit(row)} className="text-muted-foreground hover:text-amber-400 transition-colors" title="Düzenle">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => activeTab === "purchases" ? handleDeletePurchase(row.id) : handleDeleteConsumption(row.id)} className="text-muted-foreground hover:text-destructive transition-colors" title="Sil">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Consumption Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-bold text-foreground">Manuel Sarfiyat Girişi</h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Fabrika *</label>
                <Select value={form.factory} onValueChange={v => setForm(f => ({ ...f, factory: v }))}>
                  <SelectTrigger><SelectValue placeholder="Fabrika seç" /></SelectTrigger>
                  <SelectContent className="z-[60] bg-popover border border-border shadow-lg">
                    {activeFactories.map(f => <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Yıl *</label>
                <Select value={String(form.year)} onValueChange={v => setForm(f => ({ ...f, year: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[60] bg-popover border border-border shadow-lg">
                    {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ay *</label>
                <Select value={String(form.month)} onValueChange={v => setForm(f => ({ ...f, month: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[60] bg-popover border border-border shadow-lg">
                    {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Tedarikçi *</label>
                <Input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Sandvik" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Takım Kodu</label>
                <Input value={form.tool_code || ""} onChange={e => setForm(f => ({ ...f, tool_code: e.target.value }))} placeholder="R290-12T308M-PM" className="font-mono" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Takım Tipi *</label>
                <Input value={form.tool_type} onChange={e => setForm(f => ({ ...f, tool_type: e.target.value }))} placeholder="Freze Ucu" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Miktar *</label>
                <Input type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Birim Fiyat (€) *</label>
                <Input type="number" min={0} step={0.01} value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: Number(e.target.value) }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Not</label>
                <Input value={form.notes || ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opsiyonel açıklama" />
              </div>
              <div className="col-span-2 bg-muted/30 rounded-lg px-3 py-2 text-sm flex justify-between">
                <span className="text-muted-foreground">Toplam:</span>
                <span className="font-bold text-emerald-400">€ {(form.quantity * form.unit_price).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t border-border">
              <Button onClick={handleSaveConsumption} disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                <Check className="w-4 h-4 mr-2" /> {saving ? "Kaydediliyor..." : "Kaydet"}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>İptal</Button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Preview Dialog */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h3 className="font-bold text-foreground">Excel Önizleme — {previewMode === "purchases" ? "Alımlar" : "Sarfiyat"}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{preview.length} kayıt okundu</p>
              </div>
              <button onClick={() => setShowPreview(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {["Fabrika","Yıl","Ay","Tedarikçi","Takım Tipi","Kod","Miktar","Birim Fiyat","Not"].map(h => (
                      <th key={h} className="text-left px-2 py-2 font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 100).map((row, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-2 py-1.5 text-amber-400 font-medium">{row.factory}</td>
                      <td className="px-2 py-1.5">{row.year}</td>
                      <td className="px-2 py-1.5">{MONTHS[(row.month ?? 1) - 1]}</td>
                      <td className="px-2 py-1.5">{row.supplier}</td>
                      <td className="px-2 py-1.5">{row.tool_type}</td>
                      <td className="px-2 py-1.5 font-mono">{row.tool_code || "—"}</td>
                      <td className="px-2 py-1.5 text-right">{row.quantity}</td>
                      <td className="px-2 py-1.5 text-right">€ {Number(row.unit_price).toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{row.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 100 && <p className="text-xs text-muted-foreground mt-2 text-center">...ve {preview.length - 100} satır daha</p>}
            </div>
            <div className="flex gap-3 p-4 border-t border-border">
              <Button onClick={handleImportConfirm} className={`flex-1 ${previewMode === "purchases" ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>
                <Upload className="w-4 h-4 mr-2" /> {preview.length} Kaydı Ekle
              </Button>
              <Button variant="outline" onClick={() => setShowPreview(false)}>İptal</Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Month Modal */}
      {confirmDeleteMonth && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Tümünü Sil</h3>
                  <p className="text-xs text-muted-foreground">Bu işlem geri alınamaz</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Mevcut filtre kapsamındaki <span className="font-bold text-foreground">{currentData.length}</span> kayıt kalıcı olarak silinecek. Emin misiniz?
              </p>
              <div className="flex gap-2">
                <Button onClick={handleDeleteByMonth} variant="destructive" className="flex-1">Evet, Sil</Button>
                <Button onClick={() => setConfirmDeleteMonth(false)} variant="outline" className="flex-1">İptal</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editRow && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-bold text-foreground">Kaydı Düzenle</h3>
              <button onClick={() => setEditRow(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Fabrika *</label>
                <Select value={editForm.factory} onValueChange={v => setEditForm(f => ({ ...f, factory: v }))}>
                  <SelectTrigger><SelectValue placeholder="Fabrika seç" /></SelectTrigger>
                  <SelectContent className="z-[60] bg-popover border border-border shadow-lg">
                    {factories.filter(f => f.is_active).map(f => <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Yıl *</label>
                <Select value={String(editForm.year)} onValueChange={v => setEditForm(f => ({ ...f, year: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[60] bg-popover border border-border shadow-lg">
                    {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ay *</label>
                <Select value={String(editForm.month)} onValueChange={v => setEditForm(f => ({ ...f, month: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[60] bg-popover border border-border shadow-lg">
                    {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Tedarikçi *</label>
                <Input value={editForm.supplier} onChange={e => setEditForm(f => ({ ...f, supplier: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Takım Kodu</label>
                <Input value={editForm.tool_code || ""} onChange={e => setEditForm(f => ({ ...f, tool_code: e.target.value }))} className="font-mono" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Takım Tipi *</label>
                <Input value={editForm.tool_type} onChange={e => setEditForm(f => ({ ...f, tool_type: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Miktar *</label>
                <Input type="number" min={1} value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Birim Fiyat (€) *</label>
                <Input type="number" min={0} step={0.01} value={editForm.unit_price} onChange={e => setEditForm(f => ({ ...f, unit_price: Number(e.target.value) }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Not</label>
                <Input value={editForm.notes || ""} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="col-span-2 bg-muted/30 rounded-lg px-3 py-2 text-sm flex justify-between">
                <span className="text-muted-foreground">Toplam:</span>
                <span className="font-bold text-amber-400">€ {(editForm.quantity * editForm.unit_price).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t border-border">
              <Button onClick={handleEditSave} disabled={editSaving} className="flex-1 bg-amber-600 hover:bg-amber-700">
                <Check className="w-4 h-4 mr-2" /> {editSaving ? "Kaydediliyor..." : "Güncelle"}
              </Button>
              <Button variant="outline" onClick={() => setEditRow(null)}>İptal</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
