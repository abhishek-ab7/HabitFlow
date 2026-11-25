import { create } from 'zustand';
import { db } from '@/lib/db';
import { deduplicateFinanceRecordsInDexie } from '@/lib/sync/engines/finance-sync';
import {
  repairLegacySplitTransactions,
  hasUserRunSplitRepair,
  markUserSplitRepairDone,
  type SplitRepairResult,
} from '@/lib/finance/split-repair-migration';
import type { FinanceAccount, FinanceCategory } from '@/lib/types';
import {
  DEFAULT_FINANCE_CATEGORIES,
  INITIAL_FILTERS,
  formatINR,
  getCurrentMonthKey,
  getPreviousMonthKey,
  migrateLocalDemoFinanceRecords,
  notifyFinanceSync,
  resolveCurrentUserId,
  type FinanceStore,
  type SixMonthTrendPoint,
} from './finance/helpers';
import { createTransactionsSlice } from './finance/transactions-slice';
import { createTrackersSlice } from './finance/trackers-slice';
import { createAccountsBudgetsSlice } from './finance/accounts-budgets-slice';
import { createAnalyticsSlice } from './finance/analytics-slice';

export {
  DEFAULT_FINANCE_CATEGORIES,
  formatINR,
  getCurrentMonthKey,
  getPreviousMonthKey,
  resolveCurrentUserId,
  type SixMonthTrendPoint,
};

export const useFinanceStore = create<FinanceStore>((set, get, api) => ({
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
  netWorthSnapshots: [],
  creditCardStatements: [],
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
    const hasJunkFoodCategory = existingCats.some(
      (c) => c.slug === 'junk-food' || /junk\s*food/i.test(c.name)
    );
    if (existingCats.length > 0 && existingAccs.length > 0 && hasJunkFoodCategory) return;

    const existingSlugs = new Set(existingCats.map((c) => c.slug).filter(Boolean));
    const existingAccKeys = new Set(
      existingAccs.map((a) => `${a.name.trim().toLowerCase()}_${a.type}`)
    );

    const now = new Date().toISOString();

    if (existingCats.length === 0) {
      const categories: FinanceCategory[] = DEFAULT_FINANCE_CATEGORIES.filter(
        (c) => !existingSlugs.has(c.slug)
      ).map((c) => ({
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
    } else if (!hasJunkFoodCategory) {
      const junkTemplate = DEFAULT_FINANCE_CATEGORIES.find((c) => c.slug === 'junk-food');
      if (junkTemplate) {
        await db.financeCategories.add({
          ...junkTemplate,
          id: crypto.randomUUID(),
          userId,
          isDirty: true,
          generationCounter: 1,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    if (existingAccs.length === 0) {
      const starterAccounts: FinanceAccount[] = (
        [
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
        ] as FinanceAccount[]
      ).filter((a) => !existingAccKeys.has(`${a.name.trim().toLowerCase()}_${a.type}`));

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
      db.financeNetWorthSnapshots
        ? db.financeNetWorthSnapshots.where('userId').equals(userId).delete()
        : Promise.resolve(),
      db.creditCardStatements
        ? db.creditCardStatements.where('userId').equals(userId).delete()
        : Promise.resolve(),
    ]);

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
        isDirty: true,
        updatedAt: now,
      });
    }

    if (keepCategories) {
      const cats = await db.financeCategories.where('userId').equals(userId).toArray();
      for (const cat of cats) {
        await db.financeCategories.update(cat.id, {
          monthlyBudgetLimit: 0,
          isDirty: true,
          updatedAt: now,
        });
      }
    } else {
      await db.financeCategories.where('userId').equals(userId).delete();
    }

    await get().loadFinanceData(userId);
  },

  loadFinanceData: async (customUserId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const userId = await resolveCurrentUserId(customUserId, get().currentUserId);

      if (userId && userId !== 'local-demo-user') {
        await migrateLocalDemoFinanceRecords(userId);
      }

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

      let repairResult: SplitRepairResult = { repairedCount: 0, affectedCardIds: [] };
      if (!hasUserRunSplitRepair(userId)) {
        repairResult = await repairLegacySplitTransactions(userId);
        markUserSplitRepairDone(userId);
      }

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
        netWorthSnapshots,
        creditCardStatements,
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
        db.financeNetWorthSnapshots
          ? db.financeNetWorthSnapshots
              .where('userId')
              .equals(userId)
              .filter((s) => !s.deletedAt)
              .sortBy('monthKey')
          : Promise.resolve([]),
        db.creditCardStatements
          ? db.creditCardStatements
              .where('userId')
              .equals(userId)
              .filter((s) => !s.deletedAt)
              .toArray()
          : Promise.resolve([]),
      ]);

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

      const normalizedTransactions = transactions.map((tx) => ({
        ...tx,
        tags: Array.isArray(tx.tags) ? tx.tags : [],
      }));

      set({
        currentUserId: userId,
        categories: uniqueCategories,
        accounts: uniqueAccounts,
        transactions: normalizedTransactions,
        budgets,
        commitments,
        debtRecords,
        debtInstallments,
        emiTrackers,
        sipPlans,
        categorizationRules,
        recurringBills,
        netWorthSnapshots,
        creditCardStatements,
        isLoading: false,
      });

      if (repairResult.affectedCardIds.length > 0) {
        for (const cardId of repairResult.affectedCardIds) {
          await get().syncCardStatements(cardId);
        }
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load finance data',
        isLoading: false,
      });
    }
  },

  ...createTransactionsSlice(set, get, api),
  ...createTrackersSlice(set, get, api),
  ...createAccountsBudgetsSlice(set, get, api),
  ...createAnalyticsSlice(set, get, api),
}));
