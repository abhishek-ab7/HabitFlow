import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { FinanceSyncEngine } from '../engines/finance-sync';
import { useFinanceStore } from '@/lib/stores/finance-store';

// Mock Supabase Client
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockDelete = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }),
});
const mockSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ data: [], error: null }),
});

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      upsert: mockUpsert,
      delete: mockDelete,
      select: mockSelect,
    })),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    }),
    removeChannel: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'real-user-123' } } },
      }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  })),
}));

// Mock mediator
vi.mock('@/lib/stores/mediator', () => ({
  CrossDomainActionMediator: {
    onFinanceEvent: vi.fn().mockResolvedValue(undefined),
    dispatch: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('FinanceSyncEngine — Push, Pull, Deletions & Auto-Migration', () => {
  const userId = 'real-user-123';

  beforeEach(async () => {
    vi.clearAllMocks();
    await db.financeCategories.clear();
    await db.financeAccounts.clear();
    await db.financeTransactions.clear();
    await db.financeBudgets.clear();
    await db.monthlyCommitments.clear();
    await db.debtRecords.clear();
    await db.debtInstallments.clear();
    await db.emiTrackers.clear();
  });

  test('1. Pushes dirty transactions to Supabase and marks isDirty: false in Dexie', async () => {
    const syncer = new FinanceSyncEngine();
    const now = new Date().toISOString();

    await db.financeTransactions.add({
      id: 'tx-1',
      userId,
      title: 'Grocery Run',
      amount: 1200,
      type: 'expense',
      categoryId: 'cat-1',
      accountId: 'acc-1',
      date: '2026-11-19',
      monthKey: '2026-11',
      tags: [],
      isRecurring: false,
      isDirty: true,
      generationCounter: 1,
      createdAt: now,
      updatedAt: now,
    });

    const result = await syncer.sync(userId);
    expect(result.status).toBe('success');
    expect(result.pushed).toBeGreaterThanOrEqual(1);
    expect(mockUpsert).toHaveBeenCalled();

    const localTx = await db.financeTransactions.get('tx-1');
    expect(localTx?.isDirty).toBe(false);
  });

  test('2. Unsynced transactions without explicit isDirty: false are also pushed', async () => {
    const syncer = new FinanceSyncEngine();
    const now = new Date().toISOString();

    // Simulating transaction created without explicit isDirty flag
    await db.financeTransactions.add({
      id: 'tx-legacy',
      userId,
      title: 'Coffee with Friends',
      amount: 250,
      type: 'expense',
      categoryId: 'cat-1',
      accountId: 'acc-1',
      date: '2026-11-19',
      monthKey: '2026-11',
      tags: [],
      isRecurring: false,
      createdAt: now,
      updatedAt: now,
    });

    const result = await syncer.sync(userId);
    expect(result.status).toBe('success');
    expect(result.pushed).toBeGreaterThanOrEqual(1);

    const localTx = await db.financeTransactions.get('tx-legacy');
    expect(localTx?.isDirty).toBe(false);
  });

  test('3. Soft-deleted transactions are removed from Supabase and deleted from Dexie', async () => {
    const syncer = new FinanceSyncEngine();
    const now = new Date().toISOString();

    await db.financeTransactions.add({
      id: 'tx-del-1',
      userId,
      title: 'Cancelled order',
      amount: 800,
      type: 'expense',
      categoryId: 'cat-1',
      accountId: 'acc-1',
      date: '2026-11-19',
      monthKey: '2026-11',
      tags: [],
      isRecurring: false,
      deletedAt: now,
      isDirty: true,
      createdAt: now,
      updatedAt: now,
    });

    const result = await syncer.sync(userId);
    expect(result.status).toBe('success');
    expect(mockDelete).toHaveBeenCalled();

    const localTx = await db.financeTransactions.get('tx-del-1');
    expect(localTx).toBeUndefined();
  });

  test('4. Auto-migrates stranded local-demo-user records when real user logs in', async () => {
    const now = new Date().toISOString();

    // Stranded transaction created before auth was ready
    await db.financeTransactions.add({
      id: 'tx-stranded',
      userId: 'local-demo-user',
      title: 'Mother allowance offset',
      amount: 3000,
      type: 'expense',
      categoryId: 'cat-1',
      accountId: 'acc-1',
      date: '2026-11-19',
      monthKey: '2026-11',
      tags: [],
      isRecurring: false,
      createdAt: now,
      updatedAt: now,
    });

    // Loading finance data with authenticated user triggers auto-migration
    await useFinanceStore.getState().loadFinanceData(userId);

    const migratedTx = await db.financeTransactions.get('tx-stranded');
    expect(migratedTx?.userId).toBe(userId);
    expect(migratedTx?.isDirty).toBe(true);

    const syncer = new FinanceSyncEngine();
    const result = await syncer.sync(userId);
    expect(result.status).toBe('success');
    expect(result.pushed).toBeGreaterThanOrEqual(1);

    const syncedTx = await db.financeTransactions.get('tx-stranded');
    expect(syncedTx?.isDirty).toBe(false);
  });

  test('5. Pushes dirty accounts, commitments, debts, emis, and budgets cleanly', async () => {
    const syncer = new FinanceSyncEngine();
    const now = new Date().toISOString();

    await db.financeAccounts.add({
      id: 'acc-1',
      userId,
      name: 'HDFC Bank',
      type: 'bank',
      balance: 15000,
      currency: 'INR',
      color: '#10b981',
      icon: 'Landmark',
      isDefault: true,
      archived: false,
      isDirty: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.monthlyCommitments.add({
      id: 'comm-1',
      userId,
      title: "Mother's Support",
      recipientName: 'Mom',
      relationship: 'Family',
      monthlyTargetAmount: 3000,
      dueDayOfMonth: 5,
      category: 'family_support',
      autoRolloverOverpayment: true,
      icon: 'HeartHandshake',
      color: '#ec4899',
      isActive: true,
      isDirty: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.debtRecords.add({
      id: 'debt-1',
      userId,
      personName: 'Rahul',
      direction: 'lent',
      title: 'Dinner bill split',
      principalAmount: 2000,
      totalRepaidAmount: 500,
      remainingAmount: 1500,
      startDate: '2026-11-01',
      repaymentSchedule: 'monthly_partial',
      status: 'active',
      color: '#f59e0b',
      isDirty: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.debtInstallments.add({
      id: 'inst-1',
      userId,
      debtId: 'debt-1',
      amount: 500,
      date: '2026-11-15',
      monthKey: '2026-11',
      paymentMethod: 'upi',
      balanceAfterPayment: 1500,
      isDirty: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.emiTrackers.add({
      id: 'emi-1',
      userId,
      loanName: 'MacBook EMI',
      lenderName: 'Apple HDFC',
      principalAmount: 120000,
      interestRateAnnual: 0,
      emiAmount: 10000,
      tenureMonths: 12,
      paidMonths: 2,
      startDate: '2026-09-01',
      billingDayOfMonth: 5,
      categoryId: 'cat-1',
      autoCreateTaskReminder: true,
      status: 'active',
      isDirty: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.financeBudgets.add({
      id: 'bgt-1',
      userId,
      monthKey: '2026-11',
      totalBudget: 60000,
      expectedIncome: 90000,
      currency: 'INR',
      isDirty: true,
      createdAt: now,
      updatedAt: now,
    });

    const result = await syncer.sync(userId);
    expect(result.status).toBe('success');
    expect(result.pushed).toBe(6);

    const updatedAcc = await db.financeAccounts.get('acc-1');
    expect(updatedAcc?.isDirty).toBe(false);
    const updatedComm = await db.monthlyCommitments.get('comm-1');
    expect(updatedComm?.isDirty).toBe(false);
  });

  test('6. Handles partial remote failure gracefully without crashing', async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: 'Database connection failed', code: '500' } });
    const syncer = new FinanceSyncEngine();
    const now = new Date().toISOString();

    await db.financeCategories.add({
      id: 'cat-err',
      userId,
      name: 'Err Cat',
      slug: 'err-cat',
      type: 'expense',
      icon: 'Tag',
      color: '#f00',
      monthlyBudgetLimit: 100,
      subcategories: [],
      order: 0,
      isSystem: false,
      archived: false,
      isDirty: true,
      createdAt: now,
      updatedAt: now,
    });

    const result = await syncer.sync(userId);
    expect(result.status).toBe('partial_failure');
    // The failed item remains dirty for next retry
    const cat = await db.financeCategories.get('cat-err');
    expect(cat?.isDirty).toBe(true);
  });
});
