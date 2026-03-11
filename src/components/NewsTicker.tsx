import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, Sparkles } from "lucide-react";

interface NewsItem {
  id: string;
  content: string;
}

const NewsTicker = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const innerRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => {
    const fetchNews = async () => {
      const { data } = await supabase
        .from("news_items" as any)
        .select("id, content")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (data) setNews(data as any[]);
    };
    fetchNews();
  }, []);

  // Measure one set of items
  useEffect(() => {
    if (innerRef.current && news.length > 0) {
      // Measure after render
      requestAnimationFrame(() => {
        if (innerRef.current) {
          setContentWidth(innerRef.current.scrollWidth / 2);
        }
      });
    }
  }, [news]);

  if (!news.length) return null;

  // Duplicate once for seamless loop
  const items = [...news, ...news];

  return (
    <div
      className="w-full overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-card/90 to-primary/5 backdrop-blur-sm shadow-sm relative group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Gradient fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-card to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-card to-transparent z-10 pointer-events-none" />

      <div className="flex items-center">
        <div className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-primary/10 border-r border-primary/20 z-20 relative">
          <Megaphone className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-xs font-bold text-primary whitespace-nowrap tracking-wider uppercase">
            Duyurular
          </span>
        </div>

        <div className="overflow-hidden flex-1 py-2.5">
          <div
            ref={innerRef}
            className="flex whitespace-nowrap will-change-transform"
            style={{
              animation: contentWidth
                ? `ticker-scroll ${Math.max(contentWidth / 60, 8)}s linear infinite`
                : undefined,
              animationPlayState: isPaused ? "paused" : "running",
            }}
          >
            {items.map((item, i) => (
              <span
                key={`${item.id}-${i}`}
                className="inline-flex items-center mx-10 text-sm font-medium text-foreground/90"
              >
                <Sparkles className="w-3.5 h-3.5 text-primary/70 mr-2.5 flex-shrink-0" />
                {item.content}
              </span>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

export default NewsTicker;
