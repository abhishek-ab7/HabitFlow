import { addDays, getLocalIsoDate, normalizeIsoDate } from '@/lib/finance/credit-card-cycles';
import { calculateSupplementStockAndRoi } from '@/lib/fitness/shared-analytics';
import { formatHumanDate } from '@/lib/date-format';
import type {
  CommitmentLedgerSummary,
  CreditCardStatement,
  EmiTracker,
  FinanceAccount,
  FinanceRecurringBill,
  FinanceSipPlan,
  FinanceTransaction,
  SupplementInventory,
  SupplementLog,
  Task,
} from '@/lib/types';

export type CalendarEventKind =
  | 'bill'
  | 'emi'
  | 'sip'
  | 'commitment'
  | 'credit_card'
  | 'health_task'
  | 'supplement_refill';

export interface CalendarEventItem {
  id: string;
  sourceId: string;
  statementId?: string;
  day: number;
  kind: CalendarEventKind;
  title: string;
  subtitle: string;
  amount: number;
  isPaid: boolean;
}

export const EVENT_KIND_DOT_CLASS: Record<CalendarEventKind, string> = {
  bill: 'bg-amber-500',
  emi: 'bg-rose-500',
  credit_card: 'bg-rose-500',
  sip: 'bg-violet-500',
  commitment: 'bg-rose-500',
  health_task: 'bg-sky-500',
  supplement_refill: 'bg-teal-500',
};

export const EVENT_KIND_ACTION_LABEL: Record<CalendarEventKind, string> = {
  bill: 'Mark Paid',
  emi: 'Mark Paid',
  credit_card: 'Pay',
  sip: 'Log SIP Investment',
  commitment: 'Settle Balance',
  health_task: 'Mark Health Task Done',
  supplement_refill: 'Restock Supplement',
};

export type MonthDay = number;
export type MonthKey = string;
export type IsoDateStr = string;

function pushClampedEvent(
  map: Map<MonthDay, CalendarEventItem[]>,
  daysInMonth: MonthDay,
  dayRaw: MonthDay,
  ev: CalendarEventItem
) {
  const clamped = Math.min(daysInMonth, Math.max(1, dayRaw || 1));
  const list = map.get(clamped) ?? [];
  list.push({ ...ev, day: clamped });
  map.set(clamped, list);
}

function addRecurringBillEvents(
  map: Map<MonthDay, CalendarEventItem[]>,
  daysInMonth: MonthDay,
  recurringBills: FinanceRecurringBill[],
  selectedMonth: MonthKey
) {
  for (const bill of recurringBills) {
    if (!bill.isActive || bill.deletedAt) continue;
    pushClampedEvent(map, daysInMonth, bill.dueDayOfMonth, {
      id: `bill-${bill.id}`,
      sourceId: bill.id,
      day: bill.dueDayOfMonth,
      kind: 'bill',
      title: bill.name,
      subtitle: `Recurring · ${bill.cadence}`,
      amount: bill.amount,
      isPaid: bill.lastPaidMonthKey === selectedMonth,
    });
  }
}

function hasLinkedMonthTx(
  transactions: FinanceTransaction[],
  selectedMonth: MonthKey,
  field: 'linkedEmiId' | 'linkedSipId',
  id: string
): boolean {
  return transactions.some((t) => !t.deletedAt && t[field] === id && t.monthKey === selectedMonth);
}

function addScheduledItems<T>(
  map: Map<MonthDay, CalendarEventItem[]>,
  daysInMonth: MonthDay,
  items: T[],
  toEvent: (item: T) => CalendarEventItem | null
) {
  for (const item of items) {
    const ev = toEvent(item);
    if (ev) pushClampedEvent(map, daysInMonth, ev.day, ev);
  }
}

function addLinkedMonthlyObligations(params: {
  map: Map<MonthDay, CalendarEventItem[]>;
  daysInMonth: MonthDay;
  emiTrackers: EmiTracker[];
  sipPlans: FinanceSipPlan[];
  transactions: FinanceTransaction[];
  selectedMonth: MonthKey;
}) {
  addScheduledItems(params.map, params.daysInMonth, params.emiTrackers, (emi) => {
    if (emi.status !== 'active' || emi.deletedAt) return null;
    const isPaid =
      emi.lastPaidMonthKey === params.selectedMonth ||
      hasLinkedMonthTx(params.transactions, params.selectedMonth, 'linkedEmiId', emi.id);
    return {
      id: `emi-${emi.id}`,
      sourceId: emi.id,
      day: emi.billingDayOfMonth,
      kind: 'emi',
      title: emi.loanName,
      subtitle: `EMI · ${emi.lenderName}`,
      amount: emi.emiAmount,
      isPaid,
    };
  });

  addScheduledItems(params.map, params.daysInMonth, params.sipPlans, (sip) => {
    if (!sip.isActive || sip.deletedAt) return null;
    const isPaid =
      sip.lastInvestedMonthKey === params.selectedMonth ||
      hasLinkedMonthTx(params.transactions, params.selectedMonth, 'linkedSipId', sip.id);
    return {
      id: `sip-${sip.id}`,
      sourceId: sip.id,
      day: sip.sipDayOfMonth,
      kind: 'sip',
      title: sip.name,
      subtitle: `SIP · ${sip.platform ?? 'Investment'}`,
      amount: sip.monthlyAmount,
      isPaid,
    };
  });
}

function addCommitmentEvents(
  map: Map<number, CalendarEventItem[]>,
  daysInMonth: number,
  commitmentLedgers: CommitmentLedgerSummary[]
) {
  for (const ledger of commitmentLedgers) {
    pushClampedEvent(map, daysInMonth, ledger.commitment.dueDayOfMonth, {
      id: `comm-${ledger.commitment.id}`,
      sourceId: ledger.commitment.id,
      day: ledger.commitment.dueDayOfMonth,
      kind: 'commitment',
      title: ledger.commitment.title,
      subtitle: `Commitment · ${ledger.commitment.recipientName}`,
      amount: ledger.remainingBalance > 0 ? ledger.remainingBalance : ledger.effectiveTargetAmount,
      isPaid: ledger.remainingBalance <= 0,
    });
  }
}

function toStatementCardEvent(
  stmt: CreditCardStatement,
  accounts: FinanceAccount[]
): CalendarEventItem | null {
  const card = accounts.find((a) => a.id === stmt.accountId && !a.deletedAt && !a.archived);
  if (!card) return null;
  const dueDayNum = parseInt(stmt.dueDate.slice(8, 10), 10);
  return {
    id: `card-stmt-${stmt.id}`,
    sourceId: card.id,
    statementId: stmt.id,
    day: dueDayNum,
    kind: 'credit_card',
    title: `${card.name} Due`,
    subtitle: `Statement (${formatHumanDate(stmt.periodStart)} – ${formatHumanDate(stmt.periodEnd)})`,
    amount: stmt.remainingDue > 0 ? stmt.remainingDue : stmt.totalDue,
    isPaid: stmt.status === 'paid' || stmt.remainingDue <= 0,
  };
}

function addStatementCardEvents(params: {
  map: Map<number, CalendarEventItem[]>;
  daysInMonth: number;
  creditCardStatements: CreditCardStatement[];
  accounts: FinanceAccount[];
  selectedMonth: string;
}): Set<string> {
  const processedCardIds = new Set<string>();
  for (const stmt of params.creditCardStatements) {
    if (stmt.deletedAt || !stmt.dueDate.startsWith(params.selectedMonth)) continue;
    const ev = toStatementCardEvent(stmt, params.accounts);
    if (!ev) continue;
    processedCardIds.add(ev.sourceId);
    pushClampedEvent(params.map, params.daysInMonth, ev.day, ev);
  }
  return processedCardIds;
}

function toFallbackCardEvent(acc: FinanceAccount, processedCardIds: Set<string>): CalendarEventItem | null {
  if (acc.type !== 'credit_card' || acc.deletedAt) return null;
  if (acc.archived || !acc.dueDay) return null;
  if (processedCardIds.has(acc.id)) return null;
  const dueAmt = Math.abs(acc.balance);
  if (dueAmt <= 0) return null;
  return {
    id: `card-${acc.id}`,
    sourceId: acc.id,
    day: acc.dueDay,
    kind: 'credit_card',
    title: `${acc.name} Due`,
    subtitle: 'Credit Card Bill',
    amount: dueAmt,
    isPaid: false,
  };
}

function addFallbackCardEvents(params: {
  map: Map<number, CalendarEventItem[]>;
  daysInMonth: number;
  accounts: FinanceAccount[];
  processedCardIds: Set<string>;
}) {
  for (const acc of params.accounts) {
    const ev = toFallbackCardEvent(acc, params.processedCardIds);
    if (ev) pushClampedEvent(params.map, params.daysInMonth, ev.day, ev);
  }
}

function parseMonthDayNum(isoDate: string, selectedMonth: string): number | null {
  if (!isoDate.startsWith(selectedMonth)) return null;
  const dayNum = parseInt(isoDate.slice(8, 10), 10);
  return Number.isNaN(dayNum) ? null : dayNum;
}

function toHealthTaskEvent(task: Task, selectedMonth: string): CalendarEventItem | null {
  if (task.status === 'archived' || !task.due_date) return null;
  const isHealthTask = (task.tags ?? []).some((tag) => tag.trim().toLowerCase() === 'health');
  if (!isHealthTask) return null;
  const dayNum = parseMonthDayNum(normalizeIsoDate(task.due_date), selectedMonth);
  if (dayNum === null) return null;
  return {
    id: `health-task-${task.id}`,
    sourceId: task.id,
    day: dayNum,
    kind: 'health_task',
    title: task.title,
    subtitle: 'Health Task · Follow-up / Meds',
    amount: 0,
    isPaid: task.status === 'done',
  };
}

function addHealthTaskEvents(
  map: Map<number, CalendarEventItem[]>,
  daysInMonth: number,
  tasks: Task[],
  selectedMonth: string
) {
  for (const task of tasks) {
    const ev = toHealthTaskEvent(task, selectedMonth);
    if (ev) pushClampedEvent(map, daysInMonth, ev.day, ev);
  }
}

function toSupplementRefillEvent(
  item: ReturnType<typeof calculateSupplementStockAndRoi>['items'][number],
  todayIso: string,
  selectedMonth: string
): CalendarEventItem | null {
  if (item.daysRemaining === null || item.daysRemaining > 10) return null;
  const dayNum = parseMonthDayNum(addDays(todayIso, Math.max(0, item.daysRemaining)), selectedMonth);
  if (dayNum === null) return null;
  const subtitle =
    item.daysRemaining <= 0
      ? 'Stock depleted · Refill needed'
      : `Runs out in ${item.daysRemaining}d (~${item.derivedRemainingServings} ${item.supplement.unitLabel}s left)`;
  return {
    id: `supplement-refill-${item.supplement.id}`,
    sourceId: item.supplement.id,
    day: dayNum,
    kind: 'supplement_refill',
    title: `${item.supplement.name} Refill`,
    subtitle,
    amount: Math.max(0, Number(item.supplement.costInr ?? 0)),
    isPaid: false,
  };
}

function addSupplementRefillEvents(params: {
  map: Map<number, CalendarEventItem[]>;
  daysInMonth: number;
  supplementInventory: SupplementInventory[];
  supplementLogs: SupplementLog[];
  selectedMonth: string;
}) {
  const todayIso = getLocalIsoDate();
  const roiSummary = calculateSupplementStockAndRoi(params.supplementInventory, params.supplementLogs, todayIso);
  for (const item of roiSummary.items) {
    const ev = toSupplementRefillEvent(item, todayIso, params.selectedMonth);
    if (ev) pushClampedEvent(params.map, params.daysInMonth, ev.day, ev);
  }
}

export function buildBillCalendarEventsMap(params: {
  daysInMonth: number;
  selectedMonth: string;
  recurringBills: FinanceRecurringBill[];
  emiTrackers: EmiTracker[];
  sipPlans: FinanceSipPlan[];
  commitmentLedgers: CommitmentLedgerSummary[];
  creditCardStatements: CreditCardStatement[];
  accounts: FinanceAccount[];
  transactions: FinanceTransaction[];
  tasks: Task[];
  isFitnessEnabled: boolean;
  supplementInventory: SupplementInventory[];
  supplementLogs: SupplementLog[];
}): Map<number, CalendarEventItem[]> {
  const map = new Map<number, CalendarEventItem[]>();
  addRecurringBillEvents(map, params.daysInMonth, params.recurringBills, params.selectedMonth);
  addLinkedMonthlyObligations({
    map,
    daysInMonth: params.daysInMonth,
    emiTrackers: params.emiTrackers,
    sipPlans: params.sipPlans,
    transactions: params.transactions,
    selectedMonth: params.selectedMonth,
  });
  addCommitmentEvents(map, params.daysInMonth, params.commitmentLedgers);
  const processedCardIds = addStatementCardEvents({ map, daysInMonth: params.daysInMonth, creditCardStatements: params.creditCardStatements, accounts: params.accounts, selectedMonth: params.selectedMonth });
  addFallbackCardEvents({ map, daysInMonth: params.daysInMonth, accounts: params.accounts, processedCardIds });
  addHealthTaskEvents(map, params.daysInMonth, params.tasks, params.selectedMonth);
  if (params.isFitnessEnabled) {
    addSupplementRefillEvents({ map, daysInMonth: params.daysInMonth, supplementInventory: params.supplementInventory, supplementLogs: params.supplementLogs, selectedMonth: params.selectedMonth });
  }
  return map;
}

export function computeMonthEventTotals(eventsByDay: Map<number, CalendarEventItem[]>) {
  let totalDue = 0;
  let totalPaid = 0;
  let count = 0;
  for (const list of eventsByDay.values()) {
    for (const ev of list) {
      count += 1;
      if (ev.isPaid) totalPaid += ev.amount;
      else totalDue += ev.amount;
    }
  }
  return { totalDue, totalPaid, count };
}
