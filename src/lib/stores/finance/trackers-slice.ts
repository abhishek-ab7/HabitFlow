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
  | 'recordDebtInstallment'
  | 'topUpDebt'
  | 'deleteDebtRecord'
  | 'addEmiTracker'
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
    await db.debtRecords.update(debt.id, {
      totalRepaidAmount: newRepaid,
      remainingAmount: newRemaining,
      status: newStatus,
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
        updatedAt: now,
      });
    }
    await db.debtRecords.update(id, {
      status: 'archived',
      deletedAt: now,
      isDirty: true,
      updatedAt: now,
    });
    await get().loadFinanceData(debt.userId);
    await get().recordCurrentNetWorthSnapshot();
    notifyFinanceSync();
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
