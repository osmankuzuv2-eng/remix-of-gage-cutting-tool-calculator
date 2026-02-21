import { useCoatings } from "@/hooks/useCoatings";
import { useLanguage } from "@/i18n/LanguageContext";
import { Shield, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const CoatingList = () => {
  const { t } = useLanguage();
  const { coatings, loading } = useCoatings();

  const activeCoatings = coatings.filter((c) => c.is_active);

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">{t("common", "loading")}</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-primary" />
        <h2 className="text-xl font-bold text-foreground">{t("coatings", "title")}</h2>
        <Badge variant="secondary" className="ml-auto">{activeCoatings.length} {t("coatings", "count")}</Badge>
      </div>

      {activeCoatings.length === 0 ? (
        <div className="text-center py-12">
          <Info className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">{t("coatings", "noCoatings")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("coatings", "addFromAdmin")}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activeCoatings.map((c) => (
            <div
              key={c.id}
              className="p-4 rounded-xl bg-secondary/20 border border-border hover:border-primary/30 transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-foreground">{c.name}</span>
                <Badge className="bg-primary/20 text-primary border-primary/30 font-mono">
                  €{c.price.toFixed(2)}
                </Badge>
              </div>
              {c.description && (
                <p className="text-xs text-muted-foreground leading-relaxed">{c.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CoatingList;
