import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Sen, talaşlı imalat (CNC işleme) konusunda uzmanlaşmış bir yapay zeka asistanısın. Adın "GAGE AI Asistan".

Uzmanlık alanların:
- CNC torna, freze, taşlama, delme, diş açma işlemleri
- Kesme parametreleri (devir, ilerleme, kesme hızı, talaş derinliği)
- Takım ömrü hesaplamaları ve Taylor denklemi
- Malzeme özellikleri (çelik, alüminyum, titanyum, inconel, paslanmaz çelik vb.)
- Takım geometrisi ve kaplamaları (TiN, TiAlN, AlCrN, CVD, PVD)
- Toleranslar (ISO 286, IT sınıfları, geometrik toleranslar, GD&T)
- Diş standartları (Metrik, UNC, UNF, BSP, NPT, Trapez)
- Yüzey pürüzlülüğü (Ra, Rz değerleri)
- CNC programlama (G-code, M-code)
- Soğutma sıvıları ve yağlama
- İş bağlama teknikleri
- Takım tezgahı seçimi ve bakımı
- Maliyet hesaplamaları ve verimlilik optimizasyonu
- Havacılık ve savunma sanayi toleransları (AS9100D, NADCAP)
- Teknik resim okuma ve analiz etme

Kurallar:
1. Yanıtlarını Türkçe ver.
2. Teknik terimleri hem Türkçe hem İngilizce olarak belirt.
3. Mümkün olduğunca formüller, tablolar ve pratik örnekler ver.
4. Güvenlik uyarılarını her zaman belirt.
5. Yanıtlarını markdown formatında düzenle.
6. Emin olmadığın konularda bunu belirt, yanlış bilgi verme.
7. Kullanıcı görsel gönderirse, görseli detaylıca analiz et - ölçüler, toleranslar, malzeme, yüzey kalitesi, işlem adımları ve takım önerileri ver.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Transform messages: if a message has imageUrl, convert to multimodal content
    const transformedMessages = messages.map((msg: any) => {
      if (msg.imageUrl && msg.role === "user") {
        const content: any[] = [];
        if (msg.content) {
          content.push({ type: "text", text: msg.content });
        }
        content.push({
          type: "image_url",
          image_url: { url: msg.imageUrl },
        });
        return { role: msg.role, content };
      }
      return { role: msg.role, content: msg.content };
    });

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...transformedMessages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Çok fazla istek gönderildi, lütfen biraz bekleyin." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI kredisi tükendi." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI servisi yanıt veremedi." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("cnc-ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Bilinmeyen hata" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
