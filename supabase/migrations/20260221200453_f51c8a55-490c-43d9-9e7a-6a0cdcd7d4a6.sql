
-- Bakım kayıtları tablosu (Tam kapsamlı)
CREATE TABLE public.maintenance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  maintenance_type TEXT NOT NULL DEFAULT 'preventive', -- 'preventive', 'predictive', 'corrective'
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planned', -- 'planned', 'in_progress', 'completed', 'cancelled'
  priority TEXT NOT NULL DEFAULT 'normal', -- 'low', 'normal', 'high', 'critical'
  technician_name TEXT,
  cost NUMERIC DEFAULT 0,
  duration_minutes NUMERIC DEFAULT 0,
  parts_used JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  scheduled_date DATE,
  completed_date TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view maintenance records"
  ON public.maintenance_records FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert maintenance records"
  ON public.maintenance_records FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update maintenance records"
  ON public.maintenance_records FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete maintenance records"
  ON public.maintenance_records FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_maintenance_records_updated_at
  BEFORE UPDATE ON public.maintenance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bakım zamanlamaları (Periyodik planlama: saat + tarih bazlı)
CREATE TABLE public.maintenance_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  maintenance_type TEXT NOT NULL DEFAULT 'preventive',
  interval_hours INTEGER, -- çalışma saati bazlı
  interval_days INTEGER, -- tarih bazlı
  last_performed_at TIMESTAMPTZ,
  last_performed_hours NUMERIC DEFAULT 0,
  current_hours NUMERIC DEFAULT 0,
  next_due_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  checklist JSONB DEFAULT '[]'::jsonb, -- [{item: "Yağlama", checked: false}, ...]
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view maintenance schedules"
  ON public.maintenance_schedules FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert maintenance schedules"
  ON public.maintenance_schedules FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update maintenance schedules"
  ON public.maintenance_schedules FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete maintenance schedules"
  ON public.maintenance_schedules FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_maintenance_schedules_updated_at
  BEFORE UPDATE ON public.maintenance_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bakım checklist kayıtları (tamamlanan checklist'ler)
CREATE TABLE public.maintenance_checklist_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.maintenance_schedules(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  completed_by UUID NOT NULL,
  completed_by_name TEXT,
  checklist_results JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{item: "Yağlama", checked: true, note: "OK"}, ...]
  completion_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_checklist_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view checklist logs"
  ON public.maintenance_checklist_logs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert checklist logs"
  ON public.maintenance_checklist_logs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete checklist logs"
  ON public.maintenance_checklist_logs FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
