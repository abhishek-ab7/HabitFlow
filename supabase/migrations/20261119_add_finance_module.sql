-- ============================================================================
-- FlowFinance Module Migration: Personal Finance, Monthly Commitments,
-- Lend/Borrow Ledger, and EMI Amortization Tracker with Vector Clock RPCs
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
  subcategories JSONB NOT NULL DEFAULT '[]'::jsonb,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  generation_counter INTEGER NOT NULL DEFAULT 1,
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
  currency TEXT NOT NULL DEFAULT 'INR',
  color TEXT NOT NULL DEFAULT '#10b981',
  icon TEXT NOT NULL DEFAULT 'Landmark',
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  generation_counter INTEGER NOT NULL DEFAULT 1,
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
  generation_counter INTEGER NOT NULL DEFAULT 1,
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
  generation_counter INTEGER NOT NULL DEFAULT 1,
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
  generation_counter INTEGER NOT NULL DEFAULT 1,
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
  generation_counter INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Finance Transactions
CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
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
  linked_commitment_id UUID REFERENCES public.monthly_commitments(id) ON DELETE SET NULL,
  commitment_contribution_type TEXT CHECK (commitment_contribution_type IN ('direct_payment', 'offset_expense')),
  linked_debt_id UUID REFERENCES public.debt_records(id) ON DELETE SET NULL,
  linked_debt_installment_id UUID REFERENCES public.debt_installments(id) ON DELETE SET NULL,
  linked_emi_id UUID REFERENCES public.emi_trackers(id) ON DELETE SET NULL,
  generation_counter INTEGER NOT NULL DEFAULT 1,
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
  currency TEXT NOT NULL DEFAULT 'INR',
  notes TEXT,
  generation_counter INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, month_key)
);

-- Enable RLS across all FlowFinance tables
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emi_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_budgets ENABLE ROW LEVEL SECURITY;

-- RLS Policies (auth.uid() = user_id)
CREATE POLICY "Users manage own finance_categories" ON public.finance_categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own finance_accounts" ON public.finance_accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own monthly_commitments" ON public.monthly_commitments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own debt_records" ON public.debt_records FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own debt_installments" ON public.debt_installments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own emi_trackers" ON public.emi_trackers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own finance_transactions" ON public.finance_transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own finance_budgets" ON public.finance_budgets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_finance_transactions_user_month ON public.finance_transactions(user_id, month_key);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_commitment ON public.finance_transactions(linked_commitment_id, month_key);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_debt ON public.finance_transactions(linked_debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_installments_debt ON public.debt_installments(debt_id, date);
CREATE INDEX IF NOT EXISTS idx_emi_trackers_user_status ON public.emi_trackers(user_id, status);
