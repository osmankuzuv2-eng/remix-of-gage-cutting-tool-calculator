import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, RefreshCw, TrendingUp, DollarSign, Coins, BarChart3 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { exportCurrencyExcel } from "@/lib/exportCurrencyExcel";

interface RateEntry {
  year: number;
  month: number;
  rate_type: string;
  value: number;
  is_forecast: boolean;
  source: string;
  updated_at: string;
}

const MONTH_NAMES_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const MONTH_FULL_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

const CurrencyRateTracker = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [rates, setRates] = useState<RateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("currency_rates")
        .select("year, month, rate_type, value, is_forecast, source, updated_at")
        .order("year")
        .order("month");
      if (error) throw error;
      setRates((data as any[]) || []);
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRates(); }, []);

  const handleRefreshForecasts = async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke("update-currency-forecasts");
      if (error) throw error;
      toast({ title: "Başarılı", description: "Tahminler güncellendi" });
      await loadRates();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  // Build data for tables and charts
  const historical2025 = useMemo(() => {
    const h = rates.filter((r) => r.year === 2025 && !r.is_forecast);
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      usd: h.find((r) => r.month === i + 1 && r.rate_type === "usd")?.value || 0,
      eur: h.find((r) => r.month === i + 1 && r.rate_type === "eur")?.value || 0,
      gold: h.find((r) => r.month === i + 1 && r.rate_type === "gold")?.value || 0,
    }));
  }, [rates]);

  const forecast2026 = useMemo(() => {
    const f = rates.filter((r) => r.year === 2026 && r.is_forecast);
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      usd: f.find((r) => r.month === i + 1 && r.rate_type === "usd")?.value || 0,
      eur: f.find((r) => r.month === i + 1 && r.rate_type === "eur")?.value || 0,
      gold: f.find((r) => r.month === i + 1 && r.rate_type === "gold")?.value || 0,
    }));
  }, [rates]);

  // Combined chart data
  const chartData = useMemo(() => {
    return [
      ...historical2025.map((r) => ({
        label: `${MONTH_NAMES_TR[r.month - 1]} '25`,
        usd: r.usd,
        eur: r.eur,
        gold: r.gold,
        isForecast: false,
      })),
      ...forecast2026.map((r) => ({
        label: `${MONTH_NAMES_TR[r.month - 1]} '26`,
        usd: r.usd,
        eur: r.eur,
        gold: r.gold,
        isForecast: true,
      })),
    ];
  }, [historical2025, forecast2026]);

  const lastUpdate = useMemo(() => {
    const forecasts = rates.filter((r) => r.is_forecast);
    if (!forecasts.length) return null;
    return new Date(Math.max(...forecasts.map((r) => new Date(r.updated_at).getTime())));
  }, [rates]);

  // Summary cards
  const summaryData = useMemo(() => {
    const latest2025 = historical2025[historical2025.length - 1];
    const latest2026 = forecast2026[forecast2026.length - 1];
    return {
      usd2025Avg: (historical2025.reduce((s, r) => s + r.usd, 0) / 12).toFixed(2),
      eur2025Avg: (historical2025.reduce((s, r) => s + r.eur, 0) / 12).toFixed(2),
      gold2025Avg: Math.round(historical2025.reduce((s, r) => s + r.gold, 0) / 12),
      usdChange: latest2026 && latest2025 ? ((latest2026.usd - latest2025.usd) / latest2025.usd * 100).toFixed(1) : "0",
      eurChange: latest2026 && latest2025 ? ((latest2026.eur - latest2025.eur) / latest2025.eur * 100).toFixed(1) : "0",
      goldChange: latest2026 && latest2025 ? ((latest2026.gold - latest2025.gold) / latest2025.gold * 100).toFixed(1) : "0",
    };
  }, [historical2025, forecast2026]);

  const handleExport2025 = () => exportCurrencyExcel(historical2025, 2025, false);
  const handleExport2026 = () => exportCurrencyExcel(forecast2026, 2026, true);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Kur Takip & Tahmin
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            2025 aylık ortalamalar ve 2026 AI destekli tahminler
            {lastUpdate && (
              <span className="ml-2 text-xs">
                • Son güncelleme: {lastUpdate.toLocaleDateString("tr-TR")} {lastUpdate.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefreshForecasts} disabled={refreshing} className="gap-1.5">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Tahminleri Güncelle
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">USD/TRY 2025 Ort.</p>
                <p className="text-2xl font-bold text-foreground">₺{summaryData.usd2025Avg}</p>
              </div>
              <div className="flex flex-col items-end">
                <DollarSign className="w-8 h-8 text-primary/30" />
                <Badge variant="secondary" className="text-xs mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +{summaryData.usdChange}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">EUR/TRY 2025 Ort.</p>
                <p className="text-2xl font-bold text-foreground">₺{summaryData.eur2025Avg}</p>
              </div>
              <div className="flex flex-col items-end">
                <DollarSign className="w-8 h-8 text-accent/30" />
                <Badge variant="secondary" className="text-xs mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +{summaryData.eurChange}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Gram Altın 2025 Ort.</p>
                <p className="text-2xl font-bold text-foreground">₺{summaryData.gold2025Avg.toLocaleString("tr-TR")}</p>
              </div>
              <div className="flex flex-col items-end">
                <Coins className="w-8 h-8 text-yellow-500/30" />
                <Badge variant="secondary" className="text-xs mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +{summaryData.goldChange}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">USD/TRY & EUR/TRY Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Legend />
              <Line type="monotone" dataKey="usd" stroke="hsl(var(--primary))" name="USD/TRY" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="eur" stroke="hsl(var(--accent-foreground))" name="EUR/TRY" strokeWidth={2} dot={false} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Gram Altın (₺) Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Line type="monotone" dataKey="gold" stroke="#EAB308" name="Gram Altın" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Data Tables */}
      <Tabs defaultValue="2025" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="2025">📊 2025 Gerçek Veriler</TabsTrigger>
          <TabsTrigger value="2026">🔮 2026 Tahminler</TabsTrigger>
        </TabsList>

        <TabsContent value="2025" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">2025 yılı aylık ortalama döviz ve altın kurları (TRY)</p>
            <Button variant="outline" size="sm" onClick={handleExport2025} className="gap-1.5">
              <Download className="w-4 h-4" /> Excel İndir
            </Button>
          </div>
          <RateTable rows={historical2025} />
        </TabsContent>

        <TabsContent value="2026" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">2026 yılı AI destekli aylık kur tahminleri (TRY)</p>
              {lastUpdate && (
                <p className="text-[10px] text-muted-foreground">
                  Kaynak: {rates.find((r) => r.is_forecast)?.source === "ai_forecast" ? "AI Tahmin Modeli" : "Doğrusal Ekstrapolasyon"}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleExport2026} className="gap-1.5">
              <Download className="w-4 h-4" /> Excel İndir
            </Button>
          </div>
          <RateTable rows={forecast2026} isForecast />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const RateTable = ({ rows, isForecast }: { rows: { month: number; usd: number; eur: number; gold: number }[]; isForecast?: boolean }) => (
  <div className="overflow-x-auto rounded-lg border border-border">
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-muted/50">
          <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Ay</th>
          <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">USD/TRY (₺)</th>
          <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">EUR/TRY (₺)</th>
          <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Gram Altın (₺)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, idx) => (
          <tr key={r.month} className={`border-t border-border ${idx % 2 === 0 ? "bg-card" : "bg-muted/20"}`}>
            <td className="px-4 py-2 font-medium text-foreground">
              {MONTH_FULL_TR[r.month - 1]}
              {isForecast && <span className="ml-1.5 text-[10px] text-muted-foreground">🔮</span>}
            </td>
            <td className="px-4 py-2 text-right font-mono text-foreground">{r.usd.toFixed(2)}</td>
            <td className="px-4 py-2 text-right font-mono text-foreground">{r.eur.toFixed(2)}</td>
            <td className="px-4 py-2 text-right font-mono font-bold text-foreground">{r.gold.toLocaleString("tr-TR")}</td>
          </tr>
        ))}
        {/* Average row */}
        <tr className="border-t-2 border-primary/30 bg-primary/5">
          <td className="px-4 py-2.5 font-bold text-foreground">Yıllık Ortalama</td>
          <td className="px-4 py-2.5 text-right font-mono font-bold text-primary">
            {(rows.reduce((s, r) => s + r.usd, 0) / rows.length).toFixed(2)}
          </td>
          <td className="px-4 py-2.5 text-right font-mono font-bold text-primary">
            {(rows.reduce((s, r) => s + r.eur, 0) / rows.length).toFixed(2)}
          </td>
          <td className="px-4 py-2.5 text-right font-mono font-bold text-primary">
            {Math.round(rows.reduce((s, r) => s + r.gold, 0) / rows.length).toLocaleString("tr-TR")}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
);

export default CurrencyRateTracker;
