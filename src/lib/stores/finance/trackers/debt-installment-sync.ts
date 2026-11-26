import { db } from '@/lib/db';
import type { DebtInstallment, DebtRecord } from '@/lib/types';
import { formatINR } from '../helpers';
export { createInstallmentTx, resolveAccountAndDebtCat } from './debt-installment-tx';

async function syncSingleInstallmentBalance(
  item: DebtInstallment,
  balAfter: number,
  forceTouchId: string | undefined,
  now: string
): Promise<void> {
  if (item.balanceAfterPayment === balAfter && item.id !== forceTouchId) return;
  await db.debtInstallments.update(item.id, {
    balanceAfterPayment: balAfter,
    isDirty: true,
    generationCounter: (item.generationCounter || 1) + 1,
    updatedAt: now,
  });
}

export async function recomputeDebtAfterInstallmentChange(
  debt: DebtRecord,
  now: string,
  forceTouchId?: string
): Promise<number> {
  const allInsts = (await db.debtInstallments.where('debtId').equals(debt.id).toArray())
    .filter((item) => !item.deletedAt)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  let runningRepaid = 0;
  for (const item of allInsts) {
    runningRepaid += Number(item.amount || 0);
    const balAfter = Math.max(0, debt.principalAmount - runningRepaid);
    await syncSingleInstallmentBalance(item, balAfter, forceTouchId, now);
  }

  const newRemaining = Math.max(0, debt.principalAmount - runningRepaid);
  const newStatus =
    debt.status === 'archived' ? 'archived' : newRemaining <= 0 ? 'settled' : 'active';
  await db.debtRecords.update(debt.id, {
    totalRepaidAmount: runningRepaid,
    remainingAmount: newRemaining,
    status: newStatus,
    isDirty: true,
    generationCounter: (debt.generationCounter || 1) + 1,
    updatedAt: now,
  });
  return newRemaining;
}

async function adjustAccountOnTxUpdate(params: {
  accountId: string;
  txType: string;
  amountDelta: number;
  now: string;
}): Promise<void> {
  if (params.amountDelta === 0) return;
  const acc = await db.financeAccounts.get(params.accountId);
  if (!acc) return;

  const delta = params.txType === 'income' ? params.amountDelta : -params.amountDelta;
  await db.financeAccounts.update(acc.id, {
    balance: acc.balance + delta,
    isDirty: true,
    generationCounter: (acc.generationCounter || 1) + 1,
    updatedAt: params.now,
  });
}

export async function syncLinkedTxForUpdatedInstallment(params: {
  existing: DebtInstallment;
  nextAmount: number;
  nextDate: string;
  nextMonthKey: string;
  newRemaining: number;
  note?: string;
  now: string;
}): Promise<void> {
  if (!params.existing.transactionId) return;
  const linkedTx = await db.financeTransactions.get(params.existing.transactionId);
  if (!linkedTx || linkedTx.deletedAt) return;

  const nextNotes =
    params.note !== undefined
      ? params.note ||
        `Installment (${formatINR(params.nextAmount)}). Remaining: ${formatINR(params.newRemaining)}`
      : linkedTx.notes;

  await db.financeTransactions.update(linkedTx.id, {
    amount: params.nextAmount,
    date: params.nextDate,
    monthKey: params.nextMonthKey,
    notes: nextNotes,
    isDirty: true,
    generationCounter: (linkedTx.generationCounter || 1) + 1,
    updatedAt: params.now,
  });

  await adjustAccountOnTxUpdate({
    accountId: linkedTx.accountId,
    txType: linkedTx.type,
    amountDelta: params.nextAmount - params.existing.amount,
    now: params.now,
  });
}

export async function revertLinkedTxForDeletedInstallment(
  transactionId: string | null | undefined,
  now: string
): Promise<void> {
  if (!transactionId) return;
  const linkedTx = await db.financeTransactions.get(transactionId);
  if (!linkedTx || linkedTx.deletedAt) return;

  const acc = await db.financeAccounts.get(linkedTx.accountId);
  if (acc) {
    const reverseDelta = linkedTx.type === 'income' ? -linkedTx.amount : linkedTx.amount;
    await db.financeAccounts.update(acc.id, {
      balance: acc.balance + reverseDelta,
      isDirty: true,
      generationCounter: (acc.generationCounter || 1) + 1,
      updatedAt: now,
    });
  }

  await db.financeTransactions.update(linkedTx.id, {
    deletedAt: now,
    isDirty: true,
    generationCounter: (linkedTx.generationCounter || 1) + 1,
    updatedAt: now,
  });
}
