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

    const systemPrompt = `Sen 20+ yil deneyimli uzman bir CNC makine muhendisisin. Teknik resimleri analiz edip gercekci isleme plani olusturuyorsun.

OLCU OKUMA:
- Resimdeki TUM kritik olculeri, toleranslari ve yuzey puruzluluk isaretlerini dikkatlice oku.
- Olculeri mm cinsinden belirt.

SURE HESAPLAMA (FORMUL TABANLI - ZORUNLU):
Her islem icin asagidaki adimlari SIRAYLA uygula:

1. Devir hesapla: n = (1000 × Vc) / (π × D)
   - Vc: Malzeme ve takima uygun kesme hizi (m/dk)
   - D: Islenecek cap veya takim capi (mm)

2. Isleme suresi hesapla: T = L / (n × f)
   - L: Isleme uzunlugu (mm) - resimden oku
   - f: Ilerleme (mm/dev torna icin, mm/dis × dis sayisi freze icin)

3. Coklu paso varsa: Toplam sure = T × paso sayisi
   - Paso sayisi = Toplam talaş derinliği / paso başına ap

MALZEME BAZLI KESME HIZI REFERANSLARI (karbur takim):
- Celik (St37, S235): Vc = 200-280 m/dk, f = 0.2-0.35 mm/dev
- Celik (C45, 4140): Vc = 150-220 m/dk, f = 0.15-0.3 mm/dev  
- Paslanmaz celik: Vc = 120-180 m/dk, f = 0.1-0.25 mm/dev
- Aluminyum: Vc = 400-800 m/dk, f = 0.2-0.5 mm/dev
- Dokme demir: Vc = 100-200 m/dk, f = 0.15-0.3 mm/dev

ISLEM TIPLERI VE TIPIK SURELER (referans - formul sonucu bunlara yakin olmali):
- Alın tornalama: genelde 0.1-0.5 dk
- Kaba tornalama (kisa paso): 0.3-2 dk/paso
- Ince tornalama: 0.2-1 dk
- Delme (kisa delik): 0.1-0.5 dk, derin delik: 0.5-2 dk
- Dis acma: 0.3-1.5 dk
- Kanal / pah: 0.1-0.5 dk
- Frezeleme (kucuk yuzey): 0.5-3 dk

ONEMLI KURALLAR:
- Her adimda formulu UYGULA, sonucu yaz. Tahmin yapma.
- Modern CNC tezgahlar hizlidir; sonuclarin bunu yansitmasi gerekir.
- Hazirlik suresi: Basit 5-10 dk, orta 10-20 dk, karmasik 20-30 dk.

Verilen teknik resmi analiz et ve asagidaki JSON formatinda dondur:

{
  "partName": "Parca adi",
  "material": "Onerilen malzeme",
  "overallDimensions": "Genel boyutlar (mm)",
  "complexity": "Dusuk/Orta/Yuksek/Cok Yuksek",
  "operations": [
    {
      "step": 1,
      "operation": "Islem adi",
      "machine": "Tezgah tipi",
      "tool": "Takim",
      "cuttingSpeed": "Vc (m/dk)",
      "feedRate": "f (mm/dev veya mm/dis)",
      "depthOfCut": "ap (mm)",
      "estimatedTime": "Hesaplanan sure (dk) - FORMUL SONUCU",
      "notes": "Hesaplama detayi: n=..., T=L/(n×f)=..."
    }
  ],
  "totalEstimatedTime": "Toplam isleme suresi (dk)",
  "setupTime": "Hazirlik suresi (dk)",
  "recommendations": ["Oneri 1", "Oneri 2"],
  "tolerances": "Toleranslar",
  "surfaceFinish": "Yuzey kalitesi (Ra degerleri)",
  "machinesRequired": ["Tezgah listesi"],
  "difficultyNotes": "Zorluk notlari"
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
