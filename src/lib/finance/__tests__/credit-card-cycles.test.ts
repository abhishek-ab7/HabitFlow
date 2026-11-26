import { describe, it, expect } from 'vitest';
import {
  getLocalIsoDate,
  formatOrdinal,
  formatShortDate,
  getValidDateInMonth,
  addDays,
  daysBetween,
  getCycleWindowForMonth,
  resolveTransactionCycle,
  getActiveUnbilledCycle,
  allocatePaymentToStatements,
  computeCreditCardSummary,
} from '../credit-card-cycles';
import type {
  CreditCardStatement,
  FinanceAccount,
  FinanceTransaction,
} from '@/lib/types';

describe('Credit Card Cycle Engine (credit-card-cycles.ts)', () => {
  // Helpers to mock account and transactions
  const createMockAccount = (overrides?: Partial<FinanceAccount>): FinanceAccount => ({
    id: 'acc-slice-1',
    userId: 'user-1',
    name: 'Slice Card',
    type: 'credit_card',
    balance: 0,
    creditLimit: 100000,
    billingDay: 21,
    dueDay: 5,
    currency: 'INR',
    color: '#f43f5e',
    icon: 'CreditCard',
    isDefault: false,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });

  const createMockTransaction = (overrides?: Partial<FinanceTransaction>): FinanceTransaction => ({
    id: crypto.randomUUID(),
    userId: 'user-1',
    title: 'Test Expense',
    amount: 1000,
    type: 'expense',
    categoryId: 'cat-general',
    accountId: 'acc-slice-1',
    date: '2026-11-10',
    monthKey: '2026-11',
    tags: [],
    isRecurring: false,
    createdAt: '2026-11-10T10:00:00.000Z',
    updatedAt: '2026-11-10T10:00:00.000Z',
    ...overrides,
  });

  describe('1. Date Clamping & Short Months (getValidDateInMonth)', () => {
    it('clamps day 31 to 28 in February on normal years', () => {
      // 2026 is non-leap
      expect(getValidDateInMonth(2026, 1, 31)).toBe('2026-02-28');
    });

    it('clamps day 31 to 29 in February on leap years', () => {
      // 2028 is a leap year
      expect(getValidDateInMonth(2028, 1, 31)).toBe('2028-02-29');
    });

    it('clamps day 31 to 30 in 30-day months like April and June', () => {
      expect(getValidDateInMonth(2026, 3, 31)).toBe('2026-04-30');
      expect(getValidDateInMonth(2026, 5, 31)).toBe('2026-06-30');
    });

    it('retains exact day when valid within month', () => {
      expect(getValidDateInMonth(2026, 10, 21)).toBe('2026-11-21');
      expect(getValidDateInMonth(2026, 10, 5)).toBe('2026-11-05');
    });
  });

  describe('2. Date Math Utilities (addDays, daysBetween)', () => {
    it('accurately adds and subtracts days across month and year boundaries', () => {
      expect(addDays('2026-10-21', 1)).toBe('2026-10-22');
      expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
      expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    });

    it('calculates exact calendar day differences', () => {
      expect(daysBetween('2026-11-25', '2026-12-05')).toBe(10);
      expect(daysBetween('2026-12-05', '2026-11-25')).toBe(-10);
      expect(daysBetween('2026-11-25', '2026-11-25')).toBe(0);
    });
  });

  describe('3. Cycle Window Calculations (getCycleWindowForMonth)', () => {
    it('Slice scenario: billingDay 21, dueDay 5 in November', () => {
      // monthIndex 10 = November
      const cycle = getCycleWindowForMonth(21, 5, 2026, 10);
      expect(cycle.cycleKey).toBe('2026-11');
      expect(cycle.periodStart).toBe('2026-10-22');
      expect(cycle.periodEnd).toBe('2026-11-21');
      expect(cycle.dueDate).toBe('2026-12-05');
    });

    it('Axis scenario: billingDay 15, dueDay 2 in November', () => {
      const cycle = getCycleWindowForMonth(15, 2, 2026, 10);
      expect(cycle.cycleKey).toBe('2026-11');
      expect(cycle.periodStart).toBe('2026-10-16');
      expect(cycle.periodEnd).toBe('2026-11-15');
      expect(cycle.dueDate).toBe('2026-12-02');
    });

    it('Same-month due date: billingDay 5, dueDay 25', () => {
      const cycle = getCycleWindowForMonth(5, 25, 2026, 10);
      expect(cycle.cycleKey).toBe('2026-11');
      expect(cycle.periodStart).toBe('2026-10-06');
      expect(cycle.periodEnd).toBe('2026-11-05');
      // Because dueDay (25) > billingDay (5), due date is in same month!
      expect(cycle.dueDate).toBe('2026-11-25');
    });

    it('Year rollover: billingDay 21, dueDay 5 in December rolls due date to January of next year', () => {
      // monthIndex 11 = December
      const cycle = getCycleWindowForMonth(21, 5, 2026, 11);
      expect(cycle.cycleKey).toBe('2026-12');
      expect(cycle.periodStart).toBe('2026-11-22');
      expect(cycle.periodEnd).toBe('2026-12-21');
      expect(cycle.dueDate).toBe('2027-01-05');
    });

    it('Grace period fallback when specified instead of fixed dueDay', () => {
      const cycle = getCycleWindowForMonth(21, 0, 2026, 10, 18); // 18 days grace period
      expect(cycle.periodEnd).toBe('2026-11-21');
      expect(cycle.dueDate).toBe('2026-12-09'); // Nov 21 + 18 days = Dec 9
    });
  });

  describe('4. Transaction Cycle Resolution (resolveTransactionCycle)', () => {
    const billingDay = 21;
    const dueDay = 5;

    it('assigns transactions on or before billingDay to current month cycle', () => {
      expect(resolveTransactionCycle('2026-11-10', billingDay, dueDay)).toBe('2026-11');
      expect(resolveTransactionCycle('2026-11-21', billingDay, dueDay)).toBe('2026-11');
    });

    it('assigns transactions after billingDay to next month cycle', () => {
      expect(resolveTransactionCycle('2026-11-22', billingDay, dueDay)).toBe('2026-12');
      expect(resolveTransactionCycle('2026-11-30', billingDay, dueDay)).toBe('2026-12');
    });

    it('handles December rollover into next year January', () => {
      expect(resolveTransactionCycle('2026-12-25', billingDay, dueDay)).toBe('2027-01');
    });

    it('respects manualOverrideCycleKey regardless of transaction date', () => {
      // Transaction on Nov 21 forced to settle in Dec cycle
      expect(resolveTransactionCycle('2026-11-21', billingDay, dueDay, '2026-12')).toBe('2026-12');
    });

    it('Axis scenario: billingDay 15', () => {
      expect(resolveTransactionCycle('2026-11-14', 15, 2)).toBe('2026-11');
      expect(resolveTransactionCycle('2026-11-15', 15, 2)).toBe('2026-11');
      expect(resolveTransactionCycle('2026-11-16', 15, 2)).toBe('2026-12');
    });
  });

  describe('5. Active Unbilled Cycle & Statement Closes (getActiveUnbilledCycle)', () => {
    it('Slice before statement close (Nov 20): unbilled cycle is Nov (closes Nov 21)', () => {
      const active = getActiveUnbilledCycle(21, 5, '2026-11-20');
      expect(active.cycleKey).toBe('2026-11');
      expect(active.periodEnd).toBe('2026-11-21');
    });

    it('Slice on statement close day (Nov 21): statement closes, unbilled cycle becomes Dec', () => {
      const active = getActiveUnbilledCycle(21, 5, '2026-11-21');
      expect(active.cycleKey).toBe('2026-12');
      expect(active.periodStart).toBe('2026-11-22');
      expect(active.periodEnd).toBe('2026-12-21');
      expect(active.dueDate).toBe('2027-01-05');
    });

    it('Slice after statement close (Nov 25): unbilled cycle is Dec (Nov 22 – Dec 21)', () => {
      const active = getActiveUnbilledCycle(21, 5, '2026-11-25');
      expect(active.cycleKey).toBe('2026-12');
      expect(active.periodStart).toBe('2026-11-22');
      expect(active.periodEnd).toBe('2026-12-21');
    });
  });

  describe('6. Dual-Bucket Card Summary — Reference Scenario 1 (Slice Exact-to-the-Rupee)', () => {
    const account = createMockAccount({
      id: 'acc-slice-1',
      creditLimit: 100000,
      billingDay: 21,
      dueDay: 5,
    });

    // Transactions totaling ₹22,000 in Oct 22 – Nov 21 cycle
    const billedTxs = [
      createMockTransaction({ id: 'tx-1', amount: 12000, date: '2026-11-05' }),
      createMockTransaction({ id: 'tx-2', amount: 10000, date: '2026-11-20' }),
    ];

    // Transactions totaling ₹20,000 in Nov 22 – Dec 21 unbilled cycle
    const unbilledTxs = [
      createMockTransaction({ id: 'tx-3', amount: 15000, date: '2026-11-22' }),
      createMockTransaction({ id: 'tx-4', amount: 5000, date: '2026-11-24' }),
    ];

    const allTxs = [...billedTxs, ...unbilledTxs];

    it('calculates exact ₹22k billed due (Dec 5) and ₹20k unbilled (Dec 21) on Nov 25', () => {
      const summary = computeCreditCardSummary({
        account,
        transactions: allTxs,
        referenceDate: '2026-11-25',
      });

      // Billed statement due MUST remain ₹22,000 (not increase to ₹42,000!)
      expect(summary.billedDueTotal).toBe(22000);
      expect(summary.currentBilledStatement).not.toBeNull();
      expect(summary.currentBilledStatement?.cycleKey).toBe('2026-11');
      expect(summary.currentBilledStatement?.periodStart).toBe('2026-10-22');
      expect(summary.currentBilledStatement?.periodEnd).toBe('2026-11-21');
      expect(summary.currentBilledStatement?.dueDate).toBe('2026-12-05');
      expect(summary.currentBilledStatement?.remainingDue).toBe(22000);
      expect(summary.currentBilledStatement?.status).toBe('billed');

      // Unbilled cycle
      expect(summary.unbilledCycle.cycleKey).toBe('2026-12');
      expect(summary.unbilledCycle.periodStart).toBe('2026-11-22');
      expect(summary.unbilledCycle.periodEnd).toBe('2026-12-21');
      expect(summary.unbilledCycle.dueDate).toBe('2027-01-05');
      expect(summary.unbilledCycle.amount).toBe(20000);
      expect(summary.unbilledCycle.transactionCount).toBe(2);

      // Total utilized credit & available limit
      expect(summary.totalOutstanding).toBe(42000);
      expect(summary.availableCredit).toBe(58000); // 100000 - 42000
      expect(summary.utilizationPercent).toBe(42);

      // Due date & days left
      expect(summary.nextDueDate).toBe('2026-12-05');
      expect(summary.daysUntilDue).toBe(10); // Nov 25 to Dec 5
    });
  });

  describe('7. Payment Allocation, Partial Settling, Overpayment & Refunds', () => {
    const account = createMockAccount({
      id: 'acc-slice-1',
      creditLimit: 100000,
      billingDay: 21,
      dueDay: 5,
    });

    const billedTxs = [
      createMockTransaction({ id: 'tx-1', amount: 22000, date: '2026-11-15' }),
    ];
    const unbilledTxs = [
      createMockTransaction({ id: 'tx-2', amount: 20000, date: '2026-11-23' }),
    ];

    function runPaymentSummaryScenario(opts: { id: string; amount: number; date: string; referenceDate: string }) {
      const payTx = createMockTransaction({
        id: opts.id,
        amount: opts.amount,
        type: 'transfer',
        accountId: 'acc-bank-1',
        toAccountId: 'acc-slice-1',
        isCreditCardPayment: true,
        date: opts.date,
      });
      return computeCreditCardSummary({
        account,
        transactions: [...billedTxs, ...unbilledTxs, payTx],
        referenceDate: opts.referenceDate,
      });
    }

    it('partial payment: paying ₹10,000 marks statement partial and updates remainingDue', () => {
      const summary = runPaymentSummaryScenario({
        id: 'tx-pay-1',
        amount: 10000,
        date: '2026-11-26',
        referenceDate: '2026-11-27',
      });

      expect(summary.billedDueTotal).toBe(12000);
      expect(summary.currentBilledStatement?.paidAmount).toBe(10000);
      expect(summary.currentBilledStatement?.remainingDue).toBe(12000);
      expect(summary.currentBilledStatement?.status).toBe('partial');
      expect(summary.unbilledCycle.amount).toBe(20000);
      expect(summary.totalOutstanding).toBe(32000); // 12000 + 20000
    });

    it('full payment: paying ₹22,000 marks statement paid and clears billed dues', () => {
      const summary = runPaymentSummaryScenario({
        id: 'tx-pay-full',
        amount: 22000,
        date: '2026-11-28',
        referenceDate: '2026-11-29',
      });

      expect(summary.billedDueTotal).toBe(0);
      expect(summary.currentBilledStatement).toBeNull(); // No unpaid billed statement left
      expect(summary.unbilledCycle.amount).toBe(20000);
      expect(summary.totalOutstanding).toBe(20000); // Only unbilled spends remain
      expect(summary.availableCredit).toBe(80000);
    });

    it('overpayment spillover: paying ₹25,000 clears ₹22k bill and offsets ₹3,000 against unbilled spends', () => {
      const summary = runPaymentSummaryScenario({
        id: 'tx-pay-over',
        amount: 25000,
        date: '2026-11-28',
        referenceDate: '2026-11-29',
      });

      expect(summary.billedDueTotal).toBe(0);
      // Unbilled spends reduced from ₹20,000 to ₹17,000 due to excess ₹3,000 payment credit
      expect(summary.unbilledCycle.amount).toBe(17000);
      expect(summary.totalOutstanding).toBe(17000);
      expect(summary.availableCredit).toBe(83000);
    });

    it('refunds reduce cycle spend correctly', () => {
      const refundTx = createMockTransaction({
        id: 'tx-refund',
        amount: 5000,
        type: 'income',
        accountId: 'acc-slice-1',
        isCreditCardPayment: false,
        date: '2026-11-24', // Refund in unbilled cycle
      });

      const summary = computeCreditCardSummary({
        account,
        transactions: [...billedTxs, ...unbilledTxs, refundTx],
        referenceDate: '2026-11-25',
      });

      expect(summary.billedDueTotal).toBe(22000);
      // 20000 unbilled - 5000 refund = 15000
      expect(summary.unbilledCycle.amount).toBe(15000);
      expect(summary.totalOutstanding).toBe(37000);
    });

    it('overdue status triggers when referenceDate passes dueDate without payment', () => {
      const summary = computeCreditCardSummary({
        account,
        transactions: billedTxs,
        referenceDate: '2026-12-07', // Due date was Dec 5
      });

      expect(summary.billedDueTotal).toBe(22000);
      expect(summary.currentBilledStatement?.status).toBe('overdue');
      expect(summary.overdueStatements.length).toBe(1);
      expect(summary.daysUntilDue).toBe(-2); // 2 days overdue
    });
  });

  describe('8. Manual Reconciliation (Opening Bill / manualAdjustment)', () => {
    it('sets opening ₹22,000 bill even if zero historical transactions were logged in HabitFlow', () => {
      const account = createMockAccount({
        id: 'acc-slice-1',
        creditLimit: 100000,
        billingDay: 21,
        dueDay: 5,
      });

      // User just joined HabitFlow and manually set Nov 21 Slice bill to ₹22,000
      const persistedStatements: CreditCardStatement[] = [
        {
          id: 'acc-slice-1_2026-11',
          userId: 'user-1',
          accountId: 'acc-slice-1',
          cycleKey: '2026-11',
          periodStart: '2026-10-22',
          periodEnd: '2026-11-21',
          dueDate: '2026-12-05',
          calculatedAmount: 0,
          manualAdjustment: 22000,
          totalDue: 22000,
          carriedForwardAmount: 0,
          paidAmount: 0,
          remainingDue: 22000,
          status: 'billed',
          createdAt: '2026-11-21T00:00:00.000Z',
          updatedAt: '2026-11-21T00:00:00.000Z',
        },
      ];

      // New spends in HabitFlow in the unbilled cycle
      const newSpends = [
        createMockTransaction({ id: 'tx-new-1', amount: 20000, date: '2026-11-23' }),
      ];

      const summary = computeCreditCardSummary({
        account,
        transactions: newSpends,
        persistedStatements,
        referenceDate: '2026-11-25',
      });

      expect(summary.billedDueTotal).toBe(22000);
      expect(summary.currentBilledStatement?.totalDue).toBe(22000);
      expect(summary.currentBilledStatement?.manualAdjustment).toBe(22000);
      expect(summary.currentBilledStatement?.dueDate).toBe('2026-12-05');
      expect(summary.unbilledCycle.amount).toBe(20000);
      expect(summary.totalOutstanding).toBe(42000);
      expect(summary.availableCredit).toBe(58000);
    });
  });

  describe('9. Waterfall Allocation Unit Function (allocatePaymentToStatements)', () => {
    const mockStatements: CreditCardStatement[] = [
      {
        id: 'stmt-1',
        accountId: 'acc-1',
        cycleKey: '2026-09',
        periodStart: '2026-08-22',
        periodEnd: '2026-09-21',
        dueDate: '2026-10-05',
        calculatedAmount: 5000,
        manualAdjustment: 0,
        totalDue: 5000,
        carriedForwardAmount: 0,
        paidAmount: 0,
        remainingDue: 5000,
        status: 'billed',
        createdAt: '2026-09-21T00:00:00.000Z',
        updatedAt: '2026-09-21T00:00:00.000Z',
      },
      {
        id: 'stmt-2',
        accountId: 'acc-1',
        cycleKey: '2026-10',
        periodStart: '2026-09-22',
        periodEnd: '2026-10-21',
        dueDate: '2026-11-05',
        calculatedAmount: 10000,
        manualAdjustment: 0,
        totalDue: 10000,
        carriedForwardAmount: 0,
        paidAmount: 0,
        remainingDue: 10000,
        status: 'billed',
        createdAt: '2026-10-21T00:00:00.000Z',
        updatedAt: '2026-10-21T00:00:00.000Z',
      },
    ];

    function assertStatementAllocation(opts: {
      paymentAmount: number;
      targetId?: string;
      stmt0: { paid: number; remaining: number; status?: string };
      stmt1: { paid: number; remaining: number; status: string };
    }) {
      const { updatedStatements, unallocatedAmount } = allocatePaymentToStatements(
        mockStatements,
        opts.paymentAmount,
        opts.targetId
      );
      expect(updatedStatements[0].paidAmount).toBe(opts.stmt0.paid);
      expect(updatedStatements[0].remainingDue).toBe(opts.stmt0.remaining);
      if (opts.stmt0.status) expect(updatedStatements[0].status).toBe(opts.stmt0.status);
      expect(updatedStatements[1].paidAmount).toBe(opts.stmt1.paid);
      expect(updatedStatements[1].remainingDue).toBe(opts.stmt1.remaining);
      expect(updatedStatements[1].status).toBe(opts.stmt1.status);
      expect(unallocatedAmount).toBe(0);
    }

    it('allocates to oldest statement first when no target is specified', () => {
      assertStatementAllocation({
        paymentAmount: 8000,
        stmt0: { paid: 5000, remaining: 0, status: 'paid' },
        stmt1: { paid: 3000, remaining: 7000, status: 'partial' },
      });
    });

    it('allocates to target statement first when targetStatementId is specified', () => {
      assertStatementAllocation({
        paymentAmount: 7000,
        targetId: 'stmt-2',
        stmt0: { paid: 0, remaining: 5000 },
        stmt1: { paid: 7000, remaining: 3000, status: 'partial' },
      });
    });

    it('returns unallocated credit on total overpayment', () => {
      const { updatedStatements, unallocatedAmount } = allocatePaymentToStatements(
        mockStatements,
        20000 // total due is 15000
      );

      expect(updatedStatements[0].remainingDue).toBe(0);
      expect(updatedStatements[1].remainingDue).toBe(0);
      expect(unallocatedAmount).toBe(5000); // 5000 credit surplus
    });
  });

  describe('10. Edge-Case Hardening & Formatting Helpers', () => {
    const account = createMockAccount({
      id: 'acc-slice-1',
      creditLimit: 100000,
      billingDay: 21,
      dueDay: 5,
    });

    it('getLocalIsoDate returns local calendar YYYY-MM-DD even just after local midnight', () => {
      const localMidnight = new Date(2026, 10, 21, 0, 15, 0); // Nov 21 00:15 local
      expect(getLocalIsoDate(localMidnight)).toBe('2026-11-21');
    });

    it('formatOrdinal formats 1st, 2nd, 3rd, 11th-13th, 21st, 22nd, 31st accurately', () => {
      expect(formatOrdinal(1)).toBe('1st');
      expect(formatOrdinal(2)).toBe('2nd');
      expect(formatOrdinal(3)).toBe('3rd');
      expect(formatOrdinal(4)).toBe('4th');
      expect(formatOrdinal(11)).toBe('11th');
      expect(formatOrdinal(12)).toBe('12th');
      expect(formatOrdinal(13)).toBe('13th');
      expect(formatOrdinal(21)).toBe('21st');
      expect(formatOrdinal(22)).toBe('22nd');
      expect(formatOrdinal(23)).toBe('23rd');
      expect(formatOrdinal(31)).toBe('31st');
    });

    it('formatShortDate formats plain and timestamped ISO dates into compact labels', () => {
      expect(formatShortDate('2026-12-05')).toBe('5 Dec');
      expect(formatShortDate('2026-11-21T10:15:00.000Z')).toBe('21 Nov');
    });

    it('normalizes full ISO timestamp strings on billing day so spends stay in the closing cycle', () => {
      expect(resolveTransactionCycle('2026-11-21T10:15:00.000Z', 21, 5)).toBe('2026-11');

      const txs = [
        createMockTransaction({ id: 'tx-ts', amount: 1500, date: '2026-11-21T23:59:59.000Z' }),
      ];
      const summary = computeCreditCardSummary({
        account,
        transactions: txs,
        referenceDate: '2026-11-25T08:00:00.000Z',
      });

      expect(summary.currentBilledStatement?.cycleKey).toBe('2026-11');
      expect(summary.billedDueTotal).toBe(1500);
      expect(summary.unbilledCycle.amount).toBe(0);
    });

    it('treats investment transactions on a credit card as card spend while only income reduces spend', () => {
      const txs = [
        createMockTransaction({ id: 'tx-exp', type: 'expense', amount: 1000, date: '2026-11-10' }),
        createMockTransaction({ id: 'tx-inv', type: 'investment', amount: 2500, date: '2026-11-12' }),
        createMockTransaction({ id: 'tx-inc', type: 'income', amount: 500, date: '2026-11-15' }),
        createMockTransaction({ id: 'tx-unb-inv', type: 'investment', amount: 3000, date: '2026-11-24' }),
      ];

      const summary = computeCreditCardSummary({
        account,
        transactions: txs,
        referenceDate: '2026-11-25',
      });

      // Billed = 1000 + 2500 - 500 = 3000
      expect(summary.billedDueTotal).toBe(3000);
      // Unbilled = 3000
      expect(summary.unbilledCycle.amount).toBe(3000);
    });

    it('eliminates floating-point paise drift so exact fractional bill settles cleanly to paid', () => {
      const txs = [
        createMockTransaction({ id: 'tx-f1', amount: 100.1, date: '2026-11-10' }),
        createMockTransaction({ id: 'tx-f2', amount: 200.2, date: '2026-11-12' }),
        createMockTransaction({
          id: 'tx-pay-f',
          type: 'transfer',
          accountId: 'acc-bank-1',
          toAccountId: 'acc-slice-1',
          isCreditCardPayment: true,
          amount: 300.3,
          date: '2026-11-25',
        }),
      ];

      const summary = computeCreditCardSummary({
        account,
        transactions: txs,
        referenceDate: '2026-11-26',
      });

      expect(summary.billedDueTotal).toBe(0);
      expect(summary.currentBilledStatement).toBeNull();
    });

    it('sorts explicitly linked bill payments before unlinked waterfall payments regardless of array order', () => {
      const octTx = createMockTransaction({ id: 'tx-oct', amount: 5000, date: '2026-10-10' });
      const novTx = createMockTransaction({ id: 'tx-nov', amount: 8000, date: '2026-11-10' });

      // Put an unlinked payment FIRST in raw array, then a linked payment targeting 2026-11 SECOND
      const unlinkedPay = createMockTransaction({
        id: 'pay-unlinked',
        type: 'transfer',
        accountId: 'acc-bank-1',
        toAccountId: 'acc-slice-1',
        isCreditCardPayment: true,
        amount: 5000,
        date: '2026-11-24',
      });
      const linkedPayNov = createMockTransaction({
        id: 'pay-linked-nov',
        type: 'transfer',
        accountId: 'acc-bank-1',
        toAccountId: 'acc-slice-1',
        isCreditCardPayment: true,
        paidStatementId: 'acc-slice-1_2026-11',
        amount: 8000,
        date: '2026-11-25',
      });

      const summary = computeCreditCardSummary({
        account,
        transactions: [octTx, novTx, unlinkedPay, linkedPayNov],
        referenceDate: '2026-11-26',
      });

      // Linked payment settles 2026-11 (8k); unlinked payment waterfalls to 2026-10 (5k) -> both settled
      expect(summary.billedDueTotal).toBe(0);
      expect(summary.currentBilledStatement).toBeNull();
    });

    it('preserves manual paidAmount on older statements even after logging a linked payment on a newer statement', () => {
      const persistedStatements: CreditCardStatement[] = [
        {
          id: 'acc-slice-1_2026-10',
          userId: 'user-1',
          accountId: 'acc-slice-1',
          cycleKey: '2026-10',
          periodStart: '2026-09-22',
          periodEnd: '2026-10-21',
          dueDate: '2026-11-05',
          calculatedAmount: 10000,
          manualAdjustment: 0,
          totalDue: 10000,
          carriedForwardAmount: 0,
          paidAmount: 10000, // Manually settled historically without a transfer tx
          remainingDue: 0,
          status: 'paid',
          createdAt: '2026-10-21T00:00:00.000Z',
          updatedAt: '2026-11-01T00:00:00.000Z',
        },
        {
          id: 'acc-slice-1_2026-11',
          userId: 'user-1',
          accountId: 'acc-slice-1',
          cycleKey: '2026-11',
          periodStart: '2026-10-22',
          periodEnd: '2026-11-21',
          dueDate: '2026-12-05',
          calculatedAmount: 22000,
          manualAdjustment: 0,
          totalDue: 22000,
          carriedForwardAmount: 0,
          paidAmount: 0,
          remainingDue: 22000,
          status: 'billed',
          createdAt: '2026-11-21T00:00:00.000Z',
          updatedAt: '2026-11-21T00:00:00.000Z',
        },
      ];

      const novSpends = createMockTransaction({ id: 'tx-nov', amount: 22000, date: '2026-11-15' });
      const novPayment = createMockTransaction({
        id: 'pay-nov',
        type: 'transfer',
        accountId: 'acc-bank-1',
        toAccountId: 'acc-slice-1',
        isCreditCardPayment: true,
        paidStatementId: 'acc-slice-1_2026-11',
        amount: 22000,
        date: '2026-11-25',
      });

      const summary = computeCreditCardSummary({
        account,
        transactions: [novSpends, novPayment],
        persistedStatements,
        referenceDate: '2026-11-26',
      });

      // October stays paid (not wiped to Overdue ₹10,000); November is paid -> billedDueTotal = 0
      expect(summary.overdueStatements.length).toBe(0);
      expect(summary.billedDueTotal).toBe(0);
      expect(summary.currentBilledStatement).toBeNull();
    });

    it('only applies excess overpayment against unbilled spends when payment date is within the active unbilled cycle', () => {
      const octSpend = createMockTransaction({ id: 'tx-oct', amount: 5000, date: '2026-10-10' });
      const decUnbilledSpend = createMockTransaction({ id: 'tx-dec', amount: 10000, date: '2026-11-24' });
      // Historical overpayment made on Nov 02 (before active unbilled cycle Nov 22 – Dec 21)
      const oldOverpay = createMockTransaction({
        id: 'pay-old-over',
        type: 'transfer',
        accountId: 'acc-bank-1',
        toAccountId: 'acc-slice-1',
        isCreditCardPayment: true,
        amount: 7000, // 2000 excess over 5000 Oct spend
        date: '2026-11-02',
      });

      const summary = computeCreditCardSummary({
        account,
        transactions: [octSpend, decUnbilledSpend, oldOverpay],
        referenceDate: '2026-11-25',
      });

      expect(summary.billedDueTotal).toBe(0);
      // Historical excess does NOT reduce the Dec unbilled cycle
      expect(summary.unbilledCycle.amount).toBe(10000);
    });

    it('prevents double-counting carriedForwardAmount while an earlier billed statement remains unpaid', () => {
      const octSpend = createMockTransaction({ id: 'tx-oct', amount: 5000, date: '2026-10-10' });
      const novSpend = createMockTransaction({ id: 'tx-nov', amount: 3000, date: '2026-11-10' });

      const persistedStatements: CreditCardStatement[] = [
        {
          id: 'acc-slice-1_2026-10',
          userId: 'user-1',
          accountId: 'acc-slice-1',
          cycleKey: '2026-10',
          periodStart: '2026-09-22',
          periodEnd: '2026-10-21',
          dueDate: '2026-11-05',
          calculatedAmount: 5000,
          manualAdjustment: 0,
          totalDue: 5000,
          carriedForwardAmount: 0,
          paidAmount: 0,
          remainingDue: 5000,
          status: 'overdue',
          createdAt: '2026-10-21T00:00:00.000Z',
          updatedAt: '2026-10-21T00:00:00.000Z',
        },
        {
          id: 'acc-slice-1_2026-11',
          userId: 'user-1',
          accountId: 'acc-slice-1',
          cycleKey: '2026-11',
          periodStart: '2026-10-22',
          periodEnd: '2026-11-21',
          dueDate: '2026-12-05',
          calculatedAmount: 3000,
          manualAdjustment: 0,
          totalDue: 8000,
          carriedForwardAmount: 5000, // Carried forward from Oct
          paidAmount: 0,
          remainingDue: 8000,
          status: 'billed',
          createdAt: '2026-11-21T00:00:00.000Z',
          updatedAt: '2026-11-21T00:00:00.000Z',
        },
      ];

      const summary = computeCreditCardSummary({
        account,
        transactions: [octSpend, novSpend],
        persistedStatements,
        referenceDate: '2026-11-25',
      });

      // Because 2026-10 (5000) is still open, 2026-11 should not also add carriedForwardAmount (5000)
      expect(summary.billedDueTotal).toBe(8000);
    });

    it('Scenario 18: Axis Bank — bill generated on 15th Nov of ₹3,000 configured via account dues without past transactions', () => {
      const axisAccount = createMockAccount({
        id: 'acc-axis-1',
        name: 'Axis Bank',
        creditLimit: 81000,
        billingDay: 15,
        dueDay: 3,
        balance: 3000, // User entered ₹3,000 current dues in Edit Account
      });

      // User has one swipe of ₹206 in active unbilled cycle (16 Nov - 15 Dec)
      const unbilledSwipe = createMockTransaction({
        id: 'tx-swipe-1',
        accountId: 'acc-axis-1',
        amount: 206,
        date: '2026-11-18',
        type: 'expense',
      });

      const summary = computeCreditCardSummary({
        account: axisAccount,
        transactions: [unbilledSwipe],
        persistedStatements: [],
        referenceDate: '2026-11-22',
      });

      // Statement Due for Nov 15 bill must be ₹3,000 (Due Dec 3)
      expect(summary.billedDueTotal).toBe(3000);
      expect(summary.currentBilledStatement).not.toBeNull();
      expect(summary.currentBilledStatement?.cycleKey).toBe('2026-11');
      expect(summary.currentBilledStatement?.periodStart).toBe('2026-10-16');
      expect(summary.currentBilledStatement?.periodEnd).toBe('2026-11-15');
      expect(summary.currentBilledStatement?.dueDate).toBe('2026-12-03');
      expect(summary.currentBilledStatement?.totalDue).toBe(3000);
      expect(summary.currentBilledStatement?.remainingDue).toBe(3000);
      expect(summary.currentBilledStatement?.status).toBe('billed');

      // Unbilled cycle must be ₹206
      expect(summary.unbilledCycle.cycleKey).toBe('2026-12');
      expect(summary.unbilledCycle.periodStart).toBe('2026-11-16');
      expect(summary.unbilledCycle.periodEnd).toBe('2026-12-15');
      expect(summary.unbilledCycle.dueDate).toBe('2027-01-03');
      expect(summary.unbilledCycle.amount).toBe(206);

      // Total utilized: ₹3,000 billed + ₹206 unbilled = ₹3,206
      expect(summary.totalOutstanding).toBe(3206);
      expect(summary.availableCredit).toBe(77794); // 81000 - 3206
      expect(summary.utilizationPercent).toBe(4); // round((3206 / 81000) * 100) = 4%
    });

    it('Scenario 19: Axis Bank — paying ₹3,000 bill marks opening statement paid and clears billed dues', () => {
      const axisAccount = createMockAccount({
        id: 'acc-axis-1',
        name: 'Axis Bank',
        creditLimit: 81000,
        billingDay: 15,
        dueDay: 3,
        balance: 3000,
      });

      const unbilledSwipe = createMockTransaction({
        id: 'tx-swipe-1',
        accountId: 'acc-axis-1',
        amount: 206,
        date: '2026-11-18',
        type: 'expense',
      });

      const billPayment = createMockTransaction({
        id: 'tx-pay-1',
        accountId: 'bank-acc-1',
        toAccountId: 'acc-axis-1',
        amount: 3000,
        date: '2026-11-23',
        type: 'transfer',
        isCreditCardPayment: true,
      });

      const summary = computeCreditCardSummary({
        account: axisAccount,
        transactions: [unbilledSwipe, billPayment],
        persistedStatements: [],
        referenceDate: '2026-11-23',
      });

      // Billed statement should be paid
      expect(summary.billedDueTotal).toBe(0);
      expect(summary.currentBilledStatement).toBeNull();
      expect(summary.overdueStatements.length).toBe(0);

      // Unbilled spend remains ₹206
      expect(summary.unbilledSpend).toBe(206);
      expect(summary.totalOutstanding).toBe(206);
      expect(summary.availableCredit).toBe(80794);
    });
  });
});
