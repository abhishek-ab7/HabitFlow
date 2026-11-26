import type { EmiTracker, FinanceTransaction } from '@/lib/types';
import type { FinanceStore } from '../helpers';

function isEmiUnpaid(
  emi: EmiTracker,
  targetMonth: string,
  expenseTxs: FinanceTransaction[]
): boolean {
  if (emi.status !== 'active' || emi.deletedAt) return false;
  if (emi.paidMonths >= emi.tenureMonths || emi.lastPaidMonthKey === targetMonth) return false;
  return !expenseTxs.some((t) => t.linkedEmiId === emi.id);
}

function computePlannedDebtDue(state: FinanceStore, targetMonth: string): number {
  const activeBorrowed = state.debtRecords.filter(
    (d) =>
      d.direction === 'borrowed' &&
      d.status === 'active' &&
      !d.deletedAt &&
      d.remainingAmount > 0 &&
      d.repaymentSchedule === 'monthly_partial'
  );

  return activeBorrowed.reduce((total, debt) => {
    const planned = Math.min(
      debt.remainingAmount,
      debt.plannedMonthlyInstallment || debt.remainingAmount
    );
    const paidThisMonth = state.debtInstallments
      .filter((i) => i.debtId === debt.id && i.monthKey === targetMonth && !i.deletedAt)
      .reduce((sum, i) => sum + i.amount, 0);
    return total + Math.max(0, planned - paidThisMonth);
  }, 0);
}

function computeRemainingPlannedSips(
  state: FinanceStore,
  targetMonth: string,
  plannedSipTarget: number,
  totalInvested: number
): number {
  const activeSipsSum = state.sipPlans
    .filter((s) => s.isActive && !s.deletedAt && s.lastInvestedMonthKey !== targetMonth)
    .reduce((sum, s) => sum + s.monthlyAmount, 0);
  const gap = Math.max(0, plannedSipTarget - totalInvested);
  return Math.max(activeSipsSum, gap);
}

export function resolveBudgetTargets(
  state: FinanceStore,
  targetMonth: string,
  totalIncome: number,
  totalInvested: number
) {
  const budgetObj = state.budgets.find((b) => b.monthKey === targetMonth);
  const sumCatBudgets = state.categories
    .filter((c) => c.type === 'expense' || c.type === 'both')
    .reduce((sum, c) => sum + c.monthlyBudgetLimit, 0);
  const monthlyBudget = budgetObj?.totalBudget || sumCatBudgets;
  const expectedIncome = budgetObj?.expectedIncome || totalIncome;
  const remainingPlannedSips = computeRemainingPlannedSips(
    state,
    targetMonth,
    budgetObj?.plannedSipAmount || 0,
    totalInvested
  );

  return { monthlyBudget, expectedIncome, remainingPlannedSips };
}

export function computeUnpaidObligations(
  state: FinanceStore,
  targetMonth: string,
  expenseTxs: FinanceTransaction[]
) {
  const remainingUnpaidCommitments = state
    .getAllCommitmentLedgers(targetMonth)
    .reduce((sum, l) => sum + l.remainingBalance, 0);
  const remainingUnpaidEmis = state.emiTrackers
    .filter((emi) => isEmiUnpaid(emi, targetMonth, expenseTxs))
    .reduce((sum, e) => sum + e.emiAmount, 0);
  const plannedDebtInstallmentsDue = computePlannedDebtDue(state, targetMonth);
  const remainingUnpaidBills = state.recurringBills
    .filter((b) => b.isActive && !b.deletedAt && b.lastPaidMonthKey !== targetMonth)
    .reduce((sum, b) => sum + b.amount, 0);

  return {
    remainingUnpaidCommitments,
    remainingUnpaidEmis,
    plannedDebtInstallmentsDue,
    remainingUnpaidBills,
  };
}
