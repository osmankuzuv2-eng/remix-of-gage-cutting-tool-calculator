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
} from "@/lib/pdfHelpers";

import type { Material } from "@/data/materials";

interface WorkOrderOperation {
  id: string;
  operationType: string;
  materialId: string;
  toolId: string;
  machineId: string;
  diameter: number;
  depth: number;
  length: number;
  quantity: number;
}

interface ExportWorkOrderPdfParams {
  orderName: string;
  machineRate: number;
  operations: WorkOrderOperation[];
  totals: { cuttingTime: number; setupTime: number; toolChangeTime: number; totalTime: number };
  totalCost: number;
  getMaterialName: (id: string) => string;
  getToolName: (id: string) => string;
  getOpName: (id: string) => string;
  getMachineName: (id: string) => string;
  calculateOperationTime: (op: WorkOrderOperation) => {
    cuttingTime: number; setupTime: number; toolChangeTime: number;
    totalTime: number; spindleSpeed: number; tableFeed: number;
  };
  t: (section: string, key: string) => string;
}

export const exportWorkOrderPdf = async (params: ExportWorkOrderPdfParams) => {
  const { orderName, machineRate, operations, totals, totalCost, getMaterialName, getToolName, getOpName, getMachineName, calculateOperationTime, t } = params;
  const doc = new jsPDF();
  await registerFonts(doc);
  const ff = getFontFamily();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const bottomMargin = 18;

  let y = await drawHeader(doc, orderName);

  // Date and rate info
  doc.setFont(ff, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text(`${t("workOrder", "date")}: ${new Date().toLocaleDateString("tr-TR")}`, margin, y);
  doc.text(`${t("workOrder", "machineRate")}: ${machineRate} TL`, margin + 80, y);
  y += 8;

  // Operations table
  y = sectionTitle(doc, t("workOrder", "operationDetails"), y, margin);

  const headers = ["#", t("workOrder", "operationType"), t("workOrder", "machine"), t("common", "material"), t("workOrder", "tool"), `Ø mm`, t("workOrder", "lengthMm"), t("workOrder", "quantity"), `${t("common", "minute")}`];
  const cols = [8, 30, 35, 30, 25, 12, 14, 12, 16];
  const totalW = cols.reduce((a, b) => a + b, 0);
  const scale = contentWidth / totalW;
  const sc = cols.map(w => w * scale);

  const drawHead = () => {
    y = drawTableHeader(doc, y, margin, contentWidth, headers, sc);
  };
  drawHead();

  operations.forEach((op, idx) => {
    const times = calculateOperationTime(op);
    if (y + 7 > pageHeight - bottomMargin) {
      doc.addPage();
      y = 14;
      drawHead();
    }
    y = drawTableRow(doc, y, margin, contentWidth, [
      String(idx + 1),
      getOpName(op.operationType),
      getMachineName(op.machineId),
      getMaterialName(op.materialId),
      getToolName(op.toolId),
      String(op.diameter),
      String(op.length),
      String(op.quantity),
      times.totalTime.toFixed(2),
    ], sc, idx % 2 === 0);
  });

  y += 8;

  // Summary section
  y = sectionTitle(doc, t("workOrder", "summary"), y, margin);

  const summCols = [140, 42];
  const summScaled = summCols.map(w => (w / 182) * contentWidth);

  const summaryRows = [
    [t("workOrder", "totalCuttingTime"), `${totals.cuttingTime.toFixed(2)} ${t("common", "minute")}`],
    [t("workOrder", "totalSetupTime"), `${totals.setupTime.toFixed(2)} ${t("common", "minute")}`],
    [t("workOrder", "totalToolChange"), `${totals.toolChangeTime.toFixed(2)} ${t("common", "minute")}`],
    [t("workOrder", "grandTotalTime"), `${totals.totalTime.toFixed(2)} ${t("common", "minute")}`],
  ];
  summaryRows.forEach((row, idx) => {
    y = drawTableRow(doc, y, margin, contentWidth, row, summScaled, idx % 2 === 0);
  });
  y += 5;

  // Grand Total Box
  doc.setFillColor(...BRAND.dark);
  doc.roundedRect(margin, y, contentWidth, 16, 2, 2, "F");
  doc.setFillColor(...BRAND.primary);
  doc.rect(margin, y, 4, 16, "F");

  doc.setFont(ff, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.white);
  doc.text(t("workOrder", "grandTotalCost"), margin + 8, y + 7);

  doc.setFont(ff, "bold");
  doc.setFontSize(16);
  doc.setTextColor(...BRAND.primary);
  doc.text(`${totalCost.toFixed(2)} TL`, margin + contentWidth - 4, y + 11, { align: "right" });

  drawFooter(doc, t("pdf", "workOrderFooter"), t("pdf", "page"));
  doc.save(`${orderName.replace(/\s+/g, "_")}.pdf`);
};
