
-- 1. Factories table
CREATE TABLE public.factories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.factories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view factories" ON public.factories FOR SELECT USING (true);
CREATE POLICY "Admins can insert factories" ON public.factories FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update factories" ON public.factories FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete factories" ON public.factories FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_factories_updated_at BEFORE UPDATE ON public.factories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default factories
INSERT INTO public.factories (name, sort_order) VALUES ('Havacılık', 0), ('Raylı Sistemler', 1);

-- 2. Admin panel permissions table
CREATE TABLE public.admin_panel_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  panel_key text NOT NULL,
  can_view boolean NOT NULL DEFAULT true,
  can_edit boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, panel_key)
);

ALTER TABLE public.admin_panel_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own admin permissions" ON public.admin_panel_permissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all admin permissions" ON public.admin_panel_permissions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert admin permissions" ON public.admin_panel_permissions FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update admin permissions" ON public.admin_panel_permissions FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete admin permissions" ON public.admin_panel_permissions FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Grant full permissions to the two specified users
INSERT INTO public.admin_panel_permissions (user_id, panel_key, can_view, can_edit) VALUES
  ('14158990-3445-43be-ae4c-0a40bf0d806d', 'admin_users', true, true),
  ('14158990-3445-43be-ae4c-0a40bf0d806d', 'admin_customers', true, true),
  ('14158990-3445-43be-ae4c-0a40bf0d806d', 'admin_machines', true, true),
  ('14158990-3445-43be-ae4c-0a40bf0d806d', 'admin_menu', true, true),
  ('14158990-3445-43be-ae4c-0a40bf0d806d', 'admin_feedback', true, true),
  ('14158990-3445-43be-ae4c-0a40bf0d806d', 'admin_factories', true, true),
  ('4fe94fdf-cd3a-438a-a7fa-1d99446cdd5b', 'admin_users', true, true),
  ('4fe94fdf-cd3a-438a-a7fa-1d99446cdd5b', 'admin_customers', true, true),
  ('4fe94fdf-cd3a-438a-a7fa-1d99446cdd5b', 'admin_machines', true, true),
  ('4fe94fdf-cd3a-438a-a7fa-1d99446cdd5b', 'admin_menu', true, true),
  ('4fe94fdf-cd3a-438a-a7fa-1d99446cdd5b', 'admin_feedback', true, true),
  ('4fe94fdf-cd3a-438a-a7fa-1d99446cdd5b', 'admin_factories', true, true);
