-- Add minute_rate column to machines table for per-machine cost rates
ALTER TABLE public.machines ADD COLUMN minute_rate numeric DEFAULT 0;

COMMENT ON COLUMN public.machines.minute_rate IS 'Machine cost rate per minute (EUR/dk)';