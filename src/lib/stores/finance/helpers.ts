import type { StateCreator } from 'zustand';
import { db } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getSyncEngine } from '@/lib/sync';
import type { CashFlowForecastResult } from '@/lib/finance/forecast';
import type {
  FinanceAccount,
  FinanceAnomalyAlert,
  FinanceBudget,
  FinanceBudgetMode,
  FinanceCategorizationRule,
  FinanceCategory,
  FinanceFilterState,
  FinanceNetWorthSnapshot,
  FinanceRecurringBill,
  FinanceSipPlan,
  FinanceTransaction,
  FinanceTransactionFormData,
  MonthlyCommitment,
  CommitmentLedgerSummary,
  CommitmentContributionType,
  DebtRecord,
  DebtInstallment,
  DebtPaymentMethod,
  EmiTracker,
  NetWorthSummary,
  DailyPacePoint,
  MonthlyFinanceSummary,
  FinancialObligationItem,
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

export interface SixMonthTrendPoint {
  monthKey: string;
  label: string;
  fullLabel: string;
  spent: number;
  budget: number;
  variance: number;
  isOverBudget: boolean;
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

export const INITIAL_FILTERS: FinanceFilterState = {
  searchQuery: '',
  type: 'all',
  categoryId: 'all',
  accountId: 'all',
  commitmentId: 'all',
  debtId: 'all',
  tag: 'all',
  needsReview: 'all',
};

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

export function notifyFinanceSync() {
  try {
    const syncEngine = getSyncEngine();
    syncEngine.triggerFinanceSync();
  } catch {
    // Non-blocking in offline / test environments
  }
}

export async function migrateLocalDemoFinanceRecords(targetUserId: string) {
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
      ...(db.financeNetWorthSnapshots ? [db.financeNetWorthSnapshots] : []),
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

export interface FinanceStore {
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
  netWorthSnapshots: FinanceNetWorthSnapshot[];
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
  addSplitTransactions: (params: {
    base: Omit<FinanceTransactionFormData, 'amount' | 'categoryId'>;
    splits: Array<{ categoryId: string; amount: number; subcategory?: string; note?: string }>;
  }) => Promise<FinanceTransaction[]>;
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

  // Monthly Commitments
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

  // Lend & Borrow
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

  // SIP Plans
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

  // Recurring Bills
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
  updateCategorizationRule: (
    id: string,
    data: Partial<FinanceCategorizationRule>
  ) => Promise<void>;
  deleteCategorizationRule: (id: string) => Promise<void>;
  applyCategorizationRules: (rawTextOrMerchant: string) => {
    rule?: FinanceCategorizationRule;
    categoryId?: string;
    cleanMerchantName?: string;
    tags?: string[];
  };

  // Accounts, Categories, Budgets & Reconciliation
  addAccount: (
    data: Omit<FinanceAccount, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<FinanceAccount>;
  updateAccount: (id: string, data: Partial<FinanceAccount>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  reconcileAccountBalance: (
    accountId: string,
    actualBalance: number,
    logAdjustmentTransaction?: boolean
  ) => Promise<{ variance: number; adjusted: boolean }>;
  recordCurrentNetWorthSnapshot: (monthKey?: string) => Promise<void>;
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
      budgetMode?: FinanceBudgetMode;
      assignedIncome?: number;
    }
  ) => Promise<void>;
  exportTransactionsCsv: (monthKey?: string) => string;

  // Selectors
  getMonthlySummary: (monthKey?: string) => MonthlyFinanceSummary;
  getNetWorthSummary: () => NetWorthSummary;
  getNetWorthHistory: (months?: number) => Array<{
    monthKey: string;
    label: string;
    netWorth: number;
    totalAssets: number;
    totalLiabilities: number;
  }>;
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
  getCashFlowForecast: (
    horizonDays?: 30 | 60 | 90,
    includeDiscretionaryBurn?: boolean
  ) => CashFlowForecastResult;
  getSpendingAnomalies: (monthKey?: string) => FinanceAnomalyAlert[];
}

export type FinanceSliceCreator<T> = StateCreator<FinanceStore, [], [], T>;
