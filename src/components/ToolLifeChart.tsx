import { useMemo, useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from "recharts";
import { TrendingUp, Info, X, ChevronDown, ChevronUp } from "lucide-react";
import { materials, toolTypes, Material } from "@/data/materials";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import InfoPanelContent from "@/components/InfoPanelContent";
import TaylorSettingsPanel from "@/components/TaylorSettingsPanel";
import TaylorComparisonTable from "@/components/TaylorComparisonTable";
import { safeGetItem, isValidObject } from "@/lib/safeStorage";

interface TaylorValues {
  [materialId: string]: {
    taylorC: number;
    taylorN: number;
  };
}

interface ToolLifeChartProps {
  customMaterials: Material[];
}

const TAYLOR_STORAGE_KEY = "taylorCustomValues";

const ToolLifeChart = ({ customMaterials }: ToolLifeChartProps) => {
  const [activeInfoPanel, setActiveInfoPanel] = useState<string | null>(null);
  const [customTaylorValues, setCustomTaylorValues] = useState<TaylorValues>({});

  // Load custom Taylor values from localStorage on mount
  useEffect(() => {
    const stored = safeGetItem<TaylorValues>(TAYLOR_STORAGE_KEY, {});
    if (isValidObject(stored)) {
      setCustomTaylorValues(stored);
    }
  }, []);

  // Merge default materials with custom Taylor values
  const allMaterials = useMemo(() => {
    return [...materials, ...customMaterials].map((mat) => {
      if (customTaylorValues[mat.id]) {
        return {
          ...mat,
          taylorC: customTaylorValues[mat.id].taylorC,
          taylorN: customTaylorValues[mat.id].taylorN,
        };
      }
      return mat;
    });
  }, [customMaterials, customTaylorValues]);

  const chartData = useMemo(() => {
    return allMaterials.map((mat) => {
      const baseSpeed = (mat.cuttingSpeed.min + mat.cuttingSpeed.max) / 2;
      const toolLife = Math.pow(mat.taylorC / baseSpeed, 1 / mat.taylorN);
      
      return {
        name: mat.name.length > 12 ? mat.name.substring(0, 12) + "..." : mat.name,
        fullName: mat.name,
        toolLife: Math.round(toolLife),
        cuttingSpeed: Math.round(baseSpeed),
        taylorN: mat.taylorN,
        taylorC: mat.taylorC,
      };
    });
  }, [allMaterials]);

  const speedVsLifeData = useMemo(() => {
    const material = allMaterials[0];
    const data = [];
    
    for (let speed = material.cuttingSpeed.min; speed <= material.cuttingSpeed.max * 1.5; speed += 10) {
      const life = Math.pow(material.taylorC / speed, 1 / material.taylorN);
      data.push({
        speed: Math.round(speed),
        life: Math.round(life),
        optimal: speed >= material.cuttingSpeed.min && speed <= material.cuttingSpeed.max,
      });
    }
    return data;
  }, [allMaterials]);

  const toolComparisonData = useMemo(() => {
    const material = allMaterials[0];
    return toolTypes.map((tool) => {
      const adjustedSpeed = ((material.cuttingSpeed.min + material.cuttingSpeed.max) / 2) * tool.multiplier;
      const life = Math.pow(material.taylorC / (adjustedSpeed / tool.multiplier), 1 / material.taylorN);
      
      return {
        name: tool.name.split(" ")[0],
        fullName: tool.name,
        life: Math.round(life * tool.multiplier),
        multiplier: tool.multiplier,
      };
    });
  }, [allMaterials]);

  const toggleInfoPanel = (panel: string) => {
    setActiveInfoPanel(activeInfoPanel === panel ? null : panel);
  };

  // Get first material for example calculations
  const exampleMaterial = allMaterials[0];
  const exampleSpeed = Math.round((exampleMaterial.cuttingSpeed.min + exampleMaterial.cuttingSpeed.max) / 2);
  const exampleLife = Math.round(Math.pow(exampleMaterial.taylorC / exampleSpeed, 1 / exampleMaterial.taylorN));

  const handleTaylorValuesChange = (values: TaylorValues) => {
    setCustomTaylorValues(values);
  };

  return (
    <div className="industrial-card p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Takım Ömrü Grafikleri
          </h2>
        </div>
        <TaylorSettingsPanel 
          onValuesChange={handleTaylorValuesChange}
          customValues={customTaylorValues}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Material Comparison */}
        <div className="p-4 rounded-lg bg-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Malzeme Bazlı Takım Ömrü (dk)
            </h3>
            <button
              onClick={() => toggleInfoPanel('materialLife')}
              className={`p-1.5 rounded-md transition-colors ${
                activeInfoPanel === 'materialLife' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-accent/20 text-muted-foreground'
              }`}
            >
              {activeInfoPanel === 'materialLife' ? <X className="w-4 h-4" /> : <Info className="w-4 h-4" />}
            </button>
          </div>
          
          <Collapsible open={activeInfoPanel === 'materialLife'}>
            <CollapsibleContent className="mb-4">
              <InfoPanelContent
                title="Malzeme Bazlı Takım Ömrü Hesaplama"
                description="Her malzeme için ortalama kesme hızında beklenen takım ömrünü Taylor denklemi ile hesaplar. Malzeme sertliği arttıkça takım ömrü azalır."
                formula="T = (C / V)^(1/n)"
                metrics={[
                  { label: "T (Takım Ömrü)", value: "dakika" },
                  { label: "C (Taylor Sabiti)", value: "Malzemeye özel" },
                  { label: "V (Kesme Hızı)", value: "m/dk" },
                  { label: "n (Taylor Üssü)", value: "0.10 - 0.35" },
                ]}
                useCases={[
                  "Malzeme seçiminde takım maliyeti karşılaştırması",
                  "Üretim planlamasında takım değişim süre tahmini",
                  "Yeni malzeme işleme parametresi belirleme",
                  "Takım stok optimizasyonu",
                ]}
                tip={`Örnek: ${exampleMaterial.name} için V=${exampleSpeed} m/dk'da T≈${exampleLife} dk`}
              />
            </CollapsibleContent>
          </Collapsible>
          
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorLife" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={10}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value: number, name: string) => [`${value} dk`, "Takım Ömrü"]}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
              />
              <Area 
                type="monotone" 
                dataKey="toolLife" 
                stroke="hsl(var(--primary))" 
                fill="url(#colorLife)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Speed vs Life Curve */}
        <div className="p-4 rounded-lg bg-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Kesme Hızı - Takım Ömrü İlişkisi (Taylor)
            </h3>
            <button
              onClick={() => toggleInfoPanel('speedLife')}
              className={`p-1.5 rounded-md transition-colors ${
                activeInfoPanel === 'speedLife' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-accent/20 text-muted-foreground'
              }`}
            >
              {activeInfoPanel === 'speedLife' ? <X className="w-4 h-4" /> : <Info className="w-4 h-4" />}
            </button>
          </div>
          
          <Collapsible open={activeInfoPanel === 'speedLife'}>
            <CollapsibleContent className="mb-4">
              <InfoPanelContent
                title="Taylor Denklemi - Hız/Ömür İlişkisi"
                description="Frederick Taylor tarafından geliştirilen bu denklem, kesme hızı ile takım ömrü arasındaki ters orantılı ilişkiyi tanımlar. Hız arttıkça ömür üstel olarak azalır."
                formula="V × T^n = C"
                metrics={[
                  { label: "n değeri düşük", value: "Hıza daha duyarlı" },
                  { label: "n değeri yüksek", value: "Hıza daha toleranslı" },
                  { label: "Optimum aralık", value: `${exampleMaterial.cuttingSpeed.min}-${exampleMaterial.cuttingSpeed.max} m/dk` },
                  { label: "Mevcut n", value: exampleMaterial.taylorN.toString() },
                ]}
                useCases={[
                  "Ekonomik kesme hızı optimizasyonu",
                  "Takım maliyeti vs üretim hızı dengeleme",
                  "Maksimum verimlilik noktası belirleme",
                  "Farklı hızlarda maliyet analizi",
                ]}
                tip="Grafikteki eğrinin dikleştiği bölgede küçük hız artışları bile takım ömrünü dramatik şekilde azaltır."
              />
            </CollapsibleContent>
          </Collapsible>
          
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={speedVsLifeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="speed" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12}
                label={{ value: "m/dk", position: "bottom", offset: -5 }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12}
                label={{ value: "dk", angle: -90, position: "insideLeft" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number, name: string) => {
                  if (name === "life") return [`${value} dk`, "Takım Ömrü"];
                  return [value, name];
                }}
                labelFormatter={(label) => `Hız: ${label} m/dk`}
              />
              <Line 
                type="monotone" 
                dataKey="life" 
                stroke="hsl(var(--accent))" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Tool Type Comparison */}
        <div className="p-4 rounded-lg bg-card border border-border lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Takım Tipine Göre Beklenen Ömür Karşılaştırması
            </h3>
            <button
              onClick={() => toggleInfoPanel('toolComparison')}
              className={`p-1.5 rounded-md transition-colors ${
                activeInfoPanel === 'toolComparison' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-accent/20 text-muted-foreground'
              }`}
            >
              {activeInfoPanel === 'toolComparison' ? <X className="w-4 h-4" /> : <Info className="w-4 h-4" />}
            </button>
          </div>
          
          <Collapsible open={activeInfoPanel === 'toolComparison'}>
            <CollapsibleContent className="mb-4">
              <InfoPanelContent
                title="Takım Tipi Karşılaştırması"
                description="Farklı takım malzemelerinin aynı işleme koşullarında beklenen ömürlerini karşılaştırır. Üst sınıf takımlar daha yüksek maliyetle daha uzun ömür sunar."
                formula="T_adjusted = T_base × Takım Çarpanı"
                metrics={[
                  { label: "HSS", value: "×0.6 (En ekonomik)" },
                  { label: "Karbür", value: "×1.0 (Referans)" },
                  { label: "Kaplamalı", value: "×1.3" },
                  { label: "PCD/CBN", value: "×2.5-3.0 (En dayanıklı)" },
                ]}
                useCases={[
                  "Takım malzemesi seçim kararları",
                  "Maliyet-performans optimizasyonu",
                  "Yüksek hacimli üretim planlaması",
                  "Takım yatırım analizi",
                ]}
                tip="Yüksek maliyetli takımlar, uzun seri üretimlerde birim maliyeti düşürebilir."
              />
            </CollapsibleContent>
          </Collapsible>
          
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={toolComparisonData}>
              <defs>
                <linearGradient id="colorTool" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => [`${value} dk`, "Tahmini Ömür"]}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
              />
              <Area 
                type="monotone" 
                dataKey="life" 
                stroke="hsl(var(--accent))" 
                fill="url(#colorTool)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Taylor Comparison Table */}
      <div className="mt-6">
        <TaylorComparisonTable 
          customMaterials={customMaterials} 
          customTaylorValues={customTaylorValues}
        />
      </div>
    </div>
  );
};

export default ToolLifeChart;
