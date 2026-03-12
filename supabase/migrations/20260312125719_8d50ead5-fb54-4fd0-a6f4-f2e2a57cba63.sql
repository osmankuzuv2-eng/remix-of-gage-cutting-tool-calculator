-- Allow admins to update (soft-delete) any chat message
CREATE POLICY "Admins can update any chat message"
  ON public.chat_messages
  FOR UPDATE
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Also allow the message owner to update their own message (for soft-delete)
CREATE POLICY "Users can update their own chat messages"
  ON public.chat_messages
  FOR UPDATE
  TO public
  USING (auth.uid() = user_id);
