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

export const exportCostPdf = (data: CostPdfData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 14;

  // ── Title ──
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(safeText("Maliyet Hesaplama Raporu"), pageWidth / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toLocaleDateString("tr-TR") + " " + new Date().toLocaleTimeString("tr-TR"), pageWidth / 2, y, { align: "center" });
  y += 7;

  // ── Reference & Customer info bar ──
  doc.setDrawColor(100);
  doc.setFillColor(245, 245, 250);
  doc.roundedRect(margin, y, contentWidth, 14, 2, 2, "FD");
  const boxMid = y + 9;
  const infoCols = [
    { label: "Referans No", value: data.referenceNo || "-" },
    { label: safeText("Musteri"), value: data.customer || "-" },
    { label: "Malzeme", value: data.material },
    { label: safeText("Iscilik (EUR/dk)"), value: `${data.laborRate}` },
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
  sectionTitle("Tezgah Bilgileri");
  doc.setFillColor(50, 50, 70);
  doc.setTextColor(255);
  doc.rect(margin, y, contentWidth, ROW_H, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("Tip", margin + 2, y + 4);
  doc.text(safeText("Tezgah"), margin + 30, y + 4);
  doc.text("EUR/dk", margin + contentWidth - 3, y + 4, { align: "right" });
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

  // ── Production Info & Additional Costs side by side ──
  const halfW = (contentWidth - 4) / 2;

  // Left: Production
  const prodY = y;
  sectionTitle("Uretim Bilgileri");
  const prodRows = [
    [safeText("Setup Suresi"), `${data.setupTime} dk`],
    [safeText("Isleme Suresi (parca basi)"), `${data.machiningTime} dk`],
    [safeText("Siparis Adeti"), `${data.orderQuantity}`],
    [safeText("Toplam Isleme"), `${data.calculations.totalMachiningHours} saat`],
    [safeText("Yogunluk"), `${data.density} g/cm3`],
    [safeText("Parca Agirligi"), `${data.weightKg} kg`],
    [`Malzeme Fiyati`, `${data.materialPricePerKg} EUR/kg`],
  ];
  prodRows.forEach((row, idx) => tableRow(row[0], row[1], idx));
  y += 4;

  // ── Additional Costs ──
  sectionTitle("Ek Giderler");
  const addCosts = [
    [safeText("Takim"), `${data.toolCost.toFixed(2)} EUR`],
    ["Nakliye", `${data.shippingCost.toFixed(2)} EUR`],
    ["Kaplama", `${data.coatingCost.toFixed(2)} EUR`],
    [safeText("Isil Islem"), `${data.heatTreatmentCost.toFixed(2)} EUR`],
  ];
  addCosts.forEach((row, idx) => tableRow(row[0], row[1], idx));
  y += 6;

  // ── Cost Summary ──
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(safeText("Maliyet Ozeti"), margin, y);
  y += 5;

  const summaryRows = [
    [safeText("Malzeme Maliyeti"), `${data.calculations.totalMaterialCost} EUR`],
    [safeText("Iscilik Maliyeti"), `${data.calculations.laborCost} EUR`],
    [safeText("Tezgah Maliyeti"), `${data.calculations.machineCost} EUR`],
    [safeText("Ek Giderler Toplami"), `${data.calculations.additionalCosts} EUR`],
    [`Fire Maliyeti (%${data.scrapRate})`, `${data.calculations.scrapCost} EUR`],
    [`Kar (%${data.profitMargin})`, `${data.calculations.profit} EUR`],
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
  doc.text("Genel Toplam", margin + 4, y + 6);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`${data.calculations.grandTotal} EUR`, margin + contentWidth - 4, y + 10, { align: "right" });
  y += 17;

  // Per part
  doc.setTextColor(0);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`${safeText("Parca Basi Maliyet")}: ${data.calculations.costPerPart} EUR  (${data.orderQuantity} adet)`, margin, y);

  // ── Footer ──
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(180);
  doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
  doc.setFontSize(6);
  doc.text("GAGE Confidence Toolroom - Maliyet Raporu", margin, pageHeight - 6);
  doc.text(`Sayfa 1/1`, pageWidth - margin, pageHeight - 6, { align: "right" });

  const refSlug = data.referenceNo ? safeText(data.referenceNo).replace(/\s+/g, "_") : "maliyet";
  doc.save(`${refSlug}_maliyet_${new Date().toISOString().slice(0, 10)}.pdf`);
};
