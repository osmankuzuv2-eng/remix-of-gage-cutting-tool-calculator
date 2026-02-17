import jsPDF from "jspdf";
import {
  registerFonts,
  drawHeader,
  drawFooter,
  sectionTitle,
  drawInfoBox,
  drawTableHeader,
  drawTableRow,
  BRAND,
} from "./pdfHelpers";

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
  overallDimensions: string;
  complexity: string;
  clampingStrategy?: string;
  clampingDetails?: ClampingDetail[];
  totalClampingTime?: string;
  operations: Operation[];
  totalEstimatedTime: string;
  setupTime: string;
  recommendations: string[];
  tolerances: string;
  surfaceFinish: string;
  machinesRequired: string[];
  difficultyNotes: string;
}

type TFn = (section: string, key: string) => string;

export const exportAnalysisPdf = async (analysis: AnalysisResult, t?: TFn) => {
  const tr = t || ((_s: string, k: string) => k);
  const doc = new jsPDF();
  await registerFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const bottomMargin = 16;
  const minute = tr("common", "minute");

  const checkPage = (needed: number) => {
    if (y + needed > pageHeight - bottomMargin) {
      doc.addPage();
      y = 16;
    }
  };

  // ── Header ──
  let y = await drawHeader(doc, tr("pdf", "analysisReport"));

  // ── Summary info box (top row) ──
  y = drawInfoBox(doc, y, margin, contentWidth, [
    { label: tr("pdf", "part"), value: analysis.partName },
    { label: tr("common", "material"), value: analysis.material },
    { label: tr("pdf", "complexity"), value: analysis.complexity },
  ]);

  // ── Time & dimension info row ──
  y = drawInfoBox(doc, y - 2, margin, contentWidth, [
    { label: tr("pdf", "totalTime"), value: `${analysis.totalEstimatedTime} ${minute}` },
    { label: tr("pdf", "setupTime"), value: `${analysis.setupTime} ${minute}` },
    { label: tr("pdf", "dimensions"), value: analysis.overallDimensions },
  ]);

  // Clamping strategy
  if (analysis.clampingStrategy) {
    doc.setFont("Roboto", "normal");
    doc.setFontSize(7);
    doc.setTextColor(70, 70, 90);
    const clampLines = doc.splitTextToSize(
      `${tr("pdf", "clampingStrategy")}: ${analysis.clampingStrategy}`,
      contentWidth
    );
    doc.text(clampLines, margin, y);
    y += clampLines.length * 3.5 + 3;
  }

  // Clamping details table
  if (analysis.clampingDetails && analysis.clampingDetails.length > 0) {
    checkPage(20);
    y = sectionTitle(doc, "Baglama Detaylari", y, margin);

    const clampColWidths = [12, 30, 50, 18, 18, 40];
    const clampHeaders = ["Setup", "Baglama Tipi", "Aciklama", "Baglama", "Cozme", "Notlar"];
    const clampTotalW = clampColWidths.reduce((a, b) => a + b, 0);
    const clampScale = contentWidth / clampTotalW;
    const scaledClampCols = clampColWidths.map((w) => w * clampScale);

    y = drawTableHeader(doc, y, margin, contentWidth, clampHeaders, scaledClampCols);

    analysis.clampingDetails.forEach((cd, idx) => {
      if (y + 7 > pageHeight - bottomMargin) {
        doc.addPage();
        y = 16;
        y = drawTableHeader(doc, y, margin, contentWidth, clampHeaders, scaledClampCols);
      }
      const row = [
        String(cd.setupNumber),
        cd.clampingType,
        cd.description,
        `${cd.clampingTime} dk`,
        `${cd.unclampingTime} dk`,
        cd.notes || "-",
      ];
      y = drawTableRow(doc, y, margin, contentWidth, row, scaledClampCols, idx % 2 === 0);
    });

    if (analysis.totalClampingTime) {
      doc.setFont("Roboto", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...BRAND.primary);
      doc.text(`Toplam Baglama Suresi: ${analysis.totalClampingTime} dk`, margin, y + 4);
      y += 10;
    }
    y += 4;
  }

  y += 2;

  // ── Operations Table ──
  checkPage(30);
  y = sectionTitle(doc, tr("pdf", "operationSteps"), y, margin);

  const colWidths = [8, 32, 22, 26, 16, 16, 16, 14, 14];
  const headers = [
    "#",
    tr("pdf", "operation"),
    tr("pdf", "machine"),
    tr("pdf", "tool"),
    "Vc",
    "n",
    "f",
    "ap",
    tr("pdf", "time"),
  ];
  const totalColW = colWidths.reduce((a, b) => a + b, 0);
  const scale = contentWidth / totalColW;
  const scaledCols = colWidths.map((w) => w * scale);

  const drawOpsHeader = () => {
    y = drawTableHeader(doc, y, margin, contentWidth, headers, scaledCols);
  };

  drawOpsHeader();

  analysis.operations.forEach((op, idx) => {
    if (y + 7 > pageHeight - bottomMargin) {
      doc.addPage();
      y = 16;
      drawOpsHeader();
    }

    const row = [
      String(op.step),
      op.operation,
      op.machine,
      op.tool,
      String(op.cuttingSpeed),
      op.spindleSpeed ? String(op.spindleSpeed) : "-",
      String(op.feedRate),
      String(op.depthOfCut),
      `${op.estimatedTime} ${minute}`,
    ];
    y = drawTableRow(doc, y, margin, contentWidth, row, scaledCols, idx % 2 === 0);
  });
  y += 6;

  // ── Machines Required ──
  checkPage(20);
  y = sectionTitle(doc, tr("pdf", "requiredMachines"), y, margin);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(50, 50, 60);
  const machineLines = doc.splitTextToSize(
    analysis.machinesRequired.join(", "),
    contentWidth
  );
  doc.text(machineLines, margin, y);
  y += machineLines.length * 3.5 + 4;

  // ── Tolerances & Surface ──
  checkPage(20);
  y = sectionTitle(doc, tr("pdf", "toleranceAndSurface"), y, margin);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(50, 50, 60);
  const tolLines = doc.splitTextToSize(
    `${tr("pdf", "tolerances")}: ${analysis.tolerances}`,
    contentWidth
  );
  doc.text(tolLines, margin, y);
  y += tolLines.length * 3.5 + 2;

  const surfLines = doc.splitTextToSize(
    `${tr("pdf", "surfaceQuality")}: ${analysis.surfaceFinish}`,
    contentWidth
  );
  doc.text(surfLines, margin, y);
  y += surfLines.length * 3.5 + 4;

  // ── Recommendations ──
  checkPage(20);
  y = sectionTitle(doc, tr("pdf", "recommendations"), y, margin);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(50, 50, 60);

  analysis.recommendations.forEach((r) => {
    const lines = doc.splitTextToSize(`• ${r}`, contentWidth - 4);
    checkPage(lines.length * 3.5 + 3);
    doc.text(lines, margin + 2, y);
    y += lines.length * 3.5 + 2;
  });
  y += 4;

  // ── Difficulty Notes ──
  checkPage(15);
  y = sectionTitle(doc, tr("pdf", "difficultyNotes"), y, margin);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(50, 50, 60);
  const diffLines = doc.splitTextToSize(analysis.difficultyNotes, contentWidth);
  checkPage(diffLines.length * 3.5);
  doc.text(diffLines, margin, y);

  // ── Footer ──
  drawFooter(doc, tr("pdf", "footer"));

  // Save
  const fileName = `${analysis.partName.replace(/\s+/g, "_")}_analiz_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
};
