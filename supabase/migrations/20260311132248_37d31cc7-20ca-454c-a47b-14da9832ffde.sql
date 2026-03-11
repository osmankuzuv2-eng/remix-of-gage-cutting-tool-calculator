
CREATE OR REPLACE FUNCTION public.get_all_login_logs()
RETURNS TABLE(
  id uuid,
  user_id uuid,
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
    (ale.payload->>'actor_id')::uuid AS user_id,
    ale.created_at,
    ale.ip_address::text,
    (ale.payload->>'user_agent')::text
  FROM auth.audit_log_entries ale
  WHERE ale.payload->>'action' = 'login'
    AND ale.payload->>'actor_id' IS NOT NULL
    AND ale.payload->>'actor_id' != '00000000-0000-0000-0000-000000000000'
  ORDER BY ale.created_at DESC
  LIMIT 10;
$$;
