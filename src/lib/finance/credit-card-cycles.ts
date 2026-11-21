import type {
  CreditCardCycleSummary,
  CreditCardStatement,
  FinanceAccount,
  FinanceTransaction,
  StatementStatus,
} from '@/lib/types';

export interface CreditCardCycleWindow {
  cycleKey: string;     // Canonical YYYY-MM of periodEnd (e.g. "2026-11")
  periodStart: string;  // Inclusive YYYY-MM-DD (e.g. "2026-10-22")
  periodEnd: string;    // Inclusive YYYY-MM-DD (e.g. "2026-11-21")
  dueDate: string;      // YYYY-MM-DD (e.g. "2026-12-05")
}

/**
 * Parses YYYY-MM-DD safely into integer parts.
 */
export function parseIsoDate(isoDate: string): { year: number; month: number; day: number } {
  const parts = isoDate.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10); // 1-indexed (1..12)
  const day = parseInt(parts[2], 10);
  return { year, month, day };
}

/**
 * Returns a valid YYYY-MM-DD date clamped to the actual number of days in the specified month.
 * monthIndex is 0-indexed (0 = Jan, 1 = Feb, ..., 11 = Dec).
 * day is 1..31.
 *
 * Example:
 * getValidDateInMonth(2026, 1, 31) -> "2026-02-28"
 * getValidDateInMonth(2028, 1, 31) -> "2028-02-29" (leap year)
 */
export function getValidDateInMonth(year: number, monthIndex: number, day: number): string {
  // Normalize monthIndex if it spills below 0 or above 11
  const normalizedYear = year + Math.floor(monthIndex / 12);
  const normalizedMonthIndex = ((monthIndex % 12) + 12) % 12;

  // Day 0 of next month is the last day of this month
  const maxDays = new Date(normalizedYear, normalizedMonthIndex + 1, 0).getDate();
  const clampedDay = Math.min(Math.max(1, day), maxDays);

  const yStr = String(normalizedYear);
  const mStr = String(normalizedMonthIndex + 1).padStart(2, '0');
  const dStr = String(clampedDay).padStart(2, '0');
  return `${yStr}-${mStr}-${dStr}`;
}

/**
 * Adds or subtracts days to a YYYY-MM-DD date using local calendar math.
 */
export function addDays(isoDate: string, days: number): string {
  const { year, month, day } = parseIsoDate(isoDate);
  const dt = new Date(year, month - 1, day + days);
  const yStr = String(dt.getFullYear());
  const mStr = String(dt.getMonth() + 1).padStart(2, '0');
  const dStr = String(dt.getDate()).padStart(2, '0');
  return `${yStr}-${mStr}-${dStr}`;
}

/**
 * Computes difference in calendar days (date2 - date1).
 * Positive if date2 is after date1.
 */
export function daysBetween(date1Iso: string, date2Iso: string): number {
  const p1 = parseIsoDate(date1Iso);
  const p2 = parseIsoDate(date2Iso);
  const utc1 = Date.UTC(p1.year, p1.month - 1, p1.day);
  const utc2 = Date.UTC(p2.year, p2.month - 1, p2.day);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((utc2 - utc1) / msPerDay);
}

/**
 * Resolves the effective billing day and due day from a FinanceAccount.
 * Backward compatible with existing statementDay and dueDay fields.
 */
export function resolveCardBillingConfig(account: FinanceAccount): {
  billingDay: number;
  dueDay: number;
  creditLimit: number;
  gracePeriodDays?: number;
} {
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

/**
 * Computes the exact cycle window for a given statement close month (year, monthIndex).
 *
 * Example (Slice, billingDay = 21, dueDay = 5, year = 2026, monthIndex = 10 [Nov]):
 * - periodEnd: "2026-11-21"
 * - periodStart: "2026-10-22" (day after Oct 21)
 * - dueDate: "2026-12-05" (dueDay 5 <= billingDay 21 -> next month)
 * - cycleKey: "2026-11"
 */
export function getCycleWindowForMonth(
  billingDay: number,
  dueDay: number,
  year: number,
  monthIndex: number, // 0..11
  gracePeriodDays?: number
): CreditCardCycleWindow {
  const periodEnd = getValidDateInMonth(year, monthIndex, billingDay);

  // Previous month statement close
  const prevMonthIndex = monthIndex - 1;
  const prevYear = year;
  const prevPeriodEnd = getValidDateInMonth(prevYear, prevMonthIndex, billingDay);
  const periodStart = addDays(prevPeriodEnd, 1);

  let dueDate: string;
  if (gracePeriodDays && gracePeriodDays > 0) {
    dueDate = addDays(periodEnd, gracePeriodDays);
  } else if (dueDay > billingDay) {
    // Due date falls in the same calendar month as statement generation
    dueDate = getValidDateInMonth(year, monthIndex, dueDay);
  } else {
    // Due date falls in the following calendar month
    dueDate = getValidDateInMonth(year, monthIndex + 1, dueDay);
  }

  const cycleKey = periodEnd.slice(0, 7);

  return {
    cycleKey,
    periodStart,
    periodEnd,
    dueDate,
  };
}

/**
 * Assigns any transaction date to its canonical statement cycle key (YYYY-MM).
 *
 * Core Rule:
 * 1. If manualOverrideCycleKey is specified on the transaction, return it.
 * 2. Parse txDate into (y, monthIndex).
 * 3. Find thisMonthEnd = getValidDateInMonth(y, monthIndex, billingDay).
 * 4. If txDate <= thisMonthEnd -> belongs to (y, monthIndex) cycle.
 * 5. If txDate > thisMonthEnd -> belongs to next month's (y, monthIndex + 1) cycle.
 */
export function resolveTransactionCycle(
  txDate: string,
  billingDay: number,
  dueDay: number,
  manualOverrideCycleKey?: string | null
): string {
  if (manualOverrideCycleKey && manualOverrideCycleKey.trim()) {
    return manualOverrideCycleKey.trim();
  }

  const { year, month } = parseIsoDate(txDate);
  const monthIndex = month - 1;
  const thisMonthEnd = getValidDateInMonth(year, monthIndex, billingDay);

  if (txDate <= thisMonthEnd) {
    return thisMonthEnd.slice(0, 7);
  }

  const nextMonthEnd = getValidDateInMonth(year, monthIndex + 1, billingDay);
  return nextMonthEnd.slice(0, 7);
}

/**
 * Returns the unbilled cycle window for a given card relative to a reference date.
 * If referenceDate is on or after the statement date (periodEnd), that statement is
 * considered closed/billed, and the unbilled cycle moves to the next month.
 */
export function getActiveUnbilledCycle(
  billingDay: number,
  dueDay: number,
  referenceDate: string,
  gracePeriodDays?: number
): CreditCardCycleWindow {
  const { year, month } = parseIsoDate(referenceDate);
  const monthIndex = month - 1;

  const currentMonthCycle = getCycleWindowForMonth(
    billingDay,
    dueDay,
    year,
    monthIndex,
    gracePeriodDays
  );

  // If today is strictly before periodEnd, currentMonthCycle is still accumulating unbilled spends.
  if (referenceDate < currentMonthCycle.periodEnd) {
    return currentMonthCycle;
  }

  // Once today >= periodEnd, currentMonthCycle has closed (is billed), and the next cycle is unbilled.
  return getCycleWindowForMonth(
    billingDay,
    dueDay,
    year,
    monthIndex + 1,
    gracePeriodDays
  );
}

/**
 * Allocates bill payments across statements using a waterfall strategy.
 * If targetStatementId is specified, allocates to that statement first.
 * Any leftover payment is applied to the oldest unpaid statement, and so on.
 * Returns updated statement copies and any remaining credit (overpayment).
 */
export function allocatePaymentToStatements(
  statements: CreditCardStatement[],
  paymentAmount: number,
  targetStatementId?: string | null
): { updatedStatements: CreditCardStatement[]; unallocatedAmount: number } {
  let remainingPayment = Math.max(0, paymentAmount);
  const updated: CreditCardStatement[] = statements.map((s) => ({ ...s }));

  if (remainingPayment <= 0) {
    return { updatedStatements: updated, unallocatedAmount: 0 };
  }

  // 1. Direct targeted allocation if specified
  if (targetStatementId) {
    const targetIdx = updated.findIndex((s) => s.id === targetStatementId || s.cycleKey === targetStatementId);
    if (targetIdx !== -1) {
      const s = updated[targetIdx];
      const allocatable = Math.max(0, s.remainingDue);
      const paymentToApply = Math.min(remainingPayment, allocatable);
      const newPaid = s.paidAmount + paymentToApply;
      const newRemaining = Math.max(0, s.totalDue - newPaid);
      remainingPayment -= paymentToApply;

      let status: StatementStatus = s.status;
      if (newRemaining === 0 && s.totalDue > 0) {
        status = 'paid';
      } else if (newPaid > 0 && newRemaining > 0) {
        status = 'partial';
      }

      updated[targetIdx] = {
        ...s,
        paidAmount: newPaid,
        remainingDue: newRemaining,
        status,
        paidAt: newRemaining === 0 ? s.paidAt || new Date().toISOString() : null,
      };
    }
  }

  // 2. Waterfall allocation to oldest unpaid billed statements
  if (remainingPayment > 0) {
    // Sort oldest periodEnd first
    const unpaidIndices = updated
      .map((s, idx) => ({ s, idx }))
      .filter(({ s }) => s.remainingDue > 0)
      .sort((a, b) => a.s.periodEnd.localeCompare(b.s.periodEnd));

    for (const { s, idx } of unpaidIndices) {
      if (remainingPayment <= 0) break;
      const allocatable = s.remainingDue;
      const paymentToApply = Math.min(remainingPayment, allocatable);
      const newPaid = s.paidAmount + paymentToApply;
      const newRemaining = Math.max(0, s.totalDue - newPaid);
      remainingPayment -= paymentToApply;

      let status: StatementStatus = s.status;
      if (newRemaining === 0 && s.totalDue > 0) {
        status = 'paid';
      } else if (newPaid > 0 && newRemaining > 0) {
        status = 'partial';
      }

      updated[idx] = {
        ...s,
        paidAmount: newPaid,
        remainingDue: newRemaining,
        status,
        paidAt: newRemaining === 0 ? s.paidAt || new Date().toISOString() : null,
      };
    }
  }

  return {
    updatedStatements: updated,
    unallocatedAmount: remainingPayment,
  };
}

/**
 * Computes full credit card cycle summaries, separating:
 * 1. Billed Statement Due (e.g. ₹22,000 due Dec 5)
 * 2. Unbilled / Next Cycle spends (e.g. ₹20,000 generating Dec 21)
 * 3. Total outstanding, available limit, and utilization %
 */
export function computeCreditCardSummary(params: {
  account: FinanceAccount;
  transactions: FinanceTransaction[];
  persistedStatements?: CreditCardStatement[];
  referenceDate?: string; // YYYY-MM-DD
}): CreditCardCycleSummary {
  const { account, transactions, persistedStatements = [] } = params;
  const referenceDate = params.referenceDate || new Date().toISOString().split('T')[0];

  const { billingDay, dueDay, creditLimit, gracePeriodDays } = resolveCardBillingConfig(account);

  // Active unbilled cycle
  const unbilledWindow = getActiveUnbilledCycle(billingDay, dueDay, referenceDate, gracePeriodDays);

  // Filter transactions for this card
  const cardTxs = transactions.filter(
    (t) => (t.accountId === account.id || t.toAccountId === account.id) && !t.deletedAt
  );

  // Separate CC bill payments vs regular card spends/credits
  // A bill payment is a transfer from bank -> this card (or flagged isCreditCardPayment)
  const billPaymentTxs = cardTxs.filter(
    (t) =>
      t.isCreditCardPayment === true ||
      (t.type === 'transfer' && t.toAccountId === account.id)
  );

  // Regular spends and refunds on this card
  const standardCardTxs = cardTxs.filter(
    (t) =>
      t.accountId === account.id &&
      !t.isCreditCardPayment &&
      t.type !== 'transfer'
  );

  // Group standard transactions by resolved cycleKey
  const txByCycle = new Map<string, FinanceTransaction[]>();
  for (const tx of standardCardTxs) {
    const cycleKey = resolveTransactionCycle(
      tx.date,
      billingDay,
      dueDay,
      tx.statementCycleKey
    );
    const list = txByCycle.get(cycleKey) || [];
    list.push(tx);
    txByCycle.set(cycleKey, list);
  }

  // Calculate unbilled cycle amount
  const unbilledTxs = txByCycle.get(unbilledWindow.cycleKey) || [];
  let unbilledCalculated = 0;
  for (const tx of unbilledTxs) {
    if (tx.type === 'expense') {
      unbilledCalculated += tx.amount;
    } else if (tx.type === 'income' || tx.type === 'investment') {
      // Refunds / cashback reduce unbilled spends
      unbilledCalculated -= tx.amount;
    }
  }

  // Collect all known billed cycle keys (from transactions or persisted statements)
  const knownCycleKeys = new Set<string>();
  for (const key of txByCycle.keys()) {
    if (key !== unbilledWindow.cycleKey) {
      knownCycleKeys.add(key);
    }
  }
  for (const s of persistedStatements) {
    if (s.accountId === account.id && !s.deletedAt && s.cycleKey !== unbilledWindow.cycleKey) {
      knownCycleKeys.add(s.cycleKey);
    }
  }

  // If the unbilled cycle's previous cycle isn't in knownCycleKeys, add it so we always check
  // the most recent closed statement (e.g. Nov 21 when today is Nov 25)
  const { year: unbilledY, month: unbilledM } = parseIsoDate(unbilledWindow.periodEnd);
  const prevCycleMonthIndex = unbilledM - 2; // previous month
  const prevCycleWindow = getCycleWindowForMonth(
    billingDay,
    dueDay,
    unbilledY,
    prevCycleMonthIndex,
    gracePeriodDays
  );
  if (prevCycleWindow.periodEnd <= referenceDate) {
    knownCycleKeys.add(prevCycleWindow.cycleKey);
  }

  // Build statement list for all billed cycles
  const billedStatements: CreditCardStatement[] = [];
  for (const cycleKey of Array.from(knownCycleKeys).sort()) {
    const [cYear, cMonth] = cycleKey.split('-').map(Number);
    const window = getCycleWindowForMonth(billingDay, dueDay, cYear, cMonth - 1, gracePeriodDays);

    // Only cycles that have already closed are Billed statements
    if (window.periodEnd > referenceDate) {
      continue;
    }

    const cycleTxs = txByCycle.get(cycleKey) || [];
    let calculatedAmount = 0;
    for (const tx of cycleTxs) {
      if (tx.type === 'expense') {
        calculatedAmount += tx.amount;
      } else if (tx.type === 'income' || tx.type === 'investment') {
        calculatedAmount -= tx.amount;
      }
    }

    // Check for persisted override / record
    const existing = persistedStatements.find(
      (s) => s.accountId === account.id && s.cycleKey === cycleKey && !s.deletedAt
    );

    const manualAdjustment = existing?.manualAdjustment ?? 0;
    const carriedForward = existing?.carriedForwardAmount ?? 0;
    const totalDue = Math.max(0, calculatedAmount + manualAdjustment + carriedForward);

    // If there are recorded bill payment transactions, allocate dynamically from 0.
    // Otherwise fallback to existing persisted paidAmount (e.g. manual offline statement).
    const initialPaid = billPaymentTxs.length > 0 ? 0 : Math.max(0, existing?.paidAmount ?? 0);
    const initialRemaining = Math.max(0, totalDue - initialPaid);

    const statement: CreditCardStatement = {
      id: existing?.id || `${account.id}_${cycleKey}`,
      userId: account.userId,
      accountId: account.id,
      cycleKey,
      periodStart: window.periodStart,
      periodEnd: window.periodEnd,
      dueDate: window.dueDate,
      calculatedAmount,
      manualAdjustment,
      totalDue,
      carriedForwardAmount: carriedForward,
      paidAmount: initialPaid,
      remainingDue: initialRemaining,
      status: 'billed',
      paidAt: existing?.paidAt || null,
      notes: existing?.notes,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: existing?.updatedAt || new Date().toISOString(),
    };

    billedStatements.push(statement);
  }

  // Apply bill payments across billed statements
  // First, check payments with explicit statement linking
  let unallocatedPayments = 0;
  for (const payTx of billPaymentTxs) {
    const targetStatementId = payTx.paidStatementId;
    const { updatedStatements, unallocatedAmount } = allocatePaymentToStatements(
      billedStatements,
      payTx.amount,
      targetStatementId
    );
    // Replace array contents with updated instances
    for (let i = 0; i < updatedStatements.length; i++) {
      billedStatements[i] = updatedStatements[i];
    }
    unallocatedPayments += unallocatedAmount;
  }

  // Evaluate status for each billed statement relative to referenceDate
  for (const s of billedStatements) {
    if (s.remainingDue <= 0 && s.totalDue > 0) {
      s.status = 'paid';
    } else if (s.paidAmount > 0 && s.remainingDue > 0) {
      s.status = referenceDate > s.dueDate ? 'overdue' : 'partial';
    } else if (s.remainingDue > 0) {
      s.status = referenceDate > s.dueDate ? 'overdue' : 'billed';
    } else {
      s.status = 'paid';
    }
  }

  // If there are unallocated payments (overpayment of all billed statements),
  // they reduce the unbilled cycle amount
  const netUnbilledAmount = Math.max(0, unbilledCalculated - unallocatedPayments);

  // Unpaid billed statements
  const unpaidStatements = billedStatements
    .filter((s) => s.remainingDue > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const overdueStatements = unpaidStatements.filter((s) => s.status === 'overdue');
  const billedDueTotal = unpaidStatements.reduce((sum, s) => sum + s.remainingDue, 0);

  // Most recent unpaid billed statement
  const currentBilledStatement = unpaidStatements[0] || null;

  // Total utilized credit card debt
  const totalOutstanding = Math.round(billedDueTotal + netUnbilledAmount);
  const availableCredit = creditLimit > 0 ? Math.max(0, creditLimit - totalOutstanding) : 0;
  const utilizationPercent =
    creditLimit > 0 ? Math.min(100, Math.round((totalOutstanding / creditLimit) * 100)) : 0;

  // Nearest due date
  const nextDueDate = currentBilledStatement ? currentBilledStatement.dueDate : null;
  const daysUntilDue = nextDueDate ? daysBetween(referenceDate, nextDueDate) : null;
  const daysUntilGeneration = Math.max(0, daysBetween(referenceDate, unbilledWindow.periodEnd));

  return {
    accountId: account.id,
    creditLimit,
    billedDueTotal,
    currentBilledStatement,
    billedStatement: currentBilledStatement,
    overdueStatements,
    unbilledCycle: {
      cycleKey: unbilledWindow.cycleKey,
      periodStart: unbilledWindow.periodStart,
      periodEnd: unbilledWindow.periodEnd,
      dueDate: unbilledWindow.dueDate,
      amount: netUnbilledAmount,
      transactionCount: unbilledTxs.length,
      daysUntilGeneration,
    },
    unbilledSpend: netUnbilledAmount,
    totalOutstanding,
    totalUtilized: totalOutstanding,
    availableCredit,
    availableLimit: availableCredit,
    utilizationPercent,
    nextDueDate,
    daysUntilDue,
  };
}
