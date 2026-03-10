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

Amacın: Teknik resim üzerindeki her önemli PARÇA ÖZELLİĞİNE (delik, yüzey, ölçü, tolerans, diş, kanal, pah, yarıçap, vb.) bir balon numarası atamak.
Her balon için İKİ koordinat vereceksin:
  - (x, y): Balonun kendi merkezi — PARÇANIN DIŞINDA veya BOŞLUKTA bir yerde
  - (tx, ty): Ok ucunun göstereceği hedef nokta — ilgili özelliğin tam üzeri (PARÇA ÜZERİNDE)

BALON EKLENMEYECEK ŞEYLER (bunları kesinlikle numaralandırma):
- Kesit sembolleri: A-A, B-B, C-C gibi kesit çizgisi etiketleri
- Görünüm etiketleri: "GÖRÜNÜŞ A", "VIEW B", "SECTION A-A" gibi yazılar
- Ok yönleri ve kesit alma işaretleri (iki yönlü oklu kesit çizgileri)
- Ölçek bilgisi: "1:2", "SCALE 1:1" gibi yazılar
- Başlık bloğu, çizim numarası, malzeme notu gibi tablodaki metinler
- Yalnızca yazı/metin olan alanlar; parça geometrisini göstermeyen her şey

BALON EKLENECEK ŞEYLER (sadece bunları numaralandır):
- Delikler, pimler, civata delikleri (çap, tolerans, konum)
- Diş profilleri (M serisi, UN serisi vb.)
- Kanallar, oluklar, yuva açıklıkları
- Pahlar (chamfer) ve radyuslar (fillet)
- Kritik yüzey pürüzlülük bölgeleri
- Toleranslı boyutların bağlandığı parça yüzeyleri
- Form ve konum toleransları (GD&T sembolleri) olan yüzeyler

KONUM KURALI:
- Tüm değerler resmin SOL-ÜST köşesinden başlayan YÜZDE (0-100) değerleridir
- x=0 sol kenar, x=100 sağ kenar; y=0 üst kenar, y=100 alt kenar
- BALON (x,y): Parça dışında, boş bir alana yerleştir. Ölçü yazılarının, diğer balonların üzerine gelmesin.
- OK UCU (tx,ty): İlgili özelliğin tam üzeri veya en yakın noktası
- Balon ile ok ucu arası mesafe en az 5% olsun (bağlantı çizgisi görünür olsun)
- Balonlar birbirine en az 8% mesafe uzakta olsun
- Resmin kenarlarına 4%'ten yakın yerleştirme

BALON SAYISI:
- Minimum 5, maksimum 20 balon
- Her önemli özellik için bir balon
- Tekrarlayan benzer özellikler için bir balon yeterli (örneğin 4 aynı delik → 1 balon)

JSON formatında döndür:
{
  "balloons": [
    {
      "number": 1,
      "x": 12.5,
      "y": 8.0,
      "tx": 35.4,
      "ty": 42.1,
      "label": "Özellik adı ve kısa açıklama (ölçü, tolerans varsa belirt)"
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
