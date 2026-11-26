import { db } from '@/lib/db';
import type { DebtRecord, FinanceTransaction } from '@/lib/types';
import { formatINR, type FinanceStore } from '../helpers';

export function resolveAccountAndDebtCat(
  state: FinanceStore,
  accountId?: string,
  categoryId?: string
) {
  const selectedAccount =
    (accountId && state.accounts.find((a) => a.id === accountId)) ||
    state.accounts.find((a) => a.isDefault) ||
    state.accounts[0];
  const debtCat =
    (categoryId && state.categories.find((c) => c.id === categoryId)) ||
    state.categories.find((c) => c.slug === 'emis-debt-repayment') ||
    state.categories[0];
  return { selectedAccount, debtCat };
}

export async function createInstallmentTx(params: {
  debt: DebtRecord;
  amount: number;
  txDate: string;
  monthKey: string;
  newRemaining: number;
  accountId: string;
  accountBalance: number;
  categoryId: string;
  installmentId: string;
  transactionId: string;
  note?: string;
  splitGroupId?: string;
  now: string;
}): Promise<void> {
  const { debt, amount, txDate, monthKey, newRemaining, accountId, accountBalance, categoryId, now } =
    params;
  const txType = debt.direction === 'borrowed' ? 'expense' : 'income';
  const tags = ['debt-installment', debt.personName.toLowerCase()];
  if (params.splitGroupId) tags.push('split');

  const tx: FinanceTransaction = {
    id: params.transactionId,
    userId: debt.userId,
    title:
      debt.direction === 'borrowed'
        ? `Debt Installment Paid to ${debt.personName}`
        : `Debt Repayment Received from ${debt.personName}`,
    amount,
    type: txType,
    categoryId,
    subcategory: 'Friend Debt Repayment',
    accountId,
    date: txDate,
    monthKey,
    notes:
      params.note ||
      `Partial installment (${formatINR(amount)}). Remaining balance: ${formatINR(newRemaining)}`,
    tags: Array.from(new Set(tags)),
    isRecurring: false,
    linkedDebtId: debt.id,
    linkedDebtInstallmentId: params.installmentId,
    splitGroupId: params.splitGroupId || null,
    isDirty: true,
    generationCounter: 1,
    createdAt: now,
    updatedAt: now,
  };

  await db.financeTransactions.add(tx);
  const delta = txType === 'income' ? amount : -amount;
  await db.financeAccounts.update(accountId, {
    balance: accountBalance + delta,
    isDirty: true,
    updatedAt: now,
  });
}
