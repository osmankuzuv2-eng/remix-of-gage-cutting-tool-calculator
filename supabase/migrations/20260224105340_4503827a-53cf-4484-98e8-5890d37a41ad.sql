
-- Add created_by_name to track who created each improvement record
ALTER TABLE public.time_improvements
  ADD COLUMN IF NOT EXISTS created_by_name text;

-- Update existing records with a placeholder
UPDATE public.time_improvements SET created_by_name = 'Sistem' WHERE created_by_name IS NULL;
