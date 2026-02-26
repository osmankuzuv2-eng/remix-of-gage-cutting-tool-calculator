
-- Add subtitle_languages and pdf_docs to training_videos
ALTER TABLE public.training_videos
  ADD COLUMN IF NOT EXISTS subtitle_languages TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pdf_docs JSONB DEFAULT '[]';

-- Create video_notes table for timestamped notes
CREATE TABLE IF NOT EXISTS public.video_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.training_videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  timestamp_seconds INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.video_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own video notes"
ON public.video_notes FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own video notes"
ON public.video_notes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own video notes"
ON public.video_notes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can update own video notes"
ON public.video_notes FOR UPDATE USING (auth.uid() = user_id);
