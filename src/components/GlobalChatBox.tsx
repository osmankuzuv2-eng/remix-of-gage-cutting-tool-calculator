import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Hash, Send, Trash2, Shield, Info,
  ChevronRight, Users, Megaphone, Wrench, Scissors, MessageSquare,
  UserPlus, X, Mail
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { tr } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Channel {
  id: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
}

interface ChatMessage {
  id: string;
  user_id: string;
  display_name: string | null;
  title: string | null;
  title_color: string | null;
  content: string;
  created_at: string;
  channel_id: string | null;
  is_deleted: boolean | null;
}

interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  deleted_by_sender: boolean;
  deleted_by_receiver: boolean;
}

interface DmPeer {
  userId: string;
  displayName: string;
  lastMessage: string;
  lastMessageTime: string;
  unread: number;
}

// ─── IRC Commands ─────────────────────────────────────────────────────────────
const HELP_TEXT = `
╔══════════════════════════════════════════╗
║           GAGE CHAT KOMUTLARI            ║
╠══════════════════════════════════════════╣
║ GENEL KOMUTLAR                           ║
║  !yardim       → Bu yardım menüsü        ║
║  !temizle      → Ekranı temizle          ║
║  !tarih        → Bugünün tarihi          ║
║  !versiyon     → Uygulama versiyonu      ║
╠══════════════════════════════════════════╣
║ YÖNETİCİ / MODERATÖR KOMUTLARI          ║
║  !sil [id]     → Mesajı sil              ║
║  !kanal [isim] → Kanal oluştur (admin)   ║
║  !duyuru [msg] → Tüm kanallara duyuru    ║
╚══════════════════════════════════════════╝
`.trim();

// ─── Channel icon map ─────────────────────────────────────────────────────────
const channelIcon = (name: string) => {
  if (name === "duyurular") return <Megaphone className="w-3.5 h-3.5" />;
  if (name === "teknik") return <Wrench className="w-3.5 h-3.5" />;
  if (name === "kesme-parametreleri") return <Scissors className="w-3.5 h-3.5" />;
  if (name === "random") return <MessageSquare className="w-3.5 h-3.5" />;
  return <Hash className="w-3.5 h-3.5" />;
};

// ─── Time helpers ─────────────────────────────────────────────────────────────
const formatTime = (ts: string) => format(new Date(ts), "HH:mm");

const formatDateDivider = (ts: string) => {
  const d = new Date(ts);
  if (isToday(d)) return "Bugün";
  if (isYesterday(d)) return "Dün";
  return format(d, "dd MMMM yyyy", { locale: tr });
};

// ─── System message component ─────────────────────────────────────────────────
const SystemMessage = ({ text }: { text: string }) => (
  <div className="flex justify-center my-2">
    <span className="text-[11px] text-muted-foreground/60 bg-muted/30 px-3 py-1 rounded-full border border-border/30">
      {text}
    </span>
  </div>
);

// ─── Date divider ─────────────────────────────────────────────────────────────
const DateDivider = ({ label }: { label: string }) => (
  <div className="flex items-center gap-3 my-3 select-none">
    <div className="flex-1 h-px bg-border/40" />
    <span className="text-[10px] text-muted-foreground/50 font-medium px-2">{label}</span>
    <div className="flex-1 h-px bg-border/40" />
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
const GlobalChatBox = () => {
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [localLines, setLocalLines] = useState<{ id: string; text: string; type: "system" | "help" }[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    display_name: string | null;
    custom_title: string | null;
    title_color: string | null;
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── DM state ──────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<"channel" | "dm">("channel");
  const [dmPeerId, setDmPeerId] = useState<string | null>(null);
  const [dmPeers, setDmPeers] = useState<DmPeer[]>([]);
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);
  const [dmUnreadCounts, setDmUnreadCounts] = useState<Record<string, number>>({});
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [allUsers, setAllUsers] = useState<{ user_id: string; display_name: string | null }[]>([]);
  const [userSearch, setUserSearch] = useState("");
  // Map userId → display_name for DM rendering
  const [userNameMap, setUserNameMap] = useState<Record<string, string>>({});

  // ── Last-read helpers (localStorage) ──────────────────────────────────────
  const getLastRead = (key: string): string =>
    localStorage.getItem(`chat_last_read_${key}`) ?? "1970-01-01";

  const markAsRead = useCallback((key: string) => {
    localStorage.setItem(`chat_last_read_${key}`, new Date().toISOString());
    setUnreadCounts((prev) => ({ ...prev, [key]: 0 }));
    setDmUnreadCounts((prev) => ({ ...prev, [key]: 0 }));
  }, []);

  // ── Load admin status ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      setIsAdmin(data?.some((r) => r.role === "admin") ?? false);
    });
  }, [user]);

  // ── Load user profile ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, custom_title, title_color")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => { if (data) setUserProfile(data); });
  }, [user]);

  // ── Load channels ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from("chat_channels" as any)
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        if (data && data.length > 0) {
          setChannels(data as unknown as Channel[]);
          setActiveChannelId((data as unknown as Channel[])[0].id);
        }
      });
  }, []);

  // ── Compute unread counts across all channels ─────────────────────────────
  const refreshUnread = useCallback(async (channelList: Channel[]) => {
    if (channelList.length === 0) return;
    const counts: Record<string, number> = {};
    await Promise.all(channelList.map(async (ch) => {
      const lastRead = getLastRead(ch.id);
      const { count } = await supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("channel_id", ch.id)
        .eq("is_deleted", false)
        .gt("created_at", lastRead);
      counts[ch.id] = count ?? 0;
    }));
    setUnreadCounts(counts);
  }, []);

  useEffect(() => {
    if (channels.length > 0) refreshUnread(channels);
  }, [channels, refreshUnread]);

  // ── Mark active channel as read when switching ────────────────────────────
  useEffect(() => {
    if (viewMode === "channel" && activeChannelId) markAsRead(activeChannelId);
  }, [activeChannelId, markAsRead, viewMode]);

  // ── Load messages for active channel ──────────────────────────────────────
  const loadMessages = useCallback(async () => {
    if (!activeChannelId || viewMode !== "channel") return;
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("channel_id", activeChannelId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(200);
    if (data) setMessages(data as ChatMessage[]);
    markAsRead(activeChannelId);
  }, [activeChannelId, markAsRead, viewMode]);

  useEffect(() => {
    if (viewMode === "channel") {
      loadMessages();
      setLocalLines([]);
    }
  }, [loadMessages, viewMode]);

  // ── Realtime subscription — channel messages ─────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("chat_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, (payload) => {
        if (viewMode === "channel") loadMessages();
        if (channels.length > 0) {
          const changedChannelId = (payload.new as any)?.channel_id;
          if (changedChannelId && (viewMode !== "channel" || changedChannelId !== activeChannelId)) {
            setUnreadCounts((prev) => ({
              ...prev,
              [changedChannelId]: (prev[changedChannelId] ?? 0) + 1,
            }));
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadMessages, channels, activeChannelId, viewMode]);

  // ── DM: Load all users for picker ─────────────────────────────────────────
  const loadAllUsers = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_presence")
      .select("user_id, display_name");
    if (data) {
      const filtered = data.filter((u) => u.user_id !== user.id);
      setAllUsers(filtered);
      // Build name map
      const map: Record<string, string> = {};
      data.forEach((u) => { map[u.user_id] = u.display_name ?? "Kullanıcı"; });
      setUserNameMap(map);
    }
  }, [user]);

  // ── DM: Load conversation peers ──────────────────────────────────────────
  const loadDmPeers = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("direct_messages" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (!data || data.length === 0) { setDmPeers([]); return; }

    const msgs = data as unknown as DirectMessage[];
    const peerMap = new Map<string, { lastMsg: DirectMessage; unread: number }>();

    msgs.forEach((m) => {
      const peerId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      if (!peerMap.has(peerId)) {
        const lastReadKey = `dm_${peerId}`;
        const lastRead = getLastRead(lastReadKey);
        peerMap.set(peerId, { lastMsg: m, unread: 0 });
      }
      const entry = peerMap.get(peerId)!;
      // Count unread (messages from them after last read)
      if (m.sender_id !== user.id) {
        const lastRead = getLastRead(`dm_${m.sender_id}`);
        if (m.created_at > lastRead) {
          entry.unread++;
        }
      }
    });

    const peers: DmPeer[] = [];
    const unreadMap: Record<string, number> = {};
    peerMap.forEach((val, peerId) => {
      peers.push({
        userId: peerId,
        displayName: userNameMap[peerId] ?? "Kullanıcı",
        lastMessage: val.lastMsg.content,
        lastMessageTime: val.lastMsg.created_at,
        unread: val.unread,
      });
      unreadMap[peerId] = val.unread;
    });

    peers.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
    setDmPeers(peers);
    setDmUnreadCounts(unreadMap);
  }, [user, userNameMap]);

  useEffect(() => {
    loadAllUsers();
  }, [loadAllUsers]);

  useEffect(() => {
    if (Object.keys(userNameMap).length > 0) loadDmPeers();
  }, [userNameMap, loadDmPeers]);

  // ── DM: Load messages for active peer ─────────────────────────────────────
  const loadDmMessages = useCallback(async () => {
    if (!user || !dmPeerId || viewMode !== "dm") return;
    const { data } = await supabase
      .from("direct_messages" as any)
      .select("*")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${dmPeerId}),and(sender_id.eq.${dmPeerId},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true })
      .limit(200);
    if (data) setDmMessages(data as unknown as DirectMessage[]);
    markAsRead(`dm_${dmPeerId}`);
  }, [user, dmPeerId, markAsRead, viewMode]);

  useEffect(() => {
    if (viewMode === "dm" && dmPeerId) {
      loadDmMessages();
      setLocalLines([]);
    }
  }, [loadDmMessages, viewMode, dmPeerId]);

  // ── DM: Realtime subscription ─────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel("dm_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
        const newMsg = payload.new as any;
        if (!user) return;
        // If currently viewing this DM thread
        if (viewMode === "dm" && dmPeerId &&
          ((newMsg.sender_id === user.id && newMsg.receiver_id === dmPeerId) ||
           (newMsg.sender_id === dmPeerId && newMsg.receiver_id === user.id))) {
          loadDmMessages();
        } else if (newMsg.receiver_id === user.id) {
          // Increment unread for peer
          setDmUnreadCounts((prev) => ({
            ...prev,
            [newMsg.sender_id]: (prev[newMsg.sender_id] ?? 0) + 1,
          }));
        }
        loadDmPeers();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, viewMode, dmPeerId, loadDmMessages, loadDmPeers]);

  // ── Auto scroll ────────────────────────────────────────────────────────────
  const prevChannelRef = useRef(activeChannelId);
  const prevDmPeerRef = useRef(dmPeerId);
  const prevViewRef = useRef(viewMode);
  const prevMsgCount = useRef(0);
  const prevDmCount = useRef(0);

  useEffect(() => {
    const viewChanged = prevViewRef.current !== viewMode;
    const channelChanged = prevChannelRef.current !== activeChannelId;
    const dmChanged = prevDmPeerRef.current !== dmPeerId;
    const newChannelMsg = messages.length > prevMsgCount.current;
    const newDmMsg = dmMessages.length > prevDmCount.current;

    if (viewChanged || channelChanged || dmChanged || newChannelMsg || newDmMsg || localLines.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: (viewChanged || channelChanged || dmChanged) ? "instant" : "smooth" });
    }

    prevViewRef.current = viewMode;
    prevChannelRef.current = activeChannelId;
    prevDmPeerRef.current = dmPeerId;
    prevMsgCount.current = messages.length;
    prevDmCount.current = dmMessages.length;
  }, [messages, dmMessages, localLines, viewMode, activeChannelId, dmPeerId]);

  // ── Chat commands ──────────────────────────────────────────────────────────
  const handleCommand = async (cmd: string): Promise<boolean> => {
    const parts = cmd.trim().split(" ");
    const command = parts[0].toLowerCase();

    if (command === "!yardim") {
      setLocalLines((prev) => [...prev, { id: Date.now().toString(), text: HELP_TEXT, type: "help" }]);
      return true;
    }
    if (command === "!temizle") {
      setLocalLines([]);
      return true;
    }
    if (command === "!tarih") {
      setLocalLines((prev) => [...prev, {
        id: Date.now().toString(),
        text: `📅 ${format(new Date(), "dd MMMM yyyy EEEE, HH:mm:ss", { locale: tr })}`,
        type: "system",
      }]);
      return true;
    }
    if (command === "!versiyon") {
      setLocalLines((prev) => [...prev, { id: Date.now().toString(), text: "GAGE CNC Suite v2.0", type: "system" }]);
      return true;
    }
    if (command === "!sil" && isAdmin) {
      const msgId = parts[1];
      if (msgId) {
        await supabase.from("chat_messages").update({ is_deleted: true, deleted_by: user!.id } as any).eq("id", msgId);
        setLocalLines((prev) => [...prev, { id: Date.now().toString(), text: `✅ Mesaj silindi: ${msgId}`, type: "system" }]);
      }
      return true;
    }
    if (command === "!duyuru" && isAdmin) {
      const announcement = parts.slice(1).join(" ");
      if (announcement && activeChannelId) {
        await supabase.from("chat_messages").insert({
          user_id: user!.id,
          display_name: "📢 DUYURU",
          title: "Sistem",
          title_color: "#f59e0b",
          content: announcement,
          channel_id: activeChannelId,
        } as any);
      }
      return true;
    }
    return false;
  };

  // ── Send message (channel or DM) ──────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || !user) return;

    if (viewMode === "channel") {
      if (!activeChannelId) return;
      if (input.startsWith("!")) {
        const handled = await handleCommand(input);
        if (handled) { setInput(""); return; }
      }
      setSending(true);
      await supabase.from("chat_messages").insert({
        user_id: user.id,
        display_name: userProfile?.display_name ?? user.email ?? "Kullanıcı",
        title: userProfile?.custom_title ?? null,
        title_color: userProfile?.title_color ?? "#6366f1",
        content: input.trim(),
        channel_id: activeChannelId,
      } as any);
      setInput("");
      setSending(false);
    } else {
      if (!dmPeerId) return;
      setSending(true);
      await supabase.from("direct_messages" as any).insert({
        sender_id: user.id,
        receiver_id: dmPeerId,
        content: input.trim(),
      } as any);
      setInput("");
      setSending(false);
    }
  };

  const deleteMessage = async (id: string) => {
    await supabase.from("chat_messages").update({ is_deleted: true, deleted_by: user!.id } as any).eq("id", id);
  };

  // ── Delete DM conversation (soft delete) ──────────────────────────────────
  const deleteDmConversation = async (peerId: string) => {
    if (!user) return;
    // Mark all messages in this conversation as deleted by current user
    // Messages where I'm sender
    await supabase
      .from("direct_messages" as any)
      .update({ deleted_by_sender: true } as any)
      .eq("sender_id", user.id)
      .eq("receiver_id", peerId);
    // Messages where I'm receiver
    await supabase
      .from("direct_messages" as any)
      .update({ deleted_by_receiver: true } as any)
      .eq("receiver_id", user.id)
      .eq("sender_id", peerId);

    // Remove from local state
    setDmPeers((prev) => prev.filter((p) => p.userId !== peerId));
    if (dmPeerId === peerId) {
      setViewMode("channel");
      setDmPeerId(null);
    }
  };

  // ── Start DM with a user ──────────────────────────────────────────────────
  const startDm = (targetUserId: string) => {
    setViewMode("dm");
    setDmPeerId(targetUserId);
    setShowUserPicker(false);
    setUserSearch("");
  };

  // ── Switch to channel view ────────────────────────────────────────────────
  const switchToChannel = (channelId: string) => {
    setViewMode("channel");
    setDmPeerId(null);
    setActiveChannelId(channelId);
  };

  // ── Render channel messages with date dividers ───────────────────────────
  const renderChannelMessages = () => {
    const items: React.ReactNode[] = [];
    let lastDate = "";

    messages.forEach((msg, i) => {
      const msgDate = formatDateDivider(msg.created_at);
      if (msgDate !== lastDate) {
        items.push(<DateDivider key={`divider-${i}`} label={msgDate} />);
        lastDate = msgDate;
      }

      const isMe = msg.user_id === user?.id;
      const canDelete = isMe || isAdmin;
      const initials = (msg.display_name ?? "?")
        .split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

      const prevMsg = messages[i - 1];
      const isGrouped =
        prevMsg &&
        prevMsg.user_id === msg.user_id &&
        new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 5 * 60 * 1000;

      items.push(
        <div key={msg.id} className={`group flex gap-3 px-3 py-0.5 hover:bg-muted/20 rounded-lg transition-colors ${!isGrouped ? "mt-3" : ""}`}>
          <div className="w-8 flex-shrink-0 flex items-start pt-0.5">
            {!isGrouped ? (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold select-none"
                style={{
                  background: `${msg.title_color ?? "#6366f1"}20`,
                  border: `1.5px solid ${msg.title_color ?? "#6366f1"}40`,
                  color: msg.title_color ?? "#6366f1",
                }}
              >
                {initials}
              </div>
            ) : (
              <span className="w-8 text-center text-[9px] text-muted-foreground/30 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {formatTime(msg.created_at)}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {!isGrouped && (
              <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                <span className="text-sm font-semibold leading-none" style={{ color: msg.title_color ?? "hsl(var(--foreground))" }}>
                  {msg.display_name ?? "Kullanıcı"}
                </span>
                {msg.title && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md leading-none"
                    style={{ background: `${msg.title_color ?? "#6366f1"}18`, color: msg.title_color ?? "#6366f1", border: `1px solid ${msg.title_color ?? "#6366f1"}30` }}>
                    {msg.title}
                  </span>
                )}
                {isMe && <Shield className="w-3 h-3 text-muted-foreground/40" />}
                <span className="text-[10px] text-muted-foreground/50 leading-none">{formatTime(msg.created_at)}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <p className="text-sm text-foreground/90 leading-relaxed break-words min-w-0 flex-1">{msg.content}</p>
              {canDelete && (
                <button onClick={() => deleteMessage(msg.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex-shrink-0">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      );
    });

    localLines.forEach((line) => {
      if (line.type === "help") {
        items.push(
          <div key={line.id} className="mx-3 my-2 p-3 rounded-lg bg-muted/40 border border-border/40">
            <pre className="text-[11px] text-primary/80 font-mono whitespace-pre leading-relaxed">{line.text}</pre>
          </div>
        );
      } else {
        items.push(
          <div key={line.id} className="flex items-center gap-2 px-3 py-1">
            <Info className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
            <span className="text-[11px] text-muted-foreground/70 font-mono">{line.text}</span>
          </div>
        );
      }
    });

    return items;
  };

  // ── Render DM messages ────────────────────────────────────────────────────
  const renderDmMessages = () => {
    const items: React.ReactNode[] = [];
    let lastDate = "";

    dmMessages.forEach((msg, i) => {
      const msgDate = formatDateDivider(msg.created_at);
      if (msgDate !== lastDate) {
        items.push(<DateDivider key={`divider-${i}`} label={msgDate} />);
        lastDate = msgDate;
      }

      const isMe = msg.sender_id === user?.id;
      const senderName = isMe
        ? (userProfile?.display_name ?? "Ben")
        : (userNameMap[msg.sender_id] ?? "Kullanıcı");
      const initials = senderName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

      const prevMsg = dmMessages[i - 1];
      const isGrouped =
        prevMsg &&
        prevMsg.sender_id === msg.sender_id &&
        new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 5 * 60 * 1000;

      items.push(
        <div key={msg.id} className={`group flex gap-3 px-3 py-0.5 hover:bg-muted/20 rounded-lg transition-colors ${!isGrouped ? "mt-3" : ""}`}>
          <div className="w-8 flex-shrink-0 flex items-start pt-0.5">
            {!isGrouped ? (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold select-none"
                style={{
                  background: isMe ? "hsl(var(--primary) / 0.15)" : "hsl(var(--accent) / 0.3)",
                  border: `1.5px solid ${isMe ? "hsl(var(--primary) / 0.3)" : "hsl(var(--accent))"}`,
                  color: isMe ? "hsl(var(--primary))" : "hsl(var(--accent-foreground))",
                }}>
                {initials}
              </div>
            ) : (
              <span className="w-8 text-center text-[9px] text-muted-foreground/30 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {formatTime(msg.created_at)}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {!isGrouped && (
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-sm font-semibold leading-none" style={{ color: isMe ? "hsl(var(--primary))" : "hsl(var(--foreground))" }}>
                  {senderName}
                </span>
                <span className="text-[10px] text-muted-foreground/50 leading-none">{formatTime(msg.created_at)}</span>
              </div>
            )}
            <p className="text-sm text-foreground/90 leading-relaxed break-words">{msg.content}</p>
          </div>
        </div>
      );
    });

    return items;
  };

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const dmPeerName = dmPeerId ? (userNameMap[dmPeerId] ?? "Kullanıcı") : "";
  const totalDmUnread = Object.values(dmUnreadCounts).reduce((s, n) => s + n, 0);

  const filteredUsers = allUsers.filter((u) =>
    (u.display_name ?? "").toLowerCase().includes(userSearch.toLowerCase()) &&
    !dmPeers.some((p) => p.userId === u.user_id)
  );

  return (
    <div className="flex rounded-xl overflow-hidden border border-border/60 bg-card/80 backdrop-blur-sm"
      style={{ minHeight: 600, height: "min(900px, calc(100vh - 280px))" }}>

      {/* ── Sidebar ── */}
      <div className="w-52 flex-shrink-0 bg-muted/20 border-r border-border/40 flex flex-col">
        {/* Server header */}
        <div className="px-3 py-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center">
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-xs font-bold text-foreground">GAGE Chat</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {/* Channels section */}
          <div className="px-3 py-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
              Kanallar
            </span>
          </div>
          {channels.map((ch) => {
            const unread = unreadCounts[ch.id] ?? 0;
            const isActive = viewMode === "channel" && activeChannelId === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => switchToChannel(ch.id)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-all duration-150 rounded-md mx-1 ${
                  isActive
                    ? "bg-primary/15 text-foreground font-medium"
                    : unread > 0
                    ? "text-foreground font-semibold hover:bg-muted/40"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}
                style={isActive ? { color: ch.color } : {}}
              >
                <span style={{ color: isActive ? ch.color : unread > 0 ? ch.color : undefined }}>
                  {channelIcon(ch.name)}
                </span>
                <span className="truncate flex-1 text-left">{ch.name}</span>
                {isActive ? (
                  <ChevronRight className="w-3 h-3 flex-shrink-0" />
                ) : unread > 0 ? (
                  <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                    style={{ background: ch.color }}>
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
              </button>
            );
          })}

          {/* DM section */}
          <div className="px-3 py-1.5 mt-3 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
              Özel Mesajlar
            </span>
            <button
              onClick={() => { setShowUserPicker(!showUserPicker); setUserSearch(""); }}
              className="p-0.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-primary transition-colors"
              title="Yeni özel mesaj"
            >
              <UserPlus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* User picker dropdown */}
          {showUserPicker && (
            <div className="mx-2 mb-2 rounded-lg border border-border/60 bg-card/90 shadow-lg overflow-hidden">
              <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/40">
                <Users className="w-3 h-3 text-muted-foreground/60" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Kullanıcı ara..."
                  className="flex-1 text-[11px] bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground/40"
                  autoFocus
                />
                <button onClick={() => setShowUserPicker(false)} className="p-0.5 hover:bg-muted/40 rounded">
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto">
                {filteredUsers.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground/50 text-center py-2">Kullanıcı bulunamadı</p>
                ) : (
                  filteredUsers.map((u) => (
                    <button
                      key={u.user_id}
                      onClick={() => startDm(u.user_id)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-foreground hover:bg-primary/10 transition-colors"
                    >
                      <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[9px] font-bold text-primary">
                        {(u.display_name ?? "?")[0].toUpperCase()}
                      </div>
                      <span className="truncate">{u.display_name ?? "Kullanıcı"}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* DM peer list */}
          {dmPeers.map((peer) => {
            const isActive = viewMode === "dm" && dmPeerId === peer.userId;
            const unread = dmUnreadCounts[peer.userId] ?? 0;
            return (
              <div key={peer.userId} className="flex items-center mx-1 group/dm">
                <button
                  onClick={() => startDm(peer.userId)}
                  className={`flex-1 flex items-center gap-2 px-3 py-1.5 text-xs transition-all duration-150 rounded-md ${
                    isActive
                      ? "bg-primary/15 text-foreground font-medium"
                      : unread > 0
                      ? "text-foreground font-semibold hover:bg-muted/40"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[9px] font-bold text-primary flex-shrink-0">
                    {peer.displayName[0].toUpperCase()}
                  </div>
                  <span className="truncate flex-1 text-left">{peer.displayName}</span>
                  {isActive ? (
                    <ChevronRight className="w-3 h-3 flex-shrink-0" />
                  ) : unread > 0 ? (
                    <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white bg-primary">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  ) : null}
                </button>
                {/* Delete conversation button */}
                <button
                  onClick={() => deleteDmConversation(peer.userId)}
                  className="opacity-0 group-hover/dm:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all flex-shrink-0 mr-1"
                  title="Konuşmayı sil"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {dmPeers.length === 0 && !showUserPicker && (
            <p className="text-[10px] text-muted-foreground/40 text-center px-3 py-2">
              Henüz özel mesaj yok
            </p>
          )}
        </div>

        {/* User info at bottom */}
        {user && (
          <div className="border-t border-border/40 px-3 py-2.5 bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                {(userProfile?.display_name ?? user.email ?? "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold truncate text-foreground">
                  {userProfile?.display_name ?? "Kullanıcı"}
                </p>
                {isAdmin && (
                  <p className="text-[9px] text-amber-400 flex items-center gap-0.5">
                    <Shield className="w-2.5 h-2.5" /> Admin
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-card/60 flex-shrink-0">
          {viewMode === "channel" && activeChannel && (
            <>
              <span style={{ color: activeChannel.color }}>{channelIcon(activeChannel.name)}</span>
              <span className="text-sm font-semibold text-foreground">{activeChannel.name}</span>
              {activeChannel.description && (
                <>
                  <span className="text-border/60 select-none">|</span>
                  <span className="text-xs text-muted-foreground truncate">{activeChannel.description}</span>
                </>
              )}
              <div className="ml-auto flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-muted-foreground/50" />
                <span className="text-[11px] text-muted-foreground/50">{messages.length} mesaj</span>
              </div>
            </>
          )}
          {viewMode === "dm" && dmPeerId && (
            <>
              <Mail className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">{dmPeerName}</span>
              <span className="text-xs text-muted-foreground">ile özel mesaj</span>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground/50">{dmMessages.length} mesaj</span>
              </div>
            </>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="py-2 space-y-0.5">
            {viewMode === "channel" && messages.length === 0 && localLines.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Hash className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">#{activeChannel?.name} kanalına hoş geldiniz!</p>
                <p className="text-xs text-muted-foreground/60 mt-1">İlk mesajı siz gönderin.</p>
                <p className="text-xs text-muted-foreground/40 mt-3">
                  Komutlar için <span className="font-mono text-primary/60">!yardim</span> yazın
                </p>
              </div>
            )}
            {viewMode === "dm" && dmMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Mail className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">{dmPeerName} ile konuşma başlat</p>
                <p className="text-xs text-muted-foreground/60 mt-1">İlk mesajı siz gönderin.</p>
              </div>
            )}
            {viewMode === "channel" ? renderChannelMessages() : renderDmMessages()}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input bar */}
        <div className="px-4 py-3 border-t border-border/40 bg-card/40 flex-shrink-0">
          <div className="flex items-center gap-2 bg-muted/40 border border-border/60 rounded-xl px-3 py-2 focus-within:border-primary/40 focus-within:bg-muted/60 transition-all">
            <span className="text-muted-foreground/50 flex-shrink-0">
              {viewMode === "channel"
                ? (activeChannel ? channelIcon(activeChannel.name) : <Hash className="w-3.5 h-3.5" />)
                : <Mail className="w-3.5 h-3.5 text-primary/60" />
              }
            </span>
            <Input
              placeholder={
                viewMode === "channel"
                  ? `#${activeChannel?.name ?? "kanal"} kanalına mesaj yaz... (!yardim için komutlar)`
                  : `${dmPeerName} kullanıcısına mesaj yaz...`
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              className="flex-1 border-0 bg-transparent p-0 h-auto focus-visible:ring-0 text-sm placeholder:text-muted-foreground/40"
              disabled={!user || sending || (viewMode === "channel" ? !activeChannelId : !dmPeerId)}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={sendMessage}
              disabled={!input.trim() || !user || sending || (viewMode === "channel" ? !activeChannelId : !dmPeerId)}
              className="w-7 h-7 flex-shrink-0 hover:bg-primary/20 hover:text-primary"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/40 mt-1.5 px-1">
            {viewMode === "channel"
              ? <>Son 30 günlük mesajlar saklanır • <span className="font-mono">!yardim</span> ile komutları görüntüle</>
              : "Özel mesajlar sadece sizin ve karşı tarafın görebildiği güvenli bir alandır"
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default GlobalChatBox;
