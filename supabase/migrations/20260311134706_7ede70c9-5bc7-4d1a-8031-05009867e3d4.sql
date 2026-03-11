
-- Create user presence table for online tracking
CREATE TABLE IF NOT EXISTS public.user_presence (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  last_seen timestamp with time zone NOT NULL DEFAULT now(),
  display_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view presence
CREATE POLICY "Authenticated users can view presence"
  ON public.user_presence FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Users can insert their own presence
CREATE POLICY "Users can insert own presence"
  ON public.user_presence FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own presence
CREATE POLICY "Users can update own presence"
  ON public.user_presence FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own presence
CREATE POLICY "Users can delete own presence"
  ON public.user_presence FOR DELETE
  USING (auth.uid() = user_id);

-- Enable realtime for presence table
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
