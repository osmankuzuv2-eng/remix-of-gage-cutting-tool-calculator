import jsPDF from "jspdf";
import { registerFonts, drawHeader, drawFooter, drawTableHeader, drawTableRow, BRAND } from "./pdfHelpers";

export interface MaintenanceExportRecord {
  title: string;
  machine_name: string;
  factory: string;
  maintenance_type: string;
  status: string;
  priority: string;
  technician_name: string | null;
  cost: number;
  duration_minutes: number;
  scheduled_date: string | null;
  completed_date: string | null;
  notes: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  planned_maintenance: "Planlı Bakım",
  unplanned_failure: "Plansız Arıza",
  revision: "Revizyon",
  service: "Servis",
};
const STATUS_LABELS: Record<string, string> = {
  planned: "Planlandı",
  in_progress: "Devam Ediyor",
  completed: "Tamamlandı",
  cancelled: "İptal",
};
const PRIORITY_LABELS: Record<string, string> = {
  low: "Düşük",
  normal: "Normal",
  high: "Yüksek",
  critical: "Kritik",
};

export const exportMaintenancePdf = async (
  records: MaintenanceExportRecord[],
  factoryLabel: string,
) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  await registerFonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;

  let y = await drawHeader(doc, `Bakım Onarım Kayıtları${factoryLabel ? ` — ${factoryLabel}` : ""}`);
  y += 4;

  // Summary info row
  const totalCost = records.reduce((s, r) => s + (r.cost || 0), 0);
  const completed = records.filter(r => r.status === "completed").length;
  doc.setFont("Aptos", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text(`Toplam Kayıt: ${records.length}   |   Tamamlanan: ${completed}   |   Toplam Maliyet: ₺${totalCost.toLocaleString("tr-TR")}`, margin, y);
  y += 8;

  const headers = ["Başlık", "Makine", "Bakım Türü", "Durum", "Öncelik", "Teknisyen", "Maliyet (₺)", "Süre (dk)", "Tarih", "Notlar"];
  const colW =    [46,       30,       28,           22,      18,        26,           20,            16,          20,      40];

  y = drawTableHeader(doc, y, margin, contentW, headers, colW);

  records.forEach((r, idx) => {
    if (y > pageH - 18) {
      doc.addPage();
      y = 20;
    }
    const row = [
      r.title,
      r.machine_name,
      TYPE_LABELS[r.maintenance_type] || r.maintenance_type,
      STATUS_LABELS[r.status] || r.status,
      PRIORITY_LABELS[r.priority] || r.priority,
      r.technician_name || "—",
      r.cost > 0 ? `₺${r.cost.toLocaleString("tr-TR")}` : "—",
      r.duration_minutes > 0 ? `${r.duration_minutes} dk` : "—",
      r.scheduled_date
        ? new Date(r.scheduled_date).toLocaleDateString("tr-TR")
        : r.completed_date
        ? new Date(r.completed_date).toLocaleDateString("tr-TR")
        : "—",
      r.notes || "—",
    ];
    y = drawTableRow(doc, y, margin, contentW, row, colW, idx % 2 === 0);
  });

  drawFooter(doc, `GAGE Confidence ToolSense — Bakım Onarım`, "Sayfa");

  doc.save(`bakim-kayitlari${factoryLabel ? `-${factoryLabel.replace(/\s/g, "-")}` : ""}-${new Date().toISOString().split("T")[0]}.pdf`);
};
