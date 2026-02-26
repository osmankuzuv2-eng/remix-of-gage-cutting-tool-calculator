import { useState, useCallback, useEffect, useRef } from "react";
import {
  BarChart3, Upload, FileDown, Plus, Trash2, Search, Filter,
  TrendingUp, Package, DollarSign, Building2, ChevronDown, X
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
  Tooltip, ResponsiveContainer, Legend, Cell
} from "recharts";
import * as ExcelJS from "exceljs";

const MONTHS = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
const COLORS = ["#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444","#ec4899","#6366f1","#84cc16"];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

/* ─── Excel şablonu indir ─── */
const downloadTemplate = async () => {
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
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF161A26" } };
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  // Example row
  ws.addRow(["Havacılık", currentYear, 1, "Sandvik", "Freze Ucu", "R290-12T308M-PM", 10, 45.50, "Stok tamamlama"]);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "takimhane-sablon.xlsx"; a.click();
  URL.revokeObjectURL(url);
};

export default function ToolroomReport() {
  const { user } = useAuth();
  const { factories } = useFactories();
  const [purchases, setPurchases] = useState<ToolroomPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  /* filters */
  const [filterFactory, setFilterFactory] = useState("all");
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterMonth, setFilterMonth] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  /* excel import */
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<Omit<ToolroomPurchase, "id" | "total_amount">[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      setIsAdmin(data?.some(r => r.role === "admin") ?? false);
    });
  }, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("toolroom_purchases").select("*").order("year", { ascending: false }).order("month", { ascending: false });
    if (data) setPurchases(data as ToolroomPurchase[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ─── Excel parse ─── */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const ws = wb.worksheets[0];
      const rows: Omit<ToolroomPurchase, "id" | "total_amount">[] = [];
      ws.eachRow((row, idx) => {
        if (idx === 1) return; // skip header
        const vals = row.values as any[];
        const factory = String(vals[1] ?? "").trim();
        const year = Number(vals[2]);
        const month = Number(vals[3]);
        const supplier = String(vals[4] ?? "").trim();
        const tool_code = String(vals[5] ?? "").trim() || null;
        const tool_type = String(vals[6] ?? "").trim();
        if (!factory || !supplier || !tool_type || !year || !month) return;
        rows.push({
          factory, year, month, supplier, tool_type,
          tool_code,
          quantity: Number(vals[7]) || 1,
          unit_price: Number(vals[8]) || 0,
          notes: String(vals[9] ?? "").trim() || null,
        });
      });
      setPreview(rows);
      setShowPreview(true);
    } catch {
      toast.error("Excel dosyası okunamadı. Şablonu kullanarak tekrar deneyin.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleImportConfirm = async () => {
    if (preview.length === 0) return;
    const { error } = await (supabase as any).from("toolroom_purchases").insert(preview as any[]);
    if (error) { toast.error("Kayıt sırasında hata oluştu."); return; }
    toast.success(`${preview.length} kayıt başarıyla eklendi!`);
    setShowPreview(false);
    setPreview([]);
    load();
  };

  const handleDelete = async (id: string) => {
    await (supabase as any).from("toolroom_purchases").delete().eq("id", id);
    toast.success("Kayıt silindi.");
    load();
  };

  /* ─── Filtered data ─── */
  const filtered = purchases.filter(p => {
    const mF = filterFactory === "all" || p.factory === filterFactory;
    const mY = p.year === filterYear;
    const mM = filterMonth === null || p.month === filterMonth;
    const q = search.toLowerCase();
    const mS = !q || p.supplier.toLowerCase().includes(q) || p.tool_type.toLowerCase().includes(q) || (p.tool_code || "").toLowerCase().includes(q);
    return mF && mY && mM && mS;
  });

  /* ─── Chart data ─── */
  const monthlyData = MONTHS.map((name, idx) => {
    const month = idx + 1;
    const items = purchases.filter(p =>
      p.year === filterYear &&
      (filterFactory === "all" || p.factory === filterFactory) &&
      p.month === month
    );
    return { name: name.slice(0, 3), total: items.reduce((s, i) => s + Number(i.total_amount), 0) };
  });

  const activeFactories = factories.filter(f => f.is_active);
  const factoryData = activeFactories.map(f => ({
    name: f.name,
    total: purchases.filter(p => p.factory === f.name && p.year === filterYear).reduce((s, i) => s + Number(i.total_amount), 0),
  })).filter(f => f.total > 0);

  const totalFiltered = filtered.reduce((s, i) => s + Number(i.total_amount), 0);
  const totalYear = purchases.filter(p => p.year === filterYear && (filterFactory === "all" || p.factory === filterFactory)).reduce((s, i) => s + Number(i.total_amount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-amber-400" />
            Aylık Takımhane Raporu
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Fabrika bazlı takım alımları ve maliyet analizi</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5 text-xs">
            <FileDown className="w-3.5 h-3.5" /> Şablon İndir
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing} className="gap-1.5 text-xs">
            <Upload className="w-3.5 h-3.5" /> {importing ? "Yükleniyor..." : "Excel Yükle"}
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
          <Button size="sm" onClick={() => exportToolroomPdf(filtered, filterFactory, filterYear, filterMonth)} className="gap-1.5 text-xs bg-amber-600 hover:bg-amber-700">
            <FileDown className="w-3.5 h-3.5" /> PDF Rapor
          </Button>
        </div>
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
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Tedarikçi, takım ara..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Filtrelenmiş Kayıt", value: filtered.length, icon: Package, color: "text-violet-400" },
          { label: "Toplam Tutar (Filtre)", value: `€ ${totalFiltered.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-amber-400" },
          { label: `${filterYear} Yıllık Toplam`, value: `€ ${totalYear.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: "text-emerald-400" },
          { label: "Tedarikçi", value: [...new Set(filtered.map(f => f.supplier))].length, icon: Building2, color: "text-sky-400" },
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
      {purchases.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-amber-400" /> {filterYear} Aylık Alım Trendi (€)
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip formatter={(v: number) => [`€ ${v.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`, "Tutar"]} />
                <Line type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-amber-400" /> {filterYear} Fabrika Bazlı Maliyet (€)
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={factoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip formatter={(v: number) => [`€ ${v.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`, "Tutar"]} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {factoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">{filtered.length} kayıt</span>
          <span className="text-sm font-bold text-amber-400">€ {totalFiltered.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span>
        </div>
        {loading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Yükleniyor...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Package className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground text-sm">Veri bulunamadı. Excel şablonunu indirip yükleyin.</p>
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
                {filtered.map((row, idx) => (
                  <tr key={row.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/30">{row.factory}</Badge>
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
                      {isAdmin && (
                        <button onClick={() => handleDelete(row.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Excel Preview Dialog */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h3 className="font-bold text-foreground">Excel Önizleme</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{preview.length} kayıt okundu — onayladıktan sonra veritabanına eklenecek</p>
              </div>
              <button onClick={() => setShowPreview(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
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
              <Button onClick={handleImportConfirm} className="flex-1 bg-amber-600 hover:bg-amber-700">
                <Upload className="w-4 h-4 mr-2" /> {preview.length} Kaydı Ekle
              </Button>
              <Button variant="outline" onClick={() => setShowPreview(false)}>İptal</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
