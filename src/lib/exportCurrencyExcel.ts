import ExcelJS from "exceljs";

interface RateRow {
  month: number;
  usd: number;
  eur: number;
  gold: number;
}

const MONTH_NAMES_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

const brandOrange = "FFF57C00";
const brandDark = "FF1E2332";
const brandWhite = "FFFFFFFF";
const brandLight = "FFF8F8FC";

export const exportCurrencyExcel = async (
  rows: RateRow[],
  year: number,
  isForecast: boolean
) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GAGE Confidence ToolSense";
  wb.created = new Date();

  const sheetTitle = isForecast ? `${year} Kur Tahminleri` : `${year} Kur Ortalamaları`;
  const ws = wb.addWorksheet(sheetTitle, { properties: { defaultRowHeight: 22 } });

  // Title
  ws.mergeCells("A1:D1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `${sheetTitle} - GAGE Confidence`;
  titleCell.font = { name: "Aptos", size: 14, bold: true, color: { argb: brandWhite } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandDark } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 32;

  // Accent
  ws.mergeCells("A2:D2");
  ws.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandOrange } };
  ws.getRow(2).height = 4;

  // Info row
  ws.mergeCells("A3:D3");
  const infoCell = ws.getCell("A3");
  infoCell.value = `Oluşturma Tarihi: ${new Date().toLocaleDateString("tr-TR")} | ${isForecast ? "Tahmin Verisi (AI Destekli)" : "Gerçek Veriler (Aylık Ortalama)"}`;
  infoCell.font = { name: "Aptos", size: 9, color: { argb: "FF888888" } };
  infoCell.alignment = { horizontal: "center" };
  ws.getRow(3).height = 22;

  // Spacer
  ws.getRow(4).height = 6;

  // Headers
  const headers = ["Ay", "USD/TRY (₺)", "EUR/TRY (₺)", "Gram Altın (₺)"];
  const headerRow = ws.getRow(5);
  headerRow.height = 28;
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: brandWhite } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandDark } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { bottom: { style: "medium", color: { argb: brandOrange } } };
  });

  // Data rows
  rows.forEach((row, idx) => {
    const r = ws.getRow(6 + idx);
    r.height = 24;
    const values = [MONTH_NAMES_TR[row.month - 1], row.usd, row.eur, row.gold];
    values.forEach((val, i) => {
      const cell = r.getCell(i + 1);
      cell.value = val;
      cell.font = { name: "Aptos", size: 10, color: { argb: "FF333340" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      if (idx % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandLight } };
      }
      cell.border = { bottom: { style: "thin", color: { argb: "FFDCDCE6" } } };
      // Format numbers
      if (i > 0 && typeof val === "number") {
        cell.numFmt = i === 3 ? "#,##0" : "#,##0.00";
        cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: i === 3 ? brandOrange : "FF333340" } };
      }
    });
  });

  // Averages row
  const avgRowNum = 6 + rows.length + 1;
  ws.getRow(6 + rows.length).height = 6; // spacer
  const avgRow = ws.getRow(avgRowNum);
  avgRow.height = 28;
  const avgUsd = rows.reduce((s, r) => s + r.usd, 0) / rows.length;
  const avgEur = rows.reduce((s, r) => s + r.eur, 0) / rows.length;
  const avgGold = rows.reduce((s, r) => s + r.gold, 0) / rows.length;
  
  const avgValues = ["YILLIK ORTALAMA", avgUsd, avgEur, avgGold];
  avgValues.forEach((val, i) => {
    const cell = avgRow.getCell(i + 1);
    cell.value = typeof val === "number" ? Number(val.toFixed(i === 3 ? 0 : 2)) : val;
    cell.font = { name: "Aptos", size: 11, bold: true, color: { argb: brandWhite } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandDark } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    if (i > 0 && typeof val === "number") {
      cell.numFmt = i === 3 ? "#,##0" : "#,##0.00";
    }
  });

  // Column widths
  ws.columns = [{ width: 16 }, { width: 18 }, { width: 18 }, { width: 20 }];

  // Footer
  const footerRowNum = avgRowNum + 2;
  ws.mergeCells(`A${footerRowNum}:D${footerRowNum}`);
  const footerCell = ws.getCell(`A${footerRowNum}`);
  footerCell.value = "Bu belge GAGE Confidence ToolSense tarafından otomatik oluşturulmuştur.";
  footerCell.font = { name: "Aptos", size: 8, italic: true, color: { argb: "FF8C8CA0" } };
  footerCell.alignment = { horizontal: "center" };

  // Download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Kur_${isForecast ? "Tahmin" : "Gercek"}_${year}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};
