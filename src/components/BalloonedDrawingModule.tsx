import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, Download, Trash2, X, FileImage, FileText, ZoomIn, ZoomOut, RotateCcw, Sparkles, Loader2, Edit2, Move, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import { toast } from "sonner";

// ─── PDF → JPG converter ───
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
  x: number; // percentage of image width (balloon center)
  y: number; // percentage of image height (balloon center)
  // leader line target (where the arrow points) — also in percentages
  tx: number;
  ty: number;
  number: number;
  label: string;
}

const BALLOON_R = 13; // display radius px

const BalloonedDrawingModule = () => {
  const { language } = useLanguage();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [editingBalloon, setEditingBalloon] = useState<Balloon | null>(null);
  const [scale, setScale] = useState(1);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Drag state: 'balloon' or 'tip'
  const [dragState, setDragState] = useState<{ id: string; kind: "balloon" | "tip"; ox: number; oy: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tr = (key: string) => {
    const d: Record<string, Record<string, string>> = {
      tr: {
        title: "Balonlu Teknik Resim",
        subtitle: "AI ile teknik resim üzerindeki işlem noktaları otomatik tespit edilir ve balonlanır",
        uploadBtn: "Teknik Resim Yükle",
        uploadHint: "PNG, JPG veya PDF teknik resim dosyası yükleyin",
        analyzeBtn: "AI ile Otomatik Balon Ekle",
        analyzing: "Analiz ediliyor...",
        reanalyze: "Yeniden Analiz Et",
        deleteAll: "Balonları Temizle",
        export: "Dışa Aktar",
        balloonList: "Balon Listesi",
        noBalloons: "Resim yüklendikten sonra 'AI ile Otomatik Balon Ekle' butonuna tıklayın.",
        editTitle: "Balonu Düzenle",
        labelPlaceholder: "Operasyon adı / açıklama",
        numberLabel: "Balon Numarası",
        posLabel: "Konum (%)",
        save: "Kaydet",
        cancel: "İptal",
        deleteBalloon: "Balonu Sil",
        exportTitle: "Dışa Aktarma Formatı",
        exportJpg: "JPG olarak İndir",
        exportPdf: "PDF olarak İndir",
        dragHint: "Balonları sürükleyin | Ok ucunu sürükleyin | Tıklayarak düzenleyin",
        noImage: "Başlamak için teknik resim yükleyin",
        analyzed: "balon otomatik eklendi",
        analyzeError: "Analiz sırasında hata oluştu",
        convertingPdf: "PDF görüntüye dönüştürülüyor...",
        pdfConverted: "PDF başarıyla JPG'ye dönüştürüldü",
        pdfConvertError: "PDF dönüştürme başarısız oldu",
        addBalloon: "Manuel Balon Ekle",
      },
      en: {
        title: "Ballooned Technical Drawing",
        subtitle: "AI automatically detects operation points on the technical drawing and adds balloons",
        uploadBtn: "Upload Drawing",
        uploadHint: "Upload a PNG, JPG or PDF technical drawing",
        analyzeBtn: "Auto-Balloon with AI",
        analyzing: "Analyzing...",
        reanalyze: "Re-analyze",
        deleteAll: "Clear Balloons",
        export: "Export",
        balloonList: "Balloon List",
        noBalloons: "Upload a drawing then click 'Auto-Balloon with AI'.",
        editTitle: "Edit Balloon",
        labelPlaceholder: "Operation name / description",
        numberLabel: "Balloon Number",
        posLabel: "Position (%)",
        save: "Save",
        cancel: "Cancel",
        deleteBalloon: "Delete Balloon",
        exportTitle: "Export Format",
        exportJpg: "Download as JPG",
        exportPdf: "Download as PDF",
        dragHint: "Drag balloons | Drag arrow tip | Click to edit",
        noImage: "Upload a technical drawing to start",
        analyzed: "balloons added automatically",
        analyzeError: "Error during analysis",
        convertingPdf: "Converting PDF to image...",
        pdfConverted: "PDF successfully converted to JPG",
        pdfConvertError: "PDF conversion failed",
        addBalloon: "Add Balloon Manually",
      },
    };
    return d[language]?.[key] ?? d["tr"][key] ?? key;
  };

  const t = tr;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

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

  const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve({ base64: result.split(",")[1], mimeType: file.type || "image/jpeg" });
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
        const MAX_LEADER_DIST = 10; // max allowed % distance between balloon and tip
        const mapped: Balloon[] = data.balloons.map((b: any) => {
          let bx = Math.max(4, Math.min(96, Number(b.x)));
          let by = Math.max(4, Math.min(96, Number(b.y)));
          let tx: number, ty: number;

          if (b.tx != null && b.ty != null) {
            tx = Math.max(2, Math.min(98, Number(b.tx)));
            ty = Math.max(2, Math.min(98, Number(b.ty)));
          } else {
            // fallback: offset balloon from tip slightly
            tx = bx;
            ty = by;
            bx = Math.max(4, Math.min(96, tx));
            by = Math.max(4, Math.min(96, ty - 5));
          }

          // Clamp leader line length: if too long, move balloon closer to tip
          const dist = Math.sqrt((bx - tx) ** 2 + (by - ty) ** 2);
          if (dist > MAX_LEADER_DIST) {
            const ratio = MAX_LEADER_DIST / dist;
            bx = tx + (bx - tx) * ratio;
            by = ty + (by - ty) * ratio;
            bx = Math.max(4, Math.min(96, bx));
            by = Math.max(4, Math.min(96, by));
          }

          return {
            id: crypto.randomUUID(),
            x: bx,
            y: by,
            tx,
            ty,
            number: b.number,
            label: b.label || "",
          };
        });
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

  const addManualBalloon = () => {
    const nextNum = balloons.length > 0 ? Math.max(...balloons.map((b) => b.number)) + 1 : 1;
    const b: Balloon = {
      id: crypto.randomUUID(),
      x: 50, y: 20,
      tx: 55, ty: 25,
      number: nextNum,
      label: "",
    };
    setBalloons((prev) => [...prev, b]);
    setEditingBalloon({ ...b });
  };

  // ─── Drag ───
  const handleBalloonMouseDown = (e: React.MouseEvent, id: string, kind: "balloon" | "tip") => {
    e.stopPropagation();
    const balloon = balloons.find((b) => b.id === id);
    if (!balloon || !imgRef.current) return;
    const imgRect = getImgRect()!;
    const dispW = imgRef.current.offsetWidth * scale;
    const dispH = imgRef.current.offsetHeight * scale;
    const px = kind === "balloon" ? balloon.x : balloon.tx;
    const py = kind === "balloon" ? balloon.y : balloon.ty;
    const bx = (px / 100) * dispW + imgRect.left;
    const by = (py / 100) * dispH + imgRect.top;
    setDragState({ id, kind, ox: e.clientX - bx, oy: e.clientY - by });
  };

  useEffect(() => {
    if (!dragState) return;
    const onMove = (e: MouseEvent) => {
      if (!imgRef.current) return;
      const imgRect = getImgRect()!;
      const dispW = imgRef.current.offsetWidth * scale;
      const dispH = imgRef.current.offsetHeight * scale;
      const newX = ((e.clientX - dragState.ox - imgRect.left) / dispW) * 100;
      const newY = ((e.clientY - dragState.oy - imgRect.top) / dispH) * 100;
      const clamped = { x: Math.max(1, Math.min(99, newX)), y: Math.max(1, Math.min(99, newY)) };
      setBalloons((prev) =>
        prev.map((b) => {
          if (b.id !== dragState.id) return b;
          if (dragState.kind === "balloon") {
            // Only balloon moves — tip stays fixed (independent drag)
            return { ...b, x: clamped.x, y: clamped.y };
          } else {
            // Only tip moves — balloon stays fixed
            return { ...b, tx: clamped.x, ty: clamped.y };
          }
        })
      );
    };
    const onUp = () => setDragState(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragState, scale]);

  const handleBalloonClick = (e: React.MouseEvent, balloon: Balloon) => {
    if (dragState) return;
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

  // ─── Render to canvas at NATURAL image size (100% scale) ───
  const renderToCanvas = useCallback((): Promise<HTMLCanvasElement> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl!;
      img.onload = () => {
        const W = img.naturalWidth;
        const H = img.naturalHeight;
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);

        const r = Math.round(Math.max(W, H) * 0.022);
        const fontSize = Math.round(r * 1.1);
        const lineW = Math.max(1.5, r * 0.12);
        const TIP_R = Math.max(3, r * 0.22); // arrowhead dot radius

        balloons.forEach((b) => {
          const cx = (b.x / 100) * W;
          const cy = (b.y / 100) * H;
          const tx = (b.tx / 100) * W;
          const ty = (b.ty / 100) * H;

          // Direction from balloon center to tip
          const dx = tx - cx;
          const dy = ty - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const ux = dist > 0 ? dx / dist : 0;
          const uy = dist > 0 ? dy / dist : 0;

          // Line starts at balloon edge
          const lineStartX = cx + ux * r;
          const lineStartY = cy + uy * r;

          // ── Leader line ──
          ctx.save();
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = lineW;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(lineStartX, lineStartY);
          ctx.lineTo(tx, ty);
          ctx.stroke();

          // Arrowhead dot at tip
          ctx.beginPath();
          ctx.arc(tx, ty, TIP_R, 0, Math.PI * 2);
          ctx.fillStyle = "#000000";
          ctx.fill();
          ctx.restore();

          // ── Balloon circle ──
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.22)";
          ctx.shadowBlur = r * 0.5;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.lineWidth = lineW;
          ctx.strokeStyle = "#000000";
          ctx.stroke();
          ctx.restore();

          // ── Number text ──
          ctx.font = `bold ${fontSize}px Arial, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#000000";
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

  // ─── Balloon overlay helpers ───
  const getDisplayPos = (pct: number, dim: number) => (pct / 100) * dim;

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
          <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 items-center">
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

            <Button variant="outline" size="sm" onClick={addManualBalloon}>
              <Plus className="w-4 h-4 mr-1" />{t("addBalloon")}
            </Button>

            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" />{t("uploadBtn")}
            </Button>

            <Button
              variant="outline" size="sm"
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

            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
          </div>

          {balloons.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border text-muted-foreground text-xs">
              <Move className="w-3.5 h-3.5 flex-shrink-0" />
              {t("dragHint")}
            </div>
          )}

          {/* Drawing canvas */}
          <div className="overflow-auto rounded-xl border border-border bg-muted/20">
            <div
              className="relative inline-block select-none"
              style={{ userSelect: "none", width: imgRef.current ? imgRef.current.offsetWidth * scale : "auto" }}
            >
              <img
                ref={imgRef}
                src={imageUrl}
                alt="technical drawing"
                style={{ display: "block", maxWidth: "none", transform: `scale(${scale})`, transformOrigin: "top left" }}
                draggable={false}
              />

              {/* SVG overlay for leader lines + balloons */}
              {imgRef.current && balloons.length > 0 && (() => {
                const el = imgRef.current;
                const dispW = el.offsetWidth * scale;
                const dispH = el.offsetHeight * scale;

                return (
                  <svg
                    style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", overflow: "visible" }}
                    width={dispW}
                    height={dispH}
                    viewBox={`0 0 ${dispW} ${dispH}`}
                  >
                    {balloons.map((b) => {
                      const cx = getDisplayPos(b.x, dispW);
                      const cy = getDisplayPos(b.y, dispH);
                      const tx = getDisplayPos(b.tx, dispW);
                      const ty = getDisplayPos(b.ty, dispH);

                      const dx = tx - cx;
                      const dy = ty - cy;
                      const dist = Math.sqrt(dx * dx + dy * dy);
                      const ux = dist > 0 ? dx / dist : 0;
                      const uy = dist > 0 ? dy / dist : 0;

                      // Line starts at balloon edge
                      const lsx = cx + ux * BALLOON_R;
                      const lsy = cy + uy * BALLOON_R;
                      const tipR = 4;

                      return (
                        <g key={b.id}>
                          {/* Leader line */}
                          <line x1={lsx} y1={lsy} x2={tx} y2={ty} stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
                          {/* Arrowhead dot */}
                          <circle cx={tx} cy={ty} r={tipR} fill="#000" />
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}

              {/* Balloon + tip draggable overlays */}
              {imgRef.current && balloons.map((b) => {
                const el = imgRef.current!;
                const dispW = el.offsetWidth * scale;
                const dispH = el.offsetHeight * scale;
                const cx = getDisplayPos(b.x, dispW);
                const cy = getDisplayPos(b.y, dispH);
                const tx = getDisplayPos(b.tx, dispW);
                const ty = getDisplayPos(b.ty, dispH);

                return (
                  <g key={b.id} style={{ position: "absolute", top: 0, left: 0 }}>
                    {/* Balloon circle */}
                    <div
                      onMouseDown={(e) => handleBalloonMouseDown(e, b.id, "balloon")}
                      onClick={(e) => handleBalloonClick(e, b)}
                      style={{
                        position: "absolute",
                        left: cx - BALLOON_R,
                        top: cy - BALLOON_R,
                        width: BALLOON_R * 2,
                        height: BALLOON_R * 2,
                        cursor: dragState?.id === b.id && dragState.kind === "balloon" ? "grabbing" : "grab",
                        zIndex: 10,
                      }}
                      title={b.label || String(b.number)}
                    >
                      <svg width={BALLOON_R * 2} height={BALLOON_R * 2} viewBox={`0 0 ${BALLOON_R * 2} ${BALLOON_R * 2}`}>
                        <circle
                          cx={BALLOON_R} cy={BALLOON_R} r={BALLOON_R - 2}
                          fill="white" stroke="#000000" strokeWidth="2"
                          style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.35))" }}
                        />
                        <text
                          x={BALLOON_R} y={BALLOON_R + 1}
                          textAnchor="middle" dominantBaseline="middle"
                          fontSize={BALLOON_R * 0.9} fontWeight="bold"
                          fill="#000000" fontFamily="Arial, sans-serif"
                        >
                          {b.number}
                        </text>
                      </svg>
                    </div>

                    {/* Tip drag handle */}
                    <div
                      onMouseDown={(e) => handleBalloonMouseDown(e, b.id, "tip")}
                      style={{
                        position: "absolute",
                        left: tx - 7,
                        top: ty - 7,
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: "#000",
                        border: "2px solid white",
                        cursor: dragState?.id === b.id && dragState.kind === "tip" ? "grabbing" : "crosshair",
                        zIndex: 11,
                        boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                      }}
                      title="Ok ucunu taşı"
                    />
                  </g>
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
                    <div className="w-7 h-7 rounded-full bg-white border-2 border-black flex items-center justify-center text-black font-bold text-xs flex-shrink-0 mt-0.5">
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
              <div className="w-7 h-7 rounded-full bg-white border-2 border-black flex items-center justify-center text-black font-bold text-sm">
                {editingBalloon?.number}
              </div>
              {t("editTitle")}
            </DialogTitle>
          </DialogHeader>
          {editingBalloon && (
            <div className="space-y-4">
              {/* Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">{t("numberLabel")}</Label>
                  <Input
                    type="number" min={1} className="mt-1"
                    value={editingBalloon.number}
                    onChange={(e) => setEditingBalloon({ ...editingBalloon, number: Math.max(1, parseInt(e.target.value) || 1) })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{t("posLabel")}</Label>
                  <div className="flex gap-1 mt-1">
                    <Input
                      type="number" min={0} max={100} placeholder="X"
                      value={Math.round(editingBalloon.x)}
                      onChange={(e) => setEditingBalloon({ ...editingBalloon, x: Math.max(0, Math.min(100, Number(e.target.value))) })}
                    />
                    <Input
                      type="number" min={0} max={100} placeholder="Y"
                      value={Math.round(editingBalloon.y)}
                      onChange={(e) => setEditingBalloon({ ...editingBalloon, y: Math.max(0, Math.min(100, Number(e.target.value))) })}
                    />
                  </div>
                </div>
              </div>

              {/* Label */}
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
