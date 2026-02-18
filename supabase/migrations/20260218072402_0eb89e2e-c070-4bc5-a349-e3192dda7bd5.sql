
-- Module translations for multi-language module names
CREATE TABLE public.module_translations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_key TEXT NOT NULL UNIQUE,
  name_tr TEXT,
  name_en TEXT,
  name_fr TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.module_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view module translations"
ON public.module_translations FOR SELECT USING (true);

CREATE POLICY "Admins can insert module translations"
ON public.module_translations FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update module translations"
ON public.module_translations FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete module translations"
ON public.module_translations FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_module_translations_updated_at
BEFORE UPDATE ON public.module_translations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed existing modules with their current Turkish names from translations.ts
INSERT INTO public.module_translations (module_key, name_tr, name_en, name_fr) VALUES
  ('cutting', 'Kesme Hesaplama', 'Cutting Calculator', 'Calcul de coupe'),
  ('toollife', 'Takım Ömrü', 'Tool Life', 'Durée de vie outil'),
  ('threading', 'Diş Açma', 'Threading', 'Filetage'),
  ('drilling', 'Delme & Kılavuz', 'Drilling & Tapping', 'Perçage & Taraudage'),
  ('tolerance', 'Tolerans Rehberi', 'Tolerance Guide', 'Guide de tolérance'),
  ('costcalc', 'Maliyet Hesaplama', 'Cost Calculation', 'Calcul de coût'),
  ('cost', 'Maliyet Analizi', 'Cost Analysis', 'Analyse des coûts'),
  ('compare', 'Karşılaştırma', 'Comparison', 'Comparaison'),
  ('materials', 'Malzemeler', 'Materials', 'Matériaux'),
  ('history', 'Geçmiş', 'History', 'Historique'),
  ('ai-learn', 'AI Asistan', 'AI Assistant', 'Assistant IA'),
  ('drawing', 'Teknik Çizim Analizi', 'Drawing Analysis', 'Analyse de dessin'),
  ('afkprice', 'AFK Fiyat', 'AFK Price', 'Prix AFK')
ON CONFLICT (module_key) DO NOTHING;
