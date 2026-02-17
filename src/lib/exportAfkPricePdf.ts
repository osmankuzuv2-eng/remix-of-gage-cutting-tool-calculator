import jsPDF from "jspdf";
import {
  registerFonts,
  getFontFamily,
  drawHeader,
  drawFooter,
  sectionTitle,
  drawInfoBox,
  drawTableRow,
  BRAND,
} from "./pdfHelpers";

export interface AfkPricePdfData {
  material: string;
  materialPrice: number;
  afkMultiplier: number;
  density: number;
  grossWeight: number;
  netWeight: number;
  chipWeight: string;
  chipVolumeCm3: string;
  machine: string;
  machinePowerKw: number;
  mrrCm3PerMin: string;
  machiningTimeMin: string;
  machineRate: number;
  hasHoles: boolean;
  smallHoles: number;
  largeHoles: number;
  quantity: number;
  profitMargin: number;
  calculations: {
    rawMaterialCost: string;
    chipCost: string;
    machineCost: string;
    smallHoleCost: string;
    largeHoleCost: string;
    totalHoleCost: string;
    subtotal: string;
    profit: string;
    unitTotal: string;
    grandTotal: string;
  };
}

type TFn = (section: string, key: string) => string;

export const exportAfkPricePdf = async (data: AfkPricePdfData, t?: TFn) => {
  const tr = t || ((_s: string, k: string) => k);
  const doc = new jsPDF();
  await registerFonts(doc);
  const ff = getFontFamily();

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // ── Header ──
  let y = await drawHeader(doc, tr("afkPrice", "title"));

  // ── Info box ──
  y = drawInfoBox(doc, y, margin, contentWidth, [
    { label: tr("costCalc", "materialType"), value: data.material },
    { label: `${tr("afkPrice", "density")}`, value: `${data.density} g/cm³` },
    { label: tr("afkPrice", "machineSelection"), value: data.machine },
    { label: tr("afkPrice", "quantity"), value: `${data.quantity}` },
  ]);

  // ── Weight details ──
  y = sectionTitle(doc, tr("afkPrice", "inputs"), y, margin);

  const cols = [140, 42];
  const scaled = cols.map((w) => (w / 182) * contentWidth);

  const weightRows = [
    [tr("afkPrice", "grossWeight"), `${data.grossWeight} kg`],
    [tr("afkPrice", "netWeight"), `${data.netWeight} kg`],
    [tr("afkPrice", "chipWeight"), `${data.chipWeight} kg`],
    [tr("afkPrice", "chipVolume"), `${data.chipVolumeCm3} cm³`],
    [tr("afkPrice", "materialPrice"), `€${data.materialPrice}/kg (AFK: ×${data.afkMultiplier}) (+%10)`],
  ];
  weightRows.forEach((row, idx) => {
    y = drawTableRow(doc, y, margin, contentWidth, row, scaled, idx % 2 === 0);
  });
  y += 6;

  // ── Machine details ──
  y = sectionTitle(doc, tr("afkPrice", "machineSelection"), y, margin);

  const machRows = [
    [tr("afkPrice", "machineSelection"), `${data.machine} (${data.machinePowerKw} kW)`],
    [tr("afkPrice", "mrr"), `${data.mrrCm3PerMin} cm³/dk`],
    [tr("afkPrice", "machiningTime"), `${data.machiningTimeMin} dk`],
    [tr("afkPrice", "machineRate"), `€${data.machineRate}/${tr("common", "minute")}`],
  ];
  machRows.forEach((row, idx) => {
    y = drawTableRow(doc, y, margin, contentWidth, row, scaled, idx % 2 === 0);
  });
  y += 6;

  // ── Cost breakdown ──
  y = sectionTitle(doc, tr("afkPrice", "results"), y, margin);

  const costRows = [
    [`${tr("afkPrice", "rawMaterialCost")} (×${data.afkMultiplier} +%10)`, `€${data.calculations.rawMaterialCost}`],
    [tr("afkPrice", "chipCost"), `€${data.calculations.chipCost}`],
    [tr("afkPrice", "machineCostLabel"), `€${data.calculations.machineCost}`],
  ];

  if (data.hasHoles) {
    costRows.push(
      [`${tr("afkPrice", "smallHoles")} (${data.smallHoles} × €1,50)`, `€${data.calculations.smallHoleCost}`],
      [`${tr("afkPrice", "largeHoles")} (${data.largeHoles} × €1,00)`, `€${data.calculations.largeHoleCost}`],
      [tr("afkPrice", "totalHoleCost"), `€${data.calculations.totalHoleCost}`],
    );
  }

  costRows.push(
    [tr("afkPrice", "subtotal"), `€${data.calculations.subtotal}`],
    [`${tr("afkPrice", "profit")} (%${data.profitMargin})`, `€${data.calculations.profit}`],
  );

  costRows.forEach((row, idx) => {
    y = drawTableRow(doc, y, margin, contentWidth, row, scaled, idx % 2 === 0);
  });
  y += 5;

  // ── Unit Price Box ──
  doc.setFillColor(...BRAND.dark);
  doc.roundedRect(margin, y, contentWidth, 16, 2, 2, "F");
  doc.setFillColor(...BRAND.primary);
  doc.rect(margin, y, 4, 16, "F");

  doc.setFont(ff, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.white);
  doc.text(tr("afkPrice", "unitPrice"), margin + 8, y + 7);

  doc.setFont(ff, "bold");
  doc.setFontSize(16);
  doc.setTextColor(...BRAND.primary);
  doc.text(`€${data.calculations.unitTotal}`, margin + contentWidth - 4, y + 11, { align: "right" });
  y += 20;

  // ── Grand Total Box ──
  doc.setFillColor(...BRAND.darkAlt);
  doc.roundedRect(margin, y, contentWidth, 16, 2, 2, "F");
  doc.setFillColor(...BRAND.primary);
  doc.rect(margin, y, 4, 16, "F");

  doc.setFont(ff, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.white);
  doc.text(tr("afkPrice", "grandTotal"), margin + 8, y + 7);

  doc.setFont(ff, "bold");
  doc.setFontSize(16);
  doc.setTextColor(...BRAND.primary);
  doc.text(`€${data.calculations.grandTotal}`, margin + contentWidth - 4, y + 11, { align: "right" });
  y += 20;

  // Per piece note
  doc.setFont(ff, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text(
    `${data.quantity} ${tr("common", "piece")} × €${data.calculations.unitTotal}`,
    margin,
    y
  );

  // ── Footer ──
  drawFooter(doc, "AFK Fiyat Raporu - GAGE Confidence ToolSense", tr("pdf", "page"));

  doc.save(`afk_fiyat_${new Date().toISOString().slice(0, 10)}.pdf`);
};
