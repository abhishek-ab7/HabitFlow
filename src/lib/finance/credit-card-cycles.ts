import type {
  CreditCardCycleSummary,
  CreditCardStatement,
  FinanceAccount,
  FinanceTransaction,
} from '@/lib/types';
import {
  addDays,
  allocatePaymentToStatements,
  applyPaymentsToBilledStatements,
  daysBetween,
  evaluateStatementStatus,
  formatOrdinal,
  formatShortDate,
  getActiveUnbilledCycle,
  getCycleWindowForMonth,
  getLocalIsoDate,
  getValidDateInMonth,
  groupCardTxsByCycle,
  normalizeIsoDate,
  parseIsoDate,
  resolveCardBillingConfig,
  resolveTransactionCycle,
  roundCurrency,
  sortBillPaymentTxs,
  sumCardTransactions,
  type CreditCardCycleWindow,
  type CycleKeyString,
  type IsoDateString,
} from './credit-card-cycle-helpers';

export {
  addDays,
  allocatePaymentToStatements,
  daysBetween,
  formatOrdinal,
  formatShortDate,
  getActiveUnbilledCycle,
  getCycleWindowForMonth,
  getLocalIsoDate,
  getValidDateInMonth,
  normalizeIsoDate,
  parseIsoDate,
  resolveCardBillingConfig,
  resolveTransactionCycle,
  roundCurrency,
  type CreditCardCycleWindow,
};

function isPersistedBilledCycle(
  s: CreditCardStatement,
  accountId: string,
  unbilledCycleKey: CycleKeyString
): boolean {
  return s.accountId === accountId && !s.deletedAt && s.cycleKey !== unbilledCycleKey;
}

function collectKnownCycleKeys(params: {
  txByCycle: Map<CycleKeyString, FinanceTransaction[]>;
  persistedStatements: CreditCardStatement[];
  accountId: string;
  unbilledCycleKey: CycleKeyString;
  prevCycleWindow: CreditCardCycleWindow;
  referenceDate: IsoDateString;
}): CycleKeyString[] {
  const txKeys = Array.from(params.txByCycle.keys()).filter((k) => k !== params.unbilledCycleKey);
  const persistedKeys = params.persistedStatements
    .filter((s) => isPersistedBilledCycle(s, params.accountId, params.unbilledCycleKey))
    .map((s) => s.cycleKey);
  const keys = new Set<CycleKeyString>([...txKeys, ...persistedKeys]);
  if (params.prevCycleWindow.periodEnd <= params.referenceDate) keys.add(params.prevCycleWindow.cycleKey);
  return Array.from(keys).sort();
}

function resolveOpeningAdjustment(params: {
  existing?: CreditCardStatement;
  hasAnyPersistedStatements: boolean;
  isLatestClosedCycle: boolean;
  rawAccountBalance: number;
  calculatedAmount: number;
}): number {
  const { existing, hasAnyPersistedStatements, isLatestClosedCycle, rawAccountBalance, calculatedAmount } = params;
  if (existing?.manualAdjustment !== undefined) return roundCurrency(existing.manualAdjustment);
  const useOpeningDues = !existing && !hasAnyPersistedStatements && isLatestClosedCycle && rawAccountBalance > 0;
  return useOpeningDues ? roundCurrency(Math.max(0, rawAccountBalance - calculatedAmount)) : 0;
}

function computeStatementPaymentTotals(params: {
  accountId: string;
  cycleKey: CycleKeyString;
  existing?: CreditCardStatement;
  totalDue: number;
  linkedPaymentKeys: Set<string>;
}) {
  const statementId = params.existing?.id ?? `${params.accountId}_${params.cycleKey}`;
  const hasLinkedPayment = params.linkedPaymentKeys.has(statementId) || params.linkedPaymentKeys.has(params.cycleKey);
  const initialPaid = hasLinkedPayment ? 0 : roundCurrency(Math.max(0, params.existing?.paidAmount ?? 0));
  const initialRemaining = roundCurrency(Math.max(0, params.totalDue - initialPaid));
  return { statementId, initialPaid, initialRemaining };
}

function buildBilledStatementForCycle(params: {
  account: FinanceAccount;
  cycleKey: CycleKeyString;
  window: CreditCardCycleWindow;
  cycleTxs: FinanceTransaction[];
  existing?: CreditCardStatement;
  hasAnyPersistedStatements: boolean;
  isLatestClosedCycle: boolean;
  rawAccountBalance: number;
  hasPriorOpenStatement: boolean;
  linkedPaymentKeys: Set<string>;
}): CreditCardStatement {
  const { account, cycleKey, window, cycleTxs, existing } = params;
  const calculatedAmount = sumCardTransactions(cycleTxs);
  const manualAdjustment = resolveOpeningAdjustment({ ...params, calculatedAmount });
  const carriedForward = params.hasPriorOpenStatement ? 0 : roundCurrency(existing?.carriedForwardAmount ?? 0);
  const totalDue = roundCurrency(Math.max(0, calculatedAmount + manualAdjustment + carriedForward));
  const { statementId, initialPaid, initialRemaining } = computeStatementPaymentTotals({
    accountId: account.id,
    cycleKey,
    existing,
    totalDue,
    linkedPaymentKeys: params.linkedPaymentKeys,
  });

  return {
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
    paidAt: existing?.paidAt ?? null,
    notes: existing?.notes,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: existing?.updatedAt ?? new Date().toISOString(),
  };
}

function buildBilledStatementsList(params: {
  account: FinanceAccount;
  knownCycleKeys: CycleKeyString[];
  billingDay: number;
  dueDay: number;
  gracePeriodDays?: number;
  referenceDate: IsoDateString;
  txByCycle: Map<CycleKeyString, FinanceTransaction[]>;
  persistedByCycle: Map<CycleKeyString, CreditCardStatement>;
  hasAnyPersistedStatements: boolean;
  prevCycleKey: CycleKeyString;
  rawAccountBalance: number;
  linkedPaymentKeys: Set<string>;
}): CreditCardStatement[] {
  const billedStatements: CreditCardStatement[] = [];
  let hasPriorOpenStatement = false;

  for (const cycleKey of params.knownCycleKeys) {
    const [cYear, cMonth] = cycleKey.split('-').map(Number);
    const window = getCycleWindowForMonth(params.billingDay, params.dueDay, cYear, cMonth - 1, params.gracePeriodDays);
    if (window.periodEnd > params.referenceDate) continue;

    const statement = buildBilledStatementForCycle({
      account: params.account,
      cycleKey,
      window,
      cycleTxs: params.txByCycle.get(cycleKey) ?? [],
      existing: params.persistedByCycle.get(cycleKey),
      hasAnyPersistedStatements: params.hasAnyPersistedStatements,
      isLatestClosedCycle: cycleKey === params.prevCycleKey,
      rawAccountBalance: params.rawAccountBalance,
      hasPriorOpenStatement,
      linkedPaymentKeys: params.linkedPaymentKeys,
    });
    if (statement.remainingDue > 0) hasPriorOpenStatement = true;
    billedStatements.push(statement);
  }
  return billedStatements;
}

export function computeCreditCardSummary(params: {
  account: FinanceAccount;
  transactions: FinanceTransaction[];
  persistedStatements?: CreditCardStatement[];
  referenceDate?: IsoDateString;
}): CreditCardCycleSummary {
  const { account, transactions, persistedStatements = [] } = params;
  const referenceDate = normalizeIsoDate(params.referenceDate ?? getLocalIsoDate());
  const { billingDay, dueDay, creditLimit, gracePeriodDays } = resolveCardBillingConfig(account);

  const unbilledWindow = getActiveUnbilledCycle(billingDay, dueDay, referenceDate, gracePeriodDays);
  const { year: unbilledY, month: unbilledM } = parseIsoDate(unbilledWindow.periodEnd);
  const prevCycleWindow = getCycleWindowForMonth(billingDay, dueDay, unbilledY, unbilledM - 2, gracePeriodDays);

  const cardTxs = transactions.filter((t) => (t.accountId === account.id || t.toAccountId === account.id) && !t.deletedAt);
  const billPaymentTxs = sortBillPaymentTxs(
    cardTxs.filter((t) => t.isCreditCardPayment === true || (t.type === 'transfer' && t.toAccountId === account.id))
  );
  const standardCardTxs = cardTxs.filter((t) => t.accountId === account.id && !t.isCreditCardPayment && t.type !== 'transfer');
  const txByCycle = groupCardTxsByCycle(standardCardTxs, billingDay, dueDay);

  const unbilledTxs = txByCycle.get(unbilledWindow.cycleKey) ?? [];
  let unbilledCalculated = sumCardTransactions(unbilledTxs);
  const rawAccountBalance = Math.abs(Number(account.balance) || 0);
  const activePersisted = persistedStatements.filter((s) => s.accountId === account.id && !s.deletedAt);
  const hasAnyPersistedStatements = activePersisted.length > 0;

  if (!hasAnyPersistedStatements && rawAccountBalance > 0 && prevCycleWindow.periodEnd > referenceDate) {
    unbilledCalculated = roundCurrency(unbilledCalculated + Math.max(0, rawAccountBalance - unbilledCalculated));
  }

  const persistedByCycle = new Map<CycleKeyString, CreditCardStatement>(activePersisted.map((s) => [s.cycleKey, s]));
  const linkedPaymentKeys = new Set<string>(billPaymentTxs.map((tx) => tx.paidStatementId).filter(Boolean) as string[]);
  const knownCycleKeys = collectKnownCycleKeys({
    txByCycle,
    persistedStatements,
    accountId: account.id,
    unbilledCycleKey: unbilledWindow.cycleKey,
    prevCycleWindow,
    referenceDate,
  });

  const billedStatements = buildBilledStatementsList({
    account,
    knownCycleKeys,
    billingDay,
    dueDay,
    gracePeriodDays,
    referenceDate,
    txByCycle,
    persistedByCycle,
    hasAnyPersistedStatements,
    prevCycleKey: prevCycleWindow.cycleKey,
    rawAccountBalance,
    linkedPaymentKeys,
  });

  const unallocatedPayments = applyPaymentsToBilledStatements(billedStatements, billPaymentTxs, unbilledWindow);
  for (const s of billedStatements) {
    s.paidAmount = roundCurrency(s.paidAmount);
    s.remainingDue = roundCurrency(s.remainingDue);
    s.status = evaluateStatementStatus(s, referenceDate);
  }

  const netUnbilledAmount = roundCurrency(Math.max(0, unbilledCalculated - unallocatedPayments));
  const unpaidStatements = billedStatements.filter((s) => s.remainingDue > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const billedDueTotal = roundCurrency(unpaidStatements.reduce((sum, s) => roundCurrency(sum + s.remainingDue), 0));
  const currentBilledStatement = unpaidStatements[0] ?? null;
  const totalOutstanding = roundCurrency(billedDueTotal + netUnbilledAmount);
  const availableCredit = creditLimit > 0 ? roundCurrency(Math.max(0, creditLimit - totalOutstanding)) : 0;
  const nextDueDate = currentBilledStatement ? currentBilledStatement.dueDate : null;

  return {
    accountId: account.id,
    creditLimit,
    billedDueTotal,
    currentBilledStatement,
    billedStatement: currentBilledStatement,
    overdueStatements: unpaidStatements.filter((s) => s.status === 'overdue'),
    unbilledCycle: {
      ...unbilledWindow,
      amount: netUnbilledAmount,
      transactionCount: unbilledTxs.length,
      daysUntilGeneration: Math.max(0, daysBetween(referenceDate, unbilledWindow.periodEnd)),
    },
    unbilledSpend: netUnbilledAmount,
    totalOutstanding,
    totalUtilized: totalOutstanding,
    availableCredit,
    availableLimit: availableCredit,
    utilizationPercent: creditLimit > 0 ? Math.min(100, Math.round((totalOutstanding / creditLimit) * 100)) : 0,
    nextDueDate,
    daysUntilDue: nextDueDate ? daysBetween(referenceDate, nextDueDate) : null,
  };
}
