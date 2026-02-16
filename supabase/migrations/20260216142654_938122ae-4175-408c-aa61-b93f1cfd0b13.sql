
-- Create machines table
CREATE TABLE public.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('turning', 'milling-3axis', 'milling-4axis', 'milling-5axis')),
  designation text NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  year integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  max_diameter_mm integer,
  power_kw numeric,
  max_rpm integer DEFAULT 4500,
  taper text,
  has_live_tooling boolean DEFAULT false,
  has_y_axis boolean DEFAULT false,
  has_c_axis boolean DEFAULT false,
  travel_x_mm integer,
  travel_y_mm integer,
  travel_z_mm integer,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

-- Everyone can read active machines
CREATE POLICY "Anyone can view machines"
  ON public.machines FOR SELECT
  USING (true);

-- Only admins can manage machines
CREATE POLICY "Admins can insert machines"
  ON public.machines FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update machines"
  ON public.machines FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete machines"
  ON public.machines FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_machines_updated_at
  BEFORE UPDATE ON public.machines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
