import { create } from 'zustand';
import { deduplicateFinanceRecordsInDexie } from '@/lib/sync/engines/finance-sync';
import {
  repairLegacySplitTransactions,
  hasUserRunSplitRepair,
  markUserSplitRepairDone,
  type SplitRepairResult,
} from '@/lib/finance/split-repair-migration';
import {
  DEFAULT_FINANCE_CATEGORIES,
  INITIAL_FILTERS,
  formatINR,
  getCurrentMonthKey,
  getPreviousMonthKey,
  migrateLocalDemoFinanceRecords,
  resolveCurrentUserId,
  type FinanceStore,
  type SixMonthTrendPoint,
} from './finance/helpers';
import { createTransactionsSlice } from './finance/transactions-slice';
import { createTrackersSlice } from './finance/trackers-slice';
import { createAccountsBudgetsSlice } from './finance/accounts-budgets-slice';
import { createAnalyticsSlice } from './finance/analytics-slice';
import { seedInitialFinanceDataImpl } from './finance/store-seeder';
import {
  loadAllFinanceTables,
  resetAllFinanceDataImpl,
  runFreshStartMigrationIfNeeded,
} from './finance/store-loader';

export {
  DEFAULT_FINANCE_CATEGORIES,
  formatINR,
  getCurrentMonthKey,
  getPreviousMonthKey,
  resolveCurrentUserId,
  type SixMonthTrendPoint,
};

const migratedDemoFinanceUsers = new Set<string>();
const deduplicatedFinanceUsers = new Set<string>();

function shouldMigrateDemoUser(userId: string): boolean {
  if (!userId || userId === 'local-demo-user') return false;
  return !migratedDemoFinanceUsers.has(userId);
}

async function runPreLoadMigrations(userId: string, force: boolean): Promise<SplitRepairResult> {
  if (shouldMigrateDemoUser(userId)) {
    await migrateLocalDemoFinanceRecords(userId);
    migratedDemoFinanceUsers.add(userId);
  }

  await runFreshStartMigrationIfNeeded(userId);

  if (!deduplicatedFinanceUsers.has(userId) || force) {
    await deduplicateFinanceRecordsInDexie(userId);
    deduplicatedFinanceUsers.add(userId);
  }
  await seedInitialFinanceDataImpl(userId);

  if (!hasUserRunSplitRepair(userId)) {
    const repairResult = await repairLegacySplitTransactions(userId);
    markUserSplitRepairDone(userId);
    return repairResult;
  }
  return { repairedCount: 0, affectedCardIds: [] };
}

function isAlreadyLoadedForUser(
  state: FinanceStore,
  userId: string,
  force: boolean
): boolean {
  return !force && state.hasLoaded && state.currentUserId === userId;
}

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
  hasLoaded: false,
  error: null,

  setSelectedMonth: (monthKey) => set({ selectedMonth: monthKey }),

  setFilters: (newFilters) =>
    set((state) => ({ filters: { ...state.filters, ...newFilters } })),

  resetFilters: () => set({ filters: INITIAL_FILTERS }),

  seedInitialFinanceData: (userId) => seedInitialFinanceDataImpl(userId),

  resetAllFinanceData: async (keepCategories = true) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    await resetAllFinanceDataImpl(userId, keepCategories);
    await get().loadFinanceData(userId, true);
  },

  loadFinanceData: async (customUserId?: string, force = true) => {
    try {
      const userId = await resolveCurrentUserId(customUserId, get().currentUserId);
      const state = get();
      if (isAlreadyLoadedForUser(state, userId, force)) return;
      if (!state.hasLoaded) set({ isLoading: true, error: null });

      const repairResult = await runPreLoadMigrations(userId, force);
      const loaded = await loadAllFinanceTables(userId);

      set({
        currentUserId: userId,
        ...loaded,
        isLoading: false,
        hasLoaded: true,
      });

      for (const cardId of repairResult.affectedCardIds) {
        await get().syncCardStatements(cardId);
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
