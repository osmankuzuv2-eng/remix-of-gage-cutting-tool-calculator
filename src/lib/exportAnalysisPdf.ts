import jsPDF from "jspdf";

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
  clampingStrategy?: string;
  operations: Operation[];
  totalEstimatedTime: string;
  setupTime: string;
  recommendations: string[];
  tolerances: string;
  surfaceFinish: string;
  machinesRequired: string[];
  difficultyNotes: string;
}

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

type TFn = (section: string, key: string) => string;

export const exportAnalysisPdf = (analysis: AnalysisResult, t?: TFn) => {
  // Fallback t function for backward compat
  const tr = t || ((s: string, k: string) => k);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const bottomMargin = 15;
  let y = 20;

  const checkPage = (needed: number) => {
    if (y + needed > pageHeight - bottomMargin) {
      doc.addPage();
      y = 20;
    }
  };

  const minute = tr("common", "minute");

  // --- Title ---
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(safeText(tr("pdf", "analysisReport")), pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString(), pageWidth / 2, y, { align: "center" });
  y += 12;

  // --- Summary box ---
  doc.setDrawColor(100);
  doc.setFillColor(245, 245, 250);
  doc.roundedRect(margin, y, contentWidth, 28, 3, 3, "FD");
  const boxTop = y + 7;
  doc.setFontSize(9);
  const cols = [
    { label: safeText(tr("pdf", "part")), value: safeText(analysis.partName) },
    { label: safeText(tr("common", "material")), value: safeText(analysis.material) },
    { label: safeText(tr("pdf", "complexity")), value: safeText(analysis.complexity) },
    { label: safeText(tr("pdf", "totalTime")), value: `${analysis.totalEstimatedTime} ${minute}` },
  ];
  const colW = contentWidth / 4;
  cols.forEach((c, i) => {
    const x = margin + colW * i + colW / 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(c.label, x, boxTop, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const valTrunc = c.value.length > 22 ? c.value.substring(0, 20) + ".." : c.value;
    doc.text(valTrunc, x, boxTop + 10, { align: "center" });
  });
  y += 32;

  // --- Dimensions & Setup ---
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`${safeText(tr("pdf", "dimensions"))}: ${safeText(analysis.overallDimensions)}    |    ${safeText(tr("pdf", "setupTime"))}: ${analysis.setupTime} ${minute}`, margin, y);
  y += 6;

  // --- Clamping strategy ---
  if (analysis.clampingStrategy) {
    const clampLines = doc.splitTextToSize(`${safeText(tr("pdf", "clampingStrategy"))}: ${safeText(analysis.clampingStrategy)}`, contentWidth);
    doc.text(clampLines, margin, y);
    y += clampLines.length * 4 + 4;
  }
  y += 4;

  // --- Operations table ---
  checkPage(30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(safeText(tr("pdf", "operationSteps")), margin, y);
  y += 7;

  // Table header
  const colWidths = [8, 34, 24, 28, 18, 18, 18, 16, 16];
  const headers = ["#", safeText(tr("pdf", "operation")), safeText(tr("pdf", "machine")), safeText(tr("pdf", "tool")), "Vc", "n", "f", "ap", safeText(tr("pdf", "time"))];
  const totalColW = colWidths.reduce((a, b) => a + b, 0);
  const scale = contentWidth / totalColW;
  const scaledCols = colWidths.map(w => w * scale);

  const drawTableHeader = () => {
    doc.setFillColor(50, 50, 70);
    doc.setTextColor(255);
    doc.rect(margin, y, contentWidth, 7, "F");
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    let tx = margin + 1;
    headers.forEach((h, i) => {
      doc.text(h, tx, y + 5);
      tx += scaledCols[i];
    });
    y += 7;
    doc.setTextColor(0);
  };

  drawTableHeader();

  // Table rows
  analysis.operations.forEach((op, idx) => {
    const rowH = 8;
    if (y + rowH > pageHeight - bottomMargin) {
      doc.addPage();
      y = 20;
      drawTableHeader();
    }

    if (idx % 2 === 0) {
      doc.setFillColor(248, 248, 252);
      doc.rect(margin, y, contentWidth, rowH, "F");
    }

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    let tx = margin + 1;
    const row = [
      String(op.step),
      safeText(op.operation),
      safeText(op.machine),
      safeText(op.tool),
      String(op.cuttingSpeed),
      op.spindleSpeed ? String(op.spindleSpeed) : "-",
      String(op.feedRate),
      String(op.depthOfCut),
      `${op.estimatedTime} ${minute}`,
    ];
    row.forEach((cell, i) => {
      const maxChars = Math.floor(scaledCols[i] / 1.8);
      const truncated = cell.length > maxChars ? cell.substring(0, maxChars - 1) + ".." : cell;
      doc.text(truncated, tx, y + 5.5);
      tx += scaledCols[i];
    });
    y += rowH;
  });
  y += 10;

  // --- Machines & Tolerances ---
  checkPage(30);
  const halfW = contentWidth / 2 - 3;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(safeText(tr("pdf", "requiredMachines")), margin, y);
  doc.text(safeText(tr("pdf", "toleranceAndSurface")), margin + halfW + 6, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");

  const machineLines = doc.splitTextToSize(analysis.machinesRequired.map(m => safeText(m)).join(", "), halfW);
  const tolLines = doc.splitTextToSize(`${safeText(tr("pdf", "tolerances"))}: ${safeText(analysis.tolerances)}`, halfW);
  const surfLines = doc.splitTextToSize(`${safeText(tr("pdf", "surfaceQuality"))}: ${safeText(analysis.surfaceFinish)}`, halfW);

  const leftLines = machineLines;
  const rightLines = [...tolLines, "", ...surfLines];
  const maxLines = Math.max(leftLines.length, rightLines.length);

  doc.text(leftLines, margin, y);
  doc.text(rightLines, margin + halfW + 6, y);

  y += maxLines * 4 + 8;

  // --- Recommendations ---
  checkPage(20);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(safeText(tr("pdf", "recommendations")), margin, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  analysis.recommendations.forEach((r) => {
    const lines = doc.splitTextToSize(`• ${safeText(r)}`, contentWidth - 4);
    checkPage(lines.length * 4 + 2);
    doc.text(lines, margin + 2, y);
    y += lines.length * 4 + 2;
  });
  y += 6;

  // --- Difficulty ---
  checkPage(15);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(safeText(tr("pdf", "difficultyNotes")), margin, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const diffLines = doc.splitTextToSize(safeText(analysis.difficultyNotes), contentWidth);
  checkPage(diffLines.length * 4);
  doc.text(diffLines, margin, y);
  y += diffLines.length * 4 + 6;

  // --- Footer line ---
  doc.setDrawColor(180);
  doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
  doc.setFontSize(7);
  doc.text(safeText(tr("pdf", "footer")), margin, pageHeight - 8);
  doc.text(`${safeText(tr("pdf", "page"))} 1/${doc.getNumberOfPages()}`, pageWidth - margin, pageHeight - 8, { align: "right" });

  // Save
  const fileName = `${safeText(analysis.partName).replace(/\s+/g, "_")}_analiz_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
};
