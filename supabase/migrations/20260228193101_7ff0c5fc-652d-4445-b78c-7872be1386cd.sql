
CREATE TABLE public.rfq_quotes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  quote_number text NOT NULL,
  customer_id uuid REFERENCES public.customers(id),
  customer_name text NOT NULL,
  part_name text NOT NULL,
  material text,
  quantity integer NOT NULL DEFAULT 1,
  factory text NOT NULL DEFAULT 'Havacılık',
  status text NOT NULL DEFAULT 'draft',
  -- Cost breakdown
  material_cost numeric DEFAULT 0,
  machining_cost numeric DEFAULT 0,
  setup_cost numeric DEFAULT 0,
  coating_cost numeric DEFAULT 0,
  overhead_percent numeric DEFAULT 15,
  profit_margin numeric DEFAULT 20,
  manual_adjustment numeric DEFAULT 0,
  total_cost numeric DEFAULT 0,
  unit_price numeric DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  -- Details
  operations jsonb DEFAULT '[]'::jsonb,
  notes text,
  validity_days integer DEFAULT 30,
  delivery_days integer,
  due_date date,
  sent_at timestamp with time zone,
  approved_at timestamp with time zone,
  rejected_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.rfq_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own or admin all rfq"
  ON public.rfq_quotes FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own rfq"
  ON public.rfq_quotes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own or admin all rfq"
  ON public.rfq_quotes FOR UPDATE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete own or admin all rfq"
  ON public.rfq_quotes FOR DELETE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_rfq_quotes_updated_at
  BEFORE UPDATE ON public.rfq_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
