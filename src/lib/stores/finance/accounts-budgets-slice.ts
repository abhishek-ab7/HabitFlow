import { db } from '@/lib/db';
import type { FinanceAccount, FinanceCategorizationRule, FinanceCategory } from '@/lib/types';
import { notifyFinanceSync, resolveCurrentUserId, type FinanceSliceCreator, type FinanceStore } from './helpers';
import {
  addTrackerEntity,
  softDeleteTrackerEntity,
  updateTrackerEntity,
} from './trackers/crud-factory';
import {
  getCreditCardSummaryImpl,
  payCreditCardBillImpl,
  reconcileCreditCardStatementImpl,
  syncCardStatementsImpl,
} from './accounts/credit-card-ops';
import {
  reconcileAccountBalanceImpl,
  recordCurrentNetWorthSnapshotImpl,
  saveMonthlyBudgetSettingsImpl,
  setMonthlyBudgetImpl,
} from './accounts/budget-ops';

export type AccountsBudgetsSlice = Pick<
  FinanceStore,
  | 'addCategorizationRule'
  | 'updateCategorizationRule'
  | 'deleteCategorizationRule'
  | 'applyCategorizationRules'
  | 'addAccount'
  | 'updateAccount'
  | 'setDefaultAccount'
  | 'deleteAccount'
  | 'syncCardStatements'
  | 'payCreditCardBill'
  | 'reconcileCreditCardStatement'
  | 'moveTransactionToCycle'
  | 'getCreditCardSummary'
  | 'reconcileAccountBalance'
  | 'recordCurrentNetWorthSnapshot'
  | 'addCategory'
  | 'updateCategory'
  | 'deleteCategory'
  | 'updateCategoryBudget'
  | 'setMonthlyBudget'
  | 'saveMonthlyBudgetSettings'
>;

async function clearOtherDefaultAccounts(
  userId: string,
  keepAccountId: string | undefined,
  now: string
): Promise<void> {
  const existingAccs = await db.financeAccounts.where('userId').equals(userId).toArray();
  for (const acc of existingAccs) {
    if (acc.id !== keepAccountId && acc.isDefault) {
      await db.financeAccounts.update(acc.id, { isDefault: false, isDirty: true, updatedAt: now });
    }
  }
}

export const createAccountsBudgetsSlice: FinanceSliceCreator<AccountsBudgetsSlice> = (
  set,
  get
) => ({
  addCategorizationRule: (data) =>
    addTrackerEntity<FinanceCategorizationRule, typeof data>({
      getState: get,
      table: db.financeCategorizationRules,
      data,
    }),

  updateCategorizationRule: (id, data) =>
    updateTrackerEntity({
      getState: get,
      table: db.financeCategorizationRules,
      existing: get().categorizationRules.find((r) => r.id === id),
      data,
    }),

  deleteCategorizationRule: (id) =>
    softDeleteTrackerEntity({
      getState: get,
      table: db.financeCategorizationRules,
      existing: get().categorizationRules.find((r) => r.id === id),
      extraFields: { isActive: false },
    }),

  applyCategorizationRules: (rawTextOrMerchant) => {
    const normalized = (rawTextOrMerchant || '').toLowerCase();
    if (!normalized) return {};
    const activeRules = get().categorizationRules.filter((r) => r.isActive && !r.deletedAt);
    const matched = activeRules.find((r) => {
      const pattern = r.matchPattern.toLowerCase().trim();
      return Boolean(pattern) && normalized.includes(pattern);
    });
    if (!matched) return {};
    return {
      rule: matched,
      categoryId: matched.categoryId,
      cleanMerchantName: matched.cleanMerchantName,
      tags: matched.defaultTags,
    };
  },

  addAccount: async (data) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    if (data.isDefault) {
      await clearOtherDefaultAccounts(userId, undefined, new Date().toISOString());
    }
    return addTrackerEntity<FinanceAccount, typeof data>({
      getState: get,
      table: db.financeAccounts,
      data,
      recordNetWorth: true,
    });
  },

  updateAccount: async (id, data) => {
    const existing = get().accounts.find((a) => a.id === id);
    if (!existing) return;
    if (data.isDefault === true) {
      await clearOtherDefaultAccounts(existing.userId, id, new Date().toISOString());
    }
    await updateTrackerEntity({
      getState: get,
      table: db.financeAccounts,
      existing,
      data,
      recordNetWorth: true,
    });
  },

  setDefaultAccount: async (accountId) => {
    const target = get().accounts.find((a) => a.id === accountId && !a.deletedAt && !a.archived);
    if (!target) return;
    const now = new Date().toISOString();
    const userAccs = await db.financeAccounts.where('userId').equals(target.userId).toArray();
    for (const acc of userAccs) {
      const shouldBeDefault = acc.id === accountId;
      if (Boolean(acc.isDefault) !== shouldBeDefault) {
        await db.financeAccounts.update(acc.id, {
          isDefault: shouldBeDefault,
          isDirty: true,
          updatedAt: now,
        });
      }
    }
    await get().loadFinanceData(target.userId);
    notifyFinanceSync();
  },

  deleteAccount: (id) =>
    softDeleteTrackerEntity({
      getState: get,
      table: db.financeAccounts,
      existing: get().accounts.find((a) => a.id === id),
      extraFields: { archived: true },
      recordNetWorth: true,
    }),

  getCreditCardSummary: (accountId, referenceDate) =>
    getCreditCardSummaryImpl(get(), accountId, referenceDate),

  syncCardStatements: (accountId) =>
    syncCardStatementsImpl(get(), (stmts) => set({ creditCardStatements: stmts }), accountId),

  payCreditCardBill: (params) => payCreditCardBillImpl(get(), params),

  reconcileCreditCardStatement: (params) => reconcileCreditCardStatementImpl(get(), params),

  moveTransactionToCycle: async (transactionId, targetCycleKey) => {
    const tx = get().transactions.find((t) => t.id === transactionId);
    if (!tx) return;
    await db.financeTransactions.update(transactionId, {
      statementCycleKey: targetCycleKey,
      updatedAt: new Date().toISOString(),
      isDirty: true,
    });
    const account = get().accounts.find((a) => a.id === tx.accountId);
    if (account?.userId) {
      await get().loadFinanceData(account.userId);
      await get().syncCardStatements(account.id);
    }
    notifyFinanceSync();
  },

  reconcileAccountBalance: (accountId, actualBalance, logAdjustmentTransaction = true) =>
    reconcileAccountBalanceImpl(get, accountId, actualBalance, logAdjustmentTransaction),

  recordCurrentNetWorthSnapshot: (monthKey) =>
    recordCurrentNetWorthSnapshotImpl(get(), (snapshots) => set({ netWorthSnapshots: snapshots }), monthKey),

  addCategory: (data) =>
    addTrackerEntity<FinanceCategory, typeof data>({
      getState: get,
      table: db.financeCategories,
      data,
    }),

  updateCategory: (id, data) =>
    updateTrackerEntity({
      getState: get,
      table: db.financeCategories,
      existing: get().categories.find((c) => c.id === id),
      data,
    }),

  deleteCategory: (id) =>
    softDeleteTrackerEntity({
      getState: get,
      table: db.financeCategories,
      existing: get().categories.find((c) => c.id === id),
      extraFields: { archived: true },
    }),

  updateCategoryBudget: (categoryId, monthlyBudgetLimit) =>
    updateTrackerEntity({
      getState: get,
      table: db.financeCategories,
      existing: get().categories.find((c) => c.id === categoryId),
      data: { monthlyBudgetLimit: Number(monthlyBudgetLimit) },
    }),

  setMonthlyBudget: (monthKey, totalBudget, expectedIncome, plannedSipAmount) =>
    setMonthlyBudgetImpl({
      state: get(),
      monthKey,
      totalBudget,
      expectedIncome,
      plannedSipAmount,
    }),

  saveMonthlyBudgetSettings: (monthKey, totalBudget, categoryLimits, options) =>
    saveMonthlyBudgetSettingsImpl({
      state: get(),
      monthKey,
      totalBudget,
      categoryLimits,
      options,
    }),
});
