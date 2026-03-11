import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Newspaper } from "lucide-react";

interface NewsItem {
  id: string;
  content: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

const NewsManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [newContent, setNewContent] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("news_items" as any)
      .select("*")
      .order("sort_order", { ascending: true });
    if (data) setItems(data as any[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addNews = async () => {
    if (!newContent.trim() || !user) return;
    const { error } = await supabase.from("news_items" as any).insert({
      content: newContent.trim(),
      created_by: user.id,
      sort_order: items.length,
    } as any);
    if (error) {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
    } else {
      setNewContent("");
      toast({ title: "Haber eklendi" });
      load();
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("news_items" as any).update({ is_active: active } as any).eq("id", id);
    load();
  };

  const deleteNews = async (id: string) => {
    await supabase.from("news_items" as any).delete().eq("id", id);
    toast({ title: "Haber silindi" });
    load();
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Newspaper className="w-5 h-5 text-primary" />
          Haber Akışı Yönetimi
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Yeni haber metni girin..."
            onKeyDown={(e) => e.key === "Enter" && addNews()}
          />
          <Button onClick={addNews} size="sm" className="gap-1">
            <Plus className="w-4 h-4" /> Ekle
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Yükleniyor...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz haber eklenmemiş.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-muted/20">
                <Switch
                  checked={item.is_active}
                  onCheckedChange={(v) => toggleActive(item.id, v)}
                />
                <span className={`flex-1 text-sm ${!item.is_active ? "text-muted-foreground line-through" : ""}`}>
                  {item.content}
                </span>
                <Button variant="ghost" size="icon" onClick={() => deleteNews(item.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NewsManager;
