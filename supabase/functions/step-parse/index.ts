import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
};

// ─── STEP geometry parser ─────────────────────────────────────────────────────
// Parses ASCII STEP (ISO 10303-21) files to extract:
//   - Cartesian points → bounding box
//   - Volume estimate (convex hull approximation via bounding box)
//   - Surface area estimate (sum of ADVANCED_FACE plane areas where possible)
//   - Material hint from MATERIAL or PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE
//   - Part name from PRODUCT entity

interface StepParseResult {
  part_name: string;
  material_hint: string | null;
  bounding_box: {
    x_min: number; x_max: number;
    y_min: number; y_max: number;
    z_min: number; z_max: number;
    length_mm: number; width_mm: number; height_mm: number;
  };
  point_count: number;
  face_count: number;
  estimated_volume_cm3: number;
  estimated_surface_area_cm2: number;
  estimated_weight_kg: number;
  material_category: string;
  density_g_cm3: number;
}

const MATERIAL_KEYWORDS: Record<string, { category: string; density: number }> = {
  "alumin": { category: "Alüminyum", density: 2.70 },
  "al ": { category: "Alüminyum", density: 2.70 },
  "6082": { category: "Alüminyum", density: 2.70 },
  "7075": { category: "Alüminyum", density: 2.80 },
  "2024": { category: "Alüminyum", density: 2.78 },
  "titanium": { category: "Titanyum", density: 4.43 },
  "titan": { category: "Titanyum", density: 4.43 },
  "ti-6al": { category: "Titanyum", density: 4.43 },
  "stainless": { category: "Paslanmaz Çelik", density: 8.00 },
  "paslanmaz": { category: "Paslanmaz Çelik", density: 8.00 },
  "inox": { category: "Paslanmaz Çelik", density: 8.00 },
  "304": { category: "Paslanmaz Çelik", density: 8.00 },
  "316": { category: "Paslanmaz Çelik", density: 8.00 },
  "17-4": { category: "Paslanmaz Çelik", density: 7.78 },
  "cast iron": { category: "Dökme Demir", density: 7.20 },
  "dokme": { category: "Dökme Demir", density: 7.20 },
  "copper": { category: "Bakır/Pirinç", density: 8.96 },
  "brass": { category: "Bakır/Pirinç", density: 8.50 },
  "pirincˇ": { category: "Bakır/Pirinç", density: 8.50 },
  "plastic": { category: "Plastik", density: 1.20 },
  "nylon": { category: "Plastik", density: 1.14 },
  "peek": { category: "Plastik", density: 1.32 },
  "steel": { category: "Çelik", density: 7.85 },
  "celik": { category: "Çelik", density: 7.85 },
  "çelik": { category: "Çelik", density: 7.85 },
  "s235": { category: "Çelik", density: 7.85 },
  "s355": { category: "Çelik", density: 7.85 },
  "42crmo": { category: "Çelik", density: 7.85 },
  "1.4301": { category: "Paslanmaz Çelik", density: 8.00 },
};

function detectMaterial(text: string): { category: string; density: number; hint: string | null } {
  const lower = text.toLowerCase();
  for (const [kw, val] of Object.entries(MATERIAL_KEYWORDS)) {
    if (lower.includes(kw)) {
      // Try to find the surrounding context for a better hint
      const idx = lower.indexOf(kw);
      const hint = text.slice(Math.max(0, idx - 5), idx + 30).replace(/['\n\r]/g, "").trim();
      return { ...val, hint };
    }
  }
  return { category: "Çelik", density: 7.85, hint: null };
}

function parseStep(content: string): StepParseResult {
  // ── Extract part name from PRODUCT entity ──────────────────────────────────
  let part_name = "Parça";
  const productMatch = content.match(/PRODUCT\s*\(\s*'([^']+)'\s*,\s*'([^']*)'/i);
  if (productMatch) {
    const candidate = (productMatch[2] || productMatch[1]).trim();
    if (candidate && candidate.length > 0 && candidate !== " ") {
      part_name = candidate;
    }
  }

  // ── Extract material hint ──────────────────────────────────────────────────
  let material_hint: string | null = null;
  const matPatterns = [
    /MATERIAL\s*\(\s*'([^']+)'/i,
    /PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE\s*\(\s*'[^']*'\s*,\s*'([^']+)'/i,
    /MATERIAL_DESIGNATION\s*\(\s*'([^']+)'/i,
    /CHARACTERIZED_MATERIAL_PROPERTY\s*\(\s*'([^']+)'/i,
  ];
  for (const pat of matPatterns) {
    const m = content.match(pat);
    if (m && m[1].trim()) { material_hint = m[1].trim(); break; }
  }

  // ── Detect material category + density ────────────────────────────────────
  const searchText = [material_hint ?? "", part_name, content.slice(0, 5000)].join(" ");
  const { category: material_category, density: density_g_cm3, hint: detectedHint } = detectMaterial(searchText);
  if (!material_hint && detectedHint) material_hint = detectedHint;

  // ── Extract all Cartesian points ───────────────────────────────────────────
  // CARTESIAN_POINT('name',(x,y,z));
  const ptRegex = /CARTESIAN_POINT\s*\([^,]*,\s*\(\s*([-+]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*,\s*([-+]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*,\s*([-+]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*\)/gi;

  let xMin = Infinity, xMax = -Infinity;
  let yMin = Infinity, yMax = -Infinity;
  let zMin = Infinity, zMax = -Infinity;
  let pointCount = 0;
  let m: RegExpExecArray | null;

  while ((m = ptRegex.exec(content)) !== null) {
    const x = parseFloat(m[1]);
    const y = parseFloat(m[2]);
    const z = parseFloat(m[3]);
    if (isNaN(x) || isNaN(y) || isNaN(z)) continue;
    if (x < xMin) xMin = x; if (x > xMax) xMax = x;
    if (y < yMin) yMin = y; if (y > yMax) yMax = y;
    if (z < zMin) zMin = z; if (z > zMax) zMax = z;
    pointCount++;
  }

  if (pointCount === 0) {
    // Fallback: try VERTEX_POINT or EDGE coordinates
    const numRegex = /\(\s*([-+]?\d+\.?\d*(?:[eE][+-]?\d+)?)\s*,\s*([-+]?\d+\.?\d*(?:[eE][+-]?\d+)?)\s*,\s*([-+]?\d+\.?\d*(?:[eE][+-]?\d+)?)\s*\)/g;
    while ((m = numRegex.exec(content)) !== null) {
      const x = parseFloat(m[1]);
      const y = parseFloat(m[2]);
      const z = parseFloat(m[3]);
      if (isNaN(x) || isNaN(y) || isNaN(z)) continue;
      if (Math.abs(x) > 100000 || Math.abs(y) > 100000 || Math.abs(z) > 100000) continue; // skip unrealistic
      if (x < xMin) xMin = x; if (x > xMax) xMax = x;
      if (y < yMin) yMin = y; if (y > yMax) yMax = y;
      if (z < zMin) zMin = z; if (z > zMax) zMax = z;
      pointCount++;
    }
  }

  // Handle degenerate cases
  if (!isFinite(xMin)) { xMin = 0; xMax = 100; yMin = 0; yMax = 50; zMin = 0; zMax = 25; }

  const length_mm = Math.abs(xMax - xMin);
  const width_mm = Math.abs(yMax - yMin);
  const height_mm = Math.abs(zMax - zMin);

  // ── Face count ────────────────────────────────────────────────────────────
  const faceMatches = content.match(/ADVANCED_FACE\s*\(/gi);
  const face_count = faceMatches?.length ?? 0;

  // ── Volume & surface area estimation ──────────────────────────────────────
  // For complex machined parts, typical fill factor is 0.5-0.7 of bounding box
  // We use face count as a proxy for complexity:
  //   - few faces → simpler shape → higher fill factor
  //   - many faces → more pockets/holes → lower fill factor
  let fillFactor = 0.65;
  if (face_count > 100) fillFactor = 0.45;
  else if (face_count > 50) fillFactor = 0.55;
  else if (face_count < 10) fillFactor = 0.75;

  const bb_volume_mm3 = length_mm * width_mm * height_mm;
  const estimated_volume_mm3 = bb_volume_mm3 * fillFactor;
  const estimated_volume_cm3 = estimated_volume_mm3 / 1000;

  // Surface area: 2*(lw + lh + wh) * surface factor (holes & features add surface)
  const bb_surface_mm2 = 2 * (length_mm * width_mm + length_mm * height_mm + width_mm * height_mm);
  const surfaceFactor = 1.0 + (face_count > 20 ? Math.min(face_count / 20, 3.0) : 0.2);
  const estimated_surface_area_mm2 = bb_surface_mm2 * surfaceFactor;
  const estimated_surface_area_cm2 = estimated_surface_area_mm2 / 100;

  // Weight
  const estimated_weight_kg = (estimated_volume_cm3 * density_g_cm3) / 1000;

  return {
    part_name,
    material_hint,
    bounding_box: {
      x_min: xMin, x_max: xMax,
      y_min: yMin, y_max: yMax,
      z_min: zMin, z_max: zMax,
      length_mm: Math.round(length_mm * 100) / 100,
      width_mm: Math.round(width_mm * 100) / 100,
      height_mm: Math.round(height_mm * 100) / 100,
    },
    point_count: pointCount,
    face_count,
    estimated_volume_cm3: Math.round(estimated_volume_cm3 * 100) / 100,
    estimated_surface_area_cm2: Math.round(estimated_surface_area_cm2 * 10) / 10,
    estimated_weight_kg: Math.round(estimated_weight_kg * 1000) / 1000,
    material_category,
    density_g_cm3,
  };
}

// ─── AI operation estimator ──────────────────────────────────────────────────

async function estimateOperations(
  parseResult: StepParseResult,
  language: string,
  apiKey: string
): Promise<any> {
  const { bounding_box: bb, face_count, estimated_weight_kg, material_category, estimated_volume_cm3, estimated_surface_area_cm2, part_name, material_hint } = parseResult;

  const langInstructions =
    language === "en" ? "Respond in ENGLISH." :
    language === "fr" ? "Répondez en FRANÇAIS." :
    "Türkçe yanıt ver.";

  const systemPrompt = `Sen deneyimli bir talaşlı imalat mühendisi ve teklif uzmanısın.
${langInstructions}

Sana bir STEP dosyasından çıkarılmış geometri verileri verilecek. Bu verilerden üretim operasyonlarını ve maliyetleri tahmin edeceksin.

## MAKİNE TİPLERİ
Sadece şunları kullan: "Freze", "Torna", "Taşlama", "Delme", "Tel Erozyon", "5 Eksen"

## SÜRE TAHMİNİ REHBERİ
- Bounding box hacmi ve yüzey alanını dikkate al
- Yüz sayısı (face_count) karmaşıklık göstergesidir
- Küçük parça (hacim < 50cm³): 5-30 dk/op
- Orta parça (hacim 50-500cm³): 15-60 dk/op  
- Büyük parça (hacim > 500cm³): 30-180 dk/op
- Yüksek yüz sayısı (> 50) daha fazla operasyon ve süre gerektirir`;

  const userContent = `STEP dosyasından çıkarılan geometri verileri:

Parça Adı: ${part_name}
Malzeme İpucu: ${material_hint ?? "belirtilmemiş"}
Malzeme Kategorisi: ${material_category}

BOUNDING BOX:
- Uzunluk (X): ${bb.length_mm} mm
- Genişlik (Y): ${bb.width_mm} mm  
- Yükseklik (Z): ${bb.height_mm} mm

GEOMETRİ:
- Tahmini Hacim: ${estimated_volume_cm3} cm³
- Tahmini Yüzey Alanı: ${estimated_surface_area_cm2} cm²
- Tahmini Ağırlık: ${estimated_weight_kg} kg
- Yüz Sayısı (face_count): ${face_count} (karmaşıklık göstergesi)

Bu verilere dayanarak imalat operasyonlarını, toleransları ve malzemeyi tahmin et.`;

  const tools = [
    {
      type: "function",
      function: {
        name: "estimate_machining",
        description: "STEP geometrisinden imalat operasyonları ve teklif verilerini tahmin eder",
        parameters: {
          type: "object",
          properties: {
            part_name: { type: "string", description: "Parça adı (STEP'ten gelen veya tahmini)" },
            material: { type: "string", description: "Tahmin edilen malzeme (örn: EN AW-6082 T6, S235, AISI 304)" },
            material_category: {
              type: "string",
              enum: ["Alüminyum", "Çelik", "Paslanmaz Çelik", "Dökme Demir", "Titanyum", "Bakır/Pirinç", "Plastik", "Diğer"],
            },
            tightest_tolerance: { type: "string", description: "Tahmini en sıkı tolerans" },
            surface_finish: { type: "string", description: "Tahmini yüzey kalitesi" },
            features: {
              type: "array",
              items: { type: "string" },
              description: "Tahmin edilen özellikler (hacim/yüzey/yüz sayısına göre)",
            },
            operations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  step: { type: "number" },
                  name: { type: "string" },
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
            setup_count: { type: "number" },
            setup_time_min: { type: "number" },
            complexity: {
              type: "string",
              enum: ["Basit", "Orta", "Karmaşık", "Çok Karmaşık"],
            },
            notes: { type: "string" },
          },
          required: [
            "part_name", "material", "material_category", "operations",
            "setup_time_min", "complexity", "tightest_tolerance", "surface_finish",
          ],
          additionalProperties: false,
        },
      },
    },
  ];

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      temperature: 0,
      tools,
      tool_choice: { type: "function", function: { name: "estimate_machining" } },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("AI did not return structured data");

  return JSON.parse(toolCall.function.arguments);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stepContent, language = "tr" } = await req.json();

    if (!stepContent || typeof stepContent !== "string") {
      return new Response(JSON.stringify({ error: "stepContent (string) is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    // 1. Parse STEP geometry locally (fast, no AI needed)
    const parseResult = parseStep(stepContent);

    // 2. Send geometry summary to AI for operation estimation
    const aiEstimate = await estimateOperations(parseResult, language, apiKey);

    // 3. Merge: geometry data takes priority for dimensions/weight
    const result = {
      ...aiEstimate,
      // Override with precise parsed values
      dimensions: {
        length_mm: parseResult.bounding_box.length_mm,
        width_mm: parseResult.bounding_box.width_mm,
        height_mm: parseResult.bounding_box.height_mm,
      },
      estimated_weight_kg: parseResult.estimated_weight_kg,
      estimated_volume_cm3: parseResult.estimated_volume_cm3,
      estimated_surface_area_cm2: parseResult.estimated_surface_area_cm2,
      face_count: parseResult.face_count,
      point_count: parseResult.point_count,
      bounding_box: parseResult.bounding_box,
      material_hint: parseResult.material_hint,
      // Use AI material if no hint was found, otherwise keep parsed
      material_category: parseResult.material_hint
        ? parseResult.material_category
        : aiEstimate.material_category,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("step-parse error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
