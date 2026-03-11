import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Hash, Send, Trash2, Shield, AlertCircle, Info,
  ChevronRight, Users, Megaphone, Wrench, Scissors, MessageSquare
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

  // ── Load messages for active channel ──────────────────────────────────────
  const loadMessages = useCallback(async () => {
    if (!activeChannelId) return;
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("channel_id", activeChannelId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(200);
    if (data) setMessages(data as ChatMessage[]);
  }, [activeChannelId]);

  useEffect(() => {
    loadMessages();
    setLocalLines([]);
  }, [loadMessages]);

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("chat_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, loadMessages)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadMessages]);

  // ── Auto scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, localLines]);

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

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || !user || !activeChannelId) return;

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
  };

  const deleteMessage = async (id: string) => {
    await supabase.from("chat_messages").update({ is_deleted: true, deleted_by: user!.id } as any).eq("id", id);
  };

  // ── Render messages with date dividers ────────────────────────────────────
  const renderMessages = () => {
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

      // Check if same sender as previous (for grouped messages)
      const prevMsg = messages[i - 1];
      const isGrouped =
        prevMsg &&
        prevMsg.user_id === msg.user_id &&
        new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 5 * 60 * 1000;

      items.push(
        <div key={msg.id} className={`group flex gap-3 px-3 py-0.5 hover:bg-muted/20 rounded-lg transition-colors ${!isGrouped ? "mt-3" : ""}`}>
          {/* Avatar column */}
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

          {/* Content column */}
          <div className="flex-1 min-w-0">
            {!isGrouped && (
              <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                <span
                  className="text-sm font-semibold leading-none"
                  style={{ color: msg.title_color ?? "hsl(var(--foreground))" }}
                >
                  {msg.display_name ?? "Kullanıcı"}
                </span>
                {msg.title && (
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-md leading-none"
                    style={{
                      background: `${msg.title_color ?? "#6366f1"}18`,
                      color: msg.title_color ?? "#6366f1",
                      border: `1px solid ${msg.title_color ?? "#6366f1"}30`,
                    }}
                  >
                    {msg.title}
                  </span>
                )}
                {isMe && (
                  <Shield className="w-3 h-3 text-muted-foreground/40" />
                )}
                <span className="text-[10px] text-muted-foreground/50 leading-none">
                  {formatTime(msg.created_at)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <p className="text-sm text-foreground/90 leading-relaxed break-words min-w-0 flex-1">
                {msg.content}
              </p>
              {canDelete && (
                <button
                  onClick={() => deleteMessage(msg.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex-shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      );
    });

    // Local system lines
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

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  return (
    <div className="flex rounded-xl overflow-hidden border border-border/60 bg-card/80 backdrop-blur-sm"
      style={{ minHeight: 600, height: "min(900px, calc(100vh - 280px))" }}>

      {/* ── Sidebar ── */}
      <div className="w-48 flex-shrink-0 bg-muted/20 border-r border-border/40 flex flex-col">
        {/* Server header */}
        <div className="px-3 py-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center">
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-xs font-bold text-foreground">GAGE Chat</span>
          </div>
        </div>

        {/* Channels section */}
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-3 py-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
              Kanallar
            </span>
          </div>
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setActiveChannelId(ch.id)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-all duration-150 rounded-md mx-1 ${
                activeChannelId === ch.id
                  ? "bg-primary/15 text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
              style={activeChannelId === ch.id ? { color: ch.color } : {}}
            >
              <span style={{ color: activeChannelId === ch.id ? ch.color : undefined }}>
                {channelIcon(ch.name)}
              </span>
              <span className="truncate">{ch.name}</span>
              {activeChannelId === ch.id && (
                <ChevronRight className="w-3 h-3 ml-auto flex-shrink-0" />
              )}
            </button>
          ))}
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
        {/* Channel header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-card/60 flex-shrink-0">
          {activeChannel && (
            <>
              <span style={{ color: activeChannel.color }}>
                {channelIcon(activeChannel.name)}
              </span>
              <span className="text-sm font-semibold text-foreground">{activeChannel.name}</span>
              {activeChannel.description && (
                <>
                  <span className="text-border/60 select-none">|</span>
                  <span className="text-xs text-muted-foreground truncate">{activeChannel.description}</span>
                </>
              )}
            </>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-muted-foreground/50" />
            <span className="text-[11px] text-muted-foreground/50">{messages.length} mesaj</span>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="py-2 space-y-0.5">
            {messages.length === 0 && localLines.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Hash className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">#{activeChannel?.name} kanalına hoş geldiniz!</p>
                <p className="text-xs text-muted-foreground/60 mt-1">İlk mesajı siz gönderin.</p>
                <p className="text-xs text-muted-foreground/40 mt-3">
                  Komutlar için <span className="font-mono text-primary/60">!yardim</span> yazın
                </p>
              </div>
            )}
            {renderMessages()}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input bar */}
        <div className="px-4 py-3 border-t border-border/40 bg-card/40 flex-shrink-0">
          <div className="flex items-center gap-2 bg-muted/40 border border-border/60 rounded-xl px-3 py-2 focus-within:border-primary/40 focus-within:bg-muted/60 transition-all">
            <span className="text-muted-foreground/50 flex-shrink-0">
              {activeChannel ? channelIcon(activeChannel.name) : <Hash className="w-3.5 h-3.5" />}
            </span>
            <Input
              placeholder={`#${activeChannel?.name ?? "kanal"} kanalına mesaj yaz... (!yardim için komutlar)`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              className="flex-1 border-0 bg-transparent p-0 h-auto focus-visible:ring-0 text-sm placeholder:text-muted-foreground/40"
              disabled={!user || sending || !activeChannelId}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={sendMessage}
              disabled={!input.trim() || !user || sending || !activeChannelId}
              className="w-7 h-7 flex-shrink-0 hover:bg-primary/20 hover:text-primary"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/40 mt-1.5 px-1">
            Son 30 günlük mesajlar saklanır • <span className="font-mono">!yardim</span> ile komutları görüntüle
          </p>
        </div>
      </div>
    </div>
  );
};

export default GlobalChatBox;
