
CREATE TABLE public.factory_revenues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  factory TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  revenue NUMERIC NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(factory, year, month)
);

ALTER TABLE public.factory_revenues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view factory revenues"
  ON public.factory_revenues FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert factory revenues"
  ON public.factory_revenues FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update factory revenues"
  ON public.factory_revenues FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete factory revenues"
  ON public.factory_revenues FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE TRIGGER update_factory_revenues_updated_at
  BEFORE UPDATE ON public.factory_revenues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
