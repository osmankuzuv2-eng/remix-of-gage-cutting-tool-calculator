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
    const body = await req.json();

    // Handle training action - store approved feedbacks for future use
    if (body.action === "train") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseClient = createClient(supabaseUrl, supabaseKey);
      
      // Just mark feedbacks as applied - they'll be fetched during analysis
      return new Response(JSON.stringify({ success: true, message: "Eğitim verileri güncellendi" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageUrl, fileName, additionalInfo, factory, material, customerSpecs, language = "tr" } = body;

    const langInstruction = language === "en"
      ? "IMPORTANT: Respond in ENGLISH. All text values in the JSON (operation names, descriptions, recommendations, notes, tolerances, surface finish, difficulty notes, clamping descriptions, etc.) MUST be in English."
      : language === "fr"
      ? "IMPORTANT: Répondez en FRANÇAIS. Toutes les valeurs textuelles dans le JSON (noms d'opérations, descriptions, recommandations, notes, tolérances, état de surface, notes de difficulté, descriptions de bridage, etc.) DOIVENT être en français."
      : "Tüm metin değerleri Türkçe olsun.";

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

    // Fetch machines from database, filtered by factory if provided
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    let machinesQuery = supabaseClient
      .from("machines")
      .select("code, type, designation, brand, model, year, max_diameter_mm, power_kw, max_rpm, taper, has_live_tooling, has_y_axis, has_c_axis, travel_x_mm, travel_y_mm, travel_z_mm, factory")
      .eq("is_active", true);
    
    if (factory) {
      machinesQuery = machinesQuery.eq("factory", factory);
    }
    
    const { data: machinesData } = await machinesQuery.order("sort_order");

    const machines = machinesData || [];

    // Fetch approved feedbacks for AI training context
    const { data: feedbackData } = await supabaseClient
      .from("analysis_feedback")
      .select("part_name, feedback_text, feedback_type, original_analysis")
      .eq("status", "approved")
      .not("applied_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);

    const approvedFeedbacks = feedbackData || [];

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

      let section = `KULLANILABILIR MAKINE PARKI${factory ? ` (${factory} Fabrikası)` : ""} (SADECE bu tezgahlardan sec):\n`;
      if (turning.length) section += `CNC TORNALAR:\n${turning.map(fmt).join("\n")}\n\n`;
      if (milling3.length) section += `3 EKSEN CNC FREZELER:\n${milling3.map(fmt).join("\n")}\n\n`;
      if (milling4.length) section += `4 EKSEN CNC FREZELER:\n${milling4.map(fmt).join("\n")}\n\n`;
      if (milling5.length) section += `3+2 / 5 EKSEN CNC FREZELER:\n${milling5.map(fmt).join("\n")}\n\n`;
      return section;
    };

    const machineSection = buildMachineSection();

    const imageContent = { type: "image_url" as const, image_url: { url: imageUrl } };

    const systemPrompt = `Sen 20+ yil deneyimli, gercek bir CNC atolyesinde calisan uzman makine muhendisisin. Teknik resimleri analiz edip GERCEKCI isleme plani ve sureler olusturuyorsun.

KESME STRATEJISI: DENGELI (BALANCED) - Takim omru + Uretkenlik dengesi
- Vc: Malzeme araliginin ORTASINI kullan (%45-60 arasi) - Ne cok hizli ne cok yavas. Takim omrunu ON PLANDA TUT.
- f (tornalama): ORTA deger kullan - kaba islemlerde aralik orta-ust arasi, ince islemlerde aralik ortasi
- fz (frezeleme): Dis basina ilerleme kullan, takim dis sayisina gore F_tablasi = fz × z × n; kaba islemde aralik ortasi fz deger
- ap: DENGELI derinlik - takim omrunu koruyacak makul paso derinlikleri kullan
- KABA FREZELEME icin ap MAKSIMUM 2.5 mm! Asla 2.5 mm uzerinde ap kullanma.
- TARAMA (finishing/surface milling) operasyonlarinda ap MAKSIMUM 1 mm! Tarama islemlerinde asla 1 mm uzerinde ap kullanma.
- KABA TORNALAMA icin ap MAKSIMUM 4 mm (celik), 5 mm (aluminyum)
- INCE TORNALAMA icin ap = 0.2-0.5 mm
- Paso sayisini MAKUL tut - cok fazla paso da cok az paso da olmasin
- TAKIM OMRU: Her islemde hangi takim ile kac parca islenebilecegini dusun. Yuksek Vc takim omrunu ciddi dusuruyor.

TAKIM OMRU REHBERI (karbur takim, ortalama):
- Celik (St37/C45) tornalama: Vc=180-220 m/dk araliginda T≈20-35 dk (bir takim agzi omru)
- Celik frezeleme: Vc=80-100 m/dk araliginda T≈25-45 dk
- Paslanmaz celik: Vc=130-160 m/dk T≈15-25 dk (asindirici malzeme, dikkatli ol)
- Aluminyum (6xxx): Vc=450-650 m/dk T≈60-90 dk (uzun takim omru)
- Aluminyum (7075): Vc=350-450 m/dk T≈50-80 dk
- Titanyum: Vc=40-55 m/dk T≈15-25 dk (dusuk Vc sart, yoksa takim erken bozulur)
- Inconel/Super alasim: Vc=15-22 m/dk T≈10-20 dk (Vc KESINLIKLE aralik ortasini gecme)
- UYARI: Vc araligin ust sinirini kullanirsaniz takim omru YARISINA DUSUYOR. Orta deger tercih et.

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

MALZEME BAZLI KESME PARAMETRELERI (KARBUR TAKIM - DENGELI/ORTALAMA DEGERLER, takim omru on planda):

TORNALAMA PARAMETRELERI (KULLAN: aralik ortasi-ust yuzde 50-60 ARASI - takim omru dengeli):
- Celik (St37, S235, St52): Vc=190-230 m/dk [HEDEF: ~210 m/dk], f=0.22-0.30 mm/dev (kaba), f=0.08-0.12 mm/dev (ince), ap=2-3.5 mm (kaba), ap=0.2-0.4 mm (ince) | Takim omru T≈25-35 dk
- Celik (C45, 4140, 42CrMo4): Vc=160-200 m/dk [HEDEF: ~180 m/dk], f=0.18-0.25 mm/dev (kaba), f=0.07-0.10 mm/dev (ince), ap=1.5-3 mm (kaba), ap=0.2-0.4 mm (ince) | Takim omru T≈20-30 dk
- Celik (sertlestirilmis >45 HRC): Vc=80-100 m/dk [HEDEF: ~90 m/dk], f=0.08-0.12 mm/dev, ap=0.1-0.4 mm (CBN veya seramik takim) | Takim omru T≈15-25 dk
- Paslanmaz celik (304, 316): Vc=130-160 m/dk [HEDEF: ~145 m/dk], f=0.13-0.20 mm/dev (kaba), f=0.06-0.10 mm/dev (ince), ap=1-2.5 mm (kaba) | Takim omru T≈15-22 dk
- Paslanmaz celik (17-4PH, duplex): Vc=95-125 m/dk [HEDEF: ~110 m/dk], f=0.10-0.16 mm/dev (kaba), f=0.05-0.08 mm/dev (ince) | Takim omru T≈12-20 dk
- Aluminyum (6xxx serisi): Vc=450-650 m/dk [HEDEF: ~550 m/dk], f=0.25-0.40 mm/dev (kaba), f=0.10-0.18 mm/dev (ince), ap=1.5-2.5 mm (kaba), ap=0.2-0.4 mm (ince) | Takim omru T≈60-90 dk
- Aluminyum 7050/7075: Vc=350-450 m/dk [HEDEF: ~400 m/dk], f=0.18-0.28 mm/dev (kaba), f=0.08-0.12 mm/dev (ince), ap=1-2 mm (kaba), ap=0.2-0.4 mm (ince) | Takim omru T≈50-80 dk
- Pirinc / Bronz: Vc=200-280 m/dk [HEDEF: ~240 m/dk], f=0.15-0.25 mm/dev (kaba), f=0.05-0.10 mm/dev (ince) | Takim omru T≈40-60 dk
- Dokme demir (GG25/GGG40): Vc=120-160 m/dk [HEDEF: ~140 m/dk], f=0.18-0.25 mm/dev (kaba), f=0.08-0.12 mm/dev (ince), ap=2-3.5 mm (kaba) | Takim omru T≈20-30 dk
- Titanyum (Ti6Al4V): Vc=38-52 m/dk [HEDEF: ~45 m/dk], f=0.10-0.15 mm/dev (kaba), f=0.05-0.07 mm/dev (ince), ap=0.5-1.5 mm (kaba) | Takim omru T≈15-22 dk - YUKSEK Vc TAKIM OMRUNU MAHVEDER
- SUPER ALASIMLAR (Inconel 718, Waspaloy): Vc=14-22 m/dk [HEDEF: ~18 m/dk], f=0.08-0.12 mm/dev (kaba), f=0.03-0.05 mm/dev (ince), ap=0.3-1 mm (kaba) | Takim omru T≈10-18 dk - Vc KATIYEN 25 m/dk yi gecme

FREZELEME PARAMETRELERI (fz = dis basina ilerleme, DENGELI DEGERLER):
- Celik (St37, S235): Vc=80-100 m/dk [HEDEF: ~90 m/dk], fz=0.09-0.14 mm/dis (kaba), fz=0.05-0.08 mm/dis (ince), ap=1-2 mm (kaba), ae=%50-65 Dc (kaba) | T≈30-45 dk
- Celik (C45, 4140): Vc=80-100 m/dk [HEDEF: ~90 m/dk], fz=0.07-0.12 mm/dis (kaba), fz=0.04-0.07 mm/dis (ince), ap=0.75-1.75 mm (kaba) | T≈25-40 dk
- Paslanmaz celik: Vc=115-145 m/dk [HEDEF: ~130 m/dk], fz=0.05-0.09 mm/dis (kaba), fz=0.03-0.06 mm/dis (ince), ap=0.5-1.2 mm (kaba) | T≈15-25 dk
- Aluminyum (6xxx): Vc=450-650 m/dk [HEDEF: ~550 m/dk], fz=0.12-0.20 mm/dis (kaba), fz=0.05-0.10 mm/dis (ince), ap=0.75-1.5 mm (kaba), ae=%50-65 Dc | T≈60-90 dk
- Aluminyum 7050/7075: Vc=350-450 m/dk [HEDEF: ~400 m/dk], fz=0.10-0.16 mm/dis (kaba), fz=0.04-0.08 mm/dis (ince), ap=0.5-1.1 mm (kaba), ae=%40-55 Dc | T≈50-80 dk
- Dokme demir: Vc=120-150 m/dk [HEDEF: ~135 m/dk], fz=0.10-0.15 mm/dis (kaba), fz=0.05-0.09 mm/dis (ince) | T≈25-40 dk
- Titanyum: Vc=28-48 m/dk [HEDEF: ~38 m/dk], fz=0.04-0.08 mm/dis, ap=0.25-0.8 mm, ae=%15-25 Dc (trochoidal onerılir) | T≈12-20 dk
- Super alasim: Vc=12-20 m/dk [HEDEF: ~16 m/dk], fz=0.03-0.06 mm/dis, ap=0.15-0.6 mm, ae=%10-18 Dc | T≈10-18 dk

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

GERCEKCI ISLEM SURELERI (referans - DENGELI strateji, ORTALAMA SURELER - ne cok hizli ne cok yavas):
Normal celik/aluminyum:
- Alin tornalama: 0.4-1.0 dk
- Kaba tornalama (kisa parca <100mm): 1.0-3.5 dk
- Kaba tornalama (uzun parca >100mm): 2.5-6 dk
- Ince tornalama: 0.6-2.0 dk
- Delme (kisa L<3D): 0.3-0.8 dk
- Delme (derin L>3D): 0.8-2.5 dk (peck drilling dahil)
- Dis tornalama: 0.8-2.5 dk (paso sayisina bagli)
- Kanal tornalama: 0.4-1.5 dk
- Pah kirma: 0.08-0.20 dk (basit pah 5-8 sn, buyuk pah 10-15 sn)
- Kaba frezeleme: 3-12 dk (yuzey alanina gore)
- Ince frezeleme: 2-6 dk
- Cep frezeleme: 5-18 dk (hacme gore)
- Taslama: 4-12 dk

Super alasim / Titanyum (3-5 KAT fazla - takim omru cok kisa, dikkatli ol):
- Kaba tornalama: 5-18 dk
- Ince tornalama: 2.5-6 dk
- Delme: 2-5 dk (kisa), 4-10 dk (derin)
- Frezeleme: 12-40 dk

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
- Cok kisa sureler VERME - her islem en az 0.4 dk
- SADECE yukardaki makine parkindan sec
- Frezelemede fz (dis basina ilerleme) kullan, f (devir basina ilerleme) KULLANMA
- Tornada spindle n ASLA 4500 uzerine cikma
- Toleransli olculerde olcum suresi EKLEmeyi unutma
- Ham malzeme olcusunu belirt (parca olcusu + isleme payi)
- Toplam islem suresi GERCEKCI olsun - ne cok kisa ne cok uzun
- TAKIM OMRU: Vc degerini ASLA maksimum aralik uzerine cikartma. Hedef her zaman aralik ortasi olmali. Yuksek Vc = kisa takim omru = daha sik takim degisimi = DAHA YUKSEK MALIYET
- Her islem notuna takim omru tahmini ekle (T≈ X dk formatinda)

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

    // Append approved feedback context to system prompt
    let feedbackContext = "";
    if (approvedFeedbacks.length > 0) {
      feedbackContext = "\n\nONEMLI - ONCEKI ANALIZLERDEN ALINAN DUZELTMELER (bunlara dikkat et):\n";
      for (const fb of approvedFeedbacks) {
        feedbackContext += `- [${fb.part_name}] ${fb.feedback_text}\n`;
      }
    }

    const finalSystemPrompt = systemPrompt + feedbackContext + "\n\n" + langInstruction;

    let userMessage = "";
    if (material) {
      const matMsg = language === "en"
        ? `Analyze this technical drawing. MATERIAL IS SPECIFIED BY USER: ${material.name} (Category: ${material.category}, Hardness: ${material.hardness}, Cutting Speed: ${material.cuttingSpeed.min}-${material.cuttingSpeed.max} ${material.cuttingSpeed.unit}, Feed Rate: ${material.feedRate.min}-${material.feedRate.max} ${material.feedRate.unit}, Taylor n=${material.taylorN}, Taylor C=${material.taylorC}). Calculate all cutting parameters based on this material. DO NOT use the material info from the drawing, use the user-selected material.`
        : language === "fr"
        ? `Analysez ce dessin technique. MATÉRIAU SPÉCIFIÉ PAR L'UTILISATEUR: ${material.name} (Catégorie: ${material.category}, Dureté: ${material.hardness}, Vitesse de coupe: ${material.cuttingSpeed.min}-${material.cuttingSpeed.max} ${material.cuttingSpeed.unit}, Avance: ${material.feedRate.min}-${material.feedRate.max} ${material.feedRate.unit}, Taylor n=${material.taylorN}, Taylor C=${material.taylorC}). Calculez tous les paramètres de coupe en fonction de ce matériau. N'utilisez PAS les informations de matériau du dessin, utilisez le matériau sélectionné par l'utilisateur.`
        : `Bu teknik resmi analiz et. MALZEME KULLANICI TARAFINDAN BELİRLENMİŞTİR: ${material.name} (Kategori: ${material.category}, Sertlik: ${material.hardness}, Kesme Hızı: ${material.cuttingSpeed.min}-${material.cuttingSpeed.max} ${material.cuttingSpeed.unit}, İlerleme: ${material.feedRate.min}-${material.feedRate.max} ${material.feedRate.unit}, Taylor n=${material.taylorN}, Taylor C=${material.taylorC}). Bu malzemeye göre tüm kesme parametrelerini hesapla. Resimdeki malzeme bilgisini DIKKATE ALMA, kullanıcının seçtiği malzemeyi kullan.`;
      userMessage = matMsg;
    } else {
      userMessage = language === "en"
        ? "Analyze this technical drawing. Carefully read all critical dimensions, tolerances and surface roughness values and create a detailed machining plan."
        : language === "fr"
        ? "Analysez ce dessin technique. Lisez attentivement toutes les cotes critiques, tolérances et valeurs de rugosité de surface et créez un plan d'usinage détaillé."
        : "Bu teknik resmi analiz et. Tüm kritik ölçüleri, toleransları ve yüzey pürüzlülük değerlerini dikkatlice oku ve detaylı işleme planı oluştur.";
    }
    if (additionalInfo) {
      userMessage += language === "en" ? ` Additional info: ${additionalInfo}` : language === "fr" ? ` Informations supplémentaires: ${additionalInfo}` : ` Ek bilgiler: ${additionalInfo}`;
    }
    if (customerSpecs) {
      userMessage += language === "en" ? ` CUSTOMER SPECS (you must strictly comply with these requirements): ${customerSpecs}` : language === "fr" ? ` SPÉCIFICATIONS CLIENT (vous devez strictement respecter ces exigences): ${customerSpecs}` : ` MÜŞTERİ SPECLERİ (bu gereksinimlere kesinlikle uymalısın): ${customerSpecs}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: finalSystemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userMessage },
              imageContent,
            ],
          },
        ],
        temperature: 0,
        top_p: 1,
        response_format: { type: "json_object" },
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
    // Strip markdown code blocks (```json ... ``` or ``` ... ```)
    const stripped = content.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Could not parse response:", content.substring(0, 500));
      throw new Error("AI yanıtı işlenemedi");
    }
    // Remove bad control characters inside JSON strings (e.g. unescaped newlines, tabs)
    jsonStr = jsonMatch[0].replace(/[\u0000-\u001F\u007F]/g, (ch, offset, str) => {
      // Only replace control chars that are INSIDE string values (not structural whitespace)
      // Replace with space to keep value readable
      const before = str.lastIndexOf('"', offset);
      const afterColon = str.lastIndexOf(':', offset);
      if (before > afterColon) return " ";
      return ch;
    });

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
