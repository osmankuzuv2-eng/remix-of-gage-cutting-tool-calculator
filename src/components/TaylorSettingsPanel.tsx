import { useState, useEffect } from "react";
import { Settings, RotateCcw, Save, X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { materials as defaultMaterials } from "@/data/materials";
import { safeSetItem } from "@/lib/safeStorage";

interface TaylorValues {
  [materialId: string]: {
    taylorC: number;
    taylorN: number;
  };
}

interface TaylorSettingsPanelProps {
  onValuesChange: (values: TaylorValues) => void;
  customValues: TaylorValues;
}

const TaylorSettingsPanel = ({ onValuesChange, customValues }: TaylorSettingsPanelProps) => {
  const [open, setOpen] = useState(false);
  const [localValues, setLocalValues] = useState<TaylorValues>({});

  useEffect(() => {
    // Initialize with custom values or defaults
    const initialValues: TaylorValues = {};
    defaultMaterials.forEach((mat) => {
      initialValues[mat.id] = customValues[mat.id] || {
        taylorC: mat.taylorC,
        taylorN: mat.taylorN,
      };
    });
    setLocalValues(initialValues);
  }, [customValues, open]);

  const handleValueChange = (materialId: string, field: 'taylorC' | 'taylorN', value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    setLocalValues((prev) => ({
      ...prev,
      [materialId]: {
        ...prev[materialId],
        [field]: numValue,
      },
    }));
  };

  const handleSave = () => {
    onValuesChange(localValues);
    
    // Save to localStorage for persistence
    safeSetItem('taylorCustomValues', localValues);
    
    toast({
      title: "Ayarlar kaydedildi",
      description: "Taylor değerleri başarıyla güncellendi.",
    });
    setOpen(false);
  };

  const handleReset = () => {
    const defaultValues: TaylorValues = {};
    defaultMaterials.forEach((mat) => {
      defaultValues[mat.id] = {
        taylorC: mat.taylorC,
        taylorN: mat.taylorN,
      };
    });
    setLocalValues(defaultValues);
    toast({
      title: "Varsayılanlara sıfırlandı",
      description: "Tüm Taylor değerleri fabrika ayarlarına döndürüldü.",
    });
  };

  const handleResetSingle = (materialId: string) => {
    const defaultMat = defaultMaterials.find((m) => m.id === materialId);
    if (!defaultMat) return;

    setLocalValues((prev) => ({
      ...prev,
      [materialId]: {
        taylorC: defaultMat.taylorC,
        taylorN: defaultMat.taylorN,
      },
    }));
  };

  // Calculate expected tool life for preview
  const calculateToolLife = (materialId: string) => {
    const mat = defaultMaterials.find((m) => m.id === materialId);
    if (!mat || !localValues[materialId]) return 0;
    
    const avgSpeed = (mat.cuttingSpeed.min + mat.cuttingSpeed.max) / 2;
    const { taylorC, taylorN } = localValues[materialId];
    return Math.round(Math.pow(taylorC / avgSpeed, 1 / taylorN));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="w-4 h-4" />
          Taylor Ayarları
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Taylor Denklemi Parametreleri
          </DialogTitle>
          <DialogDescription>
            Her malzeme için Taylor sabiti (C) ve üssü (n) değerlerini özelleştirin. 
            Bu değerler takım ömrü hesaplamalarını etkiler.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 rounded-lg bg-accent/10 border border-accent/30 mb-4">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-accent mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground mb-1">Taylor Denklemi: V × T^n = C</p>
              <ul className="text-muted-foreground space-y-1">
                <li><strong>C (Taylor Sabiti):</strong> Yüksek değer = Uzun takım ömrü</li>
                <li><strong>n (Taylor Üssü):</strong> Düşük değer = Hıza daha duyarlı (0.10-0.35 arası)</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="grid gap-3">
            {defaultMaterials.map((mat) => {
              const defaultC = mat.taylorC;
              const defaultN = mat.taylorN;
              const currentC = localValues[mat.id]?.taylorC ?? defaultC;
              const currentN = localValues[mat.id]?.taylorN ?? defaultN;
              const isModified = currentC !== defaultC || currentN !== defaultN;
              const toolLife = calculateToolLife(mat.id);

              return (
                <div
                  key={mat.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    isModified 
                      ? 'bg-primary/5 border-primary/30' 
                      : 'bg-card border-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${mat.color}`} />
                      <span className="font-medium text-foreground">{mat.name}</span>
                      {isModified && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                          Değiştirildi
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Tahmini Ömür: <span className="font-mono text-foreground">{toolLife} dk</span>
                      </span>
                      {isModified && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleResetSingle(mat.id)}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Varsayılana sıfırla</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Taylor C (Varsayılan: {defaultC})
                      </Label>
                      <Input
                        type="number"
                        value={currentC}
                        onChange={(e) => handleValueChange(mat.id, 'taylorC', e.target.value)}
                        min="1"
                        max="10000"
                        step="1"
                        className="h-9 font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Taylor n (Varsayılan: {defaultN})
                      </Label>
                      <Input
                        type="number"
                        value={currentN}
                        onChange={(e) => handleValueChange(mat.id, 'taylorN', e.target.value)}
                        min="0.05"
                        max="0.5"
                        step="0.01"
                        className="h-9 font-mono"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Tümünü Sıfırla
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSave} className="gap-2">
              <Save className="w-4 h-4" />
              Kaydet
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaylorSettingsPanel;
