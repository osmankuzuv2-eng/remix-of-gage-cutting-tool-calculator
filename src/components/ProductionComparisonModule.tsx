import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, X, ArrowLeftRight, Settings2, FileCode2 } from "lucide-react";
import * as ExcelJS from "exceljs";
import { saveAs } from "file-saver";

interface MergedRow {
  parcaKodu: string;
  operator: string;
  isEmriNo: string;
  isEmriOpNo: string;
  makine: string;
  operasyonKodu: string;
  dorukSureDk: number | null;
  uaSureDk: number | null;
  sapmaDk: number | null;
  sapmaYuzde: number | null;
}

interface ColumnMapping {
  plan_isEmriNo: string;
  plan_parcaKodu: string;
  plan_uaSure: string;
  mes_isEmriNo: string;
  mes_operator: string;
  mes_isEmriOpNo: string;
  mes_makine: string;
  mes_operasyonKodu: string;
  mes_hizCevrim: string;
}

const NONE = "__none__";

const parseNum = (val: any): number | null => {
  if (val === null || val === undefined || val === "") return null;
  let s = String(val).trim();
  // Türkçe format: "3.135,60" → binlik nokta kaldır, virgülü noktaya çevir
  // Eğer hem nokta hem virgül varsa: nokta binlik, virgül ondalık
  if (s.includes(".") && s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    // Sadece virgül var: ondalık ayraç
    s = s.replace(",", ".");
  }
  // Sadece nokta varsa zaten geçerli float
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};

// ---- Excel reader ----
const getCellText = (cell: ExcelJS.Cell): string => {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  // Rich text
  if (typeof v === "object" && "richText" in (v as any)) {
    return (v as any).richText.map((rt: any) => rt.text ?? "").join("").trim();
  }
  // Formula: prefer result
  if (typeof v === "object" && "result" in (v as any)) {
    const res = (v as any).result;
    if (res === null || res === undefined) return "";
    return String(res).trim();
  }
  // Date object → skip (not numeric data we need)
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
};

const readExcel = async (file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> => {
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  const headers: string[] = [];
  const rows: Record<string, any>[] = [];
  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        headers.push(getCellText(cell));
      });
    } else {
      const obj: Record<string, any> = {};
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        const key = headers[colNum - 1];
        if (key) obj[key] = getCellText(cell);
      });
      rows.push(obj);
    }
  });
  return { headers: headers.filter(h => h !== ""), rows };
};

// ---- HTML table reader ----
const readHtmlTable = async (file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> => {
  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");

  // Find the table that has the most rows (data table)
  const tables = Array.from(doc.querySelectorAll("table"));
  if (tables.length === 0) throw new Error("HTML dosyasında tablo bulunamadı.");

  // Pick table with most rows
  const dataTable = tables.reduce((best, t) => t.rows.length > best.rows.length ? t : best, tables[0]);

  // Find header row: first row whose cells all have non-empty text
  let headerRowIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < dataTable.rows.length; i++) {
    const row = dataTable.rows[i];
    const cells = Array.from(row.cells);
    const texts = cells.map(c => c.textContent?.replace(/\u00a0/g, " ").trim() ?? "");
    const nonEmpty = texts.filter(t => t !== "");
    // Header row: multiple non-empty distinct cells, no numbers-only cells
    if (nonEmpty.length >= 3) {
      const allNonNumeric = nonEmpty.every(t => isNaN(parseFloat(t.replace(",", "."))));
      if (allNonNumeric) {
        headerRowIndex = i;
        headers = texts;
        break;
      }
    }
  }

  if (headerRowIndex === -1 || headers.length === 0) {
    throw new Error("Başlık satırı bulunamadı. Lütfen sütunları manuel eşleştirin.");
  }

  const rows: Record<string, any>[] = [];
  for (let i = headerRowIndex + 1; i < dataTable.rows.length; i++) {
    const row = dataTable.rows[i];
    const cells = Array.from(row.cells);
    const obj: Record<string, any> = {};
    let hasData = false;
    cells.forEach((cell, ci) => {
      const key = headers[ci];
      if (key) {
        const val = cell.textContent?.replace(/\u00a0/g, " ").trim() ?? "";
        obj[key] = val;
        if (val !== "") hasData = true;
      }
    });
    if (hasData) rows.push(obj);
  }

  return { headers: headers.filter(h => h !== ""), rows };
};

// ---- Auto-detect column ----
const autoDetect = (headers: string[], patterns: RegExp[]): string => {
  for (const pat of patterns) {
    const found = headers.find(h => pat.test(h.trim()));
    if (found) return found;
  }
  return NONE;
};

// ---- ColSelect ----
const ColSelect = ({ label, value, headers, onChange, required = false }: {
  label: string; value: string; headers: string[]; onChange: (v: string) => void; required?: boolean;
}) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">
      {label}{required && <span className="text-destructive ml-0.5">*</span>}
    </Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Sütun seçin..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>— Seçme —</SelectItem>
        {headers.map(h => (
          <SelectItem key={h} value={h}>{h}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

export default function ProductionComparisonModule() {
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [mesFile, setMesFile] = useState<File | null>(null);
  const [planHeaders, setPlanHeaders] = useState<string[]>([]);
  const [mesHeaders, setMesHeaders] = useState<string[]>([]);
  const [planRows, setPlanRows] = useState<Record<string, any>[]>([]);
  const [mesRows, setMesRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    plan_isEmriNo: NONE, plan_parcaKodu: NONE, plan_uaSure: NONE,
    mes_isEmriNo: NONE, mes_operator: NONE, mes_isEmriOpNo: NONE,
    mes_makine: NONE, mes_operasyonKodu: NONE, mes_hizCevrim: NONE,
  });
  const [mergedRows, setMergedRows] = useState<MergedRow[]>([]);
  const [processing, setProcessing] = useState(false);
  const [loadingFile, setLoadingFile] = useState<"plan" | "mes" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compared, setCompared] = useState(false);

  const loadFile = async (file: File, type: "plan" | "mes") => {
    setLoadingFile(type);
    setError(null);
    setCompared(false);
    setMergedRows([]);
    try {
      const isHtml = file.name.toLowerCase().endsWith(".html") || file.name.toLowerCase().endsWith(".htm");
      const { headers, rows } = isHtml ? await readHtmlTable(file) : await readExcel(file);

      if (type === "plan") {
        setPlanHeaders(headers);
        setPlanRows(rows);
        setMapping(prev => ({
          ...prev,
          plan_isEmriNo: autoDetect(headers, [/^iş emri no$/i, /^is emri no$/i, /workorder/i, /wo no/i]),
          plan_parcaKodu: autoDetect(headers, [/parça kodu/i, /parca kodu/i, /part no/i, /part code/i]),
          plan_uaSure: autoDetect(headers, [/üa süre/i, /ua sure/i, /üretim süresi/i, /süre.*dk/i]),
        }));
      } else {
        setMesHeaders(headers);
        setMesRows(rows);
        setMapping(prev => ({
          ...prev,
          mes_isEmriNo: autoDetect(headers, [/^iş emri no$/i, /^is emri no$/i, /workorder/i, /wo no/i]),
          mes_operator: autoDetect(headers, [/operatör/i, /operator/i]),
          mes_isEmriOpNo: autoDetect(headers, [/iş emri op no/i, /is emri op no/i, /^op no$/i, /operasyon no/i]),
          mes_makine: autoDetect(headers, [/makine/i, /machine/i, /ekipman/i]),
          mes_operasyonKodu: autoDetect(headers, [/operasyon kodu/i, /ops kodu/i, /op kodu/i, /operation code/i]),
          mes_hizCevrim: autoDetect(headers, [/hız çevrim/i, /hiz cevrim/i, /çevrim süresi/i, /cycle time/i, /hız/i, /hiz/i, /çevrim/i]),
        }));
      }
    } catch (err: any) {
      setError(`Dosya okunamadı: ${err.message}`);
    } finally {
      setLoadingFile(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: "plan" | "mes") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (type === "plan") setPlanFile(file);
    else setMesFile(file);
    await loadFile(file, type);
  };

  const handleDrop = useCallback(async (e: React.DragEvent, type: "plan" | "mes") => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (type === "plan") setPlanFile(file);
    else setMesFile(file);
    await loadFile(file, type);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setMap = (key: keyof ColumnMapping, val: string) =>
    setMapping(prev => ({ ...prev, [key]: val }));

  const canCompare = planFile && mesFile && mapping.plan_isEmriNo !== NONE && mapping.mes_isEmriNo !== NONE;

  // ---- Dashboard stats ----
  const stats = useMemo(() => {
    if (!mergedRows.length) return null;
    const withDeviation = mergedRows.filter(r => r.sapmaDk !== null && r.uaSureDk !== null);
    const positiveDeviation = withDeviation.filter(r => (r.sapmaDk ?? 0) > 0);
    const negativeDeviation = withDeviation.filter(r => (r.sapmaDk ?? 0) < 0);
    const totalLostMin = withDeviation.reduce((sum, r) => sum + (r.sapmaDk ?? 0), 0);
    const avgSapmaYuzde = withDeviation.length > 0
      ? withDeviation.reduce((sum, r) => sum + (r.sapmaYuzde ?? 0), 0) / withDeviation.length
      : 0;
    return {
      total: mergedRows.length,
      withDeviation: withDeviation.length,
      positiveDeviation: positiveDeviation.length,
      negativeDeviation: negativeDeviation.length,
      totalLostMin: parseFloat(totalLostMin.toFixed(1)),
      avgSapmaYuzde: parseFloat(avgSapmaYuzde.toFixed(1)),
    };
  }, [mergedRows]);

  const handleCompare = () => {
    setProcessing(true);
    setError(null);
    try {
      const planMap = new Map<string, Record<string, any>>();
      planRows.forEach(r => {
        const key = String(r[mapping.plan_isEmriNo] ?? "").trim();
        if (key) planMap.set(key, r);
      });

      const merged: MergedRow[] = mesRows
        .filter(r => String(r[mapping.mes_isEmriNo] ?? "").trim() !== "")
        .map(r => {
          const isEmriNo = String(r[mapping.mes_isEmriNo] ?? "").trim();
          const plan = planMap.get(isEmriNo);
          const hizSaniye = mapping.mes_hizCevrim !== NONE ? parseNum(r[mapping.mes_hizCevrim]) : null;
          const dorukSureDk = hizSaniye !== null ? parseFloat((hizSaniye / 60).toFixed(1)) : null;
          const uaSureDk = plan && mapping.plan_uaSure !== NONE ? parseNum(plan[mapping.plan_uaSure]) : null;
          return {
            parcaKodu: plan && mapping.plan_parcaKodu !== NONE ? String(plan[mapping.plan_parcaKodu] ?? "").trim() : "",
            operator: mapping.mes_operator !== NONE ? String(r[mapping.mes_operator] ?? "").trim() : "",
            isEmriNo,
            isEmriOpNo: mapping.mes_isEmriOpNo !== NONE ? String(r[mapping.mes_isEmriOpNo] ?? "").trim() : "",
            makine: mapping.mes_makine !== NONE ? String(r[mapping.mes_makine] ?? "").trim() : "",
            operasyonKodu: mapping.mes_operasyonKodu !== NONE ? String(r[mapping.mes_operasyonKodu] ?? "").trim() : "",
            dorukSureDk,
            uaSureDk,
            sapmaDk: dorukSureDk !== null && uaSureDk !== null ? parseFloat((dorukSureDk - uaSureDk).toFixed(1)) : null,
            sapmaYuzde: dorukSureDk !== null && uaSureDk !== null && uaSureDk !== 0 ? parseFloat((((dorukSureDk - uaSureDk) / uaSureDk) * 100).toFixed(1)) : null,
          };
        });

      setMergedRows(merged);
      setCompared(true);
    } catch (err: any) {
      setError(`Karşılaştırma hatası: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleExport = async () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const timeStr = now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    const fileName = `uretim_karsilastirma_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}.xlsx`;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Karşılaştırma");

    // Colors
    const HEADER_BG   = "FF1E40AF";
    const HEADER_FG   = "FFFFFFFF";
    const INFO_BG     = "FFE8EDF7";
    const INFO_FG     = "FF374151";
    const ROW_EVEN    = "FFF8FAFF";
    const ROW_ODD     = "FFEEF2FF";
    const BORDER_CLR  = "FFD1D5DB";
    const RED_BG      = "FFFEE2E2";
    const RED_FG      = "FFB91C1C";
    const GREEN_BG    = "FFDCFCE7";
    const GREEN_FG    = "FF15803D";
    const NEUTRAL_FG  = "FF374151";

    // Row 1: report info
    ws.mergeCells("A1:J1");
    const infoCell = ws.getCell("A1");
    infoCell.value = `Üretim Veri Karşılaştırma Raporu  |  Oluşturulma: ${dateStr} ${timeStr}  |  Toplam: ${mergedRows.length} satır`;
    infoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INFO_BG } };
    infoCell.font = { bold: true, color: { argb: INFO_FG }, size: 11 };
    infoCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 24;

    // Row 2: headers
    ws.columns = [
      { key: "parcaKodu",     width: 18 },
      { key: "operator",      width: 18 },
      { key: "isEmriNo",      width: 18 },
      { key: "isEmriOpNo",    width: 18 },
      { key: "makine",        width: 18 },
      { key: "operasyonKodu", width: 18 },
      { key: "dorukSureDk",   width: 18 },
      { key: "uaSureDk",      width: 18 },
      { key: "sapmaDk",       width: 16 },
      { key: "sapmaYuzde",    width: 14 },
    ];
    const colHeaders = ["Parça Kodu", "Operatör", "İş Emri No", "İş Emri Op No", "Makine", "Operasyon Kodu", "Doruk Süre (dk)", "ÜA Süre (dk)", "Sapma (dk)", "Sapma (%)"];
    const headerRow = ws.getRow(2);
    colHeaders.forEach((h, ci) => {
      const cell = headerRow.getCell(ci + 1);
      cell.value = h;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
      cell.font = { bold: true, color: { argb: HEADER_FG } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    });
    headerRow.height = 22;

    // Data rows starting at row 3
    mergedRows.forEach((row, i) => {
      const exRow = ws.getRow(i + 3);
      const rowFill = i % 2 === 0 ? ROW_EVEN : ROW_ODD;
      const bc = { style: "thin" as const, color: { argb: BORDER_CLR } };
      const values = [
        row.parcaKodu, row.operator, row.isEmriNo, row.isEmriOpNo,
        row.makine, row.operasyonKodu, row.dorukSureDk, row.uaSureDk,
        row.sapmaDk, row.sapmaYuzde != null ? `${row.sapmaYuzde > 0 ? "+" : ""}${row.sapmaYuzde}%` : null,
      ];
      values.forEach((val, ci) => {
        const cell = exRow.getCell(ci + 1);
        cell.value = val as any;
        cell.border = { top: bc, left: bc, bottom: bc, right: bc };
        cell.alignment = { horizontal: "center", vertical: "middle" };

        // Sapma renklendirmesi: sütun 9 (sapmaDk) ve 10 (sapmaYuzde)
        if (ci === 8 || ci === 9) {
          const sapma = row.sapmaDk;
          if (sapma !== null) {
            if (sapma > 0) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED_BG } };
              cell.font = { bold: true, color: { argb: RED_FG } };
            } else if (sapma < 0) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_BG } };
              cell.font = { bold: true, color: { argb: GREEN_FG } };
            } else {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowFill } };
              cell.font = { color: { argb: NEUTRAL_FG } };
            }
          } else {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowFill } };
          }
        } else {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowFill } };
        }
      });
    });

    // ---- Özet bölümü (Excel'de veri satırlarından sonra) ----
    if (stats) {
      const summaryStartRow = mergedRows.length + 5;
      const SUMMARY_BG  = "FFE8EDF7";
      const SUMMARY_FG  = "FF1E40AF";
      const WARN_BG     = "FFFEF3C7";
      const WARN_FG     = "FFB45309";

      ws.getRow(summaryStartRow - 1); // boş satır
      const titleCell = ws.getCell(`A${summaryStartRow}`);
      ws.mergeCells(`A${summaryStartRow}:J${summaryStartRow}`);
      titleCell.value = "── ÖZET / SONUÇLAR ──";
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUMMARY_BG } };
      titleCell.font = { bold: true, color: { argb: SUMMARY_FG }, size: 11 };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(summaryStartRow).height = 20;

      const summaryData = [
        ["Toplam Satır",               stats.total,                                    "adet"],
        ["Sapma Olan Satır",            stats.withDeviation,                            "adet"],
        ["Pozitif Sapma (Doruk > ÜA)", stats.positiveDeviation,                        "adet"],
        ["Negatif Sapma (Doruk < ÜA)", stats.negativeDeviation,                        "adet"],
        ["Ortalama Sapma Oranı",        `${stats.avgSapmaYuzde > 0 ? "+" : ""}${stats.avgSapmaYuzde}%`, ""],
        ["Toplam Kayıp/Kazanç (dk)",    `${stats.totalLostMin > 0 ? "+" : ""}${stats.totalLostMin}`, "dk"],
      ];

      summaryData.forEach(([label, value, unit], idx) => {
        const r = summaryStartRow + 1 + idx;
        const isWarn = (idx === 4 && stats.avgSapmaYuzde > 0) || (idx === 5 && stats.totalLostMin > 0);
        const bg   = isWarn ? WARN_BG  : SUMMARY_BG;
        const fg   = isWarn ? WARN_FG  : SUMMARY_FG;
        const bc   = { style: "thin" as const, color: { argb: "FFD1D5DB" } };

        const lCell = ws.getCell(`A${r}`);
        ws.mergeCells(`A${r}:G${r}`);
        lCell.value = String(label);
        lCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        lCell.font = { bold: true, color: { argb: fg } };
        lCell.alignment = { horizontal: "left", vertical: "middle", indent: 2 };
        lCell.border = { top: bc, left: bc, bottom: bc, right: bc };

        const vCell = ws.getCell(`H${r}`);
        ws.mergeCells(`H${r}:I${r}`);
        vCell.value = value;
        vCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        vCell.font = { bold: true, color: { argb: fg } };
        vCell.alignment = { horizontal: "center", vertical: "middle" };
        vCell.border = { top: bc, left: bc, bottom: bc, right: bc };

        const uCell = ws.getCell(`J${r}`);
        uCell.value = String(unit);
        uCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        uCell.font = { color: { argb: fg } };
        uCell.alignment = { horizontal: "center", vertical: "middle" };
        uCell.border = { top: bc, left: bc, bottom: bc, right: bc };

        ws.getRow(r).height = 18;
      });
    }

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), fileName);
  };

  const FileDropZone = ({ type, file, label, acceptHtml }: {
    type: "plan" | "mes"; file: File | null; label: string; acceptHtml?: boolean;
  }) => {
    const isHtml = file?.name.toLowerCase().endsWith(".html") || file?.name.toLowerCase().endsWith(".htm");
    return (
      <div
        onDrop={e => handleDrop(e, type)}
        onDragOver={e => e.preventDefault()}
        className={`relative border-2 border-dashed rounded-xl p-5 transition-all duration-200 text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 ${file ? "border-primary/40 bg-primary/5" : "border-border"}`}
        onClick={() => document.getElementById(`file-${type}`)?.click()}
      >
        <input
          id={`file-${type}`}
          type="file"
          accept={acceptHtml ? ".xlsx,.xls,.html,.htm" : ".xlsx,.xls"}
          className="hidden"
          onChange={e => handleFileChange(e, type)}
        />
        {loadingFile === type ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground">Okunuyor...</span>
          </div>
        ) : file ? (
          <div className="flex flex-col items-center gap-1.5">
            {isHtml
              ? <FileCode2 className="w-9 h-9 text-emerald-500" />
              : <CheckCircle2 className="w-9 h-9 text-primary" />
            }
            <span className="text-sm font-semibold text-foreground">{file.name}</span>
            <Badge variant="secondary">{(file.size / 1024).toFixed(1)} KB</Badge>
            {isHtml && <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-xs">HTML Raporu</Badge>}
            <Button size="sm" variant="ghost" className="absolute top-2 right-2 h-7 w-7 p-0"
              onClick={e => {
                e.stopPropagation();
                if (type === "plan") { setPlanFile(null); setPlanHeaders([]); setPlanRows([]); }
                else { setMesFile(null); setMesHeaders([]); setMesRows([]); }
                setCompared(false); setMergedRows([]);
              }}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {acceptHtml
              ? <FileCode2 className="w-9 h-9 text-muted-foreground/40" />
              : <FileSpreadsheet className="w-9 h-9 text-muted-foreground/40" />
            }
            <span className="text-sm font-semibold text-foreground">{label}</span>
            <span className="text-xs text-muted-foreground">
              {acceptHtml ? ".xlsx, .xls veya .html" : ".xlsx veya .xls"} yükleyin
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ArrowLeftRight className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Üretim Veri Karşılaştırma</h2>
          <p className="text-sm text-muted-foreground">Üretim planı (Excel) ve MES raporu (Excel veya HTML) eşleştirin</p>
        </div>
      </div>

      {/* Upload */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 hover:bg-blue-500/10">1. Dosya</Badge>
              Üretim Planı <span className="text-xs font-normal text-muted-foreground">(Excel)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <FileDropZone type="plan" file={planFile} label="Üretim Planı (Excel)" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/10">2. Dosya</Badge>
              MES Raporu <span className="text-xs font-normal text-muted-foreground">(Excel veya HTML)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <FileDropZone type="mes" file={mesFile} label="MES Raporu (Excel / HTML)" acceptHtml />
          </CardContent>
        </Card>
      </div>

      {/* Column Mapping */}
      {(planHeaders.length > 0 || mesHeaders.length > 0) && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-primary" />
              Sütun Eşleştirme
              <span className="text-xs text-muted-foreground font-normal ml-1">— hangi sütunun ne anlama geldiğini seçin</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            {planHeaders.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-blue-600 mb-2">📋 1. Dosya — Üretim Planı Sütunları ({planRows.length} satır okundu)</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <ColSelect label="İş Emri No" value={mapping.plan_isEmriNo} headers={planHeaders} onChange={v => setMap("plan_isEmriNo", v)} required />
                  <ColSelect label="Parça Kodu" value={mapping.plan_parcaKodu} headers={planHeaders} onChange={v => setMap("plan_parcaKodu", v)} />
                  <ColSelect label="ÜA Süre (dk)" value={mapping.plan_uaSure} headers={planHeaders} onChange={v => setMap("plan_uaSure", v)} />
                </div>
              </div>
            )}
            {mesHeaders.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-600 mb-2">🏭 2. Dosya — MES Raporu Sütunları ({mesRows.length} satır okundu)</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <ColSelect label="İş Emri No" value={mapping.mes_isEmriNo} headers={mesHeaders} onChange={v => setMap("mes_isEmriNo", v)} required />
                  <ColSelect label="Operatör" value={mapping.mes_operator} headers={mesHeaders} onChange={v => setMap("mes_operator", v)} />
                  <ColSelect label="İş Emri Op No" value={mapping.mes_isEmriOpNo} headers={mesHeaders} onChange={v => setMap("mes_isEmriOpNo", v)} />
                  <ColSelect label="Makine" value={mapping.mes_makine} headers={mesHeaders} onChange={v => setMap("mes_makine", v)} />
                  <ColSelect label="Operasyon Kodu" value={mapping.mes_operasyonKodu} headers={mesHeaders} onChange={v => setMap("mes_operasyonKodu", v)} />
                  <ColSelect label="Hız Çevrim (saniye → dk)" value={mapping.mes_hizCevrim} headers={mesHeaders} onChange={v => setMap("mes_hizCevrim", v)} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={handleCompare} disabled={!canCompare || processing} className="gap-2">
          <ArrowLeftRight className="w-4 h-4" />
          {processing ? "İşleniyor..." : "Karşılaştır"}
        </Button>
        {compared && mergedRows.length > 0 && (
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Excel İndir
          </Button>
        )}
        {compared && (
          <Badge variant="secondary" className="ml-auto">{mergedRows.length} satır eşleştirildi</Badge>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* Dashboard Stats */}
      {compared && stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card className="border-border">
            <CardContent className="p-4 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Toplam Satır</span>
              <span className="text-2xl font-bold text-foreground">{stats.total}</span>
              <span className="text-xs text-muted-foreground">{stats.withDeviation} satırda sapma var</span>
            </CardContent>
          </Card>
          <Card className={`border-border ${stats.avgSapmaYuzde > 0 ? "bg-destructive/5 border-destructive/20" : stats.avgSapmaYuzde < 0 ? "bg-emerald-500/5 border-emerald-500/20" : ""}`}>
            <CardContent className="p-4 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Ortalama Sapma</span>
              <span className={`text-2xl font-bold ${stats.avgSapmaYuzde > 0 ? "text-destructive" : stats.avgSapmaYuzde < 0 ? "text-emerald-600" : "text-foreground"}`}>
                {stats.avgSapmaYuzde > 0 ? "+" : ""}{stats.avgSapmaYuzde}%
              </span>
              <span className="text-xs text-muted-foreground">
                {stats.positiveDeviation} pozitif · {stats.negativeDeviation} negatif
              </span>
            </CardContent>
          </Card>
          <Card className={`border-border col-span-2 md:col-span-1 ${stats.totalLostMin > 0 ? "bg-destructive/5 border-destructive/20" : stats.totalLostMin < 0 ? "bg-emerald-500/5 border-emerald-500/20" : ""}`}>
            <CardContent className="p-4 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Toplam Kayıp / Kazanç</span>
              <span className={`text-2xl font-bold ${stats.totalLostMin > 0 ? "text-destructive" : stats.totalLostMin < 0 ? "text-emerald-600" : "text-foreground"}`}>
                {stats.totalLostMin > 0 ? "+" : ""}{stats.totalLostMin} dk
              </span>
              <span className="text-xs text-muted-foreground">
                {stats.totalLostMin > 0 ? "Gerçek süre plandan uzun" : stats.totalLostMin < 0 ? "Gerçek süre plandan kısa" : "Plan ile uyumlu"}
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Preview Table */}
      {compared && mergedRows.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Önizleme (ilk 50 satır)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-primary/10 border-b border-border">
                    {["Parça Kodu", "Operatör", "İş Emri No", "İş Emri Op No", "Makine", "Operasyon Kodu", "Doruk Süre (dk)", "ÜA Süre (dk)", "Sapma (dk)", "Sapma (%)"].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mergedRows.slice(0, 50).map((row, i) => (
                    <tr key={i} className={`border-b border-border/50 ${i % 2 === 0 ? "bg-background" : "bg-muted/30"}`}>
                      <td className="px-3 py-1.5">{row.parcaKodu || "-"}</td>
                      <td className="px-3 py-1.5">{row.operator || "-"}</td>
                      <td className="px-3 py-1.5 font-mono">{row.isEmriNo || "-"}</td>
                      <td className="px-3 py-1.5">{row.isEmriOpNo || "-"}</td>
                      <td className="px-3 py-1.5">{row.makine || "-"}</td>
                      <td className="px-3 py-1.5">{row.operasyonKodu || "-"}</td>
                      <td className="px-3 py-1.5 text-primary font-semibold">{row.dorukSureDk ?? "-"}</td>
                      <td className="px-3 py-1.5">{row.uaSureDk ?? "-"}</td>
                      <td className={`px-3 py-1.5 font-semibold ${row.sapmaDk === null ? "" : row.sapmaDk > 0 ? "text-destructive" : "text-emerald-600"}`}>
                        {row.sapmaDk !== null ? (row.sapmaDk > 0 ? `+${row.sapmaDk}` : row.sapmaDk) : "-"}
                      </td>
                      <td className={`px-3 py-1.5 font-semibold ${row.sapmaYuzde === null ? "" : row.sapmaYuzde > 0 ? "text-destructive" : "text-emerald-600"}`}>
                        {row.sapmaYuzde !== null ? (row.sapmaYuzde > 0 ? `+${row.sapmaYuzde}%` : `${row.sapmaYuzde}%`) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
