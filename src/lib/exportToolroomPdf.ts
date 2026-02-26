import jsPDF from "jspdf";
import { registerFonts, drawHeader, drawFooter, drawInfoBox, drawTableHeader, drawTableRow, sectionTitle, BRAND } from "./pdfHelpers";

export interface ToolroomPurchase {
  id: string;
  factory: string;
  year: number;
  month: number;
  supplier: string;
  tool_type: string;
  tool_code: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  notes: string | null;
}

const MONTHS = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

export const exportToolroomPdf = async (
  items: ToolroomPurchase[],
  filterFactory: string,
  filterYear: number,
  filterMonth: number | null
) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  await registerFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const periodLabel = filterMonth ? `${MONTHS[filterMonth - 1]} ${filterYear}` : `${filterYear} - Tüm Aylar`;
  const factoryLabel = filterFactory === "all" ? "Tüm Fabrikalar" : filterFactory;
  const title = `Aylık Takımhane Raporu — ${factoryLabel} / ${periodLabel}`;

  let y = await drawHeader(doc, title);

  // Summary info box
  const totalAmount = items.reduce((s, i) => s + Number(i.total_amount), 0);
  const totalQty = items.reduce((s, i) => s + Number(i.quantity), 0);
  const suppliers = [...new Set(items.map(i => i.supplier))].length;
  y = drawInfoBox(doc, y, margin, contentWidth, [
    { label: "Toplam Kayıt", value: `${items.length}` },
    { label: "Toplam Miktar", value: `${totalQty.toFixed(0)} adet` },
    { label: "Tedarikçi", value: `${suppliers}` },
    { label: "Toplam Tutar", value: `€ ${totalAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}` },
  ]);

  y += 2;

  // Group by factory for section titles
  const factories = filterFactory === "all"
    ? [...new Set(items.map(i => i.factory))]
    : [filterFactory];

  for (const factory of factories) {
    const rows = items.filter(i => i.factory === factory);
    if (rows.length === 0) continue;

    if (factories.length > 1) {
      y = sectionTitle(doc, factory, y, margin);
    }

    const headers = ["Ay", "Tedarikçi", "Takım Tipi", "Takım Kodu", "Miktar", "Birim Fiyat (€)", "Toplam (€)", "Not"];
    const cols = [18, 40, 38, 28, 16, 28, 28, 54];
    y = drawTableHeader(doc, y, margin, contentWidth, headers, cols);

    rows.forEach((row, idx) => {
      if (y > 185) {
        doc.addPage();
        y = 14;
        y = drawTableHeader(doc, y, margin, contentWidth, headers, cols);
      }
      y = drawTableRow(doc, y, margin, contentWidth, [
        MONTHS[(row.month ?? 1) - 1],
        row.supplier,
        row.tool_type,
        row.tool_code || "-",
        String(row.quantity),
        `€ ${Number(row.unit_price).toFixed(2)}`,
        `€ ${Number(row.total_amount).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`,
        row.notes || "-",
      ], cols, idx % 2 === 0);
    });

    // Factory subtotal
    const factoryTotal = rows.reduce((s, r) => s + Number(r.total_amount), 0);
    doc.setFillColor(...BRAND.dark);
    doc.rect(margin, y, contentWidth, 7, "F");
    doc.setFontSize(7);
    doc.setFont("Aptos", "bold");
    doc.setTextColor(...BRAND.white);
    doc.text(`${factory} Toplam: € ${factoryTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`, margin + 2, y + 5);
    y += 10;
  }

  drawFooter(doc, `Aylık Takımhane Raporu — ${factoryLabel} / ${periodLabel}`, "Sayfa");
  doc.save(`takimhane-raporu-${filterYear}${filterMonth ? `-${filterMonth}` : ""}.pdf`);
};
