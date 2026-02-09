
-- Storage bucket for technical drawings
INSERT INTO storage.buckets (id, name, public) VALUES ('technical-drawings', 'technical-drawings', true);

-- Allow authenticated users to upload
CREATE POLICY "Users can upload their own drawings"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'technical-drawings' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to view their own drawings
CREATE POLICY "Users can view their own drawings"
ON storage.objects FOR SELECT
USING (bucket_id = 'technical-drawings' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to delete their own drawings
CREATE POLICY "Users can delete their own drawings"
ON storage.objects FOR DELETE
USING (bucket_id = 'technical-drawings' AND auth.uid()::text = (storage.foldername(name))[1]);
