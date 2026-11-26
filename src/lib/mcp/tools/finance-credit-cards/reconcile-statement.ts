 
import {
  getCycleWindowForMonth,
  resolveCardBillingConfig,
  resolveTransactionCycle,
  roundCurrency,
} from '@/lib/finance/credit-card-cycles';
import { getSupabaseAdmin } from '../../supabase-admin';
import { getInsertMetadata, getUpdateMetadata } from '../../sync-helpers';
import { mapFinanceAccountFromRow, mapFinanceTransactionFromRow } from '../../mappers';

async function computeCalculatedCycleAmount(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  cardAccount: Record<string, any>;
  cycleKey: string;
}): Promise<{ calculatedAmount: number; window: ReturnType<typeof getCycleWindowForMonth> }> {
  const mappedCard = mapFinanceAccountFromRow(params.cardAccount);
  const { billingDay, dueDay, gracePeriodDays } = resolveCardBillingConfig(mappedCard);
  const [cYear, cMonth] = params.cycleKey.split('-').map(Number);
  const window = getCycleWindowForMonth(billingDay, dueDay, cYear, cMonth - 1, gracePeriodDays);

  const { data: cardTxsRows } = await params.supabase
    .from('finance_transactions')
    .select('*')
    .eq('user_id', params.userId)
    .eq('account_id', params.cardAccount.id)
    .is('deleted_at', null);

  const mappedCardTxs = (cardTxsRows || [])
    .map(mapFinanceTransactionFromRow)
    .filter((t) => !t.isCreditCardPayment && t.type !== 'transfer');

  let calculatedAmount = 0;
  for (const tx of mappedCardTxs) {
    const txCycle = resolveTransactionCycle(tx.date, billingDay, dueDay, tx.statementCycleKey);
    if (txCycle !== params.cycleKey) continue;
    const delta = tx.type === 'income' ? -tx.amount : tx.amount;
    calculatedAmount = roundCurrency(calculatedAmount + delta);
  }

  return { calculatedAmount, window };
}

function resolveReconciledStatus(remainingDue: number, paidAmt: number) {
  if (remainingDue <= 0) return 'paid';
  return paidAmt > 0 ? 'partial' : 'billed';
}

async function updateExistingStatement(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  statementId: string;
  existing: Record<string, any>;
  window: ReturnType<typeof getCycleWindowForMonth>;
  calculatedAmount: number;
  manualAdjustment: number;
  notes?: string;
}) {
  const { existing, window, calculatedAmount, manualAdjustment } = params;
  const carriedForward = Number(existing.carried_forward_amount || 0);
  const totalDue = roundCurrency(Math.max(0, calculatedAmount + manualAdjustment + carriedForward));
  const paidAmt = Number(existing.paid_amount || 0);
  const remainingDue = roundCurrency(Math.max(0, totalDue - paidAmt));

  const { data, error } = await params.supabase
    .from('credit_card_statements')
    .update({
      period_start: window.periodStart,
      period_end: window.periodEnd,
      due_date: window.dueDate,
      calculated_amount: calculatedAmount,
      total_due: totalDue,
      manual_adjustment: manualAdjustment,
      remaining_due: remainingDue,
      status: resolveReconciledStatus(remainingDue, paidAmt),
      notes: params.notes !== undefined ? params.notes : existing.notes,
      ...getUpdateMetadata(existing),
    })
    .eq('user_id', params.userId)
    .eq('id', params.statementId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function insertReconciledStatement(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  statementId: string;
  args: Record<string, any>;
  window: ReturnType<typeof getCycleWindowForMonth>;
  calculatedAmount: number;
  manualAdjustment: number;
  actualBilled: number;
}) {
  const { window, args, actualBilled } = params;
  const { data, error } = await params.supabase
    .from('credit_card_statements')
    .insert({
      user_id: params.userId,
      account_id: args.cardAccountId,
      cycle_key: args.cycleKey,
      period_start: window.periodStart,
      period_end: window.periodEnd,
      due_date: window.dueDate,
      calculated_amount: params.calculatedAmount,
      manual_adjustment: params.manualAdjustment,
      total_due: actualBilled,
      carried_forward_amount: 0,
      paid_amount: 0,
      remaining_due: actualBilled,
      status: actualBilled === 0 ? 'paid' : 'billed',
      notes: args.notes || null,
      ...getInsertMetadata(params.statementId),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function executeReconcileStatement(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  cardAccount: Record<string, any>;
  args: Record<string, any>;
}) {
  const { supabase, userId, cardAccount, args } = params;
  if (!args.cycleKey || args.billedTotal === undefined) {
    return { error: 'Validation Error: cycleKey and billedTotal are required for reconcile_statement.' };
  }

  const { calculatedAmount, window } = await computeCalculatedCycleAmount({
    supabase,
    userId,
    cardAccount,
    cycleKey: args.cycleKey,
  });

  const actualBilled = roundCurrency(Math.max(0, Number(args.billedTotal)));
  const manualAdjustment = roundCurrency(actualBilled - calculatedAmount);
  const statementId = `${args.cardAccountId}_${args.cycleKey}`;
  const { data: existing } = await supabase
    .from('credit_card_statements')
    .select('*')
    .eq('user_id', userId)
    .eq('id', statementId)
    .maybeSingle();

  const statement = existing
    ? await updateExistingStatement({
        supabase,
        userId,
        statementId,
        existing,
        window,
        calculatedAmount,
        manualAdjustment,
        notes: args.notes,
      })
    : await insertReconciledStatement({
        supabase,
        userId,
        statementId,
        args,
        window,
        calculatedAmount,
        manualAdjustment,
        actualBilled,
      });

  return { payload: { action: 'statement_reconciled', statement } };
}
