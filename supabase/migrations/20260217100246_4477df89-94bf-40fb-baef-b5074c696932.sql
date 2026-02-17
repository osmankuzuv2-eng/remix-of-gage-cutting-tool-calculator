
ALTER TABLE public.analysis_feedback
ADD COLUMN reviewed_by uuid DEFAULT NULL,
ADD COLUMN reviewed_at timestamptz DEFAULT NULL;
