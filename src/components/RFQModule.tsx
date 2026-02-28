import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomers } from "@/hooks/useCustomers";
import { useMachines } from "@/hooks/useMachines";
import { useCoatings } from "@/hooks/useCoatings";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Plus, Trash2, FileText, Send, CheckCircle, XCircle,
  Clock, Euro, Package, Wrench, ChevronDown, ChevronUp,
  DownloadCloud, Edit2, Save, X, RefreshCw
} from "lucide-react";
import { exportRfqPdf } from "@/lib/exportRfqPdf";

interface Operation {
  id: string;
  machine_id: string;
  machine_label: string;
  operation_type: string;
  time_minutes: number;
  minute_rate: number;
  cost: number;
}

interface RFQQuote {
  id: string;
  quote_number: string;
  customer_name: string;
  part_name: string;
  material: string | null;
  quantity: number;
  factory: string;
  status: string;
  material_cost: number;
  machining_cost: number;
  setup_cost: number;
  coating_cost: number;
  overhead_percent: number;
  profit_margin: number;
  manual_adjustment: number;
  total_cost: number;
  unit_price: number;
  currency: string;
  operations: Operation[];
  notes: string | null;
  validity_days: number;
  delivery_days: number | null;
  created_at: string;
  sent_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: "Taslak", color: "bg-muted/60 text-muted-foreground border-border", icon: Clock },
  sent: { label: "Gönderildi", color: "bg-blue-500/10 text-blue-400 border-blue-500/30", icon: Send },
  approved: { label: "Onaylandı", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icon: CheckCircle },
  rejected: { label: "Reddedildi", color: "bg-red-500/10 text-red-400 border-red-500/30", icon: XCircle },
};

const OPERATION_TYPES = ["Tornalama", "Frezeleme", "Delme", "Taşlama", "Diş açma", "Kaynak", "Diğer"];

const generateQuoteNumber = () => {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const r = String(Math.floor(Math.random() * 9000) + 1000);
  return `RFQ-${y}${m}${d}-${r}`;
};

export default function RFQModule() {
  const { user } = useAuth();
  const { activeCustomers } = useCustomers();
  const { machines } = useMachines();
  const { activeCoatings } = useCoatings();

  const [quotes, setQuotes] = useState<RFQQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "form" | "detail">("list");
  const [selectedQuote, setSelectedQuote] = useState<RFQQuote | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    quote_number: generateQuoteNumber(),
    customer_name: "",
    part_name: "",
    material: "",
    quantity: 1,
    factory: "Havacılık",
    material_cost: 0,
    setup_cost: 0,
    coating_id: "",
    overhead_percent: 15,
    profit_margin: 20,
    manual_adjustment: 0,
    validity_days: 30,
    delivery_days: 14,
    notes: "",
    currency: "EUR",
  });
  const [operations, setOperations] = useState<Operation[]>([]);

  useEffect(() => { loadQuotes(); }, []);

  const loadQuotes = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("rfq_quotes" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setQuotes(data as any[]);
    setLoading(false);
  };

  // Derived calculations
  const calcMachiningCost = () =>
    operations.reduce((sum, op) => sum + op.cost, 0);

  const calcCoatingCost = () => {
    if (!form.coating_id) return 0;
    const coating = activeCoatings.find(c => c.id === form.coating_id);
    return coating ? coating.price * form.quantity : 0;
  };

  const calcSubtotal = () =>
    form.material_cost + calcMachiningCost() + form.setup_cost + calcCoatingCost();

  const calcOverhead = () => calcSubtotal() * (form.overhead_percent / 100);
  const calcProfit = () => (calcSubtotal() + calcOverhead()) * (form.profit_margin / 100);
  const calcTotal = () => calcSubtotal() + calcOverhead() + calcProfit() + form.manual_adjustment;
  const calcUnitPrice = () => form.quantity > 0 ? calcTotal() / form.quantity : 0;

  const addOperation = () => {
    const newOp: Operation = {
      id: crypto.randomUUID(),
      machine_id: "",
      machine_label: "",
      operation_type: "Tornalama",
      time_minutes: 0,
      minute_rate: 0,
      cost: 0,
    };
    setOperations(prev => [...prev, newOp]);
  };

  const updateOperation = (id: string, field: keyof Operation, value: string | number) => {
    setOperations(prev => prev.map(op => {
      if (op.id !== id) return op;
      const updated = { ...op, [field]: value };
      if (field === "machine_id") {
        const m = machines.find(x => x.id === value);
        if (m) {
          updated.machine_label = m.label;
          updated.minute_rate = m.minute_rate || 0;
        }
      }
      updated.cost = (updated.time_minutes * updated.minute_rate);
      return updated;
    }));
  };

  const removeOperation = (id: string) => setOperations(prev => prev.filter(op => op.id !== id));

  const handleSave = async () => {
    if (!user || !form.customer_name || !form.part_name) {
      toast.error("Müşteri ve parça adı zorunludur");
      return;
    }
    setSaving(true);
    const totalCost = calcTotal();
    const unitPrice = calcUnitPrice();
    const coatingCost = calcCoatingCost();
    const machiningCost = calcMachiningCost();

    const payload: any = {
      user_id: user.id,
      quote_number: form.quote_number,
      customer_name: form.customer_name,
      part_name: form.part_name,
      material: form.material || null,
      quantity: form.quantity,
      factory: form.factory,
      status: "draft",
      material_cost: form.material_cost,
      machining_cost: machiningCost,
      setup_cost: form.setup_cost,
      coating_cost: coatingCost,
      overhead_percent: form.overhead_percent,
      profit_margin: form.profit_margin,
      manual_adjustment: form.manual_adjustment,
      total_cost: totalCost,
      unit_price: unitPrice,
      currency: form.currency,
      operations: operations,
      notes: form.notes || null,
      validity_days: form.validity_days,
      delivery_days: form.delivery_days,
    };

    const { error } = await supabase.from("rfq_quotes" as any).insert(payload);
    if (error) {
      toast.error("Kayıt hatası: " + error.message);
    } else {
      toast.success("Teklif kaydedildi");
      setView("list");
      setForm({ ...form, quote_number: generateQuoteNumber() });
      setOperations([]);
      loadQuotes();
    }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const update: any = { status };
    if (status === "sent") update.sent_at = new Date().toISOString();
    if (status === "approved") update.approved_at = new Date().toISOString();
    if (status === "rejected") update.rejected_at = new Date().toISOString();
    await supabase.from("rfq_quotes" as any).update(update).eq("id", id);
    toast.success("Durum güncellendi");
    loadQuotes();
  };

  const deleteQuote = async (id: string) => {
    await supabase.from("rfq_quotes" as any).delete().eq("id", id);
    toast.success("Teklif silindi");
    loadQuotes();
  };

  const handleExportPdf = async (q: RFQQuote) => {
    await exportRfqPdf(q);
  };

  if (view === "form") {
    return <RFQForm
      form={form}
      setForm={setForm}
      operations={operations}
      customers={activeCustomers}
      machines={machines}
      coatings={activeCoatings}
      onAddOp={addOperation}
      onUpdateOp={updateOperation}
      onRemoveOp={removeOperation}
      calcMachiningCost={calcMachiningCost}
      calcCoatingCost={calcCoatingCost}
      calcSubtotal={calcSubtotal}
      calcOverhead={calcOverhead}
      calcProfit={calcProfit}
      calcTotal={calcTotal}
      calcUnitPrice={calcUnitPrice}
      onSave={handleSave}
      onCancel={() => setView("list")}
      saving={saving}
    />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            RFQ – Teklif Yönetimi
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Talaşlı imalat teklifleri oluştur, takip et ve PDF olarak gönder</p>
        </div>
        <Button onClick={() => setView("form")} className="gap-2">
          <Plus className="w-4 h-4" />
          Yeni Teklif
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["draft", "sent", "approved", "rejected"] as const).map(s => {
          const count = quotes.filter(q => q.status === s).length;
          const cfg = STATUS_CONFIG[s];
          const Icon = cfg.icon;
          return (
            <div key={s} className={`p-4 rounded-xl border ${cfg.color} flex items-center gap-3`}>
              <Icon className="w-5 h-5 flex-shrink-0" />
              <div>
                <div className="text-xl font-bold">{count}</div>
                <div className="text-xs opacity-80">{cfg.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quote list */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Yükleniyor…</div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Henüz teklif oluşturulmadı</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => setView("form")}>
            <Plus className="w-4 h-4" /> İlk teklifini oluştur
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map(q => {
            const cfg = STATUS_CONFIG[q.status] ?? STATUS_CONFIG.draft;
            const Icon = cfg.icon;
            const isExpanded = expandedId === q.id;
            const ops: Operation[] = Array.isArray(q.operations) ? q.operations : [];
            return (
              <div key={q.id} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Row header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : q.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">{q.quote_number}</span>
                      <Badge variant="outline" className={`text-xs ${cfg.color}`}>
                        <Icon className="w-3 h-3 mr-1" />{cfg.label}
                      </Badge>
                    </div>
                    <div className="font-semibold text-foreground mt-0.5 truncate">{q.part_name}</div>
                    <div className="text-sm text-muted-foreground">{q.customer_name} · {q.factory} · {q.quantity} adet</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold text-primary">{q.unit_price.toFixed(2)} {q.currency}</div>
                    <div className="text-xs text-muted-foreground">Birim fiyat</div>
                    <div className="text-xs text-muted-foreground">Toplam: {q.total_cost.toFixed(2)} {q.currency}</div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-4 bg-muted/10">
                    {/* Operations */}
                    {ops.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Operasyonlar</p>
                        <div className="space-y-1">
                          {ops.map((op, i) => (
                            <div key={i} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/30">
                              <span className="text-foreground">{op.operation_type} – {op.machine_label || "Tezgah seçilmedi"}</span>
                              <span className="font-mono text-muted-foreground">{op.time_minutes} dk → <span className="text-primary">{op.cost.toFixed(2)} {q.currency}</span></span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cost breakdown */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <CostChip label="Malzeme" value={q.material_cost} currency={q.currency} />
                      <CostChip label="İşleme" value={q.machining_cost} currency={q.currency} />
                      <CostChip label="Setup" value={q.setup_cost} currency={q.currency} />
                      <CostChip label="Kaplama" value={q.coating_cost} currency={q.currency} />
                    </div>

                    {q.notes && <p className="text-sm text-muted-foreground italic">📝 {q.notes}</p>}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {q.status === "draft" && (
                        <Button size="sm" variant="outline" className="gap-1 text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                          onClick={() => updateStatus(q.id, "sent")}>
                          <Send className="w-3 h-3" /> Gönderildi İşaretle
                        </Button>
                      )}
                      {q.status === "sent" && (<>
                        <Button size="sm" variant="outline" className="gap-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                          onClick={() => updateStatus(q.id, "approved")}>
                          <CheckCircle className="w-3 h-3" /> Onayla
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-red-400 border-red-500/30 hover:bg-red-500/10"
                          onClick={() => updateStatus(q.id, "rejected")}>
                          <XCircle className="w-3 h-3" /> Reddet
                        </Button>
                      </>)}
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => handleExportPdf(q)}>
                        <DownloadCloud className="w-3 h-3" /> PDF
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 ml-auto"
                        onClick={() => deleteQuote(q.id)}>
                        <Trash2 className="w-3 h-3" /> Sil
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CostChip({ label, value, currency }: { label: string; value: number; currency: string }) {
  return (
    <div className="p-2 rounded-lg bg-muted/40 border border-border/50">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold text-sm">{value.toFixed(2)} <span className="text-xs text-muted-foreground">{currency}</span></div>
    </div>
  );
}

// ─── Form Component ────────────────────────────────────────────────────────
function RFQForm({ form, setForm, operations, customers, machines, coatings,
  onAddOp, onUpdateOp, onRemoveOp,
  calcMachiningCost, calcCoatingCost, calcSubtotal, calcOverhead, calcProfit, calcTotal, calcUnitPrice,
  onSave, onCancel, saving }: any) {

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Yeni Teklif Oluştur</h2>
          <p className="text-sm text-muted-foreground font-mono">{form.quote_number}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} className="gap-2"><X className="w-4 h-4" /> İptal</Button>
          <Button onClick={onSave} disabled={saving} className="gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Kaydet
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-4">
          {/* General info */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> Genel Bilgiler</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Müşteri *</Label>
                <Select value={form.customer_name} onValueChange={v => setForm((f: any) => ({ ...f, customer_name: v }))}>
                  <SelectTrigger><SelectValue placeholder="Müşteri seç…" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fabrika</Label>
                <Select value={form.factory} onValueChange={v => setForm((f: any) => ({ ...f, factory: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Havacılık">Havacılık</SelectItem>
                    <SelectItem value="Raylı Sistemler">Raylı Sistemler</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Parça Adı *</Label>
                <Input value={form.part_name} onChange={e => setForm((f: any) => ({ ...f, part_name: e.target.value }))} placeholder="Örn: Flanş Kapak" />
              </div>
              <div className="space-y-1.5">
                <Label>Malzeme</Label>
                <Input value={form.material} onChange={e => setForm((f: any) => ({ ...f, material: e.target.value }))} placeholder="Örn: C45, 7075-T6" />
              </div>
              <div className="space-y-1.5">
                <Label>Sipariş Adedi</Label>
                <Input type="number" min="1" value={form.quantity} onChange={e => setForm((f: any) => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Para Birimi</Label>
                <Select value={form.currency} onValueChange={v => setForm((f: any) => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR €</SelectItem>
                    <SelectItem value="USD">USD $</SelectItem>
                    <SelectItem value="TRY">TRY ₺</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Operations */}
          <Card className="border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Wrench className="w-4 h-4 text-primary" /> Operasyonlar</CardTitle>
              <Button size="sm" variant="outline" onClick={onAddOp} className="gap-1"><Plus className="w-3 h-3" /> Ekle</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {operations.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Operasyon eklenmedi. Tezgah süresi ve maliyetlerini girmek için "Ekle"ye tıkla.</p>
              )}
              {operations.map((op: Operation) => (
                <div key={op.id} className="grid grid-cols-12 gap-2 p-3 rounded-lg border border-border/60 bg-muted/20">
                  <div className="col-span-12 sm:col-span-4">
                    <Label className="text-xs mb-1">Tezgah</Label>
                    <Select value={op.machine_id} onValueChange={v => onUpdateOp(op.id, "machine_id", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seç…" /></SelectTrigger>
                      <SelectContent>
                        {machines.filter((m: any) => m.minute_rate > 0).map((m: any) => (
                          <SelectItem key={m.id} value={m.id}>{m.label} ({m.minute_rate} {form.currency}/dk)</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <Label className="text-xs mb-1">Operasyon</Label>
                    <Select value={op.operation_type} onValueChange={v => onUpdateOp(op.id, "operation_type", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OPERATION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Label className="text-xs mb-1">Süre (dk)</Label>
                    <Input className="h-8 text-xs" type="number" min="0" value={op.time_minutes}
                      onChange={e => onUpdateOp(op.id, "time_minutes", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-6 sm:col-span-2 flex items-end">
                    <div className="w-full p-1.5 rounded bg-primary/10 text-center">
                      <span className="text-xs text-muted-foreground">Maliyet</span>
                      <div className="text-sm font-bold text-primary">{op.cost.toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex items-end justify-center">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => onRemoveOp(op.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Additional costs */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Euro className="w-4 h-4 text-primary" /> Ek Maliyetler</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Malzeme Maliyeti ({form.currency})</Label>
                <Input type="number" min="0" step="0.01" value={form.material_cost}
                  onChange={e => setForm((f: any) => ({ ...f, material_cost: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Setup Maliyeti ({form.currency})</Label>
                <Input type="number" min="0" step="0.01" value={form.setup_cost}
                  onChange={e => setForm((f: any) => ({ ...f, setup_cost: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Kaplama</Label>
                <Select value={form.coating_id || "none"} onValueChange={v => setForm((f: any) => ({ ...f, coating_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Yok" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Yok</SelectItem>
                    {coatings.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.price} {form.currency})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Genel Gider (%)</Label>
                <Input type="number" min="0" max="100" value={form.overhead_percent}
                  onChange={e => setForm((f: any) => ({ ...f, overhead_percent: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Kâr Marjı (%)</Label>
                <Input type="number" min="0" max="200" value={form.profit_margin}
                  onChange={e => setForm((f: any) => ({ ...f, profit_margin: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Manuel Düzeltme ({form.currency})</Label>
                <Input type="number" step="0.01" value={form.manual_adjustment}
                  onChange={e => setForm((f: any) => ({ ...f, manual_adjustment: parseFloat(e.target.value) || 0 }))} />
              </div>
            </CardContent>
          </Card>

          {/* Notes & terms */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Koşullar & Notlar</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Teklif Geçerlilik (gün)</Label>
                <Input type="number" min="1" value={form.validity_days}
                  onChange={e => setForm((f: any) => ({ ...f, validity_days: parseInt(e.target.value) || 30 }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Teslimat Süresi (gün)</Label>
                <Input type="number" min="1" value={form.delivery_days}
                  onChange={e => setForm((f: any) => ({ ...f, delivery_days: parseInt(e.target.value) || 14 }))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notlar</Label>
                <Textarea value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))}
                  placeholder="Ek koşullar, özel talepler…" rows={3} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Cost summary */}
        <div className="space-y-4">
          <Card className="border-primary/30 bg-primary/5 sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-primary">Maliyet Özeti</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <SummaryRow label="Malzeme" value={form.material_cost} currency={form.currency} />
              <SummaryRow label="İşleme" value={calcMachiningCost()} currency={form.currency} />
              <SummaryRow label="Setup" value={form.setup_cost} currency={form.currency} />
              <SummaryRow label="Kaplama" value={calcCoatingCost()} currency={form.currency} />
              <Separator className="my-2" />
              <SummaryRow label="Ara toplam" value={calcSubtotal()} currency={form.currency} />
              <SummaryRow label={`Genel Gider (${form.overhead_percent}%)`} value={calcOverhead()} currency={form.currency} />
              <SummaryRow label={`Kâr (${form.profit_margin}%)`} value={calcProfit()} currency={form.currency} />
              {form.manual_adjustment !== 0 && (
                <SummaryRow label="Düzeltme" value={form.manual_adjustment} currency={form.currency} />
              )}
              <Separator className="my-2" />
              <div className="flex justify-between items-center pt-1">
                <span className="text-sm font-bold text-foreground">Genel Toplam</span>
                <span className="text-lg font-bold text-primary">{calcTotal().toFixed(2)} {form.currency}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Birim Fiyat ({form.quantity} adet)</span>
                <span className="text-base font-bold text-emerald-400">{calcUnitPrice().toFixed(2)} {form.currency}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, currency }: { label: string; value: number; currency: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value.toFixed(2)} <span className="text-xs text-muted-foreground">{currency}</span></span>
    </div>
  );
}
