CREATE OR REPLACE FUNCTION public.get_user_login_logs(p_user_id uuid)
RETURNS TABLE(
  id uuid,
  created_at timestamptz,
  ip_address text,
  user_agent text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ale.id,
    ale.created_at,
    ale.ip_address::text,
    (ale.payload->>'user_agent')::text
  FROM auth.audit_log_entries ale
  WHERE ale.payload->>'actor_id' = p_user_id::text
    AND ale.payload->>'action' = 'login'
  ORDER BY ale.created_at DESC
  LIMIT 10;
$$;