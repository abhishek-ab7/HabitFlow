import { db } from '@/lib/db';
import type {
  DebtInstallment,
  DebtPaymentMethod,
  DebtRecord,
  FinanceTransaction,
} from '@/lib/types';
import { formatINR, notifyFinanceSync, resolveCurrentUserId, type FinanceStore } from '../helpers';

function resolveNextDebtStatus(
  existingStatus: DebtRecord['status'],
  requestedStatus: DebtRecord['status'] | undefined,
  nextRemaining: number
): DebtRecord['status'] {
  if (requestedStatus === 'archived') return 'archived';
  if (requestedStatus) return requestedStatus;
  if (existingStatus === 'archived') return 'archived';
  return nextRemaining <= 0 ? 'settled' : 'active';
}

function resolveNextDebtColor(
  existing: DebtRecord,
  data: Partial<DebtRecord>,
  nextDirection: DebtRecord['direction']
): string {
  if (data.color) return data.color;
  if (data.direction && data.direction !== existing.direction) {
    return nextDirection === 'borrowed' ? '#f43f5e' : '#10b981';
  }
  return existing.color;
}

export async function updateDebtRecordImpl(
  state: FinanceStore,
  id: string,
  data: Partial<DebtRecord>
): Promise<void> {
  const existing = state.debtRecords.find((d) => d.id === id) || (await db.debtRecords.get(id));
  if (!existing) return;

  const nextPrincipal =
    data.principalAmount !== undefined
      ? Math.max(0, Number(data.principalAmount))
      : existing.principalAmount;
  const nextRepaid =
    data.totalRepaidAmount !== undefined
      ? Math.max(0, Number(data.totalRepaidAmount))
      : existing.totalRepaidAmount;
  const nextRemaining = Math.max(0, nextPrincipal - nextRepaid);
  const nextDirection = data.direction ?? existing.direction;

  await db.debtRecords.update(id, {
    ...data,
    direction: nextDirection,
    color: resolveNextDebtColor(existing, data, nextDirection),
    principalAmount: nextPrincipal,
    totalRepaidAmount: nextRepaid,
    remainingAmount: nextRemaining,
    status: resolveNextDebtStatus(existing.status, data.status, nextRemaining),
    isDirty: true,
    generationCounter: (existing.generationCounter || 1) + 1,
    updatedAt: new Date().toISOString(),
  });

  await state.loadFinanceData(existing.userId);
  await state.recordCurrentNetWorthSnapshot();
  notifyFinanceSync();
}

function findEverydaySplits(debtRecords: DebtRecord[], key: string): DebtRecord[] {
  return debtRecords.filter(
    (d) =>
      !d.deletedAt &&
      d.status === 'active' &&
      d.bucketType === 'everyday_split' &&
      d.personName.trim().toLowerCase() === key
  );
}

async function createEverydaySettlementTx(params: {
  state: FinanceStore;
  userId: string;
  friendDisplayName: string;
  key: string;
  net: number;
  txDate: string;
  monthKey: string;
  options: { accountId?: string; paymentMethod: DebtPaymentMethod; note?: string };
  now: string;
}): Promise<FinanceTransaction | null> {
  const { state, userId, friendDisplayName, key, net, txDate, monthKey, options, now } = params;
  const absNet = Math.abs(net);
  if (absNet <= 0) return null;

  const selectedAccount =
    (options.accountId && state.accounts.find((a) => a.id === options.accountId)) ||
    state.accounts.find((a) => a.isDefault) ||
    state.accounts[0];
  const debtCat =
    state.categories.find((c) => c.slug === 'emis-debt-repayment') || state.categories[0];
  if (!selectedAccount || !debtCat) return null;

  const txType = net > 0 ? 'income' : 'expense';
  const tx: FinanceTransaction = {
    id: crypto.randomUUID(),
    userId,
    title: `Settled Everyday Tab with ${friendDisplayName}`,
    amount: absNet,
    type: txType,
    categoryId: debtCat.id,
    subcategory: 'Everyday Split Settlement',
    accountId: selectedAccount.id,
    date: txDate,
    monthKey,
    notes:
      options.note ||
      `Settled everyday split tab via ${options.paymentMethod.toUpperCase()} (${formatINR(absNet)})`,
    tags: ['tab-settlement', key],
    isRecurring: false,
    isDirty: true,
    generationCounter: 1,
    createdAt: now,
    updatedAt: now,
  };

  await db.financeTransactions.add(tx);
  const delta = txType === 'income' ? absNet : -absNet;
  await db.financeAccounts.update(selectedAccount.id, {
    balance: selectedAccount.balance + delta,
    isDirty: true,
    updatedAt: now,
  });
  if (selectedAccount.type === 'credit_card') await state.syncCardStatements(selectedAccount.id);
  return tx;
}

export async function settleEverydayTabImpl(
  state: FinanceStore,
  normalizedFriendName: string,
  options: { accountId?: string; paymentMethod: DebtPaymentMethod; date?: string; note?: string }
): Promise<FinanceTransaction | null> {
  const userId = await resolveCurrentUserId(undefined, state.currentUserId);
  const key = normalizedFriendName.trim().toLowerCase();
  const activeSplits = findEverydaySplits(state.debtRecords, key);
  if (activeSplits.length === 0) return null;

  const lentTotal = activeSplits
    .filter((d) => d.direction === 'lent')
    .reduce((sum, d) => sum + d.remainingAmount, 0);
  const borrowedTotal = activeSplits
    .filter((d) => d.direction === 'borrowed')
    .reduce((sum, d) => sum + d.remainingAmount, 0);
  const net = lentTotal - borrowedTotal;

  const now = new Date().toISOString();
  const txDate = options.date || now.split('T')[0];
  const monthKey = txDate.slice(0, 7);

  for (const split of activeSplits) {
    await db.debtRecords.update(split.id, {
      remainingAmount: 0,
      totalRepaidAmount: split.principalAmount,
      status: 'settled',
      isDirty: true,
      generationCounter: (split.generationCounter || 1) + 1,
      updatedAt: now,
    });
  }

  const tx = await createEverydaySettlementTx({
    state,
    userId,
    friendDisplayName: activeSplits[0].personName,
    key,
    net,
    txDate,
    monthKey,
    options,
    now,
  });

  await state.loadFinanceData(userId);
  await state.recordCurrentNetWorthSnapshot(monthKey);
  notifyFinanceSync();
  return tx;
}

async function absorbEligibleSplits(
  eligibleSplits: DebtRecord[],
  amount: number,
  now: string
): Promise<void> {
  let remainingToAbsorb = amount;
  for (const split of eligibleSplits) {
    if (remainingToAbsorb <= 0) break;
    const absorb = Math.min(split.remainingAmount, remainingToAbsorb);
    const nextRemaining = split.remainingAmount - absorb;
    await db.debtRecords.update(split.id, {
      remainingAmount: nextRemaining,
      totalRepaidAmount: split.totalRepaidAmount + absorb,
      status: nextRemaining <= 0 ? 'settled' : 'active',
      isDirty: true,
      generationCounter: (split.generationCounter || 1) + 1,
      updatedAt: now,
    });
    remainingToAbsorb -= absorb;
  }
}

async function recordOffsetInstallmentOnLoan(params: {
  targetLoan: DebtRecord;
  amount: number;
  today: string;
  monthKey: string;
  now: string;
}): Promise<void> {
  const { targetLoan, amount, today, monthKey, now } = params;
  const newLoanRepaid = targetLoan.totalRepaidAmount + amount;
  const newLoanRemaining = Math.max(0, targetLoan.principalAmount - newLoanRepaid);

  const installment: DebtInstallment = {
    id: crypto.randomUUID(),
    userId: targetLoan.userId,
    debtId: targetLoan.id,
    amount,
    date: today,
    monthKey,
    paymentMethod: 'offset_expense',
    transactionId: null,
    note: `Offset ${formatINR(amount)} against everyday tab split`,
    balanceAfterPayment: newLoanRemaining,
    isDirty: true,
    generationCounter: 1,
    createdAt: now,
    updatedAt: now,
  };

  await db.debtInstallments.add(installment);
  await db.debtRecords.update(targetLoan.id, {
    totalRepaidAmount: newLoanRepaid,
    remainingAmount: newLoanRemaining,
    status: newLoanRemaining <= 0 ? 'settled' : 'active',
    paidInstallments: targetLoan.isEmi
      ? (targetLoan.paidInstallments || 0) + 1
      : targetLoan.paidInstallments,
    isDirty: true,
    generationCounter: (targetLoan.generationCounter || 1) + 1,
    updatedAt: now,
  });
}

export async function offsetSplitAgainstLoanImpl(
  state: FinanceStore,
  friendKey: string,
  loanId: string,
  amount: number
): Promise<boolean> {
  if (amount <= 0) return false;
  const targetLoan = state.debtRecords.find((d) => d.id === loanId);
  if (!targetLoan || targetLoan.remainingAmount < amount) return false;

  const key = friendKey.trim().toLowerCase();
  const requiredDir = targetLoan.direction === 'borrowed' ? 'lent' : 'borrowed';
  const eligibleSplits = findEverydaySplits(state.debtRecords, key).filter(
    (d) => d.direction === requiredDir
  );
  const totalEligible = eligibleSplits.reduce((sum, d) => sum + d.remainingAmount, 0);
  if (totalEligible < amount) return false;

  const now = new Date().toISOString();
  const today = now.split('T')[0];
  const monthKey = today.slice(0, 7);

  await recordOffsetInstallmentOnLoan({ targetLoan, amount, today, monthKey, now });
  await absorbEligibleSplits(eligibleSplits, amount, now);
  await state.loadFinanceData(targetLoan.userId);
  await state.recordCurrentNetWorthSnapshot(monthKey);
  notifyFinanceSync();
  return true;
}
