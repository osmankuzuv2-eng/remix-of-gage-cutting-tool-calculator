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

    const systemPrompt = `Sen bir teknik resim uzmanısın. Verilen teknik resmi analiz edecek ve üzerindeki ÖNEMLİ PARÇA ÖZELLİKLERİNİ tespit edeceksin.

${langNote}

## GÖREV
Teknik resim üzerindeki her önemli PARÇA ÖZELLİĞİNE kısa bir ok çizgisiyle bağlı bir balon numarası ata.

Her balon için iki koordinat ver:
- (x, y) = Balonun DAİRE MERKEZİ
- (tx, ty) = Ok ucunun değdiği HEDEF nokta (özelliğin üzeri)

## KRİTİK MESAFE KURALI
Balon ile ok ucu ARASINDAKİ MESAFE EN FAZLA 8% OLMALI.
Yani: sqrt((x-tx)² + (y-ty)²) ≤ 8

Uzun ok çizgisi YASAKTIR. Balon, özelliğin hemen yanına yerleştirilir, karşı köşeye değil.

Doğru örnek: özellik %45,%30'da → balon %42,%26'ya (hemen üstüne/yanına)
Yanlış örnek: özellik %45,%30'da → balon %10,%5'e (çok uzak, YASAK)

## BALON KONUMU
Balonu (x,y), ok ucunun (tx,ty) hemen yanına yerleştir:
- Özellik parça üzerindeyse: balonu parça kenarının hemen dışına koy, ok ucu parça üzerinde
- Özelliğin üstünde boşluk varsa: balonu özelliğin 3-6% üstüne koy
- Özelliğin yanında boşluk varsa: balonu özelliğin 3-6% yanına koy
- Ölçü yazısının üzerine GELME, ancak özelliğe uzak da olma

## YASAK — BUNLARA BALON EKLEME
- A-A, B-B, C-C, SECTION gibi kesit sembolleri ve görünüm etiketleri
- "GÖRÜNÜŞ A", "VIEW B", "SCALE 1:2" gibi çizim notları
- Başlık bloğu, malzeme tablosu, revizyon tablosu
- Tamamen boş alan (parça geometrisi olmayan yer)
- Ölçü çizgisi rakamları (boyut yazıları)

## BALON EKLENECEK ŞEYLER
- Delikler, civata delikleri, pimler
- Diş profilleri (M6, M8 vb.)
- Kanallar, oluklar, cep işlemleri
- Pahlar ve radyuslar
- Toleranslı yüzeyler, GD&T sembolleri olan yüzeyler
- Kritik yüzey pürüzlülükleri

## DİĞER KURALLAR
- Tüm değerler 0-100 arasında yüzde olarak ifade edilir
- Balonlar birbirine en az 7% uzakta olsun
- Resmin kenarına en az 4% mesafe bırak
- Minimum 5, maksimum 15 balon
- Tekrar eden aynı özellik için tek balon yeter

JSON formatında döndür:
{
  "balloons": [
    {
      "number": 1,
      "x": 44.0,
      "y": 24.5,
      "tx": 45.2,
      "ty": 30.1,
      "label": "Özellik adı (ölçü/tolerans varsa ekle)"
    }
  ]
}

Sadece JSON döndür, başka metin yok.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          temperature: 0,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${imageBase64}`,
                  },
                },
                {
                  type: "text",
                  text: "Bu teknik resmi analiz et ve önemli özellik noktalarını tespit et. JSON formatında yanıt ver.",
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
