import { db } from '@/lib/db';
import { CrossDomainActionMediator } from '../mediator';
import type {
  DebtInstallment,
  DebtRecord,
  EmiTracker,
  FinanceRecurringBill,
  FinanceSipPlan,
  FinanceTransaction,
  MonthlyCommitment,
} from '@/lib/types';
import {
  formatINR,
  notifyFinanceSync,
  resolveCurrentUserId,
  type FinanceSliceCreator,
  type FinanceStore,
} from './helpers';

export type TrackersSlice = Pick<
  FinanceStore,
  | 'addCommitment'
  | 'updateCommitment'
  | 'deleteCommitment'
  | 'settleCommitmentBalance'
  | 'addDebtRecord'
  | 'updateDebtRecord'
  | 'recordDebtInstallment'
  | 'updateDebtInstallment'
  | 'deleteDebtInstallment'
  | 'topUpDebt'
  | 'deleteDebtRecord'
  | 'settleEverydayTab'
  | 'offsetSplitAgainstLoan'
  | 'addEmiTracker'
  | 'updateEmiTracker'
  | 'payMonthlyEmi'
  | 'deleteEmiTracker'
  | 'addSipPlan'
  | 'updateSipPlan'
  | 'deleteSipPlan'
  | 'payMonthlySip'
  | 'addRecurringBill'
  | 'updateRecurringBill'
  | 'deleteRecurringBill'
  | 'payRecurringBill'
>;

export const createTrackersSlice: FinanceSliceCreator<TrackersSlice> = (_set, get) => ({
  addCommitment: async (data) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();
    const commitment: MonthlyCommitment = {
      ...data,
      id: crypto.randomUUID(),
      userId,
      isDirty: true,
      generationCounter: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.monthlyCommitments.add(commitment);
    await get().loadFinanceData(userId);
    notifyFinanceSync();
    return commitment;
  },

  updateCommitment: async (id, data) => {
    const existing = get().commitments.find((c) => c.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    await db.monthlyCommitments.update(id, { ...data, isDirty: true, updatedAt: now });
    await get().loadFinanceData(existing.userId);
    notifyFinanceSync();
  },

  deleteCommitment: async (id) => {
    const existing = get().commitments.find((c) => c.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    await db.monthlyCommitments.update(id, {
      isActive: false,
      deletedAt: now,
      isDirty: true,
      updatedAt: now,
    });
    await get().loadFinanceData(existing.userId);
    notifyFinanceSync();
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
      bucketType: data.bucketType || 'long_term_loan',
      isEmi: !!data.isEmi,
      paidInstallments: data.paidInstallments || 0,
      id: crypto.randomUUID(),
      userId,
      totalRepaidAmount: 0,
      remainingAmount: Number(data.principalAmount),
      status: 'active',
      isDirty: true,
      generationCounter: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.debtRecords.add(record);
    await get().loadFinanceData(userId);
    await get().recordCurrentNetWorthSnapshot();
    notifyFinanceSync();
    return record;
  },

  updateDebtRecord: async (id, data) => {
    const existing =
      get().debtRecords.find((d) => d.id === id) || (await db.debtRecords.get(id));
    if (!existing) return;

    const now = new Date().toISOString();
    const nextPrincipal =
      data.principalAmount !== undefined
        ? Math.max(0, Number(data.principalAmount))
        : existing.principalAmount;
    const nextRepaid =
      data.totalRepaidAmount !== undefined
        ? Math.max(0, Number(data.totalRepaidAmount))
        : existing.totalRepaidAmount;
    const nextRemaining = Math.max(0, nextPrincipal - nextRepaid);

    let nextStatus = existing.status;
    if (data.status === 'archived') {
      nextStatus = 'archived';
    } else if (data.status) {
      nextStatus = data.status;
    } else if (existing.status !== 'archived') {
      nextStatus = nextRemaining <= 0 ? 'settled' : 'active';
    }

    const nextDirection = data.direction ?? existing.direction;
    const nextColor =
      data.color ??
      (data.direction && data.direction !== existing.direction
        ? nextDirection === 'borrowed'
          ? '#f43f5e'
          : '#10b981'
        : existing.color);

    await db.debtRecords.update(id, {
      ...data,
      direction: nextDirection,
      color: nextColor,
      principalAmount: nextPrincipal,
      totalRepaidAmount: nextRepaid,
      remainingAmount: nextRemaining,
      status: nextStatus,
      isDirty: true,
      generationCounter: (existing.generationCounter || 1) + 1,
      updatedAt: now,
    });

    await get().loadFinanceData(existing.userId);
    await get().recordCurrentNetWorthSnapshot();
    notifyFinanceSync();
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
        isDirty: true,
        generationCounter: 1,
        createdAt: now,
        updatedAt: now,
      };

      await db.financeTransactions.add(tx);

      const balanceDelta = txType === 'income' ? Number(amount) : -Number(amount);
      await db.financeAccounts.update(selectedAccount.id, {
        balance: selectedAccount.balance + balanceDelta,
        isDirty: true,
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
      isDirty: true,
      generationCounter: 1,
      createdAt: now,
      updatedAt: now,
    };

    await db.debtInstallments.add(installment);
    const newPaidInstallments = debt.isEmi
      ? (debt.paidInstallments || 0) + 1
      : debt.paidInstallments;
    await db.debtRecords.update(debt.id, {
      totalRepaidAmount: newRepaid,
      remainingAmount: newRemaining,
      status: newStatus,
      paidInstallments: newPaidInstallments,
      isDirty: true,
      updatedAt: now,
    });

    await get().loadFinanceData(userId);
    await get().recordCurrentNetWorthSnapshot(monthKey);
    notifyFinanceSync();

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

  updateDebtInstallment: async (id, data) => {
    const existing = await db.debtInstallments.get(id);
    if (!existing || existing.deletedAt) return;
    const debt = await db.debtRecords.get(existing.debtId);
    if (!debt) return;

    const now = new Date().toISOString();
    const nextAmount =
      data.amount !== undefined ? Math.max(1, Number(data.amount)) : existing.amount;
    const nextDate = data.date || existing.date;
    const nextMonthKey = nextDate.slice(0, 7);
    const amountDelta = nextAmount - existing.amount;

    await db.debtInstallments.update(id, {
      amount: nextAmount,
      date: nextDate,
      monthKey: nextMonthKey,
      paymentMethod: data.paymentMethod ?? existing.paymentMethod,
      note: data.note !== undefined ? data.note : existing.note,
      isDirty: true,
      generationCounter: (existing.generationCounter || 1) + 1,
      updatedAt: now,
    });

    // Recompute chronological balances across all active installments for this debt
    const allInsts = (
      await db.debtInstallments.where('debtId').equals(debt.id).toArray()
    )
      .filter((item) => !item.deletedAt)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

    let runningRepaid = 0;
    for (const item of allInsts) {
      runningRepaid += Number(item.amount || 0);
      const balAfter = Math.max(0, debt.principalAmount - runningRepaid);
      if (item.balanceAfterPayment !== balAfter || item.id === id) {
        await db.debtInstallments.update(item.id, {
          balanceAfterPayment: balAfter,
          isDirty: true,
          generationCounter: (item.generationCounter || 1) + 1,
          updatedAt: now,
        });
      }
    }

    const newRemaining = Math.max(0, debt.principalAmount - runningRepaid);
    const newStatus = debt.status === 'archived' ? 'archived' : newRemaining <= 0 ? 'settled' : 'active';
    await db.debtRecords.update(debt.id, {
      totalRepaidAmount: runningRepaid,
      remainingAmount: newRemaining,
      status: newStatus,
      isDirty: true,
      generationCounter: (debt.generationCounter || 1) + 1,
      updatedAt: now,
    });

    // Sync linked transaction & account balance if one was recorded
    if (existing.transactionId) {
      const linkedTx = await db.financeTransactions.get(existing.transactionId);
      if (linkedTx && !linkedTx.deletedAt) {
        await db.financeTransactions.update(linkedTx.id, {
          amount: nextAmount,
          date: nextDate,
          monthKey: nextMonthKey,
          notes:
            data.note !== undefined
              ? data.note || `Installment (${formatINR(nextAmount)}). Remaining: ${formatINR(newRemaining)}`
              : linkedTx.notes,
          isDirty: true,
          generationCounter: (linkedTx.generationCounter || 1) + 1,
          updatedAt: now,
        });

        if (amountDelta !== 0) {
          const acc = await db.financeAccounts.get(linkedTx.accountId);
          if (acc) {
            const balanceDelta = linkedTx.type === 'income' ? amountDelta : -amountDelta;
            await db.financeAccounts.update(acc.id, {
              balance: acc.balance + balanceDelta,
              isDirty: true,
              generationCounter: (acc.generationCounter || 1) + 1,
              updatedAt: now,
            });
          }
        }
      }
    }

    await get().loadFinanceData(debt.userId);
    await get().recordCurrentNetWorthSnapshot(nextMonthKey);
    notifyFinanceSync();
  },

  deleteDebtInstallment: async (id) => {
    const existing = await db.debtInstallments.get(id);
    if (!existing || existing.deletedAt) return;
    const debt = await db.debtRecords.get(existing.debtId);
    if (!debt) return;

    const now = new Date().toISOString();
    await db.debtInstallments.update(id, {
      deletedAt: now,
      isDirty: true,
      generationCounter: (existing.generationCounter || 1) + 1,
      updatedAt: now,
    });

    if (existing.transactionId) {
      const linkedTx = await db.financeTransactions.get(existing.transactionId);
      if (linkedTx && !linkedTx.deletedAt) {
        const acc = await db.financeAccounts.get(linkedTx.accountId);
        if (acc) {
          const reverseDelta = linkedTx.type === 'income' ? -linkedTx.amount : linkedTx.amount;
          await db.financeAccounts.update(acc.id, {
            balance: acc.balance + reverseDelta,
            isDirty: true,
            generationCounter: (acc.generationCounter || 1) + 1,
            updatedAt: now,
          });
        }
        await db.financeTransactions.update(linkedTx.id, {
          deletedAt: now,
          isDirty: true,
          generationCounter: (linkedTx.generationCounter || 1) + 1,
          updatedAt: now,
        });
      }
    }

    const remainingInsts = (
      await db.debtInstallments.where('debtId').equals(debt.id).toArray()
    )
      .filter((item) => !item.deletedAt)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

    let runningRepaid = 0;
    for (const item of remainingInsts) {
      runningRepaid += Number(item.amount || 0);
      const balAfter = Math.max(0, debt.principalAmount - runningRepaid);
      if (item.balanceAfterPayment !== balAfter) {
        await db.debtInstallments.update(item.id, {
          balanceAfterPayment: balAfter,
          isDirty: true,
          generationCounter: (item.generationCounter || 1) + 1,
          updatedAt: now,
        });
      }
    }

    const newRemaining = Math.max(0, debt.principalAmount - runningRepaid);
    const newStatus = debt.status === 'archived' ? 'archived' : newRemaining <= 0 ? 'settled' : 'active';
    await db.debtRecords.update(debt.id, {
      totalRepaidAmount: runningRepaid,
      remainingAmount: newRemaining,
      status: newStatus,
      isDirty: true,
      generationCounter: (debt.generationCounter || 1) + 1,
      updatedAt: now,
    });

    await get().loadFinanceData(debt.userId);
    await get().recordCurrentNetWorthSnapshot();
    notifyFinanceSync();
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
      isDirty: true,
      generationCounter: (debt.generationCounter || 1) + 1,
      notes: note
        ? `${debt.notes ? debt.notes + ' | ' : ''}Top-up +${formatINR(additionalAmount)}: ${note}`
        : debt.notes,
      updatedAt: now,
    });

    await get().loadFinanceData(debt.userId);
    await get().recordCurrentNetWorthSnapshot();
    notifyFinanceSync();
  },

  deleteDebtRecord: async (id) => {
    const debt = get().debtRecords.find((d) => d.id === id);
    if (!debt) return;
    const now = new Date().toISOString();
    const installments = await db.debtInstallments.where('debtId').equals(id).toArray();
    for (const inst of installments) {
      await db.debtInstallments.update(inst.id, {
        deletedAt: now,
        isDirty: true,
        generationCounter: (inst.generationCounter || 1) + 1,
        updatedAt: now,
      });
    }
    await db.debtRecords.update(id, {
      status: 'archived',
      deletedAt: now,
      isDirty: true,
      generationCounter: (debt.generationCounter || 1) + 1,
      updatedAt: now,
    });
    await get().loadFinanceData(debt.userId);
    await get().recordCurrentNetWorthSnapshot();
    notifyFinanceSync();
  },

  settleEverydayTab: async (normalizedFriendName, options) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const key = normalizedFriendName.trim().toLowerCase();
    const activeSplits = get().debtRecords.filter(
      (d) =>
        !d.deletedAt &&
        d.status === 'active' &&
        d.bucketType === 'everyday_split' &&
        d.personName.trim().toLowerCase() === key
    );

    if (activeSplits.length === 0) return null;

    const lentTotal = activeSplits
      .filter((d) => d.direction === 'lent')
      .reduce((sum, d) => sum + d.remainingAmount, 0);
    const borrowedTotal = activeSplits
      .filter((d) => d.direction === 'borrowed')
      .reduce((sum, d) => sum + d.remainingAmount, 0);
    const net = lentTotal - borrowedTotal;

    const now = new Date().toISOString();
    const txDate = options.date || now.split('T')[0];
    const monthKey = txDate.slice(0, 7);

    // Mark all active everyday splits for this friend as settled
    for (const split of activeSplits) {
      await db.debtRecords.update(split.id, {
        remainingAmount: 0,
        totalRepaidAmount: split.principalAmount,
        status: 'settled',
        isDirty: true,
        generationCounter: (split.generationCounter || 1) + 1,
        updatedAt: now,
      });
    }

    let tx: FinanceTransaction | null = null;
    const absNet = Math.abs(net);

    if (absNet > 0) {
      const selectedAccount =
        (options.accountId && get().accounts.find((a) => a.id === options.accountId)) ||
        get().accounts.find((a) => a.isDefault) ||
        get().accounts[0];

      const debtCat =
        get().categories.find((c) => c.slug === 'emis-debt-repayment') ||
        get().categories[0];

      if (selectedAccount && debtCat) {
        const txType = net > 0 ? 'income' : 'expense';
        const friendDisplayName = activeSplits[0].personName;
        const transactionId = crypto.randomUUID();

        tx = {
          id: transactionId,
          userId,
          title: `Settled Everyday Tab with ${friendDisplayName}`,
          amount: absNet,
          type: txType,
          categoryId: debtCat.id,
          subcategory: 'Everyday Split Settlement',
          accountId: selectedAccount.id,
          date: txDate,
          monthKey,
          notes:
            options.note ||
            `Settled everyday split tab via ${options.paymentMethod.toUpperCase()} (${formatINR(absNet)})`,
          tags: ['tab-settlement', key],
          isRecurring: false,
          isDirty: true,
          generationCounter: 1,
          createdAt: now,
          updatedAt: now,
        };

        await db.financeTransactions.add(tx);

        const balanceDelta = txType === 'income' ? absNet : -absNet;
        await db.financeAccounts.update(selectedAccount.id, {
          balance: selectedAccount.balance + balanceDelta,
          isDirty: true,
          updatedAt: now,
        });
      }
    }

    await get().loadFinanceData(userId);
    await get().recordCurrentNetWorthSnapshot(monthKey);
    notifyFinanceSync();

    return tx;
  },

  offsetSplitAgainstLoan: async (friendKey, loanId, amount) => {
    if (amount <= 0) return false;
    const targetLoan = get().debtRecords.find((d) => d.id === loanId);
    if (!targetLoan || targetLoan.remainingAmount < amount) return false;

    const key = friendKey.trim().toLowerCase();
    const activeSplits = get().debtRecords.filter(
      (d) =>
        !d.deletedAt &&
        d.status === 'active' &&
        d.bucketType === 'everyday_split' &&
        d.personName.trim().toLowerCase() === key
    );

    const requiredSplitDirection = targetLoan.direction === 'borrowed' ? 'lent' : 'borrowed';
    const eligibleSplits = activeSplits.filter((d) => d.direction === requiredSplitDirection);

    const totalEligible = eligibleSplits.reduce((sum, d) => sum + d.remainingAmount, 0);
    if (totalEligible < amount) return false;

    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const monthKey = today.slice(0, 7);

    // 1. Record offset_expense installment on target loan
    const installmentId = crypto.randomUUID();
    const newLoanRepaid = targetLoan.totalRepaidAmount + amount;
    const newLoanRemaining = Math.max(0, targetLoan.principalAmount - newLoanRepaid);
    const newLoanStatus = newLoanRemaining <= 0 ? 'settled' : 'active';
    const newPaidInstallments = targetLoan.isEmi
      ? (targetLoan.paidInstallments || 0) + 1
      : targetLoan.paidInstallments;

    const installment: DebtInstallment = {
      id: installmentId,
      userId: targetLoan.userId,
      debtId: targetLoan.id,
      amount,
      date: today,
      monthKey,
      paymentMethod: 'offset_expense',
      transactionId: null,
      note: `Offset ${formatINR(amount)} against everyday tab split`,
      balanceAfterPayment: newLoanRemaining,
      isDirty: true,
      generationCounter: 1,
      createdAt: now,
      updatedAt: now,
    };

    await db.debtInstallments.add(installment);
    await db.debtRecords.update(targetLoan.id, {
      totalRepaidAmount: newLoanRepaid,
      remainingAmount: newLoanRemaining,
      status: newLoanStatus,
      paidInstallments: newPaidInstallments,
      isDirty: true,
      generationCounter: (targetLoan.generationCounter || 1) + 1,
      updatedAt: now,
    });

    // 2. Coordinated reduction of eligible everyday splits
    let remainingToAbsorb = amount;
    for (const split of eligibleSplits) {
      if (remainingToAbsorb <= 0) break;
      const absorb = Math.min(split.remainingAmount, remainingToAbsorb);
      const nextRemaining = split.remainingAmount - absorb;
      const nextRepaid = split.totalRepaidAmount + absorb;
      const nextStatus = nextRemaining <= 0 ? 'settled' : 'active';

      await db.debtRecords.update(split.id, {
        remainingAmount: nextRemaining,
        totalRepaidAmount: nextRepaid,
        status: nextStatus,
        isDirty: true,
        generationCounter: (split.generationCounter || 1) + 1,
        updatedAt: now,
      });

      remainingToAbsorb -= absorb;
    }

    await get().loadFinanceData(targetLoan.userId);
    await get().recordCurrentNetWorthSnapshot(monthKey);
    notifyFinanceSync();

    return true;
  },

  addEmiTracker: async (data) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();
    const emi: EmiTracker = {
      ...data,
      id: crypto.randomUUID(),
      userId,
      isDirty: true,
      generationCounter: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.emiTrackers.add(emi);
    await get().loadFinanceData(userId);
    await get().recordCurrentNetWorthSnapshot();
    notifyFinanceSync();
    return emi;
  },

  updateEmiTracker: async (id, data) => {
    const existing =
      get().emiTrackers.find((e) => e.id === id) || (await db.emiTrackers.get(id));
    if (!existing) return;

    const now = new Date().toISOString();
    const nextTenure =
      data.tenureMonths !== undefined
        ? Math.max(1, Number(data.tenureMonths))
        : existing.tenureMonths;
    const nextPaid =
      data.paidMonths !== undefined
        ? Math.min(nextTenure, Math.max(0, Number(data.paidMonths)))
        : Math.min(nextTenure, existing.paidMonths);

    let nextStatus = existing.status;
    if (data.status) {
      nextStatus = data.status;
    } else if (existing.status !== 'foreclosed') {
      nextStatus = nextPaid >= nextTenure ? 'completed' : 'active';
    }

    await db.emiTrackers.update(id, {
      ...data,
      tenureMonths: nextTenure,
      paidMonths: nextPaid,
      status: nextStatus,
      isDirty: true,
      generationCounter: (existing.generationCounter || 1) + 1,
      updatedAt: now,
    });

    await get().loadFinanceData(existing.userId);
    await get().recordCurrentNetWorthSnapshot();
    notifyFinanceSync();
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
      isDirty: true,
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
    const now = new Date().toISOString();
    await db.emiTrackers.update(id, { deletedAt: now, isDirty: true, updatedAt: now });
    await get().loadFinanceData(emi.userId);
    await get().recordCurrentNetWorthSnapshot();
    notifyFinanceSync();
  },

  addSipPlan: async (data) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();
    const sip: FinanceSipPlan = {
      ...data,
      id: crypto.randomUUID(),
      userId,
      isDirty: true,
      generationCounter: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.financeSipPlans.add(sip);
    await get().loadFinanceData(userId);
    await get().recordCurrentNetWorthSnapshot();
    notifyFinanceSync();
    return sip;
  },

  updateSipPlan: async (id, data) => {
    const existing = get().sipPlans.find((s) => s.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    await db.financeSipPlans.update(id, { ...data, isDirty: true, updatedAt: now });
    await get().loadFinanceData(existing.userId);
    await get().recordCurrentNetWorthSnapshot();
    notifyFinanceSync();
  },

  deleteSipPlan: async (id) => {
    const existing = get().sipPlans.find((s) => s.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    await db.financeSipPlans.update(id, {
      isActive: false,
      deletedAt: now,
      isDirty: true,
      updatedAt: now,
    });
    await get().loadFinanceData(existing.userId);
    await get().recordCurrentNetWorthSnapshot();
    notifyFinanceSync();
  },

  payMonthlySip: async (sipId, accountId, date) => {
    const sip = get().sipPlans.find((s) => s.id === sipId);
    if (!sip || !sip.isActive) return null;

    const now = new Date().toISOString();
    const txDate = date || now.split('T')[0];
    const monthKey = txDate.slice(0, 7);

    const newTotalInvested = sip.totalInvested + sip.monthlyAmount;
    const newCurrentValue = Math.max(newTotalInvested, sip.currentValue + sip.monthlyAmount);

    await db.financeSipPlans.update(sipId, {
      totalInvested: newTotalInvested,
      currentValue: newCurrentValue,
      lastInvestedMonthKey: monthKey,
      isDirty: true,
      updatedAt: now,
    });

    const defaultAccount =
      (accountId && get().accounts.find((a) => a.id === accountId)) ||
      (sip.accountId && get().accounts.find((a) => a.id === sip.accountId)) ||
      get().accounts.find((a) => a.isDefault) ||
      get().accounts[0];

    const investCat =
      (sip.categoryId && get().categories.find((c) => c.id === sip.categoryId)) ||
      get().categories.find((c) => c.slug === 'investments-savings') ||
      get().categories[0];

    let createdTx: FinanceTransaction | null = null;
    if (defaultAccount && investCat) {
      createdTx = await get().addTransaction({
        title: `SIP Investment — ${sip.name}`,
        amount: sip.monthlyAmount,
        type: 'investment',
        categoryId: investCat.id,
        subcategory: 'SIP / Mutual Funds',
        accountId: defaultAccount.id,
        date: txDate,
        notes: `${sip.platform ? sip.platform + ' · ' : ''}Total Invested: ${formatINR(
          newTotalInvested
        )}`,
        tags: ['sip', 'investment', sip.assetClass],
        linkedSipId: sip.id,
      });
    } else {
      await get().loadFinanceData(sip.userId);
    }

    try {
      await CrossDomainActionMediator.onFinanceEvent({
        type: 'SIP_COMPLETED',
        date: txDate,
        amount: sip.monthlyAmount,
      });
    } catch {
      // Non-blocking
    }

    return createdTx;
  },

  addRecurringBill: async (data) => {
    const userId = await resolveCurrentUserId(undefined, get().currentUserId);
    const now = new Date().toISOString();
    const bill: FinanceRecurringBill = {
      ...data,
      id: crypto.randomUUID(),
      userId,
      isDirty: true,
      generationCounter: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.financeRecurringBills.add(bill);
    await get().loadFinanceData(userId);
    notifyFinanceSync();
    return bill;
  },

  updateRecurringBill: async (id, data) => {
    const existing = get().recurringBills.find((b) => b.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    const nextPayload: Partial<FinanceRecurringBill> = {
      ...data,
      isDirty: true,
      updatedAt: now,
    };
    if (data.amount !== undefined && data.amount !== existing.amount) {
      nextPayload.previousAmount = existing.amount;
    }
    await db.financeRecurringBills.update(id, nextPayload);
    await get().loadFinanceData(existing.userId);
    notifyFinanceSync();
  },

  deleteRecurringBill: async (id) => {
    const existing = get().recurringBills.find((b) => b.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    await db.financeRecurringBills.update(id, {
      isActive: false,
      deletedAt: now,
      isDirty: true,
      updatedAt: now,
    });
    await get().loadFinanceData(existing.userId);
    notifyFinanceSync();
  },

  payRecurringBill: async (billId, accountId, date) => {
    const bill = get().recurringBills.find((b) => b.id === billId);
    if (!bill) return null;

    const now = new Date().toISOString();
    const txDate = date || now.split('T')[0];
    const monthKey = txDate.slice(0, 7);

    await db.financeRecurringBills.update(billId, {
      lastPaidMonthKey: monthKey,
      isDirty: true,
      updatedAt: now,
    });

    const selectedAcc =
      (accountId && get().accounts.find((a) => a.id === accountId)) ||
      (bill.accountId && get().accounts.find((a) => a.id === bill.accountId)) ||
      get().accounts.find((a) => a.isDefault) ||
      get().accounts[0];

    const selectedCat =
      get().categories.find((c) => c.id === bill.categoryId) ||
      get().categories.find((c) => c.slug === 'utilities-bills') ||
      get().categories[0];

    if (!selectedAcc || !selectedCat) {
      await get().loadFinanceData(bill.userId);
      return null;
    }

    return get().addTransaction({
      title: bill.name,
      amount: bill.amount,
      type: 'expense',
      categoryId: selectedCat.id,
      subcategory: 'Recurring Bill',
      accountId: selectedAcc.id,
      date: txDate,
      tags: ['bill', bill.cadence],
      isRecurring: true,
    });
  },
});
