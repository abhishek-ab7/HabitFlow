import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveTransactionCycle, allocatePaymentToStatements } from '@/lib/finance/credit-card-cycles';
import type { CreditCardStatement } from '@/lib/types';

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
