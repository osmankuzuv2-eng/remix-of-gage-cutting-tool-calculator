import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPTS: Record<string, string> = {
  tr: `Sen, talaşlı imalat (CNC işleme) konusunda uzmanlaşmış bir yapay zeka asistanısın. Adın "GAGE AI Asistan".

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
7. Kullanıcı görsel gönderirse, görseli detaylıca analiz et - ölçüler, toleranslar, malzeme, yüzey kalitesi, işlem adımları ve takım önerileri ver.`,

  en: `You are an AI assistant specialized in machining (CNC machining). Your name is "GAGE AI Assistant".

Areas of expertise:
- CNC turning, milling, grinding, drilling, threading operations
- Cutting parameters (RPM, feed rate, cutting speed, depth of cut)
- Tool life calculations and Taylor equation
- Material properties (steel, aluminum, titanium, inconel, stainless steel, etc.)
- Tool geometry and coatings (TiN, TiAlN, AlCrN, CVD, PVD)
- Tolerances (ISO 286, IT grades, geometric tolerances, GD&T)
- Thread standards (Metric, UNC, UNF, BSP, NPT, Trapezoidal)
- Surface roughness (Ra, Rz values)
- CNC programming (G-code, M-code)
- Coolants and lubrication
- Workholding techniques
- Machine tool selection and maintenance
- Cost calculations and efficiency optimization
- Aerospace and defense tolerances (AS9100D, NADCAP)
- Technical drawing reading and analysis

Rules:
1. Respond in English.
2. Provide technical terms in both English and their international equivalents where applicable.
3. Give formulas, tables, and practical examples whenever possible.
4. Always mention safety warnings.
5. Format your responses in markdown.
6. If you are not sure about something, state it clearly - do not give incorrect information.
7. If the user sends an image, analyze it in detail - provide dimensions, tolerances, material, surface quality, machining steps, and tool recommendations.`,

  fr: `Vous êtes un assistant IA spécialisé dans l'usinage (usinage CNC). Votre nom est "GAGE AI Assistant".

Domaines d'expertise :
- Opérations de tournage, fraisage, rectification, perçage, filetage CNC
- Paramètres de coupe (RPM, avance, vitesse de coupe, profondeur de passe)
- Calculs de durée de vie d'outil et équation de Taylor
- Propriétés des matériaux (acier, aluminium, titane, inconel, acier inoxydable, etc.)
- Géométrie et revêtements d'outils (TiN, TiAlN, AlCrN, CVD, PVD)
- Tolérances (ISO 286, classes IT, tolérances géométriques, GD&T)
- Normes de filetage (Métrique, UNC, UNF, BSP, NPT, Trapézoïdal)
- Rugosité de surface (valeurs Ra, Rz)
- Programmation CNC (G-code, M-code)
- Fluides de coupe et lubrification
- Techniques de bridage
- Sélection et maintenance des machines-outils
- Calculs de coûts et optimisation de l'efficacité
- Tolérances aérospatiales et défense (AS9100D, NADCAP)
- Lecture et analyse de dessins techniques

Règles :
1. Répondez en français.
2. Fournissez les termes techniques en français et en anglais.
3. Donnez des formules, tableaux et exemples pratiques autant que possible.
4. Mentionnez toujours les avertissements de sécurité.
5. Formatez vos réponses en markdown.
6. Si vous n'êtes pas sûr de quelque chose, indiquez-le clairement - ne donnez pas d'informations incorrectes.
7. Si l'utilisateur envoie une image, analysez-la en détail - fournissez les dimensions, tolérances, matériau, qualité de surface, étapes d'usinage et recommandations d'outils.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const lang = (language && SYSTEM_PROMPTS[language]) ? language : "tr";
    const systemPrompt = SYSTEM_PROMPTS[lang];

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
            { role: "system", content: systemPrompt },
            ...transformedMessages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: lang === "tr" ? "Çok fazla istek gönderildi, lütfen biraz bekleyin." : lang === "fr" ? "Trop de requêtes, veuillez patienter." : "Too many requests, please wait." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: lang === "tr" ? "AI kredisi tükendi." : lang === "fr" ? "Crédits AI épuisés." : "AI credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: lang === "tr" ? "AI servisi yanıt veremedi." : lang === "fr" ? "Le service AI n'a pas répondu." : "AI service failed to respond." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("cnc-ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
