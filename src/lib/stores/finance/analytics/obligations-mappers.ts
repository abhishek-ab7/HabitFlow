import type {
  CommitmentLedgerSummary,
  EmiTracker,
  FinancialObligationItem,
} from '@/lib/types';
import { formatINR, type FinanceStore } from '../helpers';
export { toDebtObligation, toCreditCardObligation } from './obligations-mappers-extra';

export interface ObligationWindow {
  currentDay: number;
  currentMonthKey: string;
  withinDays: number;
  todayStr: string;
}

export function makeDueDateStr(currentMonthKey: string, dayOfMonth: number): string {
  const paddedDay = String(Math.min(28, Math.max(1, dayOfMonth))).padStart(2, '0');
  return `${currentMonthKey}-${paddedDay}`;
}

function isEmiEligible(emi: EmiTracker, state: FinanceStore, monthKey: string): boolean {
  if (emi.status !== 'active' || emi.deletedAt) return false;
  if (emi.paidMonths >= emi.tenureMonths || emi.lastPaidMonthKey === monthKey) return false;
  return !state.transactions.some(
    (t) => t.linkedEmiId === emi.id && t.monthKey === monthKey && !t.deletedAt
  );
}

export function toEmiObligation(
  emi: EmiTracker,
  state: FinanceStore,
  win: ObligationWindow
): FinancialObligationItem | null {
  if (!isEmiEligible(emi, state, win.currentMonthKey)) return null;
  const daysUntilDue = emi.billingDayOfMonth - win.currentDay;
  if (daysUntilDue > win.withinDays) return null;

  return {
    id: `emi-${emi.id}`,
    sourceId: emi.id,
    type: 'emi',
    title: `${emi.loanName} EMI`,
    subtitle: `${emi.lenderName} · Month ${emi.paidMonths + 1}/${emi.tenureMonths}`,
    amount: emi.emiAmount,
    dueDate: makeDueDateStr(win.currentMonthKey, emi.billingDayOfMonth),
    daysUntilDue,
    isOverdue: daysUntilDue < 0,
    status: 'pending',
  };
}

export function toCommitmentObligation(
  ledger: CommitmentLedgerSummary,
  win: ObligationWindow
): FinancialObligationItem | null {
  const daysUntilDue = ledger.commitment.dueDayOfMonth - win.currentDay;
  if (ledger.remainingBalance <= 0 || daysUntilDue > win.withinDays) return null;

  return {
    id: `commitment-${ledger.commitment.id}`,
    sourceId: ledger.commitment.id,
    type: 'commitment',
    title: `${ledger.commitment.title} (${ledger.commitment.recipientName})`,
    subtitle: `${formatINR(ledger.totalFulfilledAmount)} fulfilled · ${formatINR(
      ledger.remainingBalance
    )} left`,
    amount: ledger.remainingBalance,
    dueDate: makeDueDateStr(win.currentMonthKey, ledger.commitment.dueDayOfMonth),
    daysUntilDue,
    isOverdue: daysUntilDue < 0,
    status: 'pending',
  };
}

export function toScheduledItemObligation(params: {
  id: string;
  type: 'bill' | 'sip';
  title: string;
  subtitle: string;
  amount: number;
  dayOfMonth: number;
  isActive: boolean;
  deletedAt?: string | null;
  lastPaidMonthKey?: string | null;
  win: ObligationWindow;
}): FinancialObligationItem | null {
  const { id, type, title, subtitle, amount, dayOfMonth, isActive, deletedAt, lastPaidMonthKey, win } =
    params;
  if (!isActive || deletedAt) return null;
  if (lastPaidMonthKey === win.currentMonthKey) return null;
  const daysUntilDue = dayOfMonth - win.currentDay;
  if (daysUntilDue > win.withinDays) return null;

  return {
    id: `${type}-${id}`,
    sourceId: id,
    type,
    title,
    subtitle,
    amount,
    dueDate: makeDueDateStr(win.currentMonthKey, dayOfMonth),
    daysUntilDue,
    isOverdue: daysUntilDue < 0,
    status: 'pending',
  };
}
