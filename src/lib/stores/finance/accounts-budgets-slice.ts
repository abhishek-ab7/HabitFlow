import { db } from '@/lib/db';
import type {
  CreditCardCycleSummary,
  CreditCardStatement,
  FinanceAccount,
  FinanceBudget,
  FinanceCategorizationRule,
  FinanceCategory,
  FinanceNetWorthSnapshot,
  FinanceTransaction,
} from '@/lib/types';
import {
  computeCreditCardSummary,
  getCycleWindowForMonth,
  getLocalIsoDate,
  resolveTransactionCycle,
  allocatePaymentToStatements,
  resolveCardBillingConfig,
  roundCurrency,
} from '@/lib/finance/credit-card-cycles';
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

  getCreditCardSummary: (accountId, referenceDate) => {
    const account = get().accounts.find((a) => a.id === accountId);
    if (!account || account.type !== 'credit_card') return null;
    return computeCreditCardSummary({
      account,
      transactions: get().transactions,
      persistedStatements: get().creditCardStatements,
      referenceDate,
    });
  },

  syncCardStatements: async (accountId?: string) => {
    const cards = accountId
      ? get().accounts.filter((a) => a.id === accountId && a.type === 'credit_card')
      : get().accounts.filter((a) => a.type === 'credit_card' && !a.archived && !a.deletedAt);

    if (cards.length === 0) return;
    const now = new Date().toISOString();
    const todayIso = getLocalIsoDate();

    for (const card of cards) {
      const summary = computeCreditCardSummary({
        account: card,
        transactions: get().transactions,
        persistedStatements: get().creditCardStatements,
        referenceDate: todayIso,
      });

      if (summary.currentBilledStatement) {
        const stmt = summary.currentBilledStatement;
        const existing = await db.creditCardStatements.get(stmt.id);
        if (existing) {
          await db.creditCardStatements.update(stmt.id, {
            calculatedAmount: stmt.calculatedAmount,
            totalDue: stmt.totalDue,
            remainingDue: stmt.remainingDue,
            status: stmt.status,
            dueDate: stmt.dueDate,
            updatedAt: now,
            isDirty: true,
          });
        } else {
          const hasLinkedPayment = get().transactions.some(
            (t) =>
              !t.deletedAt &&
              t.paidStatementId &&
              (t.paidStatementId === stmt.id || t.paidStatementId === stmt.cycleKey)
          );
          await db.creditCardStatements.put({
            ...stmt,
            paidAmount: hasLinkedPayment ? stmt.paidAmount : 0,
            userId: card.userId,
            isDirty: true,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    if (cards[0]?.userId) {
      const updatedStmts = await db.creditCardStatements
        .where('userId')
        .equals(cards[0].userId)
        .filter((s) => !s.deletedAt)
        .toArray();
      _set({ creditCardStatements: updatedStmts });
    }
  },

  payCreditCardBill: async (params) => {
    const { cardAccountId, fromAccountId, amount, date, statementId, note } = params;
    const card = get().accounts.find((a) => a.id === cardAccountId);
    const bank = get().accounts.find((a) => a.id === fromAccountId);
    if (!card || !bank) {
      throw new Error('Card or Bank account not found');
    }

    const payAmount = Math.max(0, Number(amount));
    if (payAmount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    const txDate = date || getLocalIsoDate();
    const now = new Date().toISOString();

    const preSummary = get().getCreditCardSummary(cardAccountId, txDate);
    const resolvedStatementId = statementId || preSummary?.currentBilledStatement?.id || null;

    const billsCategory =
      get().categories.find((c) => c.slug === 'utilities-bills') ||
      get().categories[0];

    // 1. Add transfer transaction from Bank -> Credit Card with isCreditCardPayment: true
    const tx = await get().addTransaction({
      title: `${card.name} Bill Payment`,
      amount: payAmount,
      type: 'transfer',
      categoryId: billsCategory?.id || 'default',
      accountId: fromAccountId,
      toAccountId: cardAccountId,
      date: txDate,
      notes: note || `Payment toward ${card.name}`,
      tags: ['credit-card-payment'],
      statementCycleKey: null,
      paidStatementId: resolvedStatementId,
      isCreditCardPayment: true,
    } as any);

    // 2. Waterfall allocate payment across statements in Dexie
    const currentStatements = await db.creditCardStatements
      .where('accountId')
      .equals(cardAccountId)
      .filter((s) => !s.deletedAt)
      .toArray();

    if (currentStatements.length > 0) {
      const { updatedStatements } = allocatePaymentToStatements(
        currentStatements,
        payAmount,
        resolvedStatementId
      );

      for (const updated of updatedStatements) {
        // Only write paidAmount onto the directly linked statement so secondary waterfall targets
        // aren't double-counted by computeCreditCardSummary
        const isDirectlyLinked =
          Boolean(resolvedStatementId) &&
          (updated.id === resolvedStatementId || updated.cycleKey === resolvedStatementId);
        await db.creditCardStatements.update(updated.id, {
          ...(isDirectlyLinked ? { paidAmount: updated.paidAmount } : {}),
          remainingDue: updated.remainingDue,
          status: updated.status,
          paidAt: updated.paidAt,
          updatedAt: now,
          isDirty: true,
        });
      }
    }

    // 3. Re-sync statements & refresh store
    await get().syncCardStatements(cardAccountId);
    notifyFinanceSync();
    return tx;
  },

  reconcileCreditCardStatement: async (params) => {
    const { cardAccountId, cycleKey, actualStatementAmount, note } = params;
    const card = get().accounts.find((a) => a.id === cardAccountId);
    if (!card) {
      throw new Error('Card account not found');
    }

    const now = new Date().toISOString();
    const userId = card.userId;
    const { billingDay, dueDay, gracePeriodDays } = resolveCardBillingConfig(card);

    const [cYear, cMonth] = cycleKey.split('-').map(Number);
    const window = getCycleWindowForMonth(billingDay, dueDay, cYear, cMonth - 1, gracePeriodDays);

    const cardTxs = get().transactions.filter(
      (t) => t.accountId === cardAccountId && !t.deletedAt && !t.isCreditCardPayment && t.type !== 'transfer'
    );
    let calculatedAmount = 0;
    for (const tx of cardTxs) {
      const txCycle = resolveTransactionCycle(tx.date, billingDay, dueDay, tx.statementCycleKey);
      if (txCycle === cycleKey) {
        if (tx.type === 'income') calculatedAmount = roundCurrency(calculatedAmount - tx.amount);
        else calculatedAmount = roundCurrency(calculatedAmount + tx.amount);
      }
    }

    const actual = roundCurrency(Math.max(0, Number(actualStatementAmount)));
    const manualAdjustment = roundCurrency(actual - calculatedAmount);

    const existing = await db.creditCardStatements
      .where('accountId')
      .equals(cardAccountId)
      .filter((s) => s.cycleKey === cycleKey && !s.deletedAt)
      .first();

    let statement: CreditCardStatement;
    if (existing) {
      const totalDue = roundCurrency(
        Math.max(0, calculatedAmount + manualAdjustment + (existing.carriedForwardAmount || 0))
      );
      const remainingDue = roundCurrency(Math.max(0, totalDue - existing.paidAmount));
      let status = existing.status;
      if (remainingDue === 0 && totalDue > 0) status = 'paid';
      else if (existing.paidAmount > 0) status = 'partial';
      else status = 'billed';

      statement = {
        ...existing,
        calculatedAmount,
        manualAdjustment,
        totalDue,
        remainingDue,
        status,
        notes: note || existing.notes,
        updatedAt: now,
        isDirty: true,
      };
      await db.creditCardStatements.put(statement);
    } else {
      statement = {
        id: `${cardAccountId}_${cycleKey}`,
        userId,
        accountId: cardAccountId,
        cycleKey,
        periodStart: window.periodStart,
        periodEnd: window.periodEnd,
        dueDate: window.dueDate,
        calculatedAmount,
        manualAdjustment,
        totalDue: actual,
        carriedForwardAmount: 0,
        paidAmount: 0,
        remainingDue: actual,
        status: 'billed',
        notes: note,
        isDirty: true,
        createdAt: now,
        updatedAt: now,
      };
      await db.creditCardStatements.put(statement);
    }

    await get().loadFinanceData(userId);
    notifyFinanceSync();
    return statement;
  },

  moveTransactionToCycle: async (transactionId: string, targetCycleKey: string | null) => {
    const tx = get().transactions.find((t) => t.id === transactionId);
    if (!tx) return;
    const now = new Date().toISOString();

    await db.financeTransactions.update(transactionId, {
      statementCycleKey: targetCycleKey,
      updatedAt: now,
      isDirty: true,
    });

    const account = get().accounts.find((a) => a.id === tx.accountId);
    if (account?.userId) {
      await get().loadFinanceData(account.userId);
      await get().syncCardStatements(account.id);
    }
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
