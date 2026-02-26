import ExcelJS from "exceljs";

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

export const exportMaintenanceExcel = async (
  records: MaintenanceExportRecord[],
  factoryLabel: string,
) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GAGE";
  wb.created = new Date();

  const ws = wb.addWorksheet(`Bakım Kayıtları${factoryLabel ? ` - ${factoryLabel}` : ""}`);

  const headers = [
    "Başlık",
    "Makine",
    "Fabrika",
    "Bakım Türü",
    "Durum",
    "Öncelik",
    "Teknisyen",
    "Maliyet (₺)",
    "Süre (dk)",
    "Planlı Tarih",
    "Tamamlanma",
    "Notlar",
    "Kayıt Tarihi",
  ];

  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  headerRow.height = 22;

  const colWidths = [32, 22, 18, 22, 18, 14, 20, 14, 12, 16, 16, 30, 16];
  ws.columns = headers.map((_, i) => ({ width: colWidths[i] }));

  records.forEach((r, idx) => {
    const row = ws.addRow([
      r.title,
      r.machine_name,
      r.factory || "—",
      TYPE_LABELS[r.maintenance_type] || r.maintenance_type,
      STATUS_LABELS[r.status] || r.status,
      PRIORITY_LABELS[r.priority] || r.priority,
      r.technician_name || "—",
      r.cost > 0 ? r.cost : 0,
      r.duration_minutes > 0 ? r.duration_minutes : 0,
      r.scheduled_date ? new Date(r.scheduled_date).toLocaleDateString("tr-TR") : "—",
      r.completed_date ? new Date(r.completed_date).toLocaleDateString("tr-TR") : "—",
      r.notes || "—",
      new Date(r.created_at).toLocaleDateString("tr-TR"),
    ]);

    row.alignment = { vertical: "middle", wrapText: false };
    row.height = 18;

    if (idx % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    }

    const costCell = row.getCell(8);
    costCell.numFmt = '#,##0 "₺"';
    costCell.alignment = { horizontal: "right" };
    row.getCell(9).alignment = { horizontal: "center" };
  });

  ws.addRow([]);
  const sumRow = ws.addRow([
    "TOPLAM",
    "", "", "", "", "",
    `${records.length} kayıt`,
    { formula: `SUM(H2:H${records.length + 1})` },
    { formula: `SUM(I2:I${records.length + 1})` },
    "", "", "", "",
  ]);
  sumRow.font = { bold: true };
  sumRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  const sumCost = sumRow.getCell(8);
  sumCost.numFmt = '#,##0 "₺"';

  ws.eachRow((row, rowNum) => {
    if (rowNum > 0) {
      row.eachCell(cell => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });
    }
  });

  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bakim-kayitlari${factoryLabel ? `-${factoryLabel.replace(/\s/g, "-")}` : ""}-${new Date().toISOString().split("T")[0]}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};
