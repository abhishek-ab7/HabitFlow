-- Multi-Card Credit Card Billing Cycle & Dual-Bucket Statement Engine Migration

-- 1. Extend finance_accounts with credit card cycle configuration
ALTER TABLE finance_accounts ADD COLUMN IF NOT EXISTS billing_day integer;
ALTER TABLE finance_accounts ADD COLUMN IF NOT EXISTS statement_day integer;
ALTER TABLE finance_accounts ADD COLUMN IF NOT EXISTS due_day integer;
ALTER TABLE finance_accounts ADD COLUMN IF NOT EXISTS credit_limit numeric;
ALTER TABLE finance_accounts ADD COLUMN IF NOT EXISTS grace_period_days integer;
ALTER TABLE finance_accounts ADD COLUMN IF NOT EXISTS last_statement_checked_at timestamptz;

-- 2. Extend finance_transactions with statement cycle linking and payment marker
ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS statement_cycle_key text;
ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS paid_statement_id text;
ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS is_credit_card_payment boolean DEFAULT false;

-- 3. Create credit_card_statements table
CREATE TABLE IF NOT EXISTS credit_card_statements (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id uuid REFERENCES finance_accounts(id) ON DELETE CASCADE NOT NULL,
  cycle_key text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  due_date date NOT NULL,
  calculated_amount numeric NOT NULL DEFAULT 0,
  manual_adjustment numeric NOT NULL DEFAULT 0,
  total_due numeric NOT NULL DEFAULT 0,
  carried_forward_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  remaining_due numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'billed',
  paid_at timestamptz,
  notes text,
  generation_counter integer DEFAULT 1,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz,
  CONSTRAINT uq_credit_card_statements_user_account_cycle UNIQUE(user_id, account_id, cycle_key)
);

-- 4. Indexes for fast dashboard and sync queries
CREATE INDEX IF NOT EXISTS idx_credit_card_statements_user_id ON credit_card_statements(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_statements_account_id ON credit_card_statements(account_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_statements_due_date ON credit_card_statements(due_date);
CREATE INDEX IF NOT EXISTS idx_credit_card_statements_status ON credit_card_statements(status);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE credit_card_statements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'credit_card_statements' AND policyname = 'Users can manage their own credit card statements'
  ) THEN
    CREATE POLICY "Users can manage their own credit card statements"
      ON credit_card_statements
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
