import { toast } from 'sonner';
import { db } from '@/lib/db';
import type {
  DebtInstallment,
  DebtRecord,
  FinanceAccount,
  FinanceCategory,
  FinanceTransaction,
} from '@/lib/types';
import { formatINR } from '../helpers';

export async function adjustAccountBalance(
  account: FinanceAccount | undefined,
  delta: number,
  now: string
): Promise<void> {
  if (!account) return;
  await db.financeAccounts.update(account.id, {
    balance: account.balance + delta,
    isDirty: true,
    updatedAt: now,
  });
}

export async function recordLinkedDebtOffset(params: {
  tx: FinanceTransaction;
  debt: DebtRecord;
  userId: string;
  now: string;
}): Promise<void> {
  const { tx, debt, userId, now } = params;
  const newRepaid = debt.totalRepaidAmount + tx.amount;
  const newRemaining = Math.max(0, debt.principalAmount - newRepaid);
  const installmentId = crypto.randomUUID();
  tx.linkedDebtInstallmentId = installmentId;

  const installment: DebtInstallment = {
    id: installmentId,
    userId,
    debtId: debt.id,
    amount: tx.amount,
    date: tx.date,
    monthKey: tx.monthKey,
    paymentMethod: 'offset_expense',
    transactionId: tx.id,
    note: tx.title,
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
    status: newRemaining <= 0 ? 'settled' : 'active',
    isDirty: true,
    updatedAt: now,
  });
}

export async function revertLinkedDebtOffset(
  existing: FinanceTransaction,
  debt: DebtRecord | undefined,
  now: string
): Promise<void> {
  if (!existing.linkedDebtId || !existing.linkedDebtInstallmentId) return;

  if (debt) {
    const newRepaid = Math.max(0, debt.totalRepaidAmount - existing.amount);
    const newRemaining = Math.max(0, debt.principalAmount - newRepaid);
    await db.debtRecords.update(debt.id, {
      totalRepaidAmount: newRepaid,
      remainingAmount: newRemaining,
      status: newRemaining > 0 ? 'active' : 'settled',
      isDirty: true,
      updatedAt: now,
    });
  }

  await db.debtInstallments.update(existing.linkedDebtInstallmentId, {
    deletedAt: now,
    isDirty: true,
    updatedAt: now,
  });
}

export function notifyBudgetThresholdIfExceeded(params: {
  cat: FinanceCategory | undefined;
  transactions: FinanceTransaction[];
  monthKey: string;
}): void {
  const { cat, transactions, monthKey } = params;
  if (!cat || cat.monthlyBudgetLimit <= 0) return;

  const spent = transactions
    .filter((i) => i.type === 'expense' && i.categoryId === cat.id && i.monthKey === monthKey)
    .reduce((sum, item) => sum + item.amount, 0);
  const pct = (spent / cat.monthlyBudgetLimit) * 100;
  if (pct <= 90) return;

  const roundedPct = Math.round(pct);
  const toastId = `budget-alert-${cat.id}-${monthKey}`;
  if (pct >= 100) {
    toast.error(`Budget Exceeded: ${cat.name} reached ${roundedPct}% of monthly limit`, {
      id: toastId,
      description: `${formatINR(spent)} spent of ${formatINR(cat.monthlyBudgetLimit)} budget.`,
      duration: 6000,
    });
    return;
  }

  const remaining = Math.max(0, cat.monthlyBudgetLimit - spent);
  toast.warning(`Budget Alert: ${cat.name} crossed ${roundedPct}% of monthly budget`, {
    id: toastId,
    description: `${formatINR(spent)} spent · ${formatINR(remaining)} left of ${formatINR(
      cat.monthlyBudgetLimit
    )}.`,
    duration: 6000,
  });
}
