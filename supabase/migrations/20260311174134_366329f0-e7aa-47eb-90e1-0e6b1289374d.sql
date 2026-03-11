
CREATE POLICY "Authenticated users can view all display names"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);
