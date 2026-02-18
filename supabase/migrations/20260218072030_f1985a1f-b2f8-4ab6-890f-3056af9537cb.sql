
-- Create material_settings table for persisting prices and multipliers
CREATE TABLE public.material_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id TEXT NOT NULL UNIQUE,
  price_per_kg NUMERIC DEFAULT 0,
  afk_multiplier NUMERIC DEFAULT 1.0,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.material_settings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view
CREATE POLICY "Authenticated users can view material settings"
ON public.material_settings FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only admins can insert
CREATE POLICY "Admins can insert material settings"
ON public.material_settings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update
CREATE POLICY "Admins can update material settings"
ON public.material_settings FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete
CREATE POLICY "Admins can delete material settings"
ON public.material_settings FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_material_settings_updated_at
BEFORE UPDATE ON public.material_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
