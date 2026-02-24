
-- Add images column to time_improvements
ALTER TABLE public.time_improvements ADD COLUMN images jsonb DEFAULT '[]'::jsonb;

-- Create storage bucket for time improvement images
INSERT INTO storage.buckets (id, name, public) VALUES ('time-improvement-images', 'time-improvement-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload time improvement images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'time-improvement-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view time improvement images"
ON storage.objects FOR SELECT
USING (bucket_id = 'time-improvement-images');

CREATE POLICY "Users can delete their own time improvement images"
ON storage.objects FOR DELETE
USING (bucket_id = 'time-improvement-images' AND auth.uid() IS NOT NULL);
