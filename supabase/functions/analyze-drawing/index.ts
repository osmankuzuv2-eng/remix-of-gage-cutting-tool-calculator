import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const systemPrompt = `Sen uzman bir CNC makine mühendisisin. Teknik resimleri analiz edip detaylı işleme planı oluşturuyorsun.

Verilen teknik resmi analiz et ve aşağıdaki bilgileri JSON formatında döndür:

{
  "partName": "Parça adı (tahmini)",
  "material": "Önerilen malzeme",
  "overallDimensions": "Genel boyutlar (mm)",
  "complexity": "Düşük/Orta/Yüksek/Çok Yüksek",
  "operations": [
    {
      "step": 1,
      "operation": "İşlem adı (örn: Kaba Tornalama, İnce Frezeleme, Delme, vb.)",
      "machine": "Önerilen tezgah tipi (CNC Torna, CNC Freze, 5 Eksen, Taşlama, vb.)",
      "tool": "Kullanılacak takım",
      "cuttingSpeed": "Kesme hızı (m/dk)",
      "feedRate": "İlerleme (mm/dev veya mm/diş)",
      "depthOfCut": "Talaş derinliği (mm)",
      "estimatedTime": "Tahmini süre (dakika)",
      "notes": "Özel notlar"
    }
  ],
  "totalEstimatedTime": "Toplam tahmini süre (dakika)",
  "setupTime": "Hazırlık süresi (dakika)",
  "recommendations": ["Öneri 1", "Öneri 2"],
  "tolerances": "Tespit edilen toleranslar",
  "surfaceFinish": "Yüzey kalitesi gereksinimleri",
  "machinesRequired": ["Gereken tezgahlar listesi"],
  "difficultyNotes": "Zorluk ve dikkat edilmesi gerekenler"
}

Sadece JSON döndür, başka metin ekleme.`;

    const userMessage = additionalInfo 
      ? `Bu teknik resmi analiz et. Ek bilgiler: ${additionalInfo}`
      : "Bu teknik resmi analiz et ve detaylı işleme planı oluştur.";

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
              { type: "image_url", image_url: { url: imageUrl } },
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
      throw new Error("Could not parse AI response as JSON");
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
