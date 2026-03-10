import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, Download, Trash2, Plus, X, FileImage, FileText, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/i18n/LanguageContext";
import jsPDF from "jspdf";

interface Balloon {
  id: string;
  x: number; // as percentage of image width
  y: number; // as percentage of image height
  number: number;
  label: string;
}

const BALLOON_R = 18; // radius in px at 1x scale

const BalloonedDrawingModule = () => {
  const { language } = useLanguage();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [placingMode, setPlacingMode] = useState(false);
  const [editingBalloon, setEditingBalloon] = useState<Balloon | null>(null);
  const [scale, setScale] = useState(1);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const t = (key: string) => {
    const dict: Record<string, Record<string, string>> = {
      tr: {
        title: "Balonlu Teknik Resim",
        subtitle: "Teknik resim üzerine işlem sırası balonları ekleyin ve dışa aktarın",
        uploadBtn: "Resim Yükle",
        uploadHint: "PNG, JPG veya PDF teknik resim dosyası seçin",
        placingMode: "Balon Ekle Modu",
        cancelPlace: "Modu Kapat",
        deleteAll: "Tümünü Sil",
        export: "Dışa Aktar",
        balloonList: "Balon Listesi",
        noBalloons: "Henüz balon eklenmedi. 'Balon Ekle Modu'nu açıp resme tıklayın.",
        editTitle: "Balonu Düzenle",
        labelPlaceholder: "Operasyon adı / açıklama (isteğe bağlı)",
        save: "Kaydet",
        cancel: "İptal",
        deleteBalloon: "Balonu Sil",
        exportTitle: "Dışa Aktarma Formatı",
        exportJpg: "JPG olarak İndir",
        exportPdf: "PDF olarak İndir",
        zoomIn: "Yakınlaştır",
        zoomOut: "Uzaklaştır",
        resetZoom: "Sıfırla",
        clickToPlace: "Balonun yerleştirileceği konuma tıklayın",
        noImage: "Başlamak için teknik resim yükleyin",
      },
      en: {
        title: "Ballooned Technical Drawing",
        subtitle: "Add operation sequence balloons on technical drawings and export",
        uploadBtn: "Upload Drawing",
        uploadHint: "Select a PNG, JPG drawing file",
        placingMode: "Add Balloon Mode",
        cancelPlace: "Close Mode",
        deleteAll: "Delete All",
        export: "Export",
        balloonList: "Balloon List",
        noBalloons: "No balloons yet. Enable 'Add Balloon Mode' and click on the drawing.",
        editTitle: "Edit Balloon",
        labelPlaceholder: "Operation name / description (optional)",
        save: "Save",
        cancel: "Cancel",
        deleteBalloon: "Delete Balloon",
        exportTitle: "Export Format",
        exportJpg: "Download as JPG",
        exportPdf: "Download as PDF",
        zoomIn: "Zoom In",
        zoomOut: "Zoom Out",
        resetZoom: "Reset",
        clickToPlace: "Click on the drawing to place a balloon",
        noImage: "Upload a technical drawing to start",
      },
    };
    return dict[language]?.[key] ?? dict["tr"][key] ?? key;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setBalloons([]);
    setScale(1);
  };

  const getContainerRect = () => imgContainerRef.current?.getBoundingClientRect();
  const getImgRect = () => imgRef.current?.getBoundingClientRect();

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!placingMode || !imgRef.current) return;
      const imgRect = getImgRect();
      if (!imgRect) return;
      const x = ((e.clientX - imgRect.left) / imgRect.width) * 100;
      const y = ((e.clientY - imgRect.top) / imgRect.height) * 100;
      if (x < 0 || x > 100 || y < 0 || y > 100) return;
      const newBalloon: Balloon = {
        id: crypto.randomUUID(),
        x,
        y,
        number: balloons.length + 1,
        label: "",
      };
      setBalloons((prev) => [...prev, newBalloon]);
    },
    [placingMode, balloons.length]
  );

  const handleBalloonMouseDown = (e: React.MouseEvent, id: string) => {
    if (placingMode) return;
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
            ? { ...b, x: Math.max(0, Math.min(100, newX)), y: Math.max(0, Math.min(100, newY)) }
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
    if (placingMode || dragId) return;
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

  // Render balloons on canvas over the image
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

        const r = Math.round(Math.max(img.naturalWidth, img.naturalHeight) * 0.025);
        const fontSize = Math.round(r * 1.1);
        const lineWidth = Math.round(r * 0.18);

        balloons.forEach((b) => {
          const cx = (b.x / 100) * img.naturalWidth;
          const cy = (b.y / 100) * img.naturalHeight;

          // Shadow
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.35)";
          ctx.shadowBlur = r * 0.5;

          // Circle fill
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();

          // Circle border
          ctx.lineWidth = lineWidth;
          ctx.strokeStyle = "#0ea5e9";
          ctx.stroke();
          ctx.restore();

          // Number text
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t("title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        {imageUrl && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setScale((s) => Math.min(s + 0.25, 3))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setScale((s) => Math.max(s - 0.25, 0.25))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setScale(1)}>
              <RotateCcw className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(scale * 100)}%</span>
          </div>
        )}
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
            <Button
              variant={placingMode ? "default" : "outline"}
              size="sm"
              onClick={() => setPlacingMode((v) => !v)}
              className={placingMode ? "bg-cyan-600 hover:bg-cyan-700 text-white" : ""}
            >
              <Plus className="w-4 h-4 mr-1" />
              {placingMode ? t("cancelPlace") : t("placingMode")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" />
              {t("uploadBtn")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setBalloons([]); }}
              disabled={balloons.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              {t("deleteAll")}
            </Button>
            <Button
              size="sm"
              onClick={() => setExportDialogOpen(true)}
              disabled={balloons.length === 0}
              className="bg-cyan-600 hover:bg-cyan-700 text-white ml-auto"
            >
              <Download className="w-4 h-4 mr-1" />
              {t("export")}
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          {placingMode && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm">
              <Plus className="w-4 h-4" />
              {t("clickToPlace")}
            </div>
          )}

          {/* Canvas area */}
          <div className="overflow-auto rounded-xl border border-border bg-muted/20">
            <div
              ref={imgContainerRef}
              className={`relative inline-block select-none ${placingMode ? "cursor-crosshair" : ""}`}
              style={{ transformOrigin: "top left" }}
              onClick={handleImageClick}
            >
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
                const naturalW = imgEl.naturalWidth;
                const naturalH = imgEl.naturalHeight;
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
                        cx={BALLOON_R}
                        cy={BALLOON_R}
                        r={BALLOON_R - 2}
                        fill="white"
                        stroke="#0ea5e9"
                        strokeWidth="2"
                        filter="drop-shadow(0 1px 2px rgba(0,0,0,0.3))"
                      />
                      <text
                        x={BALLOON_R}
                        y={BALLOON_R + 1}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={BALLOON_R * 1.0}
                        fontWeight="bold"
                        fill="#0369a1"
                        fontFamily="Arial, sans-serif"
                      >
                        {b.number}
                      </text>
                    </svg>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Balloon list */}
          {balloons.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-semibold text-sm text-foreground mb-3">{t("balloonList")}</h3>
              <div className="space-y-2">
                {balloons.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setEditingBalloon({ ...b })}
                  >
                    <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-sm flex-shrink-0">
                      {b.number}
                    </div>
                    <span className="text-sm text-foreground flex-1">{b.label || <span className="text-muted-foreground italic">—</span>}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); deleteBalloon(b.id); }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {balloons.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">{t("noBalloons")}</p>
          )}
        </div>
      )}

      {/* Edit balloon dialog */}
      <Dialog open={!!editingBalloon} onOpenChange={(open) => !open && setEditingBalloon(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-sm">
                {editingBalloon?.number}
              </div>
              {t("editTitle")}
            </DialogTitle>
          </DialogHeader>
          {editingBalloon && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm">{t("labelPlaceholder").split(" /")[0]}</Label>
                <Textarea
                  className="mt-1 resize-none"
                  rows={3}
                  placeholder={t("labelPlaceholder")}
                  value={editingBalloon.label}
                  onChange={(e) => setEditingBalloon({ ...editingBalloon, label: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => deleteBalloon(editingBalloon.id)}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  {t("deleteBalloon")}
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
              <FileImage className="w-4 h-4 mr-2" />
              {t("exportJpg")}
            </Button>
            <Button variant="outline" className="w-full" onClick={downloadPdf}>
              <FileText className="w-4 h-4 mr-2" />
              {t("exportPdf")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BalloonedDrawingModule;
