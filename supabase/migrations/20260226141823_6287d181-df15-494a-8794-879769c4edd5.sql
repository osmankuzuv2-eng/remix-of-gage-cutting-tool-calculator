
CREATE TABLE IF NOT EXISTS public.toolroom_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  factory TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  supplier TEXT NOT NULL,
  tool_type TEXT NOT NULL,
  tool_code TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.toolroom_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view toolroom purchases"
ON public.toolroom_purchases FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert toolroom purchases"
ON public.toolroom_purchases FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update toolroom purchases"
ON public.toolroom_purchases FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete toolroom purchases"
ON public.toolroom_purchases FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
