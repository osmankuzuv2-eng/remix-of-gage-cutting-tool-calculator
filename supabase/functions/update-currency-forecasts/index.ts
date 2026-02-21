import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    if (!lovableApiKey) {
      throw new Error("AI API key not configured");
    }

    // Parse request body for mode
    let mode = "all"; // "historical", "forecast", or "all"
    try {
      const body = await req.json();
      if (body?.mode) mode = body.mode;
    } catch { /* no body, default to all */ }

    const currentDate = new Date().toISOString().split("T")[0];

    // Step 1: Fetch correct 2025 historical data from AI
    if (mode === "all" || mode === "historical") {
      const historicalPrompt = `You are a financial data expert. Today's date is: ${currentDate}.

Provide the REAL monthly average exchange rates for Turkey for the year 2025.

IMPORTANT CONTEXT - These are the approximate real ranges for 2025:
- USD/TRY started around 35.50 TL in January 2025 and has been gradually increasing
- EUR/TRY started around 37.00 TL in January 2025
- Gold gram price in TRY started around 2800 TL in January 2025

These rates reflect the ACTUAL Turkish Central Bank (TCMB) data and market rates.
For months that have not yet occurred, use the most recent known market rate with minimal extrapolation.

Provide values based on REAL market data, NOT made-up linear sequences.

Output ONLY the following JSON format, no other text:
{
  "usd": [jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec],
  "eur": [jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec],
  "gold": [jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec]
}

USD and EUR values should have 2 decimal places. Gold values should be integers.`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [{ role: "user", content: historicalPrompt }],
          temperature: 0.1,
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        throw new Error(`AI historical request failed: ${errText}`);
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const historicalRates = JSON.parse(jsonMatch[0]);
        
        // Delete existing 2025 historical data and insert corrected data
        await supabase.from("currency_rates").delete().eq("year", 2025).eq("is_forecast", false);
        
        const rows: any[] = [];
        for (const rateType of ["usd", "eur", "gold"] as const) {
          const values = historicalRates[rateType];
          if (!values || values.length !== 12) continue;
          for (let month = 1; month <= 12; month++) {
            rows.push({
              year: 2025,
              month,
              rate_type: rateType,
              value: values[month - 1],
              is_forecast: false,
              source: "historical",
            });
          }
        }
        
        if (rows.length > 0) {
          const { error: insertErr } = await supabase.from("currency_rates").insert(rows);
          if (insertErr) throw insertErr;
        }
      }
    }

    // Step 2: Generate 2026 forecasts based on updated historical data
    if (mode === "all" || mode === "forecast") {
      // Re-fetch historical data (now corrected)
      const { data: historicalData } = await supabase
        .from("currency_rates")
        .select("*")
        .eq("is_forecast", false)
        .order("year")
        .order("month");

      const usdData = historicalData?.filter((d: any) => d.rate_type === "usd") || [];
      const eurData = historicalData?.filter((d: any) => d.rate_type === "eur") || [];
      const goldData = historicalData?.filter((d: any) => d.rate_type === "gold") || [];

      const formatSeries = (data: any[]) =>
        data.map((d: any) => `${d.year}-${String(d.month).padStart(2, "0")}: ${d.value}`).join(", ");

      const forecastPrompt = `Sen bir finans analistisin. Bugünün tarihi: ${currentDate}.

Aşağıdaki Türkiye aylık ortalama kur verilerine dayanarak 2026 yılı aylık tahminlerini yap.

Geçmiş USD/TRY: ${formatSeries(usdData)}
Geçmiş EUR/TRY: ${formatSeries(eurData)}
Geçmiş Gram Altın TL: ${formatSeries(goldData)}

Türk ekonomisi için şu faktörleri dikkate al:
- TCMB para politikası yönü ve faiz oranı gidişatı
- Enflasyon beklentileri ve TÜFE trendleri
- Küresel emtia fiyatlarının altın üzerindeki etkisi
- EUR/USD paritesi etkileri
- Türk ekonomisindeki mevsimsel kalıplar
- Güncel jeopolitik gelişmeler

SADECE aşağıdaki JSON formatında 36 değer (12 ay × 3 kur tipi) ver:
{
  "usd": [oca, sub, mar, nis, may, haz, tem, agu, eyl, eki, kas, ara],
  "eur": [oca, sub, mar, nis, may, haz, tem, agu, eyl, eki, kas, ara],
  "gold": [oca, sub, mar, nis, may, haz, tem, agu, eyl, eki, kas, ara]
}

Başka açıklama ekleme. Gerçekçi artımlı değerler ve mevsimsel değişkenlik kullan. USD ve EUR 2 ondalık, altın tam sayı olsun.`;

      const forecastResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: forecastPrompt }],
          temperature: 0.3,
        }),
      });

      if (forecastResponse.ok) {
        const forecastData = await forecastResponse.json();
        const forecastContent = forecastData.choices?.[0]?.message?.content || "";
        const forecastJsonMatch = forecastContent.match(/\{[\s\S]*\}/);
        
        if (forecastJsonMatch) {
          const forecasts = JSON.parse(forecastJsonMatch[0]);
          
          await supabase.from("currency_rates").delete().eq("year", 2026).eq("is_forecast", true);
          
          const forecastRows: any[] = [];
          for (const rateType of ["usd", "eur", "gold"] as const) {
            const values = forecasts[rateType];
            if (!values || values.length !== 12) continue;
            for (let month = 1; month <= 12; month++) {
              forecastRows.push({
                year: 2026,
                month,
                rate_type: rateType,
                value: values[month - 1],
                is_forecast: true,
                source: "ai_forecast",
              });
            }
          }
          
          if (forecastRows.length > 0) {
            const { error: insertErr } = await supabase.from("currency_rates").insert(forecastRows);
            if (insertErr) throw insertErr;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, mode, source: "ai" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
