import { getSupabaseAdmin } from '../../supabase-admin';
import {
  applyAccountBalanceDelta,
  calculateReversedTransactionBalanceDeltas,
  getInsertMetadata,
  getSoftDeleteMetadata,
  getUpdateMetadata,
  resolveFallbackFinanceCategoryId,
} from '../../sync-helpers';

async function recomputeDebtFromInstallments(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  debtRow: Record<string, any>
) {
  const { data: activeInsts } = await supabase
    .from('debt_installments')
    .select('amount')
    .eq('user_id', userId)
    .eq('debt_id', debtRow.id)
    .is('deleted_at', null);

  const totalRepaid =
    Math.round((activeInsts || []).reduce((sum, i) => sum + Number(i.amount || 0), 0) * 100) / 100;
  const remaining = Math.max(
    0,
    Math.round((Number(debtRow.principal_amount || 0) - totalRepaid) * 100) / 100
  );
  const nextStatus = debtRow.deleted_at ? 'archived' : remaining <= 0 ? 'settled' : 'active';

  const { data: updatedDebt } = await supabase
    .from('debt_records')
    .update({
      total_repaid_amount: totalRepaid,
      remaining_amount: remaining,
      status: nextStatus,
      ...getUpdateMetadata(debtRow),
    })
    .eq('user_id', userId)
    .eq('id', debtRow.id)
    .select()
    .single();
  return updatedDebt;
}

async function reverseLinkedDebtTransaction(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  installmentId: string
) {
  const { data: linkedTx } = await supabase
    .from('finance_transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('linked_debt_installment_id', installmentId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!linkedTx) return;
  const rev = calculateReversedTransactionBalanceDeltas(linkedTx);
  await applyAccountBalanceDelta(supabase, userId, rev);
  await supabase
    .from('finance_transactions')
    .update(getSoftDeleteMetadata(linkedTx))
    .eq('user_id', userId)
    .eq('id', linkedTx.id);
}

function buildInstallmentUpdatePatch(inst: Record<string, any>, args: Record<string, any>) {
  if (args.action === 'restore_payment') {
    return { deleted_at: null, ...getUpdateMetadata(inst) };
  }
  const updates: Record<string, any> = {};
  if (args.paymentAmount !== undefined) updates.amount = Number(args.paymentAmount);
  if (args.paymentDate !== undefined) {
    updates.date = args.paymentDate;
    updates.month_key = args.paymentDate.substring(0, 7);
  }
  if (args.paymentMethod !== undefined) updates.payment_method = args.paymentMethod;
  if (args.notes !== undefined) updates.note = args.notes;
  return { ...updates, ...getUpdateMetadata(inst) };
}

async function deleteInstallmentPayment(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  inst: Record<string, any>;
  parentDebt: Record<string, any> | null;
  args: Record<string, any>;
}) {
  if (!params.args.confirm) {
    return { error: 'Confirmation Required: Deleting installment requires confirm: true.' };
  }
  const { data: deletedInst, error } = await params.supabase
    .from('debt_installments')
    .update(getSoftDeleteMetadata(params.inst))
    .eq('user_id', params.userId)
    .eq('id', params.args.installmentId)
    .select()
    .single();
  if (error) throw error;
  await reverseLinkedDebtTransaction(params.supabase, params.userId, params.inst.id);
  const updatedDebt = params.parentDebt
    ? await recomputeDebtFromInstallments(params.supabase, params.userId, params.parentDebt)
    : null;
  return { payload: { action: 'payment_deleted', installment: deletedInst, debtRecord: updatedDebt } };
}

async function fetchInstallmentWithParent(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  installmentId: string
) {
  const { data: inst, error: instErr } = await supabase
    .from('debt_installments')
    .select('*')
    .eq('user_id', userId)
    .eq('id', installmentId)
    .single();
  if (instErr || !inst) return { error: `Installment not found: ${installmentId}` };

  const { data: parentDebt } = await supabase
    .from('debt_records')
    .select('*')
    .eq('user_id', userId)
    .eq('id', inst.debt_id)
    .single();
  return { inst, parentDebt };
}

async function applyInstallmentUpdate(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  inst: Record<string, any>;
  parentDebt: Record<string, any> | null;
  args: Record<string, any>;
}) {
  const { supabase, userId, inst, parentDebt, args } = params;
  const { data: updatedInst, error } = await supabase
    .from('debt_installments')
    .update(buildInstallmentUpdatePatch(inst, args))
    .eq('user_id', userId)
    .eq('id', args.installmentId)
    .select()
    .single();
  if (error) throw error;

  const updatedDebt = parentDebt ? await recomputeDebtFromInstallments(supabase, userId, parentDebt) : null;
  const actionName = args.action === 'restore_payment' ? 'payment_restored' : 'payment_updated';
  return { payload: { action: actionName, installment: updatedInst, debtRecord: updatedDebt } };
}

export async function mutateInstallmentRecord(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: Record<string, any>
) {
  if (!args.installmentId) {
    return { error: `Validation Error: installmentId is required for ${args.action}.` };
  }

  const found = await fetchInstallmentWithParent(supabase, userId, args.installmentId);
  if (found.error || !found.inst) return { error: found.error };

  const { inst, parentDebt } = found;
  if (args.action === 'delete_payment') {
    return deleteInstallmentPayment({ supabase, userId, inst, parentDebt, args });
  }
  return applyInstallmentUpdate({ supabase, userId, inst, parentDebt, args });
}

function buildLinkedDebtTxPayload(params: {
  userId: string;
  existing: Record<string, any>;
  installmentId: string;
  paymentAmount: number;
  dateIst: string;
  txCategoryId: string;
  args: Record<string, any>;
}) {
  const { userId, existing, installmentId, paymentAmount, dateIst, txCategoryId, args } = params;
  const isRepayingBorrowed = existing.direction === 'borrowed';
  return {
    user_id: userId,
    title: isRepayingBorrowed ? `Repayment to ${existing.person_name}` : `Received from ${existing.person_name}`,
    merchant_name: existing.person_name,
    amount: paymentAmount,
    type: isRepayingBorrowed ? 'expense' : 'income',
    category_id: txCategoryId,
    account_id: args.linkedAccountId,
    date: dateIst,
    month_key: dateIst.substring(0, 7),
    linked_debt_id: args.debtId,
    linked_debt_installment_id: installmentId,
    notes: args.notes || `Friend debt repayment for "${existing.title}"`,
    tags: ['debt_payment', existing.bucket_type],
    ...getInsertMetadata(),
  };
}

async function createLinkedDebtTransaction(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  existing: Record<string, any>;
  installmentId: string;
  paymentAmount: number;
  dateIst: string;
  args: Record<string, any>;
}) {
  const { supabase, userId, existing, paymentAmount, dateIst, args } = params;
  const txCategoryId = await resolveFallbackFinanceCategoryId(supabase, userId, [
    'emis-debt-repayment',
    'other',
  ]);
  const txPayload = buildLinkedDebtTxPayload({
    userId,
    existing,
    installmentId: params.installmentId,
    paymentAmount,
    dateIst,
    txCategoryId,
    args,
  });
  const { data: tx } = await supabase.from('finance_transactions').insert(txPayload).select().single();
  const delta = existing.direction === 'borrowed' ? -paymentAmount : paymentAmount;
  await applyAccountBalanceDelta(supabase, userId, [{ accountId: args.linkedAccountId, delta }]);
  return tx;
}

function computePostPaymentBalances(existing: Record<string, any>, paymentAmount: number) {
  const newRepaid = Math.round((Number(existing.total_repaid_amount || 0) + paymentAmount) * 100) / 100;
  const newRemaining = Math.max(0, Math.round((Number(existing.principal_amount) - newRepaid) * 100) / 100);
  return { newRepaid, newRemaining, status: newRemaining <= 0 ? 'settled' : 'active' };
}

async function insertInstallmentAndUpdateDebt(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  existing: Record<string, any>;
  args: Record<string, any>;
  dateIst: string;
  paymentAmount: number;
}) {
  const { supabase, userId, existing, args, dateIst, paymentAmount } = params;
  const { newRepaid, newRemaining, status } = computePostPaymentBalances(existing, paymentAmount);

  const { data: createdInst, error: instErr } = await supabase
    .from('debt_installments')
    .insert({
      user_id: userId,
      debt_id: args.debtId,
      amount: paymentAmount,
      date: dateIst,
      month_key: dateIst.substring(0, 7),
      payment_method: args.paymentMethod ?? 'upi',
      note: args.notes ?? null,
      balance_after_payment: newRemaining,
      ...getInsertMetadata(),
    })
    .select()
    .single();
  if (instErr) throw instErr;

  const { data: updatedDebt, error: updateErr } = await supabase
    .from('debt_records')
    .update({
      total_repaid_amount: newRepaid,
      remaining_amount: newRemaining,
      status,
      ...getUpdateMetadata(existing),
    })
    .eq('id', args.debtId)
    .select()
    .single();
  if (updateErr) throw updateErr;

  return { createdInst, updatedDebt };
}

async function maybeCreateLinkedDebtTx(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  existing: Record<string, any>;
  installmentId: string;
  paymentAmount: number;
  dateIst: string;
  args: Record<string, any>;
}) {
  if (!params.args.linkedAccountId) return null;
  return createLinkedDebtTransaction(params);
}

export async function recordDebtPayment(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  existing: Record<string, any>;
  args: Record<string, any>;
  dateIst: string;
}) {
  const { supabase, userId, existing, args, dateIst } = params;
  if (!args.paymentAmount) {
    return { error: 'Validation Error: paymentAmount is required for record_payment.' };
  }

  const paymentAmount = Number(args.paymentAmount);
  const { createdInst, updatedDebt } = await insertInstallmentAndUpdateDebt({
    supabase,
    userId,
    existing,
    args,
    dateIst,
    paymentAmount,
  });

  const linkedTransaction = await maybeCreateLinkedDebtTx({
    supabase,
    userId,
    existing,
    installmentId: createdInst.id,
    paymentAmount,
    dateIst,
    args,
  });

  return {
    payload: {
      action: 'payment_recorded',
      debtRecord: updatedDebt,
      installment: createdInst,
      linkedTransaction,
    },
  };
}
