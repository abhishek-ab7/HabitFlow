-- Add salary payday_of_month (1..31) to finance_budgets for accurate cashflow forecasting
ALTER TABLE public.finance_budgets
  ADD COLUMN IF NOT EXISTS payday_of_month SMALLINT
  CHECK (payday_of_month IS NULL OR (payday_of_month >= 1 AND payday_of_month <= 31));
