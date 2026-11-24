import type {
  CategorySpendItem,
  CommitmentLedgerSummary,
  FinancialObligationItem,
  FriendLedgerGroup,
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceRecurringBill,
  FinanceSipPlan,
  FinanceTransaction,
  MonthlyCommitment,
  DebtRecord,
  DebtInstallment,
  EmiTracker,
  FinanceNetWorthSnapshot,
} from '@/lib/types';
import { formatINR, getPreviousMonthKey } from '@/lib/stores/finance/helpers';

export interface NetWorthInput {
  accounts: FinanceAccount[];
  sipPlans: FinanceSipPlan[];
  debtRecords: DebtRecord[];
  emiTrackers: EmiTracker[];
}

export interface NetWorthSummaryResult {
  liquidAssets: number;
  investmentAssets: number;
  friendReceivables: number;
  totalAssets: number;
  creditCardLiabilities: number;
  emiRemainingPrincipal: number;
  friendPayables: number;
  totalLiabilities: number;
  netWorth: number;
}

export function calculateNetWorthSummary(input: NetWorthInput): NetWorthSummaryResult {
  const { accounts, sipPlans, debtRecords, emiTrackers } = input;
  const activeAccounts = accounts.filter(
    (a) => !a.archived && !a.deletedAt && a.includeInNetWorth !== false
  );

  const liquidAssets = activeAccounts
    .filter((a) => a.type === 'bank' || a.type === 'upi' || a.type === 'cash' || a.type === 'wallet')
    .reduce((sum, a) => sum + Math.max(0, a.balance), 0);

  const investmentAccountAssets = activeAccounts
    .filter((a) => a.type === 'investment')
    .reduce((sum, a) => sum + Math.max(0, a.balance), 0);

  const sipCorpus = sipPlans
    .filter((s) => s.isActive && !s.deletedAt)
    .reduce((sum, s) => sum + Math.max(s.currentValue || 0, s.totalInvested || 0), 0);

  const investmentAssets = investmentAccountAssets + sipCorpus;

  const debtSummary = calculateDebtSummary(debtRecords);
  const friendReceivables = debtSummary.totalLentRemaining;
  const friendPayables = debtSummary.totalBorrowedRemaining;

  const creditCardLiabilities = activeAccounts
    .filter((a) => a.type === 'credit_card')
    .reduce((sum, a) => sum + Math.abs(a.balance), 0);

  const emiRemainingPrincipal = emiTrackers
    .filter((e) => e.status === 'active' && !e.deletedAt)
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

export function calculateDebtSummary(debtRecords: DebtRecord[]) {
  const activeBorrowed = debtRecords.filter(
    (d) => d.direction === 'borrowed' && d.status === 'active' && !d.deletedAt
  );
  const activeLent = debtRecords.filter(
    (d) => d.direction === 'lent' && d.status === 'active' && !d.deletedAt
  );

  const totalBorrowedRemaining = activeBorrowed.reduce((sum, d) => sum + d.remainingAmount, 0);
  const totalLentRemaining = activeLent.reduce((sum, d) => sum + d.remainingAmount, 0);
  const netPosition = totalLentRemaining - totalBorrowedRemaining;

  const plannedInstallmentsThisMonth = activeBorrowed.reduce(
    (sum, d) => sum + Math.min(d.remainingAmount, d.plannedMonthlyInstallment || 0),
    0
  );

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
}

const sumSignedCommitmentAmount = (txs: FinanceTransaction[]): number =>
  txs.reduce((sum, t) => sum + (t.type === 'income' ? -Number(t.amount || 0) : Number(t.amount || 0)), 0);

export function calculateCommitmentLedger(
  commitment: MonthlyCommitment,
  targetMonth: string,
  transactions: FinanceTransaction[]
): CommitmentLedgerSummary {
  let rolloverFromPreviousMonth = 0;
  if (commitment.autoRolloverOverpayment) {
    const prevMonth = getPreviousMonthKey(targetMonth);
    const prevTx = transactions.filter(
      (t) => t.linkedCommitmentId === commitment.id && t.monthKey === prevMonth && !t.deletedAt
    );
    const prevFulfilled = Math.max(0, sumSignedCommitmentAmount(prevTx));
    if (prevFulfilled > commitment.monthlyTargetAmount) {
      rolloverFromPreviousMonth = prevFulfilled - commitment.monthlyTargetAmount;
    }
  }

  const baseTargetAmount = commitment.monthlyTargetAmount;
  const effectiveTargetAmount = Math.max(0, baseTargetAmount - rolloverFromPreviousMonth);

  const monthTransactions = transactions.filter(
    (t) => t.linkedCommitmentId === commitment.id && t.monthKey === targetMonth && !t.deletedAt
  );

  const directTransactions = monthTransactions.filter(
    (t) => t.commitmentContributionType === 'direct_payment' && t.type !== 'income'
  );
  const offsetTransactions = monthTransactions.filter(
    (t) => t.commitmentContributionType !== 'direct_payment' && t.type !== 'income'
  );
  const reimbursementTransactions = monthTransactions.filter((t) => t.type === 'income');

  const directPaidAmount = directTransactions.reduce((sum, t) => sum + t.amount, 0);
  const offsetExpensesAmount = offsetTransactions.reduce((sum, t) => sum + t.amount, 0);
  const reimbursedAmount = reimbursementTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalFulfilledAmount = Math.max(
    0,
    directPaidAmount + offsetExpensesAmount - reimbursedAmount
  );

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
}

export interface MonthlySummaryInput {
  monthKey: string;
  transactions: FinanceTransaction[];
  categories: FinanceCategory[];
  budgets: FinanceBudget[];
  commitments: MonthlyCommitment[];
  emiTrackers: EmiTracker[];
  debtRecords: DebtRecord[];
  debtInstallments: DebtInstallment[];
  recurringBills: FinanceRecurringBill[];
  sipPlans: FinanceSipPlan[];
  referenceDate?: string; // YYYY-MM-DD
}

export function calculateMonthlySummary(input: MonthlySummaryInput) {
  const {
    monthKey: targetMonth,
    transactions,
    categories,
    budgets,
    commitments,
    emiTrackers,
    debtRecords,
    debtInstallments,
    recurringBills,
    sipPlans,
    referenceDate,
  } = input;

  const prevMonth = getPreviousMonthKey(targetMonth);
  const monthTransactions = transactions.filter((t) => t.monthKey === targetMonth && !t.deletedAt);
  const prevMonthExpenses = transactions.filter(
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

  const budgetObj = budgets.find((b) => b.monthKey === targetMonth && !b.deletedAt);
  const sumCategoryBudgets = categories
    .filter((c) => (c.type === 'expense' || c.type === 'both') && !c.deletedAt)
    .reduce((sum, c) => sum + c.monthlyBudgetLimit, 0);

  const monthlyBudget =
    budgetObj && budgetObj.totalBudget > 0 ? budgetObj.totalBudget : sumCategoryBudgets;
  const expectedIncome = budgetObj?.expectedIncome || totalIncome;

  const commitmentLedgers = commitments
    .filter((c) => c.isActive && !c.deletedAt)
    .map((c) => calculateCommitmentLedger(c, targetMonth, transactions));

  const remainingUnpaidCommitments = commitmentLedgers.reduce(
    (sum, l) => sum + l.remainingBalance,
    0
  );

  const unpaidEmis = emiTrackers.filter((emi) => {
    if (emi.status !== 'active' || emi.paidMonths >= emi.tenureMonths || emi.deletedAt) return false;
    const paidTxExists = expenseTransactions.some((t) => t.linkedEmiId === emi.id);
    return emi.lastPaidMonthKey !== targetMonth && !paidTxExists;
  });
  const remainingUnpaidEmis = unpaidEmis.reduce((sum, e) => sum + e.emiAmount, 0);

  const activeBorrowedDebts = debtRecords.filter(
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
    const paidThisMonth = debtInstallments
      .filter((i) => i.debtId === debt.id && i.monthKey === targetMonth && !i.deletedAt)
      .reduce((sum, i) => sum + i.amount, 0);
    plannedDebtInstallmentsDue += Math.max(0, planned - paidThisMonth);
  }

  const unpaidBills = recurringBills.filter(
    (b) => b.isActive && !b.deletedAt && b.lastPaidMonthKey !== targetMonth
  );
  const remainingUnpaidBills = unpaidBills.reduce((sum, b) => sum + b.amount, 0);

  const activeSips = sipPlans.filter(
    (s) => s.isActive && !s.deletedAt && s.lastInvestedMonthKey !== targetMonth
  );
  const remainingActiveSipsSum = activeSips.reduce((sum, s) => sum + s.monthlyAmount, 0);
  const plannedSipTarget = budgetObj?.plannedSipAmount || 0;
  const remainingPlannedSips = Math.max(
    remainingActiveSipsSum,
    Math.max(0, plannedSipTarget - totalInvested)
  );

  const now = referenceDate ? new Date(`${referenceDate}T00:00:00`) : new Date();
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

  const categoryBreakdown: CategorySpendItem[] = categories
    .filter((c) => (c.type === 'expense' || c.type === 'both') && !c.deletedAt)
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

export function calculateFriendLedgerGroups(debtRecords: DebtRecord[]): FriendLedgerGroup[] {
  const records = debtRecords.filter((d) => !d.deletedAt && d.status !== 'archived');
  const groupMap = new Map<
    string,
    {
      friendKey: string;
      friendName: string;
      contactInfo?: string;
      records: DebtRecord[];
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
}

export function calculateUpcomingFinancialObligations(
  input: {
    emiTrackers: EmiTracker[];
    commitments: MonthlyCommitment[];
    debtRecords: DebtRecord[];
    debtInstallments: DebtInstallment[];
    recurringBills: FinanceRecurringBill[];
    sipPlans: FinanceSipPlan[];
    transactions: FinanceTransaction[];
    currentDate?: string; // YYYY-MM-DD
    withinDays?: number;
  }
): FinancialObligationItem[] {
  const {
    emiTrackers,
    commitments,
    debtRecords,
    debtInstallments,
    recurringBills,
    sipPlans,
    transactions,
    currentDate,
    withinDays = 7,
  } = input;

  const now = currentDate ? new Date(`${currentDate}T00:00:00`) : new Date();
  const currentDay = now.getDate();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const obligations: FinancialObligationItem[] = [];

  const makeDueDateStr = (dayOfMonth: number) => {
    const paddedDay = String(Math.min(28, Math.max(1, dayOfMonth))).padStart(2, '0');
    return `${currentMonthKey}-${paddedDay}`;
  };

  for (const emi of emiTrackers) {
    if (emi.status !== 'active' || emi.paidMonths >= emi.tenureMonths || emi.deletedAt) continue;
    const isPaidThisMonth =
      emi.lastPaidMonthKey === currentMonthKey ||
      transactions.some(
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

  for (const c of commitments.filter((item) => item.isActive && !item.deletedAt)) {
    const ledger = calculateCommitmentLedger(c, currentMonthKey, transactions);
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

  for (const debt of debtRecords) {
    if (
      debt.direction !== 'borrowed' ||
      debt.status !== 'active' ||
      debt.deletedAt ||
      debt.remainingAmount <= 0
    )
      continue;

    const dueDay = debt.dueDayOfMonth || 15;
    const daysUntilDue = dueDay - currentDay;
    const paidThisMonth = debtInstallments
      .filter((i) => i.debtId === debt.id && i.monthKey === currentMonthKey && !i.deletedAt)
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

  for (const bill of recurringBills) {
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

  for (const sip of sipPlans) {
    if (!sip.isActive || sip.deletedAt || sip.lastInvestedMonthKey === currentMonthKey) continue;
    const daysUntilDue = sip.sipDayOfMonth - currentDay;
    if (daysUntilDue <= withinDays) {
      obligations.push({
        id: `sip-${sip.id}`,
        sourceId: sip.id,
        type: 'sip',
        title: `${sip.name} SIP`,
        subtitle: `${sip.platform} · ${sip.assetClass.toUpperCase()}`,
        amount: sip.monthlyAmount,
        dueDate: makeDueDateStr(sip.sipDayOfMonth),
        daysUntilDue,
        isOverdue: daysUntilDue < 0,
        status: 'pending',
      });
    }
  }

  return obligations.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}
