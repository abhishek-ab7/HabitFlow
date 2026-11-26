import type {
  CreditCardStatement,
  FinanceAccount,
  FinanceTransaction,
  StatementStatus,
} from '@/lib/types';

export type IsoDateString = string;
export type CycleKeyString = string;
export type BillingDayNum = number;
export type DueDayNum = number;
export type YearNum = number;
export type MonthIndexNum = number;
export type DayCountNum = number;
export type CurrencyAmount = number;

export interface CreditCardCycleWindow {
  cycleKey: CycleKeyString;
  periodStart: IsoDateString;
  periodEnd: IsoDateString;
  dueDate: IsoDateString;
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function getLocalIsoDate(d: Date = new Date()): IsoDateString {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function normalizeIsoDate(isoDate: IsoDateString): IsoDateString {
  return (isoDate ?? '').trim().slice(0, 10);
}

export function roundCurrency(value: CurrencyAmount): CurrencyAmount {
  const rounded = Math.round((Number(value) || 0) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function formatOrdinal(day: DayCountNum): string {
  const n = Math.trunc(day);
  const mod100 = Math.abs(n) % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = Math.abs(n) % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

export function parseIsoDate(isoDate: IsoDateString): { year: number; month: number; day: number } {
  const parts = normalizeIsoDate(isoDate).split('-');
  return {
    year: parseInt(parts[0], 10),
    month: parseInt(parts[1], 10),
    day: parseInt(parts[2], 10),
  };
}

export function formatShortDate(isoDate: IsoDateString): string {
  const normalized = normalizeIsoDate(isoDate);
  if (normalized.length < 10) return isoDate || '';
  const { month, day } = parseIsoDate(normalized);
  const monthLabel = SHORT_MONTHS[month - 1];
  if (!monthLabel || Number.isNaN(day)) return normalized;
  return `${day} ${monthLabel}`;
}

export function getValidDateInMonth(year: YearNum, monthIndex: MonthIndexNum, day: DayCountNum): IsoDateString {
  const normalizedYear = year + Math.floor(monthIndex / 12);
  const normalizedMonthIndex = ((monthIndex % 12) + 12) % 12;
  const maxDays = new Date(normalizedYear, normalizedMonthIndex + 1, 0).getDate();
  const clampedDay = Math.min(Math.max(1, day), maxDays);
  const mStr = String(normalizedMonthIndex + 1).padStart(2, '0');
  const dStr = String(clampedDay).padStart(2, '0');
  return `${normalizedYear}-${mStr}-${dStr}`;
}

export function addDays(isoDate: IsoDateString, days: DayCountNum): IsoDateString {
  const { year, month, day } = parseIsoDate(isoDate);
  const dt = new Date(year, month - 1, day + days);
  const mStr = String(dt.getMonth() + 1).padStart(2, '0');
  const dStr = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mStr}-${dStr}`;
}

export function daysBetween(date1Iso: IsoDateString, date2Iso: IsoDateString): DayCountNum {
  const p1 = parseIsoDate(date1Iso);
  const p2 = parseIsoDate(date2Iso);
  const utc1 = Date.UTC(p1.year, p1.month - 1, p1.day);
  const utc2 = Date.UTC(p2.year, p2.month - 1, p2.day);
  return Math.round((utc2 - utc1) / 86_400_000);
}

export function resolveCardBillingConfig(account: FinanceAccount) {
  const billingDay = account.billingDay ?? account.statementDay ?? 1;
  const dueDay = account.dueDay ?? 15;
  const creditLimit = Math.max(0, account.creditLimit ?? 0);
  return {
    billingDay: Math.min(31, Math.max(1, billingDay)),
    dueDay: Math.min(31, Math.max(1, dueDay)),
    creditLimit,
    gracePeriodDays: account.gracePeriodDays,
  };
}

function resolveCycleDueDate(params: {
  periodEnd: IsoDateString;
  year: number;
  monthIndex: number;
  billingDay: number;
  dueDay: number;
  gracePeriodDays?: number;
}): IsoDateString {
  const { periodEnd, year, monthIndex, billingDay, dueDay, gracePeriodDays } = params;
  if (gracePeriodDays && gracePeriodDays > 0) return addDays(periodEnd, gracePeriodDays);
  const targetMonth = dueDay > billingDay ? monthIndex : monthIndex + 1;
  return getValidDateInMonth(year, targetMonth, dueDay);
}

export function getCycleWindowForMonth(
  billingDay: BillingDayNum,
  dueDay: DueDayNum,
  year: YearNum,
  ...[monthIndex, gracePeriodDays]: [monthIndex: MonthIndexNum, gracePeriodDays?: DayCountNum]
): CreditCardCycleWindow {
  const periodEnd = getValidDateInMonth(year, monthIndex, billingDay);
  const prevPeriodEnd = getValidDateInMonth(year, monthIndex - 1, billingDay);
  const periodStart = addDays(prevPeriodEnd, 1);
  const dueDate = resolveCycleDueDate({ periodEnd, year, monthIndex, billingDay, dueDay, gracePeriodDays });
  return { cycleKey: periodEnd.slice(0, 7), periodStart, periodEnd, dueDate };
}

export function resolveTransactionCycle(
  txDate: IsoDateString,
  billingDay: BillingDayNum,
  _dueDay: DueDayNum,
  manualOverrideCycleKey?: CycleKeyString | null
): CycleKeyString {
  if (manualOverrideCycleKey?.trim()) return manualOverrideCycleKey.trim();

  const normalizedDate = normalizeIsoDate(txDate);
  const { year, month } = parseIsoDate(normalizedDate);
  const monthIndex = month - 1;
  const thisMonthEnd = getValidDateInMonth(year, monthIndex, billingDay);
  if (normalizedDate <= thisMonthEnd) return thisMonthEnd.slice(0, 7);
  return getValidDateInMonth(year, monthIndex + 1, billingDay).slice(0, 7);
}

export function getActiveUnbilledCycle(
  billingDay: BillingDayNum,
  dueDay: DueDayNum,
  referenceDate: IsoDateString,
  gracePeriodDays?: DayCountNum
): CreditCardCycleWindow {
  const normalizedRef = normalizeIsoDate(referenceDate);
  const { year, month } = parseIsoDate(normalizedRef);
  const monthIndex = month - 1;
  const currentMonthCycle = getCycleWindowForMonth(billingDay, dueDay, year, monthIndex, gracePeriodDays);
  if (normalizedRef < currentMonthCycle.periodEnd) return currentMonthCycle;
  return getCycleWindowForMonth(billingDay, dueDay, year, monthIndex + 1, gracePeriodDays);
}

function applyPaymentToSingleStatement(
  s: CreditCardStatement,
  remainingPayment: number
): { nextStatement: CreditCardStatement; nextRemainingPayment: number } {
  const allocatable = roundCurrency(Math.max(0, s.remainingDue));
  const paymentToApply = roundCurrency(Math.min(remainingPayment, allocatable));
  const newPaid = roundCurrency(s.paidAmount + paymentToApply);
  const newRemaining = roundCurrency(Math.max(0, s.totalDue - newPaid));
  const nextRemainingPayment = roundCurrency(Math.max(0, remainingPayment - paymentToApply));

  let status: StatementStatus = s.status;
  if (newRemaining === 0 && s.totalDue > 0) status = 'paid';
  else if (newPaid > 0 && newRemaining > 0) status = 'partial';

  return {
    nextStatement: {
      ...s,
      paidAmount: newPaid,
      remainingDue: newRemaining,
      status,
      paidAt: newRemaining === 0 ? s.paidAt ?? new Date().toISOString() : null,
    },
    nextRemainingPayment,
  };
}

function allocateWaterfallStatements(updated: CreditCardStatement[], initialRemaining: number): number {
  let remainingPayment = initialRemaining;
  const unpaidIndices = updated
    .map((s, idx) => ({ s, idx }))
    .filter(({ s }) => s.remainingDue > 0)
    .sort((a, b) => a.s.periodEnd.localeCompare(b.s.periodEnd));

  for (const { idx } of unpaidIndices) {
    if (remainingPayment <= 0) break;
    const res = applyPaymentToSingleStatement(updated[idx], remainingPayment);
    updated[idx] = res.nextStatement;
    remainingPayment = res.nextRemainingPayment;
  }
  return remainingPayment;
}

export function allocatePaymentToStatements(
  statements: CreditCardStatement[],
  paymentAmount: number,
  targetStatementId?: string | null
): { updatedStatements: CreditCardStatement[]; unallocatedAmount: number } {
  let remainingPayment = roundCurrency(Math.max(0, paymentAmount));
  const updated: CreditCardStatement[] = statements.map((s) => ({ ...s }));
  if (remainingPayment <= 0) return { updatedStatements: updated, unallocatedAmount: 0 };

  if (targetStatementId) {
    const targetIdx = updated.findIndex((s) => s.id === targetStatementId || s.cycleKey === targetStatementId);
    if (targetIdx !== -1) {
      const res = applyPaymentToSingleStatement(updated[targetIdx], remainingPayment);
      updated[targetIdx] = res.nextStatement;
      remainingPayment = res.nextRemainingPayment;
    }
  }

  if (remainingPayment > 0) {
    remainingPayment = allocateWaterfallStatements(updated, remainingPayment);
  }
  return { updatedStatements: updated, unallocatedAmount: roundCurrency(remainingPayment) };
}

export function sumCardTransactions(txs: FinanceTransaction[]): number {
  let total = 0;
  for (const tx of txs) {
    const delta = tx.type === 'income' ? -tx.amount : tx.amount;
    total = roundCurrency(total + delta);
  }
  return total;
}

export function sortBillPaymentTxs(rawBillPaymentTxs: FinanceTransaction[]): FinanceTransaction[] {
  return [...rawBillPaymentTxs].sort((a, b) => {
    const aLinked = a.paidStatementId ? 1 : 0;
    const bLinked = b.paidStatementId ? 1 : 0;
    if (aLinked !== bLinked) return bLinked - aLinked;
    const dateDiff = normalizeIsoDate(a.date).localeCompare(normalizeIsoDate(b.date));
    if (dateDiff !== 0) return dateDiff;
    return (a.createdAt ?? a.id).localeCompare(b.createdAt ?? b.id);
  });
}

export function groupCardTxsByCycle(
  standardCardTxs: FinanceTransaction[],
  billingDay: number,
  dueDay: number
): Map<CycleKeyString, FinanceTransaction[]> {
  const txByCycle = new Map<CycleKeyString, FinanceTransaction[]>();
  for (const tx of standardCardTxs) {
    const cycleKey = resolveTransactionCycle(tx.date, billingDay, dueDay, tx.statementCycleKey);
    const list = txByCycle.get(cycleKey) ?? [];
    list.push(tx);
    txByCycle.set(cycleKey, list);
  }
  return txByCycle;
}

function isDateInCycleWindow(dateStr: IsoDateString, window: CreditCardCycleWindow): boolean {
  return dateStr >= window.periodStart && dateStr <= window.periodEnd;
}

export function applyPaymentsToBilledStatements(
  billedStatements: CreditCardStatement[],
  billPaymentTxs: FinanceTransaction[],
  unbilledWindow: CreditCardCycleWindow
): number {
  let unallocatedPayments = 0;
  for (const payTx of billPaymentTxs) {
    const { updatedStatements, unallocatedAmount } = allocatePaymentToStatements(
      billedStatements,
      payTx.amount,
      payTx.paidStatementId
    );
    updatedStatements.forEach((stmt, i) => {
      billedStatements[i] = stmt;
    });
    const payDate = normalizeIsoDate(payTx.date);
    if (unallocatedAmount > 0 && isDateInCycleWindow(payDate, unbilledWindow)) {
      unallocatedPayments = roundCurrency(unallocatedPayments + unallocatedAmount);
    }
  }
  return unallocatedPayments;
}

export function evaluateStatementStatus(s: CreditCardStatement, referenceDate: IsoDateString): StatementStatus {
  if (s.remainingDue <= 0) return 'paid';
  if (referenceDate > s.dueDate) return 'overdue';
  return s.paidAmount > 0 ? 'partial' : 'billed';
}
