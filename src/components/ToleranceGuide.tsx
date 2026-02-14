import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ISO 286-1 Temel Tolerans Dereceleri (IT) - mikron cinsinden
const itGrades: { range: string; IT01: number; IT0: number; IT1: number; IT2: number; IT3: number; IT4: number; IT5: number; IT6: number; IT7: number; IT8: number; IT9: number; IT10: number; IT11: number; IT12: number; IT13: number }[] = [
  { range: "1-3", IT01: 0.3, IT0: 0.5, IT1: 0.8, IT2: 1.2, IT3: 2, IT4: 3, IT5: 4, IT6: 6, IT7: 10, IT8: 14, IT9: 25, IT10: 40, IT11: 60, IT12: 100, IT13: 140 },
  { range: "3-6", IT01: 0.4, IT0: 0.6, IT1: 1, IT2: 1.5, IT3: 2.5, IT4: 4, IT5: 5, IT6: 8, IT7: 12, IT8: 18, IT9: 30, IT10: 48, IT11: 75, IT12: 120, IT13: 180 },
  { range: "6-10", IT01: 0.4, IT0: 0.6, IT1: 1, IT2: 1.5, IT3: 2.5, IT4: 4, IT5: 6, IT6: 9, IT7: 15, IT8: 22, IT9: 36, IT10: 58, IT11: 90, IT12: 150, IT13: 220 },
  { range: "10-18", IT01: 0.5, IT0: 0.8, IT1: 1.2, IT2: 2, IT3: 3, IT4: 5, IT5: 8, IT6: 11, IT7: 18, IT8: 27, IT9: 43, IT10: 70, IT11: 110, IT12: 180, IT13: 270 },
  { range: "18-30", IT01: 0.6, IT0: 1, IT1: 1.5, IT2: 2.5, IT3: 4, IT4: 6, IT5: 9, IT6: 13, IT7: 21, IT8: 33, IT9: 52, IT10: 84, IT11: 130, IT12: 210, IT13: 330 },
  { range: "30-50", IT01: 0.6, IT0: 1, IT1: 1.5, IT2: 2.5, IT3: 4, IT4: 7, IT5: 11, IT6: 16, IT7: 25, IT8: 39, IT9: 62, IT10: 100, IT11: 160, IT12: 250, IT13: 390 },
  { range: "50-80", IT01: 0.8, IT0: 1, IT1: 2, IT2: 3, IT3: 5, IT4: 8, IT5: 13, IT6: 19, IT7: 30, IT8: 46, IT9: 74, IT10: 120, IT11: 190, IT12: 300, IT13: 460 },
  { range: "80-120", IT01: 1, IT0: 1.5, IT1: 2.5, IT2: 4, IT3: 6, IT4: 10, IT5: 15, IT6: 22, IT7: 35, IT8: 54, IT9: 87, IT10: 140, IT11: 220, IT12: 350, IT13: 540 },
  { range: "120-180", IT01: 1.2, IT0: 2, IT1: 3.5, IT2: 5, IT3: 8, IT4: 12, IT5: 18, IT6: 25, IT7: 40, IT8: 63, IT9: 100, IT10: 160, IT11: 250, IT12: 400, IT13: 630 },
  { range: "180-250", IT01: 2, IT0: 3, IT1: 4.5, IT2: 7, IT3: 10, IT4: 14, IT5: 20, IT6: 29, IT7: 46, IT8: 72, IT9: 115, IT10: 185, IT11: 290, IT12: 460, IT13: 720 },
  { range: "250-315", IT01: 2.5, IT0: 4, IT1: 6, IT2: 8, IT3: 12, IT4: 16, IT5: 23, IT6: 32, IT7: 52, IT8: 81, IT9: 130, IT10: 210, IT11: 320, IT12: 520, IT13: 810 },
  { range: "315-400", IT01: 3, IT0: 5, IT1: 7, IT2: 9, IT3: 13, IT4: 18, IT5: 25, IT6: 36, IT7: 57, IT8: 89, IT9: 140, IT10: 230, IT11: 360, IT12: 570, IT13: 890 },
  { range: "400-500", IT01: 4, IT0: 6, IT1: 8, IT2: 10, IT3: 15, IT4: 20, IT5: 27, IT6: 40, IT7: 63, IT8: 97, IT9: 155, IT10: 250, IT11: 400, IT12: 630, IT13: 970 },
];

// Yaygın geçme/oturma türleri
const fitTypes = [
  { code: "H7/h6", name: "Kayar Geçme", type: "Geçiş", desc: "Mil deliğe elle kayarak girer. Kılavuz pimleri, hassas sürgüler.", color: "text-blue-400" },
  { code: "H7/k6", name: "Sabit Geçme", type: "Geçiş", desc: "Hafif presle montaj. Dişli göbekleri, kavrama parçaları.", color: "text-cyan-400" },
  { code: "H7/n6", name: "Sıkı Geçme", type: "Sıkı", desc: "Presle montaj gerekir. Burçlar, yatak yuvaları.", color: "text-orange-400" },
  { code: "H7/p6", name: "Pres Geçme", type: "Sıkı", desc: "Kuvvetli pres veya ısıtma gerekir. Kalıcı montajlar.", color: "text-red-400" },
  { code: "H7/s6", name: "Büzme Geçme", type: "Sıkı", desc: "Isıtma/soğutma ile montaj. Ağır yük taşıyan bağlantılar.", color: "text-red-500" },
  { code: "H7/f7", name: "Serbest Döner Geçme", type: "Boşluklu", desc: "Sürtünmeli yataklar, uzun miller, serbest dönüş.", color: "text-green-400" },
  { code: "H7/g6", name: "Hassas Döner Geçme", type: "Boşluklu", desc: "Hassas kayar bağlantılar, rulman montajı.", color: "text-emerald-400" },
  { code: "H11/c11", name: "Gevşek Geçme", type: "Boşluklu", desc: "Geniş boşluk, kaba montajlar, kaynak yapıları.", color: "text-yellow-400" },
  { code: "H9/d9", name: "Döner Geçme", type: "Boşluklu", desc: "Yağlama gerektiren döner bağlantılar, pompa milleri.", color: "text-lime-400" },
  { code: "H7/e8", name: "Normal Döner", type: "Boşluklu", desc: "Redüktör, transmisyon milleri, genel mekanik.", color: "text-teal-400" },
];

// Yüzey pürüzlülüğü
const surfaceRoughness = [
  { ra: "0.025", process: "Süper Finish, Honlama", application: "Ölçü etalonu, optik yüzeyler", grade: "N1" },
  { ra: "0.05", process: "Honlama, Lepleme", application: "Hassas rulman yuvaları, conta yüzeyleri", grade: "N2" },
  { ra: "0.1", process: "Lepleme, İnce Taşlama", application: "Hassas mil yatakları, hidrolik silindir", grade: "N3" },
  { ra: "0.2", process: "İnce Taşlama", application: "Rulman bilezikleri, hassas dişliler", grade: "N4" },
  { ra: "0.4", process: "Taşlama, İnce Tornalama", application: "Krank mili, kam mili yatakları", grade: "N5" },
  { ra: "0.8", process: "Taşlama, Hassas Tornalama", application: "Mil yatakları, piston segman yuvaları", grade: "N6" },
  { ra: "1.6", process: "İnce Tornalama/Frezeleme", application: "Dişli yüzeyleri, sürgü yüzeyleri", grade: "N7" },
  { ra: "3.2", process: "Tornalama, Frezeleme", application: "Genel makina parçaları, kapak yüzeyleri", grade: "N8" },
  { ra: "6.3", process: "Kaba Tornalama/Frezeleme", application: "Yapısal parçalar, kaynak hazırlığı", grade: "N9" },
  { ra: "12.5", process: "Kaba İşleme", application: "İşlenmemiş yüzeyler, döküm yüzeyleri", grade: "N10" },
  { ra: "25", process: "Testere, Planya", application: "Kaba yapılar, görünmeyen yüzeyler", grade: "N11" },
];

// Geometrik toleranslar
const geoTolerances = [
  { symbol: "⏤", name: "Düzlük", category: "Biçim", desc: "Yüzeyin ideal düzlemden max sapması", typical: "0.01 - 0.1 mm" },
  { symbol: "⏊", name: "Diklik", category: "Yön", desc: "İki yüzey/eksen arası 90° sapması", typical: "0.02 - 0.1 mm" },
  { symbol: "∥", name: "Paralellik", category: "Yön", desc: "İki yüzey/eksen arası paralellik sapması", typical: "0.01 - 0.05 mm" },
  { symbol: "○", name: "Dairesellik", category: "Biçim", desc: "Kesit dairesinin idealden sapması", typical: "0.005 - 0.05 mm" },
  { symbol: "⌭", name: "Silindiriklik", category: "Biçim", desc: "Silindirik yüzeyin idealden sapması", typical: "0.01 - 0.1 mm" },
  { symbol: "⌀", name: "Konum (Pozisyon)", category: "Konum", desc: "Delik/özelliğin ideal konumdan sapması", typical: "0.05 - 0.5 mm" },
  { symbol: "◎", name: "Eş Merkezlilik", category: "Konum", desc: "İki eksenin çakışma sapması", typical: "0.01 - 0.05 mm" },
  { symbol: "↗", name: "Açısallık", category: "Yön", desc: "Yüzey/eksenin belirli açıdan sapması", typical: "0.02 - 0.1 mm" },
  { symbol: "⌓", name: "Profil (Hat)", category: "Biçim", desc: "Eğrisel hattın ideal profilden sapması", typical: "0.02 - 0.2 mm" },
  { symbol: "↺", name: "Dairesel Salınım", category: "Salınım", desc: "Eksende dönerken radyal sapma", typical: "0.01 - 0.05 mm" },
  { symbol: "↺↺", name: "Toplam Salınım", category: "Salınım", desc: "Tüm yüzey boyunca toplam salınım", typical: "0.02 - 0.1 mm" },
];

// Tolerans hesaplama
const ToleranceCalculator = () => {
  const [nominalSize, setNominalSize] = useState("");
  const [itGrade, setItGrade] = useState("IT7");

  const getToleranceValue = () => {
    const size = parseFloat(nominalSize);
    if (isNaN(size) || size <= 0) return null;

    const gradeKey = itGrade.replace("IT", "IT") as keyof typeof itGrades[0];
    const row = itGrades.find(r => {
      const [min, max] = r.range.split("-").map(Number);
      return size > min && size <= max;
    });

    if (!row) return null;
    return (row as any)[gradeKey] as number | undefined;
  };

  const tolerance = getToleranceValue();

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">🔧 Tolerans Hesaplayıcı</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Nominal Ölçü (mm)</Label>
            <Input
              type="number"
              placeholder="ör: 25"
              value={nominalSize}
              onChange={e => setNominalSize(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Tolerans Derecesi</Label>
            <Select value={itGrade} onValueChange={setItGrade}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["IT01","IT0","IT1","IT2","IT3","IT4","IT5","IT6","IT7","IT8","IT9","IT10","IT11","IT12","IT13"].map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            {tolerance !== null && tolerance !== undefined ? (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 w-full text-center">
                <span className="text-xs text-muted-foreground block">Tolerans Bandı</span>
                <span className="text-2xl font-mono font-bold text-primary">±{(tolerance / 2).toFixed(1)} µm</span>
                <span className="text-xs text-muted-foreground block mt-1">Toplam: {tolerance} µm ({(tolerance / 1000).toFixed(4)} mm)</span>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-muted/50 border border-border w-full text-center text-sm text-muted-foreground">
                Ölçü girin (1-500 mm)
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ToleranceGuide = () => {
  return (
    <div className="space-y-6">
      <ToleranceCalculator />

      <Tabs defaultValue="fits" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
          <TabsTrigger value="fits">Geçme Türleri</TabsTrigger>
          <TabsTrigger value="it">IT Dereceleri</TabsTrigger>
          <TabsTrigger value="surface">Yüzey Pürüzlülüğü</TabsTrigger>
          <TabsTrigger value="geo">Geometrik Tolerans</TabsTrigger>
          <TabsTrigger value="guide">Rehber</TabsTrigger>
        </TabsList>

        {/* Geçme Türleri */}
        <TabsContent value="fits">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">ISO Geçme / Oturma Türleri</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kod</TableHead>
                    <TableHead>İsim</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>Açıklama</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fitTypes.map(f => (
                    <TableRow key={f.code}>
                      <TableCell className="font-mono font-bold text-primary">{f.code}</TableCell>
                      <TableCell className={`font-medium ${f.color}`}>{f.name}</TableCell>
                      <TableCell>
                        <Badge variant={f.type === "Sıkı" ? "destructive" : f.type === "Boşluklu" ? "secondary" : "outline"}>
                          {f.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{f.desc}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* IT Dereceleri */}
        <TabsContent value="it">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">ISO 286-1 Temel Tolerans Dereceleri (µm)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card z-10">Ölçü (mm)</TableHead>
                    {["IT5","IT6","IT7","IT8","IT9","IT10","IT11","IT12","IT13"].map(g => (
                      <TableHead key={g} className="text-center">{g}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itGrades.map(row => (
                    <TableRow key={row.range}>
                      <TableCell className="sticky left-0 bg-card z-10 font-mono font-medium">{row.range}</TableCell>
                      <TableCell className="text-center font-mono">{row.IT5}</TableCell>
                      <TableCell className="text-center font-mono">{row.IT6}</TableCell>
                      <TableCell className="text-center font-mono text-primary font-bold">{row.IT7}</TableCell>
                      <TableCell className="text-center font-mono">{row.IT8}</TableCell>
                      <TableCell className="text-center font-mono">{row.IT9}</TableCell>
                      <TableCell className="text-center font-mono">{row.IT10}</TableCell>
                      <TableCell className="text-center font-mono">{row.IT11}</TableCell>
                      <TableCell className="text-center font-mono">{row.IT12}</TableCell>
                      <TableCell className="text-center font-mono">{row.IT13}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Yüzey Pürüzlülüğü */}
        <TabsContent value="surface">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Yüzey Pürüzlülüğü (Ra) Değerleri</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Derece</TableHead>
                    <TableHead>Ra (µm)</TableHead>
                    <TableHead>İşlem Yöntemi</TableHead>
                    <TableHead>Kullanım Alanı</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {surfaceRoughness.map(s => (
                    <TableRow key={s.grade}>
                      <TableCell className="font-mono font-bold text-accent">{s.grade}</TableCell>
                      <TableCell className="font-mono text-primary">{s.ra}</TableCell>
                      <TableCell className="text-sm">{s.process}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.application}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Geometrik Toleranslar */}
        <TabsContent value="geo">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Geometrik Tolerans Sembolleri (GD&T)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sembol</TableHead>
                    <TableHead>İsim</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Açıklama</TableHead>
                    <TableHead>Tipik Değer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {geoTolerances.map(g => (
                    <TableRow key={g.name}>
                      <TableCell className="text-2xl text-center">{g.symbol}</TableCell>
                      <TableCell className="font-medium">{g.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{g.category}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{g.desc}</TableCell>
                      <TableCell className="font-mono text-primary">{g.typical}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rehber */}
        <TabsContent value="guide">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Tolerans Seçim Rehberi</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                <AccordionItem value="process">
                  <AccordionTrigger>İşleme Yöntemine Göre Elde Edilebilir Toleranslar</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { process: "Taşlama", it: "IT5 - IT7", ra: "0.1 - 0.8 µm" },
                        { process: "Hassas Tornalama", it: "IT6 - IT8", ra: "0.4 - 1.6 µm" },
                        { process: "Frezeleme", it: "IT7 - IT9", ra: "0.8 - 3.2 µm" },
                        { process: "Tornalama", it: "IT8 - IT11", ra: "1.6 - 6.3 µm" },
                        { process: "Delme", it: "IT9 - IT12", ra: "3.2 - 12.5 µm" },
                        { process: "Raybalama", it: "IT6 - IT8", ra: "0.4 - 1.6 µm" },
                        { process: "Honlama", it: "IT4 - IT6", ra: "0.025 - 0.2 µm" },
                        { process: "Lepleme", it: "IT3 - IT5", ra: "0.012 - 0.1 µm" },
                      ].map(p => (
                        <div key={p.process} className="p-3 rounded-lg bg-secondary/50 border border-border">
                          <span className="font-medium text-foreground">{p.process}</span>
                          <div className="flex justify-between mt-1 text-sm">
                            <span className="text-muted-foreground">Tolerans: <span className="text-primary font-mono">{p.it}</span></span>
                            <span className="text-muted-foreground">Ra: <span className="text-accent font-mono">{p.ra}</span></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="cost">
                  <AccordionTrigger>Tolerans - Maliyet İlişkisi</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">Daha dar tolerans = daha yüksek maliyet. Gerekli olmayan yerlerde toleransı gevşetmek maliyeti önemli ölçüde düşürür.</p>
                      <div className="space-y-2">
                        {[
                          { grade: "IT13-IT11", cost: "1x", label: "Kaba işleme", bar: "w-[15%]" },
                          { grade: "IT10-IT9", cost: "2x", label: "Normal işleme", bar: "w-[25%]" },
                          { grade: "IT8-IT7", cost: "4x", label: "Hassas işleme", bar: "w-[45%]" },
                          { grade: "IT6-IT5", cost: "10x", label: "Çok hassas", bar: "w-[70%]" },
                          { grade: "IT4 ve altı", cost: "25x+", label: "Ultra hassas", bar: "w-full" },
                        ].map(c => (
                          <div key={c.grade} className="flex items-center gap-3">
                            <span className="font-mono text-sm w-24 text-muted-foreground">{c.grade}</span>
                            <div className="flex-1 bg-secondary/30 rounded-full h-4">
                              <div className={`${c.bar} h-4 rounded-full bg-primary/70`} />
                            </div>
                            <span className="font-mono text-sm w-16 text-right text-primary">{c.cost}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="common">
                  <AccordionTrigger>Yaygın Kullanım Örnekleri</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { part: "Rulman Yuvası (Delik)", fit: "H7", ra: "0.8 µm" },
                        { part: "Rulman Mili", fit: "k6 / m6", ra: "0.4 µm" },
                        { part: "Piston Silindiri", fit: "H7", ra: "0.2 µm" },
                        { part: "Kayar Yatak Mili", fit: "f7 / g6", ra: "0.8 µm" },
                        { part: "Kaplin Bağlantısı", fit: "H7/k6", ra: "1.6 µm" },
                        { part: "Vida Deliği", fit: "H11", ra: "6.3 µm" },
                      ].map(e => (
                        <div key={e.part} className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                          <span className="font-medium text-foreground">{e.part}</span>
                          <div className="flex gap-4 mt-1 text-sm">
                            <span className="text-muted-foreground">Geçme: <span className="text-primary font-mono">{e.fit}</span></span>
                            <span className="text-muted-foreground">Ra: <span className="text-accent font-mono">{e.ra}</span></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ToleranceGuide;
