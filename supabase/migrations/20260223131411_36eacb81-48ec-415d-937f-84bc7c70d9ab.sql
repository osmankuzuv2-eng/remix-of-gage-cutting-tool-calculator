-- Allow admins to delete any quiz results
CREATE POLICY "Admins can delete all quiz results"
ON public.quiz_results
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Allow users to delete their own quiz results
CREATE POLICY "Users can delete their own quiz results"
ON public.quiz_results
FOR DELETE
USING (auth.uid() = user_id);