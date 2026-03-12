import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Clock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { tr } from "date-fns/locale";

interface ActivityLog {
  id: string;
  user_id: string;
  display_name: string | null;
  module_key: string;
  module_name: string | null;
  created_at: string;
  avatar_url?: string | null;
}

const getInitials = (name: string | null) => {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
};

const ActivityFeed = () => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileMap, setProfileMap] = useState<Record<string, { display_name: string | null; avatar_url: string | null }>>({});

  const loadActivities = async () => {
    const { data } = await supabase
      .from("user_activity_logs" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      const logs = data as unknown as ActivityLog[];
      setActivities(logs);

      // Fetch profiles for all unique user_ids
      const uniqueIds = [...new Set(logs.map(l => l.user_id))];
      if (uniqueIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", uniqueIds);
        if (profiles) {
          const map: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
          profiles.forEach(p => { map[p.user_id] = { display_name: p.display_name, avatar_url: p.avatar_url }; });
          setProfileMap(map);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadActivities();

    const channel = supabase
      .channel("activity-feed-realtime-v2")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_activity_logs" }, async (payload) => {
        const newActivity = payload.new as ActivityLog;
        setActivities(prev => [newActivity, ...prev].slice(0, 20));

        // Fetch profile for new user if not cached
        if (newActivity.user_id) {
          const { data: profile } = await supabase.from("profiles").select("user_id, display_name, avatar_url").eq("user_id", newActivity.user_id).single();
          if (profile) {
            setProfileMap(prev => ({ ...prev, [profile.user_id]: { display_name: profile.display_name, avatar_url: profile.avatar_url } }));
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Son Aktiviteler</h3>
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg animate-pulse">
              <div className="w-8 h-8 rounded-full bg-muted" />
              <div className="flex-1 space-y-1">
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="h-2 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-semibold text-sm text-foreground">Son Kullanıcı Aktiviteleri</h3>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Son 20</span>
      </div>

      <div className="divide-y divide-border/50 max-h-[600px] overflow-y-auto">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Activity className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Henüz aktivite yok</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Kullanıcılar modüllere giriş yaptığında burada görünür</p>
          </div>
        ) : (
          activities.map(activity => {
            const profile = profileMap[activity.user_id];
            const name = profile?.display_name || activity.display_name || "Kullanıcı";
            const avatarUrl = profile?.avatar_url || null;
            const timeAgo = formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: tr });
            const exactTime = format(new Date(activity.created_at), "dd MMM yyyy, HH:mm", { locale: tr });

            return (
              <div key={activity.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mt-0.5 border border-border/50">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">{getInitials(name)}</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-snug">
                    <span className="font-semibold text-primary">{name}</span>
                    <span className="text-muted-foreground mx-1">→</span>
                    <span className="font-medium text-foreground/80">{activity.module_name || activity.module_key}</span>
                    <span className="text-muted-foreground ml-1">modülüne giriş yaptı</span>
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Clock className="w-3 h-3 text-muted-foreground/60" />
                    <span className="text-xs text-muted-foreground/70" title={exactTime}>{exactTime}</span>
                    <span className="text-xs text-muted-foreground/40">·</span>
                    <span className="text-xs text-muted-foreground/50">{timeAgo}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;
