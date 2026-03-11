
CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_by_sender boolean NOT NULL DEFAULT false,
  deleted_by_receiver boolean NOT NULL DEFAULT false
);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their DMs"
  ON public.direct_messages FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = sender_id AND deleted_by_sender = false)
    OR
    (auth.uid() = receiver_id AND deleted_by_receiver = false)
  );

CREATE POLICY "Users can insert DMs"
  ON public.direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their own DM flags"
  ON public.direct_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
