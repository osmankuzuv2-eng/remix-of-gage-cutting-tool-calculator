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
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await supabaseClient.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    const { imageUrl, fileName, additionalInfo } = await req.json();

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "imageUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate that the imageUrl belongs to this user's storage path
    if (!imageUrl.includes(userId)) {
      return new Response(JSON.stringify({ error: "Unauthorized access to image" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      console.error("LOVABLE_API_KEY not configured");
      throw new Error("Server configuration error");
    }

    const imageContent = { type: "image_url" as const, image_url: { url: imageUrl } };

    const systemPrompt = `Sen 20+ yil deneyimli, gercek bir CNC atolyesinde calisan uzman makine muhendisisin. Teknik resimleri analiz edip GERCEKCI isleme plani ve sureler olusturuyorsun.

KULLANILABILIR MAKINE PARKI (SADECE bu tezgahlardan sec):
CNC TORNALAR:
- T302 - HYUNDAI KIA SKT 250 FOI TD (2010)
- T108 - HYUNDAI WIA L 300LC (2017)
- T106 - HYUNDAI WIA L 300LC (2019)
- T100 - HYUNDAI KIA SKT 21 FOI-TC (2009)
- T109 - DMG MORI CLX 450 (2019)
- T200 - DMG MORI SEIKI CTX 310 ECOLINE (2013)

4 EKSEN CNC FREZELER:
- T121 - OKUMA GENOS M560R-V (2016)
- T122 - OKUMA GENOS M560R-V (2017)
- T125 - OKUMA GENOS M560R-V (2018)

3+2 / 5 EKSEN CNC FREZELER:
- T137 - DECKEL MAHO DMU 50U (2019)
- T138 - DECKEL MAHO DMU 70U (2019)

ONEMLI: Her islem icin yukardaki tezgahlardan en uygun olani SEC ve tezgah kodunu (T302, T108 vb.) belirt. Parcaya gore hangi tezgahin neden secildigini acikla.

RESIM ANALIZI - COK DETAYLI YAP:
- Resimdeki HER olcuyu, HER toleransi, HER yuzey isareti (Ra), HER geometrik toleransi oku.
- Kose radyusleri, pahlar, kanallar, disler, delikler - HEPSINI tespit et.
- Olculeri mm cinsinden belirt. Eksik olcu varsa malzeme boyutundan tahmin et.
- Resimde gorunmeyen detaylar icin de mantiksal cikarim yap.

GERCEKCI SURE HESAPLAMA - ATÖLYE KOSULLARI:
Her islem icin SADECE kesme suresini degil, GERCEK TOPLAM SUREYI hesapla:

1. KESME SURESI (formul):
   n = (1000 × Vc) / (π × D)
   T_kesme = L / (n × f)
   Coklu paso: T_kesme × paso_sayisi

2. EK SURELER (her islem icin EKLE):
   - Takim yaklasma/cikis mesafesi: +2-5mm her yone (L_toplam = L_parca + yaklasma + cikis)
   - Takim degisim suresi: 0.3-0.5 dk (otomatik magazin), 1-2 dk (manuel)
   - Olcum/kontrol: 0.5-1 dk (toleransli islemlerden sonra)
   - Tezgah konumlandirma/referans alma: 0.2-0.5 dk
   - Sogutma sivisi acma/ayarlama: 0.1-0.2 dk
   - Talas temizleme (derin deliklerde): 0.3-1 dk

3. ISLEM SURESI = T_kesme + takim degisimi + yaklasma/cikis + olcum + diger

MALZEME BAZLI KESME PARAMETRELERI (karbur takim, KONSERVATIF degerler):
- Celik (St37, S235): Vc = 180-250 m/dk, f = 0.2-0.3 mm/dev (kaba), f = 0.08-0.15 mm/dev (ince)
- Celik (C45, 4140): Vc = 130-200 m/dk, f = 0.15-0.25 mm/dev
- Paslanmaz celik: Vc = 100-160 m/dk, f = 0.08-0.2 mm/dev
- Aluminyum: Vc = 350-600 m/dk, f = 0.15-0.4 mm/dev
- Dokme demir: Vc = 80-160 m/dk, f = 0.12-0.25 mm/dev

GERCEKCI ISLEM SURELERI (referans araliklar - sonuclar bunlara YAKIN olmali):
- Alin tornalama: 0.5-1.5 dk (takim degisim + yaklasma dahil)
- Kaba tornalama: 2-8 dk (parca boyutuna gore, coklu paso)
- Ince tornalama: 1-3 dk (dusuk ilerleme + olcum)
- Delme (kisa): 0.5-1.5 dk, derin delik: 1.5-4 dk (talas kirma dahil)
- Dis acma: 1-3 dk (coklu paso + olcum)
- Kanal acma: 0.5-2 dk
- Pah kirma: 0.3-1 dk
- Frezeleme: 2-10 dk (yuzey alanina gore)
- Taslama: 3-10 dk

HAZIRLIK SURESI (DETAYLI):
- Is parcasi baglama/sokmesi: 2-5 dk
- Takim olcum/offset ayari: 3-8 dk (takim sayisina gore)
- Program yukleme/kontrol: 1-3 dk
- Ilk parca olcum/dogrulama: 3-5 dk
- TOPLAM: Basit 10-15 dk, orta 15-25 dk, karmasik 25-40 dk

STRATEJI VE PLANLAMA:
- Baglama sekli ve beklenen baglama sayisini belirt
- Her islem icin neden o stratejiyi sectigini acikla
- Toleransli yuzeyler icin olcum/kontrol adimlarini ekle
- Takim listesini detayli ver (tip, boyut, ISO kodu mumkunse)

ONEMLI:
- Resimdeki HER detayi isle, hicbir sey atlama.
- Gercek atolye kosullarini yansit: takim degisimi, olcum, yaklasma mesafeleri DAHİL.
- Sadece kesme suresi degil, TOPLAM islem suresi ver.
- Cok kisa sureler VERME - gercek hayatta her islem en az 0.5 dk surer.
- Tezgah seciminde SADECE yukardaki makine parkindan sec.

JSON formatinda dondur:

{
  "partName": "Parca adi",
  "material": "Malzeme",
  "overallDimensions": "Boyutlar (mm)",
  "complexity": "Dusuk/Orta/Yuksek/Cok Yuksek",
  "clampingStrategy": "Baglama stratejisi ve kac baglama gerektigi",
  "operations": [
    {
      "step": 1,
      "operation": "Islem adi (detayli)",
      "machine": "Tezgah kodu ve adi (ornek: T109 - DMG CLX 450)",
      "tool": "Takim (tip, boyut, ISO kodu)",
      "cuttingSpeed": "Vc (m/dk)",
      "feedRate": "f (mm/dev veya mm/dis)",
      "depthOfCut": "ap (mm)",
      "spindleSpeed": "n (dev/dk) - hesaplanmis",
      "estimatedTime": "TOPLAM islem suresi (dk) - kesme + ek sureler",
      "notes": "Hesaplama: n=..., T_kesme=..., +takim degisim=..., +olcum=..., TOPLAM=..."
    }
  ],
  "totalEstimatedTime": "Toplam isleme suresi (dk) - tum adimlarin toplami",
  "setupTime": "Hazirlik suresi (dk) - detayli",
  "recommendations": ["Strateji onerisi 1", "Oneri 2"],
  "tolerances": "Tespit edilen toleranslar",
  "surfaceFinish": "Yuzey kalitesi (Ra degerleri)",
  "machinesRequired": ["T109 - DMG CLX 450", "T121 - Okuma M560R-V"],
  "difficultyNotes": "Zorluk, dikkat edilecekler, ozel stratejiler"
}

Sadece JSON dondur, baska metin ekleme.`;

    const userMessage = additionalInfo 
      ? `Bu teknik resmi analiz et. Tüm kritik ölçüleri ve toleransları dikkatlice oku. Ek bilgiler: ${additionalInfo}`
      : "Bu teknik resmi analiz et. Tüm kritik ölçüleri, toleransları ve yüzey pürüzlülük değerlerini dikkatlice oku ve detaylı işleme planı oluştur.";

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
              imageContent,
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
      throw new Error(`AI analiz hatası (${response.status})`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Could not parse response:", content.substring(0, 500));
      throw new Error("AI yanıtı işlenemedi");
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: "Bir hata oluştu, lütfen tekrar deneyin." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
