import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Upload, Loader2, Sparkles, FileText, Wrench, Package,
  Euro, Plus, Trash2, Edit2, Save, X, ChevronDown, ChevronUp,
  DownloadCloud, RefreshCw, Layers, CheckCircle, ClipboardList,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMachines } from "@/hooks/useMachines";
import { useAuth } from "@/contexts/AuthContext";
import jsPDF from "jspdf";

// ─── File helpers ─────────────────────────────────────────────────────────────

async function convertPdfToJpg(file: File): Promise<File> {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;
  const buf = await file.arrayBuffer();
  const pdf = await getDocument({ data: new Uint8Array(buf) }).promise;
  const scale = 2;
  const GAP = 20;
  const canvases: HTMLCanvasElement[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale });
    const c = document.createElement("canvas");
    c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
    canvases.push(c);
  }
  const totalW = Math.max(...canvases.map(c => c.width));
  const totalH = canvases.reduce((s, c) => s + c.height, 0) + GAP * (canvases.length - 1);
  const final = document.createElement("canvas");
  final.width = totalW; final.height = totalH;
  const ctx = final.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, totalW, totalH);
  let y = 0;
  for (const c of canvases) { ctx.drawImage(c, 0, y); y += c.height + GAP; }
  const blob = await new Promise<Blob>(res => final.toBlob(b => res(b!), "image/jpeg", 0.9));
  return new File([blob], file.name.replace(/\.pdf$/i, ".jpg"), { type: "image/jpeg" });
}

async function convertTifToJpg(file: File): Promise<File> {
  const UTIF = await import("utif2");
  const buf = await file.arrayBuffer();
  const ifds = UTIF.decode(buf);
  UTIF.decodeImage(buf, ifds[0]);
  const rgba = UTIF.toRGBA8(ifds[0]);
  const w = ifds[0].width; const h = ifds[0].height;
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const id = ctx.createImageData(w, h); id.data.set(rgba); ctx.putImageData(id, 0, 0);
  const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), "image/jpeg", 0.9));
  return new File([blob], file.name.replace(/\.tiff?$/i, ".jpg"), { type: "image/jpeg" });
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res((reader.result as string).split(",")[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface QuoteOperation {
  id: string;
  step: number;
  name: string;
  machine_type: string;
  machine_id: string;
  estimated_time_min: number;
  minute_rate: number;
  cost: number;
  description: string;
}

interface QuoteData {
  part_name: string;
  material: string;
  material_category: string;
  dimensions: { length_mm: number; width_mm: number; height_mm: number };
  estimated_weight_kg: number;
  tightest_tolerance: string;
  surface_finish: string;
  features: string[];
  operations: QuoteOperation[];
  setup_count: number;
  setup_time_min: number;
  complexity: string;
  notes: string;
  // STEP-specific extras
  estimated_volume_cm3?: number;
  estimated_surface_area_cm2?: number;
  face_count?: number;
  bounding_box?: {
    x_min: number; x_max: number;
    y_min: number; y_max: number;
    z_min: number; z_max: number;
    length_mm: number; width_mm: number; height_mm: number;
  };
  material_hint?: string | null;
}

const MACHINE_TYPES = ["Freze", "Torna", "Taşlama", "Delme", "Tel Erozyon", "5 Eksen"];
const COMPLEXITY_COLOR: Record<string, string> = {
  Basit: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  Orta: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  Karmaşık: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  "Çok Karmaşık": "bg-red-500/10 text-red-400 border-red-500/30",
};

const MATERIAL_PRICE_KG: Record<string, number> = {
  Alüminyum: 8, Çelik: 3, "Paslanmaz Çelik": 15, "Dökme Demir": 2.5,
  Titanyum: 80, "Bakır/Pirinç": 20, Plastik: 6, Diğer: 10,
};

function generateId() { return `op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

// ─── Main Component ──────────────────────────────────────────────────────────

const CatpartQuoteModule = () => {
  const { user } = useAuth();
  const { machines } = useMachines();
  const fileRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<"upload" | "analyzing" | "quote">("upload");
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [quote, setQuote] = useState<QuoteData | null>(null);

  // Quote settings
  const [quantity, setQuantity] = useState(1);
  const [overhead, setOverhead] = useState(15);
  const [margin, setMargin] = useState(20);
  const [setupHourlyRate, setSetupHourlyRate] = useState(60);
  const [currency, setCurrency] = useState("EUR");
  const [customerName, setCustomerName] = useState("");
  const [editingOp, setEditingOp] = useState<string | null>(null);
  const [showCostBreakdown, setShowCostBreakdown] = useState(true);

  // ── File processing ───────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    const isStep = /\.(step|stp)$/i.test(file.name);
    const isTif = /\.tiff?$/i.test(file.name);
    const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
    const isImage = /\.(jpe?g|png|webp)$/i.test(file.name) || ["image/jpeg","image/png","image/webp"].includes(file.type);

    if (!isStep && !isTif && !isPdf && !isImage) {
      toast.error("Desteklenmeyen format. STEP, STP, PDF, JPG, PNG veya TIF yükleyin.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) { toast.error("Dosya 50MB'dan büyük olamaz."); return; }

    setFileName(file.name);
    setStage("analyzing");

    try {
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      let data: any;

      if (isStep) {
        // ── STEP dosyası: metin olarak oku, step-parse edge function'a gönder ──
        const stepContent = await file.text();
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/step-parse`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
          body: JSON.stringify({ stepContent, language: "tr" }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        data = await res.json();
        // STEP'te görsel yok — bounding box bilgisi göster
        setPreviewUrl(null);
      } else {
        // ── Görsel/PDF: AI vision analizi ──
        let processedFile = file;
        if (isTif) processedFile = await convertTifToJpg(file);
        else if (isPdf) processedFile = await convertPdfToJpg(file);
        setPreviewUrl(URL.createObjectURL(processedFile));

        const base64 = await fileToBase64(processedFile);
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/catpart-quote-analyze`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
          body: JSON.stringify({ imageBase64: base64, mimeType: "image/jpeg", language: "tr" }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        data = await res.json();
      }

      // Map AI operations to QuoteOperation, matching machines
      const ops: QuoteOperation[] = (data.operations || []).map((op: any, idx: number) => {
        const machineMatch = machines.find(
          m => m.type.toLowerCase().includes(op.machine_type.toLowerCase()) ||
               op.machine_type.toLowerCase().includes(m.type.toLowerCase())
        );
        const rate = machineMatch?.minute_rate ?? 1.2;
        const time = op.estimated_time_min ?? 10;
        return {
          id: generateId(),
          step: idx + 1,
          name: op.name,
          machine_type: op.machine_type,
          machine_id: machineMatch?.id ?? "",
          estimated_time_min: time,
          minute_rate: rate,
          cost: time * rate,
          description: op.description,
        };
      });

      setQuote({
        part_name: data.part_name ?? "Parça",
        material: data.material ?? "",
        material_category: data.material_category ?? "Çelik",
        dimensions: data.dimensions ?? { length_mm: 0, width_mm: 0, height_mm: 0 },
        estimated_weight_kg: data.estimated_weight_kg ?? 0,
        tightest_tolerance: data.tightest_tolerance ?? "",
        surface_finish: data.surface_finish ?? "",
        features: data.features ?? [],
        operations: ops,
        setup_count: data.setup_count ?? 1,
        setup_time_min: data.setup_time_min ?? 15,
        complexity: data.complexity ?? "Orta",
        notes: data.notes ?? "",
        // Extra STEP fields
        estimated_volume_cm3: data.estimated_volume_cm3,
        estimated_surface_area_cm2: data.estimated_surface_area_cm2,
        face_count: data.face_count,
        bounding_box: data.bounding_box,
        material_hint: data.material_hint,
      });
      setStage("quote");
    } catch (e: any) {
      toast.error("Analiz hatası: " + e.message);
      setStage("upload");
    }
  }, [machines]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0]; if (file) processFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) processFile(file);
    e.target.value = "";
  };

  // ── Cost calculation ──────────────────────────────────────────────────────

  const materialCost = quote
    ? (MATERIAL_PRICE_KG[quote.material_category] ?? 10) * quote.estimated_weight_kg * 1.15
    : 0;
  const machiningCost = quote ? quote.operations.reduce((s, op) => s + op.cost, 0) : 0;
  const setupCost = quote ? (quote.setup_time_min / 60) * setupHourlyRate : 0;
  const subtotal = materialCost + machiningCost + setupCost;
  const overheadCost = subtotal * (overhead / 100);
  const marginCost = (subtotal + overheadCost) * (margin / 100);
  const totalPerPiece = (subtotal + overheadCost + marginCost);
  const totalOrder = totalPerPiece * quantity;

  // ── Operation helpers ─────────────────────────────────────────────────────

  const updateOp = (id: string, field: keyof QuoteOperation, value: any) => {
    setQuote(prev => {
      if (!prev) return prev;
      const ops = prev.operations.map(op => {
        if (op.id !== id) return op;
        const updated = { ...op, [field]: value };
        // Recalculate cost if time or rate changes
        if (field === "estimated_time_min" || field === "minute_rate") {
          updated.cost = updated.estimated_time_min * updated.minute_rate;
        }
        if (field === "machine_id") {
          const m = machines.find(m => m.id === value);
          if (m) {
            updated.minute_rate = m.minute_rate;
            updated.cost = updated.estimated_time_min * m.minute_rate;
          }
        }
        return updated;
      });
      return { ...prev, operations: ops };
    });
  };

  const addOp = () => {
    if (!quote) return;
    const newOp: QuoteOperation = {
      id: generateId(), step: quote.operations.length + 1,
      name: "Yeni Operasyon", machine_type: "Freze", machine_id: "",
      estimated_time_min: 15, minute_rate: 1.2, cost: 18, description: "",
    };
    setQuote(prev => prev ? { ...prev, operations: [...prev.operations, newOp] } : prev);
  };

  const removeOp = (id: string) => {
    setQuote(prev => {
      if (!prev) return prev;
      const ops = prev.operations.filter(o => o.id !== id).map((o, i) => ({ ...o, step: i + 1 }));
      return { ...prev, operations: ops };
    });
  };

  // ── PDF Export ────────────────────────────────────────────────────────────

  const exportPdf = async () => {
    if (!quote) return;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210; const M = 15;
    let y = M;

    const now = new Date();
    const dateStr = now.toLocaleDateString("tr-TR");
    const qNum = `CQ-${now.getFullYear().toString().slice(-2)}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}-${String(Math.floor(Math.random()*9000)+1000)}`;

    // Header bar
    pdf.setFillColor(15, 40, 80);
    pdf.rect(0, 0, W, 28, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16); pdf.setFont("helvetica", "bold");
    pdf.text("CATPART TEKLİF", M, 12);
    pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
    pdf.text(qNum, M, 19);
    pdf.text(dateStr, W - M, 19, { align: "right" });
    if (customerName) { pdf.setFontSize(10); pdf.text(customerName, W - M, 12, { align: "right" }); }
    y = 36;

    // Part info section
    pdf.setTextColor(15, 40, 80);
    pdf.setFontSize(11); pdf.setFont("helvetica", "bold");
    pdf.text("PARÇA BİLGİLERİ", M, y); y += 6;
    pdf.setDrawColor(15, 40, 80); pdf.setLineWidth(0.4);
    pdf.line(M, y, W - M, y); y += 4;

    const infoRows: [string, string][] = [
      ["Parça Adı", quote.part_name],
      ["Malzeme", `${quote.material} (${quote.material_category})`],
      ["Boyutlar (mm)", `${quote.dimensions.length_mm} x ${quote.dimensions.width_mm} x ${quote.dimensions.height_mm}`],
      ["Tahmini Ağırlık", `${quote.estimated_weight_kg.toFixed(3)} kg`],
      ["Tolerans Sınıfı", quote.tightest_tolerance || "-"],
      ["Yüzey Kalitesi", quote.surface_finish || "-"],
      ["Karmaşıklık", quote.complexity],
      ["Adet", quantity.toString()],
    ];
    pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
    infoRows.forEach(([label, value]) => {
      pdf.setTextColor(100, 100, 100); pdf.text(label + ":", M, y);
      pdf.setTextColor(20, 20, 20); pdf.text(value, M + 42, y);
      y += 5.5;
    });

    if (quote.features.length) {
      y += 2;
      pdf.setTextColor(100, 100, 100); pdf.text("Özellikler:", M, y);
      pdf.setTextColor(20, 20, 20);
      const featStr = quote.features.slice(0, 6).join(" | ");
      pdf.text(featStr.length > 90 ? featStr.slice(0,90) + "..." : featStr, M + 42, y);
      y += 5.5;
    }
    y += 4;

    // Operations table
    pdf.setTextColor(15, 40, 80);
    pdf.setFontSize(11); pdf.setFont("helvetica", "bold");
    pdf.text("İMALAT OPERASYONLARI", M, y); y += 6;
    pdf.line(M, y, W - M, y); y += 4;

    // Table header
    pdf.setFillColor(15, 40, 80); pdf.setTextColor(255, 255, 255);
    pdf.rect(M, y - 3, W - 2*M, 6, "F");
    pdf.setFontSize(8); pdf.setFont("helvetica", "bold");
    const cols = [M, M+8, M+60, M+95, M+120, M+140];
    ["#", "Operasyon", "Makine", "Süre (dk)", "€/dk", "Maliyet"].forEach((h, i) => {
      pdf.text(h, cols[i] + 1, y + 0.5);
    });
    y += 6;

    pdf.setFont("helvetica", "normal");
    quote.operations.forEach((op, idx) => {
      if (idx % 2 === 0) { pdf.setFillColor(248, 250, 252); pdf.rect(M, y-3, W-2*M, 5.5, "F"); }
      pdf.setTextColor(20, 20, 20);
      pdf.setFontSize(8);
      const machineName = op.machine_id ? machines.find(m => m.id === op.machine_id)?.label ?? op.machine_type : op.machine_type;
      [String(op.step), op.name.slice(0,24), machineName.slice(0,18), String(op.estimated_time_min), op.minute_rate.toFixed(2), op.cost.toFixed(2)].forEach((val, i) => {
        pdf.text(val, cols[i] + 1, y + 0.5);
      });
      y += 5.5;
    });
    y += 6;

    // Cost breakdown
    pdf.setTextColor(15, 40, 80);
    pdf.setFontSize(11); pdf.setFont("helvetica", "bold");
    pdf.text("MALİYET ANALİZİ", M, y); y += 6;
    pdf.line(M, y, W - M, y); y += 4;

    const costRows: [string, number][] = [
      ["Malzeme Maliyeti", materialCost],
      ["İşleme Maliyeti", machiningCost],
      ["Hazırlık (Setup) Maliyeti", setupCost],
      ["Genel Gider (%"+overhead+")", overheadCost],
      ["Kâr Marjı (%"+margin+")", marginCost],
    ];
    pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
    costRows.forEach(([label, val]) => {
      pdf.setTextColor(80, 80, 80);
      pdf.text(label, M, y);
      pdf.setTextColor(20, 20, 20);
      pdf.text(val.toFixed(2) + " " + currency, W - M, y, { align: "right" });
      y += 5;
    });

    // Total box
    y += 4;
    pdf.setFillColor(15, 40, 80); pdf.rect(M, y - 3, W - 2*M, 8, "F");
    pdf.setTextColor(255, 255, 255); pdf.setFontSize(11); pdf.setFont("helvetica", "bold");
    pdf.text("BİRİM FİYAT", M + 2, y + 2);
    pdf.text(totalPerPiece.toFixed(2) + " " + currency, W - M - 2, y + 2, { align: "right" });
    y += 12;

    if (quantity > 1) {
      pdf.setTextColor(15, 40, 80); pdf.setFontSize(10);
      pdf.text("Sipariş Toplamı (" + quantity + " adet):", M, y);
      pdf.setFont("helvetica", "bold");
      pdf.text(totalOrder.toFixed(2) + " " + currency, W - M, y, { align: "right" });
      y += 8;
    }

    if (quote.notes) {
      y += 2;
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text("Notlar: " + quote.notes.slice(0, 200), M, y, { maxWidth: W - 2*M });
    }

    pdf.save(`${qNum}_${quote.part_name.replace(/\s+/g, "_")}.pdf`);
    toast.success("PDF oluşturuldu");
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Layers className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                CATPART Teklif
                <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                  <Sparkles className="w-3 h-3 mr-1" /> AI
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground">
                PDF/Resim teknik çizimi yükle → AI analiz eder → Teklif oluşturur
              </p>
            </div>
          </div>
          {stage === "quote" && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setStage("upload"); setQuote(null); setPreviewUrl(null); }}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Yeni
              </Button>
              <Button size="sm" onClick={exportPdf} className="gap-1.5">
                <DownloadCloud className="w-3.5 h-3.5" /> PDF Teklif
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Stage */}
      {stage === "upload" && (
        <Card className="border-border bg-card">
          <CardContent className="p-8">
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-xl p-12 cursor-pointer transition-all duration-200 ${
                dragOver
                  ? "border-primary bg-primary/10 scale-[1.01]"
                  : "border-border hover:border-primary/50 hover:bg-primary/5"
              }`}
            >
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff" onChange={handleFileInput} className="hidden" />
              <div className="p-5 rounded-full bg-primary/10">
                <Upload className="w-10 h-10 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-foreground mb-1">
                  CATIA çizimini buraya sürükle veya tıkla
                </p>
                <p className="text-sm text-muted-foreground">
                  CATIA'dan <strong>PDF veya DXF'ten dönüştürülmüş JPG</strong> olarak dışa aktar
                </p>
                <div className="flex gap-2 justify-center mt-3 flex-wrap">
                  {["PDF", "JPG", "PNG", "TIF"].map(f => (
                    <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Workflow info */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: Upload, label: "1. Çizimi Yükle", desc: "CATIA'dan PDF/JPG olarak dışa aktarın" },
                { icon: Sparkles, label: "2. AI Analizi", desc: "Gemini boyutları, malzemeyi ve operasyonları çıkarır" },
                { icon: FileText, label: "3. Teklif Oluştur", desc: "Düzenle ve profesyonel PDF teklif al" },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex gap-3 p-3 rounded-lg bg-secondary/20 border border-border">
                  <div className="p-2 rounded-lg bg-primary/10 h-fit"><Icon className="w-4 h-4 text-primary" /></div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analyzing Stage */}
      {stage === "analyzing" && (
        <Card className="border-border bg-card">
          <CardContent className="p-12 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="p-4 rounded-full bg-primary/10 animate-pulse">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">AI çizimi analiz ediyor...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Parça geometrisi, malzeme ve operasyonlar tespit ediliyor
              </p>
              <p className="text-xs text-muted-foreground mt-2 font-mono">{fileName}</p>
            </div>
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </CardContent>
        </Card>
      )}

      {/* Quote Stage */}
      {stage === "quote" && quote && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: drawing preview + part info */}
          <div className="space-y-4">
            {previewUrl && (
              <Card className="border-border bg-card overflow-hidden">
                <CardContent className="p-0">
                  <img src={previewUrl} alt="Teknik Çizim" className="w-full object-contain max-h-56 bg-white p-2" />
                  <div className="p-2 border-t border-border">
                    <p className="text-xs text-muted-foreground truncate font-mono">{fileName}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-border bg-card">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" /> Parça Bilgileri
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div>
                  <Label className="text-xs">Parça Adı</Label>
                  <Input value={quote.part_name} onChange={e => setQuote(p => p ? { ...p, part_name: e.target.value } : p)} className="h-8 text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Malzeme</Label>
                  <Input value={quote.material} onChange={e => setQuote(p => p ? { ...p, material: e.target.value } : p)} className="h-8 text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Malzeme Kategorisi</Label>
                  <Select value={quote.material_category} onValueChange={v => setQuote(p => p ? { ...p, material_category: v } : p)}>
                    <SelectTrigger className="h-8 text-sm mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(MATERIAL_PRICE_KG).map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Ağırlık (kg)</Label>
                    <Input type="number" step="0.001" value={quote.estimated_weight_kg} onChange={e => setQuote(p => p ? { ...p, estimated_weight_kg: parseFloat(e.target.value)||0 } : p)} className="h-8 text-sm mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Tolerans</Label>
                    <Input value={quote.tightest_tolerance} onChange={e => setQuote(p => p ? { ...p, tightest_tolerance: e.target.value } : p)} className="h-8 text-sm mt-1" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Karmaşıklık:</Label>
                  <Badge className={COMPLEXITY_COLOR[quote.complexity] ?? ""}>{quote.complexity}</Badge>
                </div>
                {quote.features.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Özellikler</Label>
                    <div className="flex flex-wrap gap-1">
                      {quote.features.slice(0,8).map((f, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{f}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quote Settings */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Euro className="w-4 h-4 text-primary" /> Teklif Ayarları
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div>
                  <Label className="text-xs">Müşteri</Label>
                  <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Müşteri adı" className="h-8 text-sm mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Adet</Label>
                    <Input type="number" min={1} value={quantity} onChange={e => setQuantity(parseInt(e.target.value)||1)} className="h-8 text-sm mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Para Birimi</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["EUR","USD","TRY","GBP"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Genel Gider (%)</Label>
                    <Input type="number" min={0} max={100} value={overhead} onChange={e => setOverhead(parseFloat(e.target.value)||0)} className="h-8 text-sm mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Kâr Marjı (%)</Label>
                    <Input type="number" min={0} max={200} value={margin} onChange={e => setMargin(parseFloat(e.target.value)||0)} className="h-8 text-sm mt-1" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Setup Saatlik Ücret ({currency})</Label>
                  <Input type="number" min={0} value={setupHourlyRate} onChange={e => setSetupHourlyRate(parseFloat(e.target.value)||0)} className="h-8 text-sm mt-1" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Operations + Cost */}
          <div className="lg:col-span-2 space-y-4">
            {/* Operations */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-primary" /> İmalat Operasyonları
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={addOp} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Operasyon Ekle
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {quote.operations.map((op) => (
                  <div key={op.id} className={`rounded-lg border transition-all ${editingOp === op.id ? "border-primary/50 bg-primary/5" : "border-border bg-secondary/10"}`}>
                    {/* Collapsed view */}
                    {editingOp !== op.id ? (
                      <div className="flex items-center gap-3 p-3">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{op.step}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{op.name}</p>
                          <p className="text-xs text-muted-foreground">{op.machine_type} · {op.estimated_time_min} dk · {op.minute_rate.toFixed(2)} {currency}/dk</p>
                        </div>
                        <span className="text-sm font-semibold text-foreground shrink-0">{op.cost.toFixed(2)} {currency}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setEditingOp(op.id)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => removeOp(op.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      /* Expanded edit view */
                      <div className="p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-primary">Operasyon {op.step}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingOp(null)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Operasyon Adı</Label>
                            <Input value={op.name} onChange={e => updateOp(op.id, "name", e.target.value)} className="h-8 text-sm mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">Makine Tipi</Label>
                            <Select value={op.machine_type} onValueChange={v => updateOp(op.id, "machine_type", v)}>
                              <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {MACHINE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Makine Seç</Label>
                            <Select value={op.machine_id || "_"} onValueChange={v => updateOp(op.id, "machine_id", v === "_" ? "" : v)}>
                              <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Makine seç" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_">Manuel giriş</SelectItem>
                                {machines.filter(m => m.type.toLowerCase().includes(op.machine_type.toLowerCase()) || op.machine_type.toLowerCase().includes(m.type.toLowerCase())).map(m => (
                                  <SelectItem key={m.id} value={m.id}>{m.label} ({m.minute_rate.toFixed(2)} {currency}/dk)</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Süre (dakika)</Label>
                            <Input type="number" min={1} value={op.estimated_time_min} onChange={e => updateOp(op.id, "estimated_time_min", parseFloat(e.target.value)||1)} className="h-8 text-sm mt-1" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">{currency}/dakika</Label>
                            <Input type="number" min={0} step="0.01" value={op.minute_rate} onChange={e => updateOp(op.id, "minute_rate", parseFloat(e.target.value)||0)} className="h-8 text-sm mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">Maliyet ({currency})</Label>
                            <Input readOnly value={op.cost.toFixed(2)} className="h-8 text-sm mt-1 bg-muted/30 font-mono font-semibold" />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Açıklama</Label>
                          <Input value={op.description} onChange={e => updateOp(op.id, "description", e.target.value)} className="h-8 text-sm mt-1" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Setup info */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20 mt-1">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Setup: {quote.setup_count}x bağlama · {quote.setup_time_min} dk toplam</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{setupCost.toFixed(2)} {currency}</span>
                </div>
              </CardContent>
            </Card>

            {/* Cost Summary */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowCostBreakdown(!showCostBreakdown)}>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Euro className="w-4 h-4 text-primary" /> Maliyet Özeti
                  </CardTitle>
                  {showCostBreakdown ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </CardHeader>
              {showCostBreakdown && (
                <CardContent className="px-4 pb-4">
                  <div className="space-y-2">
                    {[
                      { label: "Malzeme Maliyeti", value: materialCost, sub: `${quote.estimated_weight_kg.toFixed(3)} kg × ${MATERIAL_PRICE_KG[quote.material_category] ?? 10} ${currency}/kg × 1.15 fire` },
                      { label: "İşleme Maliyeti", value: machiningCost, sub: quote.operations.map(o => `${o.name}: ${o.cost.toFixed(2)}`).join(", ") },
                      { label: "Setup Maliyeti", value: setupCost, sub: `${quote.setup_time_min} dk × ${(setupHourlyRate/60).toFixed(2)} ${currency}/dk` },
                    ].map(({ label, value, sub }) => (
                      <div key={label} className="flex justify-between items-start py-2 border-b border-border/40">
                        <div>
                          <p className="text-sm text-foreground">{label}</p>
                          <p className="text-[10px] text-muted-foreground max-w-xs truncate">{sub}</p>
                        </div>
                        <span className="text-sm font-mono font-semibold text-foreground ml-4">{value.toFixed(2)} {currency}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center py-2 border-b border-border/40">
                      <p className="text-sm text-muted-foreground">Genel Gider (%{overhead})</p>
                      <span className="text-sm font-mono text-muted-foreground">{overheadCost.toFixed(2)} {currency}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/40">
                      <p className="text-sm text-muted-foreground">Kâr Marjı (%{margin})</p>
                      <span className="text-sm font-mono text-muted-foreground">{marginCost.toFixed(2)} {currency}</span>
                    </div>
                  </div>

                  <Separator className="my-3" />
                  <div className="flex justify-between items-center p-3 rounded-xl bg-primary/10 border border-primary/20">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Birim Fiyat</p>
                      {quantity > 1 && <p className="text-xs text-muted-foreground">{quantity} adet toplam</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary font-mono">{totalPerPiece.toFixed(2)} {currency}</p>
                      {quantity > 1 && <p className="text-sm font-semibold text-muted-foreground">{totalOrder.toFixed(2)} {currency} toplam</p>}
                    </div>
                  </div>

                  {quote.notes && (
                    <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                      <p className="text-xs text-muted-foreground"><strong>Notlar:</strong> {quote.notes}</p>
                    </div>
                  )}

                  <Button className="w-full mt-4 gap-2" onClick={exportPdf}>
                    <DownloadCloud className="w-4 h-4" /> PDF Teklif Oluştur
                  </Button>
                </CardContent>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatpartQuoteModule;
