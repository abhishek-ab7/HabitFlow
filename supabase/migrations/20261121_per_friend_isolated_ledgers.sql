-- Migration: Per-Friend Isolated Ledgers (Everyday Splits vs Long-Term Loans / EMIs)
-- Safely separates casual running tabs ('everyday_split') from formal loans ('long_term_loan') per friend.

ALTER TABLE public.debt_records
  ADD COLUMN IF NOT EXISTS bucket_type TEXT NOT NULL DEFAULT 'long_term_loan'
    CHECK (bucket_type IN ('everyday_split', 'long_term_loan')),
  ADD COLUMN IF NOT EXISTS is_emi BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS emi_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS emi_due_day INTEGER CHECK (emi_due_day BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS total_installments INTEGER CHECK (total_installments > 0),
  ADD COLUMN IF NOT EXISTS paid_installments INTEGER NOT NULL DEFAULT 0 CHECK (paid_installments >= 0);

CREATE INDEX IF NOT EXISTS idx_debt_records_user_bucket
  ON public.debt_records (user_id, bucket_type, status);
