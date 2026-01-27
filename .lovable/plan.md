
# GAGE Confidence Toolroom - Kapsamlı Geliştirme Planı

Bu plan, CNC kesici takım hesaplayıcı uygulamasını üç ana alanda geliştirecek: kullanıcı hesapları/bulut senkronizasyonu, yeni hesaplama modülleri ve gelişmiş raporlama özellikleri.

---

## Genel Bakış

```text
+------------------------------------------+
|        GAGE Confidence Toolroom          |
+------------------------------------------+
              |
    +---------+---------+---------+
    |         |         |         |
    v         v         v         v
+-------+ +-------+ +-------+ +-------+
| Auth  | | Yeni  | | Rapor | | Bulut |
| Sist. | | Modül | | lama  | | Sync  |
+-------+ +-------+ +-------+ +-------+
    |         |         |         |
    +----+----+----+----+----+----+
         |              |
    +----v----+    +----v----+
    |Supabase |    |   PDF   |
    |Database |    | Export  |
    +---------+    +---------+
```

---

## 1. Kullanıcı Hesapları ve Bulut Senkronizasyonu

Lovable Cloud (Supabase) kullanılarak tam entegre bir kimlik doğrulama ve veri senkronizasyonu sistemi kurulacak.

### 1.1 Veritabanı Yapısı

Yeni tablolar:
- **profiles**: Kullanıcı profil bilgileri (ad, şirket, pozisyon)
- **saved_materials**: Kullanıcının özel malzemeleri (bulutta)
- **saved_calculations**: Hesaplama geçmişi (bulutta)
- **work_orders**: İş emirleri (bulutta)
- **user_preferences**: Kullanıcı tercihleri

### 1.2 Kimlik Doğrulama Sayfası

- `/auth` rotasında yeni bir sayfa
- E-posta/şifre ile giriş ve kayıt
- Şifremi unuttum fonksiyonu
- Oturum durumu yönetimi
- Otomatik yönlendirme (giriş yapmış kullanıcı ana sayfaya)

### 1.3 Senkronizasyon Mantığı

- localStorage'daki mevcut veriler buluta taşınabilir
- Cihazlar arası gerçek zamanlı senkronizasyon
- Çevrimdışı mod desteği (localStorage yedekleme)

---

## 2. Yeni Hesaplama Modülleri

### 2.1 Diş Açma Hesaplayıcı (Threading Calculator)

Özellikler:
- Metrik/İnç diş standartları (M, G, UN, BSPT)
- Diş adımı ve derinlik hesabı
- Kılavuz/Pafta seçimi
- Uygun devir ve ilerleme önerileri
- Diş kontrolü için ölçüm hesabı

### 2.2 Taşlama Hesaplayıcı (Grinding Calculator)

Özellikler:
- Taş seçimi (alüminyum oksit, silisyum karbür, CBN, elmas)
- Taş hızı ve iş parçası hızı hesabı
- Ilerleme miktarı ve derinlik önerileri
- Soğutma sıvısı gereksinimleri
- Yüzey kalitesi tahmini (Ra değeri)

### 2.3 Delme/Kılavuz Çekme Hesaplayıcı (Drill/Tap Calculator)

Özellikler:
- Matkap çapı seçimi (diş için ön delme)
- Kesme hızı ve ilerleme hesabı
- Kılavuz çekme momenti tahmini
- Kırılma riski analizi
- Soğutma/yağlama önerileri

---

## 3. Raporlama ve Veri Görselleştirme

### 3.1 Gelişmiş Dashboard

Ana sayfaya eklenecek özet paneli:
- Günlük/haftalık/aylık hesaplama istatistikleri
- En çok kullanılan malzemeler (pasta grafik)
- Takım tüketim trendi (çizgi grafik)
- Maliyet özeti kartları

### 3.2 Gelişmiş PDF Raporları

Profesyonel rapor şablonları:
- Şirket logosu ve başlık
- Hesaplama detayları tablosu
- Grafik ve görsel eklemeleri
- Çoklu hesaplama karşılaştırması
- İş emri özet raporu

### 3.3 Veri Dışa Aktarma

- Excel/CSV formatında dışa aktarma
- Toplu hesaplama raporu
- Özel tarih aralığı seçimi

---

## Teknik Uygulama Detayları

### Aşama 1: Supabase Entegrasyonu (Öncelik: Yüksek)

1. Lovable Cloud aktivasyonu
2. Veritabanı tablolarının oluşturulması:
   - `profiles` tablosu
   - `saved_materials` tablosu
   - `saved_calculations` tablosu
   - `work_orders` tablosu
   - `user_preferences` tablosu
3. RLS (Row Level Security) politikaları
4. Auth sayfası ve oturum yönetimi
5. Mevcut localStorage verilerinin migrasyonu

### Aşama 2: Yeni Hesaplama Modülleri (Öncelik: Orta)

1. Veri dosyaları:
   - `src/data/threadingData.ts` (diş standartları)
   - `src/data/grindingData.ts` (taşlama parametreleri)
2. Bileşenler:
   - `src/components/ThreadingCalculator.tsx`
   - `src/components/GrindingCalculator.tsx`
   - `src/components/DrillTapCalculator.tsx`
3. Tab navigasyonuna entegrasyon
4. Hesaplama sonuçlarını kaydetme

### Aşama 3: Raporlama Geliştirmeleri (Öncelik: Orta)

1. Dashboard bileşeni:
   - `src/components/Dashboard.tsx`
   - Özet istatistik kartları
   - Etkileşimli grafikler
2. PDF geliştirmeleri:
   - Logo ve şirket bilgisi ekleme
   - Grafik görsellerini PDF'e aktarma
   - Profesyonel şablon tasarımı
3. Dışa aktarma özellikleri:
   - CSV/Excel export fonksiyonları
   - Tarih filtresi bileşeni

---

## Yeni Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `src/pages/Auth.tsx` | Giriş/kayıt sayfası |
| `src/contexts/AuthContext.tsx` | Kimlik doğrulama context'i |
| `src/components/Dashboard.tsx` | İstatistik dashboard'u |
| `src/components/ThreadingCalculator.tsx` | Diş açma hesaplayıcı |
| `src/components/GrindingCalculator.tsx` | Taşlama hesaplayıcı |
| `src/components/DrillTapCalculator.tsx` | Delme/kılavuz hesaplayıcı |
| `src/data/threadingData.ts` | Diş standartları verileri |
| `src/data/grindingData.ts` | Taşlama parametreleri |
| `src/hooks/useSupabaseSync.ts` | Senkronizasyon hook'u |
| `src/lib/exportUtils.ts` | Dışa aktarma yardımcıları |

---

## Değiştirilecek Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `src/App.tsx` | Auth rotası, AuthProvider ekleme |
| `src/pages/Index.tsx` | Dashboard, yeni tab'lar, auth kontrolü |
| `src/components/Header.tsx` | Kullanıcı menüsü, çıkış butonu |
| `src/components/CalculationHistory.tsx` | Bulut senkronizasyonu |
| `src/components/MaterialList.tsx` | Bulut kaydetme |
| `src/components/WorkOrderPlanner.tsx` | Bulut kaydetme |

---

## Önerilen Uygulama Sırası

1. **İlk Adım**: Supabase/Lovable Cloud aktivasyonu (kullanıcı onayı gerekli)
2. **Veritabanı**: Tablo yapısı ve RLS politikaları
3. **Auth Sistemi**: Giriş/kayıt sayfası ve oturum yönetimi
4. **Veri Migrasyonu**: localStorage'dan buluta geçiş
5. **Yeni Modüller**: Diş açma, taşlama, delme hesaplayıcıları
6. **Dashboard**: İstatistik ve grafik paneli
7. **Raporlama**: Gelişmiş PDF ve dışa aktarma

---

## Notlar

- Supabase entegrasyonu için önce Lovable Cloud'un etkinleştirilmesi gerekiyor
- Mevcut localStorage verileri kaybedilmeyecek, buluta taşınabilecek
- Her hesaplama modülü bağımsız olarak geliştirilebilir
- Kullanıcı giriş yapmadan da temel özellikleri kullanabilir (opsiyonel auth)
