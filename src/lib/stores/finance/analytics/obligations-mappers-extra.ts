import { daysBetween } from '@/lib/finance/credit-card-cycles';
import type { DebtRecord, FinanceAccount, FinancialObligationItem } from '@/lib/types';
import { formatINR, type FinanceStore } from '../helpers';
import { makeDueDateStr, type ObligationWindow } from './obligations-mappers';

function isBorrowedActiveDebt(debt: DebtRecord): boolean {
  if (debt.direction !== 'borrowed' || debt.status !== 'active') return false;
  return !debt.deletedAt && debt.remainingAmount > 0;
}

export function toDebtObligation(
  debt: DebtRecord,
  state: FinanceStore,
  win: ObligationWindow
): FinancialObligationItem | null {
  if (!isBorrowedActiveDebt(debt)) return null;
  const dueDay = debt.dueDayOfMonth || 15;
  const daysUntilDue = dueDay - win.currentDay;
  if (daysUntilDue > win.withinDays) return null;

  const paidThisMonth = state.debtInstallments
    .filter((i) => i.debtId === debt.id && i.monthKey === win.currentMonthKey && !i.deletedAt)
    .reduce((sum, i) => sum + i.amount, 0);
  const planned = Math.min(
    debt.remainingAmount,
    debt.plannedMonthlyInstallment || debt.remainingAmount
  );
  const stillDue = Math.max(0, planned - paidThisMonth);
  if (stillDue <= 0) return null;

  return {
    id: `debt-${debt.id}`,
    sourceId: debt.id,
    type: 'debt',
    title: `Pay ${debt.personName} (Installment)`,
    subtitle: `${debt.title} · ${formatINR(debt.remainingAmount)} remaining`,
    amount: stillDue,
    dueDate: makeDueDateStr(win.currentMonthKey, dueDay),
    daysUntilDue,
    isOverdue: daysUntilDue < 0,
    status: 'pending',
  };
}

function isEligibleCardAccount(acc: FinanceAccount): boolean {
  if (acc.type !== 'credit_card') return false;
  return !acc.archived && !acc.deletedAt;
}

export function toCreditCardObligation(
  acc: FinanceAccount,
  state: FinanceStore,
  win: ObligationWindow
): FinancialObligationItem | null {
  if (!isEligibleCardAccount(acc)) return null;
  const summary = state.getCreditCardSummary(acc.id);
  const stmt = summary?.billedStatement ?? summary?.currentBilledStatement;
  if (!stmt || stmt.remainingDue <= 0) return null;

  const daysUntilDue = daysBetween(win.todayStr, stmt.dueDate);
  if (daysUntilDue > win.withinDays) return null;

  return {
    id: `cc-${acc.id}-${stmt.id}`,
    sourceId: acc.id,
    type: 'credit_card',
    title: `${acc.name} Bill Due`,
    subtitle: `Statement ${stmt.periodStart} to ${stmt.periodEnd}`,
    amount: stmt.remainingDue,
    dueDate: stmt.dueDate,
    daysUntilDue,
    isOverdue: daysUntilDue < 0,
    status: 'pending',
  };
}
