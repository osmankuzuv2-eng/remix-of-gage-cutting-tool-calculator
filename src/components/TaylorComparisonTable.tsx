import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Info, TrendingUp, TrendingDown, Minus, BookOpen } from "lucide-react";
import { materials as defaultMaterials, Material } from "@/data/materials";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "@/i18n/LanguageContext";

// Industry standard Taylor values from machining handbooks
// Sources: Machinery's Handbook, ASM Machining Handbook, Sandvik Coromant
const industryStandards: Record<string, { taylorC: { min: number; max: number }; taylorN: { min: number; max: number }; source: string }> = {
  "steel-low": { taylorC: { min: 400, max: 600 }, taylorN: { min: 0.20, max: 0.30 }, source: "Machinery's Handbook - Low Carbon Steel" },
  "steel-medium": { taylorC: { min: 300, max: 450 }, taylorN: { min: 0.18, max: 0.25 }, source: "ASM Machining Handbook - Medium Carbon Steel" },
  "steel-high": { taylorC: { min: 200, max: 320 }, taylorN: { min: 0.15, max: 0.22 }, source: "Sandvik Coromant - High Carbon Steel" },
  "stainless": { taylorC: { min: 120, max: 200 }, taylorN: { min: 0.12, max: 0.18 }, source: "ASM Machining Handbook - Stainless Steel" },
  "aluminum": { taylorC: { min: 2000, max: 3500 }, taylorN: { min: 0.30, max: 0.40 }, source: "Machinery's Handbook - Aluminum Alloys" },
  "brass": { taylorC: { min: 800, max: 1200 }, taylorN: { min: 0.25, max: 0.35 }, source: "ASM Machining Handbook - Brass" },
  "bronze": { taylorC: { min: 550, max: 800 }, taylorN: { min: 0.24, max: 0.32 }, source: "Machinery's Handbook - Bronze Alloys" },
  "cast-iron": { taylorC: { min: 250, max: 400 }, taylorN: { min: 0.18, max: 0.24 }, source: "Sandvik Coromant - Cast Iron" },
  "titanium": { taylorC: { min: 60, max: 120 }, taylorN: { min: 0.10, max: 0.15 }, source: "ASM Machining Handbook - Titanium Alloys" },
  "inconel": { taylorC: { min: 30, max: 60 }, taylorN: { min: 0.08, max: 0.12 }, source: "Sandvik Coromant - Superalloys" },
};

interface TaylorComparisonTableProps {
  customMaterials: Material[];
  customTaylorValues?: Record<string, { taylorC: number; taylorN: number }>;
}

const TaylorComparisonTable = ({ customMaterials, customTaylorValues = {} }: TaylorComparisonTableProps) => {
  const { t } = useLanguage();
  const getMaterialName = (m: Material) => { const tr = t("materialNames", m.id); return tr !== m.id ? tr : m.name; };

  const comparisonData = useMemo(() => {
    return defaultMaterials.map((mat) => {
      const standard = industryStandards[mat.id];
      const currentC = customTaylorValues[mat.id]?.taylorC ?? mat.taylorC;
      const currentN = customTaylorValues[mat.id]?.taylorN ?? mat.taylorN;
      if (!standard) {
        return { ...mat, currentC, currentN, standardC: null, standardN: null, cStatus: "unknown" as const, nStatus: "unknown" as const, source: t("taylor", "noReference") };
      }
      const cStatus = currentC < standard.taylorC.min ? "below" as const : currentC > standard.taylorC.max ? "above" as const : "within" as const;
      const nStatus = currentN < standard.taylorN.min ? "below" as const : currentN > standard.taylorN.max ? "above" as const : "within" as const;
      return { ...mat, currentC, currentN, standardC: standard.taylorC, standardN: standard.taylorN, cStatus, nStatus, source: standard.source };
    });
  }, [customTaylorValues, t]);

  const getStatusBadge = (status: "below" | "within" | "above" | "unknown", type: "C" | "n") => {
    const configs = {
      below: { variant: "destructive" as const, icon: TrendingDown, label: type === "C" ? t("taylor", "lowCShort") : t("taylor", "lowNSensitive") },
      within: { variant: "default" as const, icon: Minus, label: "Optimum" },
      above: { variant: "secondary" as const, icon: TrendingUp, label: type === "C" ? t("taylor", "highCLong") : t("taylor", "highNTolerant") },
      unknown: { variant: "outline" as const, icon: Info, label: t("taylor", "unknown") },
    };
    const config = configs[status];
    const Icon = config.icon;
    return (<Badge variant={config.variant} className="gap-1 text-xs"><Icon className="w-3 h-3" />{config.label}</Badge>);
  };

  const getStatusColor = (status: "below" | "within" | "above" | "unknown") => {
    switch (status) { case "below": return "text-destructive"; case "within": return "text-primary"; default: return "text-muted-foreground"; }
  };

  return (
    <div className="industrial-card p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-accent/20"><BookOpen className="w-5 h-5 text-accent-foreground" /></div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("taylor", "comparisonTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("taylor", "comparisonSubtitle")}</p>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 mb-6">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground mb-1">{t("taylor", "comparisonGuide")}</p>
            <ul className="text-muted-foreground space-y-1">
              <li><span className="text-primary font-medium">Optimum:</span> {t("taylor", "optimum")}</li>
              <li><span className="text-destructive font-medium">{t("drilling", "low")}:</span> {t("taylor", "belowStd")}</li>
              <li><span className="text-muted-foreground font-medium">{t("drilling", "high")}:</span> {t("taylor", "aboveStd")}</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="text-muted-foreground">{t("common", "material")}</TableHead>
              <TableHead className="text-muted-foreground text-center">{t("taylor", "currentC")}</TableHead>
              <TableHead className="text-muted-foreground text-center">{t("taylor", "standardC")}</TableHead>
              <TableHead className="text-muted-foreground text-center">{t("taylor", "cStatus")}</TableHead>
              <TableHead className="text-muted-foreground text-center">{t("taylor", "currentN")}</TableHead>
              <TableHead className="text-muted-foreground text-center">{t("taylor", "standardN")}</TableHead>
              <TableHead className="text-muted-foreground text-center">{t("taylor", "nStatus")}</TableHead>
              <TableHead className="text-muted-foreground">{t("taylor", "source")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparisonData.map((row) => (
              <TableRow key={row.id} className="border-border hover:bg-accent/5">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${row.color}`} />
                    <span className="font-medium text-foreground">{getMaterialName(row)}</span>
                  </div>
                </TableCell>
                <TableCell className={`text-center font-mono ${getStatusColor(row.cStatus)}`}>{row.currentC}</TableCell>
                <TableCell className="text-center font-mono text-muted-foreground">{row.standardC ? `${row.standardC.min}-${row.standardC.max}` : "-"}</TableCell>
                <TableCell className="text-center">{getStatusBadge(row.cStatus, "C")}</TableCell>
                <TableCell className={`text-center font-mono ${getStatusColor(row.nStatus)}`}>{row.currentN}</TableCell>
                <TableCell className="text-center font-mono text-muted-foreground">{row.standardN ? `${row.standardN.min}-${row.standardN.max}` : "-"}</TableCell>
                <TableCell className="text-center">{getStatusBadge(row.nStatus, "n")}</TableCell>
                <TableCell>
                  <TooltipProvider><Tooltip><TooltipTrigger asChild>
                    <span className="text-xs text-muted-foreground cursor-help truncate max-w-[150px] block">{row.source}</span>
                  </TooltipTrigger><TooltipContent><p>{row.source}</p></TooltipContent></Tooltip></TooltipProvider>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <h3 className="text-sm font-medium text-foreground mb-3">{t("taylor", "summaryStats")}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label={t("taylor", "optimumC")} value={comparisonData.filter(d => d.cStatus === "within").length} total={comparisonData.length} color="text-primary" />
          <SummaryCard label={t("taylor", "optimumN")} value={comparisonData.filter(d => d.nStatus === "within").length} total={comparisonData.length} color="text-primary" />
          <SummaryCard label={t("taylor", "lowC")} value={comparisonData.filter(d => d.cStatus === "below").length} total={comparisonData.length} color="text-destructive" />
          <SummaryCard label={t("taylor", "highC")} value={comparisonData.filter(d => d.cStatus === "above").length} total={comparisonData.length} color="text-muted-foreground" />
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
