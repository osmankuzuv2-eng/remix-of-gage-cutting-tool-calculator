
-- Menu categories table
CREATE TABLE public.menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'FolderOpen',
  color text NOT NULL DEFAULT 'from-blue-500 to-blue-700',
  bg_color text NOT NULL DEFAULT 'bg-blue-500/10',
  text_color text NOT NULL DEFAULT 'text-blue-400',
  border_color text NOT NULL DEFAULT 'border-blue-500/30',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Menu category modules (which module belongs to which category)
CREATE TABLE public.menu_category_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(module_key)
);

-- Enable RLS
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_category_modules ENABLE ROW LEVEL SECURITY;

-- Everyone can read menu config (needed for navigation)
CREATE POLICY "Anyone can view menu categories"
ON public.menu_categories FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Anyone can view menu category modules"
ON public.menu_category_modules FOR SELECT
TO authenticated
USING (true);

-- Only admins can modify
CREATE POLICY "Admins can insert menu categories"
ON public.menu_categories FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update menu categories"
ON public.menu_categories FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete menu categories"
ON public.menu_categories FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert menu category modules"
ON public.menu_category_modules FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update menu category modules"
ON public.menu_category_modules FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete menu category modules"
ON public.menu_category_modules FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_menu_categories_updated_at
BEFORE UPDATE ON public.menu_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default categories
INSERT INTO public.menu_categories (id, name, icon, color, bg_color, text_color, border_color, sort_order) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'AI & Analiz', 'Cpu', 'from-violet-500 to-purple-700', 'bg-violet-500/10', 'text-violet-400', 'border-violet-500/30', 0),
  ('a1000000-0000-0000-0000-000000000002', 'İşleme', 'Wrench', 'from-orange-500 to-amber-700', 'bg-orange-500/10', 'text-orange-400', 'border-orange-500/30', 1),
  ('a1000000-0000-0000-0000-000000000003', 'Maliyet & Karşılaştırma', 'BarChart3', 'from-emerald-500 to-green-700', 'bg-emerald-500/10', 'text-emerald-400', 'border-emerald-500/30', 2),
  ('a1000000-0000-0000-0000-000000000004', 'Veri', 'FolderOpen', 'from-sky-500 to-blue-700', 'bg-sky-500/10', 'text-sky-400', 'border-sky-500/30', 3);

-- Insert default module assignments
INSERT INTO public.menu_category_modules (category_id, module_key, sort_order) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'ai-learn', 0),
  ('a1000000-0000-0000-0000-000000000001', 'drawing', 1),
  ('a1000000-0000-0000-0000-000000000002', 'cutting', 0),
  ('a1000000-0000-0000-0000-000000000002', 'toollife', 1),
  ('a1000000-0000-0000-0000-000000000002', 'threading', 2),
  ('a1000000-0000-0000-0000-000000000002', 'drilling', 3),
  ('a1000000-0000-0000-0000-000000000002', 'tolerance', 4),
  ('a1000000-0000-0000-0000-000000000003', 'costcalc', 0),
  ('a1000000-0000-0000-0000-000000000003', 'cost', 1),
  ('a1000000-0000-0000-0000-000000000003', 'compare', 2),
  ('a1000000-0000-0000-0000-000000000004', 'materials', 0),
  ('a1000000-0000-0000-0000-000000000004', 'history', 1);
