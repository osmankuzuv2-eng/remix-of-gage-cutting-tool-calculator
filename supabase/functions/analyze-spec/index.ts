import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: "Dosya bulunamadı" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileName = file.name.toLowerCase();
    const allowedExtensions = [".pdf", ".doc", ".docx"];
    const hasValidExt = allowedExtensions.some((ext) => fileName.endsWith(ext));
    if (!hasValidExt) {
      return new Response(
        JSON.stringify({ error: "Sadece PDF ve Word (.doc, .docx) dosyaları desteklenir." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read file as base64
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64 = btoa(String.fromCharCode(...uint8Array));

    // Determine MIME type
    let mimeType = "application/pdf";
    if (fileName.endsWith(".doc")) mimeType = "application/msword";
    if (fileName.endsWith(".docx")) mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Use Gemini with document understanding
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Sen bir CNC üretim ve mühendislik uzmanısın. Sana verilen müşteri spec dokümanını analiz et ve aşağıdaki formatta özet bir metin oluştur. Bu metin, teknik resim analizi sırasında AI'ın müşteri gereksinimlerini anlaması için kullanılacak.

Çıktı formatı:
- Tolerans gereksinimleri
- Yüzey kalitesi beklentileri (Ra değerleri vb.)
- Malzeme gereksinimleri ve sertifikalar
- Isıl işlem gereksinimleri
- Kaplama gereksinimleri
- Kalite standartları (AS9100, ISO vb.)
- Muayene/test gereksinimleri
- Paketleme ve sevkiyat gereksinimleri
- Özel notlar ve kısıtlamalar

Sadece dokümanda bulunan bilgileri yaz. Olmayan bölümleri atlayabilirsin. Kısa, net ve teknik ol. Türkçe yaz.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Bu müşteri spec dokümanını (${file.name}) analiz et ve özet bir spec metni oluştur:`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "İstek limiti aşıldı, lütfen biraz bekleyin." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Kredi yetersiz, lütfen hesabınıza kredi ekleyin." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI analiz hatası" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const specText = aiData.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ specs: specText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-spec error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Bilinmeyen hata" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
