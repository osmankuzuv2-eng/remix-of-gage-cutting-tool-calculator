import jsPDF from "jspdf";
import {
  registerFonts,
  getFontFamily,
  drawHeader,
  drawFooter,
  sectionTitle,
  drawTableHeader,
  drawTableRow,
  BRAND,
} from "./pdfHelpers";

interface Operation {
  machine_label: string;
  operation_type: string;
  time_minutes: number;
  minute_rate: number;
  cost: number;
}

interface RFQQuote {
  quote_number: string;
  customer_name: string;
  part_name: string;
  material: string | null;
  quantity: number;
  factory: string;
  status: string;
  material_cost: number;
  machining_cost: number;
  setup_cost: number;
  coating_cost: number;
  overhead_percent: number;
  profit_margin: number;
  manual_adjustment: number;
  total_cost: number;
  unit_price: number;
  currency: string;
  operations: Operation[];
  notes: string | null;
  validity_days: number;
  delivery_days: number | null;
  created_at: string;
}

const STATUS_TR: Record<string, string> = {
  draft: "Taslak",
  sent: "Gönderildi",
  approved: "Onaylandı",
  rejected: "Reddedildi",
};

export const exportRfqPdf = async (q: RFQQuote): Promise<void> => {
  const doc = new jsPDF();
  const font = await registerFonts(doc);
  const ff = getFontFamily();

  let y = await drawHeader(doc, `RFQ – Teklif No: ${q.quote_number}`, font);

  // Info boxes
  const boxData = [
    ["Müşteri", q.customer_name],
    ["Parça Adı", q.part_name],
    ["Malzeme", q.material || "—"],
    ["Miktar", `${q.quantity} adet`],
    ["Fabrika", q.factory],
    ["Durum", STATUS_TR[q.status] || q.status],
    ["Tarih", new Date(q.created_at).toLocaleDateString("tr-TR")],
    ["Geçerlilik", `${q.validity_days} gün`],
    ...(q.delivery_days ? [["Teslimat", `${q.delivery_days} iş günü`]] : []),
  ];

  // Draw info table
  y = sectionTitle(doc, "Teklif Bilgileri", y, ff);
  const midX = 105;
  const leftPad = 14;
  const boxH = 8;
  doc.setFontSize(9);

  for (let i = 0; i < boxData.length; i += 2) {
    const row1 = boxData[i];
    const row2 = boxData[i + 1];

    // left cell
    doc.setFillColor(245, 247, 250);
    doc.rect(leftPad, y, midX - leftPad - 2, boxH, "F");
    doc.setFont(ff, "bold");
    doc.setTextColor(...BRAND.navy as [number, number, number]);
    doc.text(row1[0] + ":", leftPad + 2, y + 5.5);
    doc.setFont(ff, "normal");
    doc.setTextColor(50, 50, 50);
    doc.text(row1[1], leftPad + 35, y + 5.5);

    // right cell
    if (row2) {
      doc.setFillColor(245, 247, 250);
      doc.rect(midX + 1, y, midX - leftPad - 2, boxH, "F");
      doc.setFont(ff, "bold");
      doc.setTextColor(...BRAND.navy as [number, number, number]);
      doc.text(row2[0] + ":", midX + 3, y + 5.5);
      doc.setFont(ff, "normal");
      doc.setTextColor(50, 50, 50);
      doc.text(row2[1], midX + 38, y + 5.5);
    }

    y += boxH + 1;
  }

  y += 6;

  // Operations table
  const ops: Operation[] = Array.isArray(q.operations) ? q.operations : [];
  if (ops.length > 0) {
    y = sectionTitle(doc, "Operasyon Detayları", y, ff);
    const opCols = [
      { header: "Operasyon", x: 14, w: 50 },
      { header: "Tezgah", x: 64, w: 55 },
      { header: "Süre (dk)", x: 119, w: 25 },
      { header: `Birim Oran`, x: 144, w: 25 },
      { header: `Maliyet (${q.currency})`, x: 169, w: 27 },
    ];
    y = drawTableHeader(doc, opCols, y, ff);
    let totalOpCost = 0;
    ops.forEach((op) => {
      const row = [
        op.operation_type,
        op.machine_label || "—",
        op.time_minutes.toFixed(1),
        op.minute_rate.toFixed(2),
        op.cost.toFixed(2),
      ];
      y = drawTableRow(doc, opCols, row, y, ff);
      totalOpCost += op.cost;
    });

    // Total row
    doc.setFillColor(...BRAND.navy as [number, number, number]);
    doc.rect(14, y, 182, 7, "F");
    doc.setFont(ff, "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text("İşleme Toplamı", 16, y + 5);
    doc.text(totalOpCost.toFixed(2) + " " + q.currency, 171, y + 5);
    y += 12;
  }

  // Cost breakdown
  y = sectionTitle(doc, "Maliyet Dökümü", y, ff);
  const costRows = [
    ["Malzeme Maliyeti", q.material_cost.toFixed(2)],
    ["İşleme Maliyeti", q.machining_cost.toFixed(2)],
    ["Setup Maliyeti", q.setup_cost.toFixed(2)],
    ["Kaplama Maliyeti", q.coating_cost.toFixed(2)],
    ["Ara Toplam", (q.material_cost + q.machining_cost + q.setup_cost + q.coating_cost).toFixed(2)],
    [`Genel Gider (%${q.overhead_percent})`, ((q.material_cost + q.machining_cost + q.setup_cost + q.coating_cost) * q.overhead_percent / 100).toFixed(2)],
    [`Kâr Marjı (%${q.profit_margin})`, ((q.material_cost + q.machining_cost + q.setup_cost + q.coating_cost) * (1 + q.overhead_percent / 100) * q.profit_margin / 100).toFixed(2)],
    ...(q.manual_adjustment !== 0 ? [["Manuel Düzeltme", q.manual_adjustment.toFixed(2)]] : []),
  ];

  const costCols = [
    { header: "Kalem", x: 14, w: 120 },
    { header: `Tutar (${q.currency})`, x: 134, w: 62 },
  ];
  y = drawTableHeader(doc, costCols, y, ff);
  for (const row of costRows) {
    y = drawTableRow(doc, costCols, row, y, ff);
  }

  // Grand total
  doc.setFillColor(...BRAND.orange as [number, number, number]);
  doc.rect(14, y, 182, 10, "F");
  doc.setFont(ff, "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("GENEL TOPLAM", 16, y + 7);
  doc.text(q.total_cost.toFixed(2) + " " + q.currency, 136, y + 7);
  y += 14;

  // Unit price
  doc.setFillColor(230, 255, 240);
  doc.rect(14, y, 182, 10, "F");
  doc.setFont(ff, "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 120, 60);
  doc.text(`BİRİM FİYAT (${q.quantity} adet)`, 16, y + 7);
  doc.text(q.unit_price.toFixed(2) + " " + q.currency, 136, y + 7);
  y += 16;

  // Notes
  if (q.notes) {
    y = sectionTitle(doc, "Notlar & Koşullar", y, ff);
    doc.setFont(ff, "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(q.notes, 180);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 4;
  }

  drawFooter(doc, font);

  doc.save(`${q.quote_number}_teklif.pdf`);
};
