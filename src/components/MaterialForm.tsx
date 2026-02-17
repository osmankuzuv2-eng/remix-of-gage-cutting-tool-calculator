import { useState } from "react";
import { Plus, X, Save } from "lucide-react";
import { Material } from "@/data/materials";
import { useLanguage } from "@/i18n/LanguageContext";

interface MaterialFormProps {
  onAddMaterial: (material: Material) => void;
  onClose: () => void;
}

const MaterialForm = ({ onAddMaterial, onClose }: MaterialFormProps) => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: "", category: "", hardness: "",
    cuttingSpeedMin: 100, cuttingSpeedMax: 200,
    feedRateMin: 0.1, feedRateMax: 0.3,
    taylorN: 0.2, taylorC: 250,
    pricePerKg: 0,
  });

  const colors = ["bg-blue-500", "bg-green-500", "bg-red-500", "bg-yellow-500", "bg-purple-500", "bg-orange-500", "bg-pink-500", "bg-cyan-500"];
  const [selectedColor, setSelectedColor] = useState(colors[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newMaterial: Material = {
      id: `custom-${Date.now()}`, name: formData.name, category: formData.category, hardness: formData.hardness,
      cuttingSpeed: { min: formData.cuttingSpeedMin, max: formData.cuttingSpeedMax, unit: "m/dk" },
      feedRate: { min: formData.feedRateMin, max: formData.feedRateMax, unit: "mm/dev" },
      taylorN: formData.taylorN, taylorC: formData.taylorC, density: 7.85, color: selectedColor,
      pricePerKg: formData.pricePerKg || undefined,
    };
    onAddMaterial(newMaterial);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="industrial-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/20"><Plus className="w-5 h-5 text-success" /></div>
            <h2 className="text-lg font-semibold text-foreground">{t("materialForm", "title")}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label-industrial block mb-2">{t("materialForm", "name")}</label>
              <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-industrial w-full" placeholder={t("materialForm", "namePlaceholder")} />
            </div>
            <div>
              <label className="label-industrial block mb-2">{t("materialForm", "category")}</label>
              <input type="text" required value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="input-industrial w-full" placeholder={t("materialForm", "categoryPlaceholder")} />
            </div>
            <div>
              <label className="label-industrial block mb-2">{t("materialForm", "hardness")}</label>
              <input type="text" required value={formData.hardness} onChange={(e) => setFormData({ ...formData, hardness: e.target.value })} className="input-industrial w-full" placeholder={t("materialForm", "hardnessPlaceholder")} />
            </div>
            <div className="col-span-2">
              <label className="label-industrial block mb-2">{t("materialForm", "pricePerKg")}</label>
              <input type="number" step="0.01" min="0" value={formData.pricePerKg} onChange={(e) => setFormData({ ...formData, pricePerKg: Number(e.target.value) })} className="input-industrial w-full" placeholder="EUR/kg" />
            </div>
          </div>

          <div className="p-4 rounded-lg bg-secondary/30 border border-border">
            <h3 className="label-industrial mb-3">{t("materialForm", "cuttingSpeedRange")}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">{t("materialForm", "min")}</label>
                <input type="number" required value={formData.cuttingSpeedMin} onChange={(e) => setFormData({ ...formData, cuttingSpeedMin: Number(e.target.value) })} className="input-industrial w-full" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("materialForm", "max")}</label>
                <input type="number" required value={formData.cuttingSpeedMax} onChange={(e) => setFormData({ ...formData, cuttingSpeedMax: Number(e.target.value) })} className="input-industrial w-full" />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-secondary/30 border border-border">
            <h3 className="label-industrial mb-3">{t("materialForm", "feedRateRange")}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">{t("materialForm", "min")}</label>
                <input type="number" step="0.01" required value={formData.feedRateMin} onChange={(e) => setFormData({ ...formData, feedRateMin: Number(e.target.value) })} className="input-industrial w-full" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("materialForm", "max")}</label>
                <input type="number" step="0.01" required value={formData.feedRateMax} onChange={(e) => setFormData({ ...formData, feedRateMax: Number(e.target.value) })} className="input-industrial w-full" />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-secondary/30 border border-border">
            <h3 className="label-industrial mb-3">{t("materialForm", "taylorConstants")}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">n</label>
                <input type="number" step="0.01" required value={formData.taylorN} onChange={(e) => setFormData({ ...formData, taylorN: Number(e.target.value) })} className="input-industrial w-full" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">C</label>
                <input type="number" required value={formData.taylorC} onChange={(e) => setFormData({ ...formData, taylorC: Number(e.target.value) })} className="input-industrial w-full" />
              </div>
            </div>
          </div>

          <div>
            <label className="label-industrial block mb-2">{t("materialForm", "color")}</label>
            <div className="flex gap-2 flex-wrap">
              {colors.map((color) => (
                <button key={color} type="button" onClick={() => setSelectedColor(color)}
                  className={`w-8 h-8 rounded-full ${color} ${selectedColor === color ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`} />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border hover:bg-secondary transition-colors">{t("common", "cancel")}</button>
            <button type="submit" className="flex-1 btn-primary flex items-center justify-center gap-2">
              <Save className="w-4 h-4" />{t("common", "save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MaterialForm;
