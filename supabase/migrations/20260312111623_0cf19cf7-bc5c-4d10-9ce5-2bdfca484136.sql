
-- User Activity Logs Table
CREATE TABLE public.user_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  display_name TEXT,
  module_key TEXT NOT NULL,
  module_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view activity logs"
  ON public.user_activity_logs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own activity logs"
  ON public.user_activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can delete activity logs"
  ON public.user_activity_logs FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Meeting Rooms Table
CREATE TABLE public.meeting_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  room_number INTEGER NOT NULL,
  owner_id UUID,
  owner_name TEXT,
  password TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  participant_count INTEGER NOT NULL DEFAULT 0,
  max_participants INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view meeting rooms"
  ON public.meeting_rooms FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update meeting rooms"
  ON public.meeting_rooms FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert meeting rooms"
  ON public.meeting_rooms FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Meeting Participants Table
CREATE TABLE public.meeting_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.meeting_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  display_name TEXT,
  is_audio_muted BOOLEAN NOT NULL DEFAULT false,
  is_video_off BOOLEAN NOT NULL DEFAULT false,
  is_admin_muted BOOLEAN NOT NULL DEFAULT false,
  is_admin_video_off BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_heartbeat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view meeting participants"
  ON public.meeting_participants FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own participation"
  ON public.meeting_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own or owner can update"
  ON public.meeting_participants FOR UPDATE
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.meeting_rooms mr
    WHERE mr.id = room_id AND mr.owner_id = auth.uid()
  ));

CREATE POLICY "Users can delete own or owner can delete"
  ON public.meeting_participants FOR DELETE
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.meeting_rooms mr
    WHERE mr.id = room_id AND mr.owner_id = auth.uid()
  ));

-- Meeting Signals Table (WebRTC signaling)
CREATE TABLE public.meeting_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL,
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  signal_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view meeting signals"
  ON public.meeting_signals FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert meeting signals"
  ON public.meeting_signals FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Authenticated users can delete meeting signals"
  ON public.meeting_signals FOR DELETE
  USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_signals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_activity_logs;

-- Trigger for meeting_rooms updated_at
CREATE TRIGGER update_meeting_rooms_updated_at
  BEFORE UPDATE ON public.meeting_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default meeting rooms
INSERT INTO public.meeting_rooms (name, room_number, is_active) VALUES
  ('Toplantı Odası 1', 1, true),
  ('Toplantı Odası 2', 2, true),
  ('Toplantı Odası 3', 3, true),
  ('Toplantı Odası 4', 4, true);
