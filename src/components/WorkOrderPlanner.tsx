import { useState } from "react";
import { ClipboardList, Plus, Trash2, Calculator, Clock, DollarSign, FileDown } from "lucide-react";
import { materials, toolTypes, operations, Material } from "@/data/materials";
import { machinePark } from "@/data/machinePark";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

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
  const allMaterials = [...materials, ...customMaterials];
  const [orderName, setOrderName] = useState("İş Emri #1");
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
      cuttingTime: cuttingTime,
      setupTime: setupTime,
      toolChangeTime: toolChangeTime,
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

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(18);
    doc.text(orderName, pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`Tarih: ${new Date().toLocaleDateString("tr-TR")}`, 14, 35);
    doc.text(`Makine Ücreti: ${machineRate} TL/saat`, 14, 42);
    
    doc.setFontSize(12);
    doc.text("İşlem Detayları", 14, 55);
    
    let yPos = 65;
    operationsList.forEach((op, index) => {
      const material = allMaterials.find((m) => m.id === op.materialId)!;
      const tool = toolTypes.find((t) => t.id === op.toolId)!;
      const opType = operations.find((o) => o.id === op.operationType)!;
      const times = calculateOperationTime(op);
      
      doc.setFontSize(10);
      const machine = machinePark.find((m) => m.id === op.machineId);
      doc.text(`${index + 1}. ${opType.name}`, 14, yPos);
      doc.text(`   Tezgah: ${machine?.label ?? "-"}`, 14, yPos + 6);
      doc.text(`   Malzeme: ${material.name}`, 14, yPos + 12);
      doc.text(`   Takım: ${tool.name} - Ø${op.diameter}mm`, 14, yPos + 18);
      doc.text(`   Derinlik: ${op.depth}mm, Uzunluk: ${op.length}mm, Adet: ${op.quantity}`, 14, yPos + 24);
      doc.text(`   Süre: ${times.totalTime.toFixed(2)} dk`, 14, yPos + 24);
      
      yPos += 35;
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }
    });
    
    yPos += 10;
    doc.setFontSize(12);
    doc.text("Özet", 14, yPos);
    doc.setFontSize(10);
    doc.text(`Toplam Kesme Süresi: ${totals.cuttingTime.toFixed(2)} dk`, 14, yPos + 10);
    doc.text(`Toplam Hazırlık Süresi: ${totals.setupTime.toFixed(2)} dk`, 14, yPos + 17);
    doc.text(`Toplam Takım Değişim: ${totals.toolChangeTime.toFixed(2)} dk`, 14, yPos + 24);
    doc.text(`TOPLAM SÜRE: ${totals.totalTime.toFixed(2)} dk`, 14, yPos + 34);
    doc.text(`TAHMİNİ MALİYET: ${totalCost.toFixed(2)} TL`, 14, yPos + 44);
    
    doc.save(`${orderName.replace(/\s+/g, "_")}.pdf`);
    
    toast({
      title: "PDF İndirildi",
      description: "İş emri PDF olarak kaydedildi.",
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
            İş Emri Planlama
          </h2>
        </div>
        <button
          onClick={exportToPDF}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:brightness-110 transition-all text-sm"
        >
          <FileDown className="w-4 h-4" />
          PDF İndir
        </button>
      </div>

      {/* Header Settings */}
      <div className="grid md:grid-cols-3 gap-4 mb-6 p-4 rounded-lg bg-secondary/30 border border-border">
        <div>
          <label className="label-industrial block mb-2">İş Emri Adı</label>
          <input
            type="text"
            value={orderName}
            onChange={(e) => setOrderName(e.target.value)}
            className="input-industrial w-full"
          />
        </div>
        <div>
          <label className="label-industrial block mb-2">Makine Ücreti (TL/saat)</label>
          <input
            type="number"
            value={machineRate}
            onChange={(e) => setMachineRate(Number(e.target.value))}
            className="input-industrial w-full"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={addOperation}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent/20 text-accent hover:bg-accent/30 transition-colors w-full justify-center"
          >
            <Plus className="w-4 h-4" />
            İşlem Ekle
          </button>
        </div>
      </div>

      {/* Operations List */}
      <div className="space-y-4 mb-6">
        {operationsList.map((op, index) => {
          const times = calculateOperationTime(op);
          return (
            <div
              key={op.id}
              className="p-4 rounded-lg bg-card border border-border"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-primary">
                  İşlem #{index + 1}
                </span>
                <button
                  onClick={() => removeOperation(op.id)}
                  className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                  disabled={operationsList.length === 1}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid md:grid-cols-5 gap-3 mb-3">
                <div>
                  <label className="text-xs text-muted-foreground">İşlem Tipi</label>
                  <select
                    value={op.operationType}
                    onChange={(e) => updateOperation(op.id, "operationType", e.target.value)}
                    className="input-industrial w-full text-sm"
                  >
                    {operations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.icon} {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Tezgah</label>
                  <select
                    value={op.machineId}
                    onChange={(e) => updateOperation(op.id, "machineId", e.target.value)}
                    className="input-industrial w-full text-sm"
                  >
                    {machinePark.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Malzeme</label>
                  <select
                    value={op.materialId}
                    onChange={(e) => updateOperation(op.id, "materialId", e.target.value)}
                    className="input-industrial w-full text-sm"
                  >
                    {allMaterials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Takım</label>
                  <select
                    value={op.toolId}
                    onChange={(e) => updateOperation(op.id, "toolId", e.target.value)}
                    className="input-industrial w-full text-sm"
                  >
                    {toolTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Adet</label>
                  <input
                    type="number"
                    value={op.quantity}
                    onChange={(e) => updateOperation(op.id, "quantity", Number(e.target.value))}
                    className="input-industrial w-full text-sm"
                    min="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-xs text-muted-foreground">Çap (mm)</label>
                  <input
                    type="number"
                    value={op.diameter}
                    onChange={(e) => updateOperation(op.id, "diameter", Number(e.target.value))}
                    className="input-industrial w-full text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Derinlik (mm)</label>
                  <input
                    type="number"
                    value={op.depth}
                    onChange={(e) => updateOperation(op.id, "depth", Number(e.target.value))}
                    className="input-industrial w-full text-sm"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Uzunluk (mm)</label>
                  <input
                    type="number"
                    value={op.length}
                    onChange={(e) => updateOperation(op.id, "length", Number(e.target.value))}
                    className="input-industrial w-full text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Devir: <span className="text-primary font-mono">{times.spindleSpeed}</span> dev/dk</span>
                  <span>İlerleme: <span className="text-accent font-mono">{times.tableFeed}</span> mm/dk</span>
                </div>
                <div className="text-sm font-medium text-foreground">
                  Süre: <span className="text-primary font-mono">{times.totalTime.toFixed(2)}</span> dk
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="grid md:grid-cols-4 gap-4 p-4 rounded-lg metal-surface border border-border">
        <div className="text-center p-3 rounded-lg bg-card">
          <Clock className="w-5 h-5 text-primary mx-auto mb-2" />
          <span className="text-xs text-muted-foreground block">Kesme Süresi</span>
          <span className="font-mono text-xl text-foreground">{totals.cuttingTime.toFixed(2)}</span>
          <span className="text-xs text-muted-foreground"> dk</span>
        </div>
        <div className="text-center p-3 rounded-lg bg-card">
          <Calculator className="w-5 h-5 text-accent mx-auto mb-2" />
          <span className="text-xs text-muted-foreground block">Hazırlık</span>
          <span className="font-mono text-xl text-foreground">{totals.setupTime.toFixed(2)}</span>
          <span className="text-xs text-muted-foreground"> dk</span>
        </div>
        <div className="text-center p-3 rounded-lg bg-card">
          <Clock className="w-5 h-5 text-yellow-400 mx-auto mb-2" />
          <span className="text-xs text-muted-foreground block">Toplam Süre</span>
          <span className="font-mono text-xl text-primary">{totals.totalTime.toFixed(2)}</span>
          <span className="text-xs text-muted-foreground"> dk</span>
        </div>
        <div className="text-center p-3 rounded-lg bg-primary/10 border border-primary/30">
          <DollarSign className="w-5 h-5 text-primary mx-auto mb-2" />
          <span className="text-xs text-muted-foreground block">Tahmini Maliyet</span>
          <span className="font-mono text-xl text-primary">{totalCost.toFixed(2)}</span>
          <span className="text-xs text-muted-foreground"> TL</span>
        </div>
      </div>
    </div>
  );
};

export default WorkOrderPlanner;
