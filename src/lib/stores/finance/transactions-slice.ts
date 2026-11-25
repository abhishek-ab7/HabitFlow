import { toast } from 'sonner';
import { db } from '@/lib/db';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { classifyCategoryBridgeKind } from '@/lib/fitness/finance-bridge';
import { estimateHinglishFoodMacros } from '@/lib/fitness/meal-estimator';
import { CrossDomainActionMediator } from '../mediator';
import type {
  DebtInstallment,
  DebtRecord,
  FinanceCategory,
  FinanceTransaction,
} from '@/lib/types';
import {
  formatINR,
  notifyFinanceSync,
  resolveCurrentUserId,
  type FinanceSliceCreator,
  type FinanceStore,
} from './helpers';

export type TransactionsSlice = Pick<
  FinanceStore,
  | 'addTransaction'
  | 'addSplitTransactions'
  | 'updateTransaction'
  | 'deleteTransaction'
  | 'approveReviewedTransaction'
  | 'bulkUpdateTransactions'
  | 'bulkDeleteTransactions'
  | 'splitTransactionWithFriend'
  | 'importTransactionsCsv'
  | 'attachTransactionToCommitment'
>;

async function reconcileFinanceBridgeMealForTransaction(
  tx: FinanceTransaction,
  categories: FinanceCategory[]
) {
  try {
    const { useFitnessStore } = await import('../fitness');
    const fitState = useFitnessStore.getState();
    const cat = categories.find((c) => c.id === tx.categoryId);
    const isActiveJunkExpense =
      !tx.deletedAt &&
      tx.type === 'expense' &&
      classifyCategoryBridgeKind(cat) === 'junk';

    const dbLinked = db.mealLogs
      ? await db.mealLogs.where('linkedTransactionId').equals(tx.id).toArray()
      : [];
    const seenIds = new Set<string>();
    const linkedMeals = [...fitState.mealLogs, ...dbLinked].filter((m) => {
      if (seenIds.has(m.id)) return false;
      seenIds.add(m.id);
      return !m.deletedAt && m.linkedTransactionId === tx.id;
    });

    if (!isActiveJunkExpense) {
      for (const m of linkedMeals) {
        if (m.source === 'finance_bridge') {
          await fitState.deleteMealLog(m.id);
        }
      }
      return;
    }

    const bridgeMeals = linkedMeals.filter((m) => m.source === 'finance_bridge');
    if (bridgeMeals.length > 0) {
      const estimate = estimateHinglishFoodMacros(tx.title, {
        amountInr: tx.amount,
        forceJunk: true,
      });
      const now = new Date().toISOString();
      for (const meal of bridgeMeals) {
        const updatedMeal = {
          ...meal,
          date: tx.date,
          mealType: estimate.mealType,
          name: tx.title.trim() || estimate.name,
          calories: estimate.calories,
          proteinG: estimate.proteinG,
          carbsG: estimate.carbsG,
          fatG: estimate.fatG,
          isJunk: true,
          notes: tx.notes || `Auto-logged from Junk Food expense (₹${Math.round(tx.amount)})`,
          generationCounter: (meal.generationCounter || 1) + 1,
          isDirty: true,
          updatedAt: now,
        };
        await db.mealLogs.put(updatedMeal);
        useFitnessStore.setState((state) => ({
          mealLogs: state.mealLogs
            .map((m) => (m.id === updatedMeal.id ? updatedMeal : m))
            .sort(
              (a, b) =>
                b.date.localeCompare(a.date) || b.loggedAt.localeCompare(a.loggedAt)
            ),
        }));
      }
    } else if (linkedMeals.length === 0) {
      await fitState.ensureMealForJunkTransaction({
        transactionId: tx.id,
        userId: tx.userId,
        date: tx.date,
        title: tx.title,
        amountInr: tx.amount,
        notes: tx.notes,
      });
    }
  } catch {
    // Non-blocking fitness bridge reconciliation
  }
}

export const createTransactionsSlice: FinanceSliceCreator<TransactionsSlice> = (_set, get) => ({
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
      statementCycleKey: data.statementCycleKey || null,
      paidStatementId: data.paidStatementId || null,
      isCreditCardPayment: data.isCreditCardPayment ?? false,
      merchantName: data.merchantName?.trim(),
      rawMerchant: data.rawMerchant?.trim(),
      needsReview: data.needsReview ?? false,
      splitGroupId: data.splitGroupId || null,
      isDirty: true,
      generationCounter: 1,
      createdAt: now,
      updatedAt: now,
    };

    const account = get().accounts.find((a) => a.id === data.accountId);
    if (account) {
      const delta = data.type === 'income' ? tx.amount : -tx.amount;
      await db.financeAccounts.update(account.id, {
        balance: account.balance + delta,
        isDirty: true,
        updatedAt: now,
      });
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
    await get().recordCurrentNetWorthSnapshot(monthKey);
    const toAcc = data.type === 'transfer' && data.toAccountId ? get().accounts.find((a) => a.id === data.toAccountId) : null;
    if (account?.type === 'credit_card' || toAcc?.type === 'credit_card') {
      await get().syncCardStatements(account?.type === 'credit_card' ? account.id : toAcc?.id);
    }
    notifyFinanceSync();

    const txCategory =
      get().categories.find((c) => c.id === tx.categoryId) ||
      (await db.financeCategories.get(tx.categoryId));

    if (tx.type === 'expense') {
      const cat = txCategory;
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

    try {
      await CrossDomainActionMediator.onFinanceEvent({
        type: 'EXPENSE_LOGGED',
        date: tx.date,
        amount: tx.amount,
        transaction: tx,
        category: txCategory,
        skipAutoDietBridge: data.skipAutoDietBridge,
      });
    } catch {
      // Non-blocking gamification & cross-domain hook
    }

    return tx;
  },

  addSplitTransactions: async ({ base, splits }) => {
    const validSplits = splits.filter((s) => s.amount > 0 && s.categoryId);
    if (validSplits.length === 0) return [];
    const splitGroupId = crypto.randomUUID();
    const created: FinanceTransaction[] = [];

    for (let i = 0; i < validSplits.length; i++) {
      const part = validSplits[i];
      const cat = get().categories.find((c) => c.id === part.categoryId);
      const tx = await get().addTransaction({
        ...base,
        title: `${base.title.trim()} (${cat?.name || `Part ${i + 1}`})`,
        amount: Number(part.amount),
        categoryId: part.categoryId,
        subcategory: part.subcategory || base.subcategory,
        notes: [base.notes, part.note].filter(Boolean).join(' · '),
        tags: Array.from(new Set([...(base.tags || []), 'multi-split'])),
        splitGroupId,
      });
      created.push(tx);
    }

    return created;
  },

  updateTransaction: async (id, data) => {
    const existing = get().transactions.find((t) => t.id === id);
    if (!existing) return;
    const userId = existing.userId;
    const now = new Date().toISOString();

    if (data.amount !== undefined && data.amount !== existing.amount) {
      const account = get().accounts.find((a) => a.id === existing.accountId);
      if (account) {
        const diff = data.amount - existing.amount;
        const balanceAdjustment = existing.type === 'income' ? diff : -diff;
        await db.financeAccounts.update(account.id, {
          balance: account.balance + balanceAdjustment,
          isDirty: true,
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
    await get().recordCurrentNetWorthSnapshot(updatedDate.slice(0, 7));
    const affectedAcc = get().accounts.find((a) => a.id === (data.accountId || existing.accountId));
    if (affectedAcc?.type === 'credit_card') {
      await get().syncCardStatements(affectedAcc.id);
    }
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

    try {
      const updatedTx =
        get().transactions.find((t) => t.id === id) ||
        (await db.financeTransactions.get(id));
      if (updatedTx) {
        await reconcileFinanceBridgeMealForTransaction(updatedTx, get().categories);
      }
      await CrossDomainActionMediator.evaluateNoSpendDayRules(updatedDate);
      await CrossDomainActionMediator.evaluateZeroJunkRules(updatedDate);
      if (existing.date && existing.date.slice(0, 10) !== updatedDate.slice(0, 10)) {
        await CrossDomainActionMediator.evaluateNoSpendDayRules(existing.date);
        await CrossDomainActionMediator.evaluateZeroJunkRules(existing.date);
      }
    } catch {
      // Non-blocking gamification hook
    }
  },

  deleteTransaction: async (id) => {
    const existing = get().transactions.find((t) => t.id === id);
    if (!existing) return;
    const userId = existing.userId;
    const now = new Date().toISOString();

    const account = get().accounts.find((a) => a.id === existing.accountId);
    if (account) {
      const reverseDelta = existing.type === 'income' ? -existing.amount : existing.amount;
      await db.financeAccounts.update(account.id, {
        balance: account.balance + reverseDelta,
        isDirty: true,
        updatedAt: now,
      });
    }

    if (existing.type === 'transfer' && existing.toAccountId) {
      const toAcc = get().accounts.find((a) => a.id === existing.toAccountId);
      if (toAcc) {
        await db.financeAccounts.update(toAcc.id, {
          balance: toAcc.balance - existing.amount,
          isDirty: true,
          updatedAt: now,
        });
      }
    }

    if (existing.linkedDebtId && existing.linkedDebtInstallmentId) {
      const debt = get().debtRecords.find((d) => d.id === existing.linkedDebtId);
      if (debt) {
        const newRepaid = Math.max(0, debt.totalRepaidAmount - existing.amount);
        const newRemaining = Math.max(0, debt.principalAmount - newRepaid);
        await db.debtRecords.update(debt.id, {
          totalRepaidAmount: newRepaid,
          remainingAmount: newRemaining,
          status: newRemaining > 0 ? 'active' : 'settled',
          isDirty: true,
          updatedAt: now,
        });
      }
      await db.debtInstallments.update(existing.linkedDebtInstallmentId, {
        deletedAt: now,
        isDirty: true,
        updatedAt: now,
      });
    }

    await db.financeTransactions.update(id, { deletedAt: now, isDirty: true, updatedAt: now });
    await get().loadFinanceData(userId);
    await get().recordCurrentNetWorthSnapshot();
    if (account?.type === 'credit_card') {
      await get().syncCardStatements(account.id);
    }
    notifyFinanceSync();

    try {
      const { useFitnessStore } = await import('../fitness');
      const fitState = useFitnessStore.getState();
      const dbLinked = db.mealLogs
        ? await db.mealLogs.where('linkedTransactionId').equals(id).toArray()
        : [];
      const seenIds = new Set<string>();
      const linkedAutoMeals = [...fitState.mealLogs, ...dbLinked].filter((m) => {
        if (seenIds.has(m.id)) return false;
        seenIds.add(m.id);
        return (
          !m.deletedAt &&
          m.linkedTransactionId === id &&
          m.source === 'finance_bridge'
        );
      });
      for (const m of linkedAutoMeals) {
        await fitState.deleteMealLog(m.id);
      }
    } catch {
      // Non-blocking fitness bridge cleanup
    }

    try {
      if (existing.date) {
        await CrossDomainActionMediator.evaluateNoSpendDayRules(existing.date);
        await CrossDomainActionMediator.evaluateZeroJunkRules(existing.date);
      }
    } catch {
      // Non-blocking gamification hook
    }
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
    const affectedDates = new Set<string>();
    for (const id of ids) {
      const prev = get().transactions.find((t) => t.id === id);
      if (prev?.date) affectedDates.add(prev.date.slice(0, 10));
    }

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

    try {
      const categories = get().categories;
      for (const id of ids) {
        const tx =
          get().transactions.find((t) => t.id === id) ||
          (await db.financeTransactions.get(id));
        if (tx) {
          await reconcileFinanceBridgeMealForTransaction(tx, categories);
        }
      }
      for (const d of affectedDates) {
        await CrossDomainActionMediator.evaluateNoSpendDayRules(d);
        await CrossDomainActionMediator.evaluateZeroJunkRules(d);
      }
    } catch {
      // Non-blocking gamification & fitness bridge reconciliation
    }
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
    const cleanFriendName = friendName.trim();
    const totalOutflow = Math.max(0, Number(txData.amount) || 0);
    const friendPortion = Math.max(0, Math.min(totalOutflow, Number(friendShareAmount) || 0));
    const roundedFriendPortion = Math.round(friendPortion * 100) / 100;
    const roundedMyShare = Math.round(Math.max(0, totalOutflow - roundedFriendPortion) * 100) / 100;
    const splitGroupId = crypto.randomUUID();

    // Find EMIs & Debt category for friend portion (slug: 'emis-debt-repayment')
    const debtCat =
      get().categories.find((c) => c.slug === 'emis-debt-repayment') ||
      get().categories.find((c) => c.name.toLowerCase().includes('debt') || c.name.toLowerCase().includes('emi')) ||
      get().categories[0];

    // Find existing debt if specified or look for active everyday split with friend
    let debtRecord: DebtRecord | undefined;
    if (existingDebtId) {
      debtRecord = get().debtRecords.find((d) => d.id === existingDebtId);
    } else {
      debtRecord = get().debtRecords.find(
        (d) =>
          d.bucketType === 'everyday_split' &&
          d.status === 'active' &&
          d.personName.trim().toLowerCase() === cleanFriendName.toLowerCase()
      );
    }

    // 1. User share leg: Only create if myShare > 0 or if friendPortion === 0 (boundary case)
    let userTx: FinanceTransaction | undefined;
    if (roundedMyShare > 0 || roundedFriendPortion === 0) {
      userTx = await get().addTransaction({
        ...txData,
        amount: roundedMyShare,
        splitGroupId,
        notes: `${txData.notes ? txData.notes + ' · ' : ''}Split with ${cleanFriendName} (Your share: ${formatINR(
          roundedMyShare
        )}, ${cleanFriendName} owes: ${formatINR(roundedFriendPortion)})`,
        tags: Array.from(new Set([...(txData.tags || []), 'split', cleanFriendName.toLowerCase()])),
      });
    }

    // 2. Friend share leg & Debt handling: Only if friendPortion > 0
    let friendTx: FinanceTransaction | undefined;
    if (roundedFriendPortion > 0) {
      if (debtRecord && debtRecord.direction === 'borrowed') {
        // User owes friend money: Swipe on card pays down user's debt to friend
        const installment = await get().recordDebtInstallment({
          debtId: debtRecord.id,
          amount: roundedFriendPortion,
          date: txData.date,
          accountId: txData.accountId,
          paymentMethod: 'offset_expense',
          note: `Repayment via split: ${txData.title}`,
          splitGroupId,
        });
        debtRecord = get().debtRecords.find((d) => d.id === debtRecord!.id);
        if (installment?.transactionId) {
          friendTx = get().transactions.find((t) => t.id === installment.transactionId);
        }
      } else {
        // Friend owes user: create expense on same account under debt category
        friendTx = await get().addTransaction({
          title: `${cleanFriendName}'s Share: ${txData.title}`,
          amount: roundedFriendPortion,
          type: 'expense',
          categoryId: debtCat.id,
          subcategory: 'Friend Split',
          accountId: txData.accountId,
          date: txData.date,
          notes: `Friend split portion for ${cleanFriendName} · ${txData.title}`,
          tags: Array.from(
            new Set([...(txData.tags || []), 'split', cleanFriendName.toLowerCase(), 'friend-share'])
          ),
          splitGroupId,
        });

        if (debtRecord && debtRecord.direction === 'lent') {
          await get().topUpDebt(
            debtRecord.id,
            roundedFriendPortion,
            `Split: ${txData.title} (${txData.date})`
          );
          debtRecord = get().debtRecords.find((d) => d.id === debtRecord!.id);
        } else {
          debtRecord = await get().addDebtRecord({
            personName: cleanFriendName,
            direction: 'lent',
            title: `Everyday Split: ${txData.title}`,
            principalAmount: roundedFriendPortion,
            startDate: txData.date,
            repaymentSchedule: 'flexible',
            bucketType: 'everyday_split',
            color: '#10b981',
            notes: `Created from split expense "${txData.title}" on ${txData.date}`,
          });
        }
      }
    } else if (!debtRecord) {
      debtRecord = await get().addDebtRecord({
        personName: cleanFriendName,
        direction: 'lent',
        title: `Everyday Split: ${txData.title}`,
        principalAmount: 0,
        startDate: txData.date,
        repaymentSchedule: 'flexible',
        bucketType: 'everyday_split',
        color: '#10b981',
      });
    }

    await get().loadFinanceData(userId);
    const account = get().accounts.find((a) => a.id === txData.accountId);
    if (account?.type === 'credit_card') {
      await get().syncCardStatements(account.id);
    }

    const primaryTx = userTx || friendTx;
    return { transaction: primaryTx!, debt: debtRecord! };
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
    const todayStr = getLocalIsoDate();

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
            dateStr = getLocalIsoDate(d);
          }
        }
      }

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
});
