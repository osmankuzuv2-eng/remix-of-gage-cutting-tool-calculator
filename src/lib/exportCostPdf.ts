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

export interface CostPdfData {
  referenceNo: string;
  customer: string;
  material: string;
  density: number;
  weightKg: string;
  materialPricePerKg: number;
  laborRate: number;
  machines: { label: string; name: string; rate: number }[];
  setupTime: number;
  machiningTime: number;
  orderQuantity: number;
  toolCost: number;
  shippingCost: number;
  coatingCost: number;
  heatTreatmentCost: number;
  scrapRate: number;
  profitMargin: number;
  calculations: {
    totalMachiningHours: string;
    setupCost: string;
    machineCost: string;
    totalMaterialCost: string;
    additionalCosts: string;
    scrapCost: string;
    profit: string;
    grandTotal: string;
    costPerPart: string;
  };
}

type TFn = (section: string, key: string) => string;

export const exportCostPdf = async (data: CostPdfData, t?: TFn) => {
  const tr = t || ((_s: string, k: string) => k);
  const doc = new jsPDF();
  await registerFonts(doc);
  const ff = getFontFamily();

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const minute = tr("common", "minute");
  const hour = tr("common", "hour");

  // ── Header ──
  let y = await drawHeader(doc, tr("pdf", "costReport"));

  // ── Reference & Customer info box ──
  y = drawInfoBox(doc, y, margin, contentWidth, [
    { label: tr("pdf", "referenceNo"), value: data.referenceNo || "-" },
    { label: tr("pdf", "customer"), value: data.customer || "-" },
    { label: tr("common", "material"), value: data.material },
    { label: tr("pdf", "laborRate"), value: `${data.laborRate} EUR/sa` },
  ]);

  // ── Machine Info ──
  y = sectionTitle(doc, tr("pdf", "machineInfo"), y, margin);

  const machHeaders = [tr("pdf", "type"), tr("pdf", "machine"), `EUR/${minute}`];
  const machCols = [50, 90, 42];
  const machScale = contentWidth / machCols.reduce((a, b) => a + b, 0);
  const machScaled = machCols.map((w) => w * machScale);

  y = drawTableHeader(doc, y, margin, contentWidth, machHeaders, machScaled);
  data.machines.forEach((m, idx) => {
    y = drawTableRow(
      doc, y, margin, contentWidth,
      [m.label, m.name, m.rate.toFixed(2)],
      machScaled, idx % 2 === 0
    );
  });
  y += 6;

  // ── Production Info ──
  y = sectionTitle(doc, tr("pdf", "productionInfo"), y, margin);

  const prodRows = [
    [tr("pdf", "perPartSetup"), `${data.setupTime} ${minute}`],
    [tr("pdf", "perPartMachining"), `${data.machiningTime} ${minute}`],
    [tr("pdf", "orderQty"), `${data.orderQuantity}`],
    [tr("pdf", "totalMachining"), `${data.calculations.totalMachiningHours} ${hour}`],
    [tr("pdf", "density"), `${data.density} g/cm³`],
    [tr("pdf", "partWeight"), `${data.weightKg} kg`],
    [tr("pdf", "materialPrice"), `${data.materialPricePerKg} EUR/kg`],
  ];
  const prodCols = [140, 42];
  const prodScaled = prodCols.map((w) => (w / 182) * contentWidth);

  prodRows.forEach((row, idx) => {
    y = drawTableRow(doc, y, margin, contentWidth, row, prodScaled, idx % 2 === 0);
  });
  y += 6;

  // ── Additional Costs ──
  y = sectionTitle(doc, tr("pdf", "additionalCosts"), y, margin);

  const addCosts = [
    [tr("pdf", "tooling"), `${data.toolCost.toFixed(2)} EUR`],
    [tr("pdf", "shipping"), `${data.shippingCost.toFixed(2)} EUR`],
    [tr("pdf", "coating"), `${data.coatingCost.toFixed(2)} EUR`],
    [tr("pdf", "heatTreatment"), `${data.heatTreatmentCost.toFixed(2)} EUR`],
  ];
  addCosts.forEach((row, idx) => {
    y = drawTableRow(doc, y, margin, contentWidth, row, prodScaled, idx % 2 === 0);
  });
  y += 8;

  // ── Cost Summary ──
  y = sectionTitle(doc, tr("pdf", "costSummary"), y, margin);

  const summaryRows = [
    [tr("pdf", "materialCost"), `${data.calculations.totalMaterialCost} EUR`],
    [tr("pdf", "setupCost") || "Setup Maliyeti", `${data.calculations.setupCost} EUR`],
    [tr("pdf", "machineCost"), `${data.calculations.machineCost} EUR`],
    [tr("pdf", "totalAdditional"), `${data.calculations.additionalCosts} EUR`],
    [`${tr("pdf", "scrapCost")} (%${data.scrapRate})`, `${data.calculations.scrapCost} EUR`],
    [`${tr("pdf", "profitLabel")} (%${data.profitMargin})`, `${data.calculations.profit} EUR`],
  ];
  summaryRows.forEach((row, idx) => {
    y = drawTableRow(doc, y, margin, contentWidth, row, prodScaled, idx % 2 === 0);
  });
  y += 5;

  // ── Grand Total Box ──
  doc.setFillColor(...BRAND.dark);
  doc.roundedRect(margin, y, contentWidth, 16, 2, 2, "F");
  doc.setFillColor(...BRAND.primary);
  doc.rect(margin, y, 4, 16, "F");

  doc.setFont(ff, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.white);
  doc.text(tr("pdf", "grandTotal"), margin + 8, y + 7);

  doc.setFont(ff, "bold");
  doc.setFontSize(16);
  doc.setTextColor(...BRAND.primary);
  doc.text(`${data.calculations.grandTotal} EUR`, margin + contentWidth - 4, y + 11, { align: "right" });
  y += 20;

  // Per part
  doc.setFont(ff, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text(
    `${tr("pdf", "costPerPart")}: ${data.calculations.costPerPart} EUR  (${data.orderQuantity} ${tr("common", "piece")})`,
    margin,
    y
  );

  // ── Footer ──
  drawFooter(doc, tr("pdf", "costFooter"), tr("pdf", "page"));

  const refSlug = data.referenceNo ? data.referenceNo.replace(/\s+/g, "_") : "maliyet";
  doc.save(`${refSlug}_maliyet_${new Date().toISOString().slice(0, 10)}.pdf`);
};
