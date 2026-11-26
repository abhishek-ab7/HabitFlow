import { getIstIsoDate } from '@/lib/mcp/config';
import { resolveEffectivePaydayOfMonth } from '@/lib/finance/payday';
import type {
  CashFlowForecastPoint,
  CreditCardStatement,
  EmiTracker,
  FinanceAccount,
  FinanceBudget,
  FinanceRecurringBill,
  FinanceSipPlan,
  FinanceTransaction,
  MonthlyCommitment,
} from '@/lib/types';

export interface CashFlowForecastInput {
  accounts: FinanceAccount[];
  transactions: FinanceTransaction[];
  budgets: FinanceBudget[];
  recurringBills: FinanceRecurringBill[];
  emiTrackers: EmiTracker[];
  sipPlans: FinanceSipPlan[];
  commitments: MonthlyCommitment[];
  creditCardStatements?: CreditCardStatement[];
  horizonDays: 30 | 60 | 90;
  includeDiscretionaryBurn?: boolean;
  referenceDate?: string;
  paydayOfMonth?: number;
}

export interface CashFlowForecastResult {
  points: CashFlowForecastPoint[];
  startingLiquidBalance: number;
  endingProjectedBalance: number;
  lowestProjectedBalance: number;
  lowestBalanceDate: string | null;
  crunchDate: string | null;
  dailyDiscretionaryBurn: number;
  estimatedMonthlyIncome: number;
  paydayOfMonth: number;
  totalScheduledOutflows: number;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatShortLabel(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function clampDayForMonth(params: { dayOfMonth: number; year: number; monthIndex: number }): number {
  const daysInMonth = new Date(params.year, params.monthIndex + 1, 0).getDate();
  return Math.min(Math.max(1, params.dayOfMonth || 1), daysInMonth);
}

function isRecentDiscretionaryTx(params: {
  t: FinanceTransaction;
  thirtyDaysAgoStr: string;
  todayStr: string;
}): boolean {
  const { t, thirtyDaysAgoStr, todayStr } = params;
  if (t.deletedAt || t.type !== 'expense') return false;
  if (t.date < thirtyDaysAgoStr || t.date > todayStr) return false;
  return !t.linkedEmiId && !t.linkedCommitmentId && !t.linkedSipId && !t.isRecurring;
}

function computeDailyBurn(params: {
  transactions: FinanceTransaction[];
  thirtyDaysAgoStr: string;
  todayStr: string;
  includeDiscretionaryBurn: boolean;
}): number {
  const { transactions, thirtyDaysAgoStr, todayStr, includeDiscretionaryBurn } = params;
  if (!includeDiscretionaryBurn) return 0;
  const recentDiscretionary = transactions.filter((t) =>
    isRecentDiscretionaryTx({ t, thirtyDaysAgoStr, todayStr })
  );
  return Math.round(recentDiscretionary.reduce((sum, t) => sum + Number(t.amount || 0), 0) / 30);
}

function findIncomeAvg(recentIncomes: FinanceTransaction[]): number {
  const byMonth = new Map<string, number>();
  for (const tx of recentIncomes.slice(0, 20)) {
    byMonth.set(tx.monthKey, (byMonth.get(tx.monthKey) || 0) + tx.amount);
  }
  const vals = Array.from(byMonth.values()).slice(0, 3);
  return vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
}

function resolveEstimatedIncome(params: {
  budgets: FinanceBudget[];
  currentMonthKey: string;
  recentAvg: number;
}): number {
  const { budgets, currentMonthKey, recentAvg } = params;
  const currentBudget = budgets.find((b) => b.monthKey === currentMonthKey && !b.deletedAt);
  if (currentBudget && currentBudget.expectedIncome > 0) {
    return Math.round(currentBudget.expectedIncome);
  }
  const recentBudget = budgets
    .filter((b) => !b.deletedAt && b.expectedIncome > 0)
    .sort((a, b) => (b.monthKey || '').localeCompare(a.monthKey || ''))[0];
  return Math.round(recentBudget ? recentBudget.expectedIncome : recentAvg);
}

function estimateMonthlyIncomeAndPayday(params: {
  transactions: FinanceTransaction[];
  budgets: FinanceBudget[];
  currentMonthKey: string;
  paydayOverride?: number;
}) {
  const { transactions, budgets, currentMonthKey, paydayOverride } = params;
  const recentIncomes = transactions
    .filter((t) => !t.deletedAt && t.type === 'income' && t.amount > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  const estimatedMonthlyIncome = resolveEstimatedIncome({
    budgets,
    currentMonthKey,
    recentAvg: findIncomeAvg(recentIncomes),
  });
  const configuredPayday = resolveEffectivePaydayOfMonth(budgets, currentMonthKey, paydayOverride);
  const largestIncome = recentIncomes.reduce<FinanceTransaction | null>(
    (best, tx) => (!best || tx.amount > best.amount ? tx : best),
    null
  );
  const inferredPayday = largestIncome?.date
    ? Math.min(31, Math.max(1, parseInt(largestIncome.date.slice(8, 10), 10) || 1))
    : undefined;
  return { estimatedMonthlyIncome, paydayOfMonth: configuredPayday ?? inferredPayday ?? 1 };
}

interface DayProjectionContext {
  todayMonth: number;
  estimatedMonthlyIncome: number;
  paydayOfMonth: number;
  activeBills: FinanceRecurringBill[];
  activeEmis: EmiTracker[];
  activeSips: FinanceSipPlan[];
  activeCommitments: MonthlyCommitment[];
  creditCardStatements: CreditCardStatement[];
  creditCardAccountIds: Set<string>;
  accounts: FinanceAccount[];
}

interface DayCalendarInfo {
  dom: number;
  year: number;
  monthIdx: number;
  monthKey: string;
}

function isBillDueOnDay(bill: FinanceRecurringBill, cal: DayCalendarInfo, todayMonth: number): boolean {
  if (bill.lastPaidMonthKey === cal.monthKey) return false;
  if (cal.dom !== clampDayForMonth({ dayOfMonth: bill.dueDayOfMonth, year: cal.year, monthIndex: cal.monthIdx })) {
    return false;
  }
  if (bill.cadence === 'quarterly') return cal.monthIdx % 3 === todayMonth % 3;
  if (bill.cadence === 'yearly') return cal.monthIdx === todayMonth;
  return true;
}

function collectBillOutflows(ctx: DayProjectionContext, cal: DayCalendarInfo) {
  let outflow = 0;
  const events: string[] = [];
  for (const bill of ctx.activeBills) {
    if (!isBillDueOnDay(bill, cal, ctx.todayMonth)) continue;
    outflow += Number(bill.amount || 0);
    events.push(`Bill: ${bill.name}`);
  }
  return { outflow, events };
}

function collectActiveEmiOutflows(ctx: DayProjectionContext, cal: DayCalendarInfo) {
  return collectScheduledDayItems({
    items: ctx.activeEmis,
    cal,
    getDay: (emi) => emi.billingDayOfMonth,
    getAmount: (emi) => emi.emiAmount,
    getLabel: (emi) => `EMI: ${emi.loanName}`,
    shouldSkip: (emi) =>
      Boolean(emi.accountId && ctx.creditCardAccountIds.has(emi.accountId)) ||
      emi.lastPaidMonthKey === cal.monthKey ||
      emi.paidMonths >= emi.tenureMonths,
  });
}

interface ScheduledDayItemConfig<T> {
  items: T[];
  cal: DayCalendarInfo;
  getDay: (item: T) => number;
  getAmount: (item: T) => number;
  getLabel: (item: T) => string;
  shouldSkip?: (item: T) => boolean;
}

function collectScheduledDayItems<T>(config: ScheduledDayItemConfig<T>) {
  const { items, cal, getDay, getAmount, getLabel, shouldSkip } = config;
  let outflow = 0;
  const events: string[] = [];
  for (const item of items) {
    if (shouldSkip?.(item)) continue;
    if (cal.dom !== clampDayForMonth({ dayOfMonth: getDay(item), year: cal.year, monthIndex: cal.monthIdx })) continue;
    outflow += Number(getAmount(item) || 0);
    events.push(getLabel(item));
  }
  return { outflow, events };
}

function collectEmiSipCommitmentOutflows(ctx: DayProjectionContext, cal: DayCalendarInfo) {
  const emi = collectActiveEmiOutflows(ctx, cal);
  const sip = collectScheduledDayItems({
    items: ctx.activeSips,
    cal,
    getDay: (s) => s.sipDayOfMonth,
    getAmount: (s) => s.monthlyAmount,
    getLabel: (s) => `SIP: ${s.name}`,
    shouldSkip: (s) => s.lastInvestedMonthKey === cal.monthKey,
  });
  const comm = collectScheduledDayItems({
    items: ctx.activeCommitments,
    cal,
    getDay: (c) => c.dueDayOfMonth,
    getAmount: (c) => c.monthlyTargetAmount,
    getLabel: (c) => `Commitment: ${c.title}`,
  });
  return {
    outflow: emi.outflow + sip.outflow + comm.outflow,
    events: [...emi.events, ...sip.events, ...comm.events],
  };
}

function collectCreditCardOutflows(ctx: DayProjectionContext, dateStr: string) {
  let outflow = 0;
  const events: string[] = [];
  for (const stmt of ctx.creditCardStatements) {
    const isOpen = !stmt.deletedAt && stmt.status !== 'paid' && stmt.remainingDue > 0;
    if (!isOpen || stmt.dueDate !== dateStr) continue;
    const card = ctx.accounts.find((a) => a.id === stmt.accountId);
    outflow += Number(stmt.remainingDue);
    events.push(`Credit Card: ${card?.name || 'Card'} Bill`);
  }
  return { outflow, events };
}

function computeDayFlows(ctx: DayProjectionContext, d: Date, dateStr: string) {
  const cal: DayCalendarInfo = {
    dom: d.getDate(),
    year: d.getFullYear(),
    monthIdx: d.getMonth(),
    monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
  };
  let scheduledInflow = 0;
  const events: string[] = [];

  if (ctx.estimatedMonthlyIncome > 0 && cal.dom === clampDayForMonth({ dayOfMonth: ctx.paydayOfMonth, year: cal.year, monthIndex: cal.monthIdx })) {
    scheduledInflow += ctx.estimatedMonthlyIncome;
    events.push(`Expected Income (+₹${ctx.estimatedMonthlyIncome.toLocaleString('en-IN')})`);
  }

  const bill = collectBillOutflows(ctx, cal);
  const recurring = collectEmiSipCommitmentOutflows(ctx, cal);
  const cards = collectCreditCardOutflows(ctx, dateStr);
  return {
    scheduledInflow,
    scheduledOutflow: bill.outflow + recurring.outflow + cards.outflow,
    events: [...events, ...bill.events, ...recurring.events, ...cards.events],
  };
}

interface ForecastHorizonParams {
  today: Date;
  horizonDays: number;
  startingLiquidBalance: number;
  dailyDiscretionaryBurn: number;
  ctx: DayProjectionContext;
}

function createInitialForecastPoint(dateStr: string, d: Date, startingLiquidBalance: number): CashFlowForecastPoint {
  return {
    dayOffset: 0,
    dateStr,
    label: formatShortLabel(d),
    projectedBalance: startingLiquidBalance,
    scheduledInflow: 0,
    scheduledOutflow: 0,
    discretionaryBurn: 0,
    events: [],
  };
}

function simulateForecastHorizon(params: ForecastHorizonParams) {
  const { today, horizonDays, startingLiquidBalance, dailyDiscretionaryBurn, ctx } = params;
  const points: CashFlowForecastPoint[] = [createInitialForecastPoint(toIsoDate(today), today, startingLiquidBalance)];
  let runningBalance = startingLiquidBalance;
  let lowestProjectedBalance = startingLiquidBalance;
  let lowestBalanceDate: string | null = toIsoDate(today);
  let crunchDate: string | null = null;
  let totalScheduledOutflows = 0;

  for (let offset = 1; offset <= horizonDays; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    const dateStr = toIsoDate(d);
    const flows = computeDayFlows(ctx, d, dateStr);
    totalScheduledOutflows += flows.scheduledOutflow;
    runningBalance = Math.round(runningBalance + flows.scheduledInflow - flows.scheduledOutflow - dailyDiscretionaryBurn);
    if (runningBalance < lowestProjectedBalance) {
      lowestProjectedBalance = runningBalance;
      lowestBalanceDate = dateStr;
    }
    if (crunchDate === null && runningBalance < 0) crunchDate = dateStr;

    points.push({
      dayOffset: offset,
      dateStr,
      label: formatShortLabel(d),
      projectedBalance: runningBalance,
      scheduledInflow: flows.scheduledInflow,
      scheduledOutflow: flows.scheduledOutflow,
      discretionaryBurn: dailyDiscretionaryBurn,
      events: flows.events,
    });
  }

  return {
    points,
    endingProjectedBalance: runningBalance,
    lowestProjectedBalance,
    lowestBalanceDate,
    crunchDate,
    totalScheduledOutflows: Math.round(totalScheduledOutflows),
  };
}

/**
 * Deterministic 30/60/90-day Cash-Flow Forecast & Payday Runway Engine.
 */
export function buildCashFlowForecast(input: CashFlowForecastInput): CashFlowForecastResult {
  const activeAccounts = input.accounts.filter((a) => !a.archived && !a.deletedAt);
  const liquidTypes = new Set(['bank', 'upi', 'cash', 'wallet']);
  const startingLiquidBalance = Math.round(
    activeAccounts.filter((a) => liquidTypes.has(a.type)).reduce((sum, a) => sum + Number(a.balance || 0), 0)
  );

  const today = new Date(`${input.referenceDate || getIstIsoDate()}T00:00:00`);
  today.setHours(0, 0, 0, 0);
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailyDiscretionaryBurn = computeDailyBurn({
    transactions: input.transactions,
    thirtyDaysAgoStr: toIsoDate(thirtyDaysAgo),
    todayStr: toIsoDate(today),
    includeDiscretionaryBurn: input.includeDiscretionaryBurn ?? true,
  });
  const { estimatedMonthlyIncome, paydayOfMonth } = estimateMonthlyIncomeAndPayday({
    transactions: input.transactions,
    budgets: input.budgets,
    currentMonthKey,
    paydayOverride: input.paydayOfMonth,
  });

  const ctx: DayProjectionContext = {
    todayMonth: today.getMonth(),
    estimatedMonthlyIncome,
    paydayOfMonth,
    activeBills: input.recurringBills.filter((b) => b.isActive && !b.deletedAt),
    activeEmis: input.emiTrackers.filter((e) => e.status === 'active' && !e.deletedAt),
    activeSips: input.sipPlans.filter((s) => s.isActive && !s.deletedAt),
    activeCommitments: input.commitments.filter((c) => c.isActive && !c.deletedAt),
    creditCardStatements: input.creditCardStatements || [],
    creditCardAccountIds: new Set(activeAccounts.filter((a) => a.type === 'credit_card').map((a) => a.id)),
    accounts: input.accounts,
  };

  const sim = simulateForecastHorizon({
    today,
    horizonDays: input.horizonDays,
    startingLiquidBalance,
    dailyDiscretionaryBurn,
    ctx,
  });
  return {
    ...sim,
    startingLiquidBalance,
    dailyDiscretionaryBurn,
    estimatedMonthlyIncome,
    paydayOfMonth,
  };
}
