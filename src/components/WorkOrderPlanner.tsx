import { useState } from "react";
import { ClipboardList, Plus, Trash2, Calculator, Clock, DollarSign, FileDown } from "lucide-react";
import { materials, toolTypes, operations, Material } from "@/data/materials";
import { machinePark } from "@/data/machinePark";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { exportWorkOrderPdf } from "@/lib/exportWorkOrderPdf";

interface WorkOrderOperation {
  id: string;
  operationType: string;
  materialId: string;
  toolId: string;
  machineId: string;
  diameter: number;
  depth: number;
  length: number;
  quantity: number;
}

interface WorkOrderPlannerProps {
  customMaterials: Material[];
}

const WorkOrderPlanner = ({ customMaterials }: WorkOrderPlannerProps) => {
  const { t } = useLanguage();
  const allMaterials = [...materials, ...customMaterials];
  const [orderName, setOrderName] = useState(`${t("workOrder", "title")} #1`);
  const [machineRate, setMachineRate] = useState(150);
  const [operationsList, setOperationsList] = useState<WorkOrderOperation[]>([
    {
      id: crypto.randomUUID(),
      operationType: operations[0].id,
      materialId: allMaterials[0].id,
      toolId: toolTypes[1].id,
      machineId: machinePark[0].id,
      diameter: 20,
      depth: 2,
      length: 100,
      quantity: 1,
    },
  ]);

  const addOperation = () => {
    setOperationsList([
      ...operationsList,
      {
        id: crypto.randomUUID(),
        operationType: operations[0].id,
        materialId: allMaterials[0].id,
        toolId: toolTypes[1].id,
        machineId: machinePark[0].id,
        diameter: 20,
        depth: 2,
        length: 100,
        quantity: 1,
      },
    ]);
  };

  const removeOperation = (id: string) => {
    if (operationsList.length > 1) {
      setOperationsList(operationsList.filter((op) => op.id !== id));
    }
  };

  const updateOperation = (id: string, field: keyof WorkOrderOperation, value: string | number) => {
    setOperationsList(
      operationsList.map((op) =>
        op.id === id ? { ...op, [field]: value } : op
      )
    );
  };

  const calculateOperationTime = (op: WorkOrderOperation) => {
    const material = allMaterials.find((m) => m.id === op.materialId)!;
    const tool = toolTypes.find((t) => t.id === op.toolId)!;
    
    const avgCuttingSpeed = ((material.cuttingSpeed.min + material.cuttingSpeed.max) / 2) * tool.multiplier;
    const avgFeedRate = (material.feedRate.min + material.feedRate.max) / 2;
    const spindleSpeed = (1000 * avgCuttingSpeed) / (Math.PI * op.diameter);
    const tableFeed = avgFeedRate * spindleSpeed;
    
    const cuttingTime = (op.length / tableFeed) * op.quantity;
    const setupTime = 2;
    const toolChangeTime = 0.5;
    
    return {
      cuttingTime,
      setupTime,
      toolChangeTime,
      totalTime: cuttingTime + setupTime + toolChangeTime,
      spindleSpeed: Math.round(spindleSpeed),
      tableFeed: Math.round(tableFeed),
    };
  };

  const totals = operationsList.reduce(
    (acc, op) => {
      const times = calculateOperationTime(op);
      return {
        cuttingTime: acc.cuttingTime + times.cuttingTime,
        setupTime: acc.setupTime + times.setupTime,
        toolChangeTime: acc.toolChangeTime + times.toolChangeTime,
        totalTime: acc.totalTime + times.totalTime,
      };
    },
    { cuttingTime: 0, setupTime: 0, toolChangeTime: 0, totalTime: 0 }
  );

  const totalCost = (totals.totalTime / 60) * machineRate;

  const getMaterialName = (id: string) => t("materialNames", id) !== id ? t("materialNames", id) : allMaterials.find(m => m.id === id)?.name || id;
  const getToolName = (id: string) => t("toolTypeNames", id) !== id ? t("toolTypeNames", id) : toolTypes.find(tt => tt.id === id)?.name || id;
  const getOpName = (id: string) => t("operationNames", id) !== id ? t("operationNames", id) : operations.find(o => o.id === id)?.name || id;

  const exportToPDF = async () => {
    const getMachineName = (id: string) => machinePark.find(m => m.id === id)?.label ?? "-";
    await exportWorkOrderPdf({
      orderName,
      machineRate,
      operations: operationsList,
      totals,
      totalCost,
      getMaterialName,
      getToolName,
      getOpName,
      getMachineName,
      calculateOperationTime,
      t,
    });
    toast({
      title: t("workOrder", "pdfDownloaded"),
      description: t("workOrder", "pdfSaved"),
    });
  };

  return (
    <div className="industrial-card p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/20">
            <ClipboardList className="w-5 h-5 text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            {t("workOrder", "title")}
          </h2>
        </div>
        <button
          onClick={exportToPDF}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:brightness-110 transition-all text-sm"
        >
          <FileDown className="w-4 h-4" />
          {t("workOrder", "downloadPdf")}
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6 p-4 rounded-lg bg-secondary/30 border border-border">
        <div>
          <label className="label-industrial block mb-2">{t("workOrder", "orderName")}</label>
          <input type="text" value={orderName} onChange={(e) => setOrderName(e.target.value)} className="input-industrial w-full" />
        </div>
        <div>
          <label className="label-industrial block mb-2">{t("workOrder", "machineRate")}</label>
          <input type="number" value={machineRate} onChange={(e) => setMachineRate(Number(e.target.value))} className="input-industrial w-full" />
        </div>
        <div className="flex items-end">
          <button onClick={addOperation} className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent/20 text-accent hover:bg-accent/30 transition-colors w-full justify-center">
            <Plus className="w-4 h-4" />
            {t("workOrder", "addOperation")}
          </button>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        {operationsList.map((op, index) => {
          const times = calculateOperationTime(op);
          return (
            <div key={op.id} className="p-4 rounded-lg bg-card border border-border">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-primary">
                  {t("workOrder", "operationNum")} #{index + 1}
                </span>
                <button onClick={() => removeOperation(op.id)} className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors" disabled={operationsList.length === 1}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid md:grid-cols-5 gap-3 mb-3">
                <div>
                  <label className="text-xs text-muted-foreground">{t("workOrder", "operationType")}</label>
                  <select value={op.operationType} onChange={(e) => updateOperation(op.id, "operationType", e.target.value)} className="input-industrial w-full text-sm">
                    {operations.map((o) => (<option key={o.id} value={o.id}>{o.icon} {getOpName(o.id)}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t("workOrder", "machine")}</label>
                  <select value={op.machineId} onChange={(e) => updateOperation(op.id, "machineId", e.target.value)} className="input-industrial w-full text-sm">
                    {machinePark.map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t("common", "material")}</label>
                  <select value={op.materialId} onChange={(e) => updateOperation(op.id, "materialId", e.target.value)} className="input-industrial w-full text-sm">
                    {allMaterials.map((m) => (<option key={m.id} value={m.id}>{getMaterialName(m.id)}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t("workOrder", "tool")}</label>
                  <select value={op.toolId} onChange={(e) => updateOperation(op.id, "toolId", e.target.value)} className="input-industrial w-full text-sm">
                    {toolTypes.map((tt) => (<option key={tt.id} value={tt.id}>{getToolName(tt.id)}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t("workOrder", "quantity")}</label>
                  <input type="number" value={op.quantity} onChange={(e) => updateOperation(op.id, "quantity", Number(e.target.value))} className="input-industrial w-full text-sm" min="1" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-xs text-muted-foreground">{t("workOrder", "diameterMm")}</label>
                  <input type="number" value={op.diameter} onChange={(e) => updateOperation(op.id, "diameter", Number(e.target.value))} className="input-industrial w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t("workOrder", "depthMm")}</label>
                  <input type="number" value={op.depth} onChange={(e) => updateOperation(op.id, "depth", Number(e.target.value))} className="input-industrial w-full text-sm" step="0.1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t("workOrder", "lengthMm")}</label>
                  <input type="number" value={op.length} onChange={(e) => updateOperation(op.id, "length", Number(e.target.value))} className="input-industrial w-full text-sm" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>{t("workOrder", "spindle")}: <span className="text-primary font-mono">{times.spindleSpeed}</span> {t("common", "spindleSpeed") === "Devir Sayısı" ? "dev/dk" : "rpm"}</span>
                  <span>{t("workOrder", "feed")}: <span className="text-accent font-mono">{times.tableFeed}</span> mm/{t("common", "minute")}</span>
                </div>
                <div className="text-sm font-medium text-foreground">
                  {t("workOrder", "duration")}: <span className="text-primary font-mono">{times.totalTime.toFixed(2)}</span> {t("common", "minute")}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid md:grid-cols-4 gap-4 p-4 rounded-lg metal-surface border border-border">
        <div className="text-center p-3 rounded-lg bg-card">
          <Clock className="w-5 h-5 text-primary mx-auto mb-2" />
          <span className="text-xs text-muted-foreground block">{t("workOrder", "cuttingTime")}</span>
          <span className="font-mono text-xl text-foreground">{totals.cuttingTime.toFixed(2)}</span>
          <span className="text-xs text-muted-foreground"> {t("common", "minute")}</span>
        </div>
        <div className="text-center p-3 rounded-lg bg-card">
          <Calculator className="w-5 h-5 text-accent mx-auto mb-2" />
          <span className="text-xs text-muted-foreground block">{t("workOrder", "setup")}</span>
          <span className="font-mono text-xl text-foreground">{totals.setupTime.toFixed(2)}</span>
          <span className="text-xs text-muted-foreground"> {t("common", "minute")}</span>
        </div>
        <div className="text-center p-3 rounded-lg bg-card">
          <Clock className="w-5 h-5 text-yellow-400 mx-auto mb-2" />
          <span className="text-xs text-muted-foreground block">{t("workOrder", "totalTime")}</span>
          <span className="font-mono text-xl text-primary">{totals.totalTime.toFixed(2)}</span>
          <span className="text-xs text-muted-foreground"> {t("common", "minute")}</span>
        </div>
        <div className="text-center p-3 rounded-lg bg-primary/10 border border-primary/30">
          <DollarSign className="w-5 h-5 text-primary mx-auto mb-2" />
          <span className="text-xs text-muted-foreground block">{t("workOrder", "estimatedCost")}</span>
          <span className="font-mono text-xl text-primary">{totalCost.toFixed(2)}</span>
          <span className="text-xs text-muted-foreground"> TL</span>
        </div>
      </div>
    </div>
  );
};

export default WorkOrderPlanner;
