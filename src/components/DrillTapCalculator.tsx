import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Circle, Calculator, AlertTriangle, Droplets } from "lucide-react";
import { Material, materials as defaultMaterials } from "@/data/materials";

interface DrillTapCalculatorProps {
  customMaterials?: Material[];
}

// Standard drill sizes (mm)
const standardDrillSizes = [
  1.0, 1.5, 2.0, 2.5, 3.0, 3.2, 3.3, 3.5, 4.0, 4.2, 4.5, 5.0, 5.2, 5.5,
  6.0, 6.5, 6.8, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0, 10.2, 10.5, 11.0,
  12.0, 13.0, 14.0, 15.0, 16.0, 17.0, 18.0, 19.0, 20.0, 21.0, 22.0,
  24.0, 25.0, 26.0, 28.0, 30.0,
];

// Drill types with their characteristics
const drillTypes = [
  {
    id: "hss",
    name: "HSS (Yüksek Hız Çeliği)",
    speedMultiplier: 1.0,
    lifeMultiplier: 1.0,
    bestFor: ["Genel amaçlı", "Yumuşak çelik", "Alüminyum"],
  },
  {
    id: "hss-co",
    name: "HSS-Co (Kobaltlı)",
    speedMultiplier: 1.2,
    lifeMultiplier: 1.5,
    bestFor: ["Paslanmaz çelik", "Titanyum", "Sert malzemeler"],
  },
  {
    id: "carbide",
    name: "Karbür",
    speedMultiplier: 2.5,
    lifeMultiplier: 3.0,
    bestFor: ["Sert malzemeler", "Yüksek üretim", "CNC işleme"],
  },
  {
    id: "carbide-coated",
    name: "Kaplamalı Karbür",
    speedMultiplier: 3.0,
    lifeMultiplier: 4.0,
    bestFor: ["Sertleştirilmiş çelik", "Süper alaşımlar"],
  },
];

// Hole types
const holeTypes = [
  { id: "through", name: "Geçme Delik" },
  { id: "blind", name: "Kör Delik" },
];

const DrillTapCalculator = ({ customMaterials = [] }: DrillTapCalculatorProps) => {
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

    // Base cutting speed from material
    const baseCuttingSpeed =
      (selectedMaterial.cuttingSpeed.min + selectedMaterial.cuttingSpeed.max) / 2;
    
    // Adjust for drill type
    const adjustedSpeed = baseCuttingSpeed * selectedDrillType.speedMultiplier * 0.7; // Drilling is typically slower

    // Calculate RPM
    const rpm = (adjustedSpeed * 1000) / (Math.PI * drillDiameter);

    // Calculate feed rate (mm/rev) - typically 0.01-0.02 x diameter
    const feedPerRev = drillDiameter * 0.015;
    const feedRate = rpm * feedPerRev; // mm/min

    // Calculate machining time
    const approachDistance = drillDiameter * 0.3; // Point length
    const totalDepth = holeType === "blind" ? holeDepth : holeDepth + approachDistance;
    const machiningTime = totalDepth / feedRate; // minutes

    // Thrust force estimation (simplified)
    const thrustForce = 0.5 * Math.pow(drillDiameter, 1.8) * feedPerRev * 100;

    // Torque estimation (simplified)
    const torque = 0.1 * Math.pow(drillDiameter, 2) * feedPerRev * 10;

    // Breakage risk assessment
    let breakageRisk = "Düşük";
    const aspectRatio = holeDepth / drillDiameter;
    if (aspectRatio > 5) breakageRisk = "Orta";
    if (aspectRatio > 8) breakageRisk = "Yüksek";
    if (drillDiameter < 3 && holeDepth > 15) breakageRisk = "Yüksek";

    return {
      rpm: Math.round(rpm),
      cuttingSpeed: adjustedSpeed.toFixed(1),
      feedPerRev: feedPerRev.toFixed(3),
      feedRate: feedRate.toFixed(1),
      machiningTime: (machiningTime * 60).toFixed(1), // seconds
      thrustForce: thrustForce.toFixed(0),
      torque: torque.toFixed(2),
      aspectRatio: aspectRatio.toFixed(1),
      breakageRisk,
      coolantRequired: selectedMaterial.category !== "Dökme Demir",
    };
  };

  const calculateReamResults = () => {
    if (!selectedMaterial) return null;

    // Reaming parameters are typically much more conservative
    const baseCuttingSpeed =
      (selectedMaterial.cuttingSpeed.min + selectedMaterial.cuttingSpeed.max) / 2;
    
    // Reaming speed is typically 50-70% of drilling speed
    const reamingSpeed = baseCuttingSpeed * 0.6;

    // Calculate RPM
    const rpm = (reamingSpeed * 1000) / (Math.PI * finalDiameter);

    // Feed rate for reaming - higher than drilling (0.1-0.3 x diameter)
    const feedPerRev = finalDiameter * 0.1;
    const feedRate = rpm * feedPerRev;

    // Pre-drill size (typically 0.2-0.5mm less than final)
    const preDrillSize = finalDiameter - 0.3;
    const closestDrill = standardDrillSizes.reduce((prev, curr) =>
      Math.abs(curr - preDrillSize) < Math.abs(prev - preDrillSize) ? curr : prev
    );

    // Stock removal per side
    const stockRemoval = (finalDiameter - closestDrill) / 2;

    // Surface finish estimation (Ra in μm)
    const estimatedRa = 0.8 + stockRemoval * 2;

    return {
      rpm: Math.round(rpm),
      cuttingSpeed: reamingSpeed.toFixed(1),
      feedPerRev: feedPerRev.toFixed(3),
      feedRate: feedRate.toFixed(1),
      preDrillSize: closestDrill.toFixed(1),
      stockRemoval: stockRemoval.toFixed(3),
      estimatedRa: estimatedRa.toFixed(2),
      coolantRequired: true,
    };
  };

  const drillResults = mode === "drill" ? calculateDrillResults() : null;
  const reamResults = mode === "ream" ? calculateReamResults() : null;

  return (
    <div className="space-y-6">
      <Tabs value={mode} onValueChange={(v) => setMode(v as "drill" | "ream")}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="drill">Delme</TabsTrigger>
          <TabsTrigger value="ream">Raybalama</TabsTrigger>
        </TabsList>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Input Panel */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Circle className="w-5 h-5 text-primary" />
                {mode === "drill" ? "Delme Parametreleri" : "Raybalama Parametreleri"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TabsContent value="drill" className="mt-0 space-y-4">
                {/* Drill Diameter */}
                <div className="space-y-2">
                  <Label className="text-foreground">Matkap Çapı (mm)</Label>
                  <Input
                    type="number"
                    value={drillDiameter}
                    onChange={(e) => setDrillDiameter(Number(e.target.value))}
                    className="bg-background border-border"
                    min={0.5}
                    max={50}
                    step={0.1}
                  />
                </div>

                {/* Drill Type */}
                <div className="space-y-2">
                  <Label className="text-foreground">Matkap Tipi</Label>
                  <Select value={drillType} onValueChange={setDrillType}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Tip seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {drillTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedDrillType && (
                    <p className="text-xs text-muted-foreground">
                      En uygun: {selectedDrillType.bestFor.join(", ")}
                    </p>
                  )}
                </div>

                {/* Hole Type */}
                <div className="space-y-2">
                  <Label className="text-foreground">Delik Tipi</Label>
                  <Select value={holeType} onValueChange={setHoleType}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Tip seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {holeTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              </TabsContent>

              <TabsContent value="ream" className="mt-0 space-y-4">
                {/* Final Diameter */}
                <div className="space-y-2">
                  <Label className="text-foreground">Bitmiş Çap (mm)</Label>
                  <Input
                    type="number"
                    value={finalDiameter}
                    onChange={(e) => setFinalDiameter(Number(e.target.value))}
                    className="bg-background border-border"
                    min={3}
                    max={50}
                    step={0.01}
                  />
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
              </TabsContent>

              {/* Material (Common) */}
              <div className="space-y-2">
                <Label className="text-foreground">Malzeme</Label>
                <Select value={materialId} onValueChange={setMaterialId}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Malzeme seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {allMaterials.map((material) => (
                      <SelectItem key={material.id} value={material.id}>
                        {material.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              {mode === "drill" && drillResults ? (
                <div className="space-y-4">
                  {/* Primary Results */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-xs text-muted-foreground mb-1">Devir (RPM)</p>
                      <p className="text-2xl font-mono font-bold text-primary">
                        {drillResults.rpm}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                      <p className="text-xs text-muted-foreground mb-1">İlerleme (mm/dev)</p>
                      <p className="text-2xl font-mono font-bold text-success">
                        {drillResults.feedPerRev}
                      </p>
                    </div>
                  </div>

                  {/* Secondary Results */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground">Kesme Hızı</p>
                      <p className="text-lg font-mono font-semibold text-foreground">
                        {drillResults.cuttingSpeed} m/dk
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground">İlerleme Hızı</p>
                      <p className="text-lg font-mono font-semibold text-foreground">
                        {drillResults.feedRate} mm/dk
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground">İşleme Süresi</p>
                      <p className="text-lg font-mono font-semibold text-foreground">
                        {drillResults.machiningTime} sn
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground">Tork</p>
                      <p className="text-lg font-mono font-semibold text-foreground">
                        {drillResults.torque} Nm
                      </p>
                    </div>
                  </div>

                  {/* Risk Assessment */}
                  <div className="p-4 rounded-lg bg-card border border-border space-y-3">
                    <h4 className="font-medium text-foreground">Risk Değerlendirmesi</h4>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        className={
                          drillResults.breakageRisk === "Düşük"
                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : drillResults.breakageRisk === "Orta"
                            ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                            : "bg-red-500/20 text-red-400 border-red-500/30"
                        }
                      >
                        {drillResults.breakageRisk === "Yüksek" && (
                          <AlertTriangle className="w-3 h-3 mr-1" />
                        )}
                        Kırılma Riski: {drillResults.breakageRisk}
                      </Badge>
                      {drillResults.coolantRequired ? (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                          <Droplets className="w-3 h-3 mr-1" />
                          Soğutucu Gerekli
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Kuru Çalışılabilir</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>• Derinlik/Çap oranı: {drillResults.aspectRatio}</p>
                      <p>• İtme kuvveti: ~{drillResults.thrustForce} N</p>
                    </div>
                  </div>
                </div>
              ) : mode === "ream" && reamResults ? (
                <div className="space-y-4">
                  {/* Primary Results */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-xs text-muted-foreground mb-1">Devir (RPM)</p>
                      <p className="text-2xl font-mono font-bold text-primary">
                        {reamResults.rpm}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                      <p className="text-xs text-muted-foreground mb-1">Ön Delme Çapı</p>
                      <p className="text-2xl font-mono font-bold text-success">
                        Ø{reamResults.preDrillSize}
                      </p>
                    </div>
                  </div>

                  {/* Secondary Results */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground">Kesme Hızı</p>
                      <p className="text-lg font-mono font-semibold text-foreground">
                        {reamResults.cuttingSpeed} m/dk
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground">İlerleme</p>
                      <p className="text-lg font-mono font-semibold text-foreground">
                        {reamResults.feedPerRev} mm/dev
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground">Payda</p>
                      <p className="text-lg font-mono font-semibold text-foreground">
                        {reamResults.stockRemoval} mm
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground">Tahmini Ra</p>
                      <p className="text-lg font-mono font-semibold text-foreground">
                        {reamResults.estimatedRa} μm
                      </p>
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="p-4 rounded-lg bg-card border border-border space-y-3">
                    <h4 className="font-medium text-foreground">Öneriler</h4>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                        <Droplets className="w-3 h-3 mr-1" />
                        Soğutucu Zorunlu
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>• Rayba girişte yavaş başlatın</p>
                      <p>• Rayba çıkışta döndürmeye devam edin</p>
                      <p>• Talaşı sık temizleyin</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Circle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Parametreleri girerek hesaplama yapın</p>
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
