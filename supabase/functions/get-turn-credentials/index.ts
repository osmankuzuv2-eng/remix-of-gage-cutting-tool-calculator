import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("METERED_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "METERED_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const res = await fetch(
      `https://toolwiseplanner.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`
    );

    if (!res.ok) {
      throw new Error(`Metered API error: ${res.status}`);
    }

    const credentials = await res.json();

    // credentials is an array like:
    // [{ urls: "stun:...", username: "...", credential: "..." }, ...]
    return new Response(
      JSON.stringify({ iceServers: credentials }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          // Cache for 50 seconds — Metered credentials are valid for 60s by default
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    console.error("TURN credentials fetch error:", err);
    // Fall back to STUN-only list — better than crashing
    return new Response(
      JSON.stringify({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
        ],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
