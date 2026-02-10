import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, fileName, additionalInfo } = await req.json();

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "imageUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      console.error("LOVABLE_API_KEY not configured");
      throw new Error("Server configuration error");
    }

    // Determine if file is PDF based on URL or fileName
    const isPdf = imageUrl.toLowerCase().endsWith(".pdf") || fileName?.toLowerCase().endsWith(".pdf");

    // Download the file and convert to base64 data URL
    // This is required because the AI gateway doesn't support PDF URLs directly
    const fileResponse = await fetch(imageUrl);
    if (!fileResponse.ok) {
      throw new Error(`Dosya indirilemedi: ${fileResponse.status}`);
    }
    const fileBytes = new Uint8Array(await fileResponse.arrayBuffer());
    const base64Data = base64Encode(fileBytes);
    
    const mimeType = isPdf ? "application/pdf" : (
      imageUrl.toLowerCase().endsWith(".png") ? "image/png" :
      imageUrl.toLowerCase().endsWith(".webp") ? "image/webp" :
      imageUrl.toLowerCase().endsWith(".gif") ? "image/gif" :
      "image/jpeg"
    );
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    const systemPrompt = `Sen uzman bir CNC makine mühendisisin. Teknik resimleri analiz edip detaylı ve GERCEKCI isleme plani olusturuyorsun.

Resimdeki TUM kritik olculeri, toleranslari ve yuzey puruzluluk isaretlerini dikkatlice oku. Olculeri mm cinsinden belirt.

SURE HESAPLAMA KURALLARI (COK ONEMLI):
- Isleme suresi = Isleme uzunlugu / (Devir * Ilerleme) formulu ile hesapla
- Devir (n) = (1000 * Vc) / (PI * D) formulunu kullan
- Kaba tornalama: Tipik olarak kucuk parcalar icin 1-5 dk, orta parcalar 5-15 dk, buyuk parcalar 15-30 dk
- Ince tornalama: Kaba tornalamanin yaklasik %30-50'si kadar sure
- Delme islemi: Kucuk delikler 0.5-2 dk, buyuk delikler 2-5 dk
- Frezeleme: Yuzey alani ve talaş derinligine gore 2-15 dk
- Taslama: Toleransa gore 3-10 dk
- Dis acma: Genellikle 1-3 dk
- Hazirlik suresi: Basit parcalar 10-20 dk, orta 20-40 dk, karmasik 40-60 dk
- ABARTILI sureler VERME! Gercekci CNC atolye surelerini baz al.
- Toplam isleme suresi basit parcalar icin 10-30 dk, orta parcalar 30-90 dk, karmasik parcalar 90-180 dk araliginda olmalidir.

Verilen teknik resmi analiz et ve asagidaki bilgileri JSON formatinda dondur:

{
  "partName": "Parca adi (tahmini)",
  "material": "Onerilen malzeme",
  "overallDimensions": "Genel boyutlar (mm) - resimdeki olculerden oku",
  "complexity": "Dusuk/Orta/Yuksek/Cok Yuksek",
  "operations": [
    {
      "step": 1,
      "operation": "Islem adi (orn: Kaba Tornalama, Ince Frezeleme, Delme, vb.)",
      "machine": "Onerilen tezgah tipi (CNC Torna, CNC Freze, 5 Eksen, Taslama, vb.)",
      "tool": "Kullanilacak takim",
      "cuttingSpeed": "Kesme hizi (m/dk) - malzemeye uygun gercekci deger",
      "feedRate": "Ilerleme (mm/dev veya mm/dis) - gercekci deger",
      "depthOfCut": "Talas derinligi (mm)",
      "estimatedTime": "Tahmini sure (dakika) - FORMUL ILE HESAPLA, abartma",
      "notes": "Ozel notlar"
    }
  ],
  "totalEstimatedTime": "Toplam tahmini sure (dakika) - tum adimlarin toplami",
  "setupTime": "Hazirlik suresi (dakika)",
  "recommendations": ["Oneri 1", "Oneri 2"],
  "tolerances": "Tespit edilen toleranslar - resimdeki tolerans isaretlerini oku",
  "surfaceFinish": "Yuzey kalitesi gereksinimleri - Ra degerlerini belirt",
  "machinesRequired": ["Gereken tezgahlar listesi"],
  "difficultyNotes": "Zorluk ve dikkat edilmesi gerekenler"
}

Sadece JSON dondur, baska metin ekleme.`;

    const userMessage = additionalInfo 
      ? `Bu teknik resmi analiz et. Tüm kritik ölçüleri ve toleransları dikkatlice oku. Ek bilgiler: ${additionalInfo}`
      : "Bu teknik resmi analiz et. Tüm kritik ölçüleri, toleransları ve yüzey pürüzlülük değerlerini dikkatlice oku ve detaylı işleme planı oluştur.";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userMessage },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Çok fazla istek gönderildi, lütfen biraz bekleyin." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Kredi limiti aşıldı." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI analiz hatası (${response.status}): ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Could not parse response:", content.substring(0, 500));
      throw new Error("AI yanıtı işlenemedi");
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
