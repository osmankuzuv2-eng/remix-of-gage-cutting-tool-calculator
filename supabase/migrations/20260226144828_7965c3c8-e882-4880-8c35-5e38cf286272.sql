
CREATE TABLE public.toolroom_consumptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  factory TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  supplier TEXT NOT NULL,
  tool_type TEXT NOT NULL,
  tool_code TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.toolroom_consumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view consumptions"
  ON public.toolroom_consumptions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert consumptions"
  ON public.toolroom_consumptions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins can delete consumptions"
  ON public.toolroom_consumptions FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE TRIGGER update_toolroom_consumptions_updated_at
  BEFORE UPDATE ON public.toolroom_consumptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
