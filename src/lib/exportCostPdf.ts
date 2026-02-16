import jsPDF from "jspdf";

// Turkish character safe text helper
const safeText = (text: string) => {
  if (!text) return "";
  return String(text)
    .replace(/İ/g, "I").replace(/ı/g, "i")
    .replace(/Ğ/g, "G").replace(/ğ/g, "g")
    .replace(/Ü/g, "U").replace(/ü/g, "u")
    .replace(/Ş/g, "S").replace(/ş/g, "s")
    .replace(/Ö/g, "O").replace(/ö/g, "o")
    .replace(/Ç/g, "C").replace(/ç/g, "c");
};

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
    laborCost: string;
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

export const exportCostPdf = (data: CostPdfData, t?: TFn) => {
  const tr = t || ((s: string, k: string) => k);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 14;
  const minute = tr("common", "minute");
  const hour = tr("common", "hour");

  // ── Title ──
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(safeText(tr("pdf", "costReport")), pageWidth / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString(), pageWidth / 2, y, { align: "center" });
  y += 7;

  // ── Reference & Customer info bar ──
  doc.setDrawColor(100);
  doc.setFillColor(245, 245, 250);
  doc.roundedRect(margin, y, contentWidth, 14, 2, 2, "FD");
  const boxMid = y + 9;
  const infoCols = [
    { label: safeText(tr("pdf", "referenceNo")), value: data.referenceNo || "-" },
    { label: safeText(tr("pdf", "customer")), value: data.customer || "-" },
    { label: safeText(tr("common", "material")), value: data.material },
    { label: safeText(tr("pdf", "laborRate")), value: `${data.laborRate}` },
  ];
  const colW = contentWidth / 4;
  infoCols.forEach((c, i) => {
    const x = margin + colW * i + colW / 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text(safeText(c.label), x, y + 5, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const val = safeText(c.value);
    doc.text(val.length > 24 ? val.substring(0, 22) + ".." : val, x, boxMid, { align: "center" });
  });
  y += 18;

  // Helper: section title
  const sectionTitle = (title: string) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(safeText(title), margin, y);
    y += 5;
  };

  // Helper: table row
  const ROW_H = 5.5;
  const tableRow = (label: string, value: string, idx: number) => {
    if (idx % 2 === 0) {
      doc.setFillColor(248, 248, 252);
      doc.rect(margin, y, contentWidth, ROW_H, "F");
    }
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(label, margin + 2, y + 4);
    doc.setFont("helvetica", "bold");
    doc.text(value, margin + contentWidth - 3, y + 4, { align: "right" });
    y += ROW_H;
  };

  // ── Machines ──
  sectionTitle(tr("pdf", "machineInfo"));
  doc.setFillColor(50, 50, 70);
  doc.setTextColor(255);
  doc.rect(margin, y, contentWidth, ROW_H, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text(safeText(tr("pdf", "type")), margin + 2, y + 4);
  doc.text(safeText(tr("pdf", "machine")), margin + 30, y + 4);
  doc.text("EUR/" + minute, margin + contentWidth - 3, y + 4, { align: "right" });
  y += ROW_H;
  doc.setTextColor(0);

  data.machines.forEach((m, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(248, 248, 252);
      doc.rect(margin, y, contentWidth, ROW_H, "F");
    }
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(safeText(m.label), margin + 2, y + 4);
    doc.text(safeText(m.name), margin + 30, y + 4);
    doc.setFont("helvetica", "bold");
    doc.text(`${m.rate.toFixed(2)}`, margin + contentWidth - 3, y + 4, { align: "right" });
    y += ROW_H;
  });
  y += 4;

  // ── Production Info ──
  sectionTitle(tr("pdf", "productionInfo"));
  const prodRows = [
    [safeText(tr("pdf", "perPartSetup")), `${data.setupTime} ${minute}`],
    [safeText(tr("pdf", "perPartMachining")), `${data.machiningTime} ${minute}`],
    [safeText(tr("pdf", "orderQty")), `${data.orderQuantity}`],
    [safeText(tr("pdf", "totalMachining")), `${data.calculations.totalMachiningHours} ${hour}`],
    [safeText(tr("pdf", "density")), `${data.density} g/cm3`],
    [safeText(tr("pdf", "partWeight")), `${data.weightKg} kg`],
    [safeText(tr("pdf", "materialPrice")), `${data.materialPricePerKg} EUR/kg`],
  ];
  prodRows.forEach((row, idx) => tableRow(row[0], row[1], idx));
  y += 4;

  // ── Additional Costs ──
  sectionTitle(tr("pdf", "additionalCosts"));
  const addCosts = [
    [safeText(tr("pdf", "tooling")), `${data.toolCost.toFixed(2)} EUR`],
    [safeText(tr("pdf", "shipping")), `${data.shippingCost.toFixed(2)} EUR`],
    [safeText(tr("pdf", "coating")), `${data.coatingCost.toFixed(2)} EUR`],
    [safeText(tr("pdf", "heatTreatment")), `${data.heatTreatmentCost.toFixed(2)} EUR`],
  ];
  addCosts.forEach((row, idx) => tableRow(row[0], row[1], idx));
  y += 6;

  // ── Cost Summary ──
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(safeText(tr("pdf", "costSummary")), margin, y);
  y += 5;

  const summaryRows = [
    [safeText(tr("pdf", "materialCost")), `${data.calculations.totalMaterialCost} EUR`],
    [safeText(tr("pdf", "laborCost")), `${data.calculations.laborCost} EUR`],
    [safeText(tr("pdf", "machineCost")), `${data.calculations.machineCost} EUR`],
    [safeText(tr("pdf", "totalAdditional")), `${data.calculations.additionalCosts} EUR`],
    [`${safeText(tr("pdf", "scrapCost"))} (%${data.scrapRate})`, `${data.calculations.scrapCost} EUR`],
    [`${safeText(tr("pdf", "profitLabel"))} (%${data.profitMargin})`, `${data.calculations.profit} EUR`],
  ];
  summaryRows.forEach((row, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(248, 248, 252);
      doc.rect(margin, y, contentWidth, 6, "F");
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(row[0], margin + 2, y + 4.5);
    doc.setFont("helvetica", "bold");
    doc.text(row[1], margin + contentWidth - 3, y + 4.5, { align: "right" });
    y += 6;
  });
  y += 3;

  // ── Grand Total box ──
  doc.setFillColor(30, 80, 160);
  doc.setTextColor(255);
  doc.roundedRect(margin, y, contentWidth, 14, 2, 2, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(safeText(tr("pdf", "grandTotal")), margin + 4, y + 6);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`${data.calculations.grandTotal} EUR`, margin + contentWidth - 4, y + 10, { align: "right" });
  y += 17;

  // Per part
  doc.setTextColor(0);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`${safeText(tr("pdf", "costPerPart"))}: ${data.calculations.costPerPart} EUR  (${data.orderQuantity} ${tr("common", "piece")})`, margin, y);

  // ── Footer ──
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(180);
  doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
  doc.setFontSize(6);
  doc.text(safeText(tr("pdf", "costFooter")), margin, pageHeight - 6);
  doc.text(`${safeText(tr("pdf", "page"))} 1/1`, pageWidth - margin, pageHeight - 6, { align: "right" });

  const refSlug = data.referenceNo ? safeText(data.referenceNo).replace(/\s+/g, "_") : "cost";
  doc.save(`${refSlug}_cost_${new Date().toISOString().slice(0, 10)}.pdf`);
};
