import ExcelJS from "exceljs";
import type { TimeImprovement } from "@/hooks/useTimeImprovements";

const OP_LABELS: Record<string, string> = {
  turning: "Tornalama",
  milling: "Frezeleme",
  drilling: "Delme",
  grinding: "Taşlama",
  threading: "Diş Açma",
  other: "Diğer",
};

const brandOrange = "FFF57C00";
const brandDark = "FF1E2332";
const brandWhite = "FFFFFFFF";
const brandLight = "FFF8F8FC";

export const exportTimeImprovementsExcel = async (
  items: TimeImprovement[],
  factory: string
) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GAGE Confidence ToolSense";
  wb.created = new Date();

  const ws = wb.addWorksheet("İyileştirmeler", { properties: { defaultRowHeight: 20 } });

  // Title
  ws.mergeCells("A1:L1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `Süre & Fiyat İyileştirmeleri - ${factory}`;
  titleCell.font = { name: "Aptos", size: 14, bold: true, color: { argb: brandWhite } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandDark } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 32;

  // Accent row
  ws.mergeCells("A2:L2");
  ws.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandOrange } };
  ws.getRow(2).height = 4;

  // Date row
  ws.mergeCells("A3:L3");
  ws.getCell("A3").value = `Tarih: ${new Date().toLocaleDateString("tr-TR")}  |  Toplam Kayıt: ${items.length}`;
  ws.getCell("A3").font = { name: "Aptos", size: 10, color: { argb: "FF555555" } };
  ws.getRow(3).height = 24;

  // Headers
  const headers = ["Tarih", "Referans", "Müşteri", "Parça", "Tezgah", "İşlem", "Eski Süre (dk)", "Yeni Süre (dk)", "Süre İyileştirme %", "Eski Fiyat (₺)", "Yeni Fiyat (₺)", "Fiyat İyileştirme %"];
  const headerRow = ws.getRow(5);
  headerRow.height = 26;
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Aptos", size: 9, bold: true, color: { argb: brandWhite } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandDark } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: brandOrange } } };
  });

  // Data
  items.forEach((item, idx) => {
    const row = ws.getRow(6 + idx);
    row.height = 22;
    const vals = [
      item.improvement_date,
      item.reference_code,
      item.customer_name,
      item.part_name,
      item.machine_name || "-",
      OP_LABELS[item.operation_type] || item.operation_type,
      item.old_time_minutes,
      item.new_time_minutes,
      Number(item.improvement_percent).toFixed(1) + "%",
      Number(item.old_price).toFixed(2),
      Number(item.new_price).toFixed(2),
      Number(item.price_improvement_percent).toFixed(1) + "%",
    ];
    vals.forEach((val, i) => {
      const cell = row.getCell(i + 1);
      cell.value = val;
      cell.font = { name: "Aptos", size: 9, color: { argb: "FF333340" } };
      cell.alignment = { horizontal: i >= 6 ? "center" : "left", vertical: "middle" };
      if (idx % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandLight } };
      }
      cell.border = { bottom: { style: "thin", color: { argb: "FFDCDCE6" } } };
    });
  });

  // Summary row
  const sumRow = ws.getRow(6 + items.length + 1);
  ws.mergeCells(`A${sumRow.number}:F${sumRow.number}`);
  sumRow.getCell(1).value = "TOPLAM";
  sumRow.getCell(1).font = { name: "Aptos", size: 10, bold: true, color: { argb: brandWhite } };
  sumRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandDark } };
  sumRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

  const totalOldTime = items.reduce((s, i) => s + i.old_time_minutes, 0);
  const totalNewTime = items.reduce((s, i) => s + i.new_time_minutes, 0);
  const totalOldPrice = items.reduce((s, i) => s + Number(i.old_price), 0);
  const totalNewPrice = items.reduce((s, i) => s + Number(i.new_price), 0);

  [totalOldTime, totalNewTime, "", totalOldPrice.toFixed(2), totalNewPrice.toFixed(2), ""].forEach((val, i) => {
    const cell = sumRow.getCell(7 + i);
    cell.value = val;
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: brandOrange } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandDark } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  sumRow.height = 28;

  ws.columns = [
    { width: 12 }, { width: 14 }, { width: 20 }, { width: 20 }, { width: 18 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 16 },
  ];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `iyilestirmeler_${factory.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};
