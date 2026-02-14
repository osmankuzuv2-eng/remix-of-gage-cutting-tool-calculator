import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import {
  BotMessageSquare,
  Send,
  Loader2,
  Sparkles,
  Trash2,
  Lightbulb,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cnc-ai-chat`;

const quickQuestions = [
  "CNC'de kesme hızı nasıl hesaplanır?",
  "Titanyum işlemede hangi takım kaplaması tercih edilir?",
  "IT7 tolerans sınıfı hangi işlemlerde kullanılır?",
  "M10 diş için ön delme çapı kaç mm olmalı?",
  "Paslanmaz çelikte soğutma sıvısı nasıl seçilir?",
  "Takım ömrünü etkileyen faktörler nelerdir?",
];

async function streamChat({
  messages,
  onDelta,
  onDone,
  onError,
}: {
  messages: Msg[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!resp.ok) {
    if (resp.status === 429) { onError("Çok fazla istek, lütfen biraz bekleyin."); return; }
    if (resp.status === 402) { onError("AI kredisi tükendi."); return; }
    const body = await resp.json().catch(() => null);
    onError(body?.error || "Bir hata oluştu.");
    return;
  }

  if (!resp.body) { onError("Stream başlatılamadı."); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let done = false;

  while (!done) {
    const { done: rd, value } = await reader.read();
    if (rd) break;
    buf += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { done = true; break; }
      try {
        const parsed = JSON.parse(json);
        const c = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (c) onDelta(c);
      } catch {
        buf = line + "\n" + buf;
        break;
      }
    }
  }

  // flush
  if (buf.trim()) {
    for (let raw of buf.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (!raw.startsWith("data: ")) continue;
      const json = raw.slice(6).trim();
      if (json === "[DONE]") continue;
      try {
        const c = JSON.parse(json).choices?.[0]?.delta?.content;
        if (c) onDelta(c);
      } catch { /* skip */ }
    }
  }

  onDone();
}

const AILearningModule = () => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      const userMsg: Msg = { role: "user", content: text.trim() };
      const allMsgs = [...messages, userMsg];
      setMessages(allMsgs);
      setInput("");
      setIsLoading(true);

      let soFar = "";
      const upsert = (chunk: string) => {
        soFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: soFar } : m
            );
          }
          return [...prev, { role: "assistant", content: soFar }];
        });
      };

      try {
        await streamChat({
          messages: allMsgs,
          onDelta: upsert,
          onDone: () => setIsLoading(false),
          onError: (msg) => {
            toast({ title: "Hata", description: msg, variant: "destructive" });
            setIsLoading(false);
          },
        });
      } catch {
        toast({ title: "Hata", description: "Bağlantı hatası.", variant: "destructive" });
        setIsLoading(false);
      }
    },
    [messages, isLoading]
  );

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BotMessageSquare className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                GAGE AI Asistan
                <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                  <Sparkles className="w-3 h-3 mr-1" /> Yapay Zeka
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground">
                CNC talaşlı imalat hakkında her şeyi sorabilirsiniz
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMessages([])}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Temizle
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Chat area */}
      <Card className="border-border bg-card overflow-hidden">
        <ScrollArea className="h-[500px] p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <EmptyState onSelect={send} />
          ) : (
            <div className="space-y-4">
              {messages.map((m, i) => (
                <ChatBubble key={i} msg={m} />
              ))}
              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Düşünüyor...
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="p-3 border-t border-border bg-secondary/20">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder="Sorunuzu yazın... (ör: Alüminyum frezelemede kesme hızı nedir?)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={isLoading}
              className="bg-background border-border"
            />
            <Button
              onClick={() => send(input)}
              disabled={!input.trim() || isLoading}
              className="shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

/* ── Empty state with quick questions ── */
function EmptyState({ onSelect }: { onSelect: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <div className="p-4 rounded-full bg-primary/10 mb-4">
        <BotMessageSquare className="w-10 h-10 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">GAGE AI Asistana Hoş Geldiniz</h3>
      <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
        CNC talaşlı imalat, kesme parametreleri, takım seçimi, toleranslar ve daha fazlası hakkında sorular sorabilirsiniz.
      </p>
      <div className="w-full max-w-lg space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Lightbulb className="w-3.5 h-3.5" />
          Hızlı sorular:
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {quickQuestions.map((q) => (
            <button
              key={q}
              onClick={() => onSelect(q)}
              className="text-left text-sm p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 hover:border-primary/40 transition-all text-foreground"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Chat bubble ── */
function ChatBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-secondary/50 border border-border text-foreground rounded-bl-md"
        }`}
      >
        {isUser ? (
          <p>{msg.content}</p>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none [&_pre]:bg-background/50 [&_pre]:border [&_pre]:border-border [&_pre]:rounded-lg [&_code]:text-primary [&_table]:text-xs [&_th]:text-muted-foreground [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_h4]:text-foreground [&_p]:text-foreground [&_li]:text-foreground [&_strong]:text-foreground [&_a]:text-primary">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

export default AILearningModule;
