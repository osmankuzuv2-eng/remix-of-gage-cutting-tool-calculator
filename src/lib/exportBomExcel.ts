import ExcelJS from "exceljs";
import type { Language } from "@/i18n/translations";

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

type TFn = (section: string, key: string) => string;

export const exportBomExcel = async (
  analysis: AnalysisResult,
  referenceName?: string,
  customerName?: string,
  t?: TFn
) => {
  const tr = t || ((_s: string, k: string) => k);
  const wb = new ExcelJS.Workbook();
  wb.creator = "GAGE Confidence ToolSense";
  wb.created = new Date();

  const brandOrange = "FFF57C00";
  const brandDark = "FF1E2332";
  const brandWhite = "FFFFFFFF";
  const brandLight = "FFF8F8FC";
  const brandMuted = "FF8C8CA0";

  const ws = wb.addWorksheet(tr("export", "colOperation"), {
    properties: { defaultRowHeight: 20 },
  });

  // Row 1: Title
  ws.mergeCells("A1:J1");
  const titleCell = ws.getCell("A1");
  titleCell.value = tr("export", "bomTitle");
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
  refCell.value = `${tr("export", "reference")}: ${referenceName || analysis.partName}`;
  refCell.font = { name: "Aptos", size: 11, bold: true, color: { argb: brandDark } };
  refCell.alignment = { vertical: "middle" };
  const custCell = ws.getCell("F3");
  custCell.value = `${tr("export", "customer")}: ${customerName || "-"}`;
  custCell.font = { name: "Aptos", size: 11, bold: true, color: { argb: brandDark } };
  custCell.alignment = { vertical: "middle" };
  ws.getRow(3).height = 26;

  // Row 4: Part info
  ws.mergeCells("A4:E4");
  ws.mergeCells("F4:J4");
  const partCell = ws.getCell("A4");
  partCell.value = `${tr("export", "material")}: ${analysis.material}`;
  partCell.font = { name: "Aptos", size: 10, color: { argb: "FF555555" } };
  const dimCell = ws.getCell("F4");
  dimCell.value = `${tr("export", "dimensions")}: ${analysis.overallDimensions}`;
  dimCell.font = { name: "Aptos", size: 10, color: { argb: "FF555555" } };
  ws.getRow(4).height = 22;

  // Row 5: Date & complexity
  ws.mergeCells("A5:E5");
  ws.mergeCells("F5:J5");
  const dateCell = ws.getCell("A5");
  dateCell.value = `${tr("export", "date")}: ${new Date().toLocaleDateString()}`;
  dateCell.font = { name: "Aptos", size: 10, color: { argb: "FF555555" } };
  const compCell = ws.getCell("F5");
  compCell.value = `${tr("export", "complexity")}: ${analysis.complexity}`;
  compCell.font = { name: "Aptos", size: 10, color: { argb: "FF555555" } };
  ws.getRow(5).height = 22;

  ws.getRow(6).height = 8;

  // Table Header (Row 7)
  const headers = [
    tr("export", "colStep"),
    tr("export", "colOperation"),
    tr("export", "colMachine"),
    tr("export", "colTool"),
    "Vc (m/dk)", "n (d/dk)", "f (mm/dev)", "ap (mm)",
    tr("export", "colTime"),
    tr("export", "colNotes"),
  ];

  const headerRow = ws.getRow(7);
  headerRow.height = 28;
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: brandWhite } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandDark } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: brandOrange } } };
  });

  // Data Rows
  analysis.operations.forEach((op, idx) => {
    const rowNum = 8 + idx;
    const row = ws.getRow(rowNum);
    row.height = 24;
    const values = [
      op.step, op.operation, op.machine, op.tool,
      op.cuttingSpeed, op.spindleSpeed || "-", op.feedRate,
      op.depthOfCut, op.estimatedTime, op.notes,
    ];
    values.forEach((val, i) => {
      const cell = row.getCell(i + 1);
      cell.value = val;
      cell.font = { name: "Aptos", size: 10, color: { argb: "FF333340" } };
      cell.alignment = { horizontal: i === 0 ? "center" : "left", vertical: "middle", wrapText: true };
      if (idx % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandLight } };
      }
      cell.border = { bottom: { style: "thin", color: { argb: "FFDCDCE6" } } };
    });
    row.getCell(1).font = { name: "Aptos", size: 10, bold: true, color: { argb: brandOrange } };
    row.getCell(9).font = { name: "Aptos", size: 10, bold: true, color: { argb: brandOrange } };
  });

  // Summary Rows
  const spacerRowNum = 8 + analysis.operations.length;
  ws.getRow(spacerRowNum).height = 6;

  const setupRowNum = spacerRowNum + 1;
  const setupRow = ws.getRow(setupRowNum);
  setupRow.height = 26;
  ws.mergeCells(`A${setupRowNum}:J${setupRowNum}`);
  const setupCell = setupRow.getCell(1);
  setupCell.value = `${tr("export", "setupTimeLabel")}:  ${analysis.setupTime} ${tr("common", "minute")}`;
  setupCell.font = { name: "Aptos", size: 10, bold: true, color: { argb: brandWhite } };
  setupCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D3348" } };
  setupCell.alignment = { horizontal: "center", vertical: "middle" };

  const totalRowNum = setupRowNum + 1;
  const totalRow = ws.getRow(totalRowNum);
  totalRow.height = 30;
  ws.mergeCells(`A${totalRowNum}:J${totalRowNum}`);
  const totalCell = totalRow.getCell(1);
  totalCell.value = `${tr("export", "totalTimeLabel")}:  ${analysis.totalEstimatedTime} ${tr("common", "minute")}`;
  totalCell.font = { name: "Aptos", size: 13, bold: true, color: { argb: brandOrange } };
  totalCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandDark } };
  totalCell.alignment = { horizontal: "center", vertical: "middle" };

  ws.columns = [
    { width: 7 }, { width: 28 }, { width: 22 }, { width: 28 },
    { width: 13 }, { width: 13 }, { width: 13 }, { width: 12 },
    { width: 13 }, { width: 35 },
  ];

  const footerRowNum = totalRowNum + 2;
  ws.mergeCells(`A${footerRowNum}:J${footerRowNum}`);
  const footerCell = ws.getCell(`A${footerRowNum}`);
  footerCell.value = tr("export", "autoGenerated");
  footerCell.font = { name: "Aptos", size: 8, italic: true, color: { argb: brandMuted } };
  footerCell.alignment = { horizontal: "center" };

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
