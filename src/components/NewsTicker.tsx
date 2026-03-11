import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Newspaper } from "lucide-react";

interface NewsItem {
  id: string;
  content: string;
}

const NewsTicker = () => {
  const [news, setNews] = useState<NewsItem[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("news_items" as any)
        .select("id, content")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (data) setNews(data as any[]);
    };
    fetch();
  }, []);

  if (!news.length) return null;

  // Duplicate items for seamless loop
  const items = [...news, ...news];

  return (
    <div className="w-full overflow-hidden rounded-lg border border-border/60 bg-card/80 backdrop-blur-sm">
      <div className="flex items-center">
        <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-primary/10 border-r border-border/60">
          <Newspaper className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-primary whitespace-nowrap">HABERLER</span>
        </div>
        <div className="overflow-hidden flex-1 py-2">
          <div className="flex animate-news-scroll whitespace-nowrap">
            {items.map((item, i) => (
              <span key={`${item.id}-${i}`} className="inline-flex items-center mx-8 text-sm text-foreground/80">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 mr-3 flex-shrink-0" />
                {item.content}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsTicker;
