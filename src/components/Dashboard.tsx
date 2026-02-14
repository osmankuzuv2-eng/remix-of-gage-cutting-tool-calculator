import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { safeGetItem, isValidArray } from "@/lib/safeStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calculator,
  Clock,
  DollarSign,
  FileImage,
  Wrench,
  Circle,
  Ruler,
  GitCompare,
  Database,
  History,
  ArrowRight,
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  Timer,
  Package,
} from "lucide-react";
import { materials as defaultMaterials, Material } from "@/data/materials";

interface DashboardProps {
  customMaterials?: Material[];
  onNavigate?: (tab: string) => void;
}

const HISTORY_KEY = "cnc_calculation_history";

/* ── Quick-access shortcut definitions ── */
const shortcuts = [
  { id: "cutting", label: "Kesme Hesaplama", icon: Calculator, color: "bg-primary/10 text-primary border-primary/20" },
  { id: "toollife", label: "Takım Ömrü", icon: Clock, color: "bg-accent/10 text-accent-foreground border-accent/20" },
  { id: "costcalc", label: "Maliyet Hesaplama", icon: DollarSign, color: "bg-success/10 text-success border-success/20" },
  { id: "drawing", label: "Teknik Resim", icon: FileImage, color: "bg-warning/10 text-warning border-warning/20" },
  { id: "threading", label: "Diş Açma", icon: Wrench, color: "bg-primary/10 text-primary border-primary/20" },
  { id: "drilling", label: "Delme & Kılavuz", icon: Circle, color: "bg-accent/10 text-accent-foreground border-accent/20" },
  { id: "tolerance", label: "Tolerans Rehberi", icon: Ruler, color: "bg-success/10 text-success border-success/20" },
  { id: "compare", label: "Karşılaştır", icon: GitCompare, color: "bg-warning/10 text-warning border-warning/20" },
];

/* ── Helpers ── */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} saat önce`;
  const days = Math.floor(hrs / 24);
  return `${days} gün önce`;
}

const calcTypeLabels: Record<string, string> = {
  cutting: "Kesme",
  toollife: "Takım Ömrü",
  threading: "Diş Açma",
  drilling: "Delme",
  cost: "Maliyet",
  compare: "Karşılaştırma",
};

const Dashboard = ({ customMaterials = [], onNavigate }: DashboardProps) => {
  const calculationHistory = useMemo(() => {
    const stored = safeGetItem<any[]>(HISTORY_KEY, []);
    return isValidArray(stored) ? stored : [];
  }, []);

  const allMaterials = [...defaultMaterials, ...customMaterials];

  /* ── Stats ── */
  const stats = useMemo(() => {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const todayCalcs = calculationHistory.filter(
      (c: any) => new Date(c.timestamp).toDateString() === today.toDateString()
    ).length;

    const weekCalcs = calculationHistory.filter(
      (c: any) => new Date(c.timestamp) >= weekAgo
    ).length;

    return { total: calculationHistory.length, today: todayCalcs, week: weekCalcs };
  }, [calculationHistory]);

  const recentCalcs = useMemo(
    () =>
      [...calculationHistory]
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5),
    [calculationHistory]
  );

  const handleNav = (id: string) => onNavigate?.(id);

  return (
    <div className="space-y-6">
      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Calculator} label="Toplam Hesaplama" value={stats.total} accent="primary" />
        <StatCard icon={Timer} label="Bugün" value={stats.today} accent="success" />
        <StatCard icon={Clock} label="Bu Hafta" value={stats.week} accent="warning" />
        <StatCard icon={Package} label="Malzeme Sayısı" value={allMaterials.length} accent="accent" />
      </div>

      {/* ── Quick Access ── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-base flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-primary" />
            Hızlı Erişim
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {shortcuts.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => handleNav(s.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all hover:scale-[1.03] hover:shadow-md ${s.color}`}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-xs font-medium text-center leading-tight">{s.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Two-column: Recent calcs + Work order summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Calculations */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              Son Hesaplamalar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentCalcs.length === 0 ? (
              <div className="text-center py-8">
                <Calculator className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground">Henüz hesaplama yapılmadı</p>
                <button
                  onClick={() => handleNav("cutting")}
                  className="mt-3 text-xs text-primary hover:underline"
                >
                  İlk hesaplamayı yap →
                </button>
              </div>
            ) : (
              <ul className="space-y-3">
                {recentCalcs.map((calc: any, i: number) => (
                  <li
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1.5 rounded-md bg-primary/10">
                        <Calculator className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {calcTypeLabels[calc.type] || calc.type || "Hesaplama"}
                        </p>
                        <p className="text-xs text-muted-foreground">{timeAgo(calc.timestamp)}</p>
                      </div>
                    </div>
                    {calc.materialName && (
                      <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                        {calc.materialName}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {recentCalcs.length > 0 && (
              <button
                onClick={() => handleNav("history")}
                className="w-full mt-4 text-xs text-primary hover:underline text-center"
              >
                Tüm geçmişi görüntüle →
              </button>
            )}
          </CardContent>
        </Card>

        {/* Work Order Summary */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              İş Emri Özeti
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WorkOrderSummary />
          </CardContent>
        </Card>
      </div>

      {/* ── Material Overview ── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-base flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            Malzeme Dağılımı
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {Object.entries(
              allMaterials.reduce<Record<string, number>>((acc, m) => {
                acc[m.category] = (acc[m.category] || 0) + 1;
                return acc;
              }, {})
            ).map(([cat, count]) => (
              <div
                key={cat}
                className="flex flex-col items-center p-3 rounded-lg bg-secondary/30 border border-border/50"
              >
                <span className="text-xl font-mono font-bold text-primary">{count}</span>
                <span className="text-[10px] text-muted-foreground text-center mt-1">{cat}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/* ── Stat Card ── */
function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${accent}/10`}>
            <Icon className={`w-5 h-5 text-${accent === "accent" ? "accent-foreground" : accent}`} />
          </div>
          <div>
            <p className="text-2xl font-bold font-mono text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Work Order Summary (reads from Supabase) ── */
function WorkOrderSummary() {
  // Static summary using localStorage-stored work order data or empty state
  const workOrders = useMemo(() => {
    const stored = safeGetItem<any[]>("cnc_work_orders", []);
    return isValidArray(stored) ? stored : [];
  }, []);

  const statusCounts = useMemo(() => {
    const counts = { pending: 0, active: 0, completed: 0 };
    workOrders.forEach((wo: any) => {
      if (wo.status === "completed") counts.completed++;
      else if (wo.status === "active" || wo.status === "in_progress") counts.active++;
      else counts.pending++;
    });
    return counts;
  }, [workOrders]);

  if (workOrders.length === 0) {
    return (
      <div className="text-center py-8">
        <ClipboardList className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">Henüz iş emri oluşturulmadı</p>
        <p className="text-xs text-muted-foreground mt-1">
          Maliyet Hesaplama sekmesinden iş emirleri oluşturabilirsiniz
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status overview */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center p-3 rounded-lg bg-warning/10 border border-warning/20">
          <AlertCircle className="w-4 h-4 text-warning mb-1" />
          <span className="text-lg font-bold font-mono text-foreground">{statusCounts.pending}</span>
          <span className="text-[10px] text-muted-foreground">Bekleyen</span>
        </div>
        <div className="flex flex-col items-center p-3 rounded-lg bg-accent/10 border border-accent/20">
          <Timer className="w-4 h-4 text-accent-foreground mb-1" />
          <span className="text-lg font-bold font-mono text-foreground">{statusCounts.active}</span>
          <span className="text-[10px] text-muted-foreground">Aktif</span>
        </div>
        <div className="flex flex-col items-center p-3 rounded-lg bg-success/10 border border-success/20">
          <CheckCircle2 className="w-4 h-4 text-success mb-1" />
          <span className="text-lg font-bold font-mono text-foreground">{statusCounts.completed}</span>
          <span className="text-[10px] text-muted-foreground">Tamamlanan</span>
        </div>
      </div>

      {/* Recent work orders */}
      <ul className="space-y-2">
        {workOrders.slice(0, 4).map((wo: any, i: number) => (
          <li
            key={i}
            className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/40 border border-border/50"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{wo.name || wo.orderName || `İş Emri #${i + 1}`}</p>
              <p className="text-xs text-muted-foreground">{wo.operationCount || "—"} operasyon</p>
            </div>
            <Badge
              variant="outline"
              className={`text-[10px] shrink-0 ${
                wo.status === "completed"
                  ? "border-success/40 text-success"
                  : wo.status === "active"
                  ? "border-accent/40 text-accent-foreground"
                  : "border-warning/40 text-warning"
              }`}
            >
              {wo.status === "completed" ? "Tamamlandı" : wo.status === "active" ? "Aktif" : "Bekliyor"}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Dashboard;
