import { create } from 'zustand';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getSyncEngine } from '@/lib/sync';
import { deduplicateFinanceRecordsInDexie } from '@/lib/sync/engines/finance-sync';
import { CrossDomainActionMediator } from './mediator';
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceTransaction,
  FinanceBudget,
  MonthlyCommitment,
  CommitmentLedgerSummary,
  CommitmentContributionType,
  DebtRecord,
  DebtInstallment,
  DebtPaymentMethod,
  EmiTracker,
  FinanceSipPlan,
  FinanceCategorizationRule,
  FinanceRecurringBill,
  NetWorthSummary,
  DailyPacePoint,
  MonthlyFinanceSummary,
  CategorySpendItem,
  FinancialObligationItem,
  FinanceTransactionFormData,
  FinanceFilterState,
} from '@/lib/types';

export function getCurrentMonthKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getPreviousMonthKey(monthKey: string): string {
  const [yStr, mStr] = monthKey.split('-');
  let year = parseInt(yStr, 10);
  let month = parseInt(mStr, 10) - 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function formatINR(amount: number, showDecimals = false): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(absAmount);
  return isNegative ? `-${formatted}` : formatted;
}

export const DEFAULT_FINANCE_CATEGORIES: Array<
  Omit<FinanceCategory, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
> = [
  {
    name: 'Food & Dining',
    slug: 'food-dining',
    type: 'expense',
    icon: 'Utensils',
    color: '#f97316',
    monthlyBudgetLimit: 0,
    subcategories: ['Restaurants', 'Cafe & Coffee', 'Online Delivery', 'Snacks'],
    order: 0,
    isSystem: true,
    archived: false,
  },
  {
    name: 'Groceries',
    slug: 'groceries-household',
    type: 'expense',
    icon: 'ShoppingBasket',
    color: '#10b981',
    monthlyBudgetLimit: 0,
    subcategories: ['Vegetables & Dairy', 'Supermarket', 'Household Essentials'],
    order: 1,
    isSystem: true,
    archived: false,
  },
  {
    name: 'Health & Supplements',
    slug: 'medical-supplements',
    type: 'expense',
    icon: 'HeartPulse',
    color: '#06b6d4',
    monthlyBudgetLimit: 0,
    subcategories: ['Whey / Protein', 'Vitamins', 'Pharmacy', 'Doctor Visits'],
    order: 2,
    isSystem: true,
    archived: false,
  },
  {
    name: 'Bills & Utilities',
    slug: 'utilities-bills',
    type: 'expense',
    icon: 'Zap',
    color: '#eab308',
    monthlyBudgetLimit: 0,
    subcategories: ['Electricity Bill', 'Wi-Fi / Broadband', 'Mobile Recharge', 'Water & Gas'],
    order: 3,
    isSystem: true,
    archived: false,
  },
  {
    name: 'Family & Gifts',
    slug: 'family-commitments',
    type: 'expense',
    icon: 'HeartHandshake',
    color: '#ec4899',
    monthlyBudgetLimit: 0,
    subcategories: ['Family Support', 'Family Purchases', 'Gifts'],
    order: 4,
    isSystem: true,
    archived: false,
  },
  {
    name: 'Shopping',
    slug: 'shopping-personal-care',
    type: 'expense',
    icon: 'ShoppingBag',
    color: '#a855f7',
    monthlyBudgetLimit: 0,
    subcategories: ['Clothing', 'Personal Care', 'Electronics'],
    order: 5,
    isSystem: true,
    archived: false,
  },
  {
    name: 'Transport',
    slug: 'transport-fuel',
    type: 'expense',
    icon: 'Car',
    color: '#3b82f6',
    monthlyBudgetLimit: 0,
    subcategories: ['Fuel', 'Cab / Auto', 'Metro / Train', 'Maintenance'],
    order: 6,
    isSystem: true,
    archived: false,
  },
  {
    name: 'EMIs & Repayments',
    slug: 'emis-debt-repayment',
    type: 'expense',
    icon: 'Landmark',
    color: '#ef4444',
    monthlyBudgetLimit: 0,
    subcategories: ['Loan EMI', 'Credit Card Bill', 'Friend Repayment'],
    order: 7,
    isSystem: true,
    archived: false,
  },
  {
    name: 'Entertainment',
    slug: 'entertainment-subscriptions',
    type: 'expense',
    icon: 'Film',
    color: '#8b5cf6',
    monthlyBudgetLimit: 0,
    subcategories: ['Subscriptions', 'Gym Membership', 'Movies & Outings'],
    order: 8,
    isSystem: true,
    archived: false,
  },
  {
    name: 'Savings & Income',
    slug: 'investments-savings',
    type: 'both',
    icon: 'TrendingUp',
    color: '#14b8a6',
    monthlyBudgetLimit: 0,
    subcategories: ['SIP / Mutual Funds', 'Savings', 'Salary / Income'],
    order: 9,
    isSystem: true,
    archived: false,
  },
];

const INITIAL_FILTERS: FinanceFilterState = {
  searchQuery: '',
  type: 'all',
  categoryId: 'all',
  accountId: 'all',
  commitmentId: 'all',
  debtId: 'all',
  tag: 'all',
  needsReview: 'all',
};

interface FinanceStore {
  currentUserId: string | null;
  categories: FinanceCategory[];
  accounts: FinanceAccount[];
  transactions: FinanceTransaction[];
  budgets: FinanceBudget[];
  commitments: MonthlyCommitment[];
  debtRecords: DebtRecord[];
  debtInstallments: DebtInstallment[];
  emiTrackers: EmiTracker[];
  sipPlans: FinanceSipPlan[];
  categorizationRules: FinanceCategorizationRule[];
  recurringBills: FinanceRecurringBill[];
  selectedMonth: string; // YYYY-MM
  filters: FinanceFilterState;
  isLoading: boolean;
  error: string | null;

  // Core Lifecycle
  loadFinanceData: (customUserId?: string) => Promise<void>;
  seedInitialFinanceData: (userId: string) => Promise<void>;
  resetAllFinanceData: (keepCategories?: boolean) => Promise<void>;
  setSelectedMonth: (monthKey: string) => void;
  setFilters: (filters: Partial<FinanceFilterState>) => void;
  resetFilters: () => void;

  // Transactions
  addTransaction: (data: FinanceTransactionFormData) => Promise<FinanceTransaction>;
  updateTransaction: (id: string, data: Partial<FinanceTransactionFormData>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  approveReviewedTransaction: (id: string) => Promise<void>;
  bulkUpdateTransactions: (
    ids: string[],
    updates: Partial<Pick<FinanceTransaction, 'categoryId' | 'needsReview' | 'tags'>>
  ) => Promise<void>;
  bulkDeleteTransactions: (ids: string[]) => Promise<void>;
  splitTransactionWithFriend: (params: {
    txData: FinanceTransactionFormData;
    friendName: string;
    friendShareAmount: number;
    existingDebtId?: string;
  }) => Promise<{ transaction: FinanceTransaction; debt: DebtRecord }>;
  importTransactionsCsv: (
    csvText: string,
    defaultAccountId?: string
  ) => Promise<{ importedCount: number; skippedCount: number }>;
  attachTransactionToCommitment: (
    transactionId: string,
    commitmentId: string | null,
    contributionType?: CommitmentContributionType
  ) => Promise<void>;

  // Monthly Commitments ("Mother's ₹3,000 Tracker")
  addCommitment: (
    data: Omit<MonthlyCommitment, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<MonthlyCommitment>;
  updateCommitment: (id: string, data: Partial<MonthlyCommitment>) => Promise<void>;
  deleteCommitment: (id: string) => Promise<void>;
  settleCommitmentBalance: (
    commitmentId: string,
    accountId?: string,
    monthKey?: string
  ) => Promise<FinanceTransaction | null>;

  // Lend & Borrow ("Friends ₹2,000 Partial Repayment Ledger")
  addDebtRecord: (
    data: Omit<
      DebtRecord,
      'id' | 'userId' | 'totalRepaidAmount' | 'remainingAmount' | 'status' | 'createdAt' | 'updatedAt'
    >
  ) => Promise<DebtRecord>;
  recordDebtInstallment: (params: {
    debtId: string;
    amount: number;
    date?: string;
    paymentMethod: DebtPaymentMethod;
    accountId?: string;
    categoryId?: string;
    note?: string;
  }) => Promise<DebtInstallment | null>;
  topUpDebt: (debtId: string, additionalAmount: number, note?: string) => Promise<void>;
  deleteDebtRecord: (id: string) => Promise<void>;

  // EMI Amortization Tracker
  addEmiTracker: (
    data: Omit<EmiTracker, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<EmiTracker>;
  payMonthlyEmi: (
    emiId: string,
    accountId?: string,
    date?: string
  ) => Promise<FinanceTransaction | null>;
  deleteEmiTracker: (id: string) => Promise<void>;

  // SIP Plans (Investments)
  addSipPlan: (
    data: Omit<FinanceSipPlan, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<FinanceSipPlan>;
  updateSipPlan: (id: string, data: Partial<FinanceSipPlan>) => Promise<void>;
  deleteSipPlan: (id: string) => Promise<void>;
  payMonthlySip: (
    sipId: string,
    accountId?: string,
    date?: string
  ) => Promise<FinanceTransaction | null>;

  // Recurring Bills / Subscriptions
  addRecurringBill: (
    data: Omit<FinanceRecurringBill, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<FinanceRecurringBill>;
  updateRecurringBill: (id: string, data: Partial<FinanceRecurringBill>) => Promise<void>;
  deleteRecurringBill: (id: string) => Promise<void>;
  payRecurringBill: (
    billId: string,
    accountId?: string,
    date?: string
  ) => Promise<FinanceTransaction | null>;

  // Smart Categorization Rules
  addCategorizationRule: (
    data: Omit<FinanceCategorizationRule, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<FinanceCategorizationRule>;
  deleteCategorizationRule: (id: string) => Promise<void>;
  applyCategorizationRules: (rawTextOrMerchant: string) => {
    rule?: FinanceCategorizationRule;
    categoryId?: string;
    cleanMerchantName?: string;
    tags?: string[];
  };

  // Accounts, Categories & Budgets
  addAccount: (
    data: Omit<FinanceAccount, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<FinanceAccount>;
  updateAccount: (id: string, data: Partial<FinanceAccount>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  addCategory: (
    data: Omit<FinanceCategory, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<FinanceCategory>;
  updateCategory: (id: string, data: Partial<FinanceCategory>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  updateCategoryBudget: (categoryId: string, monthlyBudgetLimit: number) => Promise<void>;
  setMonthlyBudget: (
    monthKey: string,
    totalBudget: number,
    expectedIncome?: number,
    plannedSipAmount?: number
  ) => Promise<void>;
  saveMonthlyBudgetSettings: (
    monthKey: string,
    totalBudget: number,
    categoryLimits: Record<string, number>,
    options?: {
      expectedIncome?: number;
      plannedSipAmount?: number;
      categoryRollovers?: Record<string, boolean>;
    }
  ) => Promise<void>;
  exportTransactionsCsv: (monthKey?: string) => string;

  // Selectors
  getMonthlySummary: (monthKey?: string) => MonthlyFinanceSummary;
  getNetWorthSummary: () => NetWorthSummary;
  getDailySpendingPace: (monthKey?: string) => DailyPacePoint[];
  getCommitmentLedger: (commitmentId: string, monthKey?: string) => CommitmentLedgerSummary | null;
  getAllCommitmentLedgers: (monthKey?: string) => CommitmentLedgerSummary[];
  getDebtSummary: () => {
    totalBorrowedRemaining: number;
    totalLentRemaining: number;
    netPosition: number;
    plannedInstallmentsThisMonth: number;
    activeBorrowedCount: number;
    activeLentCount: number;
  };
  getDebtInstallments: (debtId: string) => DebtInstallment[];
  getUpcomingFinancialObligations: (withinDays?: number) => FinancialObligationItem[];
  getFilteredTransactions: (monthKey?: string) => FinanceTransaction[];
  getSixMonthSpendingTrends: (
    endMonthKey?: string,
    categoryId?: string
  ) => SixMonthTrendPoint[];
  getYearlySpendingTrends: (
    endMonthKey?: string,
    categoryId?: string,
    yearCount?: number
  ) => SixMonthTrendPoint[];
}

export interface SixMonthTrendPoint {
  monthKey: string;
  label: string;
  fullLabel: string;
  spent: number;
  budget: number;
  variance: number;
  isOverBudget: boolean;
}

export async function resolveCurrentUserId(
  customUserId?: string,
  storeUserId?: string | null
): Promise<string> {
  if (customUserId && customUserId !== 'local-demo-user') return customUserId;
  try {
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user.id;
  } catch {
    // Non-blocking
  }
  if (storeUserId && storeUserId !== 'local-demo-user') return storeUserId;
  return 'local-demo-user';
}

function notifyFinanceSync() {
  try {
    const syncEngine = getSyncEngine();
    syncEngine.triggerFinanceSync();
  } catch {
    // Non-blocking in offline / test environments
  }
}

async function migrateLocalDemoFinanceRecords(targetUserId: string) {
  try {
    const demoUserId = 'local-demo-user';
    const tables = [
      db.financeCategories,
      db.financeAccounts,
      db.financeTransactions,
      db.financeBudgets,
      db.monthlyCommitments,
      db.debtRecords,
      db.debtInstallments,
      db.emiTrackers,
      ...(db.financeSipPlans ? [db.financeSipPlans] : []),
      ...(db.financeCategorizationRules ? [db.financeCategorizationRules] : []),
      ...(db.financeRecurringBills ? [db.financeRecurringBills] : []),
    ];

    let migratedAny = false;
    for (const table of tables) {
      const demoRecords = await table.where('userId').equals(demoUserId).toArray();
      if (demoRecords.length > 0) {
        migratedAny = true;
        for (const item of demoRecords) {
          await table.update(item.id, {
            userId: targetUserId,
            isDirty: true,
            generationCounter: (item.generationCounter || 1) + 1,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    if (migratedAny) {
      notifyFinanceSync();
    }
  } catch (err) {
    console.warn('[FinanceStore] Demo records migration error:', err);
  }
}

export const useFinanceStore = create<FinanceStore>((set, get) => ({
  currentUserId: null,
  categories: [],
  accounts: [],
  transactions: [],
  budgets: [],
  commitments: [],
  debtRecords: [],
  debtInstallments: [],
  emiTrackers: [],
  sipPlans: [],
  categorizationRules: [],
  recurringBills: [],
  selectedMonth: getCurrentMonthKey(),
  filters: INITIAL_FILTERS,
  isLoading: true,
  error: null,

  setSelectedMonth: (monthKey) => set({ selectedMonth: monthKey }),

  setFilters: (newFilters) =>
    set((state) => ({ filters: { ...state.filters, ...newFilters } })),

  resetFilters: () => set({ filters: INITIAL_FILTERS }),

  seedInitialFinanceData: async (userId: string) => {
    const existingCats = await db.financeCategories.where('userId').equals(userId).toArray();
    const existingAccs = await db.financeAccounts.where('userId').equals(userId).toArray();
    if (existingCats.length > 0 && existingAccs.length > 0) return;

    const existingSlugs = new Set(existingCats.map((c) => c.slug).filter(Boolean));
    const existingAccKeys = new Set(
      existingAccs.map((a) => `${a.name.trim().toLowerCase()}_${a.type}`)
    );

    const now = new Date().toISOString();

    // 1. Seed Clean Categories (only if user has 0 categories, avoiding any slug duplicate)
    if (existingCats.length === 0) {
      const categories: FinanceCategory[] = DEFAULT_FINANCE_CATEGORIES
        .filter((c) => !existingSlugs.has(c.slug))
        .map((c) => ({
          ...c,
          id: crypto.randomUUID(),
          userId,
          isDirty: true,
          generationCounter: 1,
          createdAt: now,
          updatedAt: now,
        }));
      if (categories.length > 0) {
        await db.financeCategories.bulkAdd(categories);
      }
    }

    // 2. Seed Clean ₹0 Starter Accounts (only if user has 0 accounts, avoiding any name+type duplicate)
    if (existingAccs.length === 0) {
      const starterAccounts: FinanceAccount[] = ([
        {
          id: crypto.randomUUID(),
          userId,
          name: 'UPI',
          type: 'upi' as const,
          balance: 0,
          currency: 'INR',
          color: '#10b981',
          icon: 'Smartphone',
          isDefault: true,
          archived: false,
          isDirty: true,
          generationCounter: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: crypto.randomUUID(),
          userId,
          name: 'Bank Account',
          type: 'bank' as const,
          balance: 0,
          currency: 'INR',
          color: '#3b82f6',
          icon: 'Landmark',
          isDefault: false,
          archived: false,
          isDirty: true,
          generationCounter: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: crypto.randomUUID(),
          userId,
          name: 'Cash',
          type: 'cash' as const,
          balance: 0,
          currency: 'INR',
          color: '#f59e0b',
          icon: 'Banknote',
          isDefault: false,
          archived: false,
          isDirty: true,
          generationCounter: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: crypto.randomUUID(),
          userId,
          name: 'Credit Card',
          type: 'credit_card' as const,
          balance: 0,
          currency: 'INR',
          color: '#8b5cf6',
          icon: 'CreditCard',
          isDefault: false,
          archived: false,
          isDirty: true,
          generationCounter: 1,
          createdAt: now,
          updatedAt: now,
        },
      ] as FinanceAccount[]).filter((a) => !existingAccKeys.has(`${a.name.trim().toLowerCase()}_${a.type}`));

      if (starterAccounts.length > 0) {
        await db.financeAccounts.bulkAdd(starterAccounts);
      }
    }

    if (userId !== 'local-demo-user') {
      notifyFinanceSync();
    }
  },

  resetAllFinanceData: async (keepCategories = true) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();

    await Promise.all([
      db.financeTransactions.where('userId').equals(userId).delete(),
      db.financeBudgets.where('userId').equals(userId).delete(),
      db.monthlyCommitments.where('userId').equals(userId).delete(),
      db.debtRecords.where('userId').equals(userId).delete(),
      db.debtInstallments.where('userId').equals(userId).delete(),
      db.emiTrackers.where('userId').equals(userId).delete(),
      db.financeSipPlans ? db.financeSipPlans.where('userId').equals(userId).delete() : Promise.resolve(),
      db.financeCategorizationRules
        ? db.financeCategorizationRules.where('userId').equals(userId).delete()
        : Promise.resolve(),
      db.financeRecurringBills
        ? db.financeRecurringBills.where('userId').equals(userId).delete()
        : Promise.resolve(),
    ]);

    // Reset all account balances to ₹0 and normalize sample names if present
    const userAccounts = await db.financeAccounts.where('userId').equals(userId).toArray();
    const sampleNameMap: Record<string, string> = {
      'GPay / HDFC UPI': 'UPI',
      'HDFC Salary Account': 'Bank Account',
      'Cash in Wallet': 'Cash',
      'ICICI Amazon Pay Card': 'Credit Card',
    };
    for (const acc of userAccounts) {
      await db.financeAccounts.update(acc.id, {
        balance: 0,
        name: sampleNameMap[acc.name] || acc.name,
        updatedAt: now,
      });
    }

    if (!keepCategories) {
      await db.financeCategories.where('userId').equals(userId).delete();
    } else {
      const cats = await db.financeCategories.where('userId').equals(userId).toArray();
      for (const cat of cats) {
        await db.financeCategories.update(cat.id, {
          monthlyBudgetLimit: 0,
          updatedAt: now,
        });
      }
    }

    await get().loadFinanceData(userId);
  },

  loadFinanceData: async (customUserId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const userId = await resolveCurrentUserId(customUserId, get().currentUserId);

      // Auto-migrate orphaned local-demo-user records to this authenticated user account
      if (userId && userId !== 'local-demo-user') {
        await migrateLocalDemoFinanceRecords(userId);
      }

      // One-time cleanup: purge legacy pre-seeded sample records while preserving categories
      if (typeof window !== 'undefined') {
        const migrationKey = `flowfinance_fresh_start_v2_${userId}`;
        if (!window.localStorage.getItem(migrationKey)) {
          const existingCats = await db.financeCategories.where('userId').equals(userId).count();
          if (existingCats > 0) {
            const sampleAccs = await db.financeAccounts.where('userId').equals(userId).toArray();
            const hasLegacySampleData =
              sampleAccs.some((a) =>
                ['GPay / HDFC UPI', 'HDFC Salary Account', 'ICICI Amazon Pay Card'].includes(a.name)
              ) ||
              (await db.financeTransactions
                .where('userId')
                .equals(userId)
                .filter((t) =>
                  [
                    'Lakme Matte Lipstick for Mother',
                    'Home Electricity Bill (Paid for Mother)',
                    'Optimum Nutrition Gold Standard Whey Protein (2lb)',
                    'Monthly Salary Credit',
                  ].includes(t.title)
                )
                .count()) > 0;

            if (hasLegacySampleData) {
              const now = new Date().toISOString();
              await Promise.all([
                db.financeTransactions.where('userId').equals(userId).delete(),
                db.financeBudgets.where('userId').equals(userId).delete(),
                db.monthlyCommitments.where('userId').equals(userId).delete(),
                db.debtRecords.where('userId').equals(userId).delete(),
                db.debtInstallments.where('userId').equals(userId).delete(),
                db.emiTrackers.where('userId').equals(userId).delete(),
              ]);
              const sampleNameMap: Record<string, string> = {
                'GPay / HDFC UPI': 'UPI',
                'HDFC Salary Account': 'Bank Account',
                'Cash in Wallet': 'Cash',
                'ICICI Amazon Pay Card': 'Credit Card',
              };
              for (const acc of sampleAccs) {
                await db.financeAccounts.update(acc.id, {
                  balance: 0,
                  name: sampleNameMap[acc.name] || acc.name,
                  updatedAt: now,
                });
              }
              const cats = await db.financeCategories.where('userId').equals(userId).toArray();
              for (const cat of cats) {
                await db.financeCategories.update(cat.id, {
                  monthlyBudgetLimit: 0,
                  updatedAt: now,
                });
              }
            }
          }
          window.localStorage.setItem(migrationKey, '1');
        }
      }

      await deduplicateFinanceRecordsInDexie(userId);

      await get().seedInitialFinanceData(userId);

      const [
        categories,
        accounts,
        transactions,
        budgets,
        commitments,
        debtRecords,
        debtInstallments,
        emiTrackers,
        sipPlans,
        categorizationRules,
        recurringBills,
      ] = await Promise.all([
        db.financeCategories
          .where('userId')
          .equals(userId)
          .filter((c) => !c.archived && !c.deletedAt)
          .sortBy('order'),
        db.financeAccounts
          .where('userId')
          .equals(userId)
          .filter((a) => !a.archived && !a.deletedAt)
          .toArray(),
        db.financeTransactions
          .where('userId')
          .equals(userId)
          .filter((t) => !t.deletedAt)
          .reverse()
          .sortBy('date'),
        db.financeBudgets
          .where('userId')
          .equals(userId)
          .filter((b) => !b.deletedAt)
          .toArray(),
        db.monthlyCommitments
          .where('userId')
          .equals(userId)
          .filter((c) => !c.deletedAt)
          .toArray(),
        db.debtRecords
          .where('userId')
          .equals(userId)
          .filter((d) => !d.deletedAt)
          .toArray(),
        db.debtInstallments
          .where('userId')
          .equals(userId)
          .filter((i) => !i.deletedAt)
          .reverse()
          .sortBy('date'),
        db.emiTrackers
          .where('userId')
          .equals(userId)
          .filter((e) => !e.deletedAt)
          .toArray(),
        db.financeSipPlans
          ? db.financeSipPlans
              .where('userId')
              .equals(userId)
              .filter((s) => !s.deletedAt)
              .toArray()
          : Promise.resolve([]),
        db.financeCategorizationRules
          ? db.financeCategorizationRules
              .where('userId')
              .equals(userId)
              .filter((r) => !r.deletedAt)
              .toArray()
          : Promise.resolve([]),
        db.financeRecurringBills
          ? db.financeRecurringBills
              .where('userId')
              .equals(userId)
              .filter((b) => !b.deletedAt)
              .toArray()
          : Promise.resolve([]),
      ]);

      // In-memory safety guard: ensure no duplicate category slugs or account (name, type)
      const uniqueCategories: FinanceCategory[] = [];
      const seenCategorySlugs = new Set<string>();
      for (const cat of categories) {
        const key = cat.slug || cat.id;
        if (seenCategorySlugs.has(key)) continue;
        seenCategorySlugs.add(key);
        uniqueCategories.push(cat);
      }

      const uniqueAccounts: FinanceAccount[] = [];
      const seenAccountKeys = new Set<string>();
      for (const acc of accounts) {
        const key = `${acc.name.trim().toLowerCase()}_${acc.type}`;
        if (seenAccountKeys.has(key)) continue;
        seenAccountKeys.add(key);
        uniqueAccounts.push(acc);
      }

      set({
        currentUserId: userId,
        categories: uniqueCategories,
        accounts: uniqueAccounts,
        transactions,
        budgets,
        commitments,
        debtRecords,
        debtInstallments,
        emiTrackers,
        sipPlans,
        categorizationRules,
        recurringBills,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load finance data',
        isLoading: false,
      });
    }
  },

  addTransaction: async (data) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();
    const monthKey = data.date.slice(0, 7);

    const tx: FinanceTransaction = {
      id: crypto.randomUUID(),
      userId,
      title: data.title.trim(),
      amount: Number(data.amount),
      type: data.type,
      categoryId: data.categoryId,
      subcategory: data.subcategory,
      accountId: data.accountId,
      toAccountId: data.toAccountId,
      date: data.date,
      monthKey,
      notes: data.notes?.trim(),
      tags: data.tags || [],
      isRecurring: data.isRecurring ?? false,
      recurrenceRule: data.recurrenceRule,
      linkedCommitmentId: data.linkedCommitmentId || null,
      commitmentContributionType: data.linkedCommitmentId
        ? data.commitmentContributionType || 'offset_expense'
        : null,
      linkedDebtId: data.linkedDebtId || null,
      linkedDebtInstallmentId: null,
      linkedEmiId: data.linkedEmiId || null,
      linkedSipId: data.linkedSipId || null,
      merchantName: data.merchantName?.trim(),
      rawMerchant: data.rawMerchant?.trim(),
      needsReview: data.needsReview ?? false,
      splitGroupId: data.splitGroupId || null,
      isDirty: true,
      generationCounter: 1,
      createdAt: now,
      updatedAt: now,
    };

    // Update account balance
    const account = get().accounts.find((a) => a.id === data.accountId);
    if (account) {
      const delta =
        data.type === 'income'
          ? tx.amount
          : data.type === 'expense'
          ? -tx.amount
          : -tx.amount;
      const newBalance = account.balance + delta;
      await db.financeAccounts.update(account.id, { balance: newBalance, isDirty: true, updatedAt: now });
    }

    if (data.type === 'transfer' && data.toAccountId) {
      const toAcc = get().accounts.find((a) => a.id === data.toAccountId);
      if (toAcc) {
        await db.financeAccounts.update(toAcc.id, {
          balance: toAcc.balance + tx.amount,
          isDirty: true,
          updatedAt: now,
        });
      }
    }

    // If linked to a Friend Debt record, automatically log a DebtInstallment and update DebtRecord
    if (tx.linkedDebtId) {
      const debt = get().debtRecords.find((d) => d.id === tx.linkedDebtId);
      if (debt) {
        const newRepaid = debt.totalRepaidAmount + tx.amount;
        const newRemaining = Math.max(0, debt.principalAmount - newRepaid);
        const newStatus = newRemaining <= 0 ? 'settled' : 'active';
        const installmentId = crypto.randomUUID();
        tx.linkedDebtInstallmentId = installmentId;

        const installment: DebtInstallment = {
          id: installmentId,
          userId,
          debtId: debt.id,
          amount: tx.amount,
          date: tx.date,
          monthKey: tx.monthKey,
          paymentMethod: 'offset_expense',
          transactionId: tx.id,
          note: tx.title,
          balanceAfterPayment: newRemaining,
          isDirty: true,
          generationCounter: 1,
          createdAt: now,
          updatedAt: now,
        };

        await db.debtInstallments.add(installment);
        await db.debtRecords.update(debt.id, {
          totalRepaidAmount: newRepaid,
          remainingAmount: newRemaining,
          status: newStatus,
          isDirty: true,
          updatedAt: now,
        });
      }
    }

    await db.financeTransactions.add(tx);
    await get().loadFinanceData(userId);
    notifyFinanceSync();

    // Notify when category monthly spending exceeds 90% of its defined budget
    if (tx.type === 'expense') {
      const cat = get().categories.find((c) => c.id === tx.categoryId);
      if (cat && cat.monthlyBudgetLimit > 0) {
        const spent = get()
          .transactions.filter(
            (item) =>
              item.type === 'expense' &&
              item.categoryId === cat.id &&
              item.monthKey === tx.monthKey
          )
          .reduce((sum, item) => sum + item.amount, 0);
        const pct = (spent / cat.monthlyBudgetLimit) * 100;
        if (pct > 90) {
          const roundedPct = Math.round(pct);
          const toastId = `budget-alert-${cat.id}-${tx.monthKey}`;
          if (pct >= 100) {
            toast.error(
              `Budget Exceeded: ${cat.name} reached ${roundedPct}% of monthly limit`,
              {
                id: toastId,
                description: `${formatINR(spent)} spent of ${formatINR(cat.monthlyBudgetLimit)} budget.`,
                duration: 6000,
              }
            );
          } else {
            toast.warning(
              `Budget Alert: ${cat.name} crossed ${roundedPct}% of monthly budget`,
              {
                id: toastId,
                description: `${formatINR(spent)} spent · ${formatINR(
                  Math.max(0, cat.monthlyBudgetLimit - spent)
                )} left of ${formatINR(cat.monthlyBudgetLimit)}.`,
                duration: 6000,
              }
            );
          }
        }
      }
    }

    // Trigger Gamification & Habit Auto-Completion (+10 XP for logging expense)
    try {
      await CrossDomainActionMediator.onFinanceEvent({
        type: 'EXPENSE_LOGGED',
        date: tx.date,
        amount: tx.amount,
      });
    } catch {
      // Non-blocking gamification hook
    }

    return tx;
  },

  updateTransaction: async (id, data) => {
    const existing = get().transactions.find((t) => t.id === id);
    if (!existing) return;
    const userId = existing.userId;
    const now = new Date().toISOString();

    // If amount or account changed, adjust account balance
    if (data.amount !== undefined && data.amount !== existing.amount) {
      const account = get().accounts.find((a) => a.id === existing.accountId);
      if (account) {
        const diff = data.amount - existing.amount;
        const balanceAdjustment = existing.type === 'income' ? diff : -diff;
        await db.financeAccounts.update(account.id, {
          balance: account.balance + balanceAdjustment,
          updatedAt: now,
        });
      }
    }

    const updatedDate = data.date || existing.date;
    const updatedFields: Partial<FinanceTransaction> = {
      ...data,
      monthKey: updatedDate.slice(0, 7),
      isDirty: true,
      updatedAt: now,
    };

    await db.financeTransactions.update(id, updatedFields);
    await get().loadFinanceData(userId);
    notifyFinanceSync();

    const updatedType = data.type || existing.type;
    const updatedCategoryId = data.categoryId || existing.categoryId;
    const updatedMonthKey = updatedDate.slice(0, 7);
    if (updatedType === 'expense') {
      const cat = get().categories.find((c) => c.id === updatedCategoryId);
      if (cat && cat.monthlyBudgetLimit > 0) {
        const spent = get()
          .transactions.filter(
            (item) =>
              item.type === 'expense' &&
              item.categoryId === cat.id &&
              item.monthKey === updatedMonthKey
          )
          .reduce((sum, item) => sum + item.amount, 0);
        const pct = (spent / cat.monthlyBudgetLimit) * 100;
        if (pct > 90) {
          const roundedPct = Math.round(pct);
          const toastId = `budget-alert-${cat.id}-${updatedMonthKey}`;
          if (pct >= 100) {
            toast.error(
              `Budget Exceeded: ${cat.name} reached ${roundedPct}% of monthly limit`,
              {
                id: toastId,
                description: `${formatINR(spent)} spent of ${formatINR(cat.monthlyBudgetLimit)} budget.`,
                duration: 6000,
              }
            );
          } else {
            toast.warning(
              `Budget Alert: ${cat.name} crossed ${roundedPct}% of monthly budget`,
              {
                id: toastId,
                description: `${formatINR(spent)} spent · ${formatINR(
                  Math.max(0, cat.monthlyBudgetLimit - spent)
                )} left of ${formatINR(cat.monthlyBudgetLimit)}.`,
                duration: 6000,
              }
            );
          }
        }
      }
    }
  },

  deleteTransaction: async (id) => {
    const existing = get().transactions.find((t) => t.id === id);
    if (!existing) return;
    const userId = existing.userId;
    const now = new Date().toISOString();

    // Reverse account balance impact
    const account = get().accounts.find((a) => a.id === existing.accountId);
    if (account) {
      const reverseDelta = existing.type === 'income' ? -existing.amount : existing.amount;
      await db.financeAccounts.update(account.id, {
        balance: account.balance + reverseDelta,
        updatedAt: now,
      });
    }

    if (existing.type === 'transfer' && existing.toAccountId) {
      const toAcc = get().accounts.find((a) => a.id === existing.toAccountId);
      if (toAcc) {
        await db.financeAccounts.update(toAcc.id, {
          balance: toAcc.balance - existing.amount,
          updatedAt: now,
        });
      }
    }

    // Reverse linked debt installment if present
    if (existing.linkedDebtId && existing.linkedDebtInstallmentId) {
      const debt = get().debtRecords.find((d) => d.id === existing.linkedDebtId);
      if (debt) {
        const newRepaid = Math.max(0, debt.totalRepaidAmount - existing.amount);
        const newRemaining = Math.max(0, debt.principalAmount - newRepaid);
        await db.debtRecords.update(debt.id, {
          totalRepaidAmount: newRepaid,
          remainingAmount: newRemaining,
          status: newRemaining > 0 ? 'active' : 'settled',
          updatedAt: now,
        });
      }
      await db.debtInstallments.update(existing.linkedDebtInstallmentId, {
        deletedAt: now,
        updatedAt: now,
      });
    }

    await db.financeTransactions.update(id, { deletedAt: now, isDirty: true, updatedAt: now });
    await get().loadFinanceData(userId);
    notifyFinanceSync();
  },

  approveReviewedTransaction: async (id) => {
    const existing = get().transactions.find((t) => t.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    await db.financeTransactions.update(id, {
      needsReview: false,
      isDirty: true,
      updatedAt: now,
    });
    await get().loadFinanceData(existing.userId);
    notifyFinanceSync();
  },

  bulkUpdateTransactions: async (ids, updates) => {
    if (ids.length === 0) return;
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();

    await db.transaction('rw', db.financeTransactions, async () => {
      for (const id of ids) {
        await db.financeTransactions.update(id, {
          ...updates,
          isDirty: true,
          updatedAt: now,
        });
      }
    });

    await get().loadFinanceData(userId);
    notifyFinanceSync();
  },

  bulkDeleteTransactions: async (ids) => {
    for (const id of ids) {
      await get().deleteTransaction(id);
    }
  },

  splitTransactionWithFriend: async ({
    txData,
    friendName,
    friendShareAmount,
    existingDebtId,
  }) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();
    const totalOutflow = Number(txData.amount);
    const friendPortion = Math.max(0, Math.min(totalOutflow, Number(friendShareAmount)));
    const myShare = Math.max(0, totalOutflow - friendPortion);
    const splitGroupId = crypto.randomUUID();

    // 1. Log user's share as an expense (deducting full outflow from account so wallet balance reflects reality)
    const tx = await get().addTransaction({
      ...txData,
      amount: myShare,
      splitGroupId,
      notes: `${txData.notes ? txData.notes + ' · ' : ''}Split with ${friendName} (Your share: ${formatINR(
        myShare
      )}, ${friendName} owes: ${formatINR(friendPortion)})`,
      tags: Array.from(new Set([...(txData.tags || []), 'split', friendName.toLowerCase()])),
    });

    // Deduct the friend's share from the paying account as well since the user paid the full bill upfront
    if (friendPortion > 0) {
      const account = get().accounts.find((a) => a.id === txData.accountId);
      if (account) {
        await db.financeAccounts.update(account.id, {
          balance: account.balance - friendPortion,
          updatedAt: now,
        });
      }
    }

    // 2. Create or top up a Lent DebtRecord for the friend
    let debtRecord: DebtRecord | undefined;
    if (existingDebtId) {
      debtRecord = get().debtRecords.find((d) => d.id === existingDebtId);
    } else {
      debtRecord = get().debtRecords.find(
        (d) =>
          d.direction === 'lent' &&
          d.status === 'active' &&
          d.personName.toLowerCase() === friendName.trim().toLowerCase()
      );
    }

    if (debtRecord && friendPortion > 0) {
      await get().topUpDebt(
        debtRecord.id,
        friendPortion,
        `Split: ${txData.title} (${txData.date})`
      );
      debtRecord = get().debtRecords.find((d) => d.id === debtRecord!.id);
    } else if (friendPortion > 0) {
      debtRecord = await get().addDebtRecord({
        personName: friendName.trim(),
        direction: 'lent',
        title: `Split: ${txData.title}`,
        principalAmount: friendPortion,
        startDate: txData.date,
        repaymentSchedule: 'flexible',
        color: '#10b981',
        notes: `Created from split expense "${txData.title}" on ${txData.date}`,
      });
    } else {
      debtRecord = await get().addDebtRecord({
        personName: friendName.trim(),
        direction: 'lent',
        title: `Split: ${txData.title}`,
        principalAmount: 0,
        startDate: txData.date,
        repaymentSchedule: 'flexible',
        color: '#10b981',
      });
    }

    await get().loadFinanceData(userId);
    return { transaction: tx, debt: debtRecord! };
  },

  importTransactionsCsv: async (csvText, defaultAccountId) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return { importedCount: 0, skippedCount: 0 };

    const parseCsvLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const dateIdx = headers.findIndex((h) => h.includes('date'));
    const titleIdx = headers.findIndex(
      (h) =>
        h.includes('title') ||
        h.includes('description') ||
        h.includes('narration') ||
        h.includes('merchant') ||
        h.includes('particular')
    );
    const amountIdx = headers.findIndex((h) => h.includes('amount') || h.includes('value'));
    const typeIdx = headers.findIndex((h) => h.includes('type') || h.includes('cr/dr'));
    const catIdx = headers.findIndex((h) => h.includes('category'));

    const fallbackAccount =
      (defaultAccountId && get().accounts.find((a) => a.id === defaultAccountId)) ||
      get().accounts.find((a) => a.isDefault) ||
      get().accounts[0];
    const fallbackCategory = get().categories[0];

    if (!fallbackAccount || !fallbackCategory) {
      return { importedCount: 0, skippedCount: lines.length - 1 };
    }

    let importedCount = 0;
    let skippedCount = 0;
    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 2) {
        skippedCount++;
        continue;
      }

      const rawTitle = (titleIdx >= 0 ? cols[titleIdx] : cols[1]) || 'Imported Entry';
      const rawAmountStr = (amountIdx >= 0 ? cols[amountIdx] : cols[2] || '').replace(
        /[^0-9.-]/g,
        ''
      );
      const parsedAmount = Math.abs(parseFloat(rawAmountStr));
      if (!parsedAmount || isNaN(parsedAmount)) {
        skippedCount++;
        continue;
      }

      let dateStr = todayStr;
      if (dateIdx >= 0 && cols[dateIdx]) {
        const candidate = cols[dateIdx].trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(candidate)) {
          dateStr = candidate.slice(0, 10);
        } else {
          const d = new Date(candidate);
          if (!isNaN(d.getTime())) {
            dateStr = d.toISOString().split('T')[0];
          }
        }
      }

      // Deduplicate against existing transactions on same date + amount + title
      const duplicate = get().transactions.some(
        (t) =>
          t.date === dateStr &&
          Math.abs(t.amount - parsedAmount) < 0.01 &&
          t.title.toLowerCase() === rawTitle.toLowerCase()
      );
      if (duplicate) {
        skippedCount++;
        continue;
      }

      const rawType = (typeIdx >= 0 ? cols[typeIdx] : '').toLowerCase();
      const txType: FinanceTransaction['type'] =
        rawType.includes('inc') || rawType.includes('cr')
          ? 'income'
          : rawType.includes('inv') || rawType.includes('sip')
          ? 'investment'
          : 'expense';

      // Check categorization rules first
      const ruleMatch = get().applyCategorizationRules(rawTitle);
      let categoryId = ruleMatch.categoryId;

      if (!categoryId && catIdx >= 0 && cols[catIdx]) {
        const matchedCat = get().categories.find(
          (c) => c.name.toLowerCase() === cols[catIdx].toLowerCase()
        );
        if (matchedCat) categoryId = matchedCat.id;
      }

      await get().addTransaction({
        title: ruleMatch.cleanMerchantName || rawTitle,
        rawMerchant: rawTitle,
        merchantName: ruleMatch.cleanMerchantName,
        amount: parsedAmount,
        type: txType,
        categoryId: categoryId || fallbackCategory.id,
        accountId: fallbackAccount.id,
        date: dateStr,
        needsReview: !ruleMatch.rule,
        tags: ruleMatch.tags || ['csv-import'],
      });
      importedCount++;
    }

    await get().loadFinanceData(userId);
    return { importedCount, skippedCount };
  },

  attachTransactionToCommitment: async (
    transactionId,
    commitmentId,
    contributionType = 'offset_expense'
  ) => {
    const existing = get().transactions.find((t) => t.id === transactionId);
    if (!existing) return;
    const now = new Date().toISOString();

    await db.financeTransactions.update(transactionId, {
      linkedCommitmentId: commitmentId,
      commitmentContributionType: commitmentId ? contributionType : null,
      isDirty: true,
      updatedAt: now,
    });

    await get().loadFinanceData(existing.userId);
    notifyFinanceSync();
  },

  addCommitment: async (data) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();
    const commitment: MonthlyCommitment = {
      ...data,
      id: crypto.randomUUID(),
      userId,
      isDirty: true,
      generationCounter: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.monthlyCommitments.add(commitment);
    await get().loadFinanceData(userId);
    notifyFinanceSync();
    return commitment;
  },

  updateCommitment: async (id, data) => {
    const existing = get().commitments.find((c) => c.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    await db.monthlyCommitments.update(id, { ...data, isDirty: true, updatedAt: now });
    await get().loadFinanceData(existing.userId);
    notifyFinanceSync();
  },

  deleteCommitment: async (id) => {
    const existing = get().commitments.find((c) => c.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    await db.monthlyCommitments.update(id, { isActive: false, deletedAt: now, isDirty: true, updatedAt: now });
    await get().loadFinanceData(existing.userId);
    notifyFinanceSync();
  },

  settleCommitmentBalance: async (commitmentId, accountId, monthKey) => {
    const targetMonth = monthKey || get().selectedMonth;
    const ledger = get().getCommitmentLedger(commitmentId, targetMonth);
    if (!ledger || ledger.remainingBalance <= 0) return null;

    const defaultAccount =
      (accountId && get().accounts.find((a) => a.id === accountId)) ||
      get().accounts.find((a) => a.isDefault) ||
      get().accounts[0];

    const familyCat =
      get().categories.find((c) => c.slug === 'family-commitments') || get().categories[0];

    if (!defaultAccount || !familyCat) return null;

    const todayStr = new Date().toISOString().split('T')[0];
    const txDate = todayStr.startsWith(targetMonth) ? todayStr : `${targetMonth}-28`;

    const tx = await get().addTransaction({
      title: `Final Balance Transfer to ${ledger.commitment.recipientName} (${targetMonth})`,
      amount: ledger.remainingBalance,
      type: 'expense',
      categoryId: ledger.commitment.defaultCategoryId || familyCat.id,
      subcategory: 'Parental Allowance',
      accountId: defaultAccount.id,
      date: txDate,
      notes: `Settled remaining balance of ${formatINR(ledger.remainingBalance)} after ${formatINR(
        ledger.offsetExpensesAmount
      )} in offset purchases/bills`,
      tags: ['commitment-settlement', ledger.commitment.recipientName.toLowerCase()],
      linkedCommitmentId: commitmentId,
      commitmentContributionType: 'direct_payment',
    });

    try {
      await CrossDomainActionMediator.onFinanceEvent({
        type: 'COMMITMENT_SETTLED',
        date: txDate,
        amount: ledger.remainingBalance,
      });
    } catch {
      // Non-blocking
    }

    return tx;
  },

  addDebtRecord: async (data) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();
    const record: DebtRecord = {
      ...data,
      id: crypto.randomUUID(),
      userId,
      totalRepaidAmount: 0,
      remainingAmount: Number(data.principalAmount),
      status: 'active',
      isDirty: true,
      generationCounter: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.debtRecords.add(record);
    await get().loadFinanceData(userId);
    notifyFinanceSync();
    return record;
  },

  recordDebtInstallment: async ({
    debtId,
    amount,
    date,
    paymentMethod,
    accountId,
    categoryId,
    note,
  }) => {
    const debt = get().debtRecords.find((d) => d.id === debtId);
    if (!debt || amount <= 0) return null;

    const userId = debt.userId;
    const now = new Date().toISOString();
    const txDate = date || now.split('T')[0];
    const monthKey = txDate.slice(0, 7);

    const newRepaid = debt.totalRepaidAmount + Number(amount);
    const newRemaining = Math.max(0, debt.principalAmount - newRepaid);
    const newStatus = newRemaining <= 0 ? 'settled' : 'active';

    const selectedAccount =
      (accountId && get().accounts.find((a) => a.id === accountId)) ||
      get().accounts.find((a) => a.isDefault) ||
      get().accounts[0];

    const debtCat =
      (categoryId && get().categories.find((c) => c.id === categoryId)) ||
      get().categories.find((c) => c.slug === 'emis-debt-repayment') ||
      get().categories[0];

    const installmentId = crypto.randomUUID();
    const transactionId = crypto.randomUUID();

    if (selectedAccount && debtCat) {
      const txType = debt.direction === 'borrowed' ? 'expense' : 'income';
      const tx: FinanceTransaction = {
        id: transactionId,
        userId,
        title:
          debt.direction === 'borrowed'
            ? `Debt Installment Paid to ${debt.personName}`
            : `Debt Repayment Received from ${debt.personName}`,
        amount: Number(amount),
        type: txType,
        categoryId: debtCat.id,
        subcategory: 'Friend Debt Repayment',
        accountId: selectedAccount.id,
        date: txDate,
        monthKey,
        notes:
          note ||
          `Partial installment (${formatINR(amount)}). Remaining balance: ${formatINR(newRemaining)}`,
        tags: ['debt-installment', debt.personName.toLowerCase()],
        isRecurring: false,
        linkedDebtId: debt.id,
        linkedDebtInstallmentId: installmentId,
        isDirty: true,
        generationCounter: 1,
        createdAt: now,
        updatedAt: now,
      };

      await db.financeTransactions.add(tx);

      const balanceDelta = txType === 'income' ? Number(amount) : -Number(amount);
      await db.financeAccounts.update(selectedAccount.id, {
        balance: selectedAccount.balance + balanceDelta,
        isDirty: true,
        updatedAt: now,
      });
    }

    const installment: DebtInstallment = {
      id: installmentId,
      userId,
      debtId: debt.id,
      amount: Number(amount),
      date: txDate,
      monthKey,
      paymentMethod,
      transactionId: selectedAccount && debtCat ? transactionId : null,
      note: note || `Installment payment (${paymentMethod.toUpperCase()})`,
      balanceAfterPayment: newRemaining,
      isDirty: true,
      generationCounter: 1,
      createdAt: now,
      updatedAt: now,
    };

    await db.debtInstallments.add(installment);
    await db.debtRecords.update(debt.id, {
      totalRepaidAmount: newRepaid,
      remainingAmount: newRemaining,
      status: newStatus,
      isDirty: true,
      updatedAt: now,
    });

    await get().loadFinanceData(userId);
    notifyFinanceSync();

    try {
      await CrossDomainActionMediator.onFinanceEvent({
        type: newStatus === 'settled' ? 'COMMITMENT_SETTLED' : 'EXPENSE_LOGGED',
        date: txDate,
        amount: Number(amount),
      });
    } catch {
      // Non-blocking
    }

    return installment;
  },

  topUpDebt: async (debtId, additionalAmount, note) => {
    const debt = get().debtRecords.find((d) => d.id === debtId);
    if (!debt || additionalAmount <= 0) return;

    const now = new Date().toISOString();
    const newPrincipal = debt.principalAmount + Number(additionalAmount);
    const newRemaining = Math.max(0, newPrincipal - debt.totalRepaidAmount);

    await db.debtRecords.update(debtId, {
      principalAmount: newPrincipal,
      remainingAmount: newRemaining,
      status: 'active',
      isDirty: true,
      notes: note
        ? `${debt.notes ? debt.notes + ' | ' : ''}Top-up +${formatINR(additionalAmount)}: ${note}`
        : debt.notes,
      updatedAt: now,
    });

    await get().loadFinanceData(debt.userId);
    notifyFinanceSync();
  },

  deleteDebtRecord: async (id) => {
    const debt = get().debtRecords.find((d) => d.id === id);
    if (!debt) return;
    const now = new Date().toISOString();
    const installments = await db.debtInstallments.where('debtId').equals(id).toArray();
    for (const inst of installments) {
      await db.debtInstallments.update(inst.id, { deletedAt: now, isDirty: true, updatedAt: now });
    }
    await db.debtRecords.update(id, { status: 'archived', deletedAt: now, isDirty: true, updatedAt: now });
    await get().loadFinanceData(debt.userId);
    notifyFinanceSync();
  },

  addEmiTracker: async (data) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();
    const emi: EmiTracker = {
      ...data,
      id: crypto.randomUUID(),
      userId,
      isDirty: true,
      generationCounter: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.emiTrackers.add(emi);
    await get().loadFinanceData(userId);
    notifyFinanceSync();
    return emi;
  },

  payMonthlyEmi: async (emiId, accountId, date) => {
    const emi = get().emiTrackers.find((e) => e.id === emiId);
    if (!emi || emi.status !== 'active') return null;

    const now = new Date().toISOString();
    const txDate = date || now.split('T')[0];
    const monthKey = txDate.slice(0, 7);

    const newPaidMonths = Math.min(emi.tenureMonths, emi.paidMonths + 1);
    const newStatus = newPaidMonths >= emi.tenureMonths ? 'completed' : 'active';

    const defaultAccount =
      (accountId && get().accounts.find((a) => a.id === accountId)) ||
      (emi.accountId && get().accounts.find((a) => a.id === emi.accountId)) ||
      get().accounts.find((a) => a.isDefault) ||
      get().accounts[0];

    const emiCat =
      get().categories.find((c) => c.id === emi.categoryId) ||
      get().categories.find((c) => c.slug === 'emis-debt-repayment') ||
      get().categories[0];

    await db.emiTrackers.update(emiId, {
      paidMonths: newPaidMonths,
      lastPaidMonthKey: monthKey,
      status: newStatus,
      updatedAt: now,
    });

    let createdTx: FinanceTransaction | null = null;
    if (defaultAccount && emiCat) {
      createdTx = await get().addTransaction({
        title: `${emi.loanName} — EMI #${newPaidMonths}/${emi.tenureMonths}`,
        amount: emi.emiAmount,
        type: 'expense',
        categoryId: emiCat.id,
        subcategory: 'Loan EMI',
        accountId: defaultAccount.id,
        date: txDate,
        notes: `Paid monthly EMI to ${emi.lenderName} (${newPaidMonths} of ${emi.tenureMonths} months completed)`,
        tags: ['emi', emi.lenderName.toLowerCase()],
        linkedEmiId: emi.id,
      });
    } else {
      await get().loadFinanceData(emi.userId);
    }

    try {
      await CrossDomainActionMediator.onFinanceEvent({
        type: 'EMI_PAID',
        date: txDate,
        amount: emi.emiAmount,
      });
    } catch {
      // Non-blocking
    }

    return createdTx;
  },

  deleteEmiTracker: async (id) => {
    const emi = get().emiTrackers.find((e) => e.id === id);
    if (!emi) return;
    const now = new Date().toISOString();
    await db.emiTrackers.update(id, { deletedAt: now, isDirty: true, updatedAt: now });
    await get().loadFinanceData(emi.userId);
    notifyFinanceSync();
  },

  // ============================================
  // SIP PLANS (INVESTMENTS)
  // ============================================

  addSipPlan: async (data) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();
    const sip: FinanceSipPlan = {
      ...data,
      id: crypto.randomUUID(),
      userId,
      isDirty: true,
      generationCounter: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.financeSipPlans.add(sip);
    await get().loadFinanceData(userId);
    notifyFinanceSync();
    return sip;
  },

  updateSipPlan: async (id, data) => {
    const existing = get().sipPlans.find((s) => s.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    await db.financeSipPlans.update(id, { ...data, isDirty: true, updatedAt: now });
    await get().loadFinanceData(existing.userId);
    notifyFinanceSync();
  },

  deleteSipPlan: async (id) => {
    const existing = get().sipPlans.find((s) => s.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    await db.financeSipPlans.update(id, { isActive: false, deletedAt: now, isDirty: true, updatedAt: now });
    await get().loadFinanceData(existing.userId);
    notifyFinanceSync();
  },

  payMonthlySip: async (sipId, accountId, date) => {
    const sip = get().sipPlans.find((s) => s.id === sipId);
    if (!sip || !sip.isActive) return null;

    const now = new Date().toISOString();
    const txDate = date || now.split('T')[0];
    const monthKey = txDate.slice(0, 7);

    const newTotalInvested = sip.totalInvested + sip.monthlyAmount;
    const newCurrentValue = Math.max(newTotalInvested, sip.currentValue + sip.monthlyAmount);

    await db.financeSipPlans.update(sipId, {
      totalInvested: newTotalInvested,
      currentValue: newCurrentValue,
      lastInvestedMonthKey: monthKey,
      updatedAt: now,
    });

    const defaultAccount =
      (accountId && get().accounts.find((a) => a.id === accountId)) ||
      (sip.accountId && get().accounts.find((a) => a.id === sip.accountId)) ||
      get().accounts.find((a) => a.isDefault) ||
      get().accounts[0];

    const investCat =
      (sip.categoryId && get().categories.find((c) => c.id === sip.categoryId)) ||
      get().categories.find((c) => c.slug === 'investments-savings') ||
      get().categories[0];

    let createdTx: FinanceTransaction | null = null;
    if (defaultAccount && investCat) {
      createdTx = await get().addTransaction({
        title: `SIP Investment — ${sip.name}`,
        amount: sip.monthlyAmount,
        type: 'investment',
        categoryId: investCat.id,
        subcategory: 'SIP / Mutual Funds',
        accountId: defaultAccount.id,
        date: txDate,
        notes: `${sip.platform ? sip.platform + ' · ' : ''}Total Invested: ${formatINR(
          newTotalInvested
        )}`,
        tags: ['sip', 'investment', sip.assetClass],
        linkedSipId: sip.id,
      });
    } else {
      await get().loadFinanceData(sip.userId);
    }

    try {
      await CrossDomainActionMediator.onFinanceEvent({
        type: 'SIP_COMPLETED',
        date: txDate,
        amount: sip.monthlyAmount,
      });
    } catch {
      // Non-blocking
    }

    return createdTx;
  },

  // ============================================
  // RECURRING BILLS & SUBSCRIPTIONS
  // ============================================

  addRecurringBill: async (data) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();
    const bill: FinanceRecurringBill = {
      ...data,
      id: crypto.randomUUID(),
      userId,
      createdAt: now,
      updatedAt: now,
    };
    await db.financeRecurringBills.add(bill);
    await get().loadFinanceData(userId);
    return bill;
  },

  updateRecurringBill: async (id, data) => {
    const existing = get().recurringBills.find((b) => b.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    const nextPayload: Partial<FinanceRecurringBill> = {
      ...data,
      updatedAt: now,
    };
    if (data.amount !== undefined && data.amount !== existing.amount) {
      nextPayload.previousAmount = existing.amount;
    }
    await db.financeRecurringBills.update(id, nextPayload);
    await get().loadFinanceData(existing.userId);
  },

  deleteRecurringBill: async (id) => {
    const existing = get().recurringBills.find((b) => b.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    await db.financeRecurringBills.update(id, { isActive: false, deletedAt: now, updatedAt: now });
    await get().loadFinanceData(existing.userId);
  },

  payRecurringBill: async (billId, accountId, date) => {
    const bill = get().recurringBills.find((b) => b.id === billId);
    if (!bill) return null;

    const now = new Date().toISOString();
    const txDate = date || now.split('T')[0];
    const monthKey = txDate.slice(0, 7);

    await db.financeRecurringBills.update(billId, {
      lastPaidMonthKey: monthKey,
      updatedAt: now,
    });

    const selectedAcc =
      (accountId && get().accounts.find((a) => a.id === accountId)) ||
      (bill.accountId && get().accounts.find((a) => a.id === bill.accountId)) ||
      get().accounts.find((a) => a.isDefault) ||
      get().accounts[0];

    const selectedCat =
      get().categories.find((c) => c.id === bill.categoryId) ||
      get().categories.find((c) => c.slug === 'utilities-bills') ||
      get().categories[0];

    if (!selectedAcc || !selectedCat) {
      await get().loadFinanceData(bill.userId);
      return null;
    }

    return get().addTransaction({
      title: bill.name,
      amount: bill.amount,
      type: 'expense',
      categoryId: selectedCat.id,
      subcategory: 'Recurring Bill',
      accountId: selectedAcc.id,
      date: txDate,
      tags: ['bill', bill.cadence],
      isRecurring: true,
    });
  },

  // ============================================
  // SMART CATEGORIZATION RULES
  // ============================================

  addCategorizationRule: async (data) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();
    const rule: FinanceCategorizationRule = {
      ...data,
      id: crypto.randomUUID(),
      userId,
      createdAt: now,
      updatedAt: now,
    };
    await db.financeCategorizationRules.add(rule);
    await get().loadFinanceData(userId);
    return rule;
  },

  deleteCategorizationRule: async (id) => {
    const existing = get().categorizationRules.find((r) => r.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    await db.financeCategorizationRules.update(id, {
      isActive: false,
      deletedAt: now,
      updatedAt: now,
    });
    await get().loadFinanceData(existing.userId);
  },

  applyCategorizationRules: (rawTextOrMerchant) => {
    const normalized = (rawTextOrMerchant || '').toLowerCase();
    if (!normalized) return {};

    const activeRules = get().categorizationRules.filter((r) => r.isActive && !r.deletedAt);
    for (const rule of activeRules) {
      const pattern = rule.matchPattern.toLowerCase().trim();
      if (pattern && normalized.includes(pattern)) {
        return {
          rule,
          categoryId: rule.categoryId,
          cleanMerchantName: rule.cleanMerchantName,
          tags: rule.defaultTags,
        };
      }
    }
    return {};
  },

  // ============================================
  // ACCOUNTS, CATEGORIES & BUDGETS
  // ============================================

  addAccount: async (data) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();
    const account: FinanceAccount = {
      ...data,
      id: crypto.randomUUID(),
      userId,
      isDirty: true,
      generationCounter: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.financeAccounts.add(account);
    await get().loadFinanceData(userId);
    notifyFinanceSync();
    return account;
  },

  updateAccount: async (id, data) => {
    const existing = get().accounts.find((a) => a.id === id);
    if (!existing) return;
    await db.financeAccounts.update(id, { ...data, isDirty: true, updatedAt: new Date().toISOString() });
    await get().loadFinanceData(existing.userId);
    notifyFinanceSync();
  },

  deleteAccount: async (id) => {
    const existing = get().accounts.find((a) => a.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    await db.financeAccounts.update(id, {
      archived: true,
      deletedAt: now,
      isDirty: true,
      updatedAt: now,
    });
    await get().loadFinanceData(existing.userId);
    notifyFinanceSync();
  },

  addCategory: async (data) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();
    const category: FinanceCategory = {
      ...data,
      id: crypto.randomUUID(),
      userId,
      isDirty: true,
      generationCounter: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.financeCategories.add(category);
    await get().loadFinanceData(userId);
    notifyFinanceSync();
    return category;
  },

  updateCategory: async (id, data) => {
    const existing = get().categories.find((c) => c.id === id);
    if (!existing) return;
    await db.financeCategories.update(id, {
      ...data,
      isDirty: true,
      updatedAt: new Date().toISOString(),
    });
    await get().loadFinanceData(existing.userId);
    notifyFinanceSync();
  },

  deleteCategory: async (id) => {
    const existing = get().categories.find((c) => c.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    await db.financeCategories.update(id, {
      archived: true,
      deletedAt: now,
      isDirty: true,
      updatedAt: now,
    });
    await get().loadFinanceData(existing.userId);
    notifyFinanceSync();
  },

  updateCategoryBudget: async (categoryId, monthlyBudgetLimit) => {
    const existing = get().categories.find((c) => c.id === categoryId);
    if (!existing) return;
    await db.financeCategories.update(categoryId, {
      monthlyBudgetLimit: Number(monthlyBudgetLimit),
      isDirty: true,
      updatedAt: new Date().toISOString(),
    });
    await get().loadFinanceData(existing.userId);
    notifyFinanceSync();
  },

  setMonthlyBudget: async (monthKey, totalBudget, expectedIncome, plannedSipAmount) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();
    const existing = get().budgets.find((b) => b.monthKey === monthKey && b.userId === userId);

    if (existing) {
      await db.financeBudgets.update(existing.id, {
        totalBudget: Number(totalBudget),
        expectedIncome:
          expectedIncome !== undefined ? Number(expectedIncome) : existing.expectedIncome,
        plannedSipAmount:
          plannedSipAmount !== undefined ? Number(plannedSipAmount) : existing.plannedSipAmount,
        isDirty: true,
        updatedAt: now,
      });
    } else {
      const budget: FinanceBudget = {
        id: crypto.randomUUID(),
        userId,
        monthKey,
        totalBudget: Number(totalBudget),
        expectedIncome: expectedIncome !== undefined ? Number(expectedIncome) : 0,
        plannedSipAmount: plannedSipAmount !== undefined ? Number(plannedSipAmount) : 0,
        currency: 'INR',
        isDirty: true,
        generationCounter: 1,
        createdAt: now,
        updatedAt: now,
      };
      await db.financeBudgets.add(budget);
    }

    await get().loadFinanceData(userId);
    notifyFinanceSync();
  },

  saveMonthlyBudgetSettings: async (monthKey, totalBudget, categoryLimits, options) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();

    for (const [categoryId, limit] of Object.entries(categoryLimits)) {
      const normalized = Math.max(0, Number(limit) || 0);
      const rolloverFlag = options?.categoryRollovers?.[categoryId];
      await db.financeCategories.update(categoryId, {
        monthlyBudgetLimit: normalized,
        ...(rolloverFlag !== undefined ? { rolloverEnabled: rolloverFlag } : {}),
        isDirty: true,
        updatedAt: now,
      });
    }

    const existing = get().budgets.find((b) => b.monthKey === monthKey && b.userId === userId);
    const normalizedTotal = Math.max(0, Number(totalBudget) || 0);
    const normalizedIncome =
      options?.expectedIncome !== undefined
        ? Math.max(0, Number(options.expectedIncome) || 0)
        : existing?.expectedIncome || 0;
    const normalizedSip =
      options?.plannedSipAmount !== undefined
        ? Math.max(0, Number(options.plannedSipAmount) || 0)
        : existing?.plannedSipAmount || 0;

    if (existing) {
      await db.financeBudgets.update(existing.id, {
        totalBudget: normalizedTotal,
        expectedIncome: normalizedIncome,
        plannedSipAmount: normalizedSip,
        isDirty: true,
        updatedAt: now,
      });
    } else if (normalizedTotal > 0 || normalizedIncome > 0 || normalizedSip > 0) {
      const budget: FinanceBudget = {
        id: crypto.randomUUID(),
        userId,
        monthKey,
        totalBudget: normalizedTotal,
        expectedIncome: normalizedIncome,
        plannedSipAmount: normalizedSip,
        currency: 'INR',
        isDirty: true,
        generationCounter: 1,
        createdAt: now,
        updatedAt: now,
      };
      await db.financeBudgets.add(budget);
    }

    await get().loadFinanceData(userId);
    notifyFinanceSync();
  },

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

  // ============================================
  // COMPUTED SELECTORS
  // ============================================

  getNetWorthSummary: () => {
    const accounts = get().accounts.filter((a) => !a.archived && !a.deletedAt && a.includeInNetWorth !== false);
    const liquidAssets = accounts
      .filter((a) => a.type === 'bank' || a.type === 'upi' || a.type === 'cash' || a.type === 'wallet')
      .reduce((sum, a) => sum + Math.max(0, a.balance), 0);

    const investmentAccountAssets = accounts
      .filter((a) => a.type === 'investment')
      .reduce((sum, a) => sum + Math.max(0, a.balance), 0);

    const sipCorpus = get()
      .sipPlans.filter((s) => s.isActive && !s.deletedAt)
      .reduce((sum, s) => sum + Math.max(s.currentValue || 0, s.totalInvested || 0), 0);

    const investmentAssets = investmentAccountAssets + sipCorpus;

    const debtSummary = get().getDebtSummary();
    const friendReceivables = debtSummary.totalLentRemaining;
    const friendPayables = debtSummary.totalBorrowedRemaining;

    // Credit card balance can be stored as negative (from expense deductions) or positive outstanding due
    const creditCardLiabilities = accounts
      .filter((a) => a.type === 'credit_card')
      .reduce((sum, a) => sum + Math.abs(a.balance), 0);

    const emiRemainingPrincipal = get()
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

    // Calculate rollover from previous month if autoRolloverOverpayment is enabled
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
    const targetMonth = monthKey || get().selectedMonth;
    const prevMonth = getPreviousMonthKey(targetMonth);
    const monthTransactions = get().transactions.filter(
      (t) => t.monthKey === targetMonth && !t.deletedAt
    );
    const prevMonthExpenses = get().transactions.filter(
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

    // 1. Remaining Unpaid Monthly Commitments
    const commitmentLedgers = get().getAllCommitmentLedgers(targetMonth);
    const remainingUnpaidCommitments = commitmentLedgers.reduce(
      (sum, l) => sum + l.remainingBalance,
      0
    );

    // 2. Remaining Unpaid EMIs this month
    const unpaidEmis = get().emiTrackers.filter((emi) => {
      if (emi.status !== 'active' || emi.paidMonths >= emi.tenureMonths || emi.deletedAt) return false;
      const paidTxExists = expenseTransactions.some((t) => t.linkedEmiId === emi.id);
      return emi.lastPaidMonthKey !== targetMonth && !paidTxExists;
    });
    const remainingUnpaidEmis = unpaidEmis.reduce((sum, e) => sum + e.emiAmount, 0);

    // 3. Planned Debt Installments still due this month
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
      const stillDue = Math.max(0, planned - paidThisMonth);
      plannedDebtInstallmentsDue += stillDue;
    }

    // 4. Remaining Unpaid Recurring Bills this month
    const unpaidBills = get().recurringBills.filter(
      (b) => b.isActive && !b.deletedAt && b.lastPaidMonthKey !== targetMonth
    );
    const remainingUnpaidBills = unpaidBills.reduce((sum, b) => sum + b.amount, 0);

    // 5. Remaining Planned SIPs this month
    const activeSips = get().sipPlans.filter(
      (s) => s.isActive && !s.deletedAt && s.lastInvestedMonthKey !== targetMonth
    );
    const remainingActiveSipsSum = activeSips.reduce((sum, s) => sum + s.monthlyAmount, 0);
    const plannedSipTarget = budgetObj?.plannedSipAmount || 0;
    const remainingPlannedSips = Math.max(
      remainingActiveSipsSum,
      Math.max(0, plannedSipTarget - totalInvested)
    );

    // Calculate Remaining Days & Day-of-Month Pacing
    const now = new Date();
    const [yStr, mStr] = targetMonth.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();
    const isCurrentMonth =
      now.getFullYear() === year && now.getMonth() + 1 === month;
    const remainingDaysInMonth = isCurrentMonth
      ? Math.max(1, daysInMonth - now.getDate() + 1)
      : daysInMonth;
    const dayOfMonthProgressPct = isCurrentMonth
      ? Math.round((now.getDate() / daysInMonth) * 100)
      : 100;

    // Safe-to-Spend Formula:
    // Uses MonthlyBudget (if set) OR ExpectedIncome as ceiling, minus spent and unpaid fixed obligations
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

    // Category Breakdown with Rollover & Pace Tick Delta
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
          // Only roll over if there was any activity in previous month
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
  },

  getDebtSummary: () => {
    const activeBorrowed = get().debtRecords.filter(
      (d) => d.direction === 'borrowed' && d.status === 'active' && !d.deletedAt
    );
    const activeLent = get().debtRecords.filter(
      (d) => d.direction === 'lent' && d.status === 'active' && !d.deletedAt
    );

    const totalBorrowedRemaining = activeBorrowed.reduce(
      (sum, d) => sum + d.remainingAmount,
      0
    );
    const totalLentRemaining = activeLent.reduce((sum, d) => sum + d.remainingAmount, 0);
    const netPosition = totalLentRemaining - totalBorrowedRemaining;

    const plannedInstallmentsThisMonth = activeBorrowed.reduce(
      (sum, d) => sum + Math.min(d.remainingAmount, d.plannedMonthlyInstallment || 0),
      0
    );

    return {
      totalBorrowedRemaining,
      totalLentRemaining,
      netPosition,
      plannedInstallmentsThisMonth,
      activeBorrowedCount: activeBorrowed.length,
      activeLentCount: activeLent.length,
    };
  },

  getDebtInstallments: (debtId) => {
    return get()
      .debtInstallments.filter((i) => i.debtId === debtId && !i.deletedAt)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  getUpcomingFinancialObligations: (withinDays = 7) => {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonthKey = getCurrentMonthKey(now);
    const obligations: FinancialObligationItem[] = [];

    const makeDueDateStr = (dayOfMonth: number) => {
      const paddedDay = String(Math.min(28, Math.max(1, dayOfMonth))).padStart(2, '0');
      return `${currentMonthKey}-${paddedDay}`;
    };

    // 1. Active Unpaid EMIs
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

    // 2. Active Monthly Commitments with Remaining Balance > 0
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

    // 3. Active Borrowed Debts with Planned Installment due
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

    // 4. Active Recurring Bills due
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

    // 5. Active SIPs due
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

    // 6. Credit Cards with outstanding balance and dueDay
    for (const acc of get().accounts) {
      if (
        acc.type !== 'credit_card' ||
        acc.archived ||
        acc.deletedAt ||
        Math.abs(acc.balance) <= 0
      )
        continue;
      const dueDay = acc.dueDay || 5;
      const daysUntilDue = dueDay - currentDay;
      if (daysUntilDue <= withinDays) {
        obligations.push({
          id: `cc-${acc.id}`,
          sourceId: acc.id,
          type: 'credit_card',
          title: `${acc.name} Bill Due`,
          subtitle: `Credit card statement balance`,
          amount: Math.abs(acc.balance),
          dueDate: makeDueDateStr(dueDay),
          daysUntilDue,
          isOverdue: daysUntilDue < 0,
          status: 'pending',
        });
      }
    }

    return obligations.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  },

  getFilteredTransactions: (monthKey) => {
    const targetMonth = monthKey || get().selectedMonth;
    const { filters, transactions } = get();

    return transactions.filter((tx) => {
      if (tx.deletedAt) return false;
      if (targetMonth !== 'all' && tx.monthKey !== targetMonth) return false;
      if (filters.type !== 'all' && tx.type !== filters.type) return false;
      if (filters.categoryId !== 'all' && tx.categoryId !== filters.categoryId) return false;
      if (filters.accountId !== 'all' && tx.accountId !== filters.accountId) return false;
      if (
        filters.commitmentId !== 'all' &&
        tx.linkedCommitmentId !== filters.commitmentId
      )
        return false;
      if (filters.debtId !== 'all' && tx.linkedDebtId !== filters.debtId) return false;
      if (filters.tag && filters.tag !== 'all' && !tx.tags.includes(filters.tag)) return false;
      if (filters.needsReview === 'only_review' && !tx.needsReview) return false;
      if (filters.dateFrom && tx.date < filters.dateFrom) return false;
      if (filters.dateTo && tx.date > filters.dateTo) return false;

      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const matchTitle = tx.title.toLowerCase().includes(q);
        const matchMerchant = tx.merchantName?.toLowerCase().includes(q) || false;
        const matchSub = tx.subcategory?.toLowerCase().includes(q) || false;
        const matchNotes = tx.notes?.toLowerCase().includes(q) || false;
        const matchTags = tx.tags.some((tag) => tag.toLowerCase().includes(q));
        if (!matchTitle && !matchMerchant && !matchSub && !matchNotes && !matchTags) return false;
      }

      return true;
    });
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
}));

