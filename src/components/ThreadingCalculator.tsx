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
import { Wrench, Calculator, AlertCircle, Droplets, Save } from "lucide-react";
import ThreadPitchReference from "@/components/ThreadPitchReference";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
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
  const { t } = useLanguage();
  const { user } = useAuth();
  const { saveCalculation } = useSupabaseSync();
  const [threadStandard, setThreadStandard] = useState<ThreadStandard>("metric-coarse");
  const [selectedThread, setSelectedThread] = useState<string>("");
  const [materialCategory, setMaterialCategory] = useState<string>("");
  const [tapType, setTapType] = useState<string>("spiral-point");
  const [holeDepth, setHoleDepth] = useState<number>(15);

  const getThreadList = () => {
    switch (threadStandard) {
      case "metric-coarse": return metricCoarseThreads;
      case "metric-fine": return metricFineThreads;
      case "unc": return uncThreads;
      default: return metricCoarseThreads;
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
            {t("threading", "title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground">{t("threading", "threadStandard")}</Label>
            <Select
              value={threadStandard}
              onValueChange={(value: ThreadStandard) => {
                setThreadStandard(value);
                setSelectedThread("");
              }}
            >
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder={t("threading", "selectStandard")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="metric-coarse">{t("threading", "metricCoarse")}</SelectItem>
                <SelectItem value="metric-fine">{t("threading", "metricFine")}</SelectItem>
                <SelectItem value="unc">{t("threading", "uncInch")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">{t("threading", "threadSize")}</Label>
            <Select value={selectedThread} onValueChange={setSelectedThread}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder={t("threading", "selectSize")} />
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

          <div className="space-y-2">
            <Label className="text-foreground">{t("common", "material")}</Label>
            <Select value={materialCategory} onValueChange={setMaterialCategory}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder={t("threading", "selectMaterial")} />
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

          <div className="space-y-2">
            <Label className="text-foreground">{t("threading", "tapType")}</Label>
            <Select value={tapType} onValueChange={setTapType}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder={t("threading", "selectTapType")} />
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

          <div className="space-y-2">
            <Label className="text-foreground">{t("threading", "holeDepth")}</Label>
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
            {t("threading", "calculationResults")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {results ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">{t("threading", "rpm")}</p>
                  <p className="text-2xl font-mono font-bold text-primary">
                    {results.rpm}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                  <p className="text-xs text-muted-foreground mb-1">{t("threading", "feedRatePerRev")}</p>
                  <p className="text-2xl font-mono font-bold text-success">
                    {results.feedRate}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-xs text-muted-foreground">{t("threading", "pilotDrill")}</p>
                  <p className="text-lg font-mono font-semibold text-foreground">
                    Ø{results.pilotDrill} mm
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-xs text-muted-foreground">{t("threading", "threadDepth")}</p>
                  <p className="text-lg font-mono font-semibold text-foreground">
                    {results.threadDepth} mm
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-xs text-muted-foreground">{t("common", "cuttingSpeed")}</p>
                  <p className="text-lg font-mono font-semibold text-foreground">
                    {results.cuttingSpeed} m/{t("common", "minute")}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-xs text-muted-foreground">{t("threading", "torque")}</p>
                  <p className="text-lg font-mono font-semibold text-foreground">
                    {results.torque} Nm
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-card border border-border space-y-3">
                <h4 className="font-medium text-foreground">{t("common", "recommendations")}</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-primary/50 text-primary">
                    {results.recommendedPasses} {t("threading", "passes")}
                  </Badge>
                  {results.coolantRequired ? (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                      <Droplets className="w-3 h-3 mr-1" />
                      {t("threading", "coolantRequired")}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">{t("threading", "dryMachining")}</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>• {t("threading", "threadPitch")}: {results.pitch.toFixed(2)} mm</p>
                  <p>• {t("threading", "nominalDiameter")}: Ø{results.diameter.toFixed(2)} mm</p>
                  <p>• {t("threading", "minHoleDepth")}: {(holeDepth + results.diameter * 0.5).toFixed(1)} mm</p>
                </div>
              </div>

              {tapType === "spiral-point" && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
                  <AlertCircle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-warning">
                    {t("threading", "spiralPointWarning")}
                  </p>
                </div>
              )}
              {user && results && (
                <Button
                  onClick={async () => {
                    await saveCalculation({
                      type: "threading",
                      material: materialCategory || "-",
                      tool: tapTypes.find(tp => tp.id === tapType)?.name || tapType,
                      parameters: {
                        threadStandard,
                        thread: selectedThread,
                        tapType,
                        holeDepth,
                      },
                      results: {
                        rpm: results.rpm,
                        feedRate: `${results.feedRate} mm/dev`,
                        pilotDrill: `Ø${results.pilotDrill} mm`,
                        threadDepth: `${results.threadDepth} mm`,
                        torque: `${results.torque} Nm`,
                        cuttingSpeed: `${results.cuttingSpeed} m/${t("common", "minute")}`,
                      },
                    });
                    toast({ title: t("history", "saved"), description: t("history", "savedDesc") });
                  }}
                  className="w-full gap-2"
                  variant="outline"
                >
                  <Save className="w-4 h-4" />
                  {t("history", "save")}
                </Button>
              )}
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Wrench className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t("threading", "enterParams")}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>

    <ThreadPitchReference />
    </div>
  );
};

export default ThreadingCalculator;
