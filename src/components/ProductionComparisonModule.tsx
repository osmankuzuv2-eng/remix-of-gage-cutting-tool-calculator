import { useState, useCallback } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, X, ArrowLeftRight } from "lucide-react";
import * as ExcelJS from "exceljs";
import { saveAs } from "file-saver";

interface PlanRow {
  isEmriNo: string;
  parcaKodu: string;
  uaSureDk: number | null;
  [key: string]: any;
}

interface MesRow {
  isEmriNo: string;
  operator: string;
  isEmriOpNo: string;
  makine: string;
  operasyonKodu: string;
  hizCevrimSaniye: number | null;
  [key: string]: any;
}

interface MergedRow {
  parcaKodu: string;
  operator: string;
  isEmriNo: string;
  isEmriOpNo: string;
  makine: string;
  operasyonKodu: string;
  dorukSureDk: number | null;
  uaSureDk: number | null;
}

// Fuzzy column name matcher
const findColumn = (headers: string[], candidates: string[]): string | null => {
  const normalized = headers.map(h => h?.toString().toLowerCase().trim().replace(/\s+/g, " "));
  for (const c of candidates) {
    const idx = normalized.findIndex(h => h && h.includes(c.toLowerCase()));
    if (idx !== -1) return headers[idx];
  }
  return null;
};

const parseNum = (val: any): number | null => {
  if (val === null || val === undefined || val === "") return null;
  const n = parseFloat(String(val).replace(",", "."));
  return isNaN(n) ? null : n;
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
      row.eachCell((cell) => {
        headers.push(cell.value?.toString() ?? "");
      });
    } else {
      const obj: Record<string, any> = {};
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        const key = headers[colNum - 1];
        if (key) obj[key] = cell.value;
      });
      rows.push(obj);
    }
  });

  return { headers, rows };
};

const parsePlanFile = (headers: string[], rows: Record<string, any>[]): PlanRow[] => {
  const isEmriCol = findColumn(headers, ["iş emri no", "is emri no", "iş emri", "workorder", "wo no", "order no"]);
  const parcaCol = findColumn(headers, ["parça kodu", "parca kodu", "part no", "part code", "parça no"]);
  const suреCol = findColumn(headers, ["üa süre", "ua sure", "üa süre (dk)", "ua süre", "süre (dk)", "sure (dk)", "üretim süresi"]);

  return rows
    .filter(r => isEmriCol && r[isEmriCol])
    .map(r => ({
      isEmriNo: String(r[isEmriCol!] ?? "").trim(),
      parcaKodu: String(r[parcaCol ?? ""] ?? "").trim(),
      uaSureDk: suреCol ? parseNum(r[suреCol]) : null,
      ...r,
    }));
};

const parseMesFile = (headers: string[], rows: Record<string, any>[]): MesRow[] => {
  const isEmriCol = findColumn(headers, ["iş emri no", "is emri no", "iş emri", "workorder", "wo no", "order no"]);
  const operatorCol = findColumn(headers, ["operatör", "operator", "operat"]);
  const isEmriOpCol = findColumn(headers, ["iş emri op no", "is emri op no", "op no", "operasyon no"]);
  const makineCol = findColumn(headers, ["makine", "machine", "ekipman"]);
  const opsKodCol = findColumn(headers, ["operasyon kodu", "ops kodu", "op kodu", "operation code", "operasyon"]);
  const hizCol = findColumn(headers, ["hız çevrim", "hiz cevrim", "çevrim süresi", "cevrim suresi", "cycle time", "hız", "hiz"]);

  return rows
    .filter(r => isEmriCol && r[isEmriCol])
    .map(r => ({
      isEmriNo: String(r[isEmriCol!] ?? "").trim(),
      operator: String(r[operatorCol ?? ""] ?? "").trim(),
      isEmriOpNo: String(r[isEmriOpCol ?? ""] ?? "").trim(),
      makine: String(r[makineCol ?? ""] ?? "").trim(),
      operasyonKodu: String(r[opsKodCol ?? ""] ?? "").trim(),
      hizCevrimSaniye: hizCol ? parseNum(r[hizCol]) : null,
      ...r,
    }));
};

export default function ProductionComparisonModule() {
  const { t } = useLanguage();
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [mesFile, setMesFile] = useState<File | null>(null);
  const [planHeaders, setPlanHeaders] = useState<string[]>([]);
  const [mesHeaders, setMesHeaders] = useState<string[]>([]);
  const [mergedRows, setMergedRows] = useState<MergedRow[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compared, setCompared] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent, type: "plan" | "mes") => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      if (type === "plan") setPlanFile(file);
      else setMesFile(file);
      setCompared(false);
      setMergedRows([]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "plan" | "mes") => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === "plan") setPlanFile(file);
      else setMesFile(file);
      setCompared(false);
      setMergedRows([]);
    }
  };

  const handleCompare = async () => {
    if (!planFile || !mesFile) return;
    setProcessing(true);
    setError(null);
    try {
      const [planData, mesData] = await Promise.all([
        readExcel(planFile),
        readExcel(mesFile),
      ]);

      setPlanHeaders(planData.headers);
      setMesHeaders(mesData.headers);

      const planRows = parsePlanFile(planData.headers, planData.rows);
      const mesRows = parseMesFile(mesData.headers, mesData.rows);

      // Map plan by iş emri no
      const planMap = new Map<string, PlanRow>();
      planRows.forEach(r => planMap.set(r.isEmriNo, r));

      const merged: MergedRow[] = mesRows.map(mes => {
        const plan = planMap.get(mes.isEmriNo);
        const dorukSureDk = mes.hizCevrimSaniye !== null ? parseFloat((mes.hizCevrimSaniye / 60).toFixed(4)) : null;
        return {
          parcaKodu: plan?.parcaKodu || "",
          operator: mes.operator,
          isEmriNo: mes.isEmriNo,
          isEmriOpNo: mes.isEmriOpNo,
          makine: mes.makine,
          operasyonKodu: mes.operasyonKodu,
          dorukSureDk,
          uaSureDk: plan?.uaSureDk ?? null,
        };
      });

      setMergedRows(merged);
      setCompared(true);
    } catch (err: any) {
      setError(`Dosya okuma hatası: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleExport = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Karşılaştırma");

    ws.columns = [
      { header: "Parça Kodu", key: "parcaKodu", width: 18 },
      { header: "Operatör", key: "operator", width: 18 },
      { header: "İş Emri No", key: "isEmriNo", width: 18 },
      { header: "İş Emri Op No", key: "isEmriOpNo", width: 18 },
      { header: "Makine", key: "makine", width: 18 },
      { header: "Operasyon Kodu", key: "operasyonKodu", width: 18 },
      { header: "Doruk Süre (dk)", key: "dorukSureDk", width: 18 },
      { header: "ÜA Süre (dk)", key: "uaSureDk", width: 18 },
    ];

    // Header style
    const headerRow = ws.getRow(1);
    headerRow.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" }, left: { style: "thin" },
        bottom: { style: "thin" }, right: { style: "thin" }
      };
    });
    headerRow.height = 22;

    mergedRows.forEach((row, i) => {
      const exRow = ws.addRow({
        parcaKodu: row.parcaKodu,
        operator: row.operator,
        isEmriNo: row.isEmriNo,
        isEmriOpNo: row.isEmriOpNo,
        makine: row.makine,
        operasyonKodu: row.operasyonKodu,
        dorukSureDk: row.dorukSureDk,
        uaSureDk: row.uaSureDk,
      });

      const fillColor = i % 2 === 0 ? "FFF8FAFF" : "FFEEF2FF";
      exRow.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
        cell.border = {
          top: { style: "thin", color: { argb: "FFD1D5DB" } },
          left: { style: "thin", color: { argb: "FFD1D5DB" } },
          bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
          right: { style: "thin", color: { argb: "FFD1D5DB" } },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), "uretim_karsilastirma.xlsx");
  };

  const FileDropZone = ({ type, file, label }: { type: "plan" | "mes"; file: File | null; label: string }) => (
    <div
      onDrop={e => handleDrop(e, type)}
      onDragOver={e => e.preventDefault()}
      className={`relative border-2 border-dashed rounded-xl p-6 transition-all duration-200 text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 ${
        file ? "border-primary/50 bg-primary/5" : "border-border"
      }`}
      onClick={() => document.getElementById(`file-${type}`)?.click()}
    >
      <input
        id={`file-${type}`}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={e => handleFileChange(e, type)}
      />
      {file ? (
        <div className="flex flex-col items-center gap-2">
          <CheckCircle2 className="w-10 h-10 text-primary" />
          <span className="text-sm font-semibold text-foreground">{file.name}</span>
          <Badge variant="secondary">{(file.size / 1024).toFixed(1)} KB</Badge>
          <Button
            size="sm"
            variant="ghost"
            className="absolute top-2 right-2 h-7 w-7 p-0"
            onClick={e => {
              e.stopPropagation();
              if (type === "plan") setPlanFile(null);
              else setMesFile(null);
              setCompared(false);
              setMergedRows([]);
            }}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <FileSpreadsheet className="w-10 h-10 text-muted-foreground/50" />
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <span className="text-xs text-muted-foreground">.xlsx veya .xls yükleyin</span>
          <Button size="sm" variant="outline" className="mt-1 gap-2 pointer-events-none">
            <Upload className="w-3.5 h-3.5" /> Dosya Seç
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ArrowLeftRight className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Üretim Veri Karşılaştırma</h2>
          <p className="text-sm text-muted-foreground">Üretim planı ve MES raporunu karşılaştırın</p>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">1. Excel</Badge>
              Üretim Planı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FileDropZone type="plan" file={planFile} label="Üretim Planı Excel" />
            {planFile && planHeaders.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {planHeaders.map(h => <Badge key={h} variant="outline" className="text-xs">{h}</Badge>)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">2. Excel</Badge>
              MES Raporu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FileDropZone type="mes" file={mesFile} label="MES Raporu Excel" />
            {mesFile && mesHeaders.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {mesHeaders.map(h => <Badge key={h} variant="outline" className="text-xs">{h}</Badge>)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Row */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleCompare}
          disabled={!planFile || !mesFile || processing}
          className="gap-2"
        >
          <ArrowLeftRight className="w-4 h-4" />
          {processing ? "İşleniyor..." : "Karşılaştır"}
        </Button>
        {compared && mergedRows.length > 0 && (
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Excel İndir
          </Button>
        )}
        {compared && (
          <Badge variant="secondary" className="ml-auto">
            {mergedRows.length} satır eşleştirildi
          </Badge>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Preview Table */}
      {compared && mergedRows.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Önizleme (ilk 50 satır)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-primary/10 border-b border-border">
                    {["Parça Kodu", "Operatör", "İş Emri No", "İş Emri Op No", "Makine", "Operasyon Kodu", "Doruk Süre (dk)", "ÜA Süre (dk)"].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mergedRows.slice(0, 50).map((row, i) => (
                    <tr key={i} className={`border-b border-border/50 ${i % 2 === 0 ? "bg-background" : "bg-muted/30"}`}>
                      <td className="px-3 py-1.5 text-foreground">{row.parcaKodu || "-"}</td>
                      <td className="px-3 py-1.5 text-foreground">{row.operator || "-"}</td>
                      <td className="px-3 py-1.5 font-mono text-foreground">{row.isEmriNo || "-"}</td>
                      <td className="px-3 py-1.5 text-foreground">{row.isEmriOpNo || "-"}</td>
                      <td className="px-3 py-1.5 text-foreground">{row.makine || "-"}</td>
                      <td className="px-3 py-1.5 text-foreground">{row.operasyonKodu || "-"}</td>
                      <td className="px-3 py-1.5 text-primary font-semibold">
                        {row.dorukSureDk !== null ? row.dorukSureDk : "-"}
                      </td>
                      <td className="px-3 py-1.5 text-foreground">
                        {row.uaSureDk !== null ? row.uaSureDk : "-"}
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
