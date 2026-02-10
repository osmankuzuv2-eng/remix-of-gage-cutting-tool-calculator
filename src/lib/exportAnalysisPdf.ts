import jsPDF from "jspdf";

interface Operation {
  step: number;
  operation: string;
  machine: string;
  tool: string;
  cuttingSpeed: string;
  feedRate: string;
  depthOfCut: string;
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
  recommendations: string[];
  tolerances: string;
  surfaceFinish: string;
  machinesRequired: string[];
  difficultyNotes: string;
}

// Turkish character safe text helper
const safeText = (text: string) => {
  if (!text) return "";
  return text
    .replace(/İ/g, "I").replace(/ı/g, "i")
    .replace(/Ğ/g, "G").replace(/ğ/g, "g")
    .replace(/Ü/g, "U").replace(/ü/g, "u")
    .replace(/Ş/g, "S").replace(/ş/g, "s")
    .replace(/Ö/g, "O").replace(/ö/g, "o")
    .replace(/Ç/g, "C").replace(/ç/g, "c");
};

export const exportAnalysisPdf = (analysis: AnalysisResult) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  const checkPage = (needed: number) => {
    if (y + needed > 280) {
      doc.addPage();
      y = 20;
    }
  };

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(safeText("Teknik Resim Analiz Raporu"), pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toLocaleDateString("tr-TR") + " " + new Date().toLocaleTimeString("tr-TR"), pageWidth / 2, y, { align: "center" });
  y += 12;

  // Summary box
  doc.setDrawColor(100);
  doc.setFillColor(245, 245, 250);
  doc.roundedRect(margin, y, contentWidth, 28, 3, 3, "FD");
  y += 7;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const cols = [
    { label: safeText("Parca"), value: safeText(analysis.partName) },
    { label: "Malzeme", value: safeText(analysis.material) },
    { label: safeText("Karmasiklik"), value: safeText(analysis.complexity) },
    { label: safeText("Toplam Sure"), value: `${analysis.totalEstimatedTime} dk` },
  ];
  const colW = contentWidth / 4;
  cols.forEach((c, i) => {
    const x = margin + colW * i + colW / 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(c.label, x, y, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(c.value, x, y + 10, { align: "center" });
  });
  y += 26;

  // Dimensions
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`${safeText("Genel Boyutlar")}: ${safeText(analysis.overallDimensions)}    |    ${safeText("Hazirlik Suresi")}: ${analysis.setupTime} dk`, margin, y);
  y += 10;

  // Operations table
  checkPage(40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(safeText("Islem Adimlari"), margin, y);
  y += 6;

  // Table header
  const colWidths = [10, 35, 28, 30, 20, 22, 18, 17];
  const headers = ["#", safeText("Islem"), safeText("Tezgah"), safeText("Takim"), "Vc", "f", "ap", safeText("Sure")];
  
  doc.setFillColor(50, 50, 70);
  doc.setTextColor(255);
  doc.rect(margin, y, contentWidth, 7, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  let tx = margin + 2;
  headers.forEach((h, i) => {
    doc.text(h, tx, y + 5);
    tx += colWidths[i];
  });
  y += 7;
  doc.setTextColor(0);

  // Table rows
  analysis.operations.forEach((op, idx) => {
    checkPage(10);
    if (idx % 2 === 0) {
      doc.setFillColor(248, 248, 252);
      doc.rect(margin, y, contentWidth, 8, "F");
    }
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    tx = margin + 2;
    const row = [
      String(op.step),
      safeText(op.operation),
      safeText(op.machine),
      safeText(op.tool),
      String(op.cuttingSpeed),
      String(op.feedRate),
      String(op.depthOfCut),
      `${op.estimatedTime} dk`,
    ];
    row.forEach((cell, i) => {
      const truncated = cell.length > (colWidths[i] / 2) ? cell.substring(0, Math.floor(colWidths[i] / 2)) + ".." : cell;
      doc.text(truncated, tx, y + 5.5);
      tx += colWidths[i];
    });
    y += 8;
  });
  y += 8;

  // Machines & Tolerances side by side
  checkPage(35);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(safeText("Gereken Tezgahlar"), margin, y);
  doc.text(safeText("Tolerans & Yuzey"), margin + contentWidth / 2, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const machineText = analysis.machinesRequired.map(m => safeText(m)).join(", ");
  doc.text(doc.splitTextToSize(machineText, contentWidth / 2 - 5), margin, y);

  doc.text(doc.splitTextToSize(`Toleranslar: ${safeText(analysis.tolerances)}`, contentWidth / 2 - 5), margin + contentWidth / 2, y);
  y += 8;
  doc.text(doc.splitTextToSize(`${safeText("Yuzey Kalitesi")}: ${safeText(analysis.surfaceFinish)}`, contentWidth / 2 - 5), margin + contentWidth / 2, y);
  y += 14;

  // Recommendations
  checkPage(25);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(safeText("Oneriler"), margin, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  analysis.recommendations.forEach((r) => {
    checkPage(8);
    doc.text(`• ${safeText(r)}`, margin + 2, y);
    y += 5;
  });
  y += 6;

  // Difficulty
  checkPage(20);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(safeText("Zorluk Notlari"), margin, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const diffLines = doc.splitTextToSize(safeText(analysis.difficultyNotes), contentWidth);
  doc.text(diffLines, margin, y);

  // Save
  const fileName = `${safeText(analysis.partName).replace(/\s+/g, "_")}_analiz_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
};
