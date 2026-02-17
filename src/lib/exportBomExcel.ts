import ExcelJS from "exceljs";

interface Operation {
  step: number;
  operation: string;
  machine: string;
  tool: string;
  cuttingSpeed: string;
  feedRate: string;
  depthOfCut: string;
  spindleSpeed?: string;
  estimatedTime: string;
  notes: string;
}

interface AnalysisResult {
  partName: string;
  material: string;
  overallDimensions: string;
  complexity: string;
  operations: Operation[];
  totalEstimatedTime: string;
  setupTime: string;
  tolerances: string;
  surfaceFinish: string;
  machinesRequired: string[];
}

export const exportBomExcel = async (
  analysis: AnalysisResult,
  referenceName?: string,
  customerName?: string
) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GAGE Confidence ToolSense";
  wb.created = new Date();

  const ws = wb.addWorksheet("Ürün Ağacı (BOM)", {
    properties: { defaultRowHeight: 20 },
  });

  // ── Brand colors ──
  const brandOrange = "FFF57C00";
  const brandDark = "FF1E2332";
  const brandWhite = "FFFFFFFF";
  const brandLight = "FFF8F8FC";
  const brandMuted = "FF8C8CA0";

  // ── Header Section ──
  // Row 1: Title
  ws.mergeCells("A1:J1");
  const titleCell = ws.getCell("A1");
  titleCell.value = "ÜRÜN AĞACI (BOM) - GAGE Confidence";
  titleCell.font = { name: "Aptos", size: 16, bold: true, color: { argb: brandWhite } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandDark } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 36;

  // Row 2: Orange accent
  ws.mergeCells("A2:J2");
  const accentCell = ws.getCell("A2");
  accentCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandOrange } };
  ws.getRow(2).height = 4;

  // Row 3: Reference & Customer
  ws.mergeCells("A3:E3");
  ws.mergeCells("F3:J3");
  const refCell = ws.getCell("A3");
  refCell.value = `Referans: ${referenceName || analysis.partName}`;
  refCell.font = { name: "Aptos", size: 11, bold: true, color: { argb: brandDark } };
  refCell.alignment = { vertical: "middle" };
  const custCell = ws.getCell("F3");
  custCell.value = `Müşteri: ${customerName || "-"}`;
  custCell.font = { name: "Aptos", size: 11, bold: true, color: { argb: brandDark } };
  custCell.alignment = { vertical: "middle" };
  ws.getRow(3).height = 26;

  // Row 4: Part info
  ws.mergeCells("A4:E4");
  ws.mergeCells("F4:J4");
  const partCell = ws.getCell("A4");
  partCell.value = `Malzeme: ${analysis.material}`;
  partCell.font = { name: "Aptos", size: 10, color: { argb: "FF555555" } };
  const dimCell = ws.getCell("F4");
  dimCell.value = `Ebat: ${analysis.overallDimensions}`;
  dimCell.font = { name: "Aptos", size: 10, color: { argb: "FF555555" } };
  ws.getRow(4).height = 22;

  // Row 5: Date & complexity
  ws.mergeCells("A5:E5");
  ws.mergeCells("F5:J5");
  const dateCell = ws.getCell("A5");
  dateCell.value = `Tarih: ${new Date().toLocaleDateString("tr-TR")}`;
  dateCell.font = { name: "Aptos", size: 10, color: { argb: "FF555555" } };
  const compCell = ws.getCell("F5");
  compCell.value = `Karmaşıklık: ${analysis.complexity}`;
  compCell.font = { name: "Aptos", size: 10, color: { argb: "FF555555" } };
  ws.getRow(5).height = 22;

  // Row 6: empty spacer
  ws.getRow(6).height = 8;

  // ── Table Header (Row 7) ──
  const headers = [
    "Sıra", "Operasyon", "Tezgah", "Takım",
    "Vc (m/dk)", "n (d/dk)", "f (mm/dev)", "ap (mm)",
    "Süre (dk)", "Notlar"
  ];

  const headerRow = ws.getRow(7);
  headerRow.height = 28;
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: brandWhite } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandDark } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      bottom: { style: "medium", color: { argb: brandOrange } },
    };
  });

  // ── Data Rows ──
  analysis.operations.forEach((op, idx) => {
    const rowNum = 8 + idx;
    const row = ws.getRow(rowNum);
    row.height = 24;

    const values = [
      op.step,
      op.operation,
      op.machine,
      op.tool,
      op.cuttingSpeed,
      op.spindleSpeed || "-",
      op.feedRate,
      op.depthOfCut,
      op.estimatedTime,
      op.notes,
    ];

    values.forEach((val, i) => {
      const cell = row.getCell(i + 1);
      cell.value = val;
      cell.font = { name: "Aptos", size: 10, color: { argb: "FF333340" } };
      cell.alignment = { horizontal: i === 0 ? "center" : "left", vertical: "middle", wrapText: true };

      if (idx % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandLight } };
      }

      cell.border = {
        bottom: { style: "thin", color: { argb: "FFDCDCE6" } },
      };
    });

    // Bold step number
    row.getCell(1).font = { name: "Aptos", size: 10, bold: true, color: { argb: brandOrange.slice(2) ? brandOrange : "FFF57C00" } };
    // Bold time
    row.getCell(9).font = { name: "Aptos", size: 10, bold: true, color: { argb: brandOrange } };
  });

  // ── Summary Rows ──
  const spacerRowNum = 8 + analysis.operations.length;
  ws.getRow(spacerRowNum).height = 6;

  // Setup row (above total)
  const setupRowNum = spacerRowNum + 1;
  const setupRow = ws.getRow(setupRowNum);
  setupRow.height = 26;
  ws.mergeCells(`A${setupRowNum}:J${setupRowNum}`);
  const setupCell = setupRow.getCell(1);
  setupCell.value = `HAZIRLIK SÜRESİ:  ${analysis.setupTime} dk`;
  setupCell.font = { name: "Aptos", size: 10, bold: true, color: { argb: brandWhite } };
  setupCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D3348" } };
  setupCell.alignment = { horizontal: "center", vertical: "middle" };

  // Total row
  const totalRowNum = setupRowNum + 1;
  const totalRow = ws.getRow(totalRowNum);
  totalRow.height = 30;
  ws.mergeCells(`A${totalRowNum}:J${totalRowNum}`);
  const totalCell = totalRow.getCell(1);
  totalCell.value = `TOPLAM ÜRETİM SÜRESİ:  ${analysis.totalEstimatedTime} dk`;
  totalCell.font = { name: "Aptos", size: 13, bold: true, color: { argb: brandOrange } };
  totalCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandDark } };
  totalCell.alignment = { horizontal: "center", vertical: "middle" };

  const summaryRowNum = totalRowNum;

  // ── Column Widths ──
  ws.columns = [
    { width: 7 },   // Sıra
    { width: 28 },  // Operasyon
    { width: 22 },  // Tezgah
    { width: 28 },  // Takım
    { width: 13 },  // Vc
    { width: 13 },  // n
    { width: 13 },  // f
    { width: 12 },  // ap
    { width: 13 },  // Süre
    { width: 35 },  // Notlar
  ];

  // ── Footer ──
  const footerRowNum = summaryRowNum + 2;
  ws.mergeCells(`A${footerRowNum}:J${footerRowNum}`);
  const footerCell = ws.getCell(`A${footerRowNum}`);
  footerCell.value = "Bu belge GAGE Confidence ToolSense tarafından otomatik oluşturulmuştur.";
  footerCell.font = { name: "Aptos", size: 8, italic: true, color: { argb: brandMuted } };
  footerCell.alignment = { horizontal: "center" };

  // ── Download ──
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const slug = (referenceName || analysis.partName || "urun_agaci").replace(/\s+/g, "_");
  a.download = `${slug}_BOM_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};
