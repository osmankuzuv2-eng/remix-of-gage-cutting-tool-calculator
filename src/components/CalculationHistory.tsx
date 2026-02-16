import { useState, useEffect } from "react";
import { History, Trash2, Download, Clock, ChevronDown, ChevronUp, Cloud, CloudOff, RefreshCw, Loader2, FileSpreadsheet } from "lucide-react";
import jsPDF from "jspdf";
import { useSupabaseSync, LocalCalculation } from "@/hooks/useSupabaseSync";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { translations } from "@/i18n/translations";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type CalculationRecord = LocalCalculation;

const CalculationHistory = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { calculations: history, loading, syncing, deleteCalculation, clearAllCalculations, migrateToCloud, refresh, isCloudEnabled } = useSupabaseSync();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const deleteRecord = async (id: string) => { await deleteCalculation(id); };

  const clearAll = async () => {
    if (window.confirm(t("history", "confirmClear"))) await clearAllCalculations();
  };

  const handleMigrate = async () => {
    if (window.confirm(t("history", "confirmMigrate"))) await migrateToCloud();
  };

  const exportPDF = (record: LocalCalculation) => {
    const doc = new jsPDF();
    const date = new Date(record.timestamp).toLocaleString("tr-TR");
    doc.setFontSize(18); doc.setTextColor(40);
    doc.text("CNC Calculation Report", 20, 20);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`${t("common", "time")}: ${date}`, 20, 30);
    doc.text(`${t("common", "result")}: ${getTypeLabel(record.type)}`, 20, 36);
    doc.setFontSize(12); doc.setTextColor(40);
    doc.text(t("common", "material"), 20, 50);
    doc.setFontSize(10); doc.setTextColor(80);
    doc.text(`${t("common", "material")}: ${record.material}`, 25, 58);
    doc.text(`${t("common", "toolType")}: ${record.tool}`, 25, 64);
    doc.setFontSize(12); doc.setTextColor(40);
    doc.text(t("common", "parameters"), 20, 78);
    doc.setFontSize(10); doc.setTextColor(80);
    let yPos = 86;
    Object.entries(record.parameters).forEach(([key, value]) => { doc.text(`${formatKey(key)}: ${value}`, 25, yPos); yPos += 6; });
    doc.setFontSize(12); doc.setTextColor(40);
    doc.text(t("common", "results"), 20, yPos + 10);
    doc.setFontSize(10); doc.setTextColor(80); yPos += 18;
    Object.entries(record.results).forEach(([key, value]) => { doc.text(`${formatKey(key)}: ${value}`, 25, yPos); yPos += 6; });
    doc.setFontSize(8); doc.setTextColor(150);
    doc.text("GAGE Confidence Toolroom © 2026", 20, 280);
    doc.save(`calculation_${record.id}.pdf`);
  };

  const exportAllPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20); doc.text(t("history", "title"), 20, 20);
    doc.setFontSize(10);
    doc.text(`${history.length} ${t("history", "records")}`, 20, 28);
    doc.text(`${new Date().toLocaleString("tr-TR")}`, 20, 34);
    let yPos = 50;
    history.forEach((record, index) => {
      if (yPos > 260) { doc.addPage(); yPos = 20; }
      const date = new Date(record.timestamp).toLocaleString("tr-TR");
      doc.setFontSize(11); doc.setTextColor(40);
      doc.text(`${index + 1}. ${getTypeLabel(record.type)} - ${record.material}`, 20, yPos);
      doc.setFontSize(9); doc.setTextColor(100);
      doc.text(`${date} | ${record.tool}`, 25, yPos + 6);
      const resultText = Object.entries(record.results).slice(0, 3).map(([k, v]) => `${formatKey(k)}: ${v}`).join(" | ");
      doc.text(resultText, 25, yPos + 12); yPos += 25;
    });
    doc.save(`calculation_history_${Date.now()}.pdf`);
  };

  const exportCSV = () => {
    const headers = ["ID", t("common", "time"), t("common", "result"), t("common", "material"), t("common", "toolType"), t("common", "parameters"), t("common", "results")];
    const rows = history.map((record) => {
      const date = new Date(record.timestamp).toLocaleString("tr-TR");
      const params = Object.entries(record.parameters).map(([k, v]) => `${formatKey(k)}: ${v}`).join("; ");
      const results = Object.entries(record.results).map(([k, v]) => `${formatKey(k)}: ${v}`).join("; ");
      return [record.id, date, getTypeLabel(record.type), record.material, record.tool, `"${params}"`, `"${results}"`];
    });
    const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `calculation_history_${Date.now()}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
  };

  const getTypeLabel = (type: string) => {
    const key = type as keyof typeof translations;
    return t("history", `types.${type}` as any) || type;
  };

  // Fallback for nested translation
  const getTypeLabelFallback = (type: string) => {
    switch (type) {
      case "cutting": return t("tabs", "cutting");
      case "toollife": return t("tabs", "toollife");
      case "cost": return t("tabs", "cost");
      case "threading": return t("tabs", "threading");
      case "grinding": return "Grinding";
      case "drilling": return t("tabs", "drilling");
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "cutting": return "bg-accent/20 text-accent-foreground";
      case "toollife": return "bg-warning/20 text-warning";
      case "cost": return "bg-green-500/20 text-green-400";
      case "threading": return "bg-blue-500/20 text-blue-400";
      case "grinding": return "bg-purple-500/20 text-purple-400";
      case "drilling": return "bg-orange-500/20 text-orange-400";
      default: return "bg-secondary text-foreground";
    }
  };

  const formatKey = (key: string) => key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()).replace(/Per/g, "/");

  if (loading) {
    return (<div className="industrial-card p-6 animate-fade-in"><div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></div>);
  }

  return (
    <div className="industrial-card p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/20"><History className="w-5 h-5 text-indigo-400" /></div>
          <h2 className="text-lg font-semibold text-foreground">{t("history", "title")}</h2>
          <span className="px-2 py-0.5 rounded-full bg-secondary text-xs text-muted-foreground">{history.length} {t("history", "records")}</span>
          {isCloudEnabled ? (
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 gap-1"><Cloud className="w-3 h-3" />{t("history", "cloud")}</Badge>
          ) : (
            <Badge variant="secondary" className="gap-1"><CloudOff className="w-3 h-3" />{t("history", "local")}</Badge>
          )}
        </div>
        <div className="flex gap-2">
          {user && !isCloudEnabled && history.length > 0 && (
            <Button onClick={handleMigrate} variant="outline" size="sm" disabled={syncing} className="gap-2">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
              {t("history", "migrateToCloud")}
            </Button>
          )}
          <Button onClick={refresh} variant="ghost" size="sm" disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {history.length > 0 && (
            <>
              <Button onClick={exportCSV} variant="outline" size="sm" className="gap-2"><FileSpreadsheet className="w-4 h-4" />CSV</Button>
              <Button onClick={exportAllPDF} size="sm" className="gap-2"><Download className="w-4 h-4" />{t("common", "pdf")}</Button>
              <Button onClick={clearAll} variant="destructive" size="sm" className="gap-2"><Trash2 className="w-4 h-4" />{t("common", "clear")}</Button>
            </>
          )}
        </div>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">{t("history", "noRecords")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("history", "autoAppear")}</p>
          {!user && <p className="text-sm text-primary mt-4">💡 {t("history", "cloudHint")}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((record) => (
            <div key={record.id} className="border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-4 bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors"
                onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}>
                <div className="flex items-center gap-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(record.type)}`}>{getTypeLabelFallback(record.type)}</span>
                  <div>
                    <span className="font-medium text-foreground">{record.material}</span>
                    <span className="text-muted-foreground mx-2">•</span>
                    <span className="text-muted-foreground text-sm">{record.tool}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">{new Date(record.timestamp).toLocaleString("tr-TR")}</span>
                  {expandedId === record.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>
              {expandedId === record.id && (
                <div className="p-4 bg-card border-t border-border">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="label-industrial mb-3">{t("common", "parameters")}</h4>
                      <div className="space-y-2">
                        {Object.entries(record.parameters).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{formatKey(key)}</span>
                            <span className="font-mono text-foreground">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="label-industrial mb-3">{t("common", "results")}</h4>
                      <div className="space-y-2">
                        {Object.entries(record.results).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{formatKey(key)}</span>
                            <span className="font-mono text-accent">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                    <Button onClick={() => exportPDF(record)} variant="secondary" size="sm" className="gap-2">
                      <Download className="w-4 h-4" />{t("history", "downloadPdf")}
                    </Button>
                    <Button onClick={() => deleteRecord(record.id)} variant="ghost" size="sm" className="gap-2 text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />{t("common", "delete")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CalculationHistory;

export { saveCalculationLegacy as saveCalculation } from "@/hooks/useSupabaseSync";
