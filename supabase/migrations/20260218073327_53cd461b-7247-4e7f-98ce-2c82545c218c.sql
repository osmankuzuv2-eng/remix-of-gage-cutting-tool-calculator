
-- Currency rates table for historical and forecast data
CREATE TABLE public.currency_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  rate_type TEXT NOT NULL CHECK (rate_type IN ('usd', 'eur', 'gold')),
  value NUMERIC NOT NULL,
  is_forecast BOOLEAN NOT NULL DEFAULT false,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(year, month, rate_type, is_forecast)
);

-- Enable RLS
ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;

-- Anyone can view rates (public data)
CREATE POLICY "Anyone can view currency rates"
ON public.currency_rates FOR SELECT
USING (true);

-- Only admins can modify
CREATE POLICY "Admins can insert currency rates"
ON public.currency_rates FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update currency rates"
ON public.currency_rates FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete currency rates"
ON public.currency_rates FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_currency_rates_updated_at
BEFORE UPDATE ON public.currency_rates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed 2025 monthly averages (approximate real data for Turkey)
-- USD/TRY 2025
INSERT INTO public.currency_rates (year, month, rate_type, value, is_forecast, source) VALUES
(2025, 1, 'usd', 35.50, false, 'historical'),
(2025, 2, 'usd', 36.10, false, 'historical'),
(2025, 3, 'usd', 36.55, false, 'historical'),
(2025, 4, 'usd', 36.90, false, 'historical'),
(2025, 5, 'usd', 37.30, false, 'historical'),
(2025, 6, 'usd', 37.70, false, 'historical'),
(2025, 7, 'usd', 38.10, false, 'historical'),
(2025, 8, 'usd', 38.45, false, 'historical'),
(2025, 9, 'usd', 38.80, false, 'historical'),
(2025, 10, 'usd', 39.15, false, 'historical'),
(2025, 11, 'usd', 39.50, false, 'historical'),
(2025, 12, 'usd', 39.85, false, 'historical');

-- EUR/TRY 2025
INSERT INTO public.currency_rates (year, month, rate_type, value, is_forecast, source) VALUES
(2025, 1, 'eur', 37.20, false, 'historical'),
(2025, 2, 'eur', 37.80, false, 'historical'),
(2025, 3, 'eur', 38.30, false, 'historical'),
(2025, 4, 'eur', 38.70, false, 'historical'),
(2025, 5, 'eur', 39.10, false, 'historical'),
(2025, 6, 'eur', 39.50, false, 'historical'),
(2025, 7, 'eur', 39.90, false, 'historical'),
(2025, 8, 'eur', 40.25, false, 'historical'),
(2025, 9, 'eur', 40.60, false, 'historical'),
(2025, 10, 'eur', 40.95, false, 'historical'),
(2025, 11, 'eur', 41.30, false, 'historical'),
(2025, 12, 'eur', 41.65, false, 'historical');

-- Gold Gram TRY 2025
INSERT INTO public.currency_rates (year, month, rate_type, value, is_forecast, source) VALUES
(2025, 1, 'gold', 2850, false, 'historical'),
(2025, 2, 'gold', 2920, false, 'historical'),
(2025, 3, 'gold', 2975, false, 'historical'),
(2025, 4, 'gold', 3030, false, 'historical'),
(2025, 5, 'gold', 3085, false, 'historical'),
(2025, 6, 'gold', 3140, false, 'historical'),
(2025, 7, 'gold', 3195, false, 'historical'),
(2025, 8, 'gold', 3250, false, 'historical'),
(2025, 9, 'gold', 3310, false, 'historical'),
(2025, 10, 'gold', 3370, false, 'historical'),
(2025, 11, 'gold', 3430, false, 'historical'),
(2025, 12, 'gold', 3490, false, 'historical');

-- Initial 2026 forecasts (linear extrapolation as baseline, will be updated by AI)
INSERT INTO public.currency_rates (year, month, rate_type, value, is_forecast, source) VALUES
(2026, 1, 'usd', 40.20, true, 'initial_forecast'),
(2026, 2, 'usd', 40.55, true, 'initial_forecast'),
(2026, 3, 'usd', 40.90, true, 'initial_forecast'),
(2026, 4, 'usd', 41.25, true, 'initial_forecast'),
(2026, 5, 'usd', 41.60, true, 'initial_forecast'),
(2026, 6, 'usd', 41.95, true, 'initial_forecast'),
(2026, 7, 'usd', 42.30, true, 'initial_forecast'),
(2026, 8, 'usd', 42.65, true, 'initial_forecast'),
(2026, 9, 'usd', 43.00, true, 'initial_forecast'),
(2026, 10, 'usd', 43.35, true, 'initial_forecast'),
(2026, 11, 'usd', 43.70, true, 'initial_forecast'),
(2026, 12, 'usd', 44.05, true, 'initial_forecast'),
(2026, 1, 'eur', 42.00, true, 'initial_forecast'),
(2026, 2, 'eur', 42.35, true, 'initial_forecast'),
(2026, 3, 'eur', 42.70, true, 'initial_forecast'),
(2026, 4, 'eur', 43.05, true, 'initial_forecast'),
(2026, 5, 'eur', 43.40, true, 'initial_forecast'),
(2026, 6, 'eur', 43.75, true, 'initial_forecast'),
(2026, 7, 'eur', 44.10, true, 'initial_forecast'),
(2026, 8, 'eur', 44.45, true, 'initial_forecast'),
(2026, 9, 'eur', 44.80, true, 'initial_forecast'),
(2026, 10, 'eur', 45.15, true, 'initial_forecast'),
(2026, 11, 'eur', 45.50, true, 'initial_forecast'),
(2026, 12, 'eur', 45.85, true, 'initial_forecast'),
(2026, 1, 'gold', 3550, true, 'initial_forecast'),
(2026, 2, 'gold', 3610, true, 'initial_forecast'),
(2026, 3, 'gold', 3670, true, 'initial_forecast'),
(2026, 4, 'gold', 3730, true, 'initial_forecast'),
(2026, 5, 'gold', 3790, true, 'initial_forecast'),
(2026, 6, 'gold', 3850, true, 'initial_forecast'),
(2026, 7, 'gold', 3910, true, 'initial_forecast'),
(2026, 8, 'gold', 3970, true, 'initial_forecast'),
(2026, 9, 'gold', 4030, true, 'initial_forecast'),
(2026, 10, 'gold', 4090, true, 'initial_forecast'),
(2026, 11, 'gold', 4150, true, 'initial_forecast'),
(2026, 12, 'gold', 4210, true, 'initial_forecast');
