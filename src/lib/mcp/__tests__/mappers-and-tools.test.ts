import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { parseISO } from 'date-fns';
import { db } from '@/lib/db';
import {
  mapCreditCardStatementFromRow,
  mapDebtRecordFromRow,
  mapEmiTrackerFromRow,
  mapFinanceAccountFromRow,
  mapFinanceBudgetFromRow,
  mapFinanceCategoryFromRow,
  mapFinanceTransactionFromRow,
  mapHabitCompletionFromRow,
  mapHabitFromRow,
  mapMonthlyCommitmentFromRow,
} from '../mappers';
import {
  calculateCommitmentLedger,
  calculateFriendLedgerGroups,
  calculateMonthlySummary,
  calculateNetWorthSummary,
} from '@/lib/finance/shared-analytics';
import { computeCreditCardSummary } from '@/lib/finance/credit-card-cycles';
import { buildCashFlowForecast } from '@/lib/finance/forecast';
import { calculateHabitStats, getHabitWeekProgress } from '@/lib/calculations';
import {
  deriveRepairedSplitLegId,
  repairLegacySplitTransactions,
  resetSplitRepairMigration,
} from '@/lib/finance/split-repair-migration';
import { deduplicateFinanceRecordsInDexie } from '@/lib/sync/engines/finance/finance-sync-types';

describe('MCP Row Mappers & Bug Regression Suite', () => {
  beforeEach(async () => {
    await db.financeCategories.clear();
    await db.financeAccounts.clear();
    await db.financeTransactions.clear();
    await db.financeBudgets.clear();
    await db.monthlyCommitments.clear();
    await db.debtRecords.clear();
    await db.emiTrackers.clear();
    await db.creditCardStatements.clear();
    resetSplitRepairMigration();
  });

  function buildMonthlyFinanceFixtures() {
    const accounts = [
      mapFinanceAccountFromRow({ id: 'acc-upi', user_id: 'user-1', name: 'UPI', type: 'upi', balance: 19726, include_in_net_worth: true }),
      mapFinanceAccountFromRow({ id: 'acc-slice', user_id: 'user-1', name: 'Slice', type: 'credit_card', balance: -10645, credit_limit: 50000, billing_day: 20, statement_day: 20, due_day: 5, include_in_net_worth: true }),
      mapFinanceAccountFromRow({ id: 'acc-axis', user_id: 'user-1', name: 'Axis Bank', type: 'credit_card', balance: -409, credit_limit: 81000, billing_day: 15, statement_day: 15, due_day: 2, include_in_net_worth: true }),
    ];
    const categories = [
      mapFinanceCategoryFromRow({ id: 'cat-food', user_id: 'user-1', name: 'Food & Dining', slug: 'food-dining', type: 'expense', monthly_budget_limit: 800, rollover_enabled: false }),
    ];
    const transactions = [
      mapFinanceTransactionFromRow({ id: 'tx-1', user_id: 'user-1', title: 'Oats + milk', amount: 203, type: 'expense', category_id: 'cat-food', account_id: 'acc-axis', date: '2026-11-24', month_key: '2026-11' }),
      mapFinanceTransactionFromRow({ id: 'tx-2', user_id: 'user-1', title: 'Guava', amount: 100, type: 'expense', category_id: 'cat-food', account_id: 'acc-slice', date: '2026-11-24', month_key: '2026-11' }),
    ];
    const budgets = [
      mapFinanceBudgetFromRow({ id: 'bud-1', user_id: 'user-1', month_key: '2026-11', total_budget: 16500, expected_income: 19000, budget_mode: 'zero_based' }),
    ];
    return { accounts, categories, transactions, budgets };
  }

  it('maps snake_case finance rows accurately for monthly summary, net worth, and credit card cycles', () => {
    const { accounts, categories, transactions, budgets } = buildMonthlyFinanceFixtures();

    const summary = calculateMonthlySummary({
      monthKey: '2026-11', transactions, categories, budgets,
      commitments: [], emiTrackers: [], debtRecords: [], debtInstallments: [], recurringBills: [], sipPlans: [],
      referenceDate: '2026-11-24',
    });
    expect(summary.totalSpent).toBe(303);
    expect(summary.expectedIncome).toBe(19000);
    expect(summary.categoryBreakdown[0].spent).toBe(303);
    expect(summary.categoryBreakdown[0].budgetLimit).toBe(800);

    const netWorth = calculateNetWorthSummary({ accounts, sipPlans: [], debtRecords: [], emiTrackers: [] });
    expect(Number.isNaN(netWorth.netWorth)).toBe(false);
    expect(netWorth.liquidAssets).toBe(19726);
    expect(netWorth.creditCardLiabilities).toBe(11054);
    expect(netWorth.netWorth).toBe(8672);

    const sliceSummary = computeCreditCardSummary({ account: accounts[1], transactions, persistedStatements: [], referenceDate: '2026-11-24' });
    expect(sliceSummary.creditLimit).toBe(50000);
    expect(sliceSummary.unbilledCycle.periodEnd).toBe('2026-12-20');
    expect(sliceSummary.unbilledCycle.dueDate).toBe('2027-01-05');
    expect(sliceSummary.unbilledSpend).toBe(100);

    const axisSummary = computeCreditCardSummary({ account: accounts[2], transactions, persistedStatements: [], referenceDate: '2026-11-24' });
    expect(axisSummary.creditLimit).toBe(81000);
    expect(axisSummary.unbilledCycle.periodEnd).toBe('2026-12-15');
    expect(axisSummary.unbilledCycle.dueDate).toBe('2027-01-02');
    expect(axisSummary.unbilledSpend).toBe(203);
  });

  it('maps debt_records safely for calculateFriendLedgerGroups without trim crashes', () => {
    const debts = [
      mapDebtRecordFromRow({
        id: 'debt-1',
        user_id: 'user-1',
        person_name: 'Aadi',
        direction: 'lent',
        bucket_type: 'everyday_split',
        title: 'Everyday Split: pizza',
        principal_amount: 255,
        total_repaid_amount: 0,
        remaining_amount: 255,
        start_date: '2026-11-20',
        status: 'active',
      }),
    ];

    const groups = calculateFriendLedgerGroups(debts);
    expect(groups).toHaveLength(1);
    expect(groups[0].friendName).toBe('Aadi');
    expect(groups[0].everydayLentRemaining).toBe(255);
  });

  it('maps habits and completions safely even when created_at is omitted', () => {
    const refDate = parseISO('2026-11-24');
    const habitWithMissingCreatedAt = mapHabitFromRow(
      {
        id: 'hab-1',
        user_id: 'user-1',
        name: 'Morning Exercise',
        category: 'health',
        target_days: 5,
        frequency_type: 'weekly_flexible',
        is_archived: false,
      },
      '2026-11-24T00:00:00.000Z'
    );
    const comps = [
      mapHabitCompletionFromRow(
        {
          id: 'comp-1',
          user_id: 'user-1',
          habit_id: 'hab-1',
          date: '2026-11-24',
          completed: true,
        },
        'user-1'
      ),
    ];

    const stats = calculateHabitStats(habitWithMissingCreatedAt, comps, refDate);
    const week = getHabitWeekProgress(habitWithMissingCreatedAt, comps, refDate);

    expect(stats.currentStreak).toBe(1);
    expect(week.completedCount).toBe(1);
    expect(week.targetCount).toBe(5);

    // Defensive check even if caller passes a Habit without createdAt directly
    const bareStats = calculateHabitStats(
      { ...habitWithMissingCreatedAt, createdAt: '' },
      comps,
      refDate
    );
    expect(bareStats.totalCompletions).toBe(1);
  });

  function buildCcEmiForecastFixtures() {
    const upi = mapFinanceAccountFromRow({ id: 'acc-upi', user_id: 'user-1', name: 'UPI', type: 'upi', balance: 10000 });
    const slice = mapFinanceAccountFromRow({
      id: 'acc-slice', user_id: 'user-1', name: 'Slice', type: 'credit_card', balance: -5000, billing_day: 20, due_day: 5,
    });
    const emis = [
      mapEmiTrackerFromRow({
        id: 'emi-snapmint', user_id: 'user-1', loan_name: 'earbuds', lender_name: 'Snapmint',
        principal_amount: 3370, emi_amount: 674, tenure_months: 5, paid_months: 2,
        start_date: '2026-11-20', billing_day_of_month: 3, category_id: 'cat-emi', account_id: 'acc-upi', status: 'active',
      }),
      mapEmiTrackerFromRow({
        id: 'emi-slice-jacket', user_id: 'user-1', loan_name: 'Jacket', lender_name: 'Slice',
        principal_amount: 1012, emi_amount: 338, tenure_months: 3, paid_months: 1,
        start_date: '2026-11-20', billing_day_of_month: 5, category_id: 'cat-emi', account_id: 'acc-slice', status: 'active',
      }),
    ];
    const sliceStmt = mapCreditCardStatementFromRow({
      id: 'acc-slice_2026-11', user_id: 'user-1', account_id: 'acc-slice', cycle_key: '2026-11',
      period_start: '2026-10-21', period_end: '2026-11-20', due_date: '2026-12-05',
      total_due: 5000, remaining_due: 5000, status: 'billed',
    });
    return { upi, slice, emis, sliceStmt };
  }

  it('skips credit-card-linked EMIs in cash-flow forecast while deducting UPI EMIs', () => {
    const { upi, slice, emis, sliceStmt } = buildCcEmiForecastFixtures();
    const forecast = buildCashFlowForecast({
      accounts: [upi, slice],
      transactions: [],
      budgets: [],
      recurringBills: [],
      emiTrackers: emis,
      sipPlans: [],
      commitments: [],
      creditCardStatements: [sliceStmt],
      horizonDays: 30,
      includeDiscretionaryBurn: false,
      referenceDate: '2026-11-24',
    });

    const dec3 = forecast.points.find((p) => p.dateStr === '2026-12-03');
    const dec5 = forecast.points.find((p) => p.dateStr === '2026-12-05');

    expect(dec3?.scheduledOutflow).toBe(674);
    expect(dec3?.events).toContain('EMI: earbuds');
    expect(dec5?.scheduledOutflow).toBe(5000);
    expect(dec5?.events).not.toContain('EMI: Jacket');
  });

  it('subtracts linked income reimbursements from commitment fulfillment and rollover', () => {
    const mummyComm = mapMonthlyCommitmentFromRow({
      id: 'comm-mummy',
      user_id: 'user-1',
      title: "Mother's monthly allowance",
      recipient_name: 'Mother',
      monthly_target_amount: 3000,
      due_day_of_month: 7,
      auto_rollover_overpayment: true,
      is_active: true,
    });

    const txs = [
      mapFinanceTransactionFromRow({
        id: 'tx-offset',
        user_id: 'user-1',
        title: 'Home Bills & Medicine',
        amount: 5433,
        type: 'expense',
        category_id: 'cat-mummy',
        account_id: 'acc-upi',
        date: '2026-11-20',
        month_key: '2026-11',
        linked_commitment_id: 'comm-mummy',
        commitment_contribution_type: 'offset_expense',
      }),
      mapFinanceTransactionFromRow({
        id: 'tx-reimburse',
        user_id: 'user-1',
        title: 'Reimbursement from Mother',
        amount: 2000,
        type: 'income',
        category_id: 'cat-mummy',
        account_id: 'acc-upi',
        date: '2026-11-24',
        month_key: '2026-11',
        linked_commitment_id: 'comm-mummy',
        commitment_contribution_type: 'direct_payment',
      }),
    ];

    const novLedger = calculateCommitmentLedger(mummyComm, '2026-11', txs);
    expect(novLedger.offsetExpensesAmount).toBe(5433);
    expect(novLedger.totalFulfilledAmount).toBe(3433);
    expect(novLedger.overpaidAmount).toBe(433);

    const decLedger = calculateCommitmentLedger(mummyComm, '2026-12', txs);
    expect(decLedger.rolloverFromPreviousMonth).toBe(433);
    expect(decLedger.effectiveTargetAmount).toBe(2567);
  });

  async function seedDuplicateSplitTransactions(splitGroupId: string) {
    const now = new Date().toISOString();
    await db.financeAccounts.add({
      id: 'acc-slice', userId: 'user-1', name: 'Slice', type: 'credit_card', balance: -108,
      currency: 'INR', color: '#f43f5e', icon: 'CreditCard', isDefault: true, archived: false, createdAt: now, updatedAt: now,
    });
    await db.financeTransactions.bulkAdd([
      {
        id: 'tx-user', userId: 'user-1', title: 'Toilet cleaner', amount: 54, type: 'expense',
        categoryId: 'cat-shop', accountId: 'acc-slice', date: '2026-11-22', monthKey: '2026-11',
        tags: ['aadi', 'split'], isRecurring: false, splitGroupId,
        createdAt: '2026-11-22T05:14:18.821Z', updatedAt: '2026-11-22T05:14:18.821Z',
      },
      {
        id: 'dup-1', userId: 'user-1', title: "Aadi's Share: Toilet cleaner", amount: 54, type: 'expense',
        categoryId: 'cat-emi', subcategory: 'Friend Split', accountId: 'acc-slice', date: '2026-11-22', monthKey: '2026-11',
        notes: 'Friend split portion for Aadi (repaired) · Toilet cleaner', tags: ['aadi', 'split', 'friend-share'],
        isRecurring: false, splitGroupId, generationCounter: 2,
        createdAt: '2026-11-23T11:20:17.391Z', updatedAt: '2026-11-23T11:20:17.391Z',
      },
      {
        id: 'dup-2', userId: 'user-1', title: "Aadi's Share: Toilet cleaner", amount: 54, type: 'expense',
        categoryId: 'cat-emi', subcategory: 'Friend Split', accountId: 'acc-slice', date: '2026-11-22', monthKey: '2026-11',
        notes: 'Friend split portion for Aadi (repaired) · Toilet cleaner', tags: ['aadi', 'split', 'friend-share'],
        isRecurring: false, splitGroupId, generationCounter: 2,
        createdAt: '2026-11-23T12:02:20.071Z', updatedAt: '2026-11-23T12:02:20.071Z',
      },
    ]);
  }

  it('derives deterministic repaired split IDs and deduplicates duplicate repaired legs without changing balances', async () => {
    const splitGroupId = '98b617b0-0971-4f70-bee0-0e643d07cb76';
    const id1 = deriveRepairedSplitLegId(splitGroupId);
    expect(id1).toBe(deriveRepairedSplitLegId(splitGroupId));
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);

    await seedDuplicateSplitTransactions(splitGroupId);
    await deduplicateFinanceRecordsInDexie('user-1');

    const active = await db.financeTransactions.where('userId').equals('user-1').filter((t) => !t.deletedAt).toArray();
    expect(active).toHaveLength(2);
    expect(active.map((t) => t.id).sort()).toEqual(['dup-1', 'tx-user']);

    const softDeleted = await db.financeTransactions.get('dup-2');
    expect(softDeleted?.deletedAt).toBeTruthy();
    expect(softDeleted?.isDirty).toBe(true);
    expect(softDeleted?.generationCounter).toBe(3);

    expect((await db.financeAccounts.get('acc-slice'))?.balance).toBe(-108);
    expect((await repairLegacySplitTransactions('user-1')).repairedCount).toBe(0);
  });
});
