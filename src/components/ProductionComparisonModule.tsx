import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, X, ArrowLeftRight, Settings2 } from "lucide-react";
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
}

interface ColumnMapping {
  // Plan (Excel 1)
  plan_isEmriNo: string;
  plan_parcaKodu: string;
  plan_uaSure: string;
  // MES (Excel 2)
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
      row.eachCell({ includeEmpty: true }, (cell) => {
        headers.push(cell.value?.toString().trim() ?? "");
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

  return { headers: headers.filter(h => h !== ""), rows };
};

const ColSelect = ({
  label,
  value,
  headers,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  headers: string[];
  onChange: (v: string) => void;
  required?: boolean;
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
      const { headers, rows } = await readExcel(file);
      if (type === "plan") {
        setPlanHeaders(headers);
        setPlanRows(rows);
        // Auto-detect common names
        const autoIsEmri = headers.find(h => /iş emri no|is emri no|workorder|wo no/i.test(h)) ?? NONE;
        const autoParca = headers.find(h => /parça kodu|parca kodu|part no|part code/i.test(h)) ?? NONE;
        const autoUa = headers.find(h => /üa süre|ua sure|üretim süresi|süre.*dk/i.test(h)) ?? NONE;
        setMapping(prev => ({ ...prev, plan_isEmriNo: autoIsEmri, plan_parcaKodu: autoParca, plan_uaSure: autoUa }));
      } else {
        setMesHeaders(headers);
        setMesRows(rows);
        const autoIsEmri = headers.find(h => /iş emri no|is emri no|workorder|wo no/i.test(h)) ?? NONE;
        const autoOp = headers.find(h => /operatör|operator/i.test(h)) ?? NONE;
        const autoOpNo = headers.find(h => /iş emri op no|is emri op no|op no/i.test(h)) ?? NONE;
        const autoMak = headers.find(h => /makine|machine|ekipman/i.test(h)) ?? NONE;
        const autoOpsKod = headers.find(h => /operasyon kodu|ops kodu|op kodu|operation code/i.test(h)) ?? NONE;
        const autoHiz = headers.find(h => /hız çevrim|hiz cevrim|çevrim süresi|cycle time|hız|hiz/i.test(h)) ?? NONE;
        setMapping(prev => ({
          ...prev,
          mes_isEmriNo: autoIsEmri, mes_operator: autoOp, mes_isEmriOpNo: autoOpNo,
          mes_makine: autoMak, mes_operasyonKodu: autoOpsKod, mes_hizCevrim: autoHiz,
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
  }, []);

  const setMap = (key: keyof ColumnMapping, val: string) =>
    setMapping(prev => ({ ...prev, [key]: val }));

  const canCompare =
    planFile && mesFile &&
    mapping.plan_isEmriNo !== NONE &&
    mapping.mes_isEmriNo !== NONE;

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
          const dorukSureDk = hizSaniye !== null ? parseFloat((hizSaniye / 60).toFixed(4)) : null;
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
    const headerRow = ws.getRow(1);
    headerRow.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    });
    headerRow.height = 22;
    mergedRows.forEach((row, i) => {
      const exRow = ws.addRow(row);
      const fill = i % 2 === 0 ? "FFF8FAFF" : "FFEEF2FF";
      exRow.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
        cell.border = { top: { style: "thin", color: { argb: "FFD1D5DB" } }, left: { style: "thin", color: { argb: "FFD1D5DB" } }, bottom: { style: "thin", color: { argb: "FFD1D5DB" } }, right: { style: "thin", color: { argb: "FFD1D5DB" } } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
    });
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), "uretim_karsilastirma.xlsx");
  };

  const FileDropZone = ({ type, file, label, badge, badgeClass }: {
    type: "plan" | "mes"; file: File | null; label: string; badge: string; badgeClass: string;
  }) => (
    <div
      onDrop={e => handleDrop(e, type)}
      onDragOver={e => e.preventDefault()}
      className={`relative border-2 border-dashed rounded-xl p-5 transition-all duration-200 text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 ${file ? "border-primary/40 bg-primary/5" : "border-border"}`}
      onClick={() => document.getElementById(`file-${type}`)?.click()}
    >
      <input id={`file-${type}`} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => handleFileChange(e, type)} />
      {loadingFile === type ? (
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-muted-foreground">Okunuyor...</span>
        </div>
      ) : file ? (
        <div className="flex flex-col items-center gap-1.5">
          <CheckCircle2 className="w-9 h-9 text-primary" />
          <span className="text-sm font-semibold text-foreground">{file.name}</span>
          <Badge variant="secondary">{(file.size / 1024).toFixed(1)} KB</Badge>
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
          <FileSpreadsheet className="w-9 h-9 text-muted-foreground/40" />
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <span className="text-xs text-muted-foreground">Sürükle & bırak veya tıkla</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ArrowLeftRight className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Üretim Veri Karşılaştırma</h2>
          <p className="text-sm text-muted-foreground">Üretim planı ve MES raporunu iş emri no ile eşleştirin</p>
        </div>
      </div>

      {/* Upload */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 hover:bg-blue-500/10">1. Excel</Badge>
              Üretim Planı
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <FileDropZone type="plan" file={planFile} label="Üretim Planı" badge="1. Excel" badgeClass="bg-blue-500/10 text-blue-600" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/10">2. Excel</Badge>
              MES Raporu
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <FileDropZone type="mes" file={mesFile} label="MES Raporu" badge="2. Excel" badgeClass="bg-emerald-500/10 text-emerald-600" />
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
                <p className="text-xs font-semibold text-blue-600 mb-2">📋 1. Excel — Üretim Planı Sütunları</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <ColSelect label="İş Emri No" value={mapping.plan_isEmriNo} headers={planHeaders} onChange={v => setMap("plan_isEmriNo", v)} required />
                  <ColSelect label="Parça Kodu" value={mapping.plan_parcaKodu} headers={planHeaders} onChange={v => setMap("plan_parcaKodu", v)} />
                  <ColSelect label="ÜA Süre (dk)" value={mapping.plan_uaSure} headers={planHeaders} onChange={v => setMap("plan_uaSure", v)} />
                </div>
              </div>
            )}
            {mesHeaders.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-600 mb-2">🏭 2. Excel — MES Raporu Sütunları</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <ColSelect label="İş Emri No" value={mapping.mes_isEmriNo} headers={mesHeaders} onChange={v => setMap("mes_isEmriNo", v)} required />
                  <ColSelect label="Operatör" value={mapping.mes_operator} headers={mesHeaders} onChange={v => setMap("mes_operator", v)} />
                  <ColSelect label="İş Emri Op No" value={mapping.mes_isEmriOpNo} headers={mesHeaders} onChange={v => setMap("mes_isEmriOpNo", v)} />
                  <ColSelect label="Makine" value={mapping.mes_makine} headers={mesHeaders} onChange={v => setMap("mes_makine", v)} />
                  <ColSelect label="Operasyon Kodu" value={mapping.mes_operasyonKodu} headers={mesHeaders} onChange={v => setMap("mes_operasyonKodu", v)} />
                  <ColSelect label="Hız Çevrim (saniye)" value={mapping.mes_hizCevrim} headers={mesHeaders} onChange={v => setMap("mes_hizCevrim", v)} />
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
                    {["Parça Kodu", "Operatör", "İş Emri No", "İş Emri Op No", "Makine", "Operasyon Kodu", "Doruk Süre (dk)", "ÜA Süre (dk)"].map(h => (
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
