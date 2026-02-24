import jsPDF from "jspdf";
import {
  registerFonts,
  getFontFamily,
  drawHeader,
  drawFooter,
  drawInfoBox,
  drawTableHeader,
  drawTableRow,
  sectionTitle,
  BRAND,
} from "./pdfHelpers";
import type { TimeImprovement } from "@/hooks/useTimeImprovements";

const OP_LABELS: Record<string, string> = {
  turning: "Tornalama",
  milling: "Frezeleme",
  drilling: "Delme",
  grinding: "Taşlama",
  threading: "Diş Açma",
  other: "Diğer",
};

export const exportTimeImprovementsPdf = async (
  items: TimeImprovement[],
  factory: string
) => {
  const doc = new jsPDF({ orientation: "landscape" });
  await registerFonts(doc);
  const ff = getFontFamily();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  let y = await drawHeader(doc, `Süre & Fiyat İyileştirmeleri - ${factory}`);

  // Summary
  const totalTimeSaved = items.reduce((s, i) => s + (i.old_time_minutes - i.new_time_minutes), 0);
  const avgTimeImpr = items.length > 0 ? items.reduce((s, i) => s + Number(i.improvement_percent), 0) / items.length : 0;
  const totalPriceSaved = items.reduce((s, i) => s + (Number(i.old_price) - Number(i.new_price)), 0);

  y = drawInfoBox(doc, y, margin, contentWidth, [
    { label: "Toplam Kayıt", value: items.length.toString() },
    { label: "Kazanılan Süre", value: `${totalTimeSaved.toFixed(1)} dk` },
    { label: "Ort. Süre İyileştirme", value: `%${avgTimeImpr.toFixed(1)}` },
    { label: "Toplam Fiyat Kazancı", value: `${totalPriceSaved.toFixed(2)} ₺` },
  ]);

  // Table
  const headers = ["Tarih", "Referans", "Müşteri", "Parça", "Tezgah", "İşlem", "Eski dk", "Yeni dk", "Süre %", "Eski ₺", "Yeni ₺", "Fiyat %"];
  const cols = [22, 22, 28, 28, 22, 18, 16, 16, 16, 18, 18, 18];
  const scale = contentWidth / cols.reduce((a, b) => a + b, 0);
  const scaled = cols.map((c) => c * scale);

  y = drawTableHeader(doc, y, margin, contentWidth, headers, scaled);

  items.forEach((item, idx) => {
    if (y > pageHeight - 20) {
      doc.addPage("landscape");
      y = 14;
      y = drawTableHeader(doc, y, margin, contentWidth, headers, scaled);
    }
    y = drawTableRow(doc, y, margin, contentWidth, [
      item.improvement_date,
      item.reference_code,
      item.customer_name,
      item.part_name,
      item.machine_name || "-",
      OP_LABELS[item.operation_type] || item.operation_type,
      String(item.old_time_minutes),
      String(item.new_time_minutes),
      `%${Number(item.improvement_percent).toFixed(1)}`,
      String(Number(item.old_price).toFixed(2)),
      String(Number(item.new_price).toFixed(2)),
      `%${Number(item.price_improvement_percent).toFixed(1)}`,
    ], scaled, idx % 2 === 0);
  });

  drawFooter(doc, "GAGE Confidence ToolSense - Süre & Fiyat İyileştirmeleri Raporu", "Sayfa");
  doc.save(`iyilestirmeler_${factory.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
