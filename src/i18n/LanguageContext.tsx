import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Language, translations } from "./translations";
import { safeGetItem, safeSetItem } from "@/lib/safeStorage";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (section: string, key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANG_KEY = "cnc_language";

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLang] = useState<Language>(() => {
    const stored = safeGetItem<Language>(LANG_KEY, "tr");
    return (stored === "en" || stored === "fr") ? stored : "tr";
  });

  const setLanguage = useCallback((lang: Language) => {
    setLang(lang);
    safeSetItem(LANG_KEY, lang);
  }, []);

  const t = useCallback((section: string, key: string): string => {
    const sec = (translations as any)[section];
    if (!sec) return key;
    const entry = sec[key];
    if (!entry) return key;
    return entry[language] || entry["tr"] || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};

export const getTranslation = (language: Language, section: string, key: string): string => {
  const sec = (translations as any)[section];
  if (!sec) return key;
  const entry = sec[key];
  if (!entry) return key;
  return entry[language] || entry["tr"] || key;
};
