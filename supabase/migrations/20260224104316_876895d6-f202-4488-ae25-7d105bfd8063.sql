
-- Add factory and price improvement fields to time_improvements
ALTER TABLE public.time_improvements
  ADD COLUMN IF NOT EXISTS factory text NOT NULL DEFAULT 'Havacılık',
  ADD COLUMN IF NOT EXISTS old_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_improvement_percent numeric GENERATED ALWAYS AS (
    CASE WHEN old_price > 0 THEN ROUND(((old_price - new_price) / old_price) * 100, 2) ELSE 0 END
  ) STORED;
