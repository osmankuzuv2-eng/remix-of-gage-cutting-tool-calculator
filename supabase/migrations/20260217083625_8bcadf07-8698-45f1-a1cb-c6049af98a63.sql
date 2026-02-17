
-- Create analysis_feedback table
CREATE TABLE public.analysis_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  part_name text NOT NULL,
  file_name text,
  original_analysis jsonb NOT NULL,
  feedback_text text NOT NULL,
  feedback_type text NOT NULL DEFAULT 'correction',
  status text NOT NULL DEFAULT 'pending',
  applied_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.analysis_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert their own feedback"
ON public.analysis_feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
CREATE POLICY "Users can view their own feedback"
ON public.analysis_feedback FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all feedback
CREATE POLICY "Admins can view all feedback"
ON public.analysis_feedback FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update feedback (approve/reject)
CREATE POLICY "Admins can update feedback"
ON public.analysis_feedback FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete feedback
CREATE POLICY "Admins can delete feedback"
ON public.analysis_feedback FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_analysis_feedback_updated_at
BEFORE UPDATE ON public.analysis_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
