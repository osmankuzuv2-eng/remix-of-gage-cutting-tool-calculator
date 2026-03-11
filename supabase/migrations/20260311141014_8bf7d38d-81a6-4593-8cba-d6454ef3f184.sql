
-- Chat channels table
CREATE TABLE public.chat_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  color text DEFAULT '#6366f1',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view channels"
  ON public.chat_channels FOR SELECT TO public
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage channels"
  ON public.chat_channels FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add channel_id to chat_messages
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS channel_id uuid REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- Auto-cleanup function: delete messages older than 30 days
CREATE OR REPLACE FUNCTION public.cleanup_old_chat_messages()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.chat_messages
  WHERE created_at < now() - interval '30 days';
$$;

-- Insert default channels
INSERT INTO public.chat_channels (name, description, color, sort_order) VALUES
  ('genel', 'Genel sohbet kanalı', '#6366f1', 1),
  ('duyurular', 'Önemli duyurular ve bilgiler', '#f59e0b', 2),
  ('teknik', 'Teknik sorular ve tartışmalar', '#10b981', 3),
  ('kesme-parametreleri', 'Kesme parametreleri hakkında', '#3b82f6', 4),
  ('random', 'Gündelik sohbet', '#ec4899', 5);
