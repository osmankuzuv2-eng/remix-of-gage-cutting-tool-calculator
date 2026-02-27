import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, FileImage, Loader2, Clock, Wrench, AlertTriangle, CheckCircle, Trash2, Info, Download, Plus, Save, ChevronDown, ChevronRight, MessageSquarePlus, Send, Star, FileSpreadsheet, ClipboardList, BotMessageSquare, Lightbulb, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { exportAnalysisPdf } from "@/lib/exportAnalysisPdf";
import { exportBomExcel } from "@/lib/exportBomExcel";
import * as UTIF from "utif2";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";
import { useCustomers } from "@/hooks/useCustomers";
import { useFactories } from "@/hooks/useFactories";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { materials as defaultMaterials, Material } from "@/data/materials";
import ReactMarkdown from "react-markdown";

// ─── File conversion helpers ───

const convertPdfToJpg = async (file: File): Promise<File> => {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;
  const buf = await file.arrayBuffer();
  const pdf = await getDocument({ data: new Uint8Array(buf) }).promise;
  const numPages = pdf.numPages;
  const scale = 2;
  const GAP = 20;
  const pageCanvases: HTMLCanvasElement[] = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const c = document.createElement("canvas");
    c.width = viewport.width; c.height = viewport.height;
    const ctx = c.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    pageCanvases.push(c);
  }
  const totalWidth = Math.max(...pageCanvases.map((c) => c.width));
  const totalHeight = pageCanvases.reduce((sum, c) => sum + c.height, 0) + GAP * (numPages - 1);
  const final = document.createElement("canvas");
  final.width = totalWidth; final.height = totalHeight;
  const fCtx = final.getContext("2d")!;
  fCtx.fillStyle = "#ffffff"; fCtx.fillRect(0, 0, totalWidth, totalHeight);
  let y = 0;
  for (const c of pageCanvases) { fCtx.drawImage(c, 0, y); y += c.height + GAP; }
  const blob = await new Promise<Blob>((res) => final.toBlob((b) => res(b!), "image/jpeg", 0.85));
  return new File([blob], file.name.replace(/\.pdf$/i, ".jpg"), { type: "image/jpeg" });
};

const convertTifToJpg = async (file: File): Promise<File> => {
  const buffer = await file.arrayBuffer();
  const ifds = UTIF.decode(buffer);
  if (ifds.length === 0) throw new Error("TIF read error");
  UTIF.decodeImage(buffer, ifds[0]);
  const rgba = UTIF.toRGBA8(ifds[0]);
  const width = ifds[0].width; const height = ifds[0].height;
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(new Uint8ClampedArray(rgba.buffer));
  ctx.putImageData(imageData, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Conversion failed"));
      resolve(new File([blob], file.name.replace(/\.tiff?$/i, ".jpg"), { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  });
};

// ─── Types ───

interface Operation {
  step: number; operation: string; machine: string; tool: string;
  cuttingSpeed: string; feedRate: string; depthOfCut: string;
  spindleSpeed?: string; estimatedTime: string; notes: string;
}

interface ClampingDetail {
  setupNumber: number;
  clampingType: string;
  description: string;
  clampingTime: string;
  unclampingTime: string;
  notes: string;
}

interface AnalysisResult {
  partName: string; material: string; overallDimensions: string;
  complexity: string; clampingStrategy?: string;
  clampingDetails?: ClampingDetail[]; totalClampingTime?: string;
  operations: Operation[];
  totalEstimatedTime: string; setupTime: string; recommendations: string[];
  tolerances: string; surfaceFinish: string; machinesRequired: string[];
  difficultyNotes: string;
}

type FileStatus = "pending" | "converting" | "analyzing" | "completed" | "failed";

interface DrawingItem {
  id: string;
  file: File;
  previewUrl: string;
  status: FileStatus;
  analysis: AnalysisResult | null;
  error: string | null;
  isOpen: boolean;
}

// ─── Helpers ───

const processFile = async (file: File, t: (s: string, k: string) => string): Promise<File> => {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "tif" || ext === "tiff" || file.type === "image/tiff") {
    if (file.size > 50 * 1024 * 1024) throw new Error(`TIF ${t("drawingAnalyzer", "fileTooLarge")}`);
    toast.info(t("drawingAnalyzer", "convertingTif"));
    const converted = await convertTifToJpg(file);
    toast.success(`TIF → JPG ${t("drawingAnalyzer", "conversionSuccess")}`);
    return converted;
  }

  if (ext === "pdf" || file.type === "application/pdf") {
    if (file.size > 50 * 1024 * 1024) throw new Error(`PDF ${t("drawingAnalyzer", "fileTooLarge")}`);
    toast.info(t("drawingAnalyzer", "convertingPdf"));
    const converted = await convertPdfToJpg(file);
    toast.success(`PDF → JPG ${t("drawingAnalyzer", "conversionSuccess")}`);
    return converted;
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type) && !["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "")) {
    throw new Error(t("drawingAnalyzer", "unsupportedFormat"));
  }
  if (file.size > 20 * 1024 * 1024) throw new Error(t("drawingAnalyzer", "fileSizeError"));

  return file;
};

const complexityColor = (c: string) => {
  switch (c) { case "Düşük": case "Low": return "text-success"; case "Orta": case "Medium": return "text-warning"; case "Yüksek": case "High": return "text-destructive"; case "Çok Yüksek": case "Very High": return "text-destructive font-bold"; default: return "text-muted-foreground"; }
};

// ─── Result Card (collapsible) ───

const FeedbackForm = ({ item, userId, t }: { item: DrawingItem; userId: string; t: (s: string, k: string) => string }) => {
  const [showForm, setShowForm] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackType, setFeedbackType] = useState("correction");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!feedbackText.trim() || rating === 0) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("analysis_feedback" as any).insert({
        user_id: userId,
        part_name: item.analysis?.partName || item.file.name,
        file_name: item.file.name,
        original_analysis: item.analysis as any,
        feedback_text: feedbackText.trim(),
        feedback_type: feedbackType,
        rating,
      } as any);
      if (error) throw error;
      toast.success(t("drawingAnalyzer", "feedbackSent"));
      setFeedbackText("");
      setRating(0);
      setShowForm(false);
    } catch (err: any) {
      toast.error(t("drawingAnalyzer", "feedbackError") + ": " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!showForm) {
    return (
      <Button variant="outline" size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
        <MessageSquarePlus className="w-4 h-4" /> {t("drawingAnalyzer", "feedbackButton")}
      </Button>
    );
  }

  return (
    <Card className="bg-secondary/20 border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">{t("drawingAnalyzer", "feedbackTitle")}</p>
          <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>✕</Button>
        </div>
        <Select value={feedbackType} onValueChange={setFeedbackType}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="correction">{t("drawingAnalyzer", "feedbackCorrection")}</SelectItem>
            <SelectItem value="missing">{t("drawingAnalyzer", "feedbackMissing")}</SelectItem>
            <SelectItem value="strategy">{t("drawingAnalyzer", "feedbackStrategy")}</SelectItem>
            <SelectItem value="other">{t("drawingAnalyzer", "feedbackOther")}</SelectItem>
          </SelectContent>
        </Select>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t("drawingAnalyzer", "feedbackQuality")}</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-0.5 transition-transform hover:scale-110"
              >
                <Star
                  className={`w-6 h-6 transition-colors ${
                    star <= (hoverRating || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground/40"
                  }`}
                />
              </button>
            ))}
            {rating > 0 && <span className="text-xs text-muted-foreground ml-2 self-center">{rating}/5</span>}
          </div>
        </div>
        <Textarea
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder={t("drawingAnalyzer", "feedbackPlaceholder")}
          rows={3}
          className="bg-background"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>{t("drawingAnalyzer", "feedbackCancel")}</Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting || !feedbackText.trim() || rating === 0}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
            {t("drawingAnalyzer", "feedbackSend")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Analysis Chat Panel ───

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cnc-ai-chat`;

type ChatMsg = { role: "user" | "assistant"; content: string };

async function streamAnalysisChat(messages: ChatMsg[], analysisContext: string, language: string, onDelta: (t: string) => void, onDone: () => void, onError: (m: string) => void) {
  const systemContext = messages.length === 0 ? analysisContext : undefined;
  const payload = systemContext ? [{ role: "user", content: systemContext }, ...messages] : messages;
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
    body: JSON.stringify({ messages: payload, language }),
  });
  if (!resp.ok) { onError("Error " + resp.status); return; }
  if (!resp.body) { onError("Stream error"); return; }
  const reader = resp.body.getReader(); const dec = new TextDecoder(); let buf = ""; let done = false;
  while (!done) {
    const { done: rd, value } = await reader.read(); if (rd) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, idx); buf = buf.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { done = true; break; }
      try { const c = JSON.parse(json).choices?.[0]?.delta?.content; if (c) onDelta(c); } catch { buf = line + "\n" + buf; break; }
    }
  }
  onDone();
}

const AnalysisChatPanel = ({ analysis, language, t }: { analysis: AnalysisResult; language: string; t: (s: string, k: string) => string }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const analysisContext = `Sen bu teknik resim analizinin sonucunu inceleyen bir CNC uzmanısın. Kullanıcı bu sonuç hakkında sorular soracak.

ANALIZ SONUCU:
Parça: ${analysis.partName}
Malzeme: ${analysis.material}
Ölçüler: ${analysis.overallDimensions}
Karmaşıklık: ${analysis.complexity}
Kurulum süresi: ${analysis.setupTime} dk
Toplam süre: ${analysis.totalEstimatedTime} dk
Toleranslar: ${analysis.tolerances}
Yüzey kalitesi: ${analysis.surfaceFinish}

OPERASYONLAR:
${analysis.operations.map(op => `Adım ${op.step}: ${op.operation} | Tezgah: ${op.machine} | Takım: ${op.tool} | Vc=${op.cuttingSpeed} | n=${op.spindleSpeed || "-"} | f=${op.feedRate} | ap=${op.depthOfCut} | Süre: ${op.estimatedTime} dk | Not: ${op.notes}`).join("\n")}

ÖNERİLER: ${analysis.recommendations.join("; ")}
NOTLAR: ${analysis.difficultyNotes}

Kullanıcının sorularını detaylı ve teknik olarak cevapla. Özellikle neden bu süre ve parametrelerin seçildiğini Taylor denklemi ve imalat prensiplerini kullanarak açıkla.`;

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMsg = { role: "user", content: text.trim() };
    // First message: prepend context as hidden system user message
    const historyForApi = messages.length === 0
      ? [{ role: "user" as const, content: analysisContext }, { role: "assistant" as const, content: "Analizi inceledim, sorularınızı bekliyorum." }, userMsg]
      : [...messages, userMsg];
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    let soFar = "";
    const upsert = (chunk: string) => {
      soFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: soFar } : m);
        return [...prev, { role: "assistant", content: soFar }];
      });
    };
    try {
      await streamAnalysisChat(historyForApi, analysisContext, language, upsert, () => setLoading(false), (err) => { toast.error(err); setLoading(false); });
    } catch { toast.error("Bağlantı hatası"); setLoading(false); }
  };

  const suggestions = [
    t("drawingAnalyzer", "analysisChatSuggestion1"),
    t("drawingAnalyzer", "analysisChatSuggestion2"),
    t("drawingAnalyzer", "analysisChatSuggestion3"),
    t("drawingAnalyzer", "analysisChatSuggestion4"),
  ];

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10">
        <BotMessageSquare className="w-4 h-4" /> {t("drawingAnalyzer", "analysisChatOpen")}
      </Button>
    );
  }

  return (
    <Card className="bg-card border-primary/20 border">
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5 rounded-t-lg">
          <div className="flex items-center gap-2">
            <BotMessageSquare className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">{t("drawingAnalyzer", "analysisChatTitle")}</p>
          </div>
          <div className="flex gap-1">
            {messages.length > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMessages([])}>
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          </div>
        </div>

        <div ref={scrollRef} className="h-72 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 ? (
            <div className="space-y-2 py-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                <Lightbulb className="w-3.5 h-3.5 text-primary" />
                <span>{t("drawingAnalyzer", "analysisChatSubtitle")}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)} className="text-left text-xs p-2.5 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 hover:border-primary/40 transition-all text-foreground">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary/50 border border-border text-foreground rounded-bl-sm"}`}>
                    {m.role === "user" ? <p>{m.content}</p> : (
                      <div className="prose prose-xs prose-invert max-w-none [&_p]:text-foreground [&_li]:text-foreground [&_strong]:text-foreground [&_code]:text-primary [&_h3]:text-foreground [&_h4]:text-foreground">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />{t("drawingAnalyzer", "analysisChatThinking")}
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-3 border-t border-border bg-secondary/10">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder={t("drawingAnalyzer", "analysisChatPlaceholder")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              disabled={loading}
            />
            <Button size="sm" onClick={() => send(input)} disabled={!input.trim() || loading} className="shrink-0">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const AnalysisResultCard = ({ item, t, onSave, canSave, userId, customerName, language }: { item: DrawingItem; t: (s: string, k: string) => string; onSave: (item: DrawingItem) => void; canSave: boolean; userId?: string; customerName?: string; language: string }) => {
  const analysis = item.analysis!;
  return (
    <div className="space-y-4 pt-2">
      <div className="flex justify-end gap-2 flex-wrap">
        {userId && <FeedbackForm item={item} userId={userId} t={t} />}
        {canSave && (
          <Button variant="outline" size="sm" onClick={() => onSave(item)}>
            <Save className="w-4 h-4 mr-2" />{t("drawingAnalyzer", "saveResult")}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={async () => { await exportAnalysisPdf(analysis, t); toast.success(t("drawingAnalyzer", "reportDownloaded")); }}>
          <Download className="w-4 h-4 mr-2" />{t("drawingAnalyzer", "downloadReport")}
        </Button>
        <Button variant="outline" size="sm" onClick={async () => { await exportBomExcel(analysis, undefined, customerName, t); toast.success(t("drawingAnalyzer", "reportDownloaded")); }} className="text-success border-success/30 hover:bg-success/10">
          <FileSpreadsheet className="w-4 h-4 mr-2" />{t("export", "bomTitle").split(" - ")[0]}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground mb-1">{t("drawingAnalyzer", "part")}</p><p className="font-semibold text-foreground text-sm">{analysis.partName}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground mb-1">{t("common", "material")}</p><p className="font-semibold text-foreground text-sm">{analysis.material}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground mb-1">{t("drawingAnalyzer", "complexity")}</p><p className={`font-semibold text-sm ${complexityColor(analysis.complexity)}`}>{analysis.complexity}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground mb-1">{t("drawingAnalyzer", "totalTime")}</p><p className="font-semibold text-primary text-sm flex items-center justify-center gap-1"><Clock className="w-4 h-4" />{analysis.totalEstimatedTime} {t("common", "minute")}</p></CardContent></Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-foreground text-base">{t("drawingAnalyzer", "operationSteps")}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">#</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">{t("drawingAnalyzer", "operation")}</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">{t("drawingAnalyzer", "machine")}</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">{t("drawingAnalyzer", "tool")}</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Vc</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">n</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">f</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">ap</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">{t("common", "time")}</th>
                </tr>
              </thead>
              <tbody>
                {analysis.operations.map((op, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-secondary/30" title={op.notes}>
                    <td className="py-2.5 px-3 text-primary font-mono font-bold">{op.step}</td>
                    <td className="py-2.5 px-3 text-foreground font-medium">{op.operation}</td>
                    <td className="py-2.5 px-3 text-foreground">{op.machine}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{op.tool}</td>
                    <td className="py-2.5 px-3 text-muted-foreground font-mono">{op.cuttingSpeed}</td>
                    <td className="py-2.5 px-3 text-muted-foreground font-mono">{op.spindleSpeed || "-"}</td>
                    <td className="py-2.5 px-3 text-muted-foreground font-mono">{op.feedRate}</td>
                    <td className="py-2.5 px-3 text-muted-foreground font-mono">{op.depthOfCut}</td>
                    <td className="py-2.5 px-3 text-primary font-mono font-semibold">{op.estimatedTime} {t("common", "minute")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3"><CardTitle className="text-foreground text-sm flex items-center gap-2"><Wrench className="w-4 h-4 text-primary" />{t("drawingAnalyzer", "requiredMachines")}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {analysis.machinesRequired.map((m, i) => (<span key={i} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">{m}</span>))}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-3"><CardTitle className="text-foreground text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4 text-success" />{t("common", "recommendations")}</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {analysis.recommendations.map((r, i) => (<li key={i} className="text-xs text-muted-foreground flex gap-2"><span className="text-success mt-0.5">•</span>{r}</li>))}
            </ul>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-3"><CardTitle className="text-foreground text-sm flex items-center gap-2"><Info className="w-4 h-4 text-primary" />{t("drawingAnalyzer", "toleranceAndSurface")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div><p className="text-xs text-muted-foreground">{t("drawingAnalyzer", "tolerances")}</p><p className="text-sm text-foreground">{analysis.tolerances}</p></div>
            <div><p className="text-xs text-muted-foreground">{t("drilling", "surfaceFinish")}</p><p className="text-sm text-foreground">{analysis.surfaceFinish}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-3"><CardTitle className="text-foreground text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" />{t("drawingAnalyzer", "difficultyNotes")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div><p className="text-xs text-muted-foreground">{t("drawingAnalyzer", "setupTime")}</p><p className="text-sm text-primary font-semibold">{analysis.setupTime} {t("common", "minute")}</p></div>
             {analysis.clampingStrategy && (<div><p className="text-xs text-muted-foreground">{t("drawingAnalyzer", "clampingStrategy")}</p><p className="text-sm text-foreground">{analysis.clampingStrategy}</p></div>)}
             {analysis.clampingDetails && analysis.clampingDetails.length > 0 && (
               <div className="space-y-2">
                 <p className="text-xs text-muted-foreground font-medium">{t("drawingAnalyzer", "clampingDetails")}</p>
                 {analysis.clampingDetails.map((cd, i) => (
                   <div key={i} className="p-2 rounded-md bg-secondary/30 border border-border/50 space-y-1">
                     <div className="flex items-center gap-2">
                       <Badge variant="outline" className="text-[10px]">Setup {cd.setupNumber}</Badge>
                       <span className="text-xs font-medium text-foreground">{cd.clampingType}</span>
                     </div>
                     <p className="text-xs text-muted-foreground">{cd.description}</p>
                      <div className="flex gap-3 text-xs">
                        <span className="text-primary">⏱ {t("drawingAnalyzer", "clampingTime")}: {cd.clampingTime} {t("common", "minute")}</span>
                        <span className="text-primary">⏱ {t("drawingAnalyzer", "unclampingTime")}: {cd.unclampingTime} {t("common", "minute")}</span>
                      </div>
                     {cd.notes && <p className="text-[10px] text-muted-foreground italic">{cd.notes}</p>}
                   </div>
                 ))}
                  {analysis.totalClampingTime && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-muted-foreground">{t("drawingAnalyzer", "totalClampingTime")}:</span>
                      <span className="text-sm font-semibold text-primary">{analysis.totalClampingTime} {t("common", "minute")}</span>
                    </div>
                  )}
               </div>
             )}
             <div><p className="text-xs text-muted-foreground">{t("drawingAnalyzer", "difficultyNotes")}</p><p className="text-sm text-foreground">{analysis.difficultyNotes}</p></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// ─── Main Component ───

const DrawingAnalyzer = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { saveCalculation } = useSupabaseSync();
  const { activeCustomers } = useCustomers();
  const { activeFactories } = useFactories();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<DrawingItem[]>([]);
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [selectedFactory, setSelectedFactory] = useState("Havacılık");
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);
  const [currentAnalyzing, setCurrentAnalyzing] = useState(0);
  const [showSpecsDialog, setShowSpecsDialog] = useState(false);

  const selectedCustomer = activeCustomers.find(c => c.name === customerName);
  const customerSpecs = selectedCustomer?.specs || null;

  const updateItem = useCallback((id: string, update: Partial<DrawingItem>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...update } : it));
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = 10 - items.length;
    if (files.length > remaining) {
      toast.error(t("drawingAnalyzer", "maxFilesError"));
    }
    const toAdd = files.slice(0, remaining);

    const newItems: DrawingItem[] = [];
    for (const rawFile of toAdd) {
      try {
        const processed = await processFile(rawFile, t);
        newItems.push({
          id: `drawing-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          file: processed,
          previewUrl: URL.createObjectURL(processed),
          status: "pending",
          analysis: null,
          error: null,
          isOpen: false,
        });
      } catch (err: any) {
        toast.error(`${rawFile.name}: ${err.message}`);
      }
    }

    setItems(prev => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const analyzeOne = async (item: DrawingItem) => {
    updateItem(item.id, { status: "analyzing", error: null });
    try {
      const safeName = item.file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `anonymous/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage.from("technical-drawings").upload(filePath, item.file);
      if (uploadError) throw uploadError;
      const { data: urlData, error: urlError } = await supabase.storage.from("technical-drawings").createSignedUrl(filePath, 3600);
      if (urlError) throw urlError;
      const materialInfo = selectedMaterial ? defaultMaterials.find(m => m.id === selectedMaterial) : null;
      const { data, error } = await supabase.functions.invoke("analyze-drawing", {
        body: { imageUrl: urlData.signedUrl, fileName: item.file.name, additionalInfo, factory: selectedFactory, language, material: materialInfo ? { name: materialInfo.name, category: materialInfo.category, hardness: materialInfo.hardness, cuttingSpeed: materialInfo.cuttingSpeed, feedRate: materialInfo.feedRate, taylorN: materialInfo.taylorN, taylorC: materialInfo.taylorC } : null, customerSpecs: customerSpecs },
      });
      if (error) throw error;
      if (data?.analysis) {
        updateItem(item.id, { status: "completed", analysis: data.analysis, isOpen: true });
      } else {
        throw new Error(t("drawingAnalyzer", "noAnalysisResult"));
      }
    } catch (err: any) {
      updateItem(item.id, { status: "failed", error: err.message });
    }
  };

  const handleAnalyzeAll = async () => {
    const pendingItems = items.filter(it => it.status === "pending" || it.status === "failed");
    if (!pendingItems.length) return;
    setIsAnalyzingAll(true);
    for (let i = 0; i < pendingItems.length; i++) {
      setCurrentAnalyzing(i + 1);
      await analyzeOne(pendingItems[i]);
    }
    setIsAnalyzingAll(false);
    setCurrentAnalyzing(0);
    toast.success(t("drawingAnalyzer", "batchAnalysisComplete"));
  };

  const removeItem = (id: string) => {
    setItems(prev => {
      const item = prev.find(it => it.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter(it => it.id !== id);
    });
  };

  const clearAll = () => {
    items.forEach(it => { if (it.previewUrl) URL.revokeObjectURL(it.previewUrl); });
    setItems([]);
  };

  const handleSaveResult = async (item: DrawingItem) => {
    if (!item.analysis) return;
    try {
      await saveCalculation({
        type: "cutting" as const,
        material: item.analysis.material,
        tool: item.file.name,
        parameters: {
          partName: item.analysis.partName,
          complexity: item.analysis.complexity,
          overallDimensions: item.analysis.overallDimensions,
          setupTime: item.analysis.setupTime,
          analysisType: "drawing-analysis",
        },
        results: {
          totalEstimatedTime: item.analysis.totalEstimatedTime,
          operationCount: String(item.analysis.operations.length),
          machinesRequired: item.analysis.machinesRequired.join(", "),
          tolerances: item.analysis.tolerances,
          surfaceFinish: item.analysis.surfaceFinish,
        },
      });
      toast.success(t("drawingAnalyzer", "savedSuccess"));
    } catch {
      toast.error(t("common", "saveFailed"));
    }
  };

  const toggleItem = (id: string) => {
    updateItem(id, { isOpen: !items.find(it => it.id === id)?.isOpen });
  };

  const statusBadge = (status: FileStatus) => {
    switch (status) {
      case "pending": return <Badge variant="secondary">{t("drawingAnalyzer", "pending")}</Badge>;
      case "converting":
      case "analyzing": return <Badge variant="default" className="animate-pulse">{t("drawingAnalyzer", "analyzing")}</Badge>;
      case "completed": return <Badge className="bg-success/20 text-success border-success/30">{t("drawingAnalyzer", "completed")}</Badge>;
      case "failed": return <Badge variant="destructive">{t("drawingAnalyzer", "failed")}</Badge>;
    }
  };

  const pendingCount = items.filter(it => it.status === "pending" || it.status === "failed").length;

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <FileImage className="w-5 h-5 text-primary" />{t("drawingAnalyzer", "title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.tif,.tiff" multiple onChange={handleFileSelect} className="hidden" />

          <button onClick={() => fileInputRef.current?.click()} disabled={items.length >= 10}
            className="w-full border-2 border-dashed border-border rounded-xl p-8 hover:border-primary/50 hover:bg-primary/5 transition-all group disabled:opacity-50 disabled:cursor-not-allowed">
            <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2 group-hover:text-primary transition-colors" />
            <p className="text-foreground font-medium">{t("drawingAnalyzer", "batchUpload")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("drawingAnalyzer", "batchUploadDesc")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("drawingAnalyzer", "fileFormats")}</p>
          </button>

          {items.length > 0 && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Textarea placeholder={t("drawingAnalyzer", "additionalInfo")} value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} className="bg-secondary/30 border-border" rows={2} />
                </div>
                <div className="w-48 shrink-0 space-y-2">
                   <div>
                     <p className="text-xs text-muted-foreground mb-1">{t("drawingAnalyzer", "materialOptional")}</p>
                     <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
                       <SelectTrigger className="bg-secondary/30 border-border">
                         <SelectValue placeholder={t("drawingAnalyzer", "materialAuto")} />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="auto">{t("drawingAnalyzer", "materialAuto")}</SelectItem>
                         {defaultMaterials.map((m) => (
                           <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
                   <div>
                     <p className="text-xs text-muted-foreground mb-1">{t("drawingAnalyzer", "customerOptional")}</p>
                     <Select value={customerName} onValueChange={(val) => {
                       setCustomerName(val);
                       const found = activeCustomers.find(c => c.name === val);
                       if (found) setSelectedFactory(found.factory);
                     }}>
                       <SelectTrigger className="bg-secondary/30 border-border">
                         <SelectValue placeholder={t("drawingAnalyzer", "customerPlaceholder")} />
                       </SelectTrigger>
                       <SelectContent>
                         {activeCustomers.map((c) => (
                           <SelectItem key={c.id} value={c.name}>{c.name} <span className="text-xs text-muted-foreground ml-1">({c.factory})</span></SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
                   <div>
                     <p className="text-xs text-muted-foreground mb-1">{t("drawingAnalyzer", "factorySelection")}</p>
                     <Select value={selectedFactory} onValueChange={setSelectedFactory}>
                       <SelectTrigger className="bg-secondary/30 border-border">
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                         {activeFactories.map((f) => (
                           <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                    </div>
                    {customerName && customerSpecs && (
                      <Button variant="outline" size="sm" onClick={() => setShowSpecsDialog(true)} className="shrink-0 gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
                        <ClipboardList className="w-4 h-4" /> {t("drawingAnalyzer", "customerSpecs")}
                      </Button>
                    )}
                  </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{items.length} {t("drawingAnalyzer", "filesSelected")}</p>
                <div className="flex gap-2">
                  {items.length < 10 && (
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <Plus className="w-4 h-4 mr-1" />{t("drawingAnalyzer", "addMoreFiles")}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={clearAll} disabled={isAnalyzingAll}>
                    <Trash2 className="w-4 h-4 mr-1" />{t("drawingAnalyzer", "clearAll")}
                  </Button>
                  <Button onClick={handleAnalyzeAll} disabled={isAnalyzingAll || pendingCount === 0} size="sm">
                    {isAnalyzingAll ? (
                      <><Loader2 className="w-4 h-4 mr-1 animate-spin" />{t("drawingAnalyzer", "analyzingFile")} {currentAnalyzing} {t("drawingAnalyzer", "of")} {pendingCount}</>
                    ) : (
                      <><Wrench className="w-4 h-4 mr-1" />{t("drawingAnalyzer", "analyzeAll")} ({pendingCount})</>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* File list with collapsible results */}
      {items.map((item) => (
        <Collapsible key={item.id} open={item.isOpen} onOpenChange={() => toggleItem(item.id)}>
          <Card className="bg-card border-border">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  {item.isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <img src={item.previewUrl} alt="" className="w-10 h-10 object-cover rounded border border-border shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">{item.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(item.file.size / 1024 / 1024).toFixed(2)} MB
                      {item.analysis && ` • ${item.analysis.partName} • ${item.analysis.totalEstimatedTime} ${t("common", "minute")}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {statusBadge(item.status)}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} disabled={isAnalyzingAll && item.status === "analyzing"}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 border-t border-border">
                {item.status === "analyzing" && (
                  <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />{t("drawingAnalyzer", "analyzing")}
                  </div>
                )}
                {item.status === "failed" && (
                  <div className="py-4 text-center text-sm text-destructive">{item.error}</div>
                )}
                {item.status === "pending" && (
                  <div className="py-4">
                    <div className="rounded-lg overflow-hidden border border-border max-h-60 flex items-center justify-center bg-secondary/30">
                      <img src={item.previewUrl} alt="Preview" className="max-h-60 object-contain" />
                    </div>
                  </div>
                )}
                {item.status === "completed" && item.analysis && (
                  <AnalysisResultCard item={item} t={t} onSave={handleSaveResult} canSave={!!user} userId={user?.id} customerName={customerName} language={language} />
                )}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}
      {/* Specs Dialog */}
      <Dialog open={showSpecsDialog} onOpenChange={setShowSpecsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              {customerName} - {t("drawingAnalyzer", "customerSpecsTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm text-foreground bg-secondary/30 rounded-lg p-4 border border-border max-h-80 overflow-y-auto">
            {customerSpecs || t("drawingAnalyzer", "noSpecsDefined")}
          </div>
          <p className="text-xs text-muted-foreground">{t("drawingAnalyzer", "specsAutoNote")}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DrawingAnalyzer;
