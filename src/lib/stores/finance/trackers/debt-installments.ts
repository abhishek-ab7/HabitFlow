import { db } from '@/lib/db';
import { CrossDomainActionMediator } from '../../mediator';
import type { DebtInstallment, DebtPaymentMethod, DebtRecord } from '@/lib/types';
import { notifyFinanceSync, type FinanceStore } from '../helpers';
import {
  createInstallmentTx,
  recomputeDebtAfterInstallmentChange,
  resolveAccountAndDebtCat,
  revertLinkedTxForDeletedInstallment,
  syncLinkedTxForUpdatedInstallment,
} from './debt-installment-sync';

async function notifyDebtEventNonBlocking(
  newStatus: DebtRecord['status'],
  txDate: string,
  amount: number
): Promise<void> {
  try {
    await CrossDomainActionMediator.onFinanceEvent({
      type: newStatus === 'settled' ? 'COMMITMENT_SETTLED' : 'EXPENSE_LOGGED',
      date: txDate,
      amount,
    });
  } catch {
    // Non-blocking
  }
}

async function persistInstallmentAndDebt(params: {
  debt: DebtRecord;
  amount: number;
  txDate: string;
  monthKey: string;
  paymentMethod: DebtPaymentMethod;
  installmentId: string;
  transactionId: string | null;
  note?: string;
  now: string;
}): Promise<DebtInstallment> {
  const { debt, amount, txDate, monthKey, paymentMethod, installmentId, transactionId, note, now } =
    params;
  const newRepaid = debt.totalRepaidAmount + amount;
  const newRemaining = Math.max(0, debt.principalAmount - newRepaid);
  const newStatus = newRemaining <= 0 ? 'settled' : 'active';

  const installment: DebtInstallment = {
    id: installmentId,
    userId: debt.userId,
    debtId: debt.id,
    amount,
    date: txDate,
    monthKey,
    paymentMethod,
    transactionId,
    note: note || `Installment payment (${paymentMethod.toUpperCase()})`,
    balanceAfterPayment: newRemaining,
    isDirty: true,
    generationCounter: 1,
    createdAt: now,
    updatedAt: now,
  };

  await db.debtInstallments.add(installment);
  await db.debtRecords.update(debt.id, {
    totalRepaidAmount: newRepaid,
    remainingAmount: newRemaining,
    status: newStatus,
    paidInstallments: debt.isEmi ? (debt.paidInstallments || 0) + 1 : debt.paidInstallments,
    isDirty: true,
    updatedAt: now,
  });
  return installment;
}

async function finalizeRecordedInstallment(params: {
  state: FinanceStore;
  userId: string;
  monthKey: string;
  txDate: string;
  amount: number;
  isSettled: boolean;
  creditCardId?: string;
}): Promise<void> {
  const { state, userId, monthKey, txDate, amount, isSettled, creditCardId } = params;
  await state.loadFinanceData(userId);
  await state.recordCurrentNetWorthSnapshot(monthKey);
  if (creditCardId) await state.syncCardStatements(creditCardId);
  notifyFinanceSync();
  await notifyDebtEventNonBlocking(isSettled ? 'settled' : 'active', txDate, amount);
}

async function maybeCreateInstallmentTx(params: {
  debt: DebtRecord;
  amount: number;
  txDate: string;
  monthKey: string;
  newRemaining: number;
  selectedAccount: ReturnType<typeof resolveAccountAndDebtCat>['selectedAccount'];
  debtCat: ReturnType<typeof resolveAccountAndDebtCat>['debtCat'];
  installmentId: string;
  transactionId: string;
  note?: string;
  splitGroupId?: string;
  now: string;
}): Promise<string | null> {
  const { selectedAccount, debtCat } = params;
  if (!selectedAccount || !debtCat) return null;

  await createInstallmentTx({
    debt: params.debt,
    amount: params.amount,
    txDate: params.txDate,
    monthKey: params.monthKey,
    newRemaining: params.newRemaining,
    accountId: selectedAccount.id,
    accountBalance: selectedAccount.balance,
    categoryId: debtCat.id,
    installmentId: params.installmentId,
    transactionId: params.transactionId,
    note: params.note,
    splitGroupId: params.splitGroupId,
    now: params.now,
  });
  return params.transactionId;
}

export async function recordDebtInstallmentImpl(
  state: FinanceStore,
  params: {
    debtId: string;
    amount: number;
    date?: string;
    paymentMethod: DebtPaymentMethod;
    accountId?: string;
    categoryId?: string;
    note?: string;
    splitGroupId?: string;
  }
): Promise<DebtInstallment | null> {
  const debt = state.debtRecords.find((d) => d.id === params.debtId);
  if (!debt || params.amount <= 0) return null;

  const amount = Number(params.amount);
  const now = new Date().toISOString();
  const txDate = params.date || now.split('T')[0];
  const monthKey = txDate.slice(0, 7);
  const newRemaining = Math.max(0, debt.principalAmount - (debt.totalRepaidAmount + amount));

  const { selectedAccount, debtCat } = resolveAccountAndDebtCat(
    state,
    params.accountId,
    params.categoryId
  );
  const installmentId = crypto.randomUUID();
  const txId = await maybeCreateInstallmentTx({
    debt,
    amount,
    txDate,
    monthKey,
    newRemaining,
    selectedAccount,
    debtCat,
    installmentId,
    transactionId: crypto.randomUUID(),
    note: params.note,
    splitGroupId: params.splitGroupId,
    now,
  });

  const installment = await persistInstallmentAndDebt({
    debt,
    amount,
    txDate,
    monthKey,
    paymentMethod: params.paymentMethod,
    installmentId,
    transactionId: txId,
    note: params.note,
    now,
  });

  await finalizeRecordedInstallment({
    state,
    userId: debt.userId,
    monthKey,
    txDate,
    amount,
    isSettled: newRemaining <= 0,
    creditCardId: selectedAccount?.type === 'credit_card' ? selectedAccount.id : undefined,
  });
  return installment;
}

export async function updateDebtInstallmentImpl(
  state: FinanceStore,
  id: string,
  data: { amount?: number; date?: string; paymentMethod?: DebtPaymentMethod; note?: string }
): Promise<void> {
  const existing = await db.debtInstallments.get(id);
  if (!existing || existing.deletedAt) return;
  const debt = await db.debtRecords.get(existing.debtId);
  if (!debt) return;

  const now = new Date().toISOString();
  const nextAmount =
    data.amount !== undefined ? Math.max(1, Number(data.amount)) : existing.amount;
  const nextDate = data.date || existing.date;
  const nextMonthKey = nextDate.slice(0, 7);

  await db.debtInstallments.update(id, {
    amount: nextAmount,
    date: nextDate,
    monthKey: nextMonthKey,
    paymentMethod: data.paymentMethod ?? existing.paymentMethod,
    note: data.note !== undefined ? data.note : existing.note,
    isDirty: true,
    generationCounter: (existing.generationCounter || 1) + 1,
    updatedAt: now,
  });

  const newRemaining = await recomputeDebtAfterInstallmentChange(debt, now, id);
  await syncLinkedTxForUpdatedInstallment({
    existing,
    nextAmount,
    nextDate,
    nextMonthKey,
    newRemaining,
    note: data.note,
    now,
  });

  await state.loadFinanceData(debt.userId);
  await state.recordCurrentNetWorthSnapshot(nextMonthKey);
  notifyFinanceSync();
}

export async function deleteDebtInstallmentImpl(
  state: FinanceStore,
  id: string
): Promise<void> {
  const existing = await db.debtInstallments.get(id);
  if (!existing || existing.deletedAt) return;
  const debt = await db.debtRecords.get(existing.debtId);
  if (!debt) return;

  const now = new Date().toISOString();
  await db.debtInstallments.update(id, {
    deletedAt: now,
    isDirty: true,
    generationCounter: (existing.generationCounter || 1) + 1,
    updatedAt: now,
  });

  await revertLinkedTxForDeletedInstallment(existing.transactionId, now);
  await recomputeDebtAfterInstallmentChange(debt, now);
  await state.loadFinanceData(debt.userId);
  await state.recordCurrentNetWorthSnapshot();
  notifyFinanceSync();
}
