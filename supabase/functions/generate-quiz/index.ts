import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { level, language, topic } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const difficultyMap: Record<string, string> = {
      easy: "Kolay seviye - temel kavramlar, basit formüller, genel bilgi soruları",
      medium: "Orta seviye - parametre hesaplama, malzeme seçimi, tolerans bilgisi",
      hard: "Zor seviye - ileri düzey Taylor denklemi, karmaşık optimizasyon, standart detayları",
    };

    const langMap: Record<string, string> = {
      tr: "Türkçe",
      en: "İngilizce",
      fr: "Fransızca",
    };

    const difficulty = difficultyMap[level] || difficultyMap.easy;
    const lang = langMap[language] || "Türkçe";
    const topicHint = topic ? `Konu odağı: ${topic}. ` : "";

    const systemPrompt = `Sen bir talaşlı imalat ve CNC uzmanısın. ${lang} dilinde quiz soruları üretiyorsun.
${topicHint}Zorluk: ${difficulty}.
Her soru için 4 şık üret, doğru cevabı ve kısa bir açıklama belirt.
Sorular pratik ve endüstriyel uygulamalara dayalı olsun.
Konular: kesme parametreleri, takım ömrü, CNC programlama, malzeme bilgisi, toleranslar, yüzey pürüzlülüğü, diş açma, delme, taşlama, G-code, M-code, takım tezgahları.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${level} seviyesinde 5 adet çoktan seçmeli soru üret.` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_questions",
              description: "Generate quiz questions for CNC machining",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string", description: "The question text" },
                        options: {
                          type: "array",
                          items: { type: "string" },
                          description: "4 answer options",
                        },
                        correct_index: { type: "number", description: "Index of correct answer (0-3)" },
                        explanation: { type: "string", description: "Brief explanation of the correct answer" },
                      },
                      required: ["question", "options", "correct_index", "explanation"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["questions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_questions" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "No structured response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const args = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("quiz error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
