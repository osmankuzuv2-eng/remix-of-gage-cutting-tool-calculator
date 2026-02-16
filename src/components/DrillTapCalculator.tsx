import { useState, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Circle, Calculator, AlertTriangle, Droplets, Save } from "lucide-react";
import { Material, materials as defaultMaterials } from "@/data/materials";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface DrillTapCalculatorProps {
  customMaterials?: Material[];
}

const standardDrillSizes = [
  1.0, 1.5, 2.0, 2.5, 3.0, 3.2, 3.3, 3.5, 4.0, 4.2, 4.5, 5.0, 5.2, 5.5,
  6.0, 6.5, 6.8, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0, 10.2, 10.5, 11.0,
  12.0, 13.0, 14.0, 15.0, 16.0, 17.0, 18.0, 19.0, 20.0, 21.0, 22.0,
  24.0, 25.0, 26.0, 28.0, 30.0,
];

const drillTypes = [
  { id: "hss", name: "HSS", speedMultiplier: 1.0, lifeMultiplier: 1.0, bestFor: ["General purpose", "Soft steel", "Aluminum"] },
  { id: "hss-co", name: "HSS-Co", speedMultiplier: 1.2, lifeMultiplier: 1.5, bestFor: ["Stainless steel", "Titanium", "Hard materials"] },
  { id: "carbide", name: "Carbide", speedMultiplier: 2.5, lifeMultiplier: 3.0, bestFor: ["Hard materials", "High production", "CNC"] },
  { id: "carbide-coated", name: "Coated Carbide", speedMultiplier: 3.0, lifeMultiplier: 4.0, bestFor: ["Hardened steel", "Super alloys"] },
];

const DrillTapCalculator = ({ customMaterials = [] }: DrillTapCalculatorProps) => {
  const { t } = useLanguage();
  const getMaterialName = (m: Material) => { const tr = t("materialNames", m.id); return tr !== m.id ? tr : m.name; };
  const { user } = useAuth();
  const { saveCalculation } = useSupabaseSync();
  const [mode, setMode] = useState<"drill" | "ream">("drill");
  const [drillDiameter, setDrillDiameter] = useState<number>(10);
  const [drillType, setDrillType] = useState<string>("hss");
  const [materialId, setMaterialId] = useState<string>("");
  const [holeDepth, setHoleDepth] = useState<number>(30);
  const [holeType, setHoleType] = useState<string>("through");
  const [finalDiameter, setFinalDiameter] = useState<number>(10);

  const allMaterials = useMemo(
    () => [...defaultMaterials, ...customMaterials],
    [customMaterials]
  );

  const selectedMaterial = allMaterials.find((m) => m.id === materialId);
  const selectedDrillType = drillTypes.find((d) => d.id === drillType);

  const calculateDrillResults = () => {
    if (!selectedMaterial || !selectedDrillType) return null;
    const baseCuttingSpeed = (selectedMaterial.cuttingSpeed.min + selectedMaterial.cuttingSpeed.max) / 2;
    const adjustedSpeed = baseCuttingSpeed * selectedDrillType.speedMultiplier * 0.7;
    const rpm = (adjustedSpeed * 1000) / (Math.PI * drillDiameter);
    const feedPerRev = drillDiameter * 0.015;
    const feedRate = rpm * feedPerRev;
    const approachDistance = drillDiameter * 0.3;
    const totalDepth = holeType === "blind" ? holeDepth : holeDepth + approachDistance;
    const machiningTime = totalDepth / feedRate;
    const thrustForce = 0.5 * Math.pow(drillDiameter, 1.8) * feedPerRev * 100;
    const torque = 0.1 * Math.pow(drillDiameter, 2) * feedPerRev * 10;
    let breakageRisk = t("drilling", "low");
    const aspectRatio = holeDepth / drillDiameter;
    if (aspectRatio > 5) breakageRisk = t("drilling", "medium");
    if (aspectRatio > 8) breakageRisk = t("drilling", "high");
    if (drillDiameter < 3 && holeDepth > 15) breakageRisk = t("drilling", "high");

    return {
      rpm: Math.round(rpm), cuttingSpeed: adjustedSpeed.toFixed(1),
      feedPerRev: feedPerRev.toFixed(3), feedRate: feedRate.toFixed(1),
      machiningTime: (machiningTime * 60).toFixed(1), thrustForce: thrustForce.toFixed(0),
      torque: torque.toFixed(2), aspectRatio: aspectRatio.toFixed(1), breakageRisk,
      coolantRequired: selectedMaterial.category !== "Dökme Demir",
    };
  };

  const calculateReamResults = () => {
    if (!selectedMaterial) return null;
    const baseCuttingSpeed = (selectedMaterial.cuttingSpeed.min + selectedMaterial.cuttingSpeed.max) / 2;
    const reamingSpeed = baseCuttingSpeed * 0.6;
    const rpm = (reamingSpeed * 1000) / (Math.PI * finalDiameter);
    const feedPerRev = finalDiameter * 0.1;
    const feedRate = rpm * feedPerRev;
    const preDrillSize = finalDiameter - 0.3;
    const closestDrill = standardDrillSizes.reduce((prev, curr) =>
      Math.abs(curr - preDrillSize) < Math.abs(prev - preDrillSize) ? curr : prev
    );
    const stockRemoval = (finalDiameter - closestDrill) / 2;
    const estimatedRa = 0.8 + stockRemoval * 2;

    return {
      rpm: Math.round(rpm), cuttingSpeed: reamingSpeed.toFixed(1),
      feedPerRev: feedPerRev.toFixed(3), feedRate: feedRate.toFixed(1),
      preDrillSize: closestDrill.toFixed(1), stockRemoval: stockRemoval.toFixed(3),
      estimatedRa: estimatedRa.toFixed(2), coolantRequired: true,
    };
  };

  const drillResults = mode === "drill" ? calculateDrillResults() : null;
  const reamResults = mode === "ream" ? calculateReamResults() : null;

  return (
    <div className="space-y-6">
      <Tabs value={mode} onValueChange={(v) => setMode(v as "drill" | "ream")}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="drill">{t("drilling", "drill")}</TabsTrigger>
          <TabsTrigger value="ream">{t("drilling", "reamTab")}</TabsTrigger>
        </TabsList>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Circle className="w-5 h-5 text-primary" />
                {mode === "drill" ? t("drilling", "title") : t("drilling", "reamingParams")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TabsContent value="drill" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label className="text-foreground">{t("drilling", "drillDiameter")}</Label>
                  <Input type="number" value={drillDiameter} onChange={(e) => setDrillDiameter(Number(e.target.value))} className="bg-background border-border" min={0.5} max={50} step={0.1} />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">{t("drilling", "drillType")}</Label>
                  <Select value={drillType} onValueChange={setDrillType}>
                    <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {drillTypes.map((type) => (<SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  {selectedDrillType && (
                    <p className="text-xs text-muted-foreground">{t("drilling", "bestFor")}: {selectedDrillType.bestFor.join(", ")}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">{t("drilling", "holeType")}</Label>
                  <Select value={holeType} onValueChange={setHoleType}>
                    <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="through">{t("drilling", "throughHole")}</SelectItem>
                      <SelectItem value="blind">{t("drilling", "blindHole")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">{t("threading", "holeDepth")}</Label>
                  <Input type="number" value={holeDepth} onChange={(e) => setHoleDepth(Number(e.target.value))} className="bg-background border-border" min={1} />
                </div>
              </TabsContent>

              <TabsContent value="ream" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label className="text-foreground">{t("drilling", "finishedDiameter")}</Label>
                  <Input type="number" value={finalDiameter} onChange={(e) => setFinalDiameter(Number(e.target.value))} className="bg-background border-border" min={3} max={50} step={0.01} />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">{t("threading", "holeDepth")}</Label>
                  <Input type="number" value={holeDepth} onChange={(e) => setHoleDepth(Number(e.target.value))} className="bg-background border-border" min={1} />
                </div>
              </TabsContent>

              <div className="space-y-2">
                <Label className="text-foreground">{t("common", "material")}</Label>
                <Select value={materialId} onValueChange={setMaterialId}>
                  <SelectTrigger className="bg-background border-border"><SelectValue placeholder={t("threading", "selectMaterial")} /></SelectTrigger>
                  <SelectContent>
                    {allMaterials.map((material) => (<SelectItem key={material.id} value={material.id}>{getMaterialName(material)}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Calculator className="w-5 h-5 text-primary" />
                {t("threading", "calculationResults")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mode === "drill" && drillResults ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-xs text-muted-foreground mb-1">{t("threading", "rpm")}</p>
                      <p className="text-2xl font-mono font-bold text-primary">{drillResults.rpm}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                      <p className="text-xs text-muted-foreground mb-1">{t("threading", "feedRatePerRev")}</p>
                      <p className="text-2xl font-mono font-bold text-success">{drillResults.feedPerRev}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground">{t("common", "cuttingSpeed")}</p>
                      <p className="text-lg font-mono font-semibold text-foreground">{drillResults.cuttingSpeed} m/{t("common", "minute")}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground">{t("drilling", "feedSpeed")}</p>
                      <p className="text-lg font-mono font-semibold text-foreground">{drillResults.feedRate} mm/{t("common", "minute")}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground">{t("drilling", "machiningTime")}</p>
                      <p className="text-lg font-mono font-semibold text-foreground">{drillResults.machiningTime} sn</p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground">{t("threading", "torque")}</p>
                      <p className="text-lg font-mono font-semibold text-foreground">{drillResults.torque} Nm</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-card border border-border space-y-3">
                    <h4 className="font-medium text-foreground">{t("drilling", "riskAssessment")}</h4>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={
                        drillResults.breakageRisk === t("drilling", "low")
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : drillResults.breakageRisk === t("drilling", "medium")
                          ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                          : "bg-red-500/20 text-red-400 border-red-500/30"
                      }>
                        {drillResults.breakageRisk === t("drilling", "high") && <AlertTriangle className="w-3 h-3 mr-1" />}
                        {t("drilling", "breakageRisk")}: {drillResults.breakageRisk}
                      </Badge>
                      {drillResults.coolantRequired ? (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                          <Droplets className="w-3 h-3 mr-1" />
                          {t("threading", "coolantRequired")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{t("threading", "dryMachining")}</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>• {t("drilling", "depthRatio")}: {drillResults.aspectRatio}</p>
                      <p>• {t("drilling", "thrustForce")}: ~{drillResults.thrustForce} N</p>
                    </div>
                  </div>
                  {user && (
                    <Button
                      onClick={async () => {
                        await saveCalculation({
                          type: "drilling",
                          material: selectedMaterial?.name || "-",
                          tool: selectedDrillType?.name || drillType,
                          parameters: {
                            mode: "drill",
                            drillDiameter: `${drillDiameter} mm`,
                            holeDepth: `${holeDepth} mm`,
                            holeType,
                          },
                          results: {
                            rpm: drillResults.rpm,
                            cuttingSpeed: `${drillResults.cuttingSpeed} m/${t("common", "minute")}`,
                            feedPerRev: `${drillResults.feedPerRev} mm/dev`,
                            machiningTime: `${drillResults.machiningTime} sn`,
                            torque: `${drillResults.torque} Nm`,
                            breakageRisk: drillResults.breakageRisk,
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
              ) : mode === "ream" && reamResults ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-xs text-muted-foreground mb-1">{t("threading", "rpm")}</p>
                      <p className="text-2xl font-mono font-bold text-primary">{reamResults.rpm}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                      <p className="text-xs text-muted-foreground mb-1">{t("drilling", "preDrillSize")}</p>
                      <p className="text-2xl font-mono font-bold text-success">Ø{reamResults.preDrillSize}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground">{t("common", "cuttingSpeed")}</p>
                      <p className="text-lg font-mono font-semibold text-foreground">{reamResults.cuttingSpeed} m/{t("common", "minute")}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground">{t("common", "feedRate")}</p>
                      <p className="text-lg font-mono font-semibold text-foreground">{reamResults.feedPerRev} mm/dev</p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground">{t("drilling", "stockRemoval")}</p>
                      <p className="text-lg font-mono font-semibold text-foreground">{reamResults.stockRemoval} mm</p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground">{t("drilling", "surfaceFinish")} Ra</p>
                      <p className="text-lg font-mono font-semibold text-foreground">{reamResults.estimatedRa} μm</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-card border border-border space-y-3">
                    <h4 className="font-medium text-foreground">{t("common", "recommendations")}</h4>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                        <Droplets className="w-3 h-3 mr-1" />
                        {t("threading", "coolantRequired")}
                      </Badge>
                    </div>
                  </div>
                  {user && (
                    <Button
                      onClick={async () => {
                        await saveCalculation({
                          type: "drilling",
                          material: selectedMaterial?.name || "-",
                          tool: "Reamer",
                          parameters: {
                            mode: "ream",
                            finalDiameter: `${finalDiameter} mm`,
                            holeDepth: `${holeDepth} mm`,
                          },
                          results: {
                            rpm: reamResults!.rpm,
                            cuttingSpeed: `${reamResults!.cuttingSpeed} m/${t("common", "minute")}`,
                            preDrillSize: `Ø${reamResults!.preDrillSize} mm`,
                            stockRemoval: `${reamResults!.stockRemoval} mm`,
                            surfaceFinish: `Ra ${reamResults!.estimatedRa} μm`,
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
                    <Circle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{t("threading", "enterParams")}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Tabs>
    </div>
  );
};

export default DrillTapCalculator;
