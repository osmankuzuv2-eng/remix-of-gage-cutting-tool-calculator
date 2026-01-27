import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Info, TrendingUp, TrendingDown, Minus, BookOpen } from "lucide-react";
import { materials as defaultMaterials, Material } from "@/data/materials";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Industry standard Taylor values from machining handbooks
// Sources: Machinery's Handbook, ASM Machining Handbook, Sandvik Coromant
const industryStandards: Record<string, { taylorC: { min: number; max: number }; taylorN: { min: number; max: number }; source: string }> = {
  "steel-low": {
    taylorC: { min: 400, max: 600 },
    taylorN: { min: 0.20, max: 0.30 },
    source: "Machinery's Handbook - Low Carbon Steel",
  },
  "steel-medium": {
    taylorC: { min: 300, max: 450 },
    taylorN: { min: 0.18, max: 0.25 },
    source: "ASM Machining Handbook - Medium Carbon Steel",
  },
  "steel-high": {
    taylorC: { min: 200, max: 320 },
    taylorN: { min: 0.15, max: 0.22 },
    source: "Sandvik Coromant - High Carbon Steel",
  },
  "stainless": {
    taylorC: { min: 120, max: 200 },
    taylorN: { min: 0.12, max: 0.18 },
    source: "ASM Machining Handbook - Stainless Steel",
  },
  "aluminum": {
    taylorC: { min: 2000, max: 3500 },
    taylorN: { min: 0.30, max: 0.40 },
    source: "Machinery's Handbook - Aluminum Alloys",
  },
  "brass": {
    taylorC: { min: 800, max: 1200 },
    taylorN: { min: 0.25, max: 0.35 },
    source: "ASM Machining Handbook - Brass",
  },
  "bronze": {
    taylorC: { min: 550, max: 800 },
    taylorN: { min: 0.24, max: 0.32 },
    source: "Machinery's Handbook - Bronze Alloys",
  },
  "cast-iron": {
    taylorC: { min: 250, max: 400 },
    taylorN: { min: 0.18, max: 0.24 },
    source: "Sandvik Coromant - Cast Iron",
  },
  "titanium": {
    taylorC: { min: 60, max: 120 },
    taylorN: { min: 0.10, max: 0.15 },
    source: "ASM Machining Handbook - Titanium Alloys",
  },
  "inconel": {
    taylorC: { min: 30, max: 60 },
    taylorN: { min: 0.08, max: 0.12 },
    source: "Sandvik Coromant - Superalloys",
  },
};

interface TaylorComparisonTableProps {
  customMaterials: Material[];
  customTaylorValues?: Record<string, { taylorC: number; taylorN: number }>;
}

const TaylorComparisonTable = ({ customMaterials, customTaylorValues = {} }: TaylorComparisonTableProps) => {
  const comparisonData = useMemo(() => {
    return defaultMaterials.map((mat) => {
      const standard = industryStandards[mat.id];
      const currentC = customTaylorValues[mat.id]?.taylorC ?? mat.taylorC;
      const currentN = customTaylorValues[mat.id]?.taylorN ?? mat.taylorN;

      if (!standard) {
        return {
          ...mat,
          currentC,
          currentN,
          standardC: null,
          standardN: null,
          cStatus: "unknown" as const,
          nStatus: "unknown" as const,
          source: "Referans bulunamadı",
        };
      }

      // Determine if current values are within, above, or below industry standards
      const cStatus = currentC < standard.taylorC.min 
        ? "below" as const
        : currentC > standard.taylorC.max 
          ? "above" as const 
          : "within" as const;

      const nStatus = currentN < standard.taylorN.min 
        ? "below" as const
        : currentN > standard.taylorN.max 
          ? "above" as const 
          : "within" as const;

      return {
        ...mat,
        currentC,
        currentN,
        standardC: standard.taylorC,
        standardN: standard.taylorN,
        cStatus,
        nStatus,
        source: standard.source,
      };
    });
  }, [customTaylorValues]);

  const getStatusBadge = (status: "below" | "within" | "above" | "unknown", type: "C" | "n") => {
    const configs = {
      below: {
        variant: "destructive" as const,
        icon: TrendingDown,
        label: type === "C" ? "Düşük (Kısa ömür)" : "Düşük (Hıza duyarlı)",
      },
      within: {
        variant: "default" as const,
        icon: Minus,
        label: "Optimum",
      },
      above: {
        variant: "secondary" as const,
        icon: TrendingUp,
        label: type === "C" ? "Yüksek (Uzun ömür)" : "Yüksek (Toleranslı)",
      },
      unknown: {
        variant: "outline" as const,
        icon: Info,
        label: "Bilinmiyor",
      },
    };

    const config = configs[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1 text-xs">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getStatusColor = (status: "below" | "within" | "above" | "unknown") => {
    switch (status) {
      case "below": return "text-destructive";
      case "within": return "text-primary";
      case "above": return "text-muted-foreground";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="industrial-card p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-accent/20">
          <BookOpen className="w-5 h-5 text-accent-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Taylor Değerleri - Endüstri Standartları Karşılaştırması
          </h2>
          <p className="text-sm text-muted-foreground">
            Machinery's Handbook, ASM ve Sandvik referanslarına göre
          </p>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 mb-6">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground mb-1">Karşılaştırma Rehberi</p>
            <ul className="text-muted-foreground space-y-1">
              <li><span className="text-primary font-medium">Optimum:</span> Değer endüstri standart aralığında</li>
              <li><span className="text-destructive font-medium">Düşük:</span> Değer standartların altında - muhafazakar tahmin</li>
              <li><span className="text-muted-foreground font-medium">Yüksek:</span> Değer standartların üstünde - iyimser tahmin</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="text-muted-foreground">Malzeme</TableHead>
              <TableHead className="text-muted-foreground text-center">Mevcut C</TableHead>
              <TableHead className="text-muted-foreground text-center">Standart C</TableHead>
              <TableHead className="text-muted-foreground text-center">C Durumu</TableHead>
              <TableHead className="text-muted-foreground text-center">Mevcut n</TableHead>
              <TableHead className="text-muted-foreground text-center">Standart n</TableHead>
              <TableHead className="text-muted-foreground text-center">n Durumu</TableHead>
              <TableHead className="text-muted-foreground">Kaynak</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparisonData.map((row) => (
              <TableRow key={row.id} className="border-border hover:bg-accent/5">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${row.color}`} />
                    <span className="font-medium text-foreground">{row.name}</span>
                  </div>
                </TableCell>
                <TableCell className={`text-center font-mono ${getStatusColor(row.cStatus)}`}>
                  {row.currentC}
                </TableCell>
                <TableCell className="text-center font-mono text-muted-foreground">
                  {row.standardC ? `${row.standardC.min}-${row.standardC.max}` : "-"}
                </TableCell>
                <TableCell className="text-center">
                  {getStatusBadge(row.cStatus, "C")}
                </TableCell>
                <TableCell className={`text-center font-mono ${getStatusColor(row.nStatus)}`}>
                  {row.currentN}
                </TableCell>
                <TableCell className="text-center font-mono text-muted-foreground">
                  {row.standardN ? `${row.standardN.min}-${row.standardN.max}` : "-"}
                </TableCell>
                <TableCell className="text-center">
                  {getStatusBadge(row.nStatus, "n")}
                </TableCell>
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground cursor-help truncate max-w-[150px] block">
                          {row.source}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{row.source}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <h3 className="text-sm font-medium text-foreground mb-3">Özet İstatistikler</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            label="Optimum C Değeri"
            value={comparisonData.filter(d => d.cStatus === "within").length}
            total={comparisonData.length}
            color="text-primary"
          />
          <SummaryCard
            label="Optimum n Değeri"
            value={comparisonData.filter(d => d.nStatus === "within").length}
            total={comparisonData.length}
            color="text-primary"
          />
          <SummaryCard
            label="Düşük C Değeri"
            value={comparisonData.filter(d => d.cStatus === "below").length}
            total={comparisonData.length}
            color="text-destructive"
          />
          <SummaryCard
            label="Yüksek C Değeri"
            value={comparisonData.filter(d => d.cStatus === "above").length}
            total={comparisonData.length}
            color="text-muted-foreground"
          />
        </div>
      </div>
    </div>
  );
};

const SummaryCard = ({ label, value, total, color }: { label: string; value: number; total: number; color: string }) => (
  <div className="p-3 rounded-lg bg-card border border-border">
    <span className={`text-2xl font-mono font-bold ${color}`}>{value}/{total}</span>
    <span className="block text-xs text-muted-foreground mt-1">{label}</span>
  </div>
);

export default TaylorComparisonTable;
