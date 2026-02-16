import { useState, useMemo } from "react";
import { Code, Copy, Download, Check, Settings2 } from "lucide-react";
import { materials, toolTypes } from "@/data/materials";
import { useLanguage } from "@/i18n/LanguageContext";

const GCodeGenerator = () => {
  const { t } = useLanguage();
  const getMaterialName = (id: string) => { const tr = t("materialNames", id); return tr !== id ? tr : materials.find(m => m.id === id)?.name || id; };
  const getToolName = (id: string) => { const tr = t("toolTypeNames", id); return tr !== id ? tr : toolTypes.find(tt => tt.id === id)?.name || id; };
  const [selectedMaterial, setSelectedMaterial] = useState(materials[0].id);
  const [selectedTool, setSelectedTool] = useState(toolTypes[1].id);
  const [diameter, setDiameter] = useState(20);
  const [depth, setDepth] = useState(2);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [length, setLength] = useState(100);
  const [coolant, setCoolant] = useState(true);
  const [copied, setCopied] = useState(false);

  const material = materials.find((m) => m.id === selectedMaterial)!;
  const tool = toolTypes.find((t) => t.id === selectedTool)!;

  const calculations = useMemo(() => {
    const avgCuttingSpeed = ((material.cuttingSpeed.min + material.cuttingSpeed.max) / 2) * tool.multiplier;
    const avgFeedRate = (material.feedRate.min + material.feedRate.max) / 2;
    const spindleSpeed = Math.min(20000, Math.round((1000 * avgCuttingSpeed) / (Math.PI * diameter)));
    const tableFeed = Math.round(avgFeedRate * spindleSpeed);
    return { spindleSpeed, tableFeed };
  }, [selectedMaterial, selectedTool, diameter]);

  const gcode = useMemo(() => {
    const lines = [
      `; ========================================`,
      `; CNC Kesici Takım Hesaplayıcı - G-Code`,
      `; ========================================`,
      `; Malzeme: ${material.name}`,
      `; Takım: ${tool.name} - Ø${diameter}mm`,
      `; Tarih: ${new Date().toLocaleString('tr-TR')}`,
      `; ========================================`,
      ``,
      `; Başlangıç`,
      `G21 ; Metrik birimler (mm)`,
      `G90 ; Mutlak koordinat`,
      `G17 ; XY düzlemi`,
      ``,
      `; Güvenli konum`,
      `G28 G91 Z0 ; Z home`,
      `G90`,
      `G54 ; İş koordinatı`,
      ``,
      `; Mil devri ayarı`,
      `S${calculations.spindleSpeed} M03 ; Mil saat yönünde`,
      coolant ? `M08 ; Soğutma AÇIK` : `; Soğutma KAPALI`,
      ``,
      `; Hızlı pozisyonlama`,
      `G00 Z5.0 ; Güvenli yükseklik`,
      `G00 X${startX.toFixed(3)} Y${startY.toFixed(3)}`,
      ``,
      `; Kesme işlemi`,
      `G01 Z-${depth.toFixed(3)} F${Math.round(calculations.tableFeed / 3)} ; Dalma`,
      `G01 X${(startX + length).toFixed(3)} F${calculations.tableFeed} ; İlerleme`,
      ``,
      `; Geri çekilme`,
      `G00 Z5.0`,
      `G00 X${startX.toFixed(3)} Y${startY.toFixed(3)}`,
      ``,
      `; Sonlandırma`,
      `M05 ; Mil durdur`,
      coolant ? `M09 ; Soğutma KAPAT` : ``,
      `G28 G91 Z0 ; Z home`,
      `G28 X0 Y0 ; XY home`,
      `M30 ; Program sonu`,
      ``,
      `; ========================================`,
      `; Hesaplanan Parametreler:`,
      `; Devir: ${calculations.spindleSpeed} dev/dk`,
      `; İlerleme: ${calculations.tableFeed} mm/dk`,
      `; ========================================`,
    ].filter(Boolean);

    return lines.join('\n');
  }, [material, tool, diameter, depth, startX, startY, length, coolant, calculations]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(gcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadGCode = () => {
    const blob = new Blob([gcode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `program_${Date.now()}.nc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="industrial-card p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <Code className="w-5 h-5 text-purple-400" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">G-Code Üretici</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 transition-colors text-sm"
          >
            {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            {copied ? "Kopyalandı" : "Kopyala"}
          </button>
          <button
            onClick={downloadGCode}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:brightness-110 transition-all text-sm"
          >
            <Download className="w-4 h-4" />
            İndir (.nc)
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="w-4 h-4 text-muted-foreground" />
            <span className="label-industrial">Parametreler</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-industrial block mb-2">Malzeme</label>
              <select
                value={selectedMaterial}
                onChange={(e) => setSelectedMaterial(e.target.value)}
                className="input-industrial w-full"
              >
                {materials.map((mat) => (
                  <option key={mat.id} value={mat.id}>{getMaterialName(mat.id)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-industrial block mb-2">Takım</label>
              <select
                value={selectedTool}
                onChange={(e) => setSelectedTool(e.target.value)}
                className="input-industrial w-full"
              >
                {toolTypes.map((tt) => (
                  <option key={tt.id} value={tt.id}>{getToolName(tt.id)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-industrial block mb-2">Takım Çapı (mm)</label>
              <input
                type="number"
                value={diameter}
                onChange={(e) => setDiameter(Number(e.target.value))}
                className="input-industrial w-full"
              />
            </div>
            <div>
              <label className="label-industrial block mb-2">Kesme Derinliği (mm)</label>
              <input
                type="number"
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
                className="input-industrial w-full"
                step="0.1"
              />
            </div>
          </div>

          <div className="p-4 rounded-lg bg-secondary/30 border border-border">
            <h3 className="label-industrial mb-3">Başlangıç Konumu</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">X (mm)</label>
                <input
                  type="number"
                  value={startX}
                  onChange={(e) => setStartX(Number(e.target.value))}
                  className="input-industrial w-full"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Y (mm)</label>
                <input
                  type="number"
                  value={startY}
                  onChange={(e) => setStartY(Number(e.target.value))}
                  className="input-industrial w-full"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Uzunluk (mm)</label>
                <input
                  type="number"
                  value={length}
                  onChange={(e) => setLength(Number(e.target.value))}
                  className="input-industrial w-full"
                />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border cursor-pointer">
            <input
              type="checkbox"
              checked={coolant}
              onChange={(e) => setCoolant(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-foreground">Soğutma Sıvısı (M08/M09)</span>
          </label>

          {/* Calculated Values */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-card border border-border">
              <span className="text-xs text-muted-foreground">Devir</span>
              <div className="font-mono text-xl text-primary">{calculations.spindleSpeed} <span className="text-xs text-muted-foreground">dev/dk</span></div>
            </div>
            <div className="p-3 rounded-lg bg-card border border-border">
              <span className="text-xs text-muted-foreground">İlerleme</span>
              <div className="font-mono text-xl text-accent">{calculations.tableFeed} <span className="text-xs text-muted-foreground">mm/dk</span></div>
            </div>
          </div>
        </div>

        {/* G-Code Preview */}
        <div className="bg-[#1a1a2e] rounded-lg border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-[#16162a] border-b border-border">
            <span className="text-xs text-muted-foreground font-mono">program.nc</span>
            <span className="text-xs text-success">● Hazır</span>
          </div>
          <pre className="p-4 text-sm font-mono text-green-400 overflow-auto max-h-[500px] whitespace-pre">
            {gcode}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default GCodeGenerator;
