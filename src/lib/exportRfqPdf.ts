import jsPDF from "jspdf";
import {
  registerFonts,
  getFontFamily,
  drawHeader,
  drawFooter,
  sectionTitle,
  drawInfoBox,
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
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;

  let y = await drawHeader(doc, `RFQ – Teklif No: ${q.quote_number}`);

  // Info boxes
  y = drawInfoBox(doc, y, margin, contentWidth, [
    { label: "Müşteri", value: q.customer_name },
    { label: "Parça Adı", value: q.part_name },
    { label: "Miktar", value: `${q.quantity} adet` },
    { label: "Durum", value: STATUS_TR[q.status] || q.status },
  ]);

  y = drawInfoBox(doc, y, margin, contentWidth, [
    { label: "Malzeme", value: q.material || "—" },
    { label: "Fabrika", value: q.factory },
    { label: "Geçerlilik", value: `${q.validity_days} gün` },
    { label: "Teslimat", value: q.delivery_days ? `${q.delivery_days} gün` : "—" },
  ]);

  y += 2;

  // Operations table
  const ops: Operation[] = Array.isArray(q.operations) ? q.operations : [];
  if (ops.length > 0) {
    y = sectionTitle(doc, "Operasyon Detayları", y, margin);
    const opHeaders = ["Operasyon", "Tezgah", "Süre (dk)", "Oran", `Maliyet (${q.currency})`];
    const opCols = [40, 55, 22, 22, 43];
    y = drawTableHeader(doc, y, margin, contentWidth, opHeaders, opCols);
    let totalOpCost = 0;
    ops.forEach((op, idx) => {
      const row = [
        op.operation_type,
        op.machine_label || "—",
        op.time_minutes.toFixed(1),
        op.minute_rate.toFixed(2),
        op.cost.toFixed(2),
      ];
      y = drawTableRow(doc, y, margin, contentWidth, row, opCols, idx % 2 === 0);
      totalOpCost += op.cost;
    });

    // Total row
    doc.setFillColor(...BRAND.dark);
    doc.rect(margin, y, contentWidth, 7, "F");
    doc.setFont(ff, "bold");
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.white);
    doc.text("İşleme Toplamı", margin + 2, y + 5);
    doc.text(totalOpCost.toFixed(2) + " " + q.currency, margin + contentWidth - 2, y + 5, { align: "right" });
    y += 11;
  }

  // Cost breakdown
  y = sectionTitle(doc, "Maliyet Dökümü", y, margin);
  const subtotal = q.material_cost + q.machining_cost + q.setup_cost + q.coating_cost;
  const overhead = subtotal * q.overhead_percent / 100;
  const profit = (subtotal + overhead) * q.profit_margin / 100;

  const costHeaders = ["Maliyet Kalemi", `Tutar (${q.currency})`];
  const costCols = [130, 52];
  y = drawTableHeader(doc, y, margin, contentWidth, costHeaders, costCols);

  const costRows = [
    ["Malzeme Maliyeti", q.material_cost.toFixed(2)],
    ["İşleme Maliyeti", q.machining_cost.toFixed(2)],
    ["Setup Maliyeti", q.setup_cost.toFixed(2)],
    ["Kaplama Maliyeti", q.coating_cost.toFixed(2)],
    ["Ara Toplam", subtotal.toFixed(2)],
    [`Genel Gider (%${q.overhead_percent})`, overhead.toFixed(2)],
    [`Kâr Marjı (%${q.profit_margin})`, profit.toFixed(2)],
    ...(q.manual_adjustment !== 0 ? [["Manuel Düzeltme", q.manual_adjustment.toFixed(2)]] : []),
  ];
  costRows.forEach((row, idx) => {
    y = drawTableRow(doc, y, margin, contentWidth, row, costCols, idx % 2 === 0);
  });

  // Grand total
  doc.setFillColor(...BRAND.primary);
  doc.rect(margin, y, contentWidth, 10, "F");
  doc.setFont(ff, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.white);
  doc.text("GENEL TOPLAM", margin + 2, y + 7);
  doc.text(q.total_cost.toFixed(2) + " " + q.currency, margin + contentWidth - 2, y + 7, { align: "right" });
  y += 13;

  // Unit price
  doc.setFillColor(...BRAND.success);
  doc.rect(margin, y, contentWidth, 10, "F");
  doc.setFont(ff, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.white);
  doc.text(`BİRİM FİYAT (${q.quantity} adet için)`, margin + 2, y + 7);
  doc.text(q.unit_price.toFixed(2) + " " + q.currency, margin + contentWidth - 2, y + 7, { align: "right" });
  y += 15;

  // Notes
  if (q.notes) {
    y = sectionTitle(doc, "Notlar & Koşullar", y, margin);
    doc.setFont(ff, "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(q.notes, contentWidth);
    doc.text(lines, margin, y);
    y += (lines.length as number) * 5 + 4;
  }

  drawFooter(doc, `Teklif No: ${q.quote_number}  |  Müşteri: ${q.customer_name}  |  ${new Date(q.created_at).toLocaleDateString("tr-TR")}`);

  doc.save(`${q.quote_number}_teklif.pdf`);
};
