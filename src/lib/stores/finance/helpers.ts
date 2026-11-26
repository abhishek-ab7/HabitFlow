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
  FriendLedgerGroup,
  DebtSummaryBreakdown,
  EmiTracker,
  NetWorthSummary,
  DailyPacePoint,
  MonthlyFinanceSummary,
  FinancialObligationItem,
  CreditCardStatement,
  CreditCardCycleSummary,
} from '@/lib/types';

export type FinanceMonthKey = string;
export type FinanceUserId = string;

export function getCurrentMonthKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getPreviousMonthKey(monthKey: FinanceMonthKey): string {
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
  {
    name: 'Junk Food',
    slug: 'junk-food',
    type: 'expense',
    icon: 'Flame',
    color: '#f43f5e',
    monthlyBudgetLimit: 0,
    subcategories: ['Fast Food & Street', 'Desserts & Bakery', 'Sugary Drinks & Snacks'],
    order: 10,
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
  customUserId?: FinanceUserId,
  storeUserId?: FinanceUserId | null
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

function getDemoMigratableTables() {
  return [
    db.financeCategories,
    db.financeAccounts,
    db.financeTransactions,
    db.financeBudgets,
    db.monthlyCommitments,
    db.debtRecords,
    db.debtInstallments,
    db.emiTrackers,
    db.financeSipPlans,
    db.financeCategorizationRules,
    db.financeRecurringBills,
    db.financeNetWorthSnapshots,
    db.creditCardStatements,
  ].filter(Boolean);
}

async function migrateDemoTableRecords(params: {
  table: any;
  demoUserId: FinanceUserId;
  targetUserId: FinanceUserId;
}): Promise<boolean> {
  const { table, demoUserId, targetUserId } = params;
  const demoRecords = await table.where('userId').equals(demoUserId).toArray();
  if (demoRecords.length === 0) return false;
  const now = new Date().toISOString();
  for (const item of demoRecords) {
    await table.update(item.id, {
      userId: targetUserId,
      isDirty: true,
      generationCounter: (item.generationCounter || 1) + 1,
      updatedAt: now,
    });
  }
  return true;
}

export async function migrateLocalDemoFinanceRecords(targetUserId: FinanceUserId) {
  try {
    const results = await Promise.all(
      getDemoMigratableTables().map((table) =>
        migrateDemoTableRecords({ table, demoUserId: 'local-demo-user', targetUserId })
      )
    );
    if (results.some(Boolean)) notifyFinanceSync();
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
  creditCardStatements: CreditCardStatement[];
  selectedMonth: string; // YYYY-MM
  filters: FinanceFilterState;
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;

  // Core Lifecycle
  loadFinanceData: (customUserId?: FinanceUserId, force?: boolean) => Promise<void>;
  seedInitialFinanceData: (userId: FinanceUserId) => Promise<void>;
  resetAllFinanceData: (keepCategories?: boolean) => Promise<void>;
  setSelectedMonth: (monthKey: FinanceMonthKey) => void;
  setFilters: (filters: Partial<FinanceFilterState>) => void;
  resetFilters: () => void;

  // Transactions
  addTransaction: (data: FinanceTransactionFormData) => Promise<FinanceTransaction>;
  addSplitTransactions: (params: {
    base: Omit<FinanceTransactionFormData, 'amount' | 'categoryId'>;
    splits: Array<{ categoryId: FinanceUserId; amount: number; subcategory?: string; note?: string }>;
  }) => Promise<FinanceTransaction[]>;
  updateTransaction: (id: FinanceUserId, data: Partial<FinanceTransactionFormData>) => Promise<void>;
  deleteTransaction: (id: FinanceUserId) => Promise<void>;
  approveReviewedTransaction: (id: FinanceUserId) => Promise<void>;
  bulkUpdateTransactions: (
    ids: FinanceUserId[],
    updates: Partial<Pick<FinanceTransaction, 'categoryId' | 'needsReview' | 'tags'>>
  ) => Promise<void>;
  bulkDeleteTransactions: (ids: FinanceUserId[]) => Promise<void>;
  splitTransactionWithFriend: (params: {
    txData: FinanceTransactionFormData;
    friendName: FinanceUserId;
    friendShareAmount: number;
    existingDebtId?: FinanceUserId;
  }) => Promise<{ transaction: FinanceTransaction; debt: DebtRecord }>;
  importTransactionsCsv: (
    csvText: FinanceUserId,
    defaultAccountId?: FinanceUserId
  ) => Promise<{ importedCount: number; skippedCount: number }>;
  attachTransactionToCommitment: (
    transactionId: FinanceUserId,
    commitmentId: FinanceUserId | null,
    contributionType?: CommitmentContributionType
  ) => Promise<void>;

  // Monthly Commitments
  addCommitment: (
    data: Omit<MonthlyCommitment, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<MonthlyCommitment>;
  updateCommitment: (id: FinanceUserId, data: Partial<MonthlyCommitment>) => Promise<void>;
  deleteCommitment: (id: FinanceUserId) => Promise<void>;
  settleCommitmentBalance: (
    commitmentId: FinanceUserId,
    accountId?: FinanceUserId,
    monthKey?: FinanceMonthKey
  ) => Promise<FinanceTransaction | null>;

  // Lend & Borrow
  addDebtRecord: (
    data: Omit<
      DebtRecord,
      'id' | 'userId' | 'totalRepaidAmount' | 'remainingAmount' | 'status' | 'createdAt' | 'updatedAt'
    >
  ) => Promise<DebtRecord>;
  updateDebtRecord: (
    id: FinanceUserId,
    data: Partial<Omit<DebtRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ) => Promise<void>;
  recordDebtInstallment: (params: {
    debtId: FinanceUserId;
    amount: number;
    date?: FinanceMonthKey;
    paymentMethod: DebtPaymentMethod;
    accountId?: FinanceUserId;
    categoryId?: FinanceUserId;
    note?: FinanceUserId;
    splitGroupId?: FinanceUserId;
  }) => Promise<DebtInstallment | null>;
  updateDebtInstallment: (
    id: FinanceUserId,
    data: Partial<Pick<DebtInstallment, 'amount' | 'date' | 'paymentMethod' | 'note'>>
  ) => Promise<void>;
  deleteDebtInstallment: (id: FinanceUserId) => Promise<void>;
  topUpDebt: (debtId: FinanceUserId, additionalAmount: number, note?: FinanceUserId) => Promise<void>;
  deleteDebtRecord: (id: FinanceUserId) => Promise<void>;
  settleEverydayTab: (
    normalizedFriendName: FinanceUserId,
    options: {
      accountId?: FinanceUserId;
      paymentMethod: DebtPaymentMethod;
      date?: FinanceMonthKey;
      note?: FinanceUserId;
    }
  ) => Promise<FinanceTransaction | null>;
  offsetSplitAgainstLoan: (
    friendKey: FinanceUserId,
    loanId: FinanceUserId,
    amount: number
  ) => Promise<boolean>;

  // EMI Amortization Tracker
  addEmiTracker: (
    data: Omit<EmiTracker, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<EmiTracker>;
  updateEmiTracker: (
    id: FinanceUserId,
    data: Partial<Omit<EmiTracker, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ) => Promise<void>;
  payMonthlyEmi: (
    emiId: FinanceUserId,
    accountId?: FinanceUserId,
    date?: FinanceMonthKey
  ) => Promise<FinanceTransaction | null>;
  deleteEmiTracker: (id: FinanceUserId) => Promise<void>;

  // SIP Plans
  addSipPlan: (
    data: Omit<FinanceSipPlan, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<FinanceSipPlan>;
  updateSipPlan: (id: FinanceUserId, data: Partial<FinanceSipPlan>) => Promise<void>;
  deleteSipPlan: (id: FinanceUserId) => Promise<void>;
  payMonthlySip: (
    sipId: FinanceUserId,
    accountId?: FinanceUserId,
    date?: FinanceMonthKey
  ) => Promise<FinanceTransaction | null>;

  // Recurring Bills
  addRecurringBill: (
    data: Omit<FinanceRecurringBill, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<FinanceRecurringBill>;
  updateRecurringBill: (id: FinanceUserId, data: Partial<FinanceRecurringBill>) => Promise<void>;
  deleteRecurringBill: (id: FinanceUserId) => Promise<void>;
  payRecurringBill: (
    billId: FinanceUserId,
    accountId?: FinanceUserId,
    date?: FinanceMonthKey
  ) => Promise<FinanceTransaction | null>;

  // Smart Categorization Rules
  addCategorizationRule: (
    data: Omit<FinanceCategorizationRule, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<FinanceCategorizationRule>;
  updateCategorizationRule: (
    id: FinanceUserId,
    data: Partial<FinanceCategorizationRule>
  ) => Promise<void>;
  deleteCategorizationRule: (id: FinanceUserId) => Promise<void>;
  applyCategorizationRules: (rawTextOrMerchant: FinanceUserId) => {
    rule?: FinanceCategorizationRule;
    categoryId?: FinanceUserId;
    cleanMerchantName?: FinanceUserId;
    tags?: FinanceUserId[];
  };

  // Accounts, Categories, Budgets & Reconciliation
  addAccount: (
    data: Omit<FinanceAccount, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<FinanceAccount>;
  updateAccount: (id: FinanceUserId, data: Partial<FinanceAccount>) => Promise<void>;
  setDefaultAccount: (accountId: FinanceUserId) => Promise<void>;
  deleteAccount: (id: FinanceUserId) => Promise<void>;
  // Credit Card Statements & Multi-Card Engine
  syncCardStatements: (accountId?: FinanceUserId) => Promise<void>;
  payCreditCardBill: (params: {
    cardAccountId: FinanceUserId;
    fromAccountId: FinanceUserId;
    amount: number;
    date?: FinanceMonthKey;
    statementId?: FinanceUserId;
    note?: FinanceUserId;
  }) => Promise<FinanceTransaction>;
  reconcileCreditCardStatement: (params: {
    cardAccountId: FinanceUserId;
    cycleKey: FinanceMonthKey;
    actualStatementAmount: number;
    note?: FinanceUserId;
  }) => Promise<CreditCardStatement>;
  moveTransactionToCycle: (
    transactionId: FinanceUserId,
    targetCycleKey: FinanceMonthKey | null
  ) => Promise<void>;
  getCreditCardSummary: (
    accountId: FinanceUserId,
    referenceDate?: FinanceMonthKey
  ) => CreditCardCycleSummary | null;
  reconcileAccountBalance: (
    accountId: FinanceUserId,
    actualBalance: number,
    logAdjustmentTransaction?: boolean
  ) => Promise<{ variance: number; adjusted: boolean }>;
  recordCurrentNetWorthSnapshot: (monthKey?: FinanceMonthKey) => Promise<void>;
  addCategory: (
    data: Omit<FinanceCategory, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<FinanceCategory>;
  updateCategory: (id: FinanceUserId, data: Partial<FinanceCategory>) => Promise<void>;
  deleteCategory: (id: FinanceUserId) => Promise<void>;
  updateCategoryBudget: (categoryId: FinanceUserId, monthlyBudgetLimit: number) => Promise<void>;
  setMonthlyBudget: (
    monthKey: FinanceMonthKey,
    totalBudget: number,
    expectedIncome?: number,
    plannedSipAmount?: number
  ) => Promise<void>;
  saveMonthlyBudgetSettings: (
    monthKey: FinanceMonthKey,
    totalBudget: number,
    categoryLimits: Record<string, number>,
    options?: {
      expectedIncome?: number;
      plannedSipAmount?: number;
      paydayOfMonth?: number;
      categoryRollovers?: Record<string, boolean>;
      budgetMode?: FinanceBudgetMode;
      assignedIncome?: number;
    }
  ) => Promise<void>;
  exportTransactionsCsv: (monthKey?: FinanceMonthKey) => string;

  // Selectors
  getMonthlySummary: (monthKey?: FinanceMonthKey) => MonthlyFinanceSummary;
  getNetWorthSummary: () => NetWorthSummary;
  getNetWorthHistory: (months?: number) => Array<{
    monthKey: FinanceMonthKey;
    label: string;
    netWorth: number;
    totalAssets: number;
    totalLiabilities: number;
  }>;
  getDailySpendingPace: (monthKey?: FinanceMonthKey) => DailyPacePoint[];
  getCommitmentLedger: (commitmentId: FinanceUserId, monthKey?: FinanceMonthKey) => CommitmentLedgerSummary | null;
  getAllCommitmentLedgers: (monthKey?: FinanceMonthKey) => CommitmentLedgerSummary[];
  getFriendLedgerGroups: () => FriendLedgerGroup[];
  getDebtSummary: () => DebtSummaryBreakdown;
  getDebtInstallments: (debtId: FinanceUserId) => DebtInstallment[];
  getUpcomingFinancialObligations: (withinDays?: number) => FinancialObligationItem[];
  getFilteredTransactions: (monthKey?: FinanceMonthKey) => FinanceTransaction[];
  getSixMonthSpendingTrends: (
    endMonthKey?: FinanceMonthKey,
    categoryId?: FinanceUserId
  ) => SixMonthTrendPoint[];
  getYearlySpendingTrends: (
    endMonthKey?: FinanceMonthKey,
    categoryId?: FinanceUserId,
    yearCount?: number
  ) => SixMonthTrendPoint[];
  getCashFlowForecast: (
    horizonDays?: 30 | 60 | 90,
    includeDiscretionaryBurn?: boolean
  ) => CashFlowForecastResult;
  getSpendingAnomalies: (monthKey?: FinanceMonthKey) => FinanceAnomalyAlert[];
}

export type FinanceSliceCreator<T> = StateCreator<FinanceStore, [], [], T>;
