import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Get all historical data
    const { data: historicalData, error: fetchErr } = await supabase
      .from("currency_rates")
      .select("*")
      .eq("is_forecast", false)
      .order("year")
      .order("month");

    if (fetchErr) throw fetchErr;

    // Build prompt for AI
    const usdData = historicalData?.filter((d: any) => d.rate_type === "usd") || [];
    const eurData = historicalData?.filter((d: any) => d.rate_type === "eur") || [];
    const goldData = historicalData?.filter((d: any) => d.rate_type === "gold") || [];

    const formatSeries = (data: any[]) =>
      data.map((d: any) => `${d.year}-${String(d.month).padStart(2, "0")}: ${d.value}`).join(", ");

    const prompt = `You are a financial analyst. Based on the following monthly average exchange rate data for Turkey, provide 2026 monthly forecasts.

Historical USD/TRY: ${formatSeries(usdData)}
Historical EUR/TRY: ${formatSeries(eurData)}
Historical Gold Gram TRY: ${formatSeries(goldData)}

Consider these factors for Turkish economy:
- TCMB monetary policy direction and interest rate trajectory
- Inflation expectations and CPI trends
- Global commodity prices impact on gold
- EUR/USD parity effects
- Seasonal patterns in Turkish economy

Provide EXACTLY 36 values (12 months × 3 rate types) in this JSON format:
{
  "usd": [jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec],
  "eur": [jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec],
  "gold": [jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec]
}

Only output the JSON, no explanation. Use realistic incremental values with seasonal variation. Values should be numbers with 2 decimal places (except gold which should be integers).`;

    let forecasts: { usd: number[]; eur: number[]; gold: number[] } | null = null;

    if (lovableApiKey) {
      try {
        const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableApiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          // Extract JSON from response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            forecasts = JSON.parse(jsonMatch[0]);
          }
        }
      } catch (aiErr) {
        console.error("AI forecast error:", aiErr);
      }
    }

    // Fallback: linear extrapolation if AI fails
    if (!forecasts) {
      const extrapolate = (data: any[]) => {
        const lastVal = data[data.length - 1]?.value || 0;
        const secondLast = data[data.length - 2]?.value || lastVal;
        const monthlyGrowth = (lastVal - secondLast);
        return Array.from({ length: 12 }, (_, i) =>
          Number((lastVal + monthlyGrowth * (i + 1)).toFixed(2))
        );
      };
      forecasts = {
        usd: extrapolate(usdData),
        eur: extrapolate(eurData),
        gold: extrapolate(goldData).map((v) => Math.round(v)),
      };
    }

    // Upsert forecasts
    const rows: any[] = [];
    for (const rateType of ["usd", "eur", "gold"] as const) {
      const values = forecasts[rateType];
      if (!values || values.length !== 12) continue;
      for (let month = 1; month <= 12; month++) {
        rows.push({
          year: 2026,
          month,
          rate_type: rateType,
          value: values[month - 1],
          is_forecast: true,
          source: lovableApiKey ? "ai_forecast" : "linear_extrapolation",
        });
      }
    }

    // Delete existing 2026 forecasts and insert new ones
    await supabase.from("currency_rates").delete().eq("year", 2026).eq("is_forecast", true);
    const { error: insertErr } = await supabase.from("currency_rates").insert(rows);
    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({ success: true, updated: rows.length, source: lovableApiKey ? "ai" : "extrapolation" }),
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
