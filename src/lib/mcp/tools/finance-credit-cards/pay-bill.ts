 
import type { CreditCardStatement } from '@/lib/types';
import { allocatePaymentToStatements } from '@/lib/finance/credit-card-cycles';
import { getSupabaseAdmin } from '../../supabase-admin';
import {
  applyAccountBalanceDelta,
  getInsertMetadata,
  getUpdateMetadata,
  resolveFallbackFinanceCategoryId,
} from '../../sync-helpers';
import { mapCreditCardStatementFromRow } from '../../mappers';

function hasStatementChanged(orig: CreditCardStatement, nextStmt: CreditCardStatement): boolean {
  return (
    orig.remainingDue !== nextStmt.remainingDue ||
    orig.paidAmount !== nextStmt.paidAmount ||
    orig.status !== nextStmt.status
  );
}

async function persistAllocatedStatements(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  openStatements: Array<Record<string, any>>;
  mappedStatements: CreditCardStatement[];
  allocatedStatements: CreditCardStatement[];
  targetStatementId: string | null;
}) {
  const updatedStatements = [];
  for (let i = 0; i < params.allocatedStatements.length; i++) {
    const orig = params.mappedStatements[i];
    const nextStmt = params.allocatedStatements[i];
    if (!hasStatementChanged(orig, nextStmt)) continue;

    const rawRow = params.openStatements.find((s) => s.id === nextStmt.id);
    const isDirectlyLinked =
      Boolean(params.targetStatementId) &&
      (nextStmt.id === params.targetStatementId || nextStmt.cycleKey === params.targetStatementId);

    const { data: updated } = await params.supabase
      .from('credit_card_statements')
      .update({
        ...(isDirectlyLinked ? { paid_amount: nextStmt.paidAmount } : {}),
        remaining_due: nextStmt.remainingDue,
        status: nextStmt.status,
        paid_at: nextStmt.paidAt ?? rawRow?.paid_at ?? null,
        ...getUpdateMetadata(rawRow),
      })
      .eq('user_id', params.userId)
      .eq('id', nextStmt.id)
      .select()
      .single();

    if (updated) updatedStatements.push(updated);
  }
  return updatedStatements;
}

function buildCardPaymentTx(params: {
  userId: string;
  cardName: string;
  fromAccountId: string;
  cardAccountId: string;
  categoryId: string;
  paymentAmount: number;
  dateIst: string;
  targetStatementId: string | null;
  notes?: string;
}) {
  return {
    user_id: params.userId,
    title: `Payment: ${params.cardName}`,
    merchant_name: params.cardName,
    amount: params.paymentAmount,
    type: 'transfer',
    category_id: params.categoryId,
    account_id: params.fromAccountId,
    to_account_id: params.cardAccountId,
    date: params.dateIst,
    month_key: params.dateIst.substring(0, 7),
    is_credit_card_payment: true,
    paid_statement_id: params.targetStatementId,
    notes: params.notes || `Credit card bill payment of ₹${params.paymentAmount}`,
    tags: ['credit_card_payment'],
    ...getInsertMetadata(),
  };
}

async function fetchOpenCardStatements(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  cardAccountId: string
) {
  const { data } = await supabase
    .from('credit_card_statements')
    .select('*')
    .eq('user_id', userId)
    .eq('account_id', cardAccountId)
    .neq('status', 'paid')
    .is('deleted_at', null)
    .order('period_end', { ascending: true });
  return data || [];
}

export async function executePayCardBill(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  cardAccount: Record<string, any>;
  args: Record<string, any>;
  dateIst: string;
}) {
  const { supabase, userId, cardAccount, args, dateIst } = params;
  if (!args.fromAccountId || !args.amount) {
    return { error: 'Validation Error: fromAccountId and amount are required for pay_bill.' };
  }

  const openStatements = await fetchOpenCardStatements(supabase, userId, args.cardAccountId);
  const paymentAmount = Number(args.amount);
  const mappedStatements = openStatements.map(mapCreditCardStatementFromRow);
  const targetStatementId =
    args.statementId || (mappedStatements.length > 0 ? mappedStatements[0].id : null);
  const allocated = allocatePaymentToStatements(mappedStatements, paymentAmount, targetStatementId);

  const categoryId = await resolveFallbackFinanceCategoryId(supabase, userId, [
    'credit-card-payment',
    'emis-debt-repayment',
    'other',
  ]);
  const paymentTx = buildCardPaymentTx({
    userId,
    cardName: cardAccount.name,
    fromAccountId: args.fromAccountId,
    cardAccountId: args.cardAccountId,
    categoryId,
    paymentAmount,
    dateIst,
    targetStatementId,
    notes: args.notes,
  });

  const { data: createdTx, error: txErr } = await supabase
    .from('finance_transactions')
    .insert(paymentTx)
    .select()
    .single();
  if (txErr) throw txErr;

  await applyAccountBalanceDelta(supabase, userId, [
    { accountId: args.fromAccountId, delta: -paymentAmount },
    { accountId: args.cardAccountId, delta: paymentAmount },
  ]);

  const updatedStatements = await persistAllocatedStatements({
    supabase,
    userId,
    openStatements,
    mappedStatements,
    allocatedStatements: allocated.updatedStatements,
    targetStatementId,
  });

  return {
    payload: {
      action: 'bill_paid',
      paymentTransaction: createdTx,
      targetStatementId,
      waterfallAllocations: allocated,
      updatedStatements,
    },
  };
}
