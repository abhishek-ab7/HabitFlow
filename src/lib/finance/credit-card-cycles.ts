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

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Returns local calendar date as YYYY-MM-DD (avoids UTC midnight shift e.g. IST +05:30).
 */
export function getLocalIsoDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Normalizes YYYY-MM-DD or full ISO timestamp strings to YYYY-MM-DD.
 */
export function normalizeIsoDate(isoDate: string): string {
  return (isoDate || '').trim().slice(0, 10);
}

/**
 * Rounds currency amounts cleanly to 2 decimal places (paise precision) and normalizes -0 to 0.
 */
export function roundCurrency(value: number): number {
  const rounded = Math.round((Number(value) || 0) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Formats day numbers with proper English ordinal suffixes (1st, 2nd, 3rd, 11th, 21st).
 */
export function formatOrdinal(day: number): string {
  const n = Math.trunc(day);
  const mod100 = Math.abs(n) % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (Math.abs(n) % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * Formats YYYY-MM-DD (or ISO timestamp) into compact "5 Dec" / "21 Oct" without timezone drift.
 */
export function formatShortDate(isoDate: string): string {
  const normalized = normalizeIsoDate(isoDate);
  if (!normalized || normalized.length < 10) return isoDate || '';
  const { month, day } = parseIsoDate(normalized);
  const monthLabel = SHORT_MONTHS[month - 1];
  if (!monthLabel || Number.isNaN(day)) return normalized;
  return `${day} ${monthLabel}`;
}

/**
 * Parses YYYY-MM-DD (or timestamped ISO string) safely into integer parts.
 */
export function parseIsoDate(isoDate: string): { year: number; month: number; day: number } {
  const normalized = normalizeIsoDate(isoDate);
  const parts = normalized.split('-');
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
 * 2. Normalize txDate to YYYY-MM-DD and parse into (y, monthIndex).
 * 3. Find thisMonthEnd = getValidDateInMonth(y, monthIndex, billingDay).
 * 4. If normalizedDate <= thisMonthEnd -> belongs to (y, monthIndex) cycle.
 * 5. If normalizedDate > thisMonthEnd -> belongs to next month's (y, monthIndex + 1) cycle.
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

  const normalizedDate = normalizeIsoDate(txDate);
  const { year, month } = parseIsoDate(normalizedDate);
  const monthIndex = month - 1;
  const thisMonthEnd = getValidDateInMonth(year, monthIndex, billingDay);

  if (normalizedDate <= thisMonthEnd) {
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
  const normalizedRef = normalizeIsoDate(referenceDate);
  const { year, month } = parseIsoDate(normalizedRef);
  const monthIndex = month - 1;

  const currentMonthCycle = getCycleWindowForMonth(
    billingDay,
    dueDay,
    year,
    monthIndex,
    gracePeriodDays
  );

  // If today is strictly before periodEnd, currentMonthCycle is still accumulating unbilled spends.
  if (normalizedRef < currentMonthCycle.periodEnd) {
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
  let remainingPayment = roundCurrency(Math.max(0, paymentAmount));
  const updated: CreditCardStatement[] = statements.map((s) => ({ ...s }));

  if (remainingPayment <= 0) {
    return { updatedStatements: updated, unallocatedAmount: 0 };
  }

  // 1. Direct targeted allocation if specified
  if (targetStatementId) {
    const targetIdx = updated.findIndex((s) => s.id === targetStatementId || s.cycleKey === targetStatementId);
    if (targetIdx !== -1) {
      const s = updated[targetIdx];
      const allocatable = roundCurrency(Math.max(0, s.remainingDue));
      const paymentToApply = roundCurrency(Math.min(remainingPayment, allocatable));
      const newPaid = roundCurrency(s.paidAmount + paymentToApply);
      const newRemaining = roundCurrency(Math.max(0, s.totalDue - newPaid));
      remainingPayment = roundCurrency(Math.max(0, remainingPayment - paymentToApply));

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
      const allocatable = roundCurrency(s.remainingDue);
      const paymentToApply = roundCurrency(Math.min(remainingPayment, allocatable));
      const newPaid = roundCurrency(s.paidAmount + paymentToApply);
      const newRemaining = roundCurrency(Math.max(0, s.totalDue - newPaid));
      remainingPayment = roundCurrency(Math.max(0, remainingPayment - paymentToApply));

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
    unallocatedAmount: roundCurrency(remainingPayment),
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
  const referenceDate = normalizeIsoDate(params.referenceDate || getLocalIsoDate());

  const { billingDay, dueDay, creditLimit, gracePeriodDays } = resolveCardBillingConfig(account);

  // Active unbilled cycle
  const unbilledWindow = getActiveUnbilledCycle(billingDay, dueDay, referenceDate, gracePeriodDays);

  // Latest closed cycle window (e.g. Nov 15 statement close when today is Nov 22)
  const { year: unbilledY, month: unbilledM } = parseIsoDate(unbilledWindow.periodEnd);
  const prevCycleMonthIndex = unbilledM - 2; // previous month
  const prevCycleWindow = getCycleWindowForMonth(
    billingDay,
    dueDay,
    unbilledY,
    prevCycleMonthIndex,
    gracePeriodDays
  );

  // Filter transactions for this card
  const cardTxs = transactions.filter(
    (t) => (t.accountId === account.id || t.toAccountId === account.id) && !t.deletedAt
  );

  // Separate CC bill payments vs regular card spends/credits
  // A bill payment is a transfer from bank -> this card (or flagged isCreditCardPayment)
  const rawBillPaymentTxs = cardTxs.filter(
    (t) =>
      t.isCreditCardPayment === true ||
      (t.type === 'transfer' && t.toAccountId === account.id)
  );

  // Sort bill payments: explicitly linked (paidStatementId) first, then ascending by date
  const billPaymentTxs = [...rawBillPaymentTxs].sort((a, b) => {
    const aLinked = a.paidStatementId ? 1 : 0;
    const bLinked = b.paidStatementId ? 1 : 0;
    if (aLinked !== bLinked) return bLinked - aLinked;
    const dateDiff = normalizeIsoDate(a.date).localeCompare(normalizeIsoDate(b.date));
    if (dateDiff !== 0) return dateDiff;
    return (a.createdAt || a.id).localeCompare(b.createdAt || b.id);
  });

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

  // Calculate unbilled cycle amount (only 'income' reduces card balance; expense & investment are card spends)
  const unbilledTxs = txByCycle.get(unbilledWindow.cycleKey) || [];
  let unbilledCalculated = 0;
  for (const tx of unbilledTxs) {
    if (tx.type === 'income') {
      unbilledCalculated = roundCurrency(unbilledCalculated - tx.amount);
    } else {
      unbilledCalculated = roundCurrency(unbilledCalculated + tx.amount);
    }
  }

  const rawAccountBalance = Math.abs(Number(account.balance) || 0);
  const hasAnyPersistedStatements = persistedStatements.some(
    (s) => s.accountId === account.id && !s.deletedAt
  );

  // If no closed cycle exists yet and no statements are persisted, opening dues accumulate in unbilled cycle
  if (!hasAnyPersistedStatements && rawAccountBalance > 0 && prevCycleWindow.periodEnd > referenceDate) {
    const unbilledOpeningFallback = Math.max(0, rawAccountBalance - unbilledCalculated);
    unbilledCalculated = roundCurrency(unbilledCalculated + unbilledOpeningFallback);
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
  // the most recent closed statement (e.g. Nov 15 when today is Nov 22)
  if (prevCycleWindow.periodEnd <= referenceDate) {
    knownCycleKeys.add(prevCycleWindow.cycleKey);
  }

  // Pre-index persisted statements & linked payments for O(1) lookup inside cycle loop
  const persistedByCycle = new Map<string, CreditCardStatement>();
  for (const s of persistedStatements) {
    if (s.accountId === account.id && !s.deletedAt) {
      persistedByCycle.set(s.cycleKey, s);
    }
  }
  const linkedPaymentKeys = new Set<string>();
  for (const tx of billPaymentTxs) {
    if (tx.paidStatementId) {
      linkedPaymentKeys.add(tx.paidStatementId);
    }
  }

  // Build statement list for all billed cycles in ascending chronological order
  const billedStatements: CreditCardStatement[] = [];
  let hasPriorOpenStatement = false;
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
      if (tx.type === 'income') {
        calculatedAmount = roundCurrency(calculatedAmount - tx.amount);
      } else {
        calculatedAmount = roundCurrency(calculatedAmount + tx.amount);
      }
    }

    // Check for persisted override / record
    const existing = persistedByCycle.get(cycleKey);

    // If no persisted statement exists for this card, account.balance represents the user's
    // opening dues/bill for the latest closed statement (e.g. entered via Edit Account "Current Dues").
    const isLatestClosedCycle = cycleKey === prevCycleWindow.cycleKey;
    const openingDuesFallback =
      !existing && !hasAnyPersistedStatements && isLatestClosedCycle && rawAccountBalance > 0
        ? rawAccountBalance
        : 0;

    const manualAdjustment = roundCurrency(
      existing?.manualAdjustment ?? (openingDuesFallback > 0 ? Math.max(0, openingDuesFallback - calculatedAmount) : 0)
    );
    // Guard against double-counting carriedForwardAmount while prior statements remain open/unpaid
    const carriedForward = hasPriorOpenStatement
      ? 0
      : roundCurrency(existing?.carriedForwardAmount ?? 0);
    const totalDue = roundCurrency(Math.max(0, calculatedAmount + manualAdjustment + carriedForward));

    // Preserve existing persisted paidAmount unless one or more payment transactions explicitly link to this statement
    const statementId = existing?.id || `${account.id}_${cycleKey}`;
    const hasLinkedPayment =
      linkedPaymentKeys.has(statementId) || linkedPaymentKeys.has(cycleKey);
    const initialPaid = hasLinkedPayment ? 0 : roundCurrency(Math.max(0, existing?.paidAmount ?? 0));
    const initialRemaining = roundCurrency(Math.max(0, totalDue - initialPaid));
    if (initialRemaining > 0) {
      hasPriorOpenStatement = true;
    }

    const statement: CreditCardStatement = {
      id: statementId,
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

  // Apply bill payments across billed statements (sorted linked-first, then chronological)
  // Only excess overpayments whose payment date falls within the active unbilled cycle reduce unbilled spend
  let unallocatedPayments = 0;
  for (const payTx of billPaymentTxs) {
    const targetStatementId = payTx.paidStatementId;
    const { updatedStatements, unallocatedAmount } = allocatePaymentToStatements(
      billedStatements,
      payTx.amount,
      targetStatementId
    );
    for (let i = 0; i < updatedStatements.length; i++) {
      billedStatements[i] = updatedStatements[i];
    }
    const payDate = normalizeIsoDate(payTx.date);
    if (
      unallocatedAmount > 0 &&
      payDate >= unbilledWindow.periodStart &&
      payDate <= unbilledWindow.periodEnd
    ) {
      unallocatedPayments = roundCurrency(unallocatedPayments + unallocatedAmount);
    }
  }

  // Evaluate status for each billed statement relative to referenceDate
  for (const s of billedStatements) {
    s.paidAmount = roundCurrency(s.paidAmount);
    s.remainingDue = roundCurrency(s.remainingDue);
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

  // Excess payments made within the active unbilled cycle reduce unbilled cycle spend
  const netUnbilledAmount = roundCurrency(Math.max(0, unbilledCalculated - unallocatedPayments));

  // Unpaid billed statements
  const unpaidStatements = billedStatements
    .filter((s) => s.remainingDue > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const overdueStatements = unpaidStatements.filter((s) => s.status === 'overdue');
  const billedDueTotal = roundCurrency(
    unpaidStatements.reduce((sum, s) => roundCurrency(sum + s.remainingDue), 0)
  );

  // Most recent unpaid billed statement
  const currentBilledStatement = unpaidStatements[0] || null;

  // Total utilized credit card debt
  const totalOutstanding = roundCurrency(billedDueTotal + netUnbilledAmount);
  const availableCredit = creditLimit > 0 ? roundCurrency(Math.max(0, creditLimit - totalOutstanding)) : 0;
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
