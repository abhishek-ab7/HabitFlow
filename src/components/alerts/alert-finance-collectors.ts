import { calculateCommitmentLedger } from '@/lib/finance/shared-analytics';
import { daysBetween, getValidDateInMonth, normalizeIsoDate } from '@/lib/finance/credit-card-cycles';
import type {
  CreditCardStatement,
  EmiTracker,
  FinanceAccount,
  FinanceRecurringBill,
  FinanceTransaction,
  MonthlyCommitment,
} from '@/lib/types';
import type { UnifiedAdvanceAlert } from './alert-computation';

export interface AlertDateContext {
  todayIso: string;
  year: number;
  currentMonthIndex: number;
}

interface DayCandidate {
  dueDate: string;
  monthKey: string;
  daysUntil: number;
}

function formatDueStatus(daysUntil: number): string {
  if (daysUntil < 0) return 'Overdue';
  if (daysUntil === 0) return 'Due Today';
  return `Due in ${daysUntil}d`;
}

function formatShortDueStatus(daysUntil: number): string {
  if (daysUntil < 0) return 'Overdue';
  if (daysUntil === 0) return 'Today';
  return `in ${daysUntil}d`;
}

function dueSeverity(daysUntil: number): 'critical' | 'warning' {
  return daysUntil <= 0 ? 'critical' : 'warning';
}

function isRecurringBillPaidForCycle(bill: FinanceRecurringBill, cycleMonthKey: string): boolean {
  if (!bill.lastPaidMonthKey) return false;
  if (bill.lastPaidMonthKey === cycleMonthKey) return true;

  const [lastYear, lastMonth] = bill.lastPaidMonthKey.split('-').map(Number);
  const [cycleYear, cycleMonth] = cycleMonthKey.split('-').map(Number);
  if (![lastYear, lastMonth, cycleYear, cycleMonth].every(Number.isFinite)) return false;

  const monthsElapsed = (cycleYear - lastYear) * 12 + (cycleMonth - lastMonth);
  if (monthsElapsed < 0) return false;
  if (bill.cadence === 'quarterly') return monthsElapsed < 3;
  if (bill.cadence === 'yearly') return monthsElapsed < 12;
  return monthsElapsed === 0;
}

function getDayOfMonthCandidates(ctx: AlertDateContext, dueDay: number): DayCandidate[] {
  const thisMonthDate = getValidDateInMonth(ctx.year, ctx.currentMonthIndex, dueDay);
  const nextMonthDate = getValidDateInMonth(ctx.year, ctx.currentMonthIndex + 1, dueDay);
  const candidates: DayCandidate[] = [];

  const diffThis = daysBetween(ctx.todayIso, thisMonthDate);
  if (diffThis >= -7 && diffThis <= 3) {
    candidates.push({ dueDate: thisMonthDate, monthKey: thisMonthDate.slice(0, 7), daysUntil: diffThis });
  }

  const diffNext = daysBetween(ctx.todayIso, nextMonthDate);
  if (nextMonthDate !== thisMonthDate && diffNext >= 0 && diffNext <= 3) {
    candidates.push({ dueDate: nextMonthDate, monthKey: nextMonthDate.slice(0, 7), daysUntil: diffNext });
  }
  return candidates;
}

function buildStatementAlert(params: {
  ctx: AlertDateContext;
  stmt: CreditCardStatement;
  accountById: Map<string, FinanceAccount>;
}): UnifiedAdvanceAlert | null {
  const { ctx, stmt, accountById } = params;
  const isUnpaid = !stmt.deletedAt && stmt.status !== 'paid' && stmt.remainingDue > 0 && Boolean(stmt.dueDate);
  if (!isUnpaid) return null;
  const dueIso = normalizeIsoDate(stmt.dueDate || '');
  const daysUntil = daysBetween(ctx.todayIso, dueIso);
  if (daysUntil > 3) return null;

  const cardName = accountById.get(stmt.accountId)?.name || 'Credit Card';
  return {
    id: `cc-stmt-${stmt.id}`, kind: 'credit_card',
    title: `${cardName} Bill ${formatDueStatus(daysUntil)}`,
    subtitle: `Statement ${stmt.cycleKey} · Due ${dueIso}`,
    dueDate: dueIso, daysUntil, amount: stmt.remainingDue,
    severity: dueSeverity(daysUntil), href: '/finance?tab=trackers',
  };
}

function buildCardFallbackAlerts(ctx: AlertDateContext, card: FinanceAccount): UnifiedAdvanceAlert[] {
  if (!card.dueDay) return [];
  const outstanding = card.balance < 0 ? Math.abs(card.balance) : card.balance;
  if (outstanding <= 0) return [];
  return getDayOfMonthCandidates(ctx, card.dueDay).map((c) => ({
    id: `cc-acc-${card.id}-${c.dueDate}`, kind: 'credit_card',
    title: `${card.name} Due ${formatShortDueStatus(c.daysUntil)}`,
    subtitle: `Card payment due ${c.dueDate}`,
    dueDate: c.dueDate, daysUntil: c.daysUntil, amount: outstanding,
    severity: dueSeverity(c.daysUntil), href: '/finance?tab=trackers',
  }));
}

export function collectCreditCardAlerts(params: {
  ctx: AlertDateContext;
  accounts: FinanceAccount[];
  statements: CreditCardStatement[];
}): UnifiedAdvanceAlert[] {
  const activeAccounts = params.accounts.filter((a) => !a.deletedAt && !a.archived);
  const accountById = new Map(activeAccounts.map((a) => [a.id, a]));
  const coveredCardIds = new Set<string>();
  const stmtAlerts: UnifiedAdvanceAlert[] = [];

  for (const stmt of params.statements) {
    const alert = buildStatementAlert({ ctx: params.ctx, stmt, accountById });
    if (!alert) continue;
    coveredCardIds.add(stmt.accountId);
    stmtAlerts.push(alert);
  }

  const fallbackCards = activeAccounts.filter((c) => c.type === 'credit_card' && !coveredCardIds.has(c.id));
  return [...stmtAlerts, ...fallbackCards.flatMap((card) => buildCardFallbackAlerts(params.ctx, card))];
}

function isEmiActive(emi: EmiTracker): boolean {
  return !emi.deletedAt && emi.status === 'active' && emi.paidMonths < emi.tenureMonths;
}

export function buildEmiAlerts(params: {
  ctx: AlertDateContext;
  emi: EmiTracker;
  transactions: FinanceTransaction[];
}): UnifiedAdvanceAlert[] {
  const { ctx, emi, transactions } = params;
  if (!isEmiActive(emi)) return [];
  return getDayOfMonthCandidates(ctx, emi.billingDayOfMonth)
    .filter((c) => emi.lastPaidMonthKey !== c.monthKey && !transactions.some((t) => t.linkedEmiId === emi.id && t.monthKey === c.monthKey))
    .map((c) => ({
      id: `emi-${emi.id}-${c.dueDate}`, kind: 'emi',
      title: `${emi.loanName} EMI ${formatDueStatus(c.daysUntil)}`,
      subtitle: `${emi.lenderName} · Month ${emi.paidMonths + 1}/${emi.tenureMonths}`,
      dueDate: c.dueDate, daysUntil: c.daysUntil, amount: emi.emiAmount,
      severity: dueSeverity(c.daysUntil), href: '/finance?tab=trackers',
    }));
}

function buildCommitmentAlert(params: {
  com: MonthlyCommitment;
  c: DayCandidate;
  transactions: FinanceTransaction[];
}): UnifiedAdvanceAlert | null {
  const { com, c, transactions } = params;
  const remaining = Math.max(0, Number(calculateCommitmentLedger(com, c.monthKey, transactions).remainingBalance || 0));
  if (remaining <= 0) return null;
  const isRent = com.category === 'rent' || /\brent\b/i.test(com.title);
  return {
    id: `commitment-${com.id}-${c.dueDate}`, kind: 'commitment',
    title: `${com.title} ${formatDueStatus(c.daysUntil)}`,
    subtitle: `${isRent ? 'Rent / Housing' : com.recipientName} · Due ${c.dueDate}`,
    dueDate: c.dueDate, daysUntil: c.daysUntil, amount: remaining,
    severity: dueSeverity(c.daysUntil), href: '/finance?tab=trackers',
  };
}

export function buildCommitmentAlerts(params: {
  ctx: AlertDateContext;
  com: MonthlyCommitment;
  transactions: FinanceTransaction[];
}): UnifiedAdvanceAlert[] {
  if (!params.com.isActive || params.com.deletedAt) return [];
  return getDayOfMonthCandidates(params.ctx, params.com.dueDayOfMonth)
    .map((c) => buildCommitmentAlert({ com: params.com, c, transactions: params.transactions }))
    .filter((a): a is UnifiedAdvanceAlert => a !== null);
}

export function buildRecurringBillAlerts(ctx: AlertDateContext, bill: FinanceRecurringBill): UnifiedAdvanceAlert[] {
  if (!bill.isActive || bill.deletedAt) return [];
  return getDayOfMonthCandidates(ctx, bill.dueDayOfMonth)
    .filter((c) => !isRecurringBillPaidForCycle(bill, c.monthKey))
    .map((c) => ({
      id: `bill-${bill.id}-${c.dueDate}`, kind: 'bill',
      title: `${bill.name} ${formatDueStatus(c.daysUntil)}`,
      subtitle: `Recurring ${bill.cadence} · Due ${c.dueDate}`,
      dueDate: c.dueDate, daysUntil: c.daysUntil, amount: bill.amount,
      severity: c.daysUntil <= 0 ? 'critical' : 'info', href: '/finance?tab=trackers',
    }));
}
