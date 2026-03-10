
-- Insert CMM menu category
INSERT INTO public.menu_categories (id, name, name_en, name_fr, icon, color, bg_color, text_color, border_color, sort_order)
VALUES (
  gen_random_uuid(),
  'CMM',
  'CMM',
  'CMM',
  'Crosshair',
  'from-cyan-500 to-cyan-700',
  'bg-cyan-500/10',
  'text-cyan-400',
  'border-cyan-500/30',
  99
);

-- Insert module translation for balloon-drawing
INSERT INTO public.module_translations (module_key, name_tr, name_en, name_fr)
VALUES ('balloon-drawing', 'Balonlu Teknik Resim', 'Ballooned Drawing', 'Dessin Balonné')
ON CONFLICT (module_key) DO UPDATE SET
  name_tr = EXCLUDED.name_tr,
  name_en = EXCLUDED.name_en,
  name_fr = EXCLUDED.name_fr;

-- Insert the module into the CMM category
INSERT INTO public.menu_category_modules (category_id, module_key, sort_order)
SELECT c.id, 'balloon-drawing', 1
FROM public.menu_categories c
WHERE c.name = 'CMM'
LIMIT 1;
