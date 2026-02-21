import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { History } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface PriceHistory {
  id: string;
  old_price: number | null;
  new_price: number | null;
  changed_by_name: string | null;
  change_type: string;
  created_at: string;
}

interface PriceHistoryTooltipProps {
  materialId: string;
}

const PriceHistoryTooltip = ({ materialId }: PriceHistoryTooltipProps) => {
  const [history, setHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadHistory = async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("material_price_history" as any)
        .select("id, old_price, new_price, changed_by_name, change_type, created_at")
        .eq("material_id", materialId)
        .order("created_at", { ascending: false })
        .limit(10);
      setHistory((data as any) || []);
      setLoaded(true);
    } catch (e) {
      console.error("Failed to load price history:", e);
    } finally {
      setLoading(false);
    }
  };

  const resetAndLoad = () => {
    setLoaded(false);
    loadHistory();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onClick={resetAndLoad}
          className="p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-all"
          title="Fiyat geçmişi"
        >
          <History className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        className="w-80 p-0 bg-popover border-border shadow-xl"
      >
        <div className="p-3 border-b border-border">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            Fiyat Değişiklik Geçmişi
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">Son 10 işlem</p>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">Yükleniyor...</div>
          ) : history.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Henüz fiyat değişikliği yapılmamış.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {history.map((h) => (
                <div key={h.id} className="px-3 py-2.5 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">
                      {h.changed_by_name || "Bilinmiyor"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(h.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-destructive line-through">
                      {h.old_price != null ? `€${Number(h.old_price).toFixed(2)}` : "-"}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-mono text-success font-semibold">
                      {h.new_price != null ? `€${Number(h.new_price).toFixed(2)}` : "-"}
                    </span>
                    {h.old_price != null && h.new_price != null && Number(h.old_price) > 0 && (
                      <span className={`text-[10px] px-1 py-0.5 rounded ${
                        Number(h.new_price) > Number(h.old_price)
                          ? "bg-destructive/10 text-destructive"
                          : "bg-success/10 text-success"
                      }`}>
                        {Number(h.new_price) > Number(h.old_price) ? "+" : ""}
                        {(((Number(h.new_price) - Number(h.old_price)) / Number(h.old_price)) * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default PriceHistoryTooltip;
