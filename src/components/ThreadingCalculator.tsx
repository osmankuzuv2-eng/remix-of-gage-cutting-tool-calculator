import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Wrench, Calculator, AlertCircle, Droplets } from "lucide-react";
import ThreadPitchReference from "@/components/ThreadPitchReference";
import {
  metricCoarseThreads,
  metricFineThreads,
  uncThreads,
  threadCuttingParams,
  tapTypes,
  calculateThreadingRPM,
  calculateTappingTorque,
  type MetricThread,
  type InchThread,
} from "@/data/threadingData";

type ThreadStandard = "metric-coarse" | "metric-fine" | "unc";

const ThreadingCalculator = () => {
  const [threadStandard, setThreadStandard] = useState<ThreadStandard>("metric-coarse");
  const [selectedThread, setSelectedThread] = useState<string>("");
  const [materialCategory, setMaterialCategory] = useState<string>("");
  const [tapType, setTapType] = useState<string>("spiral-point");
  const [holeDepth, setHoleDepth] = useState<number>(15);

  const getThreadList = () => {
    switch (threadStandard) {
      case "metric-coarse":
        return metricCoarseThreads;
      case "metric-fine":
        return metricFineThreads;
      case "unc":
        return uncThreads;
      default:
        return metricCoarseThreads;
    }
  };

  const getSelectedThreadData = (): MetricThread | InchThread | null => {
    const threads = getThreadList();
    return threads.find((t) => t.designation === selectedThread) || null;
  };

  const getMaterialParams = () => {
    return threadCuttingParams.find((p) => p.materialCategory === materialCategory);
  };

  const getSelectedTapType = () => {
    return tapTypes.find((t) => t.id === tapType);
  };

  const calculateResults = () => {
    const thread = getSelectedThreadData();
    const material = getMaterialParams();
    const tap = getSelectedTapType();

    if (!thread || !material || !tap) return null;

    const isMetric = threadStandard !== "unc";
    const diameter = isMetric
      ? (thread as MetricThread).nominalDiameter
      : (thread as InchThread).nominalDiameter * 25.4;
    const pitch = isMetric
      ? (thread as MetricThread).pitch
      : 25.4 / (thread as InchThread).tpi;

    const avgCuttingSpeed =
      ((material.cuttingSpeedRange[0] + material.cuttingSpeedRange[1]) / 2) *
      tap.speedMultiplier;
    const rpm = calculateThreadingRPM(avgCuttingSpeed, diameter);
    const feedRate = pitch * material.feedMultiplier;
    const torque = calculateTappingTorque(diameter, pitch);
    const threadDepth = pitch * 0.6134;
    const pilotDrill = isMetric
      ? (thread as MetricThread).pilotDrillDiameter
      : (thread as InchThread).pilotDrillDiameterMM;

    return {
      rpm: Math.round(rpm),
      feedRate: feedRate.toFixed(3),
      torque: torque.toFixed(2),
      threadDepth: threadDepth.toFixed(3),
      pilotDrill: pilotDrill.toFixed(2),
      recommendedPasses: material.recommendedPasses,
      coolantRequired: material.coolantRequired,
      cuttingSpeed: avgCuttingSpeed.toFixed(1),
      pitch,
      diameter,
    };
  };

  const results = calculateResults();

  return (
    <div className="space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Wrench className="w-5 h-5 text-primary" />
            Diş Açma Parametreleri
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Thread Standard */}
          <div className="space-y-2">
            <Label className="text-foreground">Diş Standardı</Label>
            <Select
              value={threadStandard}
              onValueChange={(value: ThreadStandard) => {
                setThreadStandard(value);
                setSelectedThread("");
              }}
            >
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Standart seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="metric-coarse">Metrik Kaba (ISO)</SelectItem>
                <SelectItem value="metric-fine">Metrik İnce (ISO)</SelectItem>
                <SelectItem value="unc">UNC (İnç)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Thread Selection */}
          <div className="space-y-2">
            <Label className="text-foreground">Diş Boyutu</Label>
            <Select value={selectedThread} onValueChange={setSelectedThread}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Diş boyutu seçin" />
              </SelectTrigger>
              <SelectContent>
                {getThreadList().map((thread) => (
                  <SelectItem key={thread.designation} value={thread.designation}>
                    {thread.designation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Material Category */}
          <div className="space-y-2">
            <Label className="text-foreground">Malzeme</Label>
            <Select value={materialCategory} onValueChange={setMaterialCategory}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Malzeme seçin" />
              </SelectTrigger>
              <SelectContent>
                {threadCuttingParams.map((param) => (
                  <SelectItem key={param.materialCategory} value={param.materialCategory}>
                    {param.materialCategory}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tap Type */}
          <div className="space-y-2">
            <Label className="text-foreground">Kılavuz Tipi</Label>
            <Select value={tapType} onValueChange={setTapType}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Kılavuz tipi seçin" />
              </SelectTrigger>
              <SelectContent>
                {tapTypes.map((tap) => (
                  <SelectItem key={tap.id} value={tap.id}>
                    {tap.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {getSelectedTapType() && (
              <p className="text-xs text-muted-foreground">
                {getSelectedTapType()?.description}
              </p>
            )}
          </div>

          {/* Hole Depth */}
          <div className="space-y-2">
            <Label className="text-foreground">Delik Derinliği (mm)</Label>
            <Input
              type="number"
              value={holeDepth}
              onChange={(e) => setHoleDepth(Number(e.target.value))}
              className="bg-background border-border"
              min={1}
            />
          </div>
        </CardContent>
      </Card>

      {/* Results Panel */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Calculator className="w-5 h-5 text-primary" />
            Hesaplama Sonuçları
          </CardTitle>
        </CardHeader>
        <CardContent>
          {results ? (
            <div className="space-y-4">
              {/* Primary Results */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">Devir (RPM)</p>
                  <p className="text-2xl font-mono font-bold text-primary">
                    {results.rpm}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                  <p className="text-xs text-muted-foreground mb-1">İlerleme (mm/dev)</p>
                  <p className="text-2xl font-mono font-bold text-success">
                    {results.feedRate}
                  </p>
                </div>
              </div>

              {/* Secondary Results */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-xs text-muted-foreground">Ön Delme Çapı</p>
                  <p className="text-lg font-mono font-semibold text-foreground">
                    Ø{results.pilotDrill} mm
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-xs text-muted-foreground">Diş Derinliği</p>
                  <p className="text-lg font-mono font-semibold text-foreground">
                    {results.threadDepth} mm
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-xs text-muted-foreground">Kesme Hızı</p>
                  <p className="text-lg font-mono font-semibold text-foreground">
                    {results.cuttingSpeed} m/dk
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-xs text-muted-foreground">Tork (Tahmini)</p>
                  <p className="text-lg font-mono font-semibold text-foreground">
                    {results.torque} Nm
                  </p>
                </div>
              </div>

              {/* Recommendations */}
              <div className="p-4 rounded-lg bg-card border border-border space-y-3">
                <h4 className="font-medium text-foreground">Öneriler</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-primary/50 text-primary">
                    {results.recommendedPasses} Paso
                  </Badge>
                  {results.coolantRequired ? (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                      <Droplets className="w-3 h-3 mr-1" />
                      Soğutucu Gerekli
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Kuru Çalışılabilir</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>• Diş adımı: {results.pitch.toFixed(2)} mm</p>
                  <p>• Nominal çap: Ø{results.diameter.toFixed(2)} mm</p>
                  <p>• Minimum delik derinliği: {(holeDepth + results.diameter * 0.5).toFixed(1)} mm</p>
                </div>
              </div>

              {/* Warning for blind holes */}
              {tapType === "spiral-point" && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
                  <AlertCircle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-warning">
                    Spiral point kılavuz kör deliklerde kullanılmaz. Kör delikler için
                    helis kanallı kılavuz tercih edin.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Wrench className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Parametreleri girerek hesaplama yapın</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>

    {/* Thread Pitch Reference Tables */}
    <ThreadPitchReference />
    </div>
  );
};

export default ThreadingCalculator;
