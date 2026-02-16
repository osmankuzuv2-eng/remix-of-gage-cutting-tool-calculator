
-- Add multi-language name columns to menu_categories
ALTER TABLE public.menu_categories ADD COLUMN name_en text;
ALTER TABLE public.menu_categories ADD COLUMN name_fr text;

-- Update existing categories with translations
UPDATE public.menu_categories SET name_en = 'AI & Analysis', name_fr = 'IA & Analyse' WHERE name = 'AI & Analiz';
UPDATE public.menu_categories SET name_en = 'Machining', name_fr = 'Usinage' WHERE name = 'İşleme';
UPDATE public.menu_categories SET name_en = 'Cost & Comparison', name_fr = 'Coût & Comparaison' WHERE name = 'Maliyet & Karşılaştırma';
UPDATE public.menu_categories SET name_en = 'Data', name_fr = 'Données' WHERE name = 'Veri';
