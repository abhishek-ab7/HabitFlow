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

function clampDayForMonth(dayOfMonth: number, year: number, monthIndex: number): number {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(Math.max(1, dayOfMonth || 1), daysInMonth);
}

/**
 * Deterministic 30/60/90-day Cash-Flow Forecast & Payday Runway Engine.
 * Projects liquid account balances forward using recurring bills, EMIs, SIPs,
 * monthly commitments, trailing discretionary burn, and expected salary inflows.
 */
export function buildCashFlowForecast(input: CashFlowForecastInput): CashFlowForecastResult {
  const {
    accounts,
    transactions,
    budgets,
    recurringBills,
    emiTrackers,
    sipPlans,
    commitments,
    creditCardStatements,
    horizonDays,
    includeDiscretionaryBurn = true,
  } = input;

  const activeAccounts = accounts.filter((a) => !a.archived && !a.deletedAt);
  const liquidAccounts = activeAccounts.filter(
    (a) => a.type === 'bank' || a.type === 'upi' || a.type === 'cash' || a.type === 'wallet'
  );
  const startingLiquidBalance = Math.round(
    liquidAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0)
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  // Estimate trailing 30-day discretionary daily burn (excluding linked bills/EMIs/commitments/SIPs)
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = toIsoDate(thirtyDaysAgo);
  const todayStr = toIsoDate(today);

  const recentDiscretionary = transactions.filter(
    (t) =>
      !t.deletedAt &&
      t.type === 'expense' &&
      t.date >= thirtyDaysAgoStr &&
      t.date <= todayStr &&
      !t.linkedEmiId &&
      !t.linkedCommitmentId &&
      !t.linkedSipId &&
      !t.isRecurring
  );
  const rawDailyBurn =
    recentDiscretionary.reduce((sum, t) => sum + Number(t.amount || 0), 0) / 30;
  const dailyDiscretionaryBurn = includeDiscretionaryBurn ? Math.round(rawDailyBurn) : 0;

  // Determine expected monthly income & likely payday from recent income or budget
  const recentIncomes = transactions
    .filter((t) => !t.deletedAt && t.type === 'income' && t.amount > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  const currentBudget = budgets.find((b) => b.monthKey === currentMonthKey && !b.deletedAt);
  const recentMonthlyIncomeAvg = (() => {
    if (recentIncomes.length === 0) return 0;
    const byMonth = new Map<string, number>();
    for (const tx of recentIncomes.slice(0, 20)) {
      byMonth.set(tx.monthKey, (byMonth.get(tx.monthKey) || 0) + tx.amount);
    }
    const vals = Array.from(byMonth.values()).slice(0, 3);
    return vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
  })();

  const estimatedMonthlyIncome = Math.round(
    currentBudget?.expectedIncome && currentBudget.expectedIncome > 0
      ? currentBudget.expectedIncome
      : recentMonthlyIncomeAvg
  );

  // Infer payday from largest recent income transaction day, defaulting to 1st of month
  const largestIncome = recentIncomes.reduce<FinanceTransaction | null>(
    (best, tx) => (!best || tx.amount > best.amount ? tx : best),
    null
  );
  const paydayOfMonth = largestIncome?.date
    ? Math.min(28, Math.max(1, parseInt(largestIncome.date.slice(8, 10), 10) || 1))
    : 1;

  const activeBills = recurringBills.filter((b) => b.isActive && !b.deletedAt);
  const activeEmis = emiTrackers.filter((e) => e.status === 'active' && !e.deletedAt);
  const activeSips = sipPlans.filter((s) => s.isActive && !s.deletedAt);
  const activeCommitments = commitments.filter((c) => c.isActive && !c.deletedAt);

  const points: CashFlowForecastPoint[] = [];
  let runningBalance = startingLiquidBalance;
  let lowestProjectedBalance = startingLiquidBalance;
  let lowestBalanceDate: string | null = todayStr;
  let crunchDate: string | null = null;
  let totalScheduledOutflows = 0;

  for (let offset = 0; offset <= horizonDays; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    const year = d.getFullYear();
    const monthIdx = d.getMonth();
    const dom = d.getDate();
    const monthKey = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
    const dateStr = toIsoDate(d);

    let scheduledInflow = 0;
    let scheduledOutflow = 0;
    const events: string[] = [];

    if (offset > 0) {
      // Payday inflow
      if (estimatedMonthlyIncome > 0 && dom === clampDayForMonth(paydayOfMonth, year, monthIdx)) {
        scheduledInflow += estimatedMonthlyIncome;
        events.push(`Expected Income (+₹${estimatedMonthlyIncome.toLocaleString('en-IN')})`);
      }

      // Recurring Bills
      for (const bill of activeBills) {
        if (bill.lastPaidMonthKey === monthKey) continue;
        const dueDay = clampDayForMonth(bill.dueDayOfMonth, year, monthIdx);
        if (dom === dueDay) {
          // Quarterly/Yearly cadence check: approximate for future months
          if (bill.cadence === 'quarterly' && monthIdx % 3 !== today.getMonth() % 3) continue;
          if (bill.cadence === 'yearly' && monthIdx !== today.getMonth()) continue;
          scheduledOutflow += Number(bill.amount || 0);
          events.push(`Bill: ${bill.name}`);
        }
      }

      // EMIs
      for (const emi of activeEmis) {
        if (emi.lastPaidMonthKey === monthKey) continue;
        if (emi.paidMonths >= emi.tenureMonths) continue;
        const dueDay = clampDayForMonth(emi.billingDayOfMonth, year, monthIdx);
        if (dom === dueDay) {
          scheduledOutflow += Number(emi.emiAmount || 0);
          events.push(`EMI: ${emi.loanName}`);
        }
      }

      // SIPs
      for (const sip of activeSips) {
        if (sip.lastInvestedMonthKey === monthKey) continue;
        const sipDay = clampDayForMonth(sip.sipDayOfMonth, year, monthIdx);
        if (dom === sipDay) {
          scheduledOutflow += Number(sip.monthlyAmount || 0);
          events.push(`SIP: ${sip.name}`);
        }
      }

      // Monthly Commitments
      for (const comm of activeCommitments) {
        const dueDay = clampDayForMonth(comm.dueDayOfMonth, year, monthIdx);
        if (dom === dueDay) {
          scheduledOutflow += Number(comm.monthlyTargetAmount || 0);
          events.push(`Commitment: ${comm.title}`);
        }
      }

      // Credit Card Statements Due
      if (creditCardStatements && creditCardStatements.length > 0) {
        for (const stmt of creditCardStatements) {
          if (stmt.deletedAt || stmt.status === 'paid' || stmt.remainingDue <= 0) continue;
          if (stmt.dueDate === dateStr) {
            const card = accounts.find((a) => a.id === stmt.accountId);
            scheduledOutflow += Number(stmt.remainingDue);
            events.push(`Credit Card: ${card?.name || 'Card'} Bill`);
          }
        }
      }

      totalScheduledOutflows += scheduledOutflow;
      runningBalance = Math.round(
        runningBalance + scheduledInflow - scheduledOutflow - dailyDiscretionaryBurn
      );

      if (runningBalance < lowestProjectedBalance) {
        lowestProjectedBalance = runningBalance;
        lowestBalanceDate = dateStr;
      }
      if (crunchDate === null && runningBalance < 0) {
        crunchDate = dateStr;
      }
    }

    points.push({
      dayOffset: offset,
      dateStr,
      label: formatShortLabel(d),
      projectedBalance: runningBalance,
      scheduledInflow,
      scheduledOutflow,
      discretionaryBurn: offset === 0 ? 0 : dailyDiscretionaryBurn,
      events,
    });
  }

  return {
    points,
    startingLiquidBalance,
    endingProjectedBalance: runningBalance,
    lowestProjectedBalance,
    lowestBalanceDate,
    crunchDate,
    dailyDiscretionaryBurn,
    estimatedMonthlyIncome,
    paydayOfMonth,
    totalScheduledOutflows: Math.round(totalScheduledOutflows),
  };
}
