CREATE OR REPLACE FUNCTION public.get_profile_by_email(p_email text)
RETURNS TABLE(display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.display_name, p.avatar_url
  FROM public.profiles p
  INNER JOIN auth.users u ON u.id = p.user_id
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;
$$;