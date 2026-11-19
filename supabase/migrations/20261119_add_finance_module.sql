-- ============================================================================
-- FlowFinance Module Migration: Personal Finance, Monthly Commitments,
-- Lend/Borrow Ledger, EMI Trackers, Budgets, SIPs, Rules, and Realtime Replication
-- ============================================================================

-- 1. Finance Categories
CREATE TABLE IF NOT EXISTS public.finance_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense',
  icon TEXT NOT NULL DEFAULT 'Wallet',
  color TEXT NOT NULL DEFAULT '#6366f1',
  monthly_budget_limit NUMERIC(12, 2) NOT NULL DEFAULT 0,
  rollover_enabled BOOLEAN NOT NULL DEFAULT false,
  subcategories JSONB NOT NULL DEFAULT '[]'::jsonb,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  generation_counter BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Finance Accounts
CREATE TABLE IF NOT EXISTS public.finance_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'bank',
  balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  credit_limit NUMERIC(14, 2),
  statement_day INTEGER,
  due_day INTEGER,
  include_in_net_worth BOOLEAN NOT NULL DEFAULT true,
  currency TEXT NOT NULL DEFAULT 'INR',
  color TEXT NOT NULL DEFAULT '#10b981',
  icon TEXT NOT NULL DEFAULT 'Landmark',
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  generation_counter BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Monthly Commitments ("Mother's ₹3,000 Tracker")
CREATE TABLE IF NOT EXISTS public.monthly_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'Family',
  monthly_target_amount NUMERIC(12, 2) NOT NULL,
  due_day_of_month INTEGER NOT NULL DEFAULT 5,
  category TEXT NOT NULL DEFAULT 'family_support',
  default_category_id UUID,
  auto_rollover_overpayment BOOLEAN NOT NULL DEFAULT true,
  icon TEXT NOT NULL DEFAULT 'HeartHandshake',
  color TEXT NOT NULL DEFAULT '#ec4899',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  generation_counter BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Debt Records ("Friends ₹2,000 Partial Repayment Ledger")
CREATE TABLE IF NOT EXISTS public.debt_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  contact_info TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('borrowed', 'lent')),
  title TEXT NOT NULL,
  principal_amount NUMERIC(12, 2) NOT NULL,
  total_repaid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(12, 2) NOT NULL,
  start_date DATE NOT NULL,
  target_settlement_date DATE,
  repayment_schedule TEXT NOT NULL DEFAULT 'monthly_partial',
  planned_monthly_installment NUMERIC(12, 2),
  due_day_of_month INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  color TEXT NOT NULL DEFAULT '#f59e0b',
  deleted_at TIMESTAMPTZ,
  generation_counter BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Debt Installments
CREATE TABLE IF NOT EXISTS public.debt_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  debt_id UUID NOT NULL REFERENCES public.debt_records(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  date DATE NOT NULL,
  month_key TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'upi',
  transaction_id UUID,
  note TEXT,
  balance_after_payment NUMERIC(12, 2) NOT NULL,
  deleted_at TIMESTAMPTZ,
  generation_counter BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. EMI Trackers
CREATE TABLE IF NOT EXISTS public.emi_trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_name TEXT NOT NULL,
  lender_name TEXT NOT NULL,
  principal_amount NUMERIC(14, 2) NOT NULL,
  interest_rate_annual NUMERIC(6, 2) NOT NULL DEFAULT 0,
  emi_amount NUMERIC(12, 2) NOT NULL,
  tenure_months INTEGER NOT NULL,
  paid_months INTEGER NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  billing_day_of_month INTEGER NOT NULL DEFAULT 5,
  category_id UUID,
  account_id UUID,
  auto_create_task_reminder BOOLEAN NOT NULL DEFAULT true,
  last_paid_month_key TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  generation_counter BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Finance Transactions
CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  merchant_name TEXT,
  raw_merchant TEXT,
  amount NUMERIC(12, 2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer', 'investment')),
  category_id UUID NOT NULL,
  subcategory TEXT,
  account_id UUID NOT NULL,
  to_account_id UUID,
  date DATE NOT NULL,
  month_key TEXT NOT NULL,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule TEXT,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  split_group_id UUID,
  linked_commitment_id UUID REFERENCES public.monthly_commitments(id) ON DELETE SET NULL,
  commitment_contribution_type TEXT CHECK (commitment_contribution_type IN ('direct_payment', 'offset_expense')),
  linked_debt_id UUID REFERENCES public.debt_records(id) ON DELETE SET NULL,
  linked_debt_installment_id UUID REFERENCES public.debt_installments(id) ON DELETE SET NULL,
  linked_emi_id UUID REFERENCES public.emi_trackers(id) ON DELETE SET NULL,
  linked_sip_id UUID,
  deleted_at TIMESTAMPTZ,
  generation_counter BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Finance Budgets
CREATE TABLE IF NOT EXISTS public.finance_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  total_budget NUMERIC(14, 2) NOT NULL DEFAULT 50000,
  expected_income NUMERIC(14, 2) NOT NULL DEFAULT 75000,
  planned_sip_amount NUMERIC(14, 2) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  generation_counter BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_finance_budgets_user_month UNIQUE(user_id, month_key)
);

-- 9. Finance SIP Plans
CREATE TABLE IF NOT EXISTS public.finance_sip_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT,
  asset_class TEXT NOT NULL DEFAULT 'equity_mf',
  monthly_amount NUMERIC(12, 2) NOT NULL,
  sip_day_of_month INTEGER NOT NULL DEFAULT 5,
  start_date DATE NOT NULL,
  total_invested NUMERIC(14, 2) NOT NULL DEFAULT 0,
  current_value NUMERIC(14, 2) NOT NULL DEFAULT 0,
  expected_return_annual NUMERIC(6, 2),
  account_id UUID,
  category_id UUID,
  last_invested_month_key TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  color TEXT NOT NULL DEFAULT '#10b981',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  generation_counter BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Finance Categorization Rules
CREATE TABLE IF NOT EXISTS public.finance_categorization_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_pattern TEXT NOT NULL,
  clean_merchant_name TEXT NOT NULL,
  category_id UUID NOT NULL,
  subcategory TEXT,
  default_tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  generation_counter BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Finance Recurring Bills
CREATE TABLE IF NOT EXISTS public.finance_recurring_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  previous_amount NUMERIC(12, 2),
  cadence TEXT NOT NULL DEFAULT 'monthly',
  due_day_of_month INTEGER NOT NULL DEFAULT 5,
  category_id UUID NOT NULL,
  account_id UUID,
  auto_log BOOLEAN NOT NULL DEFAULT false,
  last_paid_month_key TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT NOT NULL DEFAULT 'Calendar',
  deleted_at TIMESTAMPTZ,
  generation_counter BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS across all finance tables
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emi_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_sip_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_categorization_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_recurring_bills ENABLE ROW LEVEL SECURITY;

-- RLS Policies (auth.uid() = user_id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'finance_categories' AND policyname = 'Users manage own finance_categories') THEN
    CREATE POLICY "Users manage own finance_categories" ON public.finance_categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'finance_accounts' AND policyname = 'Users manage own finance_accounts') THEN
    CREATE POLICY "Users manage own finance_accounts" ON public.finance_accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'monthly_commitments' AND policyname = 'Users manage own monthly_commitments') THEN
    CREATE POLICY "Users manage own monthly_commitments" ON public.monthly_commitments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'debt_records' AND policyname = 'Users manage own debt_records') THEN
    CREATE POLICY "Users manage own debt_records" ON public.debt_records FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'debt_installments' AND policyname = 'Users manage own debt_installments') THEN
    CREATE POLICY "Users manage own debt_installments" ON public.debt_installments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'emi_trackers' AND policyname = 'Users manage own emi_trackers') THEN
    CREATE POLICY "Users manage own emi_trackers" ON public.emi_trackers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'finance_transactions' AND policyname = 'Users manage own finance_transactions') THEN
    CREATE POLICY "Users manage own finance_transactions" ON public.finance_transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'finance_budgets' AND policyname = 'Users manage own finance_budgets') THEN
    CREATE POLICY "Users manage own finance_budgets" ON public.finance_budgets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'finance_sip_plans' AND policyname = 'Users manage own finance_sip_plans') THEN
    CREATE POLICY "Users manage own finance_sip_plans" ON public.finance_sip_plans FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'finance_categorization_rules' AND policyname = 'Users manage own finance_categorization_rules') THEN
    CREATE POLICY "Users manage own finance_categorization_rules" ON public.finance_categorization_rules FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'finance_recurring_bills' AND policyname = 'Users manage own finance_recurring_bills') THEN
    CREATE POLICY "Users manage own finance_recurring_bills" ON public.finance_recurring_bills FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Replica Identity for Realtime
ALTER TABLE public.finance_categories REPLICA IDENTITY FULL;
ALTER TABLE public.finance_accounts REPLICA IDENTITY FULL;
ALTER TABLE public.monthly_commitments REPLICA IDENTITY FULL;
ALTER TABLE public.debt_records REPLICA IDENTITY FULL;
ALTER TABLE public.debt_installments REPLICA IDENTITY FULL;
ALTER TABLE public.emi_trackers REPLICA IDENTITY FULL;
ALTER TABLE public.finance_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.finance_budgets REPLICA IDENTITY FULL;
ALTER TABLE public.finance_sip_plans REPLICA IDENTITY FULL;
ALTER TABLE public.finance_categorization_rules REPLICA IDENTITY FULL;
ALTER TABLE public.finance_recurring_bills REPLICA IDENTITY FULL;

-- Add all finance tables to supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'finance_categories') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_categories;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'finance_accounts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_accounts;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'monthly_commitments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.monthly_commitments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'debt_records') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.debt_records;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'debt_installments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.debt_installments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'emi_trackers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.emi_trackers;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'finance_transactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_transactions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'finance_budgets') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_budgets;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'finance_sip_plans') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_sip_plans;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'finance_categorization_rules') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_categorization_rules;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'finance_recurring_bills') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_recurring_bills;
  END IF;
END $$;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_finance_categories_user ON public.finance_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_accounts_user ON public.finance_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_commitments_user ON public.monthly_commitments(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_debt_records_user ON public.debt_records(user_id, status);
CREATE INDEX IF NOT EXISTS idx_debt_installments_debt ON public.debt_installments(debt_id, date);
CREATE INDEX IF NOT EXISTS idx_debt_installments_user ON public.debt_installments(user_id, month_key);
CREATE INDEX IF NOT EXISTS idx_emi_trackers_user_status ON public.emi_trackers(user_id, status);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_user_month ON public.finance_transactions(user_id, month_key);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_commitment ON public.finance_transactions(linked_commitment_id, month_key);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_debt ON public.finance_transactions(linked_debt_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_emi ON public.finance_transactions(linked_emi_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_category ON public.finance_transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_account ON public.finance_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_finance_budgets_user_month ON public.finance_budgets(user_id, month_key);
CREATE INDEX IF NOT EXISTS idx_finance_sip_plans_user ON public.finance_sip_plans(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_finance_categorization_rules_user ON public.finance_categorization_rules(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_finance_recurring_bills_user ON public.finance_recurring_bills(user_id, is_active);
