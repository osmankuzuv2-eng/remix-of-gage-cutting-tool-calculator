import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType = "image/jpeg", language = "tr" } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const langNote = language === "en"
      ? "Respond in ENGLISH."
      : language === "fr"
      ? "Répondez en FRANÇAIS."
      : "Türkçe yanıt ver.";

    const systemPrompt = `Sen deneyimli bir kalite mühendisisin. Teknik resmi inceleyip parça özelliklerini balonlayacaksın.
${langNote}

## ADIM 1 — ÖZELLİKLERİ BUL
Aşağıdaki parça geometrilerini tespit et:
- Delikler (çap, konum toleransı olan)
- Diş delikleri (M4, M6, M8 vb.)
- Kanallar, oluklar, cepler
- Pahlar (chamfer) ve radyuslar (fillet/köşe)
- Toleranslı yüzeyler, GD&T frame'leri
- Kritik yüzey pürüzlülük sembolleri

## ADIM 2 — OK UCUNU (tx, ty) BELİRLE
Her özellik için:
- tx, ty = özelliğin KENDİ geometrik merkezi veya kenar noktası (parça çizgisi üzeri)
- Boş alana, ölçü yazısına, kesit sembolüne (A-A, B-B) veya görünüm etiketine (VIEW, SECTION) DOKUNMA

## ADIM 3 — BALONU (x, y) YERLEŞTİR
Balon merkezi (x, y), ok ucunun (tx, ty) hemen yanına konur — maksimum 6% uzakta:
- sqrt((x−tx)² + (y−ty)²) ≤ 6  ← BU KURALI MUTLAKA UY
- Yön seçimi: ok ucunun en yakın BOŞ yönüne 4-6% kaydır
- Öncelik sırası: üst boşluk > sağ boşluk > sol boşluk > alt boşluk
- Başka bir balonun veya ölçü yazısının üzerine GELME
- Balonlar arası min. 6% mesafe bırak

## YASAK
- A-A, B-B gibi kesit etiketlerine balon ekleme
- VIEW, SECTION, SCALE gibi notlara balon ekleme  
- Başlık bloğu, revizyon tablosu, boş alana balon ekleme
- 6%'dan uzun ok çizgisi

## BALON SAYISI
Minimum 4, maksimum 12. Aynı tip tekrar eden özellik için tek balon yeter.

## ÇIKTI FORMAT (sadece JSON, başka metin yok)
{
  "balloons": [
    { "number": 1, "tx": 38.5, "ty": 42.0, "x": 38.5, "y": 36.8, "label": "Özellik adı (ölçü/tolerans)" }
  ]
}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          temperature: 0,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: `data:${mimeType};base64,${imageBase64}` },
                },
                {
                  type: "text",
                  text: "Teknik resmi analiz et. ADIM 1→2→3 sırasıyla ilerle. Sadece JSON döndür.",
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AI did not return valid JSON");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("auto-balloon-drawing error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
