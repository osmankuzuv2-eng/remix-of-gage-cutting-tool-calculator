
CREATE TABLE public.time_improvements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reference_code TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  machine_id UUID REFERENCES public.machines(id),
  machine_name TEXT,
  part_name TEXT NOT NULL,
  operation_type TEXT NOT NULL DEFAULT 'turning',
  old_time_minutes NUMERIC NOT NULL,
  new_time_minutes NUMERIC NOT NULL,
  improvement_percent NUMERIC GENERATED ALWAYS AS (
    CASE WHEN old_time_minutes > 0 THEN ROUND(((old_time_minutes - new_time_minutes) / old_time_minutes) * 100, 2) ELSE 0 END
  ) STORED,
  improvement_details TEXT,
  tool_changes TEXT,
  parameter_changes TEXT,
  notes TEXT,
  improvement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.time_improvements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view time improvements"
  ON public.time_improvements FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert time improvements"
  ON public.time_improvements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own or admin can update"
  ON public.time_improvements FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users can delete own or admin can delete"
  ON public.time_improvements FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_time_improvements_updated_at
  BEFORE UPDATE ON public.time_improvements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
