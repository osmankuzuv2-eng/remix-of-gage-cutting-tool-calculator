import { useState, useRef } from "react";
import { Upload, FileImage, Loader2, Clock, Wrench, AlertTriangle, CheckCircle, Trash2, Info, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { exportAnalysisPdf } from "@/lib/exportAnalysisPdf";
import * as UTIF from "utif2";
import { useLanguage } from "@/i18n/LanguageContext";

const convertPdfToJpg = async (file: File): Promise<File> => {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs`;
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

interface Operation {
  step: number; operation: string; machine: string; tool: string;
  cuttingSpeed: string; feedRate: string; depthOfCut: string;
  spindleSpeed?: string; estimatedTime: string; notes: string;
}

interface AnalysisResult {
  partName: string; material: string; overallDimensions: string;
  complexity: string; clampingStrategy?: string; operations: Operation[];
  totalEstimatedTime: string; setupTime: string; recommendations: string[];
  tolerances: string; surfaceFinish: string; machinesRequired: string[];
  difficultyNotes: string;
}

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

const DrawingAnalyzer = () => {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "tif" || ext === "tiff" || file.type === "image/tiff") {
      if (file.size > 50 * 1024 * 1024) { toast.error(`TIF ${t("drawingAnalyzer", "fileTooLarge")}`); return; }
      setIsConverting(true);
      try {
        toast.info(t("drawingAnalyzer", "convertingTif"));
        file = await convertTifToJpg(file);
        toast.success(`TIF → JPG ${t("drawingAnalyzer", "conversionSuccess")}`);
      } catch (err: any) { toast.error(`TIF ${t("drawingAnalyzer", "conversionError")}: ${err.message}`); setIsConverting(false); return; }
      setIsConverting(false);
    }

    if (ext === "pdf" || file.type === "application/pdf") {
      if (file.size > 50 * 1024 * 1024) { toast.error(`PDF ${t("drawingAnalyzer", "fileTooLarge")}`); return; }
      setIsConverting(true);
      try {
        toast.info(t("drawingAnalyzer", "convertingPdf"));
        file = await convertPdfToJpg(file);
        toast.success(`PDF → JPG ${t("drawingAnalyzer", "conversionSuccess")}`);
      } catch (err: any) { toast.error(`PDF ${t("drawingAnalyzer", "conversionError")}: ${err.message}`); setIsConverting(false); return; }
      setIsConverting(false);
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type) && !["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "")) {
      toast.error(t("drawingAnalyzer", "unsupportedFormat")); return;
    }
    if (file.size > 20 * 1024 * 1024) { toast.error(t("drawingAnalyzer", "fileSizeError")); return; }

    setSelectedFile(file); setAnalysis(null);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleAnalyze = async () => {
    if (!selectedFile) { toast.error(t("drawingAnalyzer", "selectFile")); return; }
    setIsAnalyzing(true);
    try {
      const safeName = selectedFile.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `anonymous/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage.from("technical-drawings").upload(filePath, selectedFile);
      if (uploadError) throw uploadError;
      const { data: urlData, error: urlError } = await supabase.storage.from("technical-drawings").createSignedUrl(filePath, 3600);
      if (urlError) throw urlError;
      const { data, error } = await supabase.functions.invoke("analyze-drawing", {
        body: { imageUrl: urlData.signedUrl, fileName: selectedFile.name, additionalInfo },
      });
      if (error) throw error;
      if (data?.analysis) { setAnalysis(data.analysis); toast.success(t("drawingAnalyzer", "analysisComplete")); }
      else throw new Error(t("drawingAnalyzer", "noAnalysisResult"));
    } catch (err: any) { toast.error(`${t("drawingAnalyzer", "analysisError")}: ${err.message}`); }
    finally { setIsAnalyzing(false); }
  };

  const clearFile = () => { setSelectedFile(null); setPreviewUrl(null); setAnalysis(null); if (fileInputRef.current) fileInputRef.current.value = ""; };

  const complexityColor = (c: string) => {
    switch (c) { case "Düşük": return "text-success"; case "Orta": return "text-warning"; case "Yüksek": return "text-destructive"; case "Çok Yüksek": return "text-destructive font-bold"; default: return "text-muted-foreground"; }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <FileImage className="w-5 h-5 text-primary" />{t("drawingAnalyzer", "title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.tif,.tiff" onChange={handleFileSelect} className="hidden" />
          {!selectedFile ? (
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-xl p-12 hover:border-primary/50 hover:bg-primary/5 transition-all group">
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3 group-hover:text-primary transition-colors" />
              <p className="text-foreground font-medium">{t("drawingAnalyzer", "uploadDrawing")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("drawingAnalyzer", "fileFormats")}</p>
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileImage className="w-5 h-5 text-primary" />
                  <span className="text-sm text-foreground font-medium">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
                <Button variant="ghost" size="sm" onClick={clearFile}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
              {previewUrl && (
                <div className="rounded-lg overflow-hidden border border-border max-h-80 flex items-center justify-center bg-secondary/30">
                  <img src={previewUrl} alt="Technical Drawing" className="max-h-80 object-contain" />
                </div>
              )}
              <Textarea placeholder={t("drawingAnalyzer", "additionalInfo")} value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} className="bg-secondary/30 border-border" rows={3} />
              <Button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full" size="lg">
                {isAnalyzing ? (<><Loader2 className="w-5 h-5 mr-2 animate-spin" />{t("drawingAnalyzer", "analyzing")}</>) : (<><Wrench className="w-5 h-5 mr-2" />{t("drawingAnalyzer", "analyze")}</>)}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {analysis && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => { exportAnalysisPdf(analysis, t); toast.success(t("drawingAnalyzer", "reportDownloaded")); }}>
              <Download className="w-4 h-4 mr-2" />{t("drawingAnalyzer", "downloadReport")}
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card border-border"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground mb-1">{t("drawingAnalyzer", "part")}</p><p className="font-semibold text-foreground text-sm">{analysis.partName}</p></CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground mb-1">{t("common", "material")}</p><p className="font-semibold text-foreground text-sm">{analysis.material}</p></CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground mb-1">{t("drawingAnalyzer", "complexity")}</p><p className={`font-semibold text-sm ${complexityColor(analysis.complexity)}`}>{analysis.complexity}</p></CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground mb-1">{t("drawingAnalyzer", "totalTime")}</p><p className="font-semibold text-primary text-sm flex items-center justify-center gap-1"><Clock className="w-4 h-4" />{analysis.totalEstimatedTime} {t("common", "minute")}</p></CardContent></Card>
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
                <div><p className="text-xs text-muted-foreground">{t("drawingAnalyzer", "difficultyNotes")}</p><p className="text-sm text-foreground">{analysis.difficultyNotes}</p></div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default DrawingAnalyzer;
