 
import { resolveTransactionCycle } from '@/lib/finance/credit-card-cycles';
import { getSupabaseAdmin } from '../../supabase-admin';
import {
  applyAccountBalanceDelta,
  calculateReversedTransactionBalanceDeltas,
  calculateTransactionBalanceDeltas,
  getSoftDeleteMetadata,
  getUpdateMetadata,
} from '../../sync-helpers';
import { pickDefinedColumns } from '../tool-helpers';

const TX_UPDATE_COLUMNS = [
  ['categoryId', 'category_id'],
  ['subcategory', 'subcategory'],
  ['notes', 'notes'],
  ['tags', 'tags'],
  ['isRecurring', 'is_recurring'],
  ['recurrenceRule', 'recurrence_rule'],
  ['needsReview', 'needs_review'],
  ['linkedCommitmentId', 'linked_commitment_id'],
  ['commitmentContributionType', 'commitment_contribution_type'],
  ['linkedDebtId', 'linked_debt_id'],
  ['linkedEmiId', 'linked_emi_id'],
  ['linkedSipId', 'linked_sip_id'],
  ['isCreditCardPayment', 'is_credit_card_payment'],
  ['paidStatementId', 'paid_statement_id'],
] as const;

export async function restoreTransactionRecord(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  transactionId: string
) {
  const { data: deletedTx, error: delFetchErr } = await supabase
    .from('finance_transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('id', transactionId)
    .maybeSingle();

  if (delFetchErr || !deletedTx) return { error: `Transaction not found: ${transactionId}` };
  if (!deletedTx.deleted_at) {
    return { payload: { action: 'already_active', transaction: deletedTx } };
  }

  const restoreDeltas = calculateTransactionBalanceDeltas({
    amount: deletedTx.amount,
    type: deletedTx.type,
    account_id: deletedTx.account_id,
    to_account_id: deletedTx.to_account_id,
  });
  const updatedAccounts = await applyAccountBalanceDelta(supabase, userId, restoreDeltas);

  const { data, error } = await supabase
    .from('finance_transactions')
    .update({ deleted_at: null, ...getUpdateMetadata(deletedTx) })
    .eq('user_id', userId)
    .eq('id', transactionId)
    .select()
    .single();
  if (error) throw error;

  return { payload: { action: 'restored', transaction: data, updatedAccounts } };
}

export async function deleteTransactionRecord(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  existing: Record<string, any>,
  args: Record<string, any>
) {
  if (!args.confirm) {
    return {
      error:
        'Confirmation Required: Deleting this transaction reverses its account balance changes and requires confirm: true.',
    };
  }

  const reverseDeltas = calculateReversedTransactionBalanceDeltas({
    amount: existing.amount,
    type: existing.type,
    account_id: existing.account_id,
    to_account_id: existing.to_account_id,
  });
  const updatedAccounts = await applyAccountBalanceDelta(supabase, userId, reverseDeltas);

  const { data, error } = await supabase
    .from('finance_transactions')
    .update({ ...getSoftDeleteMetadata(existing) })
    .eq('user_id', userId)
    .eq('id', args.transactionId)
    .select()
    .single();
  if (error) throw error;

  return { payload: { action: 'deleted', transaction: data, updatedAccounts } };
}

export async function resolveTransactionReview(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  existing: Record<string, any>,
  transactionId: string
) {
  const { data, error } = await supabase
    .from('finance_transactions')
    .update({ needs_review: false, ...getUpdateMetadata(existing) })
    .eq('user_id', userId)
    .eq('id', transactionId)
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'review_resolved', transaction: data } };
}

function hasBalanceImpactChange(existing: Record<string, any>, args: Record<string, any>): boolean {
  const amountChanged = args.amount !== undefined && args.amount !== existing.amount;
  const accountChanged = args.accountId !== undefined && args.accountId !== existing.account_id;
  const typeChanged = args.type !== undefined && args.type !== existing.type;
  const toAccountChanged = args.toAccountId !== undefined && args.toAccountId !== existing.to_account_id;
  return amountChanged || accountChanged || typeChanged || toAccountChanged;
}

const TX_BALANCE_COLUMNS = [
  ['amount', 'amount'],
  ['type', 'type'],
  ['accountId', 'account_id'],
  ['toAccountId', 'to_account_id'],
] as const;

async function recomputeAccountBalancesForUpdate(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  existing: Record<string, any>;
  args: Record<string, any>;
  updates: Record<string, any>;
}) {
  const { supabase, userId, existing, args, updates } = params;
  const revDeltas = calculateReversedTransactionBalanceDeltas({
    amount: existing.amount,
    type: existing.type,
    account_id: existing.account_id,
    to_account_id: existing.to_account_id,
  });
  await applyAccountBalanceDelta(supabase, userId, revDeltas);

  const newDeltas = calculateTransactionBalanceDeltas({
    amount: args.amount ?? existing.amount,
    type: args.type ?? existing.type,
    account_id: args.accountId ?? existing.account_id,
    to_account_id: args.toAccountId ?? existing.to_account_id,
  });
  const updatedAccounts = await applyAccountBalanceDelta(supabase, userId, newDeltas);
  Object.assign(updates, pickDefinedColumns(args, TX_BALANCE_COLUMNS));
  return updatedAccounts;
}

type CycleLookupParams = {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  targetAccId: string;
  targetDate: string;
};

function resolveCardCycleDays(targetAcc: Record<string, any>) {
  return {
    billingDay: targetAcc.billing_day ?? targetAcc.statement_day ?? 15,
    dueDay: targetAcc.due_day ?? 5,
  };
}

async function resolveUpdatedStatementCycle(params: CycleLookupParams): Promise<string | null> {
  const { data: targetAcc } = await params.supabase
    .from('finance_accounts')
    .select('type, billing_day, statement_day, due_day')
    .eq('user_id', params.userId)
    .eq('id', params.targetAccId)
    .maybeSingle();

  if (targetAcc?.type !== 'credit_card') return null;
  const { billingDay, dueDay } = resolveCardCycleDays(targetAcc);
  return resolveTransactionCycle(params.targetDate, billingDay, dueDay);
}

function applyMerchantUpdate(updates: Record<string, any>, merchantName: unknown) {
  if (merchantName === undefined) return;
  updates.merchant_name = merchantName;
  updates.raw_merchant = merchantName;
}

function buildTransactionBaseUpdates(existing: Record<string, any>, args: Record<string, any>) {
  const updates = pickDefinedColumns(args, TX_UPDATE_COLUMNS);
  if (args.title !== undefined) updates.title = String(args.title).trim();
  applyMerchantUpdate(updates, args.merchantName);
  if (args.date !== undefined) {
    updates.date = args.date;
    updates.month_key = args.date.substring(0, 7);
  }
  return updates;
}

function resolveStatementCycleArgs(existing: Record<string, any>, args: Record<string, any>) {
  return {
    targetAccId: args.accountId ?? existing.account_id,
    targetDate: args.date ?? existing.date,
  };
}

export async function updateTransactionRecord(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  existing: Record<string, any>,
  args: Record<string, any>
) {
  const updates = buildTransactionBaseUpdates(existing, args);
  const updatedAccounts = hasBalanceImpactChange(existing, args)
    ? await recomputeAccountBalancesForUpdate({ supabase, userId, existing, args, updates })
    : [];

  const accountChanged = args.accountId !== undefined && args.accountId !== existing.account_id;
  if (args.date !== undefined || accountChanged) {
    updates.statement_cycle_key = await resolveUpdatedStatementCycle({
      supabase,
      userId,
      ...resolveStatementCycleArgs(existing, args),
    });
  }

  const { data, error } = await supabase
    .from('finance_transactions')
    .update({ ...updates, ...getUpdateMetadata(existing) })
    .eq('user_id', userId)
    .eq('id', args.transactionId)
    .select()
    .single();
  if (error) throw error;

  return { payload: { action: 'updated', transaction: data, updatedAccounts } };
}
