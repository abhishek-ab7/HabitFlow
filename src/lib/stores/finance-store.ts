import { create } from 'zustand';
import { db } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getSyncEngine } from '@/lib/sync';
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
    monthlyBudgetLimit: 6000,
    subcategories: ['Restaurants', 'Cafe & Coffee', 'Swiggy / Zomato', 'Snacks'],
    order: 0,
    isSystem: true,
    archived: false,
  },
  {
    name: 'Groceries & Household',
    slug: 'groceries-household',
    type: 'expense',
    icon: 'ShoppingBasket',
    color: '#10b981',
    monthlyBudgetLimit: 7000,
    subcategories: ['Vegetables & Dairy', 'Supermarket', 'Cleaning & Essentials'],
    order: 1,
    isSystem: true,
    archived: false,
  },
  {
    name: 'Medical & Supplements',
    slug: 'medical-supplements',
    type: 'expense',
    icon: 'HeartPulse',
    color: '#06b6d4',
    monthlyBudgetLimit: 4500,
    subcategories: ['Whey / Protein', 'Vitamins & Creatine', 'Pharmacy', 'Doctor Visits'],
    order: 2,
    isSystem: true,
    archived: false,
  },
  {
    name: 'Utilities & Bills',
    slug: 'utilities-bills',
    type: 'expense',
    icon: 'Zap',
    color: '#eab308',
    monthlyBudgetLimit: 4500,
    subcategories: ['Electricity Bill', 'Wi-Fi / Broadband', 'Mobile Recharge', 'Water & Gas'],
    order: 3,
    isSystem: true,
    archived: false,
  },
  {
    name: 'Family & Commitments',
    slug: 'family-commitments',
    type: 'expense',
    icon: 'HeartHandshake',
    color: '#ec4899',
    monthlyBudgetLimit: 5000,
    subcategories: ['Parental Allowance', 'Family Purchases', 'Gifts & Festivals'],
    order: 4,
    isSystem: true,
    archived: false,
  },
  {
    name: 'Shopping & Personal Care',
    slug: 'shopping-personal-care',
    type: 'expense',
    icon: 'ShoppingBag',
    color: '#a855f7',
    monthlyBudgetLimit: 5000,
    subcategories: ['Clothing', 'Cosmetics / Lipstick', 'Skincare & Grooming', 'Electronics'],
    order: 5,
    isSystem: true,
    archived: false,
  },
  {
    name: 'Transport & Fuel',
    slug: 'transport-fuel',
    type: 'expense',
    icon: 'Car',
    color: '#3b82f6',
    monthlyBudgetLimit: 3500,
    subcategories: ['Petrol / EV Charge', 'Uber / Ola / Auto', 'Metro / Train', 'Vehicle Servicing'],
    order: 6,
    isSystem: true,
    archived: false,
  },
  {
    name: 'EMIs & Debt Repayment',
    slug: 'emis-debt-repayment',
    type: 'expense',
    icon: 'Landmark',
    color: '#ef4444',
    monthlyBudgetLimit: 10000,
    subcategories: ['Loan EMI', 'Credit Card Bill', 'Friend Debt Repayment'],
    order: 7,
    isSystem: true,
    archived: false,
  },
  {
    name: 'Entertainment & Subscriptions',
    slug: 'entertainment-subscriptions',
    type: 'expense',
    icon: 'Film',
    color: '#8b5cf6',
    monthlyBudgetLimit: 2500,
    subcategories: ['OTT & Streaming', 'Gym Membership', 'Movies & Outings', 'Apps & Cloud'],
    order: 8,
    isSystem: true,
    archived: false,
  },
  {
    name: 'Investments & Savings',
    slug: 'investments-savings',
    type: 'both',
    icon: 'TrendingUp',
    color: '#14b8a6',
    monthlyBudgetLimit: 10000,
    subcategories: ['SIP / Mutual Funds', 'Emergency Fund', 'Digital Gold', 'Salary / Income'],
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
  selectedMonth: string; // YYYY-MM
  filters: FinanceFilterState;
  isLoading: boolean;
  error: string | null;

  // Core Lifecycle
  loadFinanceData: (customUserId?: string) => Promise<void>;
  seedInitialFinanceData: (userId: string) => Promise<void>;
  setSelectedMonth: (monthKey: string) => void;
  setFilters: (filters: Partial<FinanceFilterState>) => void;
  resetFilters: () => void;

  // Transactions
  addTransaction: (data: FinanceTransactionFormData) => Promise<FinanceTransaction>;
  updateTransaction: (id: string, data: Partial<FinanceTransactionFormData>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
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

  // Accounts, Categories & Budgets
  addAccount: (
    data: Omit<FinanceAccount, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<FinanceAccount>;
  updateAccount: (id: string, data: Partial<FinanceAccount>) => Promise<void>;
  addCategory: (
    data: Omit<FinanceCategory, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<FinanceCategory>;
  updateCategoryBudget: (categoryId: string, monthlyBudgetLimit: number) => Promise<void>;
  setMonthlyBudget: (
    monthKey: string,
    totalBudget: number,
    expectedIncome?: number
  ) => Promise<void>;
  exportTransactionsCsv: (monthKey?: string) => string;

  // Selectors
  getMonthlySummary: (monthKey?: string) => MonthlyFinanceSummary;
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
}

async function resolveCurrentUserId(
  customUserId?: string,
  storeUserId?: string | null
): Promise<string> {
  if (customUserId) return customUserId;
  if (storeUserId) return storeUserId;
  try {
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user?.id || 'local-demo-user';
  } catch {
    return 'local-demo-user';
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
  selectedMonth: getCurrentMonthKey(),
  filters: INITIAL_FILTERS,
  isLoading: true,
  error: null,

  setSelectedMonth: (monthKey) => set({ selectedMonth: monthKey }),

  setFilters: (newFilters) =>
    set((state) => ({ filters: { ...state.filters, ...newFilters } })),

  resetFilters: () => set({ filters: INITIAL_FILTERS }),

  seedInitialFinanceData: async (userId: string) => {
    const existingCount = await db.financeCategories.where('userId').equals(userId).count();
    if (existingCount > 0) return;

    const now = new Date().toISOString();
    const todayStr = now.split('T')[0];
    const currentMonthKey = getCurrentMonthKey();

    // 1. Seed 10 Granular Categories in INR
    const categories: FinanceCategory[] = DEFAULT_FINANCE_CATEGORIES.map((c) => ({
      ...c,
      id: crypto.randomUUID(),
      userId,
      createdAt: now,
      updatedAt: now,
    }));
    await db.financeCategories.bulkAdd(categories);

    const findCatId = (slug: string) =>
      categories.find((c) => c.slug === slug)?.id || categories[0].id;

    // 2. Seed Multi-Account / Payment Methods in INR
    const upiAccount: FinanceAccount = {
      id: crypto.randomUUID(),
      userId,
      name: 'GPay / HDFC UPI',
      type: 'upi',
      balance: 44200,
      currency: 'INR',
      color: '#10b981',
      icon: 'Smartphone',
      isDefault: true,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    const bankAccount: FinanceAccount = {
      id: crypto.randomUUID(),
      userId,
      name: 'HDFC Salary Account',
      type: 'bank',
      balance: 82500,
      currency: 'INR',
      color: '#3b82f6',
      icon: 'Landmark',
      isDefault: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    const cashAccount: FinanceAccount = {
      id: crypto.randomUUID(),
      userId,
      name: 'Cash in Wallet',
      type: 'cash',
      balance: 3400,
      currency: 'INR',
      color: '#f59e0b',
      icon: 'Banknote',
      isDefault: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    const cardAccount: FinanceAccount = {
      id: crypto.randomUUID(),
      userId,
      name: 'ICICI Amazon Pay Card',
      type: 'credit_card',
      balance: -4800,
      currency: 'INR',
      color: '#8b5cf6',
      icon: 'CreditCard',
      isDefault: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };

    const accounts = [upiAccount, bankAccount, cashAccount, cardAccount];
    await db.financeAccounts.bulkAdd(accounts);

    // 3. Seed Current Month Budget
    const budget: FinanceBudget = {
      id: crypto.randomUUID(),
      userId,
      monthKey: currentMonthKey,
      totalBudget: 45000,
      expectedIncome: 75000,
      currency: 'INR',
      notes: 'Monthly envelope budget with Mother commitment and EMI reserves',
      createdAt: now,
      updatedAt: now,
    };
    await db.financeBudgets.add(budget);

    // 4. Seed Monthly Commitment ("Mother's ₹3,000 Monthly Allowance")
    const motherCommitment: MonthlyCommitment = {
      id: crypto.randomUUID(),
      userId,
      title: "Mother's Monthly Support",
      recipientName: 'Mother',
      relationship: 'Mother',
      monthlyTargetAmount: 3000,
      dueDayOfMonth: 10,
      category: 'family_support',
      defaultCategoryId: findCatId('family-commitments'),
      autoRolloverOverpayment: true,
      icon: 'HeartHandshake',
      color: '#ec4899',
      isActive: true,
      notes: '₹3,000/month fixed support. Deduct online orders & utility bills paid on her behalf.',
      createdAt: now,
      updatedAt: now,
    };
    await db.monthlyCommitments.add(motherCommitment);

    // 5. Seed Lend & Borrow Records ("Friends ₹2,000 Partial Repayment Tracker")
    const rahulDebtId = crypto.randomUUID();
    const rahulDebt: DebtRecord = {
      id: rahulDebtId,
      userId,
      personName: 'Rahul Sharma',
      contactInfo: 'rahul@okaxis',
      direction: 'borrowed',
      title: 'Borrowed for Goa Trip & Gear',
      principalAmount: 2000,
      totalRepaidAmount: 500,
      remainingAmount: 1500,
      startDate: `${currentMonthKey}-01`,
      repaymentSchedule: 'monthly_partial',
      plannedMonthlyInstallment: 500,
      dueDayOfMonth: 15,
      status: 'active',
      notes: 'Paying back ₹400–₹500 every month via UPI',
      color: '#f59e0b',
      createdAt: now,
      updatedAt: now,
    };

    const priyaDebt: DebtRecord = {
      id: crypto.randomUUID(),
      userId,
      personName: 'Priya Verma',
      contactInfo: 'priya@ybl',
      direction: 'lent',
      title: 'Concert Tickets & Dinner Split',
      principalAmount: 1500,
      totalRepaidAmount: 500,
      remainingAmount: 1000,
      startDate: `${currentMonthKey}-02`,
      repaymentSchedule: 'monthly_partial',
      plannedMonthlyInstallment: 500,
      dueDayOfMonth: 20,
      status: 'active',
      notes: 'Priya is sending ₹500/month',
      color: '#10b981',
      createdAt: now,
      updatedAt: now,
    };

    await db.debtRecords.bulkAdd([rahulDebt, priyaDebt]);

    // 6. Seed EMI Tracker
    const macbookEmi: EmiTracker = {
      id: crypto.randomUUID(),
      userId,
      loanName: 'MacBook Pro M3 No-Cost EMI',
      lenderName: 'HDFC Bank Credit Card',
      principalAmount: 78000,
      interestRateAnnual: 0,
      emiAmount: 6500,
      tenureMonths: 12,
      paidMonths: 5,
      startDate: '2026-06-05',
      billingDayOfMonth: 5,
      categoryId: findCatId('emis-debt-repayment'),
      accountId: bankAccount.id,
      autoCreateTaskReminder: true,
      status: 'active',
      notes: 'Auto-debits on the 5th of every month',
      createdAt: now,
      updatedAt: now,
    };
    await db.emiTrackers.add(macbookEmi);

    // 7. Seed Sample Transactions (including Mother's ₹450 Lipstick & ₹850 Electricity Bill offsets, Whey Protein, and Rahul's ₹500 partial repayment)
    const rahulInstallmentId = crypto.randomUUID();
    const rahulRepayTxId = crypto.randomUUID();

    const sampleTransactions: FinanceTransaction[] = [
      {
        id: crypto.randomUUID(),
        userId,
        title: 'Monthly Salary Credit',
        amount: 75000,
        type: 'income',
        categoryId: findCatId('investments-savings'),
        subcategory: 'Salary / Income',
        accountId: bankAccount.id,
        date: `${currentMonthKey}-01`,
        monthKey: currentMonthKey,
        notes: 'Monthly salary credited',
        tags: ['salary', 'income'],
        isRecurring: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        userId,
        title: 'Lakme Matte Lipstick for Mother',
        amount: 450,
        type: 'expense',
        categoryId: findCatId('shopping-personal-care'),
        subcategory: 'Cosmetics / Lipstick',
        accountId: upiAccount.id,
        date: todayStr,
        monthKey: currentMonthKey,
        notes: "Ordered on Nykaa per Mother's request — deducted from ₹3,000 monthly allowance",
        tags: ['mother', 'cosmetics', 'offset'],
        isRecurring: false,
        linkedCommitmentId: motherCommitment.id,
        commitmentContributionType: 'offset_expense',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        userId,
        title: 'Home Electricity Bill (Paid for Mother)',
        amount: 850,
        type: 'expense',
        categoryId: findCatId('utilities-bills'),
        subcategory: 'Electricity Bill',
        accountId: upiAccount.id,
        date: todayStr,
        monthKey: currentMonthKey,
        notes: "Paid home electricity bill on Mother's behalf — deducted from ₹3,000 monthly allowance",
        tags: ['mother', 'electricity', 'offset'],
        isRecurring: false,
        linkedCommitmentId: motherCommitment.id,
        commitmentContributionType: 'offset_expense',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        userId,
        title: 'Optimum Nutrition Gold Standard Whey Protein (2lb)',
        amount: 2850,
        type: 'expense',
        categoryId: findCatId('medical-supplements'),
        subcategory: 'Whey / Protein',
        accountId: cardAccount.id,
        date: todayStr,
        monthKey: currentMonthKey,
        notes: 'Monthly gym protein supplement stack',
        tags: ['whey', 'fitness', 'protein'],
        isRecurring: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        userId,
        title: 'Fresh Vegetables, Milk & Groceries',
        amount: 1120,
        type: 'expense',
        categoryId: findCatId('groceries-household'),
        subcategory: 'Vegetables & Dairy',
        accountId: upiAccount.id,
        date: todayStr,
        monthKey: currentMonthKey,
        notes: 'Weekly household grocery run',
        tags: ['groceries', 'dairy'],
        isRecurring: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: rahulRepayTxId,
        userId,
        title: 'Partial Debt Repayment to Rahul Sharma',
        amount: 500,
        type: 'expense',
        categoryId: findCatId('emis-debt-repayment'),
        subcategory: 'Friend Debt Repayment',
        accountId: upiAccount.id,
        date: todayStr,
        monthKey: currentMonthKey,
        notes: 'First partial monthly installment towards ₹2,000 borrowed',
        tags: ['debt', 'rahul', 'installment'],
        isRecurring: false,
        linkedDebtId: rahulDebtId,
        linkedDebtInstallmentId: rahulInstallmentId,
        createdAt: now,
        updatedAt: now,
      },
    ];

    await db.financeTransactions.bulkAdd(sampleTransactions);

    const rahulInstallment: DebtInstallment = {
      id: rahulInstallmentId,
      userId,
      debtId: rahulDebtId,
      amount: 500,
      date: todayStr,
      monthKey: currentMonthKey,
      paymentMethod: 'upi',
      transactionId: rahulRepayTxId,
      note: '1st partial installment via GPay',
      balanceAfterPayment: 1500,
      createdAt: now,
      updatedAt: now,
    };
    await db.debtInstallments.add(rahulInstallment);
  },

  loadFinanceData: async (customUserId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const userId = await resolveCurrentUserId(customUserId, get().currentUserId);
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
      ] = await Promise.all([
        db.financeCategories
          .where('userId')
          .equals(userId)
          .filter((c) => !c.archived)
          .sortBy('order'),
        db.financeAccounts
          .where('userId')
          .equals(userId)
          .filter((a) => !a.archived)
          .toArray(),
        db.financeTransactions
          .where('userId')
          .equals(userId)
          .reverse()
          .sortBy('date'),
        db.financeBudgets.where('userId').equals(userId).toArray(),
        db.monthlyCommitments.where('userId').equals(userId).toArray(),
        db.debtRecords.where('userId').equals(userId).toArray(),
        db.debtInstallments.where('userId').equals(userId).reverse().sortBy('date'),
        db.emiTrackers.where('userId').equals(userId).toArray(),
      ]);

      set({
        currentUserId: userId,
        categories,
        accounts,
        transactions,
        budgets,
        commitments,
        debtRecords,
        debtInstallments,
        emiTrackers,
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
      await db.financeAccounts.update(account.id, { balance: newBalance, updatedAt: now });
    }

    if (data.type === 'transfer' && data.toAccountId) {
      const toAcc = get().accounts.find((a) => a.id === data.toAccountId);
      if (toAcc) {
        await db.financeAccounts.update(toAcc.id, {
          balance: toAcc.balance + tx.amount,
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
          createdAt: now,
          updatedAt: now,
        };

        await db.debtInstallments.add(installment);
        await db.debtRecords.update(debt.id, {
          totalRepaidAmount: newRepaid,
          remainingAmount: newRemaining,
          status: newStatus,
          updatedAt: now,
        });
      }
    }

    await db.financeTransactions.add(tx);
    await get().loadFinanceData(userId);

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
      updatedAt: now,
    };

    await db.financeTransactions.update(id, updatedFields);
    await get().loadFinanceData(userId);
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
      await db.debtInstallments.delete(existing.linkedDebtInstallmentId);
    }

    await db.financeTransactions.delete(id);
    await get().loadFinanceData(userId);
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
      updatedAt: now,
    });

    await get().loadFinanceData(existing.userId);
  },

  addCommitment: async (data) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();
    const commitment: MonthlyCommitment = {
      ...data,
      id: crypto.randomUUID(),
      userId,
      createdAt: now,
      updatedAt: now,
    };
    await db.monthlyCommitments.add(commitment);
    await get().loadFinanceData(userId);
    return commitment;
  },

  updateCommitment: async (id, data) => {
    const existing = get().commitments.find((c) => c.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    await db.monthlyCommitments.update(id, { ...data, updatedAt: now });
    await get().loadFinanceData(existing.userId);
  },

  deleteCommitment: async (id) => {
    const existing = get().commitments.find((c) => c.id === id);
    if (!existing) return;
    await db.monthlyCommitments.delete(id);
    await get().loadFinanceData(existing.userId);
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
      createdAt: now,
      updatedAt: now,
    };
    await db.debtRecords.add(record);
    await get().loadFinanceData(userId);
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
        createdAt: now,
        updatedAt: now,
      };

      await db.financeTransactions.add(tx);

      const balanceDelta = txType === 'income' ? Number(amount) : -Number(amount);
      await db.financeAccounts.update(selectedAccount.id, {
        balance: selectedAccount.balance + balanceDelta,
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
      createdAt: now,
      updatedAt: now,
    };

    await db.debtInstallments.add(installment);
    await db.debtRecords.update(debt.id, {
      totalRepaidAmount: newRepaid,
      remainingAmount: newRemaining,
      status: newStatus,
      updatedAt: now,
    });

    await get().loadFinanceData(userId);

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
      notes: note ? `${debt.notes ? debt.notes + ' | ' : ''}Top-up +${formatINR(additionalAmount)}: ${note}` : debt.notes,
      updatedAt: now,
    });

    await get().loadFinanceData(debt.userId);
  },

  deleteDebtRecord: async (id) => {
    const debt = get().debtRecords.find((d) => d.id === id);
    if (!debt) return;
    await db.debtInstallments.where('debtId').equals(id).delete();
    await db.debtRecords.delete(id);
    await get().loadFinanceData(debt.userId);
  },

  addEmiTracker: async (data) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();
    const emi: EmiTracker = {
      ...data,
      id: crypto.randomUUID(),
      userId,
      createdAt: now,
      updatedAt: now,
    };
    await db.emiTrackers.add(emi);
    await get().loadFinanceData(userId);
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
    await db.emiTrackers.delete(id);
    await get().loadFinanceData(emi.userId);
  },

  addAccount: async (data) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();
    const account: FinanceAccount = {
      ...data,
      id: crypto.randomUUID(),
      userId,
      createdAt: now,
      updatedAt: now,
    };
    await db.financeAccounts.add(account);
    await get().loadFinanceData(userId);
    return account;
  },

  updateAccount: async (id, data) => {
    const existing = get().accounts.find((a) => a.id === id);
    if (!existing) return;
    await db.financeAccounts.update(id, { ...data, updatedAt: new Date().toISOString() });
    await get().loadFinanceData(existing.userId);
  },

  addCategory: async (data) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();
    const category: FinanceCategory = {
      ...data,
      id: crypto.randomUUID(),
      userId,
      createdAt: now,
      updatedAt: now,
    };
    await db.financeCategories.add(category);
    await get().loadFinanceData(userId);
    return category;
  },

  updateCategoryBudget: async (categoryId, monthlyBudgetLimit) => {
    const existing = get().categories.find((c) => c.id === categoryId);
    if (!existing) return;
    await db.financeCategories.update(categoryId, {
      monthlyBudgetLimit: Number(monthlyBudgetLimit),
      updatedAt: new Date().toISOString(),
    });
    await get().loadFinanceData(existing.userId);
  },

  setMonthlyBudget: async (monthKey, totalBudget, expectedIncome) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();
    const existing = get().budgets.find((b) => b.monthKey === monthKey && b.userId === userId);

    if (existing) {
      await db.financeBudgets.update(existing.id, {
        totalBudget: Number(totalBudget),
        expectedIncome:
          expectedIncome !== undefined ? Number(expectedIncome) : existing.expectedIncome,
        updatedAt: now,
      });
    } else {
      const budget: FinanceBudget = {
        id: crypto.randomUUID(),
        userId,
        monthKey,
        totalBudget: Number(totalBudget),
        expectedIncome: expectedIncome !== undefined ? Number(expectedIncome) : 75000,
        currency: 'INR',
        createdAt: now,
        updatedAt: now,
      };
      await db.financeBudgets.add(budget);
    }

    await get().loadFinanceData(userId);
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
      'Type',
      'Amount (INR)',
      'Category',
      'Subcategory',
      'Account',
      'Commitment Link',
      'Contribution Type',
      'Friend Debt Link',
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
      escapeCsv(t.type),
      t.amount,
      escapeCsv(categoriesMap.get(t.categoryId) || 'Uncategorized'),
      escapeCsv(t.subcategory || ''),
      escapeCsv(accountsMap.get(t.accountId) || 'Account'),
      escapeCsv(t.linkedCommitmentId ? commitmentsMap.get(t.linkedCommitmentId) : ''),
      escapeCsv(t.commitmentContributionType || ''),
      escapeCsv(t.linkedDebtId ? debtsMap.get(t.linkedDebtId) : ''),
      escapeCsv(t.notes || ''),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  },

  // ============================================
  // COMPUTED SELECTORS
  // ============================================

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
      .commitments.filter((c) => c.isActive)
      .map((c) => get().getCommitmentLedger(c.id, targetMonth))
      .filter((l): l is CommitmentLedgerSummary => l !== null);
  },

  getMonthlySummary: (monthKey) => {
    const targetMonth = monthKey || get().selectedMonth;
    const monthTransactions = get().transactions.filter((t) => t.monthKey === targetMonth);

    const totalIncome = monthTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expenseTransactions = monthTransactions.filter((t) => t.type === 'expense');
    const totalSpent = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);

    const budgetObj = get().budgets.find((b) => b.monthKey === targetMonth);
    const sumCategoryBudgets = get()
      .categories.filter((c) => c.type === 'expense')
      .reduce((sum, c) => sum + c.monthlyBudgetLimit, 0);

    const monthlyBudget = budgetObj?.totalBudget || sumCategoryBudgets || 45000;
    const expectedIncome = budgetObj?.expectedIncome || totalIncome || 75000;

    // 1. Remaining Unpaid Monthly Commitments (Only the unfulfilled remainder so offset purchases are never double-counted!)
    const commitmentLedgers = get().getAllCommitmentLedgers(targetMonth);
    const remainingUnpaidCommitments = commitmentLedgers.reduce(
      (sum, l) => sum + l.remainingBalance,
      0
    );

    // 2. Remaining Unpaid EMIs this month
    const unpaidEmis = get().emiTrackers.filter((emi) => {
      if (emi.status !== 'active' || emi.paidMonths >= emi.tenureMonths) return false;
      const paidTxExists = expenseTransactions.some((t) => t.linkedEmiId === emi.id);
      return emi.lastPaidMonthKey !== targetMonth && !paidTxExists;
    });
    const remainingUnpaidEmis = unpaidEmis.reduce((sum, e) => sum + e.emiAmount, 0);

    // 3. Planned Debt Installments still due this month (Borrowed debts with monthly_partial schedule)
    const activeBorrowedDebts = get().debtRecords.filter(
      (d) =>
        d.direction === 'borrowed' &&
        d.status === 'active' &&
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
        .debtInstallments.filter((i) => i.debtId === debt.id && i.monthKey === targetMonth)
        .reduce((sum, i) => sum + i.amount, 0);
      const stillDue = Math.max(0, planned - paidThisMonth);
      plannedDebtInstallmentsDue += stillDue;
    }

    // Safe-to-Spend Formula:
    // SafeToSpend = MonthlyBudget - (TotalSpentThisMonth + RemainingUnpaidEMIsThisMonth + RemainingUnpaidMonthlyCommitmentsThisMonth + PlannedDebtInstallmentsThisMonth)
    const safeToSpendMonthly =
      monthlyBudget -
      (totalSpent +
        remainingUnpaidEmis +
        remainingUnpaidCommitments +
        plannedDebtInstallmentsDue);

    // Calculate Remaining Days in Month
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

    const safeToSpendDaily = Math.max(0, Math.round(safeToSpendMonthly / remainingDaysInMonth));

    const netSavings = (totalIncome || expectedIncome) - totalSpent;
    const savingsRate =
      (totalIncome || expectedIncome) > 0
        ? Math.round((netSavings / (totalIncome || expectedIncome)) * 100)
        : 0;

    // Category Breakdown
    const categoryBreakdown: CategorySpendItem[] = get()
      .categories.filter((c) => c.type === 'expense' || c.type === 'both')
      .map((category) => {
        const catTxs = expenseTransactions.filter((t) => t.categoryId === category.id);
        const spent = catTxs.reduce((sum, t) => sum + t.amount, 0);
        const budgetLimit = category.monthlyBudgetLimit || 1;
        const percentageOfBudget = Math.round((spent / budgetLimit) * 100);
        const percentageOfTotalSpend =
          totalSpent > 0 ? Math.round((spent / totalSpent) * 100) : 0;

        let status: CategorySpendItem['status'] = 'safe';
        if (percentageOfBudget >= 100) {
          status = 'exceeded';
        } else if (percentageOfBudget >= 80) {
          status = 'warning';
        }

        return {
          category,
          spent,
          budgetLimit: category.monthlyBudgetLimit,
          percentageOfBudget,
          percentageOfTotalSpend,
          transactionCount: catTxs.length,
          status,
        };
      })
      .sort((a, b) => b.spent - a.spent);

    return {
      monthKey: targetMonth,
      totalIncome,
      totalSpent,
      monthlyBudget,
      expectedIncome,
      remainingUnpaidEmis,
      remainingUnpaidCommitments,
      plannedDebtInstallmentsDue,
      safeToSpendMonthly,
      safeToSpendDaily,
      remainingDaysInMonth,
      netSavings,
      savingsRate,
      categoryBreakdown,
    };
  },

  getDebtSummary: () => {
    const activeBorrowed = get().debtRecords.filter(
      (d) => d.direction === 'borrowed' && d.status === 'active'
    );
    const activeLent = get().debtRecords.filter(
      (d) => d.direction === 'lent' && d.status === 'active'
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
      .debtInstallments.filter((i) => i.debtId === debtId)
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
      if (emi.status !== 'active' || emi.paidMonths >= emi.tenureMonths) continue;
      const isPaidThisMonth =
        emi.lastPaidMonthKey === currentMonthKey ||
        get().transactions.some(
          (t) => t.linkedEmiId === emi.id && t.monthKey === currentMonthKey
        );
      if (isPaidThisMonth) continue;

      const daysUntilDue = emi.billingDayOfMonth - currentDay;
      if (daysUntilDue <= withinDays) {
        obligations.push({
          id: `emi-${emi.id}`,
          sourceId: emi.id,
          type: 'emi',
          title: `${emi.loanName} EMI`,
          subtitle: `${emi.lenderName} • Month ${emi.paidMonths + 1}/${emi.tenureMonths}`,
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
          subtitle: `${formatINR(ledger.totalFulfilledAmount)} fulfilled via offsets/transfers • ${formatINR(
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
        debt.remainingAmount <= 0
      )
        continue;

      const dueDay = debt.dueDayOfMonth || 15;
      const daysUntilDue = dueDay - currentDay;
      const paidThisMonth = get()
        .debtInstallments.filter(
          (i) => i.debtId === debt.id && i.monthKey === currentMonthKey
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
          title: `Pay ${debt.personName} (Partial Installment)`,
          subtitle: `${debt.title} • ${formatINR(debt.remainingAmount)} total remaining`,
          amount: stillDue,
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
      if (filters.dateFrom && tx.date < filters.dateFrom) return false;
      if (filters.dateTo && tx.date > filters.dateTo) return false;

      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const matchTitle = tx.title.toLowerCase().includes(q);
        const matchSub = tx.subcategory?.toLowerCase().includes(q) || false;
        const matchNotes = tx.notes?.toLowerCase().includes(q) || false;
        const matchTags = tx.tags.some((tag) => tag.toLowerCase().includes(q));
        if (!matchTitle && !matchSub && !matchNotes && !matchTags) return false;
      }

      return true;
    });
  },
}));
