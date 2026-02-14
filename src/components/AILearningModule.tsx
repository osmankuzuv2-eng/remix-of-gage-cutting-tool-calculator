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
  ImagePlus,
  X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

/* ── Types ── */
type MsgContent = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;      // signed URL for display
  imagePreview?: string;   // local object URL for instant preview
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cnc-ai-chat`;

const quickQuestions = [
  "CNC'de kesme hızı nasıl hesaplanır?",
  "Titanyum işlemede hangi takım kaplaması tercih edilir?",
  "IT7 tolerans sınıfı hangi işlemlerde kullanılır?",
  "M10 diş için ön delme çapı kaç mm olmalı?",
  "Paslanmaz çelikte soğutma sıvısı nasıl seçilir?",
  "Takım ömrünü etkileyen faktörler nelerdir?",
];

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/tiff", "application/pdf"];
const ACCEPT_STRING = "image/jpeg,image/png,image/webp,image/gif,image/tiff,.tif,.tiff,application/pdf";
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

/* ── TIF → JPG converter ── */
async function convertTifToJpg(file: File): Promise<File> {
  const UTIF = await import("utif2");
  const buf = await file.arrayBuffer();
  const ifds = UTIF.decode(buf);
  if (!ifds.length) throw new Error("TIF dosyası okunamadı");
  UTIF.decodeImage(buf, ifds[0]);
  const rgba = UTIF.toRGBA8(ifds[0]);
  const w = ifds[0].width;
  const h = ifds[0].height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const imgData = ctx.createImageData(w, h);
  imgData.data.set(rgba);
  ctx.putImageData(imgData, 0, 0);
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.9));
  return new File([blob], file.name.replace(/\.tiff?$/i, ".jpg"), { type: "image/jpeg" });
}

/* ── PDF first page → JPG converter ── */
async function convertPdfToJpg(file: File): Promise<File> {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs`;
  const buf = await file.arrayBuffer();
  const pdf = await getDocument({ data: new Uint8Array(buf) }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.9));
  return new File([blob], file.name.replace(/\.pdf$/i, ".jpg"), { type: "image/jpeg" });
}

/* ── Upload helper ── */
async function uploadImage(file: File): Promise<string> {
  // Convert TIF/PDF to JPG before upload
  let processedFile = file;
  if (file.type === "image/tiff" || file.name.match(/\.tiff?$/i)) {
    processedFile = await convertTifToJpg(file);
  } else if (file.type === "application/pdf" || file.name.match(/\.pdf$/i)) {
    processedFile = await convertPdfToJpg(file);
  }

  const sanitized = processedFile.name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_");
  const path = `anonymous/ai-chat/${Date.now()}_${sanitized}`;

  const { error } = await supabase.storage
    .from("technical-drawings")
    .upload(path, processedFile, { contentType: processedFile.type, upsert: false });

  if (error) throw new Error(`Yükleme hatası: ${error.message}`);

  const { data: signedData, error: signError } = await supabase.storage
    .from("technical-drawings")
    .createSignedUrl(path, 3600);

  if (signError || !signedData?.signedUrl) throw new Error("URL oluşturulamadı");
  return signedData.signedUrl;
}

/* ── Stream helper ── */
async function streamChat({
  messages,
  onDelta,
  onDone,
  onError,
}: {
  messages: MsgContent[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  // Build payload: include imageUrl alongside content for multimodal
  const payload = messages.map((m) => {
    const obj: any = { role: m.role, content: m.content };
    if (m.imageUrl) obj.imageUrl = m.imageUrl;
    return obj;
  });

  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages: payload }),
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

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */

const AILearningModule = () => {
  const [messages, setMessages] = useState<MsgContent[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Cleanup object URL on unmount / change
  useEffect(() => {
    return () => {
      if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    };
  }, [pendingImage]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // reset

    const isTif = file.name.match(/\.tiff?$/i);
    const isPdf = file.name.match(/\.pdf$/i);
    if (!ACCEPTED_TYPES.includes(file.type) && !isTif && !isPdf) {
      toast({ title: "Hata", description: "JPG, PNG, WebP, GIF, PDF ve TIF dosyaları desteklenir.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "Hata", description: "Dosya boyutu 20 MB'ı aşamaz.", variant: "destructive" });
      return;
    }

    if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    setPendingImage({ file, preview: URL.createObjectURL(file) });
  };

  const removePendingImage = () => {
    if (pendingImage) {
      URL.revokeObjectURL(pendingImage.preview);
      setPendingImage(null);
    }
  };

  const send = useCallback(
    async (text: string) => {
      if ((!text.trim() && !pendingImage) || isLoading) return;

      const userText = text.trim() || (pendingImage ? "Bu teknik resmi analiz et ve detaylı bilgi ver." : "");
      let imageUrl: string | undefined;
      let imagePreview: string | undefined;

      // Upload image if pending
      if (pendingImage) {
        setIsUploading(true);
        try {
          imageUrl = await uploadImage(pendingImage.file);
          imagePreview = pendingImage.preview;
        } catch (err: any) {
          toast({ title: "Yükleme Hatası", description: err.message, variant: "destructive" });
          setIsUploading(false);
          return;
        }
        setIsUploading(false);
        setPendingImage(null);
      }

      const userMsg: MsgContent = { role: "user", content: userText, imageUrl, imagePreview };
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
    [messages, isLoading, pendingImage]
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
                CNC talaşlı imalat hakkında sorular sorun veya teknik resim gönderin
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
                  {isUploading ? "Görsel yükleniyor..." : "Düşünüyor..."}
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Pending image preview */}
        {pendingImage && (
          <div className="px-3 pt-2 border-t border-border bg-secondary/10">
            <div className="relative inline-block">
              <img
                src={pendingImage.preview}
                alt="Yüklenecek görsel"
                className="h-20 w-auto rounded-lg border border-border object-cover"
              />
              <button
                onClick={removePendingImage}
                className="absolute -top-2 -right-2 p-0.5 rounded-full bg-destructive text-destructive-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 mb-1">{pendingImage.file.name}</p>
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-border bg-secondary/20">
          <div className="flex gap-2">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_STRING}
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="shrink-0 border-border"
              title="Teknik resim yükle"
            >
              <ImagePlus className="w-4 h-4" />
            </Button>
            <Input
              placeholder={pendingImage ? "Görsel hakkında soru yazın..." : "Sorunuzu yazın veya teknik resim yükleyin..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={isLoading}
              className="bg-background border-border"
            />
            <Button
              onClick={() => send(input)}
              disabled={(!input.trim() && !pendingImage) || isLoading}
              className="shrink-0"
            >
              {isLoading || isUploading ? (
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

/* ── Empty state ── */
function EmptyState({ onSelect }: { onSelect: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <div className="p-4 rounded-full bg-primary/10 mb-4">
        <BotMessageSquare className="w-10 h-10 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">GAGE AI Asistana Hoş Geldiniz</h3>
      <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
        CNC talaşlı imalat hakkında sorular sorabilir veya <strong className="text-foreground">teknik resim yükleyerek</strong> AI analizinden faydalanabilirsiniz.
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
        <div className="mt-4 p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 text-center">
          <ImagePlus className="w-5 h-5 mx-auto mb-1 text-primary" />
          <p className="text-xs text-muted-foreground">
            Sol alttaki <span className="text-primary font-medium">📷</span> butonuyla teknik resim yükleyebilirsiniz
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Chat bubble ── */
function ChatBubble({ msg }: { msg: MsgContent }) {
  const isUser = msg.role === "user";
  const displayImage = msg.imagePreview || msg.imageUrl;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-secondary/50 border border-border text-foreground rounded-bl-md"
        }`}
      >
        {/* Image thumbnail for user messages */}
        {isUser && displayImage && (
          <div className="mb-2">
            <img
              src={displayImage}
              alt="Yüklenen teknik resim"
              className="max-h-48 w-auto rounded-lg border border-primary-foreground/20 object-contain"
            />
          </div>
        )}
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
