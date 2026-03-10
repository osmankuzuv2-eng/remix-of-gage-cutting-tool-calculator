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

    const langInstructions =
      language === "en"
        ? "Respond in ENGLISH."
        : language === "fr"
        ? "Répondez en FRANÇAIS."
        : "Türkçe yanıt ver.";

    const systemPrompt = `Sen deneyimli bir talaşlı imalat mühendisi ve teklif uzmanısın. Teknik resmi analiz edip üretim teklifi için gerekli tüm bilgileri çıkartacaksın.
${langInstructions}

## ÇIKAR

1. **Parça bilgileri**: İsim, malzeme (varsa standart kodu ile), genel boyutlar, tahmini ağırlık
2. **Toleranslar & yüzey kalitesi**: En sıkı tolerans sınıfı, Ra değerleri
3. **İmalat operasyonları**: Her adım için operasyon tipi, makine tipi, tahmini süre (dakika), açıklama
4. **Özellikler**: Delik sayısı/boyutu, diş boyutu, kanal, cep, pah vb.
5. **Bağlama/setup**: Kaç kez bağlama gerekiyor, toplam setup süresi (dakika)
6. **Notlar**: Özel işlemler, sertifika gereksinimleri, kritik noktalar

## MAKİNE TİPLERİ
Sadece şunları kullan: "Freze", "Torna", "Taşlama", "Delme", "Tel Erozyon", "5 Eksen"

## MALZEME TAHMİNİ
Çizimde belirtilmemişse parça geometrisine ve yüzey kalitesine göre tahmin et.
Ağırlık hesabında malzeme yoğunluklarını kullan: Çelik=7.85 g/cm³, Al=2.7 g/cm³, Paslanmaz=8.0 g/cm³

## SÜRE TAHMİNİ
Gerçekçi imalat süresi tahmin et. Küçük parça (50mm altı): 5-30 dk/op. Orta parça: 15-60 dk/op. Büyük parça: 30-180 dk/op.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "extract_quote_data",
          description: "Teknik resimden teklif için gerekli yapısal bilgileri çıkarır",
          parameters: {
            type: "object",
            properties: {
              part_name: {
                type: "string",
                description: "Parça adı veya kodu (çizimden veya tahmini)",
              },
              material: {
                type: "string",
                description: "Malzeme (örn: EN AW-6082 T6, S235, AISI 304)",
              },
              material_category: {
                type: "string",
                enum: ["Alüminyum", "Çelik", "Paslanmaz Çelik", "Dökme Demir", "Titanyum", "Bakır/Pirinç", "Plastik", "Diğer"],
              },
              dimensions: {
                type: "object",
                properties: {
                  length_mm: { type: "number" },
                  width_mm: { type: "number" },
                  height_mm: { type: "number" },
                },
                required: ["length_mm", "width_mm", "height_mm"],
              },
              estimated_weight_kg: { type: "number" },
              tightest_tolerance: {
                type: "string",
                description: "En sıkı tolerans (örn: ±0.01, H7, IT6)",
              },
              surface_finish: {
                type: "string",
                description: "Yüzey pürüzlülüğü (örn: Ra 0.8, Ra 1.6)",
              },
              features: {
                type: "array",
                items: { type: "string" },
                description: "Parça özellikleri listesi (örn: M8x1.25 delik x4, Ø25H7 kanal, 45° pah)",
              },
              operations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    step: { type: "number" },
                    name: { type: "string", description: "Operasyon adı" },
                    machine_type: {
                      type: "string",
                      enum: ["Freze", "Torna", "Taşlama", "Delme", "Tel Erozyon", "5 Eksen"],
                    },
                    estimated_time_min: { type: "number" },
                    description: { type: "string" },
                  },
                  required: ["step", "name", "machine_type", "estimated_time_min", "description"],
                },
              },
              setup_count: { type: "number", description: "Toplam bağlama sayısı" },
              setup_time_min: { type: "number", description: "Toplam setup süresi (dakika)" },
              complexity: {
                type: "string",
                enum: ["Basit", "Orta", "Karmaşık", "Çok Karmaşık"],
              },
              notes: { type: "string" },
            },
            required: [
              "part_name", "material", "material_category", "dimensions",
              "estimated_weight_kg", "operations", "setup_time_min", "complexity",
            ],
            additionalProperties: false,
          },
        },
      },
    ];

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
          tools,
          tool_choice: { type: "function", function: { name: "extract_quote_data" } },
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
                  text: "Bu teknik resmi analiz et ve teklif için gerekli tüm bilgileri çıkar. Süre tahminlerini gerçekçi yap.",
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
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("AI did not return structured data");
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("catpart-quote-analyze error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
