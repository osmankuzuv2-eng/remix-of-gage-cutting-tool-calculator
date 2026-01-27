import { Info } from "lucide-react";

interface InfoPanelContentProps {
  title: string;
  description: string;
  formula: string;
  metrics: { label: string; value: string }[];
  useCases: string[];
  statusInfo?: {
    value: number;
    thresholds: { min: number; label: string; color: string }[];
  };
  tip?: string;
}

const InfoPanelContent = ({ title, description, formula, metrics, useCases, statusInfo, tip }: InfoPanelContentProps) => {
  const getStatus = () => {
    if (!statusInfo) return null;
    for (const threshold of statusInfo.thresholds) {
      if (statusInfo.value >= threshold.min) {
        return threshold;
      }
    }
    return statusInfo.thresholds[statusInfo.thresholds.length - 1];
  };

  const status = getStatus();

  return (
    <div className="p-4 rounded-lg bg-accent/10 border border-accent/30 space-y-3 animate-fade-in">
      <div className="flex items-center gap-2 text-accent">
        <Info className="w-5 h-5" />
        <span className="font-semibold">{title}</span>
      </div>
      
      <p className="text-sm text-muted-foreground">{description}</p>

      {status && (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${status.color} bg-current/10`}>
          <span className={status.color}>{status.label}: %{statusInfo!.value}</span>
        </div>
      )}

      <div className="p-3 rounded-md bg-secondary/50 border border-border">
        <span className="text-xs text-muted-foreground">Formül:</span>
        <div className="font-mono text-lg text-primary mt-1">{formula}</div>
      </div>

      <div className={`grid gap-3 text-sm ${metrics.length > 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
        {metrics.map((metric, idx) => (
          <div key={idx} className="p-2 rounded bg-card border border-border">
            <span className="text-xs text-muted-foreground block">{metric.label}</span>
            <span className="font-mono text-foreground">{metric.value}</span>
          </div>
        ))}
      </div>

      {tip && (
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
          <span className="text-sm text-primary">💡 {tip}</span>
        </div>
      )}

      <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
        <p><strong>Kullanım Alanları:</strong></p>
        <ul className="list-disc list-inside space-y-0.5 ml-2">
          {useCases.map((useCase, idx) => (
            <li key={idx}>{useCase}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default InfoPanelContent;
