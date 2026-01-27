import { useMemo } from "react";
import { safeGetItem, isValidArray } from "@/lib/safeStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Calculator, Clock, DollarSign, TrendingUp, Package } from "lucide-react";
import { materials as defaultMaterials, Material } from "@/data/materials";
import { categoryStyles } from "@/data/categoryStyles";

interface DashboardProps {
  customMaterials?: Material[];
}

const HISTORY_KEY = "cnc_calculation_history";

const Dashboard = ({ customMaterials = [] }: DashboardProps) => {
  const calculationHistory = useMemo(() => {
    const stored = safeGetItem<unknown[]>(HISTORY_KEY, []);
    return isValidArray(stored) ? stored : [];
  }, []);

  const allMaterials = [...defaultMaterials, ...customMaterials];

  // Calculate statistics
  const stats = useMemo(() => {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const todayCalcs = calculationHistory.filter(
      (c: { timestamp: string }) => new Date(c.timestamp).toDateString() === today.toDateString()
    ).length;

    const weekCalcs = calculationHistory.filter(
      (c: { timestamp: string }) => new Date(c.timestamp) >= weekAgo
    ).length;

    const monthCalcs = calculationHistory.filter(
      (c: { timestamp: string }) => new Date(c.timestamp) >= monthAgo
    ).length;

    return {
      total: calculationHistory.length,
      today: todayCalcs,
      week: weekCalcs,
      month: monthCalcs,
    };
  }, [calculationHistory]);

  // Material usage data for pie chart
  const materialUsageData = useMemo(() => {
    const usage: Record<string, number> = {};
    calculationHistory.forEach((calc: { materialId?: string }) => {
      if (calc.materialId) {
        usage[calc.materialId] = (usage[calc.materialId] || 0) + 1;
      }
    });

    return Object.entries(usage)
      .map(([id, count]) => {
        const material = allMaterials.find((m) => m.id === id);
        return {
          name: material?.name || id,
          value: count,
          category: material?.category || "Diğer",
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [calculationHistory, allMaterials]);

  // Category distribution data
  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    allMaterials.forEach((m) => {
      categories[m.category] = (categories[m.category] || 0) + 1;
    });

    return Object.entries(categories).map(([name, value]) => ({
      name,
      value,
    }));
  }, [allMaterials]);

  // Weekly trend data
  const weeklyTrendData = useMemo(() => {
    const days = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
    const today = new Date();
    const data = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dayCalcs = calculationHistory.filter(
        (c: { timestamp: string }) =>
          new Date(c.timestamp).toDateString() === date.toDateString()
      ).length;

      data.push({
        name: days[date.getDay()],
        hesaplama: dayCalcs,
        date: date.toLocaleDateString("tr-TR"),
      });
    }

    return data;
  }, [calculationHistory]);

  const COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--success))",
    "hsl(var(--warning))",
    "hsl(var(--accent))",
    "hsl(142 76% 36%)",
    "hsl(262 83% 58%)",
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calculator className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Toplam Hesaplama</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.today}</p>
                <p className="text-xs text-muted-foreground">Bugün</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Clock className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.week}</p>
                <p className="text-xs text-muted-foreground">Bu Hafta</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Package className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{allMaterials.length}</p>
                <p className="text-xs text-muted-foreground">Toplam Malzeme</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Trend */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground text-base">Haftalık Hesaplama Trendi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="hesaplama"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Material Categories */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground text-base">Malzeme Kategorileri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend
                    formatter={(value) => (
                      <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Most Used Materials */}
      {materialUsageData.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground text-base">En Çok Kullanılan Malzemeler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={materialUsageData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    width={120}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {calculationHistory.length === 0 && (
        <Card className="border-border bg-card">
          <CardContent className="p-8 text-center">
            <Calculator className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-2">Henüz hesaplama yok</h3>
            <p className="text-muted-foreground">
              Kesme hesaplamaları yaptıkça istatistikler burada görünecek.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
