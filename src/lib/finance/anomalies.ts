import type {
  DebtRecord,
  EmiTracker,
  FinanceAccount,
  FinanceAnomalyAlert,
  FinanceCategory,
  FinanceRecurringBill,
  FinanceSipPlan,
  FinanceTransaction,
  FinancialObligationItem,
  MonthlyFinanceSummary,
  NetWorthSummary,
} from '@/lib/types';

function shiftMonthKey(monthKey: string, delta: number): string {
  const [yStr, mStr] = monthKey.split('-');
  const d = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daysSinceIsoDate(isoDate: string): number {
  const parsed = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  if (isNaN(parsed.getTime())) return 0;
  const diffMs = Date.now() - parsed.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export interface AnomalyDetectionInput {
  selectedMonth: string;
  transactions: FinanceTransaction[];
  categories: FinanceCategory[];
  accounts: FinanceAccount[];
  debtRecords: DebtRecord[];
  recurringBills: FinanceRecurringBill[];
  upcomingObligations7d: FinancialObligationItem[];
}

/**
 * Pure deterministic engine surfacing actionable personal finance anomalies:
 * - Category spend spikes (>30% above trailing 3-month pace)
 * - Subscription/bill price hikes
 * - Unsettled friend debts older than 14 days
 * - Unreviewed transaction backlog (>= 3 items)
 * - Short-term liquid cash crunch (next 7d dues > liquid balance)
 */
export function detectSpendingAnomalies(
  input: AnomalyDetectionInput
): FinanceAnomalyAlert[] {
  const {
    selectedMonth,
    transactions,
    categories,
    accounts,
    debtRecords,
    recurringBills,
    upcomingObligations7d,
  } = input;

  const alerts: FinanceAnomalyAlert[] = [];
  const activeTxs = transactions.filter((t) => !t.deletedAt);

  // 1. Category Spend Spikes vs. Trailing 3-Month Pace
  const prevMonths = [
    shiftMonthKey(selectedMonth, -1),
    shiftMonthKey(selectedMonth, -2),
    shiftMonthKey(selectedMonth, -3),
  ];

  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const isCurrentMonth = selectedMonth === currentMonthKey;
  const daysInSelectedMonth = new Date(
    parseInt(selectedMonth.slice(0, 4), 10),
    parseInt(selectedMonth.slice(5, 7), 10),
    0
  ).getDate();
  const elapsedFraction = isCurrentMonth
    ? Math.max(0.2, today.getDate() / daysInSelectedMonth)
    : 1;

  const currentByCat = new Map<string, number>();
  const trailingByCat = new Map<string, Map<string, number>>();

  for (const tx of activeTxs) {
    if (tx.type !== 'expense') continue;
    if (tx.monthKey === selectedMonth) {
      currentByCat.set(tx.categoryId, (currentByCat.get(tx.categoryId) || 0) + tx.amount);
    } else if (prevMonths.includes(tx.monthKey)) {
      const mMap = trailingByCat.get(tx.categoryId) || new Map<string, number>();
      mMap.set(tx.monthKey, (mMap.get(tx.monthKey) || 0) + tx.amount);
      trailingByCat.set(tx.categoryId, mMap);
    }
  }

  let topSpike: { catName: string; pct: number; current: number; expected: number } | null = null;
  for (const [catId, currentSpent] of currentByCat.entries()) {
    if (currentSpent < 1000) continue; // Avoid tiny noise alerts
    const histMap = trailingByCat.get(catId);
    if (!histMap || histMap.size === 0) continue;
    const histValues = Array.from(histMap.values());
    const avgFullMonth = histValues.reduce((s, v) => s + v, 0) / histValues.length;
    const expectedAtPace = avgFullMonth * elapsedFraction;
    if (expectedAtPace < 500) continue;

    const spikePct = Math.round(((currentSpent - expectedAtPace) / expectedAtPace) * 100);
    if (spikePct >= 30) {
      const cat = categories.find((c) => c.id === catId);
      if (!topSpike || spikePct > topSpike.pct) {
        topSpike = {
          catName: cat?.name || 'Category',
          pct: spikePct,
          current: Math.round(currentSpent),
          expected: Math.round(expectedAtPace),
        };
      }
    }
  }

  if (topSpike) {
    alerts.push({
      id: `spike-${topSpike.catName}`,
      severity: topSpike.pct >= 60 ? 'critical' : 'warning',
      kind: 'category_spike',
      title: `${topSpike.catName} up +${topSpike.pct}% vs pace`,
      description: `Spent ₹${topSpike.current.toLocaleString('en-IN')} so far vs typical ₹${topSpike.expected.toLocaleString('en-IN')} at this point in the month.`,
      amount: topSpike.current - topSpike.expected,
      actionLabel: 'Inspect Activity',
      actionTarget: 'activity',
    });
  }

  // 2. Cash Crunch Check (Next 7d dues vs liquid balance)
  const liquidBalance = accounts
    .filter(
      (a) =>
        !a.archived &&
        !a.deletedAt &&
        (a.type === 'bank' || a.type === 'upi' || a.type === 'cash' || a.type === 'wallet')
    )
    .reduce((sum, a) => sum + Number(a.balance || 0), 0);

  const pending7dTotal = upcomingObligations7d
    .filter((o) => o.status === 'pending')
    .reduce((sum, o) => sum + Number(o.amount || 0), 0);

  if (pending7dTotal > 0 && liquidBalance > 0 && pending7dTotal > liquidBalance) {
    alerts.push({
      id: 'cash-crunch-7d',
      severity: 'critical',
      kind: 'cash_crunch',
      title: 'Upcoming 7-day bills exceed liquid balance',
      description: `₹${Math.round(pending7dTotal).toLocaleString('en-IN')} due within 7 days against ₹${Math.round(liquidBalance).toLocaleString('en-IN')} across liquid accounts.`,
      amount: Math.round(pending7dTotal - liquidBalance),
      actionLabel: 'View Bills',
      actionTarget: 'trackers',
    });
  }

  // 3. Subscription / Bill Price Hikes
  const hikedBills = recurringBills.filter(
    (b) => b.isActive && !b.deletedAt && b.previousAmount && b.amount > b.previousAmount
  );
  if (hikedBills.length > 0) {
    const first = hikedBills[0];
    const diff = Math.round(first.amount - (first.previousAmount || 0));
    alerts.push({
      id: `sub-hike-${first.id}`,
      severity: 'warning',
      kind: 'subscription_hike',
      title: `${first.name} increased by ₹${diff.toLocaleString('en-IN')}`,
      description:
        hikedBills.length > 1
          ? `${hikedBills.length} recurring bills increased in price compared to previous billing.`
          : `Moved from ₹${Math.round(first.previousAmount || 0).toLocaleString('en-IN')} to ₹${Math.round(first.amount).toLocaleString('en-IN')}.`,
      amount: diff,
      actionLabel: 'Audit Subscriptions',
      actionTarget: 'trackers',
    });
  }

  // 4. Idle Friend Balances (> 14 days unsettled)
  const idleDebts = debtRecords.filter(
    (d) =>
      !d.deletedAt &&
      d.status === 'active' &&
      d.remainingAmount > 0 &&
      daysSinceIsoDate(d.updatedAt || d.startDate) >= 14
  );
  if (idleDebts.length > 0) {
    const totalIdle = Math.round(
      idleDebts.reduce((sum, d) => sum + Number(d.remainingAmount || 0), 0)
    );
    const lentCount = idleDebts.filter((d) => d.direction === 'lent').length;
    alerts.push({
      id: 'idle-friend-balances',
      severity: 'info',
      kind: 'idle_friend_debt',
      title: `${idleDebts.length} friend ${idleDebts.length === 1 ? 'balance' : 'balances'} idle 14+ days`,
      description:
        lentCount > 0
          ? `₹${totalIdle.toLocaleString('en-IN')} still open (${lentCount} receivable). Consider sending a quick settle reminder.`
          : `₹${totalIdle.toLocaleString('en-IN')} in open friend repayments untouched for 2+ weeks.`,
      amount: totalIdle,
      actionLabel: 'Open Friends Ledger',
      actionTarget: 'trackers',
    });
  }

  // 5. Unreviewed Transaction Backlog
  const needsReviewCount = activeTxs.filter((t) => t.needsReview).length;
  if (needsReviewCount >= 3) {
    alerts.push({
      id: 'needs-review-backlog',
      severity: 'info',
      kind: 'review_backlog',
      title: `${needsReviewCount} transactions waiting for review`,
      description: 'Approve auto-imported SMS or receipt entries to keep category analytics accurate.',
      amount: needsReviewCount,
      actionLabel: 'Triage Inbox',
      actionTarget: 'activity',
    });
  }

  return alerts.slice(0, 4);
}

/**
 * Builds a privacy-safe aggregated snapshot of local Dexie finance state
 * for the server-side "Ask My Finances" AI Q&A route.
 */
export function buildFinanceQAContext(params: {
  selectedMonth: string;
  summary: MonthlyFinanceSummary;
  netWorth: NetWorthSummary;
  transactions: FinanceTransaction[];
  categories: FinanceCategory[];
  accounts: FinanceAccount[];
  recurringBills: FinanceRecurringBill[];
  emiTrackers: EmiTracker[];
  sipPlans: FinanceSipPlan[];
  debtRecords: DebtRecord[];
  anomalies: FinanceAnomalyAlert[];
}) {
  const {
    selectedMonth,
    summary,
    netWorth,
    transactions,
    categories,
    accounts,
    recurringBills,
    emiTrackers,
    sipPlans,
    debtRecords,
    anomalies,
  } = params;

  const activeTxs = transactions.filter((t) => !t.deletedAt);
  const monthTxs = activeTxs.filter((t) => t.monthKey === selectedMonth);

  // Aggregate top merchants in selected month (no personal notes sent)
  const merchantTotals = new Map<string, { spent: number; count: number; category: string }>();
  for (const tx of monthTxs) {
    if (tx.type !== 'expense') continue;
    const key = (tx.merchantName || tx.title || 'Unknown').trim();
    const catName = categories.find((c) => c.id === tx.categoryId)?.name || 'Other';
    const curr = merchantTotals.get(key) || { spent: 0, count: 0, category: catName };
    curr.spent += tx.amount;
    curr.count += 1;
    merchantTotals.set(key, curr);
  }
  const topMerchants = Array.from(merchantTotals.entries())
    .sort((a, b) => b[1].spent - a[1].spent)
    .slice(0, 12)
    .map(([merchant, stats]) => ({
      merchant,
      spent: Math.round(stats.spent),
      count: stats.count,
      category: stats.category,
    }));

  // Trailing 3 months overview
  const trailingMonths = [0, -1, -2].map((delta) => {
    const mk = shiftMonthKey(selectedMonth, delta);
    const mTxs = activeTxs.filter((t) => t.monthKey === mk);
    const spent = Math.round(
      mTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    );
    const income = Math.round(
      mTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    );
    const invested = Math.round(
      mTxs.filter((t) => t.type === 'investment').reduce((s, t) => s + t.amount, 0)
    );
    return { monthKey: mk, income, spent, invested };
  });

  return {
    currency: 'INR',
    selectedMonth,
    monthlySummary: {
      totalIncome: Math.round(summary.totalIncome),
      totalSpent: Math.round(summary.totalSpent),
      totalInvested: Math.round(summary.totalInvested),
      monthlyBudget: Math.round(summary.monthlyBudget),
      safeToSpendMonthly: Math.round(summary.safeToSpendMonthly),
      safeToSpendDaily: Math.round(summary.safeToSpendDaily),
      remainingDaysInMonth: summary.remainingDaysInMonth,
      savingsRatePct: Math.round(summary.savingsRate),
      remainingUnpaidBills: Math.round(summary.remainingUnpaidBills),
      remainingUnpaidEmis: Math.round(summary.remainingUnpaidEmis),
      remainingUnpaidCommitments: Math.round(summary.remainingUnpaidCommitments),
      needsReviewCount: summary.needsReviewCount,
    },
    netWorth: {
      netWorth: Math.round(netWorth.netWorth),
      liquidAssets: Math.round(netWorth.liquidAssets),
      investmentAssets: Math.round(netWorth.investmentAssets),
      totalLiabilities: Math.round(netWorth.totalLiabilities),
      creditCardLiabilities: Math.round(netWorth.creditCardLiabilities),
      emiRemainingPrincipal: Math.round(netWorth.emiRemainingPrincipal),
    },
    categories: summary.categoryBreakdown.map((item) => ({
      name: item.category.name,
      spent: Math.round(item.spent),
      budgetLimit: Math.round(item.budgetLimit),
      transactionCount: item.transactionCount,
      status: item.status,
    })),
    accounts: accounts
      .filter((a) => !a.archived && !a.deletedAt)
      .map((a) => ({
        name: a.name,
        type: a.type,
        balance: Math.round(a.balance),
        creditLimit: a.creditLimit || null,
      })),
    recurringBills: recurringBills
      .filter((b) => b.isActive && !b.deletedAt)
      .map((b) => ({
        name: b.name,
        amount: Math.round(b.amount),
        cadence: b.cadence,
        dueDay: b.dueDayOfMonth,
        annualized: Math.round(
          b.cadence === 'yearly' ? b.amount : b.cadence === 'quarterly' ? b.amount * 4 : b.amount * 12
        ),
      })),
    activeEmis: emiTrackers
      .filter((e) => e.status === 'active' && !e.deletedAt)
      .map((e) => ({
        name: e.loanName,
        emiAmount: Math.round(e.emiAmount),
        remainingMonths: Math.max(0, e.tenureMonths - e.paidMonths),
        interestRate: e.interestRateAnnual,
      })),
    activeSips: sipPlans
      .filter((s) => s.isActive && !s.deletedAt)
      .map((s) => ({
        name: s.name,
        monthlyAmount: Math.round(s.monthlyAmount),
        totalInvested: Math.round(s.totalInvested),
        currentValue: Math.round(s.currentValue),
      })),
    openFriendDebts: debtRecords
      .filter((d) => d.status === 'active' && !d.deletedAt && d.remainingAmount > 0)
      .map((d) => ({
        person: d.personName,
        direction: d.direction,
        remaining: Math.round(d.remainingAmount),
      })),
    topMerchants,
    trailingMonths,
    anomalies: anomalies.map((a) => ({
      severity: a.severity,
      title: a.title,
      description: a.description,
    })),
  };
}
