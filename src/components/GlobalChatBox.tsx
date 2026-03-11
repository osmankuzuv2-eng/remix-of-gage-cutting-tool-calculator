import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface ChatMessage {
  id: string;
  user_id: string;
  display_name: string | null;
  title: string | null;
  title_color: string | null;
  content: string;
  created_at: string;
}

const GlobalChatBox = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [userProfile, setUserProfile] = useState<{ display_name: string | null; custom_title: string | null; title_color: string | null } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load user profile for title & color
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, custom_title, title_color")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setUserProfile(data);
      });
  }, [user]);

  // Load messages
  const loadMessages = async () => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(100);
    if (data) setMessages(data as ChatMessage[]);
  };

  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel("chat_messages_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        () => loadMessages()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !user) return;
    setSending(true);
    await supabase.from("chat_messages").insert({
      user_id: user.id,
      display_name: userProfile?.display_name ?? user.email ?? "Kullanıcı",
      title: userProfile?.custom_title ?? null,
      title_color: userProfile?.title_color ?? "#6366f1",
      content: input.trim(),
    } as any);
    setInput("");
    setSending(false);
  };

  const deleteMessage = async (id: string) => {
    await supabase.from("chat_messages").delete().eq("id", id);
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return format(d, "dd MMM yyyy HH:mm", { locale: tr });
  };

  return (
    <Card className="flex flex-col h-full border-border/60 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-primary" />
          </div>
          <span>Genel Sohbet</span>
          <span className="ml-auto text-xs text-muted-foreground font-normal">{messages.length} mesaj</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0 p-0 px-4 pb-4 gap-3">
        {/* Messages */}
        <ScrollArea className="flex-1 max-h-[920px] min-h-[400px]">
          <div className="space-y-3 pr-2 py-1">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Henüz mesaj yok. İlk mesajı siz gönderin!</p>
              </div>
            )}
            {messages.map((msg) => {
              const isMe = msg.user_id === user?.id;
              const initials = (msg.display_name ?? "?")
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 group ${isMe ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{
                      background: isMe
                        ? `${msg.title_color ?? "#6366f1"}22`
                        : "hsl(var(--muted))",
                      color: msg.title_color ?? "hsl(var(--foreground))",
                    }}
                  >
                    {initials}
                  </div>

                  {/* Bubble */}
                  <div className={`flex flex-col max-w-[70%] ${isMe ? "items-end" : "items-start"}`}>
                    {/* Name + Title + Time */}
                    <div className={`flex items-center gap-1.5 mb-0.5 flex-wrap ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                      <span className="text-xs font-semibold text-foreground">
                        {msg.display_name ?? "Kullanıcı"}
                      </span>
                      {msg.title && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{
                            background: `${msg.title_color ?? "#6366f1"}22`,
                            color: msg.title_color ?? "#6366f1",
                            border: `1px solid ${msg.title_color ?? "#6366f1"}44`,
                          }}
                        >
                          {msg.title}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground/60">{formatTime(msg.created_at)}</span>
                    </div>

                    {/* Message body */}
                    <div className="flex items-end gap-1">
                      <div
                        className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                          isMe
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-muted text-foreground rounded-tl-sm"
                        }`}
                      >
                        {msg.content}
                      </div>
                      {isMe && (
                        <button
                          onClick={() => deleteMessage(msg.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="flex gap-2 flex-shrink-0">
          <Input
            placeholder="Mesaj yaz..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            className="flex-1 bg-muted/30"
            disabled={!user || sending}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || !user || sending}
            className="flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default GlobalChatBox;
