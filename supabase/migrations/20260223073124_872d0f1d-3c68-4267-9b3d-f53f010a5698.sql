
CREATE TABLE public.quiz_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  level TEXT NOT NULL,
  topic TEXT,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  passed BOOLEAN NOT NULL DEFAULT false,
  questions JSONB,
  answers JSONB,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own quiz results"
ON public.quiz_results FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quiz results"
ON public.quiz_results FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_quiz_results_user_id ON public.quiz_results(user_id);
CREATE INDEX idx_quiz_results_created_at ON public.quiz_results(created_at DESC);
