import { useState, useRef } from "react";
import { Upload, FileImage, Loader2, Clock, Wrench, AlertTriangle, CheckCircle, Trash2, Info, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { exportAnalysisPdf } from "@/lib/exportAnalysisPdf";
import * as UTIF from "utif2";

interface Operation {
  step: number;
  operation: string;
  machine: string;
  tool: string;
  cuttingSpeed: string;
  feedRate: string;
  depthOfCut: string;
  spindleSpeed?: string;
  estimatedTime: string;
  notes: string;
}

interface AnalysisResult {
  partName: string;
  material: string;
  overallDimensions: string;
  complexity: string;
  clampingStrategy?: string;
  operations: Operation[];
  totalEstimatedTime: string;
  setupTime: string;
  recommendations: string[];
  tolerances: string;
  surfaceFinish: string;
  machinesRequired: string[];
  difficultyNotes: string;
}

const convertTifToJpg = async (file: File): Promise<File> => {
  const buffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(buffer);
  const ifds = UTIF.decode(buffer);
  if (ifds.length === 0) throw new Error("TIF dosyası okunamadı");
  
  UTIF.decodeImage(buffer, ifds[0]);
  const rgba = UTIF.toRGBA8(ifds[0]);
  const width = ifds[0].width;
  const height = ifds[0].height;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(new Uint8ClampedArray(rgba.buffer));
  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("Dönüştürme başarısız"));
        const newName = file.name.replace(/\.tiff?$/i, ".jpg");
        resolve(new File([blob], newName, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  });
};

const DrawingAnalyzer = () => {
  const { user, loading } = useAuth();
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

    // Auto-convert TIF/TIFF to JPG
    if (ext === "tif" || ext === "tiff" || file.type === "image/tiff") {
      if (file.size > 50 * 1024 * 1024) {
        toast.error("TIF dosyası çok büyük (maks 50MB). Lütfen daha küçük bir dosya seçin.");
        return;
      }
      setIsConverting(true);
      try {
        toast.info("TIF dosyası JPG'ye dönüştürülüyor...");
        file = await convertTifToJpg(file);
        toast.success("TIF → JPG dönüştürme başarılı!");
      } catch (err: any) {
        console.error("TIF conversion error:", err);
        toast.error(`TIF dönüştürme hatası: ${err.message}`);
        setIsConverting(false);
        return;
      }
      setIsConverting(false);
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    if (!allowedTypes.includes(file.type) && !["jpg", "jpeg", "png", "webp", "gif", "pdf"].includes(ext || "")) {
      toast.error("Desteklenen formatlar: JPG, PNG, WebP, GIF, PDF, TIF/TIFF");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error("Dosya boyutu 20MB'dan küçük olmalıdır");
      return;
    }

    setSelectedFile(file);
    setAnalysis(null);

    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile || !user) {
      toast.error("Lütfen giriş yapın ve bir dosya seçin");
      return;
    }

    setIsAnalyzing(true);
    try {
      // Sanitize filename: remove non-ASCII chars, replace spaces
      const safeName = selectedFile.name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${user.id}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("technical-drawings")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("technical-drawings")
        .getPublicUrl(filePath);

      const imageUrl = urlData.publicUrl;

      // Call edge function
      const { data, error } = await supabase.functions.invoke("analyze-drawing", {
        body: { imageUrl, fileName: selectedFile.name, additionalInfo },
      });

      if (error) throw error;
      if (data?.analysis) {
        setAnalysis(data.analysis);
        toast.success("Analiz tamamlandı!");
      } else {
        throw new Error("Analiz sonucu alınamadı");
      }
    } catch (err: any) {
      console.error("Analysis error:", err);
      toast.error(`Analiz hatası: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setAnalysis(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const complexityColor = (c: string) => {
    switch (c) {
      case "Düşük": return "text-success";
      case "Orta": return "text-warning";
      case "Yüksek": return "text-destructive";
      case "Çok Yüksek": return "text-destructive font-bold";
      default: return "text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center">
          <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
          <p className="text-muted-foreground">Yükleniyor...</p>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center">
          <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Giriş Yapmanız Gerekiyor</h3>
          <p className="text-muted-foreground">Teknik resim analizi için lütfen giriş yapın.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <FileImage className="w-5 h-5 text-primary" />
            Teknik Resim Analizi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.tif,.tiff"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!selectedFile ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-xl p-12 hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3 group-hover:text-primary transition-colors" />
              <p className="text-foreground font-medium">Teknik resim yükleyin</p>
              <p className="text-sm text-muted-foreground mt-1">PNG, JPG, TIF, PDF - Maks 20MB</p>
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileImage className="w-5 h-5 text-primary" />
                  <span className="text-sm text-foreground font-medium">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={clearFile}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>

              {previewUrl && (
                <div className="rounded-lg overflow-hidden border border-border max-h-80 flex items-center justify-center bg-secondary/30">
                  <img src={previewUrl} alt="Teknik Resim" className="max-h-80 object-contain" />
                </div>
              )}

              <Textarea
                placeholder="Ek bilgi ekleyin (opsiyonel): Malzeme, adet, tolerans gereksinimleri vb."
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                className="bg-secondary/30 border-border"
                rows={3}
              />

              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full"
                size="lg"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    AI Analiz Ediliyor...
                  </>
                ) : (
                  <>
                    <Wrench className="w-5 h-5 mr-2" />
                    Analiz Et ve İşleme Planı Oluştur
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-4">
          {/* Export Button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                exportAnalysisPdf(analysis);
                toast.success("PDF rapor indirildi!");
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              PDF Rapor İndir
            </Button>
          </div>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Parça</p>
                <p className="font-semibold text-foreground text-sm">{analysis.partName}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Malzeme</p>
                <p className="font-semibold text-foreground text-sm">{analysis.material}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Karmaşıklık</p>
                <p className={`font-semibold text-sm ${complexityColor(analysis.complexity)}`}>
                  {analysis.complexity}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Toplam Süre</p>
                <p className="font-semibold text-primary text-sm flex items-center justify-center gap-1">
                  <Clock className="w-4 h-4" />
                  {analysis.totalEstimatedTime} dk
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Operations Table */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground text-base">İşlem Adımları</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">#</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">İşlem</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Tezgah</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Takım</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Vc</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">n</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">f</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">ap</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Süre</th>
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
                        <td className="py-2.5 px-3 text-primary font-mono font-semibold">{op.estimatedTime} dk</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Machines Required */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground text-sm flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-primary" />
                  Gereken Tezgahlar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {analysis.machinesRequired.map((m, i) => (
                    <span key={i} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                      {m}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-success" />
                  Öneriler
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {analysis.recommendations.map((r, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-2">
                      <span className="text-success mt-0.5">•</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Tolerances & Surface */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground text-sm flex items-center gap-2">
                  <Info className="w-4 h-4 text-primary" />
                  Tolerans & Yüzey
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Toleranslar</p>
                  <p className="text-sm text-foreground">{analysis.tolerances}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Yüzey Kalitesi</p>
                  <p className="text-sm text-foreground">{analysis.surfaceFinish}</p>
                </div>
              </CardContent>
            </Card>

            {/* Difficulty & Setup */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  Zorluk & Hazırlık
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Hazırlık Süresi</p>
                  <p className="text-sm text-primary font-semibold">{analysis.setupTime} dakika</p>
                </div>
                {analysis.clampingStrategy && (
                  <div>
                    <p className="text-xs text-muted-foreground">Bağlama Stratejisi</p>
                    <p className="text-sm text-foreground">{analysis.clampingStrategy}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Zorluk Notları</p>
                  <p className="text-sm text-foreground">{analysis.difficultyNotes}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default DrawingAnalyzer;
