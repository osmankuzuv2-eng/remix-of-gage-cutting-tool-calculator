import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OnlineUser {
  user_id: string;
  display_name: string | null;
  last_seen: string;
  avatar_url: string | null;
}

const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes
const ONLINE_THRESHOLD = 10 * 60 * 1000;  // 10 minutes — considered online

export function useOnlineUsers() {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch display name from profiles
  const getDisplayName = useCallback(async (userId: string): Promise<string | null> => {
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .single();
    return data?.display_name ?? null;
  }, []);

  // Send heartbeat — upsert presence row
  const sendHeartbeat = useCallback(async () => {
    if (!user) return;
    const displayName = await getDisplayName(user.id);
    await supabase.from("user_presence" as any).upsert(
      {
        user_id: user.id,
        last_seen: new Date().toISOString(),
        display_name: displayName ?? user.email,
      },
      { onConflict: "user_id" }
    );
  }, [user, getDisplayName]);

  // Load currently online users
  const loadOnlineUsers = useCallback(async () => {
    const threshold = new Date(Date.now() - ONLINE_THRESHOLD).toISOString();
    const { data } = await supabase
      .from("user_presence" as any)
      .select("user_id, display_name, last_seen")
      .gte("last_seen", threshold)
      .order("last_seen", { ascending: false });

    if (data) {
      const users = data as unknown as OnlineUser[];
      // Fetch avatar_url from profiles for each user
      const userIds = users.map(u => u.user_id);
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, avatar_url")
          .in("user_id", userIds);
        const avatarMap = new Map((profiles || []).map(p => [p.user_id, p.avatar_url]));
        users.forEach(u => {
          u.avatar_url = avatarMap.get(u.user_id) ?? null;
        });
      }
      setOnlineUsers(users);
    }
  }, []);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!user) return;

    // Initial heartbeat + load
    sendHeartbeat();
    loadOnlineUsers();

    // Periodic heartbeat
    heartbeatRef.current = setInterval(() => {
      sendHeartbeat();
      loadOnlineUsers();
    }, HEARTBEAT_INTERVAL);

    // Realtime subscription
    const channel = supabase
      .channel("user_presence_changes")
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "user_presence" },
        () => {
          loadOnlineUsers();
        }
      )
      .subscribe();

    // Clean up on unmount / sign out — remove own presence
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      supabase.removeChannel(channel);
      if (user) {
        supabase.from("user_presence" as any).delete().eq("user_id", user.id);
      }
    };
  }, [user, sendHeartbeat, loadOnlineUsers]);

  return { onlineUsers };
}
