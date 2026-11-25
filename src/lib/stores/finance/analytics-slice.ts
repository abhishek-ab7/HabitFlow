import { buildCashFlowForecast } from '@/lib/finance/forecast';
import { detectSpendingAnomalies } from '@/lib/finance/anomalies';
import { getLocalIsoDate, daysBetween } from '@/lib/finance/credit-card-cycles';
import type {
  CategorySpendItem,
  CommitmentLedgerSummary,
  DailyPacePoint,
  FinancialObligationItem,
  FriendLedgerGroup,
} from '@/lib/types';
import {
  formatINR,
  getCurrentMonthKey,
  getPreviousMonthKey,
  type FinanceSliceCreator,
  type FinanceStore,
} from './helpers';

export type AnalyticsSlice = Pick<
  FinanceStore,
  | 'exportTransactionsCsv'
  | 'getNetWorthSummary'
  | 'getNetWorthHistory'
  | 'getDailySpendingPace'
  | 'getCommitmentLedger'
  | 'getAllCommitmentLedgers'
  | 'getMonthlySummary'
  | 'getFriendLedgerGroups'
  | 'getDebtSummary'
  | 'getDebtInstallments'
  | 'getUpcomingFinancialObligations'
  | 'getFilteredTransactions'
  | 'getSixMonthSpendingTrends'
  | 'getYearlySpendingTrends'
  | 'getCashFlowForecast'
  | 'getSpendingAnomalies'
>;

export const createAnalyticsSlice: FinanceSliceCreator<AnalyticsSlice> = (_set, get) => {
  const memoCache = new Map<string, { refs: unknown[]; argKey: string; value: unknown }>();

  function memoize<T>(slotKey: string, refs: unknown[], argKey: string, compute: () => T): T {
    const entry = memoCache.get(slotKey);
    if (
      entry &&
      entry.argKey === argKey &&
      entry.refs.length === refs.length &&
      entry.refs.every((r, idx) => Object.is(r, refs[idx]))
    ) {
      return entry.value as T;
    }
    const value = compute();
    memoCache.set(slotKey, { refs, argKey, value });
    return value;
  }

  return {
  exportTransactionsCsv: (monthKey) => {
    const list = get().getFilteredTransactions(monthKey);
    const categoriesMap = new Map(get().categories.map((c) => [c.id, c.name]));
    const accountsMap = new Map(get().accounts.map((a) => [a.id, a.name]));
    const commitmentsMap = new Map(get().commitments.map((c) => [c.id, c.title]));
    const debtsMap = new Map(get().debtRecords.map((d) => [d.id, d.personName]));

    const headers = [
      'Date',
      'Title',
      'Merchant',
      'Type',
      'Amount (INR)',
      'Category',
      'Subcategory',
      'Account',
      'Commitment Link',
      'Contribution Type',
      'Friend Debt Link',
      'Tags',
      'Notes',
    ];

    const escapeCsv = (val: string | number | undefined | null) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = list.map((t) => [
      escapeCsv(t.date),
      escapeCsv(t.title),
      escapeCsv(t.merchantName || t.rawMerchant || ''),
      escapeCsv(t.type),
      t.amount,
      escapeCsv(categoriesMap.get(t.categoryId) || 'Uncategorized'),
      escapeCsv(t.subcategory || ''),
      escapeCsv(accountsMap.get(t.accountId) || 'Account'),
      escapeCsv(t.linkedCommitmentId ? commitmentsMap.get(t.linkedCommitmentId) : ''),
      escapeCsv(t.commitmentContributionType || ''),
      escapeCsv(t.linkedDebtId ? debtsMap.get(t.linkedDebtId) : ''),
      escapeCsv((t.tags || []).join('; ')),
      escapeCsv(t.notes || ''),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  },

  getNetWorthSummary: () => {
    const state = get();
    return memoize(
      'netWorthSummary',
      [state.accounts, state.sipPlans, state.debtRecords, state.emiTrackers],
      '',
      () => {
    const accounts = state.accounts.filter(
      (a) => !a.archived && !a.deletedAt && a.includeInNetWorth !== false
    );
    const liquidAssets = accounts
      .filter((a) => a.type === 'bank' || a.type === 'upi' || a.type === 'cash' || a.type === 'wallet')
      .reduce((sum, a) => sum + Math.max(0, a.balance), 0);

    const investmentAccountAssets = accounts
      .filter((a) => a.type === 'investment')
      .reduce((sum, a) => sum + Math.max(0, a.balance), 0);

    const sipCorpus = state
      .sipPlans.filter((s) => s.isActive && !s.deletedAt)
      .reduce((sum, s) => sum + Math.max(s.currentValue || 0, s.totalInvested || 0), 0);

    const investmentAssets = investmentAccountAssets + sipCorpus;

    const debtSummary = state.getDebtSummary();
    const friendReceivables = debtSummary.totalLentRemaining;
    const friendPayables = debtSummary.totalBorrowedRemaining;

    const creditCardLiabilities = accounts
      .filter((a) => a.type === 'credit_card')
      .reduce((sum, a) => sum + Math.abs(a.balance), 0);

    const emiRemainingPrincipal = state
      .emiTrackers.filter((e) => e.status === 'active' && !e.deletedAt)
      .reduce((sum, e) => {
        const remainingMonths = Math.max(0, e.tenureMonths - e.paidMonths);
        const approxPrincipalLeft =
          e.tenureMonths > 0
            ? Math.round((remainingMonths / e.tenureMonths) * e.principalAmount)
            : 0;
        return sum + approxPrincipalLeft;
      }, 0);

    const totalAssets = liquidAssets + investmentAssets + friendReceivables;
    const totalLiabilities = creditCardLiabilities + emiRemainingPrincipal + friendPayables;
    const netWorth = totalAssets - totalLiabilities;

    return {
      liquidAssets,
      investmentAssets,
      friendReceivables,
      totalAssets,
      creditCardLiabilities,
      emiRemainingPrincipal,
      friendPayables,
      totalLiabilities,
      netWorth,
    };
      }
    );
  },

  getNetWorthHistory: (months = 6) => {
    const currentMonth = getCurrentMonthKey();
    const currentNW = get().getNetWorthSummary();
    const savedMap = new Map(
      get()
        .netWorthSnapshots.filter((s) => !s.deletedAt)
        .map((s) => [s.monthKey, s])
    );

    const monthKeys: string[] = [];
    let cursor = currentMonth;
    for (let i = 0; i < months; i++) {
      monthKeys.unshift(cursor);
      cursor = getPreviousMonthKey(cursor);
    }

    // Back-reconstruct missing historical months smoothly using net monthly cashflow deltas
    const txs = get().transactions.filter((t) => !t.deletedAt);
    const netDeltaByMonth = new Map<string, number>();
    for (const tx of txs) {
      if (tx.type === 'income') {
        netDeltaByMonth.set(tx.monthKey, (netDeltaByMonth.get(tx.monthKey) || 0) + tx.amount);
      } else if (tx.type === 'expense') {
        netDeltaByMonth.set(tx.monthKey, (netDeltaByMonth.get(tx.monthKey) || 0) - tx.amount);
      }
    }

    const reconstructed = new Map<string, { netWorth: number; totalAssets: number; totalLiabilities: number }>();
    reconstructed.set(currentMonth, {
      netWorth: currentNW.netWorth,
      totalAssets: currentNW.totalAssets,
      totalLiabilities: currentNW.totalLiabilities,
    });

    let runningNW = currentNW.netWorth;
    let runningAssets = currentNW.totalAssets;
    for (let i = monthKeys.length - 1; i > 0; i--) {
      const mKey = monthKeys[i];
      const prevKey = monthKeys[i - 1];
      const delta = netDeltaByMonth.get(mKey) || 0;
      runningNW = Math.round(runningNW - delta);
      runningAssets = Math.max(0, Math.round(runningAssets - delta));
      reconstructed.set(prevKey, {
        netWorth: runningNW,
        totalAssets: runningAssets,
        totalLiabilities: currentNW.totalLiabilities,
      });
    }

    return monthKeys.map((mKey) => {
      const [yStr, mStr] = mKey.split('-');
      const d = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
      const label = d.toLocaleDateString('en-IN', { month: 'short' });
      const snap = savedMap.get(mKey);
      if (snap && mKey !== currentMonth) {
        return {
          monthKey: mKey,
          label,
          netWorth: Math.round(snap.netWorth),
          totalAssets: Math.round(snap.totalAssets),
          totalLiabilities: Math.round(snap.totalLiabilities),
        };
      }
      const fallback = reconstructed.get(mKey) || {
        netWorth: currentNW.netWorth,
        totalAssets: currentNW.totalAssets,
        totalLiabilities: currentNW.totalLiabilities,
      };
      return {
        monthKey: mKey,
        label,
        netWorth: Math.round(fallback.netWorth),
        totalAssets: Math.round(fallback.totalAssets),
        totalLiabilities: Math.round(fallback.totalLiabilities),
      };
    });
  },

  getDailySpendingPace: (monthKey) => {
    const targetMonth = monthKey || get().selectedMonth;
    const prevMonth = getPreviousMonthKey(targetMonth);
    const [yStr, mStr] = targetMonth.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const now = new Date();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
    const isFutureMonth =
      year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);
    const todayDayOfMonth = now.getDate();

    const summary = get().getMonthlySummary(targetMonth);
    const monthlyBudget = summary.monthlyBudget;

    const currentMonthTxs = get().transactions.filter(
      (t) => t.monthKey === targetMonth && t.type === 'expense' && !t.deletedAt
    );
    const prevMonthTxs = get().transactions.filter(
      (t) => t.monthKey === prevMonth && t.type === 'expense' && !t.deletedAt
    );

    const points: DailyPacePoint[] = [];
    let runningCurrent = 0;
    let runningPrev = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const paddedDay = String(day).padStart(2, '0');
      const dateStr = `${targetMonth}-${paddedDay}`;
      const prevDateStr = `${prevMonth}-${paddedDay}`;

      const daySpend = currentMonthTxs
        .filter((t) => t.date === dateStr)
        .reduce((sum, t) => sum + t.amount, 0);
      runningCurrent += daySpend;

      const prevDaySpend = prevMonthTxs
        .filter((t) => t.date === prevDateStr)
        .reduce((sum, t) => sum + t.amount, 0);
      runningPrev += prevDaySpend;

      const idealCumulativeBudget =
        monthlyBudget > 0 ? Math.round((monthlyBudget / daysInMonth) * day) : 0;

      const isFutureDay = isFutureMonth || (isCurrentMonth && day > todayDayOfMonth);

      points.push({
        day,
        dateStr,
        cumulativeSpent: isFutureDay ? null : runningCurrent,
        idealCumulativeBudget,
        lastMonthCumulativeSpent: runningPrev,
      });
    }

    return points;
  },

  getCommitmentLedger: (commitmentId, monthKey) => {
    const targetMonth = monthKey || get().selectedMonth;
    const commitment = get().commitments.find((c) => c.id === commitmentId);
    if (!commitment) return null;

    let rolloverFromPreviousMonth = 0;
    if (commitment.autoRolloverOverpayment) {
      const prevMonth = getPreviousMonthKey(targetMonth);
      const prevTx = get().transactions.filter(
        (t) => t.linkedCommitmentId === commitmentId && t.monthKey === prevMonth
      );
      const prevFulfilled = prevTx.reduce((sum, t) => sum + t.amount, 0);
      if (prevFulfilled > commitment.monthlyTargetAmount) {
        rolloverFromPreviousMonth = prevFulfilled - commitment.monthlyTargetAmount;
      }
    }

    const baseTargetAmount = commitment.monthlyTargetAmount;
    const effectiveTargetAmount = Math.max(0, baseTargetAmount - rolloverFromPreviousMonth);

    const monthTransactions = get().transactions.filter(
      (t) => t.linkedCommitmentId === commitmentId && t.monthKey === targetMonth
    );

    const directTransactions = monthTransactions.filter(
      (t) => t.commitmentContributionType === 'direct_payment'
    );
    const offsetTransactions = monthTransactions.filter(
      (t) => t.commitmentContributionType !== 'direct_payment'
    );

    const directPaidAmount = directTransactions.reduce((sum, t) => sum + t.amount, 0);
    const offsetExpensesAmount = offsetTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalFulfilledAmount = directPaidAmount + offsetExpensesAmount;

    const remainingBalance = Math.max(0, effectiveTargetAmount - totalFulfilledAmount);
    const overpaidAmount = Math.max(0, totalFulfilledAmount - effectiveTargetAmount);

    const progressPercentage =
      effectiveTargetAmount > 0
        ? Math.min(100, Math.round((totalFulfilledAmount / effectiveTargetAmount) * 100))
        : 100;

    let status: CommitmentLedgerSummary['status'] = 'unpaid';
    if (overpaidAmount > 0) {
      status = 'overpaid';
    } else if (remainingBalance === 0 && totalFulfilledAmount >= effectiveTargetAmount) {
      status = 'settled';
    } else if (totalFulfilledAmount > 0) {
      status = 'in_progress';
    }

    return {
      commitment,
      monthKey: targetMonth,
      baseTargetAmount,
      rolloverFromPreviousMonth,
      effectiveTargetAmount,
      directPaidAmount,
      offsetExpensesAmount,
      totalFulfilledAmount,
      remainingBalance,
      overpaidAmount,
      progressPercentage,
      status,
      transactions: monthTransactions,
      directTransactions,
      offsetTransactions,
    };
  },

  getAllCommitmentLedgers: (monthKey) => {
    const targetMonth = monthKey || get().selectedMonth;
    return get()
      .commitments.filter((c) => c.isActive && !c.deletedAt)
      .map((c) => get().getCommitmentLedger(c.id, targetMonth))
      .filter((l): l is CommitmentLedgerSummary => l !== null);
  },

  getMonthlySummary: (monthKey) => {
    const state = get();
    const targetMonth = monthKey || state.selectedMonth;
    const todayIso = getLocalIsoDate();
    return memoize(
      `monthlySummary:${targetMonth}`,
      [
        state.transactions,
        state.budgets,
        state.categories,
        state.commitments,
        state.emiTrackers,
        state.debtRecords,
        state.debtInstallments,
        state.recurringBills,
        state.sipPlans,
      ],
      `${targetMonth}|${todayIso}`,
      () => {
    const prevMonth = getPreviousMonthKey(targetMonth);
    const monthTransactions = state.transactions.filter(
      (t) => t.monthKey === targetMonth && !t.deletedAt
    );
    const prevMonthExpenses = state.transactions.filter(
      (t) => t.monthKey === prevMonth && t.type === 'expense' && !t.deletedAt
    );

    const totalIncome = monthTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expenseTransactions = monthTransactions.filter((t) => t.type === 'expense');
    const totalSpent = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);

    const investmentTransactions = monthTransactions.filter((t) => t.type === 'investment');
    const totalInvested = investmentTransactions.reduce((sum, t) => sum + t.amount, 0);

    const needsReviewCount = monthTransactions.filter((t) => !!t.needsReview).length;

    const budgetObj = get().budgets.find((b) => b.monthKey === targetMonth);
    const sumCategoryBudgets = get()
      .categories.filter((c) => c.type === 'expense' || c.type === 'both')
      .reduce((sum, c) => sum + c.monthlyBudgetLimit, 0);

    const monthlyBudget =
      budgetObj && budgetObj.totalBudget > 0 ? budgetObj.totalBudget : sumCategoryBudgets;
    const expectedIncome = budgetObj?.expectedIncome || totalIncome;

    const commitmentLedgers = get().getAllCommitmentLedgers(targetMonth);
    const remainingUnpaidCommitments = commitmentLedgers.reduce(
      (sum, l) => sum + l.remainingBalance,
      0
    );

    const unpaidEmis = get().emiTrackers.filter((emi) => {
      if (emi.status !== 'active' || emi.paidMonths >= emi.tenureMonths || emi.deletedAt) return false;
      const paidTxExists = expenseTransactions.some((t) => t.linkedEmiId === emi.id);
      return emi.lastPaidMonthKey !== targetMonth && !paidTxExists;
    });
    const remainingUnpaidEmis = unpaidEmis.reduce((sum, e) => sum + e.emiAmount, 0);

    const activeBorrowedDebts = get().debtRecords.filter(
      (d) =>
        d.direction === 'borrowed' &&
        d.status === 'active' &&
        !d.deletedAt &&
        d.remainingAmount > 0 &&
        d.repaymentSchedule === 'monthly_partial'
    );

    let plannedDebtInstallmentsDue = 0;
    for (const debt of activeBorrowedDebts) {
      const planned = Math.min(
        debt.remainingAmount,
        debt.plannedMonthlyInstallment || debt.remainingAmount
      );
      const paidThisMonth = get()
        .debtInstallments.filter(
          (i) => i.debtId === debt.id && i.monthKey === targetMonth && !i.deletedAt
        )
        .reduce((sum, i) => sum + i.amount, 0);
      plannedDebtInstallmentsDue += Math.max(0, planned - paidThisMonth);
    }

    const unpaidBills = get().recurringBills.filter(
      (b) => b.isActive && !b.deletedAt && b.lastPaidMonthKey !== targetMonth
    );
    const remainingUnpaidBills = unpaidBills.reduce((sum, b) => sum + b.amount, 0);

    const activeSips = get().sipPlans.filter(
      (s) => s.isActive && !s.deletedAt && s.lastInvestedMonthKey !== targetMonth
    );
    const remainingActiveSipsSum = activeSips.reduce((sum, s) => sum + s.monthlyAmount, 0);
    const plannedSipTarget = budgetObj?.plannedSipAmount || 0;
    const remainingPlannedSips = Math.max(
      remainingActiveSipsSum,
      Math.max(0, plannedSipTarget - totalInvested)
    );

    const now = new Date();
    const [yStr, mStr] = targetMonth.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
    const remainingDaysInMonth = isCurrentMonth
      ? Math.max(1, daysInMonth - now.getDate() + 1)
      : daysInMonth;
    const dayOfMonthProgressPct = isCurrentMonth
      ? Math.round((now.getDate() / daysInMonth) * 100)
      : 100;

    const basePool = monthlyBudget > 0 ? monthlyBudget : expectedIncome;
    const safeToSpendMonthly =
      basePool -
      (totalSpent +
        remainingUnpaidEmis +
        remainingUnpaidCommitments +
        plannedDebtInstallmentsDue +
        remainingUnpaidBills +
        (monthlyBudget === 0 && expectedIncome > 0 ? totalInvested + remainingPlannedSips : 0));

    const safeToSpendDaily = Math.max(0, Math.round(safeToSpendMonthly / remainingDaysInMonth));

    const netSavings = (totalIncome || expectedIncome) - totalSpent;
    const savingsRate =
      (totalIncome || expectedIncome) > 0
        ? Math.round(((netSavings + totalInvested) / (totalIncome || expectedIncome)) * 100)
        : 0;

    const categoryBreakdown: CategorySpendItem[] = get()
      .categories.filter((c) => (c.type === 'expense' || c.type === 'both') && !c.deletedAt)
      .map((category) => {
        const catTxs = expenseTransactions.filter((t) => t.categoryId === category.id);
        const spent = catTxs.reduce((sum, t) => sum + t.amount, 0);
        const baseBudgetLimit = category.monthlyBudgetLimit;

        let rolloverAmount = 0;
        if (category.rolloverEnabled && baseBudgetLimit > 0) {
          const prevCatSpent = prevMonthExpenses
            .filter((t) => t.categoryId === category.id)
            .reduce((sum, t) => sum + t.amount, 0);
          if (prevMonthExpenses.length > 0 && prevCatSpent < baseBudgetLimit) {
            rolloverAmount = baseBudgetLimit - prevCatSpent;
          }
        }

        const budgetLimit = baseBudgetLimit + rolloverAmount;
        const percentageOfBudget =
          budgetLimit > 0 ? Math.round((spent / budgetLimit) * 100) : 0;
        const percentageOfTotalSpend =
          totalSpent > 0 ? Math.round((spent / totalSpent) * 100) : 0;

        let status: CategorySpendItem['status'] = 'safe';
        if (budgetLimit > 0 && percentageOfBudget >= 100) {
          status = 'exceeded';
        } else if (budgetLimit > 0 && percentageOfBudget >= 80) {
          status = 'warning';
        }

        const paceDiffPercentage =
          budgetLimit > 0 ? percentageOfBudget - dayOfMonthProgressPct : 0;

        return {
          category,
          spent,
          budgetLimit,
          baseBudgetLimit,
          rolloverAmount,
          percentageOfBudget,
          percentageOfTotalSpend,
          transactionCount: catTxs.length,
          status,
          paceDiffPercentage,
        };
      })
      .sort((a, b) => b.spent - a.spent);

    return {
      monthKey: targetMonth,
      totalIncome,
      totalSpent,
      totalInvested,
      monthlyBudget,
      expectedIncome,
      remainingUnpaidEmis,
      remainingUnpaidCommitments,
      plannedDebtInstallmentsDue,
      remainingUnpaidBills,
      remainingPlannedSips,
      safeToSpendMonthly,
      safeToSpendDaily,
      remainingDaysInMonth,
      dayOfMonthProgressPct,
      netSavings,
      savingsRate,
      needsReviewCount,
      categoryBreakdown,
    };
      }
    );
  },

  getFriendLedgerGroups: () => {
    const state = get();
    return memoize('friendLedgerGroups', [state.debtRecords], '', () => {
    const records = state.debtRecords.filter((d) => !d.deletedAt && d.status !== 'archived');
    const groupMap = new Map<
      string,
      {
        friendKey: string;
        friendName: string;
        contactInfo?: string;
        records: typeof records;
      }
    >();

    for (const record of records) {
      const trimmed = record.personName.trim();
      const key = trimmed.toLowerCase();
      if (!key) continue;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          friendKey: key,
          friendName: trimmed,
          contactInfo: record.contactInfo,
          records: [],
        });
      }
      const g = groupMap.get(key)!;
      g.records.push(record);
      if (trimmed !== trimmed.toLowerCase() && g.friendName === g.friendName.toLowerCase()) {
        g.friendName = trimmed;
      }
      if (!g.contactInfo && record.contactInfo) {
        g.contactInfo = record.contactInfo;
      }
    }

    const groups: FriendLedgerGroup[] = [];

    for (const item of groupMap.values()) {
      const everydayRecords = item.records.filter((d) => d.bucketType === 'everyday_split');
      const longTermLoans = item.records.filter((d) => d.bucketType !== 'everyday_split');

      const everydayBorrowedRemaining = everydayRecords
        .filter((d) => d.direction === 'borrowed' && d.status === 'active')
        .reduce((sum, d) => sum + d.remainingAmount, 0);
      const everydayLentRemaining = everydayRecords
        .filter((d) => d.direction === 'lent' && d.status === 'active')
        .reduce((sum, d) => sum + d.remainingAmount, 0);
      const everydayNet = everydayLentRemaining - everydayBorrowedRemaining;

      const longTermBorrowedRemaining = longTermLoans
        .filter((d) => d.direction === 'borrowed' && d.status === 'active')
        .reduce((sum, d) => sum + d.remainingAmount, 0);
      const longTermLentRemaining = longTermLoans
        .filter((d) => d.direction === 'lent' && d.status === 'active')
        .reduce((sum, d) => sum + d.remainingAmount, 0);
      const longTermNetPosition = longTermLentRemaining - longTermBorrowedRemaining;

      const activeLoansBorrowed = longTermLoans.filter(
        (d) => d.direction === 'borrowed' && d.status === 'active' && d.remainingAmount > 0
      );
      const activeLoansLent = longTermLoans.filter(
        (d) => d.direction === 'lent' && d.status === 'active' && d.remainingAmount > 0
      );

      const canOffsetAgainstLoan =
        (everydayNet > 0 && activeLoansBorrowed.length > 0) ||
        (everydayNet < 0 && activeLoansLent.length > 0);

      const hasActiveEntries =
        everydayRecords.some((d) => d.status === 'active') ||
        longTermLoans.some((d) => d.status === 'active');

      groups.push({
        friendKey: item.friendKey,
        friendName: item.friendName,
        contactInfo: item.contactInfo,
        everydayRecords,
        everydayBorrowedRemaining,
        everydayLentRemaining,
        everydayNet,
        longTermLoans,
        longTermBorrowedRemaining,
        longTermLentRemaining,
        longTermNetPosition,
        canOffsetAgainstLoan,
        hasActiveEntries,
      });
    }

    return groups.sort((a, b) => {
      if (a.hasActiveEntries && !b.hasActiveEntries) return -1;
      if (!a.hasActiveEntries && b.hasActiveEntries) return 1;
      const totalA = Math.abs(a.everydayNet) + a.longTermBorrowedRemaining + a.longTermLentRemaining;
      const totalB = Math.abs(b.everydayNet) + b.longTermBorrowedRemaining + b.longTermLentRemaining;
      return totalB - totalA;
    });
    });
  },

  getDebtSummary: () => {
    const state = get();
    return memoize('debtSummary', [state.debtRecords], '', () => {
    const activeBorrowed = state.debtRecords.filter(
      (d) => d.direction === 'borrowed' && d.status === 'active' && !d.deletedAt
    );
    const activeLent = state.debtRecords.filter(
      (d) => d.direction === 'lent' && d.status === 'active' && !d.deletedAt
    );

    const totalBorrowedRemaining = activeBorrowed.reduce((sum, d) => sum + d.remainingAmount, 0);
    const totalLentRemaining = activeLent.reduce((sum, d) => sum + d.remainingAmount, 0);
    const netPosition = totalLentRemaining - totalBorrowedRemaining;

    const plannedInstallmentsThisMonth = activeBorrowed.reduce(
      (sum, d) => sum + Math.min(d.remainingAmount, d.plannedMonthlyInstallment || 0),
      0
    );

    // Isolated Bucket Breakdowns
    const everydayBorrowed = activeBorrowed.filter((d) => d.bucketType === 'everyday_split');
    const everydayLent = activeLent.filter((d) => d.bucketType === 'everyday_split');
    const everydayBorrowedRemaining = everydayBorrowed.reduce((sum, d) => sum + d.remainingAmount, 0);
    const everydayLentRemaining = everydayLent.reduce((sum, d) => sum + d.remainingAmount, 0);
    const everydayNetPosition = everydayLentRemaining - everydayBorrowedRemaining;

    const longTermBorrowed = activeBorrowed.filter((d) => d.bucketType !== 'everyday_split');
    const longTermLent = activeLent.filter((d) => d.bucketType !== 'everyday_split');
    const longTermBorrowedRemaining = longTermBorrowed.reduce((sum, d) => sum + d.remainingAmount, 0);
    const longTermLentRemaining = longTermLent.reduce((sum, d) => sum + d.remainingAmount, 0);
    const longTermNetPosition = longTermLentRemaining - longTermBorrowedRemaining;

    return {
      totalBorrowedRemaining,
      totalLentRemaining,
      netPosition,
      plannedInstallmentsThisMonth,
      activeBorrowedCount: activeBorrowed.length,
      activeLentCount: activeLent.length,
      everydayBorrowedRemaining,
      everydayLentRemaining,
      everydayNetPosition,
      longTermBorrowedRemaining,
      longTermLentRemaining,
      longTermNetPosition,
    };
    });
  },

  getDebtInstallments: (debtId) => {
    return get()
      .debtInstallments.filter((i) => i.debtId === debtId && !i.deletedAt)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  getUpcomingFinancialObligations: (withinDays = 7) => {
    const state = get();
    const todayStr = getLocalIsoDate();
    return memoize(
      `upcomingObligations:${withinDays}`,
      [
        state.emiTrackers,
        state.transactions,
        state.commitments,
        state.debtRecords,
        state.debtInstallments,
        state.recurringBills,
        state.sipPlans,
        state.accounts,
        state.creditCardStatements,
      ],
      `${withinDays}|${todayStr}`,
      () => {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonthKey = getCurrentMonthKey(now);
    const obligations: FinancialObligationItem[] = [];

    const makeDueDateStr = (dayOfMonth: number) => {
      const paddedDay = String(Math.min(28, Math.max(1, dayOfMonth))).padStart(2, '0');
      return `${currentMonthKey}-${paddedDay}`;
    };

    for (const emi of get().emiTrackers) {
      if (emi.status !== 'active' || emi.paidMonths >= emi.tenureMonths || emi.deletedAt) continue;
      const isPaidThisMonth =
        emi.lastPaidMonthKey === currentMonthKey ||
        get().transactions.some(
          (t) => t.linkedEmiId === emi.id && t.monthKey === currentMonthKey && !t.deletedAt
        );
      if (isPaidThisMonth) continue;

      const daysUntilDue = emi.billingDayOfMonth - currentDay;
      if (daysUntilDue <= withinDays) {
        obligations.push({
          id: `emi-${emi.id}`,
          sourceId: emi.id,
          type: 'emi',
          title: `${emi.loanName} EMI`,
          subtitle: `${emi.lenderName} · Month ${emi.paidMonths + 1}/${emi.tenureMonths}`,
          amount: emi.emiAmount,
          dueDate: makeDueDateStr(emi.billingDayOfMonth),
          daysUntilDue,
          isOverdue: daysUntilDue < 0,
          status: 'pending',
        });
      }
    }

    for (const ledger of get().getAllCommitmentLedgers(currentMonthKey)) {
      if (ledger.remainingBalance <= 0) continue;
      const daysUntilDue = ledger.commitment.dueDayOfMonth - currentDay;
      if (daysUntilDue <= withinDays) {
        obligations.push({
          id: `commitment-${ledger.commitment.id}`,
          sourceId: ledger.commitment.id,
          type: 'commitment',
          title: `${ledger.commitment.title} (${ledger.commitment.recipientName})`,
          subtitle: `${formatINR(ledger.totalFulfilledAmount)} fulfilled · ${formatINR(
            ledger.remainingBalance
          )} left`,
          amount: ledger.remainingBalance,
          dueDate: makeDueDateStr(ledger.commitment.dueDayOfMonth),
          daysUntilDue,
          isOverdue: daysUntilDue < 0,
          status: 'pending',
        });
      }
    }

    for (const debt of get().debtRecords) {
      if (
        debt.direction !== 'borrowed' ||
        debt.status !== 'active' ||
        debt.deletedAt ||
        debt.remainingAmount <= 0
      )
        continue;

      const dueDay = debt.dueDayOfMonth || 15;
      const daysUntilDue = dueDay - currentDay;
      const paidThisMonth = get()
        .debtInstallments.filter(
          (i) => i.debtId === debt.id && i.monthKey === currentMonthKey && !i.deletedAt
        )
        .reduce((sum, i) => sum + i.amount, 0);
      const planned = Math.min(
        debt.remainingAmount,
        debt.plannedMonthlyInstallment || debt.remainingAmount
      );
      const stillDue = Math.max(0, planned - paidThisMonth);

      if (stillDue > 0 && daysUntilDue <= withinDays) {
        obligations.push({
          id: `debt-${debt.id}`,
          sourceId: debt.id,
          type: 'debt',
          title: `Pay ${debt.personName} (Installment)`,
          subtitle: `${debt.title} · ${formatINR(debt.remainingAmount)} remaining`,
          amount: stillDue,
          dueDate: makeDueDateStr(dueDay),
          daysUntilDue,
          isOverdue: daysUntilDue < 0,
          status: 'pending',
        });
      }
    }

    for (const bill of get().recurringBills) {
      if (!bill.isActive || bill.deletedAt || bill.lastPaidMonthKey === currentMonthKey) continue;
      const daysUntilDue = bill.dueDayOfMonth - currentDay;
      if (daysUntilDue <= withinDays) {
        obligations.push({
          id: `bill-${bill.id}`,
          sourceId: bill.id,
          type: 'bill',
          title: bill.name,
          subtitle: `Recurring ${bill.cadence} bill`,
          amount: bill.amount,
          dueDate: makeDueDateStr(bill.dueDayOfMonth),
          daysUntilDue,
          isOverdue: daysUntilDue < 0,
          status: 'pending',
        });
      }
    }

    for (const sip of get().sipPlans) {
      if (!sip.isActive || sip.deletedAt || sip.lastInvestedMonthKey === currentMonthKey) continue;
      const daysUntilDue = sip.sipDayOfMonth - currentDay;
      if (daysUntilDue <= withinDays) {
        obligations.push({
          id: `sip-${sip.id}`,
          sourceId: sip.id,
          type: 'sip',
          title: `SIP: ${sip.name}`,
          subtitle: `${sip.platform || 'Investment'} · Monthly SIP`,
          amount: sip.monthlyAmount,
          dueDate: makeDueDateStr(sip.sipDayOfMonth),
          daysUntilDue,
          isOverdue: daysUntilDue < 0,
          status: 'pending',
        });
      }
    }

    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    for (const acc of get().accounts) {
      if (
        acc.type !== 'credit_card' ||
        acc.archived ||
        acc.deletedAt
      )
        continue;

      const summary = get().getCreditCardSummary(acc.id);
      const billedStmt = summary?.billedStatement || summary?.currentBilledStatement;
      if (billedStmt && billedStmt.remainingDue > 0) {
        const stmt = billedStmt;
        const daysUntilDue = daysBetween(todayStr, stmt.dueDate);
        if (daysUntilDue <= withinDays) {
          obligations.push({
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
          });
        }
      }
    }

    return obligations.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
      }
    );
  },

  getFilteredTransactions: (monthKey) => {
    const { filters, transactions, selectedMonth } = get();
    const hasExplicitDateRange = Boolean(filters.dateFrom || filters.dateTo);
    const targetMonth = hasExplicitDateRange ? 'all' : monthKey || selectedMonth;
    return memoize(
      `filteredTx:${targetMonth}`,
      [transactions, filters],
      targetMonth,
      () =>
        transactions.filter((tx) => {
      if (tx.deletedAt) return false;
      const tags = Array.isArray(tx.tags) ? tx.tags : [];
      if (targetMonth !== 'all' && tx.monthKey !== targetMonth) return false;
      if (filters.type !== 'all' && tx.type !== filters.type) return false;
      if (filters.categoryId !== 'all' && tx.categoryId !== filters.categoryId) return false;
      if (filters.accountId !== 'all' && tx.accountId !== filters.accountId) return false;
      if (filters.commitmentId !== 'all' && tx.linkedCommitmentId !== filters.commitmentId)
        return false;
      if (filters.debtId !== 'all' && tx.linkedDebtId !== filters.debtId) return false;
      if (filters.tag && filters.tag !== 'all' && !tags.includes(filters.tag)) return false;
      if (filters.needsReview === 'only_review' && !tx.needsReview) return false;
      if (filters.dateFrom && tx.date < filters.dateFrom) return false;
      if (filters.dateTo && tx.date > filters.dateTo) return false;
      if (filters.minAmount !== undefined && tx.amount < filters.minAmount) return false;
      if (filters.maxAmount !== undefined && tx.amount > filters.maxAmount) return false;

      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const matchTitle = (tx.title || '').toLowerCase().includes(q);
        const matchMerchant = tx.merchantName?.toLowerCase().includes(q) || false;
        const matchSub = tx.subcategory?.toLowerCase().includes(q) || false;
        const matchNotes = tx.notes?.toLowerCase().includes(q) || false;
        const matchTags = tags.some((tag) => tag.toLowerCase().includes(q));
        if (!matchTitle && !matchMerchant && !matchSub && !matchNotes && !matchTags) return false;
      }

      return true;
        })
    );
  },

  getSixMonthSpendingTrends: (endMonthKey, categoryId = 'all') => {
    const anchorMonth = endMonthKey || get().selectedMonth;
    const months: string[] = [];
    let cursor = anchorMonth;
    for (let i = 0; i < 6; i++) {
      months.unshift(cursor);
      cursor = getPreviousMonthKey(cursor);
    }

    const categories = get().categories;
    const transactions = get().transactions;
    const budgets = get().budgets;

    const selectedCategory =
      categoryId && categoryId !== 'all'
        ? categories.find((c) => c.id === categoryId)
        : undefined;

    const sumCategoryBudgets = categories
      .filter((c) => c.type === 'expense' || c.type === 'both')
      .reduce((sum, c) => sum + (c.monthlyBudgetLimit || 0), 0);

    return months.map((mKey) => {
      const [yStr, mStr] = mKey.split('-');
      const dateObj = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
      const label = dateObj.toLocaleDateString('en-IN', { month: 'short' });
      const fullLabel = dateObj.toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      });

      const spent = transactions
        .filter((tx) => {
          if (tx.deletedAt || tx.monthKey !== mKey || tx.type !== 'expense') return false;
          if (selectedCategory && tx.categoryId !== selectedCategory.id) return false;
          return true;
        })
        .reduce((sum, tx) => sum + tx.amount, 0);

      let budget = 0;
      if (selectedCategory) {
        budget = selectedCategory.monthlyBudgetLimit || 0;
      } else if (sumCategoryBudgets > 0) {
        budget = sumCategoryBudgets;
      } else {
        const monthBudget = budgets.find((b) => b.monthKey === mKey);
        budget = monthBudget?.totalBudget || 0;
      }

      const variance = budget - spent;
      const isOverBudget = budget > 0 && spent > budget;

      return {
        monthKey: mKey,
        label,
        fullLabel,
        spent,
        budget,
        variance,
        isOverBudget,
      };
    });
  },

  getYearlySpendingTrends: (endMonthKey, categoryId = 'all', yearCount = 5) => {
    const anchorMonth = endMonthKey || get().selectedMonth;
    const endYear = parseInt(anchorMonth.split('-')[0], 10) || new Date().getFullYear();
    const count = Math.max(1, yearCount);
    const years: number[] = [];
    for (let i = count - 1; i >= 0; i--) {
      years.push(endYear - i);
    }

    const categories = get().categories;
    const transactions = get().transactions;
    const budgets = get().budgets;

    const selectedCategory =
      categoryId && categoryId !== 'all'
        ? categories.find((c) => c.id === categoryId)
        : undefined;

    const sumCategoryBudgets = categories
      .filter((c) => c.type === 'expense' || c.type === 'both')
      .reduce((sum, c) => sum + (c.monthlyBudgetLimit || 0), 0);

    return years.map((year) => {
      const yearStr = String(year);
      const spent = transactions
        .filter((tx) => {
          if (tx.deletedAt || !tx.monthKey.startsWith(`${yearStr}-`) || tx.type !== 'expense')
            return false;
          if (selectedCategory && tx.categoryId !== selectedCategory.id) return false;
          return true;
        })
        .reduce((sum, tx) => sum + tx.amount, 0);

      let budget = 0;
      if (selectedCategory) {
        budget = (selectedCategory.monthlyBudgetLimit || 0) * 12;
      } else if (sumCategoryBudgets > 0) {
        budget = sumCategoryBudgets * 12;
      } else {
        const yearBudgets = budgets.filter(
          (b) => b.monthKey.startsWith(`${yearStr}-`) && b.totalBudget > 0
        );
        if (yearBudgets.length === 12) {
          budget = yearBudgets.reduce((sum, b) => sum + b.totalBudget, 0);
        } else if (yearBudgets.length > 0) {
          const avgMonthly =
            yearBudgets.reduce((sum, b) => sum + b.totalBudget, 0) / yearBudgets.length;
          budget = Math.round(avgMonthly * 12);
        }
      }

      const variance = budget - spent;
      const isOverBudget = budget > 0 && spent > budget;

      return {
        monthKey: yearStr,
        label: yearStr,
        fullLabel: `Year ${yearStr}`,
        spent,
        budget,
        variance,
        isOverBudget,
      };
    });
  },

  getCashFlowForecast: (horizonDays = 30, includeDiscretionaryBurn = true) => {
    const state = get();
    return buildCashFlowForecast({
      accounts: state.accounts,
      transactions: state.transactions,
      budgets: state.budgets,
      recurringBills: state.recurringBills,
      emiTrackers: state.emiTrackers,
      sipPlans: state.sipPlans,
      commitments: state.commitments,
      creditCardStatements: state.creditCardStatements,
      horizonDays,
      includeDiscretionaryBurn,
    });
  },

  getSpendingAnomalies: (monthKey) => {
    const state = get();
    const targetMonth = monthKey || state.selectedMonth;
    const todayIso = getLocalIsoDate();
    return memoize(
      `spendingAnomalies:${targetMonth}`,
      [
        state.transactions,
        state.categories,
        state.accounts,
        state.debtRecords,
        state.recurringBills,
        state.creditCardStatements,
        state.emiTrackers,
        state.commitments,
        state.debtInstallments,
        state.sipPlans,
      ],
      `${targetMonth}|${todayIso}`,
      () =>
        detectSpendingAnomalies({
          selectedMonth: targetMonth,
          transactions: state.transactions,
          categories: state.categories,
          accounts: state.accounts,
          debtRecords: state.debtRecords,
          recurringBills: state.recurringBills,
          upcomingObligations7d: state.getUpcomingFinancialObligations(7),
        })
    );
  },
};
};
