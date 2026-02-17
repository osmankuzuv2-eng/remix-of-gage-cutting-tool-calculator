import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, TrendingUp, TrendingDown, Info, Users } from "lucide-react";

// ─── 2025 & 2026 Tax Data ───
interface YearData {
  year: number;
  grossMinWage: number;
  sgkCeiling: number; // monthly
  sgkWorkerRate: number; // 14%
  sgkEmployerRate: number; // 20.5% (with 5 puan indirim: 15.5%)
  unemploymentWorker: number; // 1%
  unemploymentEmployer: number; // 2%
  stampTaxRate: number; // 0.00759
  incomeTaxBrackets: { limit: number; rate: number }[];
  minWageExemption: boolean; // asgari ücret istisnası
}

const YEAR_DATA: Record<string, YearData> = {
  "2025": {
    year: 2025,
    grossMinWage: 22104.67,
    sgkCeiling: 165757.50,
    sgkWorkerRate: 0.14,
    sgkEmployerRate: 0.205,
    unemploymentWorker: 0.01,
    unemploymentEmployer: 0.02,
    stampTaxRate: 0.00759,
    incomeTaxBrackets: [
      { limit: 158000, rate: 0.15 },
      { limit: 330000, rate: 0.20 },
      { limit: 800000, rate: 0.27 },
      { limit: 4300000, rate: 0.35 },
      { limit: Infinity, rate: 0.40 },
    ],
    minWageExemption: true,
  },
  "2026": {
    year: 2026,
    grossMinWage: 25000, // Tahmini
    sgkCeiling: 187500,
    sgkWorkerRate: 0.14,
    sgkEmployerRate: 0.205,
    unemploymentWorker: 0.01,
    unemploymentEmployer: 0.02,
    stampTaxRate: 0.00759,
    incomeTaxBrackets: [
      { limit: 180000, rate: 0.15 },
      { limit: 380000, rate: 0.20 },
      { limit: 900000, rate: 0.27 },
      { limit: 4800000, rate: 0.35 },
      { limit: Infinity, rate: 0.40 },
    ],
    minWageExemption: true,
  },
};

type CalcDirection = "gross-to-net" | "net-to-gross";

const fmt = (n: number) =>
  n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const calcNetFromGross = (grossSalary: number, month: number, data: YearData, applyExemption: boolean, sgk5PuanIndirim: boolean) => {
  const sgkBase = Math.min(grossSalary, data.sgkCeiling);
  const sgkWorker = sgkBase * data.sgkWorkerRate;
  const unemploymentWorker = sgkBase * data.unemploymentWorker;
  const totalSgkWorker = sgkWorker + unemploymentWorker;

  // Gelir vergisi matrahı
  const incomeTaxBase = grossSalary - totalSgkWorker;

  // Kümülatif matrah (yılın başından itibaren)
  const cumulativePrev = incomeTaxBase * (month - 1);
  const cumulativeCurrent = cumulativePrev + incomeTaxBase;

  // Kümülatif vergiyi hesapla
  const calcCumulativeTax = (cumulative: number) => {
    let tax = 0;
    let remaining = cumulative;
    for (const bracket of data.incomeTaxBrackets) {
      if (remaining <= 0) break;
      const prevLimit = data.incomeTaxBrackets.indexOf(bracket) === 0
        ? 0
        : data.incomeTaxBrackets[data.incomeTaxBrackets.indexOf(bracket) - 1].limit;
      const bracketSize = bracket.limit === Infinity ? remaining : bracket.limit - prevLimit;
      const taxable = Math.min(remaining, bracketSize);
      tax += taxable * bracket.rate;
      remaining -= taxable;
    }
    return tax;
  };

  const taxPrev = calcCumulativeTax(cumulativePrev);
  const taxCurrent = calcCumulativeTax(cumulativeCurrent);
  let incomeTax = taxCurrent - taxPrev;

  // Asgari ücret istisnası
  let exemptionAmount = 0;
  if (applyExemption && data.minWageExemption) {
    const minWageSgk = Math.min(data.grossMinWage, data.sgkCeiling);
    const minWageIncomeTaxBase = data.grossMinWage - (minWageSgk * data.sgkWorkerRate) - (minWageSgk * data.unemploymentWorker);
    const minWageCumulativePrev = minWageIncomeTaxBase * (month - 1);
    const minWageCumulativeCurrent = minWageCumulativePrev + minWageIncomeTaxBase;
    const minWageTaxPrev = calcCumulativeTax(minWageCumulativePrev);
    const minWageTaxCurrent = calcCumulativeTax(minWageCumulativeCurrent);
    exemptionAmount = minWageTaxCurrent - minWageTaxPrev;
  }

  incomeTax = Math.max(0, incomeTax - exemptionAmount);

  // Damga vergisi
  let stampTax = grossSalary * data.stampTaxRate;
  // Asgari ücret damga vergisi istisnası
  if (applyExemption && data.minWageExemption) {
    const minWageStamp = data.grossMinWage * data.stampTaxRate;
    stampTax = Math.max(0, stampTax - minWageStamp);
  }

  const totalDeductions = totalSgkWorker + incomeTax + stampTax;
  const netSalary = grossSalary - totalDeductions;

  // İşveren maliyeti
  const sgkEmployerRate = sgk5PuanIndirim ? (data.sgkEmployerRate - 0.05) : data.sgkEmployerRate;
  const sgkEmployer = sgkBase * sgkEmployerRate;
  const unemploymentEmployer = sgkBase * data.unemploymentEmployer;
  const totalEmployerCost = grossSalary + sgkEmployer + unemploymentEmployer;

  return {
    grossSalary,
    sgkWorker,
    unemploymentWorker,
    totalSgkWorker,
    incomeTaxBase,
    incomeTax,
    exemptionAmount,
    stampTax,
    totalDeductions,
    netSalary,
    sgkEmployer,
    unemploymentEmployer,
    totalEmployerCost,
    effectiveTaxRate: totalDeductions / grossSalary,
  };
};

const SalaryCalculator = () => {
  const { t } = useLanguage();
  const [selectedYear, setSelectedYear] = useState("2025");
  const [direction, setDirection] = useState<CalcDirection>("gross-to-net");
  const [grossInput, setGrossInput] = useState("");
  const [netInput, setNetInput] = useState("");
  const [month, setMonth] = useState(1);
  const [applyExemption, setApplyExemption] = useState(true);
  const [sgk5Puan, setSgk5Puan] = useState(true);

  const data = YEAR_DATA[selectedYear];

  const result = useMemo(() => {
    if (direction === "gross-to-net") {
      const gross = parseFloat(grossInput);
      if (!gross || gross <= 0) return null;
      return calcNetFromGross(gross, month, data, applyExemption, sgk5Puan);
    } else {
      const targetNet = parseFloat(netInput);
      if (!targetNet || targetNet <= 0) return null;
      // Binary search for gross
      let low = targetNet;
      let high = targetNet * 3;
      for (let i = 0; i < 100; i++) {
        const mid = (low + high) / 2;
        const r = calcNetFromGross(mid, month, data, applyExemption, sgk5Puan);
        if (Math.abs(r.netSalary - targetNet) < 0.01) return r;
        if (r.netSalary < targetNet) low = mid;
        else high = mid;
      }
      return calcNetFromGross((low + high) / 2, month, data, applyExemption, sgk5Puan);
    }
  }, [grossInput, netInput, direction, month, selectedYear, applyExemption, sgk5Puan, data]);

  const monthNames = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
  ];

  // Yıllık özet
  const annualSummary = useMemo(() => {
    const inputVal = direction === "gross-to-net" ? parseFloat(grossInput) : parseFloat(netInput);
    if (!inputVal || inputVal <= 0) return null;

    let totalNet = 0, totalGross = 0, totalEmployerCost = 0, totalIncomeTax = 0, totalSgkWorker = 0, totalStamp = 0;
    const monthlyResults = [];

    for (let m = 1; m <= 12; m++) {
      let r;
      if (direction === "gross-to-net") {
        r = calcNetFromGross(inputVal, m, data, applyExemption, sgk5Puan);
      } else {
        let low = inputVal, high = inputVal * 3;
        for (let i = 0; i < 100; i++) {
          const mid = (low + high) / 2;
          const rr = calcNetFromGross(mid, m, data, applyExemption, sgk5Puan);
          if (Math.abs(rr.netSalary - inputVal) < 0.01) { r = rr; break; }
          if (rr.netSalary < inputVal) low = mid; else high = mid;
        }
        if (!r) r = calcNetFromGross((low + high) / 2, m, data, applyExemption, sgk5Puan);
      }
      monthlyResults.push(r);
      totalNet += r.netSalary;
      totalGross += r.grossSalary;
      totalEmployerCost += r.totalEmployerCost;
      totalIncomeTax += r.incomeTax;
      totalSgkWorker += r.totalSgkWorker;
      totalStamp += r.stampTax;
    }

    return { monthlyResults, totalNet, totalGross, totalEmployerCost, totalIncomeTax, totalSgkWorker, totalStamp };
  }, [grossInput, netInput, direction, selectedYear, applyExemption, sgk5Puan, data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-border bg-card overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-teal-500 to-cyan-700 text-white">
          <CardTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t("salary", "title")}</h2>
              <p className="text-sm text-white/80 font-normal mt-0.5">{t("salary", "subtitle")}</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Year & Direction */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t("salary", "year")}</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026 (Tahmini)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("salary", "direction")}</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as CalcDirection)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  <SelectItem value="gross-to-net">{t("salary", "grossToNet")}</SelectItem>
                  <SelectItem value="net-to-gross">{t("salary", "netToGross")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("salary", "month")}</Label>
              <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {monthNames.map((name, i) => (
                    <SelectItem key={i} value={(i + 1).toString()}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Salary Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{direction === "gross-to-net" ? t("salary", "grossSalary") : t("salary", "netSalary")} (₺)</Label>
              <Input
                type="number"
                min="0"
                step="100"
                value={direction === "gross-to-net" ? grossInput : netInput}
                onChange={(e) => direction === "gross-to-net" ? setGrossInput(e.target.value) : setNetInput(e.target.value)}
                placeholder={direction === "gross-to-net" ? `Ör: ${fmt(data.grossMinWage)}` : "Ör: 20,000"}
              />
            </div>
            <div className="space-y-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={applyExemption} onCheckedChange={setApplyExemption} />
                <span className="text-sm text-foreground">{t("salary", "minWageExemption")}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={sgk5Puan} onCheckedChange={setSgk5Puan} />
                <span className="text-sm text-foreground">{t("salary", "sgk5Point")}</span>
              </label>
            </div>
          </div>

          {/* Quick Buttons */}
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-primary/20 transition-colors"
              onClick={() => {
                if (direction === "gross-to-net") setGrossInput(data.grossMinWage.toString());
                else setNetInput("17000");
              }}
            >
              {t("salary", "minWage")} ({selectedYear})
            </Badge>
            {[30000, 50000, 75000, 100000].map((v) => (
              <Badge
                key={v}
                variant="secondary"
                className="cursor-pointer hover:bg-primary/20 transition-colors"
                onClick={() => {
                  if (direction === "gross-to-net") setGrossInput(v.toString());
                  else setNetInput(v.toString());
                }}
              >
                {fmt(v)} ₺
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <ResultCard
              label={t("salary", "grossSalary")}
              value={`₺${fmt(result.grossSalary)}`}
              icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
              className="bg-emerald-500/10 border-emerald-500/30"
            />
            <ResultCard
              label={t("salary", "netSalary")}
              value={`₺${fmt(result.netSalary)}`}
              icon={<TrendingDown className="w-5 h-5 text-sky-400" />}
              className="bg-sky-500/10 border-sky-500/30"
            />
            <ResultCard
              label={t("salary", "totalDeductions")}
              value={`₺${fmt(result.totalDeductions)}`}
              icon={<TrendingDown className="w-5 h-5 text-rose-400" />}
              className="bg-rose-500/10 border-rose-500/30"
            />
            <ResultCard
              label={t("salary", "employerCost")}
              value={`₺${fmt(result.totalEmployerCost)}`}
              icon={<Users className="w-5 h-5 text-violet-400" />}
              className="bg-violet-500/10 border-violet-500/30"
            />
          </div>

          {/* Deduction Breakdown */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("salary", "deductionBreakdown")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <DeductionRow label={t("salary", "sgkWorker")} amount={result.sgkWorker} rate={`%${(data.sgkWorkerRate * 100).toFixed(0)}`} />
              <DeductionRow label={t("salary", "unemploymentWorker")} amount={result.unemploymentWorker} rate={`%${(data.unemploymentWorker * 100).toFixed(0)}`} />
              <div className="border-t border-border my-1" />
              <DeductionRow label={t("salary", "totalSgkWorker")} amount={result.totalSgkWorker} bold />
              <div className="border-t border-border my-1" />
              <DeductionRow label={t("salary", "incomeTaxBase")} amount={result.incomeTaxBase} />
              <DeductionRow label={t("salary", "incomeTax")} amount={result.incomeTax} />
              {result.exemptionAmount > 0 && (
                <DeductionRow label={t("salary", "exemptionApplied")} amount={-result.exemptionAmount} className="text-success" />
              )}
              <DeductionRow label={t("salary", "stampTax")} amount={result.stampTax} rate={`%${(data.stampTaxRate * 100).toFixed(3)}`} />
              <div className="border-t-2 border-border my-2" />
              <DeductionRow label={t("salary", "totalDeductions")} amount={result.totalDeductions} bold className="text-destructive" />
              <DeductionRow label={t("salary", "effectiveTaxRate")} amount={null} customValue={`%${(result.effectiveTaxRate * 100).toFixed(2)}`} />

              <div className="border-t-2 border-border my-2" />
              <h4 className="text-sm font-semibold text-foreground mt-2">{t("salary", "employerSide")}</h4>
              <DeductionRow label={t("salary", "sgkEmployer")} amount={result.sgkEmployer} rate={sgk5Puan ? "%15.5" : "%20.5"} />
              <DeductionRow label={t("salary", "unemploymentEmployer")} amount={result.unemploymentEmployer} rate="%2" />
              <div className="border-t border-border my-1" />
              <DeductionRow label={t("salary", "employerCost")} amount={result.totalEmployerCost} bold className="text-violet-400" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Annual Summary Table */}
      {annualSummary && (
        <Tabs defaultValue="monthly">
          <TabsList>
            <TabsTrigger value="monthly">{t("salary", "monthlyBreakdown")}</TabsTrigger>
            <TabsTrigger value="annual">{t("salary", "annualSummary")}</TabsTrigger>
          </TabsList>
          <TabsContent value="monthly">
            <Card className="border-border bg-card overflow-x-auto">
              <CardContent className="p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-2 px-2">{t("salary", "month")}</th>
                      <th className="text-right py-2 px-2">{t("salary", "grossSalary")}</th>
                      <th className="text-right py-2 px-2">SGK</th>
                      <th className="text-right py-2 px-2">{t("salary", "incomeTax")}</th>
                      <th className="text-right py-2 px-2">{t("salary", "stampTax")}</th>
                      <th className="text-right py-2 px-2 font-semibold">{t("salary", "netSalary")}</th>
                      <th className="text-right py-2 px-2">{t("salary", "employerCost")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {annualSummary.monthlyResults.map((r, i) => (
                      <tr key={i} className={`border-b border-border/50 ${i === month - 1 ? "bg-primary/10" : ""}`}>
                        <td className="py-2 px-2 font-medium">{monthNames[i]}</td>
                        <td className="text-right py-2 px-2">{fmt(r.grossSalary)}</td>
                        <td className="text-right py-2 px-2">{fmt(r.totalSgkWorker)}</td>
                        <td className="text-right py-2 px-2">{fmt(r.incomeTax)}</td>
                        <td className="text-right py-2 px-2">{fmt(r.stampTax)}</td>
                        <td className="text-right py-2 px-2 font-semibold text-primary">{fmt(r.netSalary)}</td>
                        <td className="text-right py-2 px-2 text-muted-foreground">{fmt(r.totalEmployerCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border font-semibold">
                      <td className="py-2 px-2">{t("salary", "annual")}</td>
                      <td className="text-right py-2 px-2">{fmt(annualSummary.totalGross)}</td>
                      <td className="text-right py-2 px-2">{fmt(annualSummary.totalSgkWorker)}</td>
                      <td className="text-right py-2 px-2">{fmt(annualSummary.totalIncomeTax)}</td>
                      <td className="text-right py-2 px-2">{fmt(annualSummary.totalStamp)}</td>
                      <td className="text-right py-2 px-2 text-primary">{fmt(annualSummary.totalNet)}</td>
                      <td className="text-right py-2 px-2 text-muted-foreground">{fmt(annualSummary.totalEmployerCost)}</td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="annual">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ResultCard label={t("salary", "annualGross")} value={`₺${fmt(annualSummary.totalGross)}`} className="bg-emerald-500/10 border-emerald-500/30" />
              <ResultCard label={t("salary", "annualNet")} value={`₺${fmt(annualSummary.totalNet)}`} className="bg-sky-500/10 border-sky-500/30" />
              <ResultCard label={t("salary", "annualTax")} value={`₺${fmt(annualSummary.totalIncomeTax)}`} className="bg-rose-500/10 border-rose-500/30" />
              <ResultCard label={t("salary", "annualEmployer")} value={`₺${fmt(annualSummary.totalEmployerCost)}`} className="bg-violet-500/10 border-violet-500/30" />
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Info Note */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 flex gap-3">
          <Info className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p>{t("salary", "disclaimer")}</p>
            <p className="text-xs">{t("salary", "minWageInfo")}: ₺{fmt(data.grossMinWage)} ({selectedYear})</p>
            <p className="text-xs">{t("salary", "sgkCeiling")}: ₺{fmt(data.sgkCeiling)} ({selectedYear})</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const ResultCard = ({ label, value, icon, className = "" }: { label: string; value: string; icon?: React.ReactNode; className?: string }) => (
  <Card className={`border ${className}`}>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </CardContent>
  </Card>
);

const DeductionRow = ({ label, amount, rate, bold, className = "", customValue }: {
  label: string; amount: number | null; rate?: string; bold?: boolean; className?: string; customValue?: string;
}) => (
  <div className={`flex items-center justify-between text-sm ${bold ? "font-semibold" : ""} ${className}`}>
    <span className="text-muted-foreground">
      {label} {rate && <span className="text-xs opacity-70">({rate})</span>}
    </span>
    <span className="text-foreground font-mono">
      {customValue || (amount !== null ? `₺${fmt(amount)}` : "")}
    </span>
  </div>
);

export default SalaryCalculator;
