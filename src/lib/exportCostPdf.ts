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
    additionalCosts: string;
    scrapCost: string;
    profit: string;
    grandTotal: string;
    costPerPart: string;
  };
}

export const exportCostPdf = (data: CostPdfData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(safeText("Maliyet Hesaplama Raporu"), pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toLocaleDateString("tr-TR") + " " + new Date().toLocaleTimeString("tr-TR"), pageWidth / 2, y, { align: "center" });
  y += 12;

  // Reference & Customer box
  doc.setDrawColor(100);
  doc.setFillColor(245, 245, 250);
  doc.roundedRect(margin, y, contentWidth, 22, 3, 3, "FD");
  const boxTop = y + 7;
  const infoCols = [
    { label: "Referans No", value: data.referenceNo || "-" },
    { label: safeText("Musteri"), value: data.customer || "-" },
    { label: "Malzeme", value: data.material },
    { label: safeText("Iscilik (TL/saat)"), value: `${data.laborRate}` },
  ];
  const colW = contentWidth / 4;
  infoCols.forEach((c, i) => {
    const x = margin + colW * i + colW / 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(safeText(c.label), x, boxTop, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const val = safeText(c.value);
    const valTrunc = val.length > 22 ? val.substring(0, 20) + ".." : val;
    doc.text(valTrunc, x, boxTop + 10, { align: "center" });
  });
  y += 28;

  // Machines section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(safeText("Tezgah Bilgileri"), margin, y);
  y += 7;

  // Machine table header
  doc.setFillColor(50, 50, 70);
  doc.setTextColor(255);
  doc.rect(margin, y, contentWidth, 7, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Tip", margin + 3, y + 5);
  doc.text(safeText("Tezgah"), margin + 35, y + 5);
  doc.text(safeText("dk Fiyat (TL)"), margin + contentWidth - 40, y + 5);
  y += 7;
  doc.setTextColor(0);

  data.machines.forEach((m, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(248, 248, 252);
      doc.rect(margin, y, contentWidth, 7, "F");
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(safeText(m.label), margin + 3, y + 5);
    doc.text(safeText(m.name), margin + 35, y + 5);
    doc.text(`${m.rate.toFixed(2)}`, margin + contentWidth - 40, y + 5);
    y += 7;
  });
  y += 8;

  // Production info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(safeText("Uretim Bilgileri"), margin, y);
  y += 7;

  const prodRows = [
    [safeText("Setup Suresi"), `${data.setupTime} dk`],
    [safeText("Isleme Suresi (parca basi)"), `${data.machiningTime} dk`],
    [safeText("Siparis Adeti"), `${data.orderQuantity}`],
    [safeText("Toplam Isleme Suresi"), `${data.calculations.totalMachiningHours} saat`],
  ];

  prodRows.forEach((row, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(248, 248, 252);
      doc.rect(margin, y, contentWidth, 7, "F");
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(row[0], margin + 3, y + 5);
    doc.setFont("helvetica", "bold");
    doc.text(row[1], margin + contentWidth - 5, y + 5, { align: "right" });
    y += 7;
  });
  y += 8;

  // Additional costs
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(safeText("Ek Giderler"), margin, y);
  y += 7;

  const addCosts = [
    [safeText("Takim"), `${data.toolCost.toFixed(2)} TL`],
    ["Nakliye", `${data.shippingCost.toFixed(2)} TL`],
    ["Kaplama", `${data.coatingCost.toFixed(2)} TL`],
    [safeText("Isil Islem"), `${data.heatTreatmentCost.toFixed(2)} TL`],
  ];

  addCosts.forEach((row, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(248, 248, 252);
      doc.rect(margin, y, contentWidth, 7, "F");
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(row[0], margin + 3, y + 5);
    doc.setFont("helvetica", "bold");
    doc.text(row[1], margin + contentWidth - 5, y + 5, { align: "right" });
    y += 7;
  });
  y += 10;

  // Cost summary
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(safeText("Maliyet Ozeti"), margin, y);
  y += 8;

  const summaryRows = [
    [safeText("Iscilik Maliyeti"), `${data.calculations.laborCost} TL`],
    [safeText("Tezgah Maliyeti"), `${data.calculations.machineCost} TL`],
    [safeText("Ek Giderler Toplami"), `${data.calculations.additionalCosts} TL`],
    [`Fire Maliyeti (%${data.scrapRate})`, `${data.calculations.scrapCost} TL`],
    [`Kar (%${data.profitMargin})`, `${data.calculations.profit} TL`],
  ];

  summaryRows.forEach((row, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(248, 248, 252);
      doc.rect(margin, y, contentWidth, 8, "F");
    }
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(row[0], margin + 3, y + 6);
    doc.setFont("helvetica", "bold");
    doc.text(row[1], margin + contentWidth - 5, y + 6, { align: "right" });
    y += 8;
  });
  y += 4;

  // Grand total box
  doc.setFillColor(30, 80, 160);
  doc.setTextColor(255);
  doc.roundedRect(margin, y, contentWidth, 18, 3, 3, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Genel Toplam", margin + 5, y + 8);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`${data.calculations.grandTotal} TL`, margin + contentWidth - 5, y + 13, { align: "right" });
  y += 22;

  // Per part
  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${safeText("Parca Basi Maliyet")}: ${data.calculations.costPerPart} TL  (${data.orderQuantity} adet)`, margin, y);
  y += 10;

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(180);
  doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
  doc.setFontSize(7);
  doc.text("GAGE Confidence Toolroom - Maliyet Raporu", margin, pageHeight - 8);
  doc.text(`Sayfa 1/${doc.getNumberOfPages()}`, pageWidth - margin, pageHeight - 8, { align: "right" });

  const refSlug = data.referenceNo ? safeText(data.referenceNo).replace(/\s+/g, "_") : "maliyet";
  doc.save(`${refSlug}_maliyet_${new Date().toISOString().slice(0, 10)}.pdf`);
};
