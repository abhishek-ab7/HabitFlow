import { db } from '@/lib/db';
import { CrossDomainActionMediator } from '../mediator';
import type { FinanceCategory, FinanceTransaction, FinanceTransactionFormData } from '@/lib/types';
import {
  notifyFinanceSync,
  resolveCurrentUserId,
  type FinanceSliceCreator,
  type FinanceStore,
} from './helpers';
import {
  cleanupBridgeMealsForDeletedTx,
  reconcileFinanceBridgeMealForTransaction,
} from './transactions/bridge-reconciler';
import {
  adjustAccountBalance,
  notifyBudgetThresholdIfExceeded,
  recordLinkedDebtOffset,
  revertLinkedDebtOffset,
} from './transactions/tx-helpers';
import { buildNewTransaction } from './transactions/tx-builder';
import { importTransactionsCsvImpl } from './transactions/csv-importer';
import { splitTransactionWithFriendImpl } from './transactions/friend-split';

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

async function emitExpenseMediatorEvent(
  tx: FinanceTransaction,
  txCategory: FinanceCategory | undefined,
  skipAutoDietBridge?: boolean
): Promise<void> {
  try {
    await CrossDomainActionMediator.onFinanceEvent({
      type: 'EXPENSE_LOGGED',
      date: tx.date,
      amount: tx.amount,
      transaction: tx,
      category: txCategory,
      skipAutoDietBridge,
    });
  } catch {
    // Non-blocking gamification & cross-domain hook
  }
}

async function evaluateHabitRulesForDate(date?: string): Promise<void> {
  if (!date) return;
  try {
    await CrossDomainActionMediator.evaluateNoSpendDayRules(date);
    await CrossDomainActionMediator.evaluateZeroJunkRules(date);
  } catch {
    // Non-blocking gamification hook
  }
}

async function syncCardIfApplicable(state: FinanceStore, accountId?: string): Promise<void> {
  if (!accountId) return;
  const acc = state.accounts.find((a) => a.id === accountId);
  if (acc?.type === 'credit_card') await state.syncCardStatements(acc.id);
}

async function finalizeTransactionAdd(
  getState: () => FinanceStore,
  tx: FinanceTransaction,
  data: FinanceTransactionFormData
): Promise<void> {
  await getState().loadFinanceData(tx.userId);
  await getState().recordCurrentNetWorthSnapshot(tx.monthKey);
  await syncCardIfApplicable(getState(), data.accountId);
  if (data.type === 'transfer') await syncCardIfApplicable(getState(), data.toAccountId);
  notifyFinanceSync();

  const fresh = getState();
  const txCategory =
    fresh.categories.find((c) => c.id === tx.categoryId) ||
    (await db.financeCategories.get(tx.categoryId));

  if (tx.type === 'expense') {
    notifyBudgetThresholdIfExceeded({
      cat: txCategory,
      transactions: fresh.transactions,
      monthKey: tx.monthKey,
    });
  }
  await emitExpenseMediatorEvent(tx, txCategory, data.skipAutoDietBridge);
}

async function reconcileUpdatedTransaction(
  state: FinanceStore,
  id: string,
  existing: FinanceTransaction,
  updatedDate: string
): Promise<void> {
  const updatedTx = state.transactions.find((t) => t.id === id) || (await db.financeTransactions.get(id));
  if (updatedTx) await reconcileFinanceBridgeMealForTransaction(updatedTx, state.categories);
  await evaluateHabitRulesForDate(updatedDate);
  if (existing.date && existing.date.slice(0, 10) !== updatedDate.slice(0, 10)) {
    await evaluateHabitRulesForDate(existing.date);
  }
}

async function persistTransactionUpdate(
  state: FinanceStore,
  existing: FinanceTransaction,
  data: Partial<FinanceTransactionFormData>
): Promise<string> {
  const now = new Date().toISOString();
  if (data.amount !== undefined && data.amount !== existing.amount) {
    const account = state.accounts.find((a) => a.id === existing.accountId);
    const diff = data.amount - existing.amount;
    await adjustAccountBalance(account, existing.type === 'income' ? diff : -diff, now);
  }

  const updatedDate = data.date || existing.date;
  await db.financeTransactions.update(existing.id, {
    ...data,
    monthKey: updatedDate.slice(0, 7),
    isDirty: true,
    updatedAt: now,
  });
  return updatedDate;
}

async function persistBulkTxUpdates(
  ids: string[],
  updates: Partial<FinanceTransactionFormData>,
  now: string
): Promise<void> {
  await db.transaction('rw', db.financeTransactions, async () => {
    for (const id of ids) {
      await db.financeTransactions.update(id, { ...updates, isDirty: true, updatedAt: now });
    }
  });
}

async function reconcileBulkUpdatedTxs(
  getState: () => FinanceStore,
  ids: string[],
  affectedDates: Set<string>
): Promise<void> {
  const { categories, transactions } = getState();
  for (const id of ids) {
    const tx = transactions.find((t) => t.id === id) || (await db.financeTransactions.get(id));
    if (tx) await reconcileFinanceBridgeMealForTransaction(tx, categories);
  }
  for (const d of affectedDates) {
    await evaluateHabitRulesForDate(d);
  }
}

async function bulkUpdateTransactionsImpl(
  getState: () => FinanceStore,
  ids: string[],
  updates: Partial<FinanceTransactionFormData>
): Promise<void> {
  if (ids.length === 0) return;
  const state = getState();
  const userId = await resolveCurrentUserId(undefined, state.currentUserId);
  const affectedDates = new Set(
    ids
      .map((id) => state.transactions.find((t) => t.id === id)?.date?.slice(0, 10))
      .filter((d): d is string => Boolean(d))
  );

  await persistBulkTxUpdates(ids, updates, new Date().toISOString());
  await getState().loadFinanceData(userId);
  notifyFinanceSync();
  await reconcileBulkUpdatedTxs(getState, ids, affectedDates);
}

export const createTransactionsSlice: FinanceSliceCreator<TransactionsSlice> = (_set, get) => ({
  addTransaction: async (data) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();
    const tx = buildNewTransaction(data, userId, now);

    const account = get().accounts.find((a) => a.id === data.accountId);
    await adjustAccountBalance(account, data.type === 'income' ? tx.amount : -tx.amount, now);

    const toAcc =
      data.type === 'transfer' && data.toAccountId
        ? get().accounts.find((a) => a.id === data.toAccountId)
        : undefined;
    await adjustAccountBalance(toAcc, tx.amount, now);

    const debt = tx.linkedDebtId ? get().debtRecords.find((d) => d.id === tx.linkedDebtId) : undefined;
    if (debt) await recordLinkedDebtOffset({ tx, debt, userId, now });

    await db.financeTransactions.add(tx);
    await finalizeTransactionAdd(get, tx, data);
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
    const updatedDate = await persistTransactionUpdate(get(), existing, data);
    const updatedMonthKey = updatedDate.slice(0, 7);

    await get().loadFinanceData(existing.userId);
    await get().recordCurrentNetWorthSnapshot(updatedMonthKey);
    await syncCardIfApplicable(get(), data.accountId || existing.accountId);
    notifyFinanceSync();

    if ((data.type || existing.type) === 'expense') {
      const cat = get().categories.find((c) => c.id === (data.categoryId || existing.categoryId));
      notifyBudgetThresholdIfExceeded({ cat, transactions: get().transactions, monthKey: updatedMonthKey });
    }
    await reconcileUpdatedTransaction(get(), id, existing, updatedDate);
  },

  deleteTransaction: async (id) => {
    const existing = get().transactions.find((t) => t.id === id);
    if (!existing) return;
    const now = new Date().toISOString();

    const account = get().accounts.find((a) => a.id === existing.accountId);
    await adjustAccountBalance(
      account,
      existing.type === 'income' ? -existing.amount : existing.amount,
      now
    );

    const toAcc =
      existing.type === 'transfer' && existing.toAccountId
        ? get().accounts.find((a) => a.id === existing.toAccountId)
        : undefined;
    await adjustAccountBalance(toAcc, -existing.amount, now);

    const linkedDebt = existing.linkedDebtId
      ? get().debtRecords.find((d) => d.id === existing.linkedDebtId)
      : undefined;
    await revertLinkedDebtOffset(existing, linkedDebt, now);

    await db.financeTransactions.update(id, { deletedAt: now, isDirty: true, updatedAt: now });
    await get().loadFinanceData(existing.userId);
    await get().recordCurrentNetWorthSnapshot();
    await syncCardIfApplicable(get(), account?.id);
    notifyFinanceSync();

    await cleanupBridgeMealsForDeletedTx(id);
    await evaluateHabitRulesForDate(existing.date);
  },

  approveReviewedTransaction: async (id) => {
    const existing = get().transactions.find((t) => t.id === id);
    if (!existing) return;
    await db.financeTransactions.update(id, {
      needsReview: false,
      isDirty: true,
      updatedAt: new Date().toISOString(),
    });
    await get().loadFinanceData(existing.userId);
    notifyFinanceSync();
  },

  bulkUpdateTransactions: (ids, updates) => bulkUpdateTransactionsImpl(get, ids, updates),

  bulkDeleteTransactions: async (ids) => {
    for (const id of ids) {
      await get().deleteTransaction(id);
    }
  },

  splitTransactionWithFriend: (params) => splitTransactionWithFriendImpl(get(), params),

  importTransactionsCsv: (csvText, defaultAccountId) =>
    importTransactionsCsvImpl(get(), csvText, defaultAccountId),

  attachTransactionToCommitment: async (
    transactionId,
    commitmentId,
    contributionType = 'offset_expense'
  ) => {
    const existing = get().transactions.find((t) => t.id === transactionId);
    if (!existing) return;
    await db.financeTransactions.update(transactionId, {
      linkedCommitmentId: commitmentId,
      commitmentContributionType: commitmentId ? contributionType : null,
      isDirty: true,
      updatedAt: new Date().toISOString(),
    });
    await get().loadFinanceData(existing.userId);
    notifyFinanceSync();
  },
});
