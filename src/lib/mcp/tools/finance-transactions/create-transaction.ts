 
import type { McpAuthContext } from '../../auth';
import { hasScope } from '../../auth';
import { getSupabaseAdmin } from '../../supabase-admin';
import { getIstIsoDate } from '../../config';
import {
  applyAccountBalanceDelta,
  calculateTransactionBalanceDeltas,
  getInsertMetadata,
  getUpdateMetadata,
  resolveFallbackFinanceCategoryId,
} from '../../sync-helpers';
import {
  mapFinanceCategoryFromRow,
  mapFinanceTransactionFromRow,
  mapMealLogFromRow,
  mapSupplementInventoryFromRow,
} from '../../mappers';
import { resolveTransactionCycle } from '@/lib/finance/credit-card-cycles';
import { classifyCategoryBridgeKind } from '@/lib/fitness/finance-bridge';
import { matchExpenseToSupplement } from '@/lib/fitness/supplement-meal-bridge';
import { findBestTransactionMealMatch } from '@/lib/fitness/meal-finance-matcher';

async function resolveCycleKeyForAccount(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  accountId: string,
  txDate: string
): Promise<string | null> {
  const { data: sourceAccount } = await supabase
    .from('finance_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('id', accountId)
    .single();

  if (!sourceAccount || sourceAccount.type !== 'credit_card') return null;
  const billingDay = sourceAccount.billing_day || sourceAccount.statement_day || 15;
  const dueDay = sourceAccount.due_day || 5;
  return resolveTransactionCycle(txDate, billingDay, dueDay);
}

async function tryAutoSyncSupplementCost(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  txId: string;
  amount: number;
  txMeta: { title: string; merchantName: string | null; notes: string | null };
}) {
  const { data: supRows } = await params.supabase
    .from('supplement_inventory')
    .select('*')
    .eq('user_id', params.userId)
    .is('deleted_at', null);

  const mappedSups = (supRows || []).map(mapSupplementInventoryFromRow);
  const matchedSup = matchExpenseToSupplement(params.txMeta, mappedSups);
  if (!matchedSup || Number(matchedSup.costInr || 0) !== 0) return null;

  const rawSup = (supRows || []).find((r: any) => r.id === matchedSup.id);
  const { error } = await params.supabase
    .from('supplement_inventory')
    .update({
      cost_inr: params.amount,
      linked_transaction_id: params.txId,
      ...getUpdateMetadata(rawSup),
    })
    .eq('user_id', params.userId)
    .eq('id', matchedSup.id);

  if (error) return null;
  return { supplementId: matchedSup.id, name: matchedSup.name, costInr: params.amount };
}

async function updateMealLinkedTransaction(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  txId: string;
  rawMeal: any;
  matchedMeal: { id: string; name: string; date: string };
}) {
  const { error } = await params.supabase
    .from('meal_logs')
    .update({
      linked_transaction_id: params.txId,
      ...getUpdateMetadata(params.rawMeal),
    })
    .eq('user_id', params.userId)
    .eq('id', params.matchedMeal.id);
  if (error) return null;
  return { id: params.matchedMeal.id, name: params.matchedMeal.name, date: params.matchedMeal.date };
}

async function tryAutoLinkMeal(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  txRow: Record<string, any>;
  txDate: string;
  mappedCat: ReturnType<typeof mapFinanceCategoryFromRow> | null;
}) {
  const { data: dayMeals } = await params.supabase
    .from('meal_logs')
    .select('*')
    .eq('user_id', params.userId)
    .eq('date', params.txDate)
    .is('deleted_at', null);

  const mappedDayMeals = (dayMeals || []).map(mapMealLogFromRow);
  const mealMatch = findBestTransactionMealMatch(
    mapFinanceTransactionFromRow(params.txRow),
    mappedDayMeals,
    params.mappedCat ? [params.mappedCat] : []
  );
  if (!mealMatch || mealMatch.confidence !== 'high') return null;

  const rawMeal = (dayMeals || []).find((m: any) => m.id === mealMatch.meal.id);
  return updateMealLinkedTransaction({
    supabase: params.supabase,
    userId: params.userId,
    txId: params.txRow.id,
    rawMeal,
    matchedMeal: mealMatch.meal,
  });
}

async function fetchCategoryById(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  categoryId: string
) {
  const { data: catRow } = await supabase
    .from('finance_categories')
    .select('*')
    .eq('user_id', userId)
    .eq('id', categoryId)
    .maybeSingle();
  return catRow ? mapFinanceCategoryFromRow(catRow) : null;
}

type BridgeDispatchParams = {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  auth: McpAuthContext;
  txRow: Record<string, any>;
  txDate: string;
  amount: number;
};

function wrapOptionalField<K extends string, V>(key: K, value: V | null | undefined) {
  return value ? { [key]: value } : {};
}

async function syncSupplementBridge(params: BridgeDispatchParams) {
  const autoSyncedSupplementCost = await tryAutoSyncSupplementCost({
    supabase: params.supabase,
    userId: params.auth.userId,
    txId: params.txRow.id,
    amount: params.amount,
    txMeta: { title: params.txRow.title, merchantName: params.txRow.merchant_name, notes: params.txRow.notes },
  });
  return wrapOptionalField('autoSyncedSupplementCost', autoSyncedSupplementCost);
}

async function syncMealBridge(
  params: BridgeDispatchParams,
  mappedCat: ReturnType<typeof mapFinanceCategoryFromRow> | null
) {
  const autoLinkedMeal = await tryAutoLinkMeal({
    supabase: params.supabase,
    userId: params.auth.userId,
    txRow: params.txRow,
    txDate: params.txDate,
    mappedCat,
  });
  return wrapOptionalField('autoLinkedMeal', autoLinkedMeal);
}

async function dispatchBridgeByKind(
  bridgeKind: string | null,
  params: BridgeDispatchParams,
  mappedCat: ReturnType<typeof mapFinanceCategoryFromRow> | null
) {
  if (bridgeKind === 'health_supplements') return syncSupplementBridge(params);
  if (bridgeKind === 'food_dining' || bridgeKind === 'junk') return syncMealBridge(params, mappedCat);
  return {};
}

async function runCrossDomainExpenseBridges(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  auth: McpAuthContext;
  categoryId: string;
  txRow: Record<string, any>;
  txDate: string;
  amount: number;
}) {
  if (params.txRow.type !== 'expense' || !hasScope(params.auth, 'habitflow:write')) return {};
  const mappedCat = await fetchCategoryById(params.supabase, params.auth.userId, params.categoryId);
  return dispatchBridgeByKind(classifyCategoryBridgeKind(mappedCat), params, mappedCat);
}

function orVal<T>(value: T | undefined | null, fallback: T): T {
  return value ?? fallback;
}

function buildNewTransactionCore(params: {
  userId: string;
  args: Record<string, any>;
  categoryId: string;
  txDate: string;
}) {
  const { args, txDate } = params;
  return {
    user_id: params.userId,
    title: String(args.title).trim(),
    merchant_name: orVal(args.merchantName, null),
    raw_merchant: orVal(args.merchantName, null),
    amount: Number(args.amount),
    type: args.type,
    category_id: params.categoryId,
    subcategory: orVal(args.subcategory, null),
    account_id: args.accountId,
    to_account_id: args.type === 'transfer' ? orVal(args.toAccountId, null) : null,
    date: txDate,
    month_key: txDate.substring(0, 7),
    notes: orVal(args.notes, null),
    tags: orVal(args.tags, []),
  };
}

function buildNewTransactionLinks(args: Record<string, any>, statementCycleKey: string | null) {
  return {
    is_recurring: orVal(args.isRecurring, false),
    recurrence_rule: orVal(args.recurrenceRule, null),
    needs_review: orVal(args.needsReview, false),
    linked_commitment_id: orVal(args.linkedCommitmentId, null),
    commitment_contribution_type: orVal(args.commitmentContributionType, null),
    linked_debt_id: orVal(args.linkedDebtId, null),
    linked_emi_id: orVal(args.linkedEmiId, null),
    linked_sip_id: orVal(args.linkedSipId, null),
    is_credit_card_payment: orVal(args.isCreditCardPayment, false),
    paid_statement_id: orVal(args.paidStatementId, null),
    statement_cycle_key: statementCycleKey,
  };
}

function hasRequiredCreateArgs(args: Record<string, any>): boolean {
  return Boolean(args.title && args.amount !== undefined && args.type && args.accountId);
}

export async function createTransactionRecord(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  auth: McpAuthContext,
  args: Record<string, any>
) {
  if (!hasRequiredCreateArgs(args)) {
    return {
      error: 'Validation Error: title, amount, type, and accountId are required for create action.',
    };
  }

  const txDate = args.date || getIstIsoDate();
  const statementCycleKey = await resolveCycleKeyForAccount(
    supabase,
    auth.userId,
    args.accountId,
    txDate
  );
  const categoryId =
    args.categoryId ||
    (await resolveFallbackFinanceCategoryId(supabase, auth.userId, [
      'other',
      'miscellaneous',
      'food-dining',
    ]));

  const newTx = {
    ...buildNewTransactionCore({ userId: auth.userId, args, categoryId, txDate }),
    ...buildNewTransactionLinks(args, statementCycleKey),
    ...getInsertMetadata(),
  };

  const { data, error } = await supabase.from('finance_transactions').insert(newTx).select().single();
  if (error) throw error;

  const deltas = calculateTransactionBalanceDeltas({
    amount: newTx.amount,
    type: newTx.type,
    account_id: newTx.account_id,
    to_account_id: newTx.to_account_id,
  });
  const updatedAccounts = await applyAccountBalanceDelta(supabase, auth.userId, deltas);
  const bridgeExtras = await runCrossDomainExpenseBridges({
    supabase,
    auth,
    categoryId,
    txRow: data,
    txDate,
    amount: Number(args.amount),
  });

  return {
    payload: {
      action: 'created',
      transaction: data,
      updatedAccounts,
      ...bridgeExtras,
    },
  };
}
