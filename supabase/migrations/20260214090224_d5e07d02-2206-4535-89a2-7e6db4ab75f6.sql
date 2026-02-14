-- Create the bucket if it doesn't exist (it usually does but good to be sure)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('technical-drawings', 'technical-drawings', false)
ON CONFLICT (id) DO NOTHING;

-- Allow anonymous uploads to the 'anonymous/' folder in 'technical-drawings' bucket
CREATE POLICY "Allow anonymous uploads to anonymous folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'technical-drawings' AND 
  (storage.foldername(name))[1] = 'anonymous'
);

-- Allow public (including anonymous) to read signed URLs if they have the path
CREATE POLICY "Allow anyone to read from anonymous folder"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'technical-drawings' AND 
  (storage.foldername(name))[1] = 'anonymous'
);
