import { useState } from "react";
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
import { CircleDot, Calculator, Droplets, Gauge } from "lucide-react";
import {
  grindingWheels,
  grindingOperations,
  materialGrindingParams,
  coolantTypes,
  calculateWheelRPM,
  calculateWorkRPM,
  calculateMRR,
  estimateSurfaceRoughness,
} from "@/data/grindingData";

const GrindingCalculator = () => {
  const [operationType, setOperationType] = useState<string>("surface");
  const [wheelType, setWheelType] = useState<string>("aluminum-oxide");
  const [materialCategory, setMaterialCategory] = useState<string>("");
  const [wheelDiameter, setWheelDiameter] = useState<number>(200);
  const [wheelWidth, setWheelWidth] = useState<number>(25);
  const [workDiameter, setWorkDiameter] = useState<number>(50);
  const [grainSize, setGrainSize] = useState<string>("80");

  const getOperation = () => {
    return grindingOperations.find((op) => op.id === operationType);
  };

  const getWheel = () => {
    return grindingWheels.find((w) => w.id === wheelType);
  };

  const getMaterialParams = () => {
    return materialGrindingParams.find((m) => m.materialCategory === materialCategory);
  };

  const calculateResults = () => {
    const operation = getOperation();
    const wheel = getWheel();
    const material = getMaterialParams();

    if (!operation || !wheel || !material) return null;

    // Calculate wheel surface speed
    const avgWheelSpeed =
      ((operation.typicalWheelSpeed[0] + operation.typicalWheelSpeed[1]) / 2) *
      material.wheelSpeedMultiplier;
    const wheelRPM = calculateWheelRPM(wheelDiameter, avgWheelSpeed);

    // Calculate work speed (for cylindrical operations)
    const avgWorkSpeed =
      (operation.typicalWorkSpeed[0] + operation.typicalWorkSpeed[1]) / 2;
    const workRPM = calculateWorkRPM(workDiameter, avgWorkSpeed);

    // Calculate depth of cut
    const avgDepth =
      ((operation.typicalDepthOfCut[0] + operation.typicalDepthOfCut[1]) / 2) *
      material.depthOfCutMultiplier;

    // Calculate feed rate
    const avgFeed =
      (operation.typicalFeedRate[0] + operation.typicalFeedRate[1]) / 2;

    // Calculate MRR
    const mrr = calculateMRR(avgDepth, avgFeed, wheelWidth);

    // Estimate surface roughness
    const surfaceRoughness = estimateSurfaceRoughness(
      parseInt(grainSize),
      avgDepth,
      avgFeed
    );

    // Achievable Ra range from material
    const raRange = material.surfaceFinishRa;

    return {
      wheelRPM: Math.round(wheelRPM),
      wheelSurfaceSpeed: avgWheelSpeed.toFixed(1),
      workRPM: Math.round(workRPM),
      workSpeed: avgWorkSpeed.toFixed(1),
      depthOfCut: avgDepth.toFixed(4),
      feedRate: avgFeed.toFixed(2),
      mrr: mrr.toFixed(3),
      estimatedRa: surfaceRoughness.toFixed(2),
      achievableRaMin: raRange[0],
      achievableRaMax: raRange[1],
      coolantRequired: material.coolantRequired,
      recommendedWheels: material.recommendedWheels,
    };
  };

  const results = calculateResults();
  const selectedWheel = getWheel();
  const isCylindrical =
    operationType === "cylindrical-external" ||
    operationType === "cylindrical-internal" ||
    operationType === "centerless";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <CircleDot className="w-5 h-5 text-primary" />
            Taşlama Parametreleri
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Operation Type */}
          <div className="space-y-2">
            <Label className="text-foreground">İşlem Tipi</Label>
            <Select value={operationType} onValueChange={setOperationType}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="İşlem seçin" />
              </SelectTrigger>
              <SelectContent>
                {grindingOperations.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {getOperation() && (
              <p className="text-xs text-muted-foreground">
                {getOperation()?.description}
              </p>
            )}
          </div>

          {/* Wheel Type */}
          <div className="space-y-2">
            <Label className="text-foreground">Taş Tipi</Label>
            <Select value={wheelType} onValueChange={setWheelType}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Taş seçin" />
              </SelectTrigger>
              <SelectContent>
                {grindingWheels.map((wheel) => (
                  <SelectItem key={wheel.id} value={wheel.id}>
                    {wheel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Grain Size */}
          {selectedWheel && (
            <div className="space-y-2">
              <Label className="text-foreground">Tane Boyutu</Label>
              <Select value={grainSize} onValueChange={setGrainSize}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Tane boyutu seçin" />
                </SelectTrigger>
                <SelectContent>
                  {selectedWheel.grainSizes.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Material Category */}
          <div className="space-y-2">
            <Label className="text-foreground">Malzeme</Label>
            <Select value={materialCategory} onValueChange={setMaterialCategory}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Malzeme seçin" />
              </SelectTrigger>
              <SelectContent>
                {materialGrindingParams.map((param) => (
                  <SelectItem key={param.materialCategory} value={param.materialCategory}>
                    {param.materialCategory}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Wheel Dimensions */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Taş Çapı (mm)</Label>
              <Input
                type="number"
                value={wheelDiameter}
                onChange={(e) => setWheelDiameter(Number(e.target.value))}
                className="bg-background border-border"
                min={50}
                max={500}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Taş Genişliği (mm)</Label>
              <Input
                type="number"
                value={wheelWidth}
                onChange={(e) => setWheelWidth(Number(e.target.value))}
                className="bg-background border-border"
                min={5}
                max={100}
              />
            </div>
          </div>

          {/* Work Diameter (for cylindrical) */}
          {isCylindrical && (
            <div className="space-y-2">
              <Label className="text-foreground">İş Parçası Çapı (mm)</Label>
              <Input
                type="number"
                value={workDiameter}
                onChange={(e) => setWorkDiameter(Number(e.target.value))}
                className="bg-background border-border"
                min={1}
              />
            </div>
          )}
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
                  <p className="text-xs text-muted-foreground mb-1">Taş Devri (RPM)</p>
                  <p className="text-2xl font-mono font-bold text-primary">
                    {results.wheelRPM}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {results.wheelSurfaceSpeed} m/s
                  </p>
                </div>
                {isCylindrical && (
                  <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                    <p className="text-xs text-muted-foreground mb-1">İş Parçası Devri</p>
                    <p className="text-2xl font-mono font-bold text-success">
                      {results.workRPM}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {results.workSpeed} m/dk
                    </p>
                  </div>
                )}
                {!isCylindrical && (
                  <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                    <p className="text-xs text-muted-foreground mb-1">Masa Hızı</p>
                    <p className="text-2xl font-mono font-bold text-success">
                      {results.workSpeed}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">m/dk</p>
                  </div>
                )}
              </div>

              {/* Secondary Results */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-xs text-muted-foreground">Kesme Derinliği</p>
                  <p className="text-lg font-mono font-semibold text-foreground">
                    {results.depthOfCut} mm
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-xs text-muted-foreground">İlerleme</p>
                  <p className="text-lg font-mono font-semibold text-foreground">
                    {results.feedRate} mm
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-xs text-muted-foreground">MRR</p>
                  <p className="text-lg font-mono font-semibold text-foreground">
                    {results.mrr} mm³/dk
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-xs text-muted-foreground">Tahmini Ra</p>
                  <p className="text-lg font-mono font-semibold text-foreground">
                    {results.estimatedRa} μm
                  </p>
                </div>
              </div>

              {/* Surface Finish Info */}
              <div className="p-4 rounded-lg bg-card border border-border space-y-3">
                <h4 className="font-medium text-foreground flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-primary" />
                  Yüzey Kalitesi
                </h4>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                      style={{
                        width: `${Math.min(100, (parseFloat(results.estimatedRa) / 3.2) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Ra {results.achievableRaMin} - {results.achievableRaMax} μm elde edilebilir
                  </span>
                </div>
              </div>

              {/* Recommendations */}
              <div className="p-4 rounded-lg bg-card border border-border space-y-3">
                <h4 className="font-medium text-foreground">Öneriler</h4>
                <div className="flex flex-wrap gap-2">
                  {results.coolantRequired ? (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                      <Droplets className="w-3 h-3 mr-1" />
                      Soğutucu Gerekli
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Kuru Çalışılabilir</Badge>
                  )}
                  {results.recommendedWheels.includes(wheelType) ? (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      ✓ Uygun Taş Seçimi
                    </Badge>
                  ) : (
                    <Badge className="bg-warning/20 text-warning border-warning/30">
                      ⚠ Farklı taş önerilir
                    </Badge>
                  )}
                </div>
                {selectedWheel && (
                  <div className="text-sm text-muted-foreground">
                    <p>• En uygun: {selectedWheel.bestFor.join(", ")}</p>
                    <p>• Maks. çevresel hız: {selectedWheel.maxSurfaceSpeed} m/s</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <CircleDot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Parametreleri girerek hesaplama yapın</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GrindingCalculator;
