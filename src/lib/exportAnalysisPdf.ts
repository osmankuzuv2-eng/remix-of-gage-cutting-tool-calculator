import jsPDF from "jspdf";
import {
  registerFonts,
  drawHeader,
  drawFooter,
  sectionTitle,
  BRAND,
} from "./pdfHelpers";

interface Operation {
  step: number;
  operation: string;
  machine: string;
  tool: string;
  toolNumber?: string;
  cuttingSpeed: string;
  feedRate: string;
  tableFeed?: string;
  depthOfCut: string;
  radialDepth?: string;
  spindleSpeed?: string;
  numberOfPasses?: string;
  coolant?: string;
  estimatedTime: string;
  notes: string;
}

interface ClampingDetail {
  setupNumber: number;
  clampingType: string;
  description: string;
  clampingTime: string;
  unclampingTime: string;
  notes: string;
}

interface AnalysisResult {
  partName: string;
  material: string;
  rawMaterialDimensions?: string;
  overallDimensions: string;
  complexity: string;
  weight?: string;
  clampingStrategy?: string;
  clampingDetails?: ClampingDetail[];
  totalClampingTime?: string;
  totalMachiningTime?: string;
  operations: Operation[];
  totalEstimatedTime: string;
  setupTime: string;
  recommendations: string[];
  tolerances: string;
  surfaceFinish: string;
  criticalFeatures?: string;
  machinesRequired: string[];
  toolList?: string[];
  difficultyNotes: string;
}

type TFn = (section: string, key: string) => string;

/* ── Helper: draw wrapped text in a cell, return actual height used ── */
const drawCellText = (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number
): number => {
  const lines: string[] = doc.splitTextToSize(text, maxW - 2);
  lines.forEach((line: string, i: number) => {
    doc.text(line, x + 1, y + 3.5 + i * lineH);
  });
  return Math.max(lines.length * lineH + 2, 6);
};

/* ── Helper: measure cell height without drawing ── */
const measureCellH = (doc: jsPDF, text: string, maxW: number, lineH: number): number => {
  const lines: string[] = doc.splitTextToSize(text, maxW - 2);
  return Math.max(lines.length * lineH + 2, 6);
};

/* ── Helper: draw a key-value detail line ── */
const drawDetail = (
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  maxW: number
): number => {
  doc.setFont("Roboto", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...BRAND.dark);
  doc.text(`${label}:`, x, y);
  const labelW = doc.getTextWidth(`${label}: `);

  doc.setFont("Roboto", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(50, 50, 60);
  const valLines: string[] = doc.splitTextToSize(value, maxW - labelW - 4);
  valLines.forEach((line: string, i: number) => {
    doc.text(line, x + labelW, y + i * 3.5);
  });
  return valLines.length * 3.5 + 2;
};

export const exportAnalysisPdf = async (analysis: AnalysisResult, t?: TFn) => {
  const tr = t || ((_s: string, k: string) => k);
  const doc = new jsPDF({ orientation: "portrait" });
  await registerFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  const bottomMargin = 18;
  const lineH = 3.2;

  const checkPage = (needed: number) => {
    if (y + needed > pageHeight - bottomMargin) {
      doc.addPage();
      y = 14;
    }
  };

  // ═══════════════════════════════════════════
  // PAGE 1: HEADER + SUMMARY
  // ═══════════════════════════════════════════
  let y = await drawHeader(doc, tr("pdf", "analysisReport"));

  // ── Summary card ──
  const cardY = y;
  const cardPad = 4;
  doc.setFillColor(245, 246, 252);
  doc.setDrawColor(200, 200, 220);
  doc.roundedRect(margin, cardY, contentWidth, 44, 2, 2, "FD");
  doc.setFillColor(...BRAND.primary);
  doc.rect(margin, cardY, contentWidth, 1.5, "F");

  let cy = cardY + 6;
  const halfW = contentWidth / 2 - cardPad;

  // Left column
  const leftX = margin + cardPad;
  cy = cardY + 6;
  doc.setFont("Roboto", "bold"); doc.setFontSize(7); doc.setTextColor(...BRAND.muted);
  doc.text("PARCA ADI", leftX, cy);
  doc.setFont("Roboto", "bold"); doc.setFontSize(11); doc.setTextColor(...BRAND.dark);
  const partNameTrunc = analysis.partName.length > 30 ? analysis.partName.substring(0, 28) + ".." : analysis.partName;
  doc.text(partNameTrunc, leftX, cy + 5);

  cy = cardY + 18;
  doc.setFont("Roboto", "normal"); doc.setFontSize(7); doc.setTextColor(...BRAND.muted);
  doc.text("MALZEME", leftX, cy);
  doc.setFont("Roboto", "bold"); doc.setFontSize(8.5); doc.setTextColor(50, 50, 70);
  const matTrunc = analysis.material.length > 35 ? analysis.material.substring(0, 33) + ".." : analysis.material;
  doc.text(matTrunc, leftX, cy + 4.5);

  cy = cardY + 28;
  doc.setFont("Roboto", "normal"); doc.setFontSize(7); doc.setTextColor(...BRAND.muted);
  doc.text("BOYUTLAR", leftX, cy);
  doc.setFont("Roboto", "normal"); doc.setFontSize(8); doc.setTextColor(50, 50, 70);
  doc.text(analysis.overallDimensions || "-", leftX, cy + 4.5);

  cy = cardY + 38;
  if (analysis.rawMaterialDimensions) {
    doc.setFont("Roboto", "normal"); doc.setFontSize(7); doc.setTextColor(...BRAND.muted);
    doc.text("HAM MALZEME", leftX, cy);
    doc.setFont("Roboto", "normal"); doc.setFontSize(8); doc.setTextColor(50, 50, 70);
    doc.text(analysis.rawMaterialDimensions, leftX, cy + 4.5);
  }

  // Right column - times
  const rightX = margin + contentWidth / 2 + cardPad;
  cy = cardY + 6;
  doc.setFont("Roboto", "normal"); doc.setFontSize(7); doc.setTextColor(...BRAND.muted);
  doc.text("KARMASIKLIK", rightX, cy);
  doc.setFont("Roboto", "bold"); doc.setFontSize(9); doc.setTextColor(...BRAND.primary);
  doc.text(analysis.complexity || "-", rightX, cy + 5);

  cy = cardY + 18;
  doc.setFont("Roboto", "normal"); doc.setFontSize(7); doc.setTextColor(...BRAND.muted);
  doc.text("TOPLAM ISLEME SURESI", rightX, cy);
  doc.setFont("Roboto", "bold"); doc.setFontSize(10); doc.setTextColor(...BRAND.dark);
  doc.text(`${analysis.totalEstimatedTime} dk`, rightX, cy + 5);

  cy = cardY + 28;
  doc.setFont("Roboto", "normal"); doc.setFontSize(7); doc.setTextColor(...BRAND.muted);
  doc.text("HAZIRLIK SURESI", rightX, cy);
  doc.setFont("Roboto", "bold"); doc.setFontSize(9); doc.setTextColor(50, 50, 70);
  doc.text(`${analysis.setupTime} dk`, rightX, cy + 4.5);

  cy = cardY + 38;
  if (analysis.weight) {
    doc.setFont("Roboto", "normal"); doc.setFontSize(7); doc.setTextColor(...BRAND.muted);
    doc.text("AGIRLIK", rightX, cy);
    doc.setFont("Roboto", "normal"); doc.setFontSize(8); doc.setTextColor(50, 50, 70);
    doc.text(analysis.weight, rightX, cy + 4.5);
  }

  y = cardY + 48;

  // ── Clamping strategy ──
  if (analysis.clampingStrategy) {
    checkPage(12);
    y += 1;
    y += drawDetail(doc, "Baglama Stratejisi", analysis.clampingStrategy, margin, y, contentWidth);
  }

  // ── Clamping details table ──
  if (analysis.clampingDetails && analysis.clampingDetails.length > 0) {
    checkPage(20);
    y = sectionTitle(doc, "Baglama Detaylari", y, margin);

    const clampCols = [14, 32, 70, 18, 18, 30];
    const clampTotalW = clampCols.reduce((a, b) => a + b, 0);
    const clampScale = contentWidth / clampTotalW;
    const sc = clampCols.map(w => w * clampScale);
    const clampHeaders = ["Setup", "Tip", "Aciklama", "Baglama", "Cozme", "Notlar"];

    // Header
    const drawClampHead = () => {
      doc.setFillColor(...BRAND.dark);
      doc.rect(margin, y, contentWidth, 6, "F");
      doc.setFont("Roboto", "bold"); doc.setFontSize(6); doc.setTextColor(...BRAND.white);
      let tx = margin + 1;
      clampHeaders.forEach((h, i) => { doc.text(h, tx, y + 4); tx += sc[i]; });
      y += 6;
    };
    drawClampHead();

    analysis.clampingDetails.forEach((cd, idx) => {
      const cells = [String(cd.setupNumber), cd.clampingType, cd.description, `${cd.clampingTime} dk`, `${cd.unclampingTime} dk`, cd.notes || "-"];
      const rowH = Math.max(...cells.map((c, i) => measureCellH(doc, c, sc[i], lineH)));
      
      if (y + rowH > pageHeight - bottomMargin) { doc.addPage(); y = 14; drawClampHead(); }
      
      if (idx % 2 === 0) { doc.setFillColor(245, 246, 250); doc.rect(margin, y, contentWidth, rowH, "F"); }
      doc.setFont("Roboto", "normal"); doc.setFontSize(6); doc.setTextColor(50, 50, 60);
      let tx = margin;
      cells.forEach((c, i) => { drawCellText(doc, c, tx, y, sc[i], lineH); tx += sc[i]; });
      y += rowH;
    });

    if (analysis.totalClampingTime) {
      doc.setFont("Roboto", "bold"); doc.setFontSize(7.5); doc.setTextColor(...BRAND.primary);
      doc.text(`Toplam Baglama Suresi: ${analysis.totalClampingTime} dk`, margin, y + 4);
      y += 8;
    }
    y += 3;
  }

  // ═══════════════════════════════════════════
  // OPERATIONS TABLE - LANDSCAPE PAGE
  // ═══════════════════════════════════════════
  doc.addPage("l"); // landscape
  y = 14;

  const lPageW = doc.internal.pageSize.getWidth();
  const lPageH = doc.internal.pageSize.getHeight();
  const lContentW = lPageW - margin * 2;

  // Section title
  doc.setFont("Roboto", "bold"); doc.setFontSize(11); doc.setTextColor(...BRAND.dark);
  doc.text("Operasyon Adimlari", margin, y);
  doc.setFillColor(...BRAND.primary);
  doc.rect(margin, y + 1.5, doc.getTextWidth("Operasyon Adimlari"), 0.7, "F");
  y += 8;

  // Column definitions for landscape - much more room
  const opCols = [8, 42, 28, 40, 16, 16, 16, 12, 12, 14, 14, 30, 14];
  const opHeaders = ["#", "Islem", "Tezgah", "Takim", "Vc", "n", "f/fz", "ap", "ae", "Paso", "Sogutma", "Hesaplama Notlari", "Sure"];
  const opTotalW = opCols.reduce((a, b) => a + b, 0);
  const opScale = lContentW / opTotalW;
  const opSc = opCols.map(w => w * opScale);

  const drawOpsHead = () => {
    doc.setFillColor(...BRAND.dark);
    doc.rect(margin, y, lContentW, 7, "F");
    doc.setFillColor(...BRAND.primary);
    doc.rect(margin, y, lContentW, 0.8, "F");
    doc.setFont("Roboto", "bold"); doc.setFontSize(6); doc.setTextColor(...BRAND.white);
    let tx = margin + 1;
    opHeaders.forEach((h, i) => { doc.text(h, tx, y + 5); tx += opSc[i]; });
    doc.setTextColor(0, 0, 0);
    y += 7;
  };

  drawOpsHead();

  analysis.operations.forEach((op, idx) => {
    const cells = [
      String(op.step),
      op.operation || "-",
      op.machine || "-",
      `${op.toolNumber ? op.toolNumber + " " : ""}${op.tool || "-"}`,
      String(op.cuttingSpeed || "-"),
      op.spindleSpeed ? String(op.spindleSpeed) : "-",
      `${op.feedRate || "-"}${op.tableFeed ? ` (F:${op.tableFeed})` : ""}`,
      String(op.depthOfCut || "-"),
      op.radialDepth ? String(op.radialDepth) : "-",
      op.numberOfPasses ? String(op.numberOfPasses) : "-",
      op.coolant || "-",
      op.notes || "-",
      `${op.estimatedTime} dk`,
    ];

    // Calculate row height
    doc.setFont("Roboto", "normal"); doc.setFontSize(5.5);
    const rowH = Math.max(...cells.map((c, i) => measureCellH(doc, c, opSc[i], 2.8)), 6);

    if (y + rowH > lPageH - bottomMargin) {
      doc.addPage("l");
      y = 14;
      drawOpsHead();
    }

    // Zebra stripe
    if (idx % 2 === 0) { doc.setFillColor(245, 246, 250); doc.rect(margin, y, lContentW, rowH, "F"); }
    // Light grid lines
    doc.setDrawColor(220, 220, 230); doc.setLineWidth(0.2);
    doc.line(margin, y + rowH, margin + lContentW, y + rowH);

    doc.setFont("Roboto", "normal"); doc.setFontSize(5.5); doc.setTextColor(40, 40, 55);
    let tx = margin;
    cells.forEach((c, i) => {
      drawCellText(doc, c, tx, y, opSc[i], 2.8);
      tx += opSc[i];
    });
    y += rowH;
  });

  // Total time row
  doc.setFillColor(...BRAND.dark);
  doc.rect(margin, y, lContentW, 7, "F");
  doc.setFont("Roboto", "bold"); doc.setFontSize(7); doc.setTextColor(...BRAND.white);
  doc.text("TOPLAM ISLEME SURESI", margin + 4, y + 5);
  doc.setFont("Roboto", "bold"); doc.setFontSize(8); doc.setTextColor(...BRAND.primary);
  doc.text(`${analysis.totalEstimatedTime} dk`, lContentW + margin - 4, y + 5, { align: "right" });
  if (analysis.totalMachiningTime) {
    doc.setFont("Roboto", "normal"); doc.setFontSize(6); doc.setTextColor(180, 185, 200);
    doc.text(`(Tezgah suresi: ${analysis.totalMachiningTime} dk)`, lContentW / 2 + margin, y + 5, { align: "center" });
  }
  y += 10;

  // ═══════════════════════════════════════════
  // PAGE 3+: DETAILS (portrait)
  // ═══════════════════════════════════════════
  doc.addPage("p");
  y = 14;
  const pW = doc.internal.pageSize.getWidth();
  const pH = doc.internal.pageSize.getHeight();
  const cW = pW - margin * 2;

  const checkPortrait = (needed: number) => {
    if (y + needed > pH - bottomMargin) { doc.addPage(); y = 14; }
  };

  // ── Machines Required ──
  y = sectionTitle(doc, "Kullanilan Tezgahlar", y, margin);
  doc.setFont("Roboto", "normal"); doc.setFontSize(7.5); doc.setTextColor(50, 50, 60);
  analysis.machinesRequired.forEach(m => {
    checkPortrait(5);
    doc.text(`• ${m}`, margin + 2, y);
    y += 4;
  });
  y += 3;

  // ── Tool List ──
  if (analysis.toolList && analysis.toolList.length > 0) {
    checkPortrait(15);
    y = sectionTitle(doc, "Takim Listesi", y, margin);
    doc.setFont("Roboto", "normal"); doc.setFontSize(7); doc.setTextColor(50, 50, 60);
    analysis.toolList.forEach(tl => {
      const lines: string[] = doc.splitTextToSize(`• ${tl}`, cW - 4);
      checkPortrait(lines.length * 3.5 + 2);
      doc.text(lines, margin + 2, y);
      y += lines.length * 3.5 + 1.5;
    });
    y += 3;
  }

  // ── Tolerances & Surface ──
  checkPortrait(20);
  y = sectionTitle(doc, "Tolerans ve Yuzey Kalitesi", y, margin);
  y += drawDetail(doc, "Toleranslar", analysis.tolerances || "-", margin, y, cW);
  y += drawDetail(doc, "Yuzey Kalitesi", analysis.surfaceFinish || "-", margin, y, cW);
  if (analysis.criticalFeatures) {
    y += drawDetail(doc, "Kritik Olculer", analysis.criticalFeatures, margin, y, cW);
  }
  y += 3;

  // ── Recommendations ──
  checkPortrait(15);
  y = sectionTitle(doc, "Oneriler", y, margin);
  doc.setFont("Roboto", "normal"); doc.setFontSize(7.5); doc.setTextColor(50, 50, 60);
  analysis.recommendations.forEach(r => {
    const lines: string[] = doc.splitTextToSize(`• ${r}`, cW - 4);
    checkPortrait(lines.length * 3.5 + 3);
    doc.text(lines, margin + 2, y);
    y += lines.length * 3.5 + 2;
  });
  y += 3;

  // ── Difficulty Notes ──
  checkPortrait(15);
  y = sectionTitle(doc, "Zorluk Notlari", y, margin);
  doc.setFont("Roboto", "normal"); doc.setFontSize(7.5); doc.setTextColor(50, 50, 60);
  const diffLines: string[] = doc.splitTextToSize(analysis.difficultyNotes || "-", cW);
  checkPortrait(diffLines.length * 3.5);
  doc.text(diffLines, margin, y);

  // ── Footer on all pages ──
  drawFooter(doc, tr("pdf", "footer"));

  // Save
  const fileName = `${analysis.partName.replace(/\s+/g, "_")}_analiz_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
};
