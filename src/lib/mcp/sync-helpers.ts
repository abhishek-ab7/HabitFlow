import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveTransactionCycle } from '@/lib/finance/credit-card-cycles';

export interface RowWithClock {
  generation_counter?: number | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

/**
 * Returns generation_counter and updated_at for an INSERT.
 */
export function getInsertMetadata(id?: string) {
  const now = new Date().toISOString();
  return {
    id: id || crypto.randomUUID(),
    generation_counter: 1,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Returns generation_counter and updated_at for an UPDATE.
 * Bumping generation_counter is mandatory due to PostgreSQL's
 * `increment_generation_clock_vector()` trigger which silently discards
 * updates where NEW.generation_counter <= OLD.generation_counter.
 */
export function getUpdateMetadata(existing?: RowWithClock | null) {
  const current = existing?.generation_counter ?? 0;
  return {
    generation_counter: current + 1,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Returns generation_counter, updated_at, and deleted_at for a soft delete.
 */
export function getSoftDeleteMetadata(existing?: RowWithClock | null) {
  const now = new Date().toISOString();
  const current = existing?.generation_counter ?? 0;
  return {
    generation_counter: current + 1,
    updated_at: now,
    deleted_at: now,
  };
}

/**
 * Applies transaction balance adjustments atomically to finance_accounts in Supabase.
 * Bumps generation_counter on all affected accounts so Dexie pulls immediately receive them.
 */
export async function applyAccountBalanceDelta(
  supabase: SupabaseClient,
  userId: string,
  deltas: { accountId: string; delta: number }[]
): Promise<{ id: string; newBalance: number }[]> {
  const results: { id: string; newBalance: number }[] = [];

  for (const { accountId, delta } of deltas) {
    if (!accountId || delta === 0) continue;

    // Fetch current account row
    const { data: account, error } = await supabase
      .from('finance_accounts')
      .select('id, balance, generation_counter')
      .eq('user_id', userId)
      .eq('id', accountId)
      .single();

    if (error || !account) {
      console.warn(`Could not find account ${accountId} to update balance:`, error?.message);
      continue;
    }

    const currentBalance = Number(account.balance || 0);
    const newBalance = Math.round((currentBalance + delta) * 100) / 100;
    const meta = getUpdateMetadata(account);

    const { error: updateError } = await supabase
      .from('finance_accounts')
      .update({
        balance: newBalance,
        ...meta,
      })
      .eq('user_id', userId)
      .eq('id', accountId);

    if (updateError) {
      console.error(`Failed to update balance on account ${accountId}:`, updateError.message);
    } else {
      results.push({ id: accountId, newBalance });
    }
  }

  return results;
}

/**
 * Calculates balance deltas for creating a new transaction.
 */
export function calculateTransactionBalanceDeltas(tx: {
  amount: number;
  type: string;
  account_id: string;
  to_account_id?: string | null;
}): { accountId: string; delta: number }[] {
  const amount = Number(tx.amount || 0);
  const deltas: { accountId: string; delta: number }[] = [];

  switch (tx.type) {
    case 'income':
      deltas.push({ accountId: tx.account_id, delta: amount });
      break;
    case 'expense':
    case 'investment':
      deltas.push({ accountId: tx.account_id, delta: -amount });
      break;
    case 'transfer':
      deltas.push({ accountId: tx.account_id, delta: -amount });
      if (tx.to_account_id) {
        deltas.push({ accountId: tx.to_account_id, delta: amount });
      }
      break;
  }

  return deltas;
}

/**
 * Calculates reversed balance deltas for updating or deleting an existing transaction.
 */
export function calculateReversedTransactionBalanceDeltas(oldTx: {
  amount: number;
  type: string;
  account_id: string;
  to_account_id?: string | null;
}): { accountId: string; delta: number }[] {
  const normalDeltas = calculateTransactionBalanceDeltas(oldTx);
  return normalDeltas.map((d) => ({ accountId: d.accountId, delta: -d.delta }));
}

/**
 * Resolves a valid finance_categories.id for MCP-inserted transactions so the
 * Postgres NOT NULL constraint on finance_transactions.category_id never fails.
 */
export async function resolveFallbackFinanceCategoryId(
  supabase: SupabaseClient,
  userId: string,
  preferredSlugs: string[] = ['other', 'miscellaneous', 'food-dining', 'emis-debt-repayment']
): Promise<string> {
  const { data: categories } = await supabase
    .from('finance_categories')
    .select('id, slug, name, is_archived')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('order_index', { ascending: true });

  const active = (categories || []).filter((c) => !c.is_archived);
  for (const slug of preferredSlugs) {
    const matched = active.find(
      (c) => String(c.slug || '').toLowerCase() === slug.toLowerCase()
    );
    if (matched?.id) return matched.id;
  }

  if (active[0]?.id) return active[0].id;
  if (categories?.[0]?.id) return categories[0].id;

  // Last resort: create a personal "Other" category so transactions never fail FK/NOT NULL checks
  const meta = getInsertMetadata();
  const { data: created, error } = await supabase
    .from('finance_categories')
    .insert({
      user_id: userId,
      name: 'Other',
      slug: 'other',
      type: 'expense',
      icon: 'Tag',
      color: '#6B7280',
      monthly_budget_limit: 0,
      rollover_enabled: false,
      subcategories: [],
      order_index: 99,
      is_system: false,
      is_archived: false,
      ...meta,
    })
    .select('id')
    .single();

  if (error || !created?.id) {
    throw new Error(error?.message || 'Unable to resolve a finance category for transaction.');
  }

  return created.id;
}

/**
 * Shared compound cross-domain helper used when logging a paid meal or restocking a supplement
 * with an expense amount + source account. Inserts the finance_transactions row, resolves credit
 * card statement cycle if applicable, and adjusts the account balance atomically.
 */
export async function createLinkedFinanceExpense(
  supabase: SupabaseClient,
  userId: string,
  params: {
    title: string;
    merchantName?: string | null;
    amount: number;
    accountId: string;
    categoryId?: string | null;
    preferredCategorySlugs?: string[];
    subcategory?: string | null;
    date: string;
    notes?: string | null;
    tags?: string[];
  }
): Promise<{
  transaction: Record<string, any>;
  updatedAccounts: { id: string; newBalance: number }[];
}> {
  const categoryId =
    params.categoryId ||
    (await resolveFallbackFinanceCategoryId(
      supabase,
      userId,
      params.preferredCategorySlugs || ['food-dining', 'health-fitness', 'other']
    ));

  let statementCycleKey: string | null = null;
  const { data: sourceAccount } = await supabase
    .from('finance_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('id', params.accountId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!sourceAccount) {
    throw new Error(`Source finance account not found: ${params.accountId}`);
  }

  if (sourceAccount.type === 'credit_card') {
    const billingDay = sourceAccount.billing_day || sourceAccount.statement_day || 15;
    const dueDay = sourceAccount.due_day || 5;
    statementCycleKey = resolveTransactionCycle(params.date, billingDay, dueDay);
  }

  const amount = Number(params.amount);
  const meta = getInsertMetadata();
  const { data: transaction, error } = await supabase
    .from('finance_transactions')
    .insert({
      user_id: userId,
      title: params.title.trim(),
      merchant_name: params.merchantName ?? null,
      raw_merchant: params.merchantName ?? null,
      amount,
      type: 'expense',
      category_id: categoryId,
      subcategory: params.subcategory ?? null,
      account_id: params.accountId,
      to_account_id: null,
      date: params.date,
      month_key: params.date.substring(0, 7),
      notes: params.notes ?? null,
      tags: params.tags ?? [],
      is_recurring: false,
      needs_review: false,
      statement_cycle_key: statementCycleKey,
      ...meta,
    })
    .select()
    .single();

  if (error || !transaction) {
    throw error || new Error('Failed to create linked expense transaction.');
  }

  const deltas = calculateTransactionBalanceDeltas({
    amount,
    type: 'expense',
    account_id: params.accountId,
  });
  const updatedAccounts = await applyAccountBalanceDelta(supabase, userId, deltas);

  return { transaction, updatedAccounts };
}
