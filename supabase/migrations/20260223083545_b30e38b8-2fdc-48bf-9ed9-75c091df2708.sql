
-- Allow all authenticated users to read quiz results for leaderboard
CREATE POLICY "Users can read all quiz results for leaderboard"
ON public.quiz_results
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Drop the old restrictive select policy
DROP POLICY IF EXISTS "Users can view their own quiz results" ON public.quiz_results;
