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

    // Fetch machines from database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    const { data: machinesData } = await supabaseClient
      .from("machines")
      .select("code, type, designation, brand, model, year, max_diameter_mm, power_kw, max_rpm, taper, has_live_tooling, has_y_axis, has_c_axis, travel_x_mm, travel_y_mm, travel_z_mm")
      .eq("is_active", true)
      .order("sort_order");

    const machines = machinesData || [];

    // Build machine list for prompt
    const buildMachineSection = () => {
      const turning = machines.filter((m: any) => m.type === "turning");
      const milling3 = machines.filter((m: any) => m.type === "milling-3axis");
      const milling4 = machines.filter((m: any) => m.type === "milling-4axis");
      const milling5 = machines.filter((m: any) => m.type === "milling-5axis");

      const fmt = (m: any) => {
        let line = `- ${m.code} - ${m.brand} ${m.model}`;
        if (m.year > 0) line += ` (${m.year})`;
        const specs: string[] = [];
        if (m.max_diameter_mm) specs.push(`Max Ø${m.max_diameter_mm}mm`);
        if (m.power_kw) specs.push(`${m.power_kw}kW`);
        if (m.max_rpm) specs.push(`${m.max_rpm}rpm`);
        if (m.taper) specs.push(m.taper);
        if (m.has_live_tooling) specs.push("canlı takım");
        if (m.has_y_axis) specs.push("Y ekseni");
        if (m.has_c_axis) specs.push("C ekseni");
        if (m.travel_x_mm && m.travel_y_mm && m.travel_z_mm) specs.push(`${m.travel_x_mm}x${m.travel_y_mm}x${m.travel_z_mm}mm`);
        if (specs.length) line += ` - ${specs.join(", ")}`;
        return line;
      };

      let section = "KULLANILABILIR MAKINE PARKI (SADECE bu tezgahlardan sec):\n";
      if (turning.length) section += `CNC TORNALAR:\n${turning.map(fmt).join("\n")}\n\n`;
      if (milling3.length) section += `3 EKSEN CNC FREZELER:\n${milling3.map(fmt).join("\n")}\n\n`;
      if (milling4.length) section += `4 EKSEN CNC FREZELER:\n${milling4.map(fmt).join("\n")}\n\n`;
      if (milling5.length) section += `3+2 / 5 EKSEN CNC FREZELER:\n${milling5.map(fmt).join("\n")}\n\n`;
      return section;
    };

    const machineSection = buildMachineSection();

    const imageContent = { type: "image_url" as const, image_url: { url: imageUrl } };

    const systemPrompt = `Sen 20+ yil deneyimli, gercek bir CNC atolyesinde calisan uzman makine muhendisisin. Teknik resimleri analiz edip GERCEKCI isleme plani ve sureler olusturuyorsun.

KESME STRATEJISI: VERIMLI (PRODUCTIVE)
- Vc: Malzeme araliginin UST YARISINI kullan (%60-75 arasi)
- f (tornalama): YUKSEK deger - kaba islemlerde aralik ust yarisi, ince islemlerde aralik ortasi
- fz (frezeleme): Dis basina ilerleme kullan, takim dis sayisina gore F_tablasi = fz × z × n
- ap: MAKSIMUM derinlik, AZ PASO ile isle
- KABA FREZELEME icin ap MAKSIMUM 2.5 mm! Asla 2.5 mm uzerinde ap kullanma.
- KABA TORNALAMA icin ap MAKSIMUM 4 mm (celik), 5 mm (aluminyum)
- INCE TORNALAMA icin ap = 0.2-0.5 mm
- Paso sayisini MINIMIZE et, buyuk ap ile az paso tercih et

${machineSection}
TEZGAH SECIM KURALLARI:
- Tornalama isleri: Parca capina gore uygun tornayi sec
- Canli takim / Y ekseni gereken isler icin bu ozelliklere sahip tezgahlari sec
- Basit frezeleme: 3 veya 4 eksen frezeler
- Karmasik 3D yuzeyler, acili islemler: 5 eksen frezeler
- Buyuk parcalar: En buyuk calısma alanina sahip tezgah

RESIM ANALIZI - COK DETAYLI YAP:
- Resimdeki HER olcuyu, HER toleransi, HER yuzey isareti (Ra), HER geometrik toleransi oku
- Kose radyusleri, pahlar, kanallar, disler, delikler - HEPSINI tespit et
- Tolerans sinifi belirle: IT6 (hassas), IT7 (iyi), IT8 (standart), IT9+ (kaba)
- Geometrik toleranslar: dairesellik, silindiriklik, paralellik, diklik, konum toleranslari
- Yuzey puruuzlulugu: Ra 0.4 (taslama), Ra 0.8 (ince tornalama), Ra 1.6 (iyi isleme), Ra 3.2 (standart), Ra 6.3 (kaba)
- Olculeri mm cinsinden belirt. Eksik olcu varsa malzeme boyutundan tahmin et

GERCEKCI SURE HESAPLAMA - ATÖLYE KOSULLARI:
Her islem icin SADECE kesme suresini degil, GERCEK TOPLAM SUREYI hesapla:

1. TORNALAMA KESME SURESI:
   n = (1000 × Vc) / (π × D)
   ONEMLI: n ASLA 4500 dev/dk yi GECEMEZ tornalarda! (Torna maksimum devir siniri)
   T_kesme = L / (n × f)  (dk)
   Coklu paso: T_kesme × paso_sayisi

2. FREZELEME KESME SURESI:
   n = (1000 × Vc) / (π × Dc)  (Dc = takim capi)
   ONEMLI: n ASLA 15000 dev/dk yi GECEMEZ (Okuma), 18000 (DMU) ve HICBIR ZAMAN 20000 uzerinde!
   F_tablasi = fz × z × n  (mm/dk)
   T_kesme = L_toplam / F_tablasi  (dk)
   Coklu paso icin: T_kesme × paso_sayisi

3. DELME KESME SURESI:
   n = (1000 × Vc) / (π × D_matkap)
   F = f × n  (mm/dk)
   T_kesme = L_delik / F  (dk)
   Derin delik (L > 3×D): Peck drilling - talas temizleme icin %50 ek sure

4. EK SURELER (her islem icin EKLE):
   - Takim yaklasma/cikis mesafesi: +2-5mm her yone
   - Takim degisim suresi: 5-8 sn (otomatik magazin Okuma/DMG), 15-30 sn (torna turret)
   - Olcum/kontrol: 0.5-1 dk (toleransli islemlerden sonra)
   - Tezgah konumlandirma (G0): 1-3 sn (kisa mesafe), 3-5 sn (uzun mesafe)
   - Talas temizleme (derin deliklerde): 0.3-1 dk

5. ISLEM SURESI = T_kesme + takim degisimi + yaklasma/cikis + olcum + diger

MALZEME BAZLI KESME PARAMETRELERI (KARBUR TAKIM - GERCEK DEGERLER):

TORNALAMA PARAMETRELERI:
- Celik (St37, S235, St52): Vc=220-280 m/dk, f=0.25-0.35 mm/dev (kaba), f=0.08-0.15 mm/dev (ince), ap=2-4 mm (kaba), ap=0.2-0.5 mm (ince)
- Celik (C45, 4140, 42CrMo4): Vc=180-230 m/dk, f=0.20-0.30 mm/dev (kaba), f=0.08-0.12 mm/dev (ince), ap=1.5-3.5 mm (kaba), ap=0.2-0.5 mm (ince)
- Celik (sertlestirilmis >45 HRC): Vc=80-120 m/dk, f=0.08-0.15 mm/dev, ap=0.1-0.5 mm (CBN veya seramik takim)
- Paslanmaz celik (304, 316): Vc=140-180 m/dk, f=0.15-0.25 mm/dev (kaba), f=0.06-0.12 mm/dev (ince), ap=1-3 mm (kaba)
- Paslanmaz celik (17-4PH, duplex): Vc=100-140 m/dk, f=0.12-0.20 mm/dev (kaba), f=0.05-0.10 mm/dev (ince)
- Aluminyum (6xxx serisi): Vc=500-800 m/dk, f=0.30-0.50 mm/dev (kaba), f=0.10-0.20 mm/dev (ince), ap=1.5-3 mm (kaba), ap=0.2-0.5 mm (ince)
- Aluminyum 7050/7075: Vc=400-500 m/dk, f=0.20-0.35 mm/dev (kaba), f=0.08-0.15 mm/dev (ince), ap=1-2.5 mm (kaba), ap=0.2-0.5 mm (ince)
- Pirinc / Bronz: Vc=200-350 m/dk, f=0.15-0.30 mm/dev (kaba), f=0.05-0.12 mm/dev (ince)
- Dokme demir (GG25/GGG40): Vc=120-180 m/dk, f=0.20-0.30 mm/dev (kaba), f=0.08-0.15 mm/dev (ince), ap=2-4 mm (kaba)
- Titanyum (Ti6Al4V): Vc=40-65 m/dk, f=0.10-0.18 mm/dev (kaba), f=0.05-0.08 mm/dev (ince), ap=0.5-2 mm (kaba)
- SUPER ALASIMLAR (Inconel 718, Waspaloy): Vc=15-30 m/dk, f=0.08-0.15 mm/dev (kaba), f=0.03-0.06 mm/dev (ince), ap=0.3-1.5 mm (kaba)

FREZELEME PARAMETRELERI (fz = dis basina ilerleme):
- Celik (St37, S235): Vc=200-260 m/dk, fz=0.10-0.18 mm/dis (kaba), fz=0.05-0.10 mm/dis (ince), ap=1-2.5 mm (kaba), ae=%50-70 Dc (kaba)
- Celik (C45, 4140): Vc=160-220 m/dk, fz=0.08-0.15 mm/dis (kaba), fz=0.04-0.08 mm/dis (ince), ap=0.75-2 mm (kaba)
- Paslanmaz celik: Vc=120-160 m/dk, fz=0.06-0.12 mm/dis (kaba), fz=0.03-0.07 mm/dis (ince), ap=0.5-1.5 mm (kaba)
- Aluminyum (6xxx): Vc=500-800 m/dk, fz=0.12-0.25 mm/dis (kaba), fz=0.05-0.12 mm/dis (ince), ap=0.75-1.5 mm (kaba), ae=%50-70 Dc
- Aluminyum 7050/7075: Vc=350-500 m/dk, fz=0.10-0.20 mm/dis (kaba), fz=0.04-0.10 mm/dis (ince), ap=0.5-1.25 mm (kaba), ae=%40-60 Dc
- Dokme demir: Vc=120-160 m/dk, fz=0.10-0.18 mm/dis (kaba), fz=0.05-0.10 mm/dis (ince)
- Titanyum: Vc=30-55 m/dk, fz=0.05-0.10 mm/dis, ap=0.25-1 mm, ae=%15-30 Dc (trochoidal onerılir)
- Super alasim: Vc=12-25 m/dk, fz=0.03-0.08 mm/dis, ap=0.15-0.75 mm, ae=%10-20 Dc

DELME PARAMETRELERI:
- Celik (genel): Vc=80-120 m/dk, f=0.15-0.30 mm/dev (Ø10-20mm), f=0.08-0.15 mm/dev (Ø3-10mm)
- Paslanmaz celik: Vc=60-90 m/dk, f=0.10-0.20 mm/dev
- Aluminyum: Vc=150-300 m/dk, f=0.20-0.40 mm/dev
- Titanyum: Vc=20-40 m/dk, f=0.05-0.12 mm/dev
- Derin delik (L>3D): Hizi %20-30 dusur, peck drilling uygula

DIS ACMA PARAMETRELERI:
- Dis tornalama (celik): Vc=100-150 m/dk, paso sayisi=6-12 (adima gore azalan derinlik)
- Dis tornalama (paslanmaz): Vc=70-110 m/dk, paso sayisi=8-15
- Dis tornalama (aluminyum): Vc=200-350 m/dk, paso sayisi=4-8
- Kılavuz ile dis acma: Vc=10-25 m/dk (celik), Vc=20-40 m/dk (aluminyum)
- Dis frezeleme: Vc=80-120 m/dk (celik), fz=0.03-0.06 mm/dis

SUPER ALASIM OZEL NOTLARI:
- Vc KESINLIKLE 30 m/dk yi GECMEMELI!
- Seramik veya CBN takim kullan, kaplamasiz karbur KULLANMA
- YUKSEK BASINC sogutma ZORUNLU (70+ bar onerılir)
- Takim omru cok kisadir (10-20 dk), takim kontrolu sik yap
- Islem sureleri normal celiklere gore 3-5 KAT UZUN
- Isil iletkenlik dusuk - takim ve parca asiri isinir
- Talaş yapismasi riski yuksek - kesme kenarini temiz tut

TOLERANS VE YUZEY KALITESI STRATEJISI:
- h6/H7 tolerans: ZORUNLU ince paso (ap=0.1-0.3 mm, f=0.05-0.10 mm/dev), olcum sonrasi 2. ince paso gerekebilir
- h7/H8 tolerans: Ince paso yeterli (ap=0.2-0.5 mm, f=0.08-0.12 mm/dev)
- Ra 0.8 veya alti: Taslama veya honlama GEREKLI, tornalama ile ELDE EDILEMEZ
- Ra 1.6: Iyi ince tornalama veya ince frezeleme ile mumkun (dusuk f, yuksek Vc)
- Ra 3.2: Standart ince isleme ile elde edilir
- Geometrik tolerans (dairesellik <0.01): Dusuk kesme kuvveti, dengeli baglama, son paso cok hafif
- Konsantriklik/koaksiyalite: Tek baglamada tum kritik capler islenmeli
- Konumsal tolerans (delik pozisyonu): Freze ile islenmeli, torna delik delme yetersiz kalabilir

GERCEKCI ISLEM SURELERI (referans - VERIMLI strateji, HIZLI URETIM):
Normal celik/aluminyum:
- Alin tornalama: 0.2-0.6 dk
- Kaba tornalama (kisa parca <100mm): 0.5-2 dk
- Kaba tornalama (uzun parca >100mm): 1.5-4 dk
- Ince tornalama: 0.3-1.2 dk
- Delme (kisa L<3D): 0.2-0.5 dk
- Delme (derin L>3D): 0.5-2 dk (peck drilling dahil)
- Dis tornalama: 0.5-1.5 dk (paso sayisina bagli)
- Kanal tornalama: 0.2-1.0 dk
- Pah kirma: 0.05-0.15 dk (basit pah 3-5 sn, buyuk pah 8-10 sn)
- Kaba frezeleme: 2-8 dk (yuzey alanina gore)
- Ince frezeleme: 1-4 dk
- Cep frezeleme: 3-12 dk (hacme gore)
- Taslama: 3-10 dk

Super alasim / Titanyum (3-5 KAT fazla):
- Kaba tornalama: 3-14 dk
- Ince tornalama: 1.5-4 dk
- Delme: 1.5-4 dk (kisa), 3-8 dk (derin)
- Frezeleme: 8-30 dk

HAZIRLIK SURESI (DETAYLI):
- Is parcasi baglama (ayna): 1-3 dk
- Is parcasi baglama (mengenede): 2-4 dk
- Is parcasi baglama (ozel aparat): 5-10 dk
- Takim olcum/offset ayari: 0.5-1 dk/takim (otomatik prob ile), 2-3 dk/takim (manuel)
- Program yukleme/kontrol: 1-2 dk
- Ilk parca olcum/dogrulama: 3-8 dk (tolerans sayisina bagli)
- Referans alma (sifir noktasi): 1-3 dk (prob ile), 3-5 dk (manuel)
- TOPLAM: Basit parca 8-15 dk, orta karmasiklik 15-25 dk, karmasik 25-45 dk

BAGLAMA SURESI HESAPLAMA (DETAYLI - her baglama icin ayri hesapla):
- 3 ceneli ayna baglama/cozme (TORNA): 0.5 dk (30 sn) - hidrolik/pnomatik ayna standart
- Mengenede baglama/cozme: 2-3 dk (standart), 3-5 dk (coklu parca)
- Ozel aparat ile baglama: 3-8 dk (karmasikliga bagli)
- Punta ile destekleme: +0.5 dk ek sure
- Parca cevirme (2. op icin torna): 1 dk (cozme 0.5 dk + cevirme + yeniden baglama 0.5 dk)
- Paralel/takoz ayarlama (mengenede): 1-2 dk
- Hassas hizalama (komparator ile): 3-5 dk
- TOPLAM BAGLAMA SURESI: Tum baglama/cozme adimlari toplanir
- Her operasyonda baglama degisiyorsa, O ISLEMIN suresine baglama suresi EKLE
- Ayni baglamada yapilan islemlerde baglama suresi TEKRAR EKLENMEZ

STRATEJI VE PLANLAMA:
- Baglama sekli belirt: 3 cenelik ayna, mengenede, ozel aparat, punta ile destekli
- Her islemde neden o strateji secildigini KISA acikla
- Toleransli yuzeyler icin olcum/kontrol adimlarini ekle
- Takim listesi: Tip, boyut, ISO/ANSI kodu, ucun yarıcapi (Rε), dis sayisi (z)
- Sogutma: Emulsiyon (genel), kuru (dokme demir), yuksek basinc (titanyum/inconel), MQL (aluminyum opsiyonel)
- Takimlarin sira numarasini (T01, T02...) belirt

KRITIK KURALLAR:
- Resimdeki HER detayi isle, hicbir sey atlama
- Gercek atolye kosullarini yansit: takim degisimi, olcum, yaklasma DAHİL
- Sadece kesme suresi degil TOPLAM islem suresi ver
- Cok kisa sureler VERME - her islem en az 0.3 dk
- SADECE yukardaki makine parkindan sec
- Frezelemede fz (dis basina ilerleme) kullan, f (devir basina ilerleme) KULLANMA
- Tornada spindle n ASLA 4500 uzerine cikma
- Toleransli olculerde olcum suresi EKLEmeyi unutma
- Ham malzeme olcusunu belirt (parca olcusu + isleme payi)
- Toplam islem suresi GERCEKCI olsun - ne cok kisa ne cok uzun

JSON formatinda dondur:

{
  "partName": "Parca adi",
  "material": "Malzeme (kalite belirt: C45, 7075-T6, 316L vb.)",
  "rawMaterialDimensions": "Ham malzeme olcusu (isleme payi dahil)",
  "overallDimensions": "Bitmiş parca boyutlari (mm)",
  "complexity": "Dusuk/Orta/Yuksek/Cok Yuksek",
  "weight": "Tahmini agirlik (kg)",
  "clampingStrategy": "Baglama stratejisi, tipi ve kac baglama gerektigi",
  "clampingDetails": [
    {
      "setupNumber": 1,
      "clampingType": "3 ceneli ayna / mengene / ozel aparat",
      "description": "Nasil baglanacagi detayli aciklama",
      "clampingTime": "Baglama suresi (dk)",
      "unclampingTime": "Cozme suresi (dk)",
      "notes": "Ek notlar (punta, paralel, hizalama vb.)"
    }
  ],
  "totalClampingTime": "Toplam baglama/cozme suresi (dk)",
  "operations": [
    {
      "step": 1,
      "operation": "Islem adi (detayli)",
      "machine": "Tezgah kodu ve adi (ornek: T109 - DMG CLX 450)",
      "tool": "Takim (tip, boyut, ISO kodu, dis sayisi, uc yaricapi)",
      "toolNumber": "T01",
      "cuttingSpeed": "Vc (m/dk)",
      "feedRate": "f (mm/dev) veya fz (mm/dis) - islem tipine gore",
      "tableFeed": "F (mm/dk) - frezeleme icin hesaplanmis",
      "depthOfCut": "ap (mm)",
      "radialDepth": "ae (mm) - frezeleme icin",
      "spindleSpeed": "n (dev/dk) - hesaplanmis, tezgah limitine uygun",
      "numberOfPasses": "Paso sayisi",
      "coolant": "Sogutma tipi",
      "estimatedTime": "TOPLAM islem suresi (dk)",
      "notes": "Hesaplama detayi: n=..., F=..., T_kesme=..., +ek sureler=..., TOPLAM=..."
    }
  ],
  "totalMachiningTime": "Toplam tezgah suresi (dk) - sadece isleme",
  "totalEstimatedTime": "Toplam sure (dk) - SADECE isleme suresi, hazirlik suresi DAHIL EDILMEZ",
  "setupTime": "Hazirlik suresi (dk) - detayli aciklama",
  "recommendations": ["Strateji onerisi 1", "Oneri 2"],
  "tolerances": "Tespit edilen toleranslar ve tolerans siniflari",
  "surfaceFinish": "Yuzey kalitesi gereksinimleri (Ra degerleri)",
  "criticalFeatures": "Kritik olculer ve ozel dikkat gerektiren noktalar",
  "machinesRequired": ["T109 - DMG CLX 450", "T121 - Okuma M560R-V"],
  "toolList": ["T01: CNMG 120408 - kaba tornalama", "T02: DNMG 110404 - ince tornalama"],
  "difficultyNotes": "Zorluk, dikkat edilecekler, ozel stratejiler"
}

Sadece JSON dondur, baska metin ekleme. JSON icerisindeki string degerlerde cift tirnak (") karakteri KULLANMA, bunun yerine tek tirnak (') kullan. JSON gecerli olmali.`;

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
        temperature: 0,
        seed: 42,
        top_p: 1,
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

    // Parse JSON from response - with robust error recovery
    let jsonStr = "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Could not parse response:", content.substring(0, 500));
      throw new Error("AI yanıtı işlenemedi");
    }
    jsonStr = jsonMatch[0];

    let analysis;
    try {
      analysis = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("JSON parse error, attempting fix:", parseErr.message);
      // Try to fix common JSON issues from AI responses
      // Fix trailing commas before } or ]
      let fixed = jsonStr.replace(/,\s*([}\]])/g, '$1');
      // Fix unescaped quotes inside string values
      fixed = fixed.replace(/:\s*"([^"]*?)(?<!\\)"([^"]*?)"/g, (match, p1, p2) => {
        if (p2.includes(':') || p2.includes('{') || p2.includes('[')) return match;
        return `: "${p1}\\"${p2}"`;
      });
      try {
        analysis = JSON.parse(fixed);
        console.log("JSON fixed successfully");
      } catch (fixErr) {
        console.error("Could not fix JSON:", fixErr.message);
        console.error("Raw content (first 2000 chars):", jsonStr.substring(0, 2000));
        throw new Error("AI yanıtı JSON formatında işlenemedi, lütfen tekrar deneyin.");
      }
    }

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
