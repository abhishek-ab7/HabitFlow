import { db } from '@/lib/db';
import type {
  FinanceAccount,
  FinanceBudget,
  FinanceCategorizationRule,
  FinanceCategory,
  FinanceNetWorthSnapshot,
} from '@/lib/types';
import {
  getCurrentMonthKey,
  notifyFinanceSync,
  resolveCurrentUserId,
  type FinanceSliceCreator,
  type FinanceStore,
} from './helpers';

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
  | 'reconcileAccountBalance'
  | 'recordCurrentNetWorthSnapshot'
  | 'addCategory'
  | 'updateCategory'
  | 'deleteCategory'
  | 'updateCategoryBudget'
  | 'setMonthlyBudget'
  | 'saveMonthlyBudgetSettings'
>;

export const createAccountsBudgetsSlice: FinanceSliceCreator<AccountsBudgetsSlice> = (
  _set,
  get
) => ({
  addCategorizationRule: async (data) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();
    const rule: FinanceCategorizationRule = {
      ...data,
      id: crypto.randomUUID(),
      userId,
      isDirty: true,
      generationCounter: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.financeCategorizationRules.add(rule);
    await get().loadFinanceData(userId);
    notifyFinanceSync();
    return rule;
  },

  updateCategorizationRule: async (id, data) => {
    const existing = get().categorizationRules.find((r) => r.id === id);
    if (!existing) return;
    await db.financeCategorizationRules.update(id, {
      ...data,
      isDirty: true,
      updatedAt: new Date().toISOString(),
    });
    await get().loadFinanceData(existing.userId);
    notifyFinanceSync();
  },

  deleteCategorizationRule: async (id) => {
    const existing = get().categorizationRules.find((r) => r.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    await db.financeCategorizationRules.update(id, {
      isActive: false,
      deletedAt: now,
      isDirty: true,
      updatedAt: now,
    });
    await get().loadFinanceData(existing.userId);
    notifyFinanceSync();
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

  addAccount: async (data) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();
    const accountId = crypto.randomUUID();
    if (data.isDefault) {
      const existingAccs = await db.financeAccounts.where('userId').equals(userId).toArray();
      for (const acc of existingAccs) {
        if (acc.isDefault) {
          await db.financeAccounts.update(acc.id, {
            isDefault: false,
            isDirty: true,
            updatedAt: now,
          });
        }
      }
    }
    const account: FinanceAccount = {
      ...data,
      id: accountId,
      userId,
      isDirty: true,
      generationCounter: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.financeAccounts.add(account);
    await get().loadFinanceData(userId);
    await get().recordCurrentNetWorthSnapshot();
    notifyFinanceSync();
    return account;
  },

  updateAccount: async (id, data) => {
    const existing = get().accounts.find((a) => a.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    if (data.isDefault === true) {
      const userAccs = await db.financeAccounts.where('userId').equals(existing.userId).toArray();
      for (const acc of userAccs) {
        if (acc.id !== id && acc.isDefault) {
          await db.financeAccounts.update(acc.id, {
            isDefault: false,
            isDirty: true,
            updatedAt: now,
          });
        }
      }
    }
    await db.financeAccounts.update(id, {
      ...data,
      isDirty: true,
      updatedAt: now,
    });
    await get().loadFinanceData(existing.userId);
    await get().recordCurrentNetWorthSnapshot();
    notifyFinanceSync();
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
    await get().recordCurrentNetWorthSnapshot();
    notifyFinanceSync();
  },

  reconcileAccountBalance: async (accountId, actualBalance, logAdjustmentTransaction = true) => {
    const account = get().accounts.find((a) => a.id === accountId);
    if (!account) return { variance: 0, adjusted: false };

    const targetBalance = Math.round(Number(actualBalance) * 100) / 100;
    const variance = Math.round((targetBalance - Number(account.balance || 0)) * 100) / 100;
    if (Math.abs(variance) < 0.01) {
      return { variance: 0, adjusted: false };
    }

    const now = new Date().toISOString();
    const todayStr = now.split('T')[0];

    if (logAdjustmentTransaction) {
      const fallbackCat =
        get().categories.find((c) => c.slug === 'investments-savings') ||
        get().categories[0];
      await get().addTransaction({
        title: `Balance Adjustment — ${account.name}`,
        amount: Math.abs(variance),
        type: variance > 0 ? 'income' : 'expense',
        categoryId: fallbackCat?.id || 'uncategorized',
        accountId: account.id,
        date: todayStr,
        notes: `Reconciled ${account.name} from ₹${account.balance} to ₹${targetBalance}`,
        tags: ['reconciliation'],
        needsReview: false,
      });
    } else {
      await db.financeAccounts.update(account.id, {
        balance: targetBalance,
        isDirty: true,
        updatedAt: now,
      });
      await get().loadFinanceData(account.userId);
      await get().recordCurrentNetWorthSnapshot();
      notifyFinanceSync();
    }

    return { variance, adjusted: true };
  },

  recordCurrentNetWorthSnapshot: async (monthKey) => {
    if (!db.financeNetWorthSnapshots) return;
    try {
      const userId = await resolveCurrentUserId(undefined, get().currentUserId);
      if (!userId) return;
      const targetMonth = monthKey || getCurrentMonthKey();
      const nw = get().getNetWorthSummary();
      const now = new Date().toISOString();
      const todayStr = now.split('T')[0];

      const existing = await db.financeNetWorthSnapshots
        .where('[userId+monthKey]')
        .equals([userId, targetMonth])
        .first();

      if (existing) {
        if (
          Math.abs(existing.netWorth - nw.netWorth) < 1 &&
          Math.abs(existing.totalAssets - nw.totalAssets) < 1 &&
          Math.abs(existing.totalLiabilities - nw.totalLiabilities) < 1
        ) {
          return;
        }
        await db.financeNetWorthSnapshots.update(existing.id, {
          snapshotDate: todayStr,
          liquidAssets: nw.liquidAssets,
          investmentAssets: nw.investmentAssets,
          friendReceivables: nw.friendReceivables,
          totalAssets: nw.totalAssets,
          creditCardLiabilities: nw.creditCardLiabilities,
          emiRemainingPrincipal: nw.emiRemainingPrincipal,
          friendPayables: nw.friendPayables,
          totalLiabilities: nw.totalLiabilities,
          netWorth: nw.netWorth,
          isDirty: true,
          updatedAt: now,
        });
      } else {
        const snap: FinanceNetWorthSnapshot = {
          id: crypto.randomUUID(),
          userId,
          monthKey: targetMonth,
          snapshotDate: todayStr,
          liquidAssets: nw.liquidAssets,
          investmentAssets: nw.investmentAssets,
          friendReceivables: nw.friendReceivables,
          totalAssets: nw.totalAssets,
          creditCardLiabilities: nw.creditCardLiabilities,
          emiRemainingPrincipal: nw.emiRemainingPrincipal,
          friendPayables: nw.friendPayables,
          totalLiabilities: nw.totalLiabilities,
          netWorth: nw.netWorth,
          isDirty: true,
          generationCounter: 1,
          createdAt: now,
          updatedAt: now,
        };
        await db.financeNetWorthSnapshots.add(snap);
      }

      const snapshots = await db.financeNetWorthSnapshots
        .where('userId')
        .equals(userId)
        .filter((s) => !s.deletedAt)
        .sortBy('monthKey');
      _set({ netWorthSnapshots: snapshots });
    } catch {
      // Non-blocking snapshot capture
    }
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
        budgetMode: 'cap',
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
    const nextBudgetMode = options?.budgetMode || existing?.budgetMode || 'cap';
    const nextAssignedIncome =
      options?.assignedIncome !== undefined
        ? Math.max(0, Number(options.assignedIncome) || 0)
        : existing?.assignedIncome;

    if (existing) {
      await db.financeBudgets.update(existing.id, {
        totalBudget: normalizedTotal,
        expectedIncome: normalizedIncome,
        plannedSipAmount: normalizedSip,
        budgetMode: nextBudgetMode,
        assignedIncome: nextAssignedIncome,
        isDirty: true,
        updatedAt: now,
      });
    } else if (
      normalizedTotal > 0 ||
      normalizedIncome > 0 ||
      normalizedSip > 0 ||
      nextBudgetMode === 'zero_based'
    ) {
      const budget: FinanceBudget = {
        id: crypto.randomUUID(),
        userId,
        monthKey,
        totalBudget: normalizedTotal,
        expectedIncome: normalizedIncome,
        plannedSipAmount: normalizedSip,
        budgetMode: nextBudgetMode,
        assignedIncome: nextAssignedIncome,
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
});
