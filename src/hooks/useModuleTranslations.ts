import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

export interface ModuleTranslation {
  module_key: string;
  name_tr: string | null;
  name_en: string | null;
  name_fr: string | null;
}

export const useModuleTranslations = () => {
  const { language } = useLanguage();
  const [translations, setTranslations] = useState<ModuleTranslation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("module_translations")
      .select("module_key, name_tr, name_en, name_fr");
    if (data) setTranslations(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getModuleName = useCallback((moduleKey: string): string => {
    const found = translations.find((t) => t.module_key === moduleKey);
    if (!found) return moduleKey;
    const langKey = `name_${language}` as keyof ModuleTranslation;
    return (found[langKey] as string) || found.name_tr || found.name_en || moduleKey;
  }, [translations, language]);

  const upsertTranslation = useCallback(async (
    moduleKey: string,
    nameTr: string,
    nameEn: string,
    nameFr: string
  ) => {
    const { error } = await supabase
      .from("module_translations")
      .upsert(
        { module_key: moduleKey, name_tr: nameTr || null, name_en: nameEn || null, name_fr: nameFr || null },
        { onConflict: "module_key" }
      );
    if (!error) await load();
    return error;
  }, [load]);

  return { translations, loading, getModuleName, upsertTranslation, reload: load };
};
