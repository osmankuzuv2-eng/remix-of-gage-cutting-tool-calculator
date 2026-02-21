
-- Create price change history table
CREATE TABLE public.material_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id TEXT NOT NULL,
  old_price NUMERIC,
  new_price NUMERIC,
  old_afk_multiplier NUMERIC,
  new_afk_multiplier NUMERIC,
  changed_by UUID NOT NULL,
  changed_by_name TEXT,
  change_type TEXT NOT NULL DEFAULT 'price',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.material_price_history ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view history
CREATE POLICY "Authenticated users can view price history"
  ON public.material_price_history FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins can insert (via trigger or direct)
CREATE POLICY "Admins can insert price history"
  ON public.material_price_history FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete old history
CREATE POLICY "Admins can delete price history"
  ON public.material_price_history FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for fast lookups
CREATE INDEX idx_material_price_history_material ON public.material_price_history (material_id, created_at DESC);
