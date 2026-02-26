
CREATE TABLE IF NOT EXISTS public.training_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  operation_type TEXT NOT NULL DEFAULT 'other',
  difficulty TEXT NOT NULL DEFAULT 'beginner',
  duration_minutes INTEGER,
  author TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.training_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view training videos"
ON public.training_videos FOR SELECT
USING (true);

CREATE POLICY "Admins can insert training videos"
ON public.training_videos FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update training videos"
ON public.training_videos FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete training videos"
ON public.training_videos FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
