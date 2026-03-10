import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, Download, Trash2, X, FileImage, FileText, ZoomIn, ZoomOut, RotateCcw, Sparkles, Loader2, Edit2, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import { toast } from "sonner";

// ─── PDF → JPG converter (reuses same logic as DrawingAnalyzer) ───
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
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
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
  const blob = await new Promise<Blob>((res) => final.toBlob((b) => res(b!), "image/jpeg", 0.92));
  return new File([blob], file.name.replace(/\.pdf$/i, ".jpg"), { type: "image/jpeg" });
};

interface Balloon {
  id: string;
  x: number; // percentage of image width
  y: number; // percentage of image height
  number: number;
  label: string;
}

const BALLOON_R = 18;

const BalloonedDrawingModule = () => {
  const { language } = useLanguage();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [editingBalloon, setEditingBalloon] = useState<Balloon | null>(null);
  const [scale, setScale] = useState(1);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tr = (key: string) => {
    const d: Record<string, Record<string, string>> = {
      tr: {
        title: "Balonlu Teknik Resim",
        subtitle: "AI ile teknik resim üzerindeki işlem noktaları otomatik tespit edilir ve balonlanır",
        uploadBtn: "Teknik Resim Yükle",
        uploadHint: "PNG veya JPG teknik resim dosyası yükleyin",
        analyzeBtn: "AI ile Otomatik Balon Ekle",
        analyzing: "Analiz ediliyor...",
        reanalyze: "Yeniden Analiz Et",
        deleteAll: "Balonları Temizle",
        export: "Dışa Aktar",
        balloonList: "Balon Listesi",
        noBalloons: "Resim yüklendikten sonra 'AI ile Otomatik Balon Ekle' butonuna tıklayın.",
        editTitle: "Balonu Düzenle",
        labelPlaceholder: "Operasyon adı / açıklama",
        save: "Kaydet",
        cancel: "İptal",
        deleteBalloon: "Balonu Sil",
        exportTitle: "Dışa Aktarma Formatı",
        exportJpg: "JPG olarak İndir",
        exportPdf: "PDF olarak İndir",
        dragHint: "Balonları sürükleyerek taşıyabilirsiniz",
        noImage: "Başlamak için teknik resim yükleyin",
        analyzed: "balon otomatik eklendi",
        analyzeError: "Analiz sırasında hata oluştu",
      },
      en: {
        title: "Ballooned Technical Drawing",
        subtitle: "AI automatically detects operation points on the technical drawing and adds balloons",
        uploadBtn: "Upload Drawing",
        uploadHint: "Upload a PNG or JPG technical drawing",
        analyzeBtn: "Auto-Balloon with AI",
        analyzing: "Analyzing...",
        reanalyze: "Re-analyze",
        deleteAll: "Clear Balloons",
        export: "Export",
        balloonList: "Balloon List",
        noBalloons: "Upload a drawing then click 'Auto-Balloon with AI'.",
        editTitle: "Edit Balloon",
        labelPlaceholder: "Operation name / description",
        save: "Save",
        cancel: "Cancel",
        deleteBalloon: "Delete Balloon",
        exportTitle: "Export Format",
        exportJpg: "Download as JPG",
        exportPdf: "Download as PDF",
        dragHint: "Drag balloons to reposition them",
        noImage: "Upload a technical drawing to start",
        analyzed: "balloons added automatically",
        analyzeError: "Error during analysis",
      },
    };
    return d[language]?.[key] ?? d["tr"][key] ?? key;
  };

  const t = tr;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // reset so same file can be re-selected

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      toast.info(t("convertingPdf"));
      try {
        const converted = await convertPdfToJpg(file);
        toast.success(t("pdfConverted"));
        setImageFile(converted);
        setImageUrl(URL.createObjectURL(converted));
      } catch (err) {
        console.error(err);
        toast.error(t("pdfConvertError"));
        return;
      }
    } else {
      setImageFile(file);
      setImageUrl(URL.createObjectURL(file));
    }
    setBalloons([]);
    setScale(1);
  };

  const getImgRect = () => imgRef.current?.getBoundingClientRect();

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve({ base64, mimeType: file.type || "image/jpeg" });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleAutoAnalyze = async () => {
    if (!imageFile) return;
    setAnalyzing(true);
    try {
      const { base64, mimeType } = await fileToBase64(imageFile);
      const { data, error } = await supabase.functions.invoke("auto-balloon-drawing", {
        body: { imageBase64: base64, mimeType, language },
      });
      if (error) throw error;
      if (data?.balloons && Array.isArray(data.balloons)) {
        const mapped: Balloon[] = data.balloons.map((b: any) => ({
          id: crypto.randomUUID(),
          x: Math.max(2, Math.min(98, Number(b.x))),
          y: Math.max(2, Math.min(98, Number(b.y))),
          number: b.number,
          label: b.label || "",
        }));
        setBalloons(mapped);
        toast.success(`${mapped.length} ${t("analyzed")}`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(t("analyzeError"));
    } finally {
      setAnalyzing(false);
    }
  };

  // Drag logic
  const handleBalloonMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const balloon = balloons.find((b) => b.id === id);
    if (!balloon || !imgRef.current) return;
    const imgRect = getImgRect()!;
    const bx = (balloon.x / 100) * imgRect.width + imgRect.left;
    const by = (balloon.y / 100) * imgRect.height + imgRect.top;
    setDragId(id);
    setDragOffset({ x: e.clientX - bx, y: e.clientY - by });
  };

  useEffect(() => {
    if (!dragId) return;
    const onMove = (e: MouseEvent) => {
      if (!imgRef.current) return;
      const imgRect = getImgRect()!;
      const newX = ((e.clientX - dragOffset.x - imgRect.left) / imgRect.width) * 100;
      const newY = ((e.clientY - dragOffset.y - imgRect.top) / imgRect.height) * 100;
      setBalloons((prev) =>
        prev.map((b) =>
          b.id === dragId
            ? { ...b, x: Math.max(1, Math.min(99, newX)), y: Math.max(1, Math.min(99, newY)) }
            : b
        )
      );
    };
    const onUp = () => setDragId(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragId, dragOffset]);

  const handleBalloonClick = (e: React.MouseEvent, balloon: Balloon) => {
    if (dragId) return;
    e.stopPropagation();
    setEditingBalloon({ ...balloon });
  };

  const saveBalloon = () => {
    if (!editingBalloon) return;
    setBalloons((prev) => prev.map((b) => (b.id === editingBalloon.id ? editingBalloon : b)));
    setEditingBalloon(null);
  };

  const deleteBalloon = (id: string) => {
    setBalloons((prev) => {
      const filtered = prev.filter((b) => b.id !== id);
      return filtered.map((b, i) => ({ ...b, number: i + 1 }));
    });
    setEditingBalloon(null);
  };

  // Render balloons on canvas
  const renderToCanvas = useCallback((): Promise<HTMLCanvasElement> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl!;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);

        const r = Math.round(Math.max(img.naturalWidth, img.naturalHeight) * 0.022);
        const fontSize = Math.round(r * 1.05);
        const lineW = Math.round(Math.max(1.5, r * 0.14));

        balloons.forEach((b) => {
          const cx = (b.x / 100) * img.naturalWidth;
          const cy = (b.y / 100) * img.naturalHeight;

          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.3)";
          ctx.shadowBlur = r * 0.6;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.lineWidth = lineW;
          ctx.strokeStyle = "#0ea5e9";
          ctx.stroke();
          ctx.restore();

          ctx.font = `bold ${fontSize}px Arial, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#0369a1";
          ctx.fillText(String(b.number), cx, cy);
        });

        resolve(canvas);
      };
    });
  }, [imageUrl, balloons]);

  const downloadJpg = async () => {
    const canvas = await renderToCanvas();
    const link = document.createElement("a");
    link.download = "balonlu-teknik-resim.jpg";
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
    setExportDialogOpen(false);
  };

  const downloadPdf = async () => {
    const canvas = await renderToCanvas();
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const isLandscape = canvas.width > canvas.height;
    const pdf = new jsPDF({ orientation: isLandscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = canvas.width / canvas.height;
    let w = pageW - 10;
    let h = w / ratio;
    if (h > pageH - 10) { h = pageH - 10; w = h * ratio; }
    pdf.addImage(imgData, "JPEG", (pageW - w) / 2, (pageH - h) / 2, w, h);
    pdf.save("balonlu-teknik-resim.pdf");
    setExportDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t("title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* Upload area */}
      {!imageUrl ? (
        <div
          className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-foreground font-medium mb-1">{t("uploadBtn")}</p>
          <p className="text-xs text-muted-foreground">{t("uploadHint")}</p>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* AI Analyze */}
            <Button
              size="sm"
              onClick={handleAutoAnalyze}
              disabled={analyzing}
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              {analyzing ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" />{t("analyzing")}</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-1" />{balloons.length > 0 ? t("reanalyze") : t("analyzeBtn")}</>
              )}
            </Button>

            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" />{t("uploadBtn")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBalloons([])}
              disabled={balloons.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-1" />{t("deleteAll")}
            </Button>

            {/* Zoom */}
            <div className="flex items-center gap-1 ml-auto">
              <Button variant="outline" size="sm" onClick={() => setScale((s) => Math.min(s + 0.25, 3))}><ZoomIn className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setScale((s) => Math.max(s - 0.25, 0.25))}><ZoomOut className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setScale(1)}><RotateCcw className="w-4 h-4" /></Button>
              <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(scale * 100)}%</span>
            </div>

            <Button
              size="sm"
              onClick={() => setExportDialogOpen(true)}
              disabled={balloons.length === 0}
              variant="outline"
            >
              <Download className="w-4 h-4 mr-1" />{t("export")}
            </Button>

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          {balloons.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border text-muted-foreground text-xs">
              <Move className="w-3.5 h-3.5 flex-shrink-0" />
              {t("dragHint")} — <Edit2 className="w-3 h-3 mx-0.5" /> tıklayarak düzenleyin
            </div>
          )}

          {/* Drawing canvas */}
          <div className="overflow-auto rounded-xl border border-border bg-muted/20">
            <div className="relative inline-block select-none" style={{ userSelect: "none" }}>
              <img
                ref={imgRef}
                src={imageUrl}
                alt="technical drawing"
                style={{ display: "block", maxWidth: "none", transform: `scale(${scale})`, transformOrigin: "top left" }}
                draggable={false}
              />
              {/* Balloon overlays */}
              {balloons.map((b) => {
                const imgEl = imgRef.current;
                if (!imgEl) return null;
                const dispW = imgEl.offsetWidth * scale;
                const dispH = imgEl.offsetHeight * scale;
                const cx = (b.x / 100) * dispW;
                const cy = (b.y / 100) * dispH;
                return (
                  <div
                    key={b.id}
                    onMouseDown={(e) => handleBalloonMouseDown(e, b.id)}
                    onClick={(e) => handleBalloonClick(e, b)}
                    style={{
                      position: "absolute",
                      left: cx - BALLOON_R,
                      top: cy - BALLOON_R,
                      width: BALLOON_R * 2,
                      height: BALLOON_R * 2,
                      cursor: dragId === b.id ? "grabbing" : "grab",
                      zIndex: 10,
                    }}
                    title={b.label || String(b.number)}
                  >
                    <svg width={BALLOON_R * 2} height={BALLOON_R * 2} viewBox={`0 0 ${BALLOON_R * 2} ${BALLOON_R * 2}`}>
                      <circle
                        cx={BALLOON_R} cy={BALLOON_R} r={BALLOON_R - 2}
                        fill="white" stroke="#0ea5e9" strokeWidth="2.5"
                        style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.35))" }}
                      />
                      <text
                        x={BALLOON_R} y={BALLOON_R + 1}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize={BALLOON_R * 0.95} fontWeight="bold"
                        fill="#0369a1" fontFamily="Arial, sans-serif"
                      >
                        {b.number}
                      </text>
                    </svg>
                  </div>
                );
              })}

              {/* Loading overlay */}
              {analyzing && (
                <div className="absolute inset-0 bg-background/60 flex items-center justify-center rounded-xl" style={{ zIndex: 20 }}>
                  <div className="flex flex-col items-center gap-3 bg-card border border-border rounded-xl px-8 py-6 shadow-xl">
                    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                    <p className="text-sm font-medium text-foreground">{t("analyzing")}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Balloon list */}
          {balloons.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-semibold text-sm text-foreground mb-3">{t("balloonList")} ({balloons.length})</h3>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {balloons.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                    onClick={() => setEditingBalloon({ ...b })}
                  >
                    <div className="w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold text-xs flex-shrink-0 mt-0.5">
                      {b.number}
                    </div>
                    <span className="text-sm text-foreground flex-1 leading-snug">
                      {b.label || <span className="text-muted-foreground italic">—</span>}
                    </span>
                    <Button
                      variant="ghost" size="icon"
                      className="w-6 h-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive flex-shrink-0"
                      onClick={(e) => { e.stopPropagation(); deleteBalloon(b.id); }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!analyzing && balloons.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">{t("noBalloons")}</p>
          )}
        </div>
      )}

      {/* Edit balloon dialog */}
      <Dialog open={!!editingBalloon} onOpenChange={(open) => !open && setEditingBalloon(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold text-sm">
                {editingBalloon?.number}
              </div>
              {t("editTitle")}
            </DialogTitle>
          </DialogHeader>
          {editingBalloon && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm">{t("labelPlaceholder")}</Label>
                <Textarea
                  className="mt-1 resize-none" rows={3}
                  placeholder={t("labelPlaceholder")}
                  value={editingBalloon.label}
                  onChange={(e) => setEditingBalloon({ ...editingBalloon, label: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-between">
                <Button
                  variant="outline" size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => deleteBalloon(editingBalloon.id)}
                >
                  <Trash2 className="w-4 h-4 mr-1" />{t("deleteBalloon")}
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingBalloon(null)}>{t("cancel")}</Button>
                  <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white" onClick={saveBalloon}>{t("save")}</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Export dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("exportTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white" onClick={downloadJpg}>
              <FileImage className="w-4 h-4 mr-2" />{t("exportJpg")}
            </Button>
            <Button variant="outline" className="w-full" onClick={downloadPdf}>
              <FileText className="w-4 h-4 mr-2" />{t("exportPdf")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BalloonedDrawingModule;
