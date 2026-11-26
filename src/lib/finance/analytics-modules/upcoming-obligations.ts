import type {
  DebtInstallment,
  DebtRecord,
  EmiTracker,
  FinanceRecurringBill,
  FinanceSipPlan,
  FinanceTransaction,
  FinancialObligationItem,
  MonthlyCommitment,
} from '@/lib/types';
import { formatINR } from '@/lib/stores/finance/helpers';
import { calculateCommitmentLedger } from './monthly-summary';

interface ObligationWindow {
  currentDay: number;
  currentMonthKey: string;
  withinDays: number;
}

function makeDueDateStr(currentMonthKey: string, dayOfMonth: number): string {
  const paddedDay = String(Math.min(28, Math.max(1, dayOfMonth))).padStart(2, '0');
  return `${currentMonthKey}-${paddedDay}`;
}

function isEmiActiveAndDue(
  emi: EmiTracker,
  transactions: FinanceTransaction[],
  win: ObligationWindow
): boolean {
  const isActive = emi.status === 'active' && emi.paidMonths < emi.tenureMonths && !emi.deletedAt;
  if (!isActive) return false;
  const isPaid =
    emi.lastPaidMonthKey === win.currentMonthKey ||
    transactions.some((t) => t.linkedEmiId === emi.id && t.monthKey === win.currentMonthKey && !t.deletedAt);
  return !isPaid && emi.billingDayOfMonth - win.currentDay <= win.withinDays;
}

function collectEmiObligations(
  emiTrackers: EmiTracker[],
  transactions: FinanceTransaction[],
  win: ObligationWindow
): FinancialObligationItem[] {
  return emiTrackers
    .filter((emi) => isEmiActiveAndDue(emi, transactions, win))
    .map((emi) => {
      const daysUntilDue = emi.billingDayOfMonth - win.currentDay;
      return {
        id: `emi-${emi.id}`,
        sourceId: emi.id,
        type: 'emi' as const,
        title: `${emi.loanName} EMI`,
        subtitle: `${emi.lenderName} · Month ${emi.paidMonths + 1}/${emi.tenureMonths}`,
        amount: emi.emiAmount,
        dueDate: makeDueDateStr(win.currentMonthKey, emi.billingDayOfMonth),
        daysUntilDue,
        isOverdue: daysUntilDue < 0,
        status: 'pending' as const,
      };
    });
}

function collectCommitmentObligations(
  commitments: MonthlyCommitment[],
  transactions: FinanceTransaction[],
  win: ObligationWindow
): FinancialObligationItem[] {
  const items: FinancialObligationItem[] = [];
  for (const c of commitments) {
    if (!c.isActive || c.deletedAt) continue;
    const ledger = calculateCommitmentLedger(c, win.currentMonthKey, transactions);
    const daysUntilDue = ledger.commitment.dueDayOfMonth - win.currentDay;
    if (ledger.remainingBalance <= 0 || daysUntilDue > win.withinDays) continue;
    items.push({
      id: `commitment-${ledger.commitment.id}`,
      sourceId: ledger.commitment.id,
      type: 'commitment',
      title: `${ledger.commitment.title} (${ledger.commitment.recipientName})`,
      subtitle: `${formatINR(ledger.totalFulfilledAmount)} fulfilled · ${formatINR(ledger.remainingBalance)} left`,
      amount: ledger.remainingBalance,
      dueDate: makeDueDateStr(win.currentMonthKey, ledger.commitment.dueDayOfMonth),
      daysUntilDue,
      isOverdue: daysUntilDue < 0,
      status: 'pending',
    });
  }
  return items;
}

function isOpenBorrowedDebt(debt: DebtRecord): boolean {
  return debt.direction === 'borrowed' && debt.status === 'active' && !debt.deletedAt && debt.remainingAmount > 0;
}

function computeDebtInstallmentStillDue(
  debt: DebtRecord,
  debtInstallments: DebtInstallment[],
  monthKey: string
): number {
  const paidThisMonth = debtInstallments
    .filter((i) => i.debtId === debt.id && i.monthKey === monthKey && !i.deletedAt)
    .reduce((sum, i) => sum + i.amount, 0);
  const planned = Math.min(debt.remainingAmount, debt.plannedMonthlyInstallment || debt.remainingAmount);
  return Math.max(0, planned - paidThisMonth);
}

function collectDebtObligations(
  debtRecords: DebtRecord[],
  debtInstallments: DebtInstallment[],
  win: ObligationWindow
): FinancialObligationItem[] {
  const items: FinancialObligationItem[] = [];
  for (const debt of debtRecords) {
    if (!isOpenBorrowedDebt(debt)) continue;
    const dueDay = debt.dueDayOfMonth || 15;
    const daysUntilDue = dueDay - win.currentDay;
    const stillDue = computeDebtInstallmentStillDue(debt, debtInstallments, win.currentMonthKey);
    if (stillDue <= 0 || daysUntilDue > win.withinDays) continue;

    items.push({
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
    });
  }
  return items;
}

function collectMonthlyScheduleItems<T extends { id: string; isActive: boolean; deletedAt?: string | null }>(
  items: T[],
  win: ObligationWindow,
  mapper: (item: T) => {
    lastPaidMonthKey?: string;
    dueDay: number;
    type: 'bill' | 'sip';
    title: string;
    subtitle: string;
    amount: number;
  }
): FinancialObligationItem[] {
  return items
    .filter((item) => item.isActive && !item.deletedAt)
    .map((item) => ({ item, meta: mapper(item) }))
    .filter(({ meta }) => meta.lastPaidMonthKey !== win.currentMonthKey && meta.dueDay - win.currentDay <= win.withinDays)
    .map(({ item, meta }) => {
      const daysUntilDue = meta.dueDay - win.currentDay;
      return {
        id: `${meta.type}-${item.id}`,
        sourceId: item.id,
        type: meta.type,
        title: meta.title,
        subtitle: meta.subtitle,
        amount: meta.amount,
        dueDate: makeDueDateStr(win.currentMonthKey, meta.dueDay),
        daysUntilDue,
        isOverdue: daysUntilDue < 0,
        status: 'pending' as const,
      };
    });
}

export function calculateUpcomingFinancialObligations(input: {
  emiTrackers: EmiTracker[];
  commitments: MonthlyCommitment[];
  debtRecords: DebtRecord[];
  debtInstallments: DebtInstallment[];
  recurringBills: FinanceRecurringBill[];
  sipPlans: FinanceSipPlan[];
  transactions: FinanceTransaction[];
  currentDate?: string;
  withinDays?: number;
}): FinancialObligationItem[] {
  const now = input.currentDate ? new Date(`${input.currentDate}T00:00:00`) : new Date();
  const win: ObligationWindow = {
    currentDay: now.getDate(),
    currentMonthKey: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    withinDays: input.withinDays ?? 7,
  };

  return [
    ...collectEmiObligations(input.emiTrackers, input.transactions, win),
    ...collectCommitmentObligations(input.commitments, input.transactions, win),
    ...collectDebtObligations(input.debtRecords, input.debtInstallments, win),
    ...collectMonthlyScheduleItems(input.recurringBills, win, (bill) => ({
      lastPaidMonthKey: bill.lastPaidMonthKey,
      dueDay: bill.dueDayOfMonth,
      type: 'bill',
      title: bill.name,
      subtitle: `Recurring ${bill.cadence} bill`,
      amount: bill.amount,
    })),
    ...collectMonthlyScheduleItems(input.sipPlans, win, (sip) => ({
      lastPaidMonthKey: sip.lastInvestedMonthKey,
      dueDay: sip.sipDayOfMonth,
      type: 'sip',
      title: `${sip.name} SIP`,
      subtitle: `${sip.platform} · ${sip.assetClass.toUpperCase()}`,
      amount: sip.monthlyAmount,
    })),
  ].sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}
