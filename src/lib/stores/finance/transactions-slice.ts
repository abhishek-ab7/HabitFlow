import { toast } from 'sonner';
import { db } from '@/lib/db';
import { CrossDomainActionMediator } from '../mediator';
import type {
  DebtInstallment,
  DebtRecord,
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

    if (tx.type === 'expense') {
      const cat = get().categories.find((c) => c.id === tx.categoryId);
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
      });
    } catch {
      // Non-blocking gamification hook
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
    const now = new Date().toISOString();
    const totalOutflow = Number(txData.amount);
    const friendPortion = Math.max(0, Math.min(totalOutflow, Number(friendShareAmount)));
    const myShare = Math.max(0, totalOutflow - friendPortion);
    const splitGroupId = crypto.randomUUID();

    const tx = await get().addTransaction({
      ...txData,
      amount: myShare,
      splitGroupId,
      notes: `${txData.notes ? txData.notes + ' · ' : ''}Split with ${friendName} (Your share: ${formatINR(
        myShare
      )}, ${friendName} owes: ${formatINR(friendPortion)})`,
      tags: Array.from(new Set([...(txData.tags || []), 'split', friendName.toLowerCase()])),
    });

    if (friendPortion > 0) {
      const account = get().accounts.find((a) => a.id === txData.accountId);
      if (account) {
        await db.financeAccounts.update(account.id, {
          balance: account.balance - friendPortion,
          isDirty: true,
          updatedAt: now,
        });
      }
    }

    let debtRecord: DebtRecord | undefined;
    if (existingDebtId) {
      debtRecord = get().debtRecords.find((d) => d.id === existingDebtId);
    } else {
      debtRecord = get().debtRecords.find(
        (d) =>
          d.bucketType === 'everyday_split' &&
          d.direction === 'lent' &&
          d.status === 'active' &&
          d.personName.trim().toLowerCase() === friendName.trim().toLowerCase()
      );
    }

    if (debtRecord && friendPortion > 0) {
      if (debtRecord.direction === 'borrowed') {
        await get().recordDebtInstallment({
          debtId: debtRecord.id,
          amount: friendPortion,
          date: txData.date,
          paymentMethod: 'offset_expense',
          note: `Repayment via split: ${txData.title}`,
        });
      } else {
        await get().topUpDebt(
          debtRecord.id,
          friendPortion,
          `Split: ${txData.title} (${txData.date})`
        );
      }
      debtRecord = get().debtRecords.find((d) => d.id === debtRecord!.id);
    } else if (friendPortion > 0) {
      debtRecord = await get().addDebtRecord({
        personName: friendName.trim(),
        direction: 'lent',
        title: `Everyday Split: ${txData.title}`,
        principalAmount: friendPortion,
        startDate: txData.date,
        repaymentSchedule: 'flexible',
        bucketType: 'everyday_split',
        color: '#10b981',
        notes: `Created from split expense "${txData.title}" on ${txData.date}`,
      });
    } else {
      debtRecord = await get().addDebtRecord({
        personName: friendName.trim(),
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
    return { transaction: tx, debt: debtRecord! };
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
    const todayStr = new Date().toISOString().split('T')[0];

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
            dateStr = d.toISOString().split('T')[0];
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
