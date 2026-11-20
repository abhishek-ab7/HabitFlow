-- =============================================================================
-- HabitFlow V2 + FlowFinance V3 Cloud Sync Migration
-- Adds missing Habit V2 flexible schedule & rest-day columns,
-- Multi-category split & zero-based budget columns, and Net Worth Snapshots.
-- Safe to run multiple times (idempotent IF NOT EXISTS guards).
-- =============================================================================

-- 1. HABITS TABLE: Flexible Scheduling & Cross-Domain Auto-Tracking
ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS frequency_type TEXT DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS scheduled_days INTEGER[],
  ADD COLUMN IF NOT EXISTS interval_days INTEGER,
  ADD COLUMN IF NOT EXISTS allow_bonus_completions BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS auto_track_rule TEXT;

-- Backfill frequency_type for legacy rows based on target_days
UPDATE public.habits
SET frequency_type = CASE
  WHEN COALESCE(target_days, 7) < 7 THEN 'weekly_flexible'
  ELSE 'daily'
END
WHERE frequency_type IS NULL;

-- 2. COMPLETIONS TABLE: Rest Day Status, Skipped Flag & Reason
ALTER TABLE public.completions
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS skipped BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rest_reason TEXT;

UPDATE public.completions
SET status = 'completed'
WHERE completed = TRUE AND status IS NULL;

UPDATE public.completions
SET status = 'rest'
WHERE skipped = TRUE AND status IS NULL;

-- 3. FINANCE TRANSACTIONS: Split Group Support
ALTER TABLE public.finance_transactions
  ADD COLUMN IF NOT EXISTS split_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_finance_tx_split_group
  ON public.finance_transactions(user_id, split_group_id)
  WHERE split_group_id IS NOT NULL;

-- 4. FINANCE BUDGETS: Cap Mode vs. Zero-Based ("Ready to Assign") Mode
ALTER TABLE public.finance_budgets
  ADD COLUMN IF NOT EXISTS budget_mode TEXT DEFAULT 'cap',
  ADD COLUMN IF NOT EXISTS assigned_income NUMERIC(14, 2);

-- 5. FINANCE NET WORTH SNAPSHOTS: Historical Monthly Net Worth Tracking
CREATE TABLE IF NOT EXISTS public.finance_net_worth_snapshots (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  liquid_assets NUMERIC(14, 2) NOT NULL DEFAULT 0,
  investment_assets NUMERIC(14, 2) NOT NULL DEFAULT 0,
  friend_receivables NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_assets NUMERIC(14, 2) NOT NULL DEFAULT 0,
  credit_card_liabilities NUMERIC(14, 2) NOT NULL DEFAULT 0,
  emi_remaining_principal NUMERIC(14, 2) NOT NULL DEFAULT 0,
  friend_payables NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_liabilities NUMERIC(14, 2) NOT NULL DEFAULT 0,
  net_worth NUMERIC(14, 2) NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  generation_counter INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_finance_nw_user_month UNIQUE (user_id, month_key)
);

CREATE INDEX IF NOT EXISTS idx_finance_nw_user_month
  ON public.finance_net_worth_snapshots(user_id, month_key);

ALTER TABLE public.finance_net_worth_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'finance_net_worth_snapshots'
      AND policyname = 'Users manage own finance_net_worth_snapshots'
  ) THEN
    CREATE POLICY "Users manage own finance_net_worth_snapshots"
      ON public.finance_net_worth_snapshots
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
