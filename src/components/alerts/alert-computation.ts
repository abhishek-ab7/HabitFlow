import { calculateSupplementStockAndRoi } from '@/lib/fitness/shared-analytics';
import { addDays, daysBetween, getLocalIsoDate, normalizeIsoDate, parseIsoDate } from '@/lib/finance/credit-card-cycles';
import type {
  CreditCardStatement,
  EmiTracker,
  FinanceAccount,
  FinanceRecurringBill,
  FinanceTransaction,
  MonthlyCommitment,
  SupplementInventory,
  SupplementLog,
  Task,
} from '@/lib/types';
import {
  buildCommitmentAlerts,
  buildEmiAlerts,
  buildRecurringBillAlerts,
  collectCreditCardAlerts,
  type AlertDateContext,
} from './alert-finance-collectors';

export type UnifiedAlertKind =
  | 'credit_card'
  | 'emi'
  | 'commitment'
  | 'bill'
  | 'health_task'
  | 'supplement_low_stock';

export interface UnifiedAdvanceAlert {
  id: string;
  kind: UnifiedAlertKind;
  title: string;
  subtitle: string;
  dueDate: string;
  daysUntil: number;
  amount?: number;
  severity: 'critical' | 'warning' | 'info';
  href: string;
}

export interface UnifiedAlertScanInput {
  todayIso?: string;
  creditCardStatements?: CreditCardStatement[];
  accounts?: FinanceAccount[];
  emiTrackers?: EmiTracker[];
  commitments?: MonthlyCommitment[];
  recurringBills?: FinanceRecurringBill[];
  transactions?: FinanceTransaction[];
  tasks?: Task[];
  supplementInventory?: SupplementInventory[];
  supplementLogs?: SupplementLog[];
}

function isOpenHealthTask(task: Task): boolean {
  if (task.status === 'done' || task.status === 'archived') return false;
  if (!task.due_date) return false;
  return (task.tags || []).some((tag) => tag.trim().toLowerCase() === 'health');
}

function formatHealthTaskTiming(daysUntil: number): string {
  if (daysUntil < 0) return `${Math.abs(daysUntil)}d overdue`;
  if (daysUntil === 0) return 'Due Today';
  return `in ${daysUntil}d`;
}

function buildHealthTaskAlert(ctx: AlertDateContext, task: Task): UnifiedAdvanceAlert | null {
  if (!isOpenHealthTask(task) || !task.due_date) return null;
  const dueIso = normalizeIsoDate(task.due_date);
  if (dueIso.length !== 10) return null;
  const daysUntil = daysBetween(ctx.todayIso, dueIso);
  if (daysUntil > 3) return null;

  return {
    id: `health-task-${task.id}`, kind: 'health_task',
    title: `${task.title} (${formatHealthTaskTiming(daysUntil)})`,
    subtitle: 'Health Task · Follow-up / Prescription',
    dueDate: dueIso, daysUntil,
    severity: daysUntil <= 0 ? 'critical' : 'warning', href: '/tasks',
  };
}

function collectSupplementAlerts(params: {
  ctx: AlertDateContext;
  inventory: SupplementInventory[];
  logs: SupplementLog[];
}): UnifiedAdvanceAlert[] {
  const supSummary = calculateSupplementStockAndRoi(params.inventory, params.logs, params.ctx.todayIso);
  return supSummary.items
    .filter((item) => item.daysRemaining !== null && item.daysRemaining <= 5)
    .map((item) => {
      const days = item.daysRemaining as number;
      const runoutDate = addDays(params.ctx.todayIso, Math.max(0, days));
      return {
        id: `supplement-low-${item.supplement.id}`, kind: 'supplement_low_stock',
        title: `${item.supplement.name} Low Stock (${days}d left)`,
        subtitle: `${item.derivedRemainingServings} ${item.supplement.unitLabel}s remaining · Restock before ${runoutDate}`,
        dueDate: runoutDate, daysUntil: days,
        amount: item.supplement.costInr > 0 ? item.supplement.costInr : undefined,
        severity: days <= 2 ? 'critical' : 'warning', href: '/fitness',
      };
    });
}

function dedupeAndSortAlerts(alerts: UnifiedAdvanceAlert[]): UnifiedAdvanceAlert[] {
  const seenIds = new Set<string>();
  const deduped = alerts.filter((alert) => {
    if (seenIds.has(alert.id)) return false;
    seenIds.add(alert.id);
    return true;
  });
  const sevOrder = { critical: 0, warning: 1, info: 2 };
  return deduped.sort((a, b) => (a.daysUntil !== b.daysUntil ? a.daysUntil - b.daysUntil : sevOrder[a.severity] - sevOrder[b.severity]));
}

function normalizeScanInput(input: UnifiedAlertScanInput): Required<UnifiedAlertScanInput> {
  const todayIso = normalizeIsoDate(input.todayIso || getLocalIsoDate()) || getLocalIsoDate();
  return {
    todayIso,
    creditCardStatements: input.creditCardStatements ?? [],
    accounts: input.accounts ?? [],
    emiTrackers: input.emiTrackers ?? [],
    commitments: input.commitments ?? [],
    recurringBills: input.recurringBills ?? [],
    transactions: (input.transactions ?? []).filter((t) => !t.deletedAt),
    tasks: input.tasks ?? [],
    supplementInventory: input.supplementInventory ?? [],
    supplementLogs: input.supplementLogs ?? [],
  };
}

export function computeUnified3DayAlerts(input: UnifiedAlertScanInput): UnifiedAdvanceAlert[] {
  const n = normalizeScanInput(input);
  const { year, month } = parseIsoDate(n.todayIso);
  const ctx: AlertDateContext = { todayIso: n.todayIso, year, currentMonthIndex: month - 1 };

  const cc = collectCreditCardAlerts({ ctx, accounts: n.accounts, statements: n.creditCardStatements });
  const emis = n.emiTrackers.flatMap((emi) => buildEmiAlerts({ ctx, emi, transactions: n.transactions }));
  const coms = n.commitments.flatMap((com) => buildCommitmentAlerts({ ctx, com, transactions: n.transactions }));
  const bills = n.recurringBills.flatMap((bill) => buildRecurringBillAlerts(ctx, bill));
  const health = n.tasks.map((t) => buildHealthTaskAlert(ctx, t)).filter((a): a is UnifiedAdvanceAlert => a !== null);
  const sups = collectSupplementAlerts({ ctx, inventory: n.supplementInventory, logs: n.supplementLogs });

  return dedupeAndSortAlerts([...cc, ...emis, ...coms, ...bills, ...health, ...sups]);
}
