
-- Add photos column to maintenance_records
ALTER TABLE public.maintenance_records
ADD COLUMN photos JSONB DEFAULT '[]'::jsonb;
-- photos format: [{url: "...", type: "before"|"after", caption: "...", uploaded_at: "..."}]

-- Create storage bucket for maintenance photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('maintenance-photos', 'maintenance-photos', true);

-- Storage policies
CREATE POLICY "Anyone can view maintenance photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'maintenance-photos');

CREATE POLICY "Admins can upload maintenance photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'maintenance-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete maintenance photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'maintenance-photos' AND auth.uid() IS NOT NULL);
