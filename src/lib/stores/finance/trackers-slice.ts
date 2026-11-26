import { db } from '@/lib/db';
import type {
  DebtRecord,
  EmiTracker,
  FinanceRecurringBill,
  FinanceSipPlan,
  MonthlyCommitment,
} from '@/lib/types';
import { formatINR, notifyFinanceSync, type FinanceSliceCreator, type FinanceStore } from './helpers';
import {
  addTrackerEntity,
  softDeleteTrackerEntity,
  updateTrackerEntity,
} from './trackers/crud-factory';
import {
  deleteDebtInstallmentImpl,
  recordDebtInstallmentImpl,
  updateDebtInstallmentImpl,
} from './trackers/debt-installments';
import {
  offsetSplitAgainstLoanImpl,
  settleEverydayTabImpl,
  updateDebtRecordImpl,
} from './trackers/debt-actions';
import {
  payMonthlyEmiImpl,
  payMonthlySipImpl,
  payRecurringBillImpl,
  settleCommitmentBalanceImpl,
  updateEmiTrackerImpl,
} from './trackers/obligations-payments';

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
  addCommitment: (data) =>
    addTrackerEntity<MonthlyCommitment, typeof data>({
      getState: get,
      table: db.monthlyCommitments,
      data,
    }),

  updateCommitment: (id, data) =>
    updateTrackerEntity({
      getState: get,
      table: db.monthlyCommitments,
      existing: get().commitments.find((c) => c.id === id),
      data,
    }),

  deleteCommitment: (id) =>
    softDeleteTrackerEntity({
      getState: get,
      table: db.monthlyCommitments,
      existing: get().commitments.find((c) => c.id === id),
      extraFields: { isActive: false },
    }),

  settleCommitmentBalance: (commitmentId, accountId, monthKey) =>
    settleCommitmentBalanceImpl(get(), commitmentId, accountId, monthKey),

  addDebtRecord: (data) =>
    addTrackerEntity<DebtRecord, Omit<DebtRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>({
      getState: get,
      table: db.debtRecords,
      recordNetWorth: true,
      data: {
        ...data,
        bucketType: data.bucketType || 'long_term_loan',
        isEmi: Boolean(data.isEmi),
        paidInstallments: data.paidInstallments || 0,
        totalRepaidAmount: 0,
        remainingAmount: Number(data.principalAmount),
        status: 'active',
      },
    }),

  updateDebtRecord: (id, data) => updateDebtRecordImpl(get(), id, data),

  recordDebtInstallment: (params) => recordDebtInstallmentImpl(get(), params),

  updateDebtInstallment: (id, data) => updateDebtInstallmentImpl(get(), id, data),

  deleteDebtInstallment: (id) => deleteDebtInstallmentImpl(get(), id),

  topUpDebt: async (debtId, additionalAmount, note) => {
    const debt = get().debtRecords.find((d) => d.id === debtId);
    if (!debt || additionalAmount <= 0) return;

    const newPrincipal = debt.principalAmount + Number(additionalAmount);
    const newRemaining = Math.max(0, newPrincipal - debt.totalRepaidAmount);
    const prefix = debt.notes ? `${debt.notes} | ` : '';
    const nextNotes = note ? `${prefix}Top-up +${formatINR(additionalAmount)}: ${note}` : debt.notes;

    await updateTrackerEntity({
      getState: get,
      table: db.debtRecords,
      existing: debt,
      recordNetWorth: true,
      data: {
        principalAmount: newPrincipal,
        remainingAmount: newRemaining,
        status: 'active',
        notes: nextNotes,
      },
    });
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

  settleEverydayTab: (normalizedFriendName, options) =>
    settleEverydayTabImpl(get(), normalizedFriendName, options),

  offsetSplitAgainstLoan: (friendKey, loanId, amount) =>
    offsetSplitAgainstLoanImpl(get(), friendKey, loanId, amount),

  addEmiTracker: (data) =>
    addTrackerEntity<EmiTracker, typeof data>({
      getState: get,
      table: db.emiTrackers,
      data,
      recordNetWorth: true,
    }),

  updateEmiTracker: (id, data) => updateEmiTrackerImpl(get(), id, data),

  payMonthlyEmi: (emiId, accountId, date) => payMonthlyEmiImpl(get(), emiId, accountId, date),

  deleteEmiTracker: (id) =>
    softDeleteTrackerEntity({
      getState: get,
      table: db.emiTrackers,
      existing: get().emiTrackers.find((e) => e.id === id),
      recordNetWorth: true,
    }),

  addSipPlan: (data) =>
    addTrackerEntity<FinanceSipPlan, typeof data>({
      getState: get,
      table: db.financeSipPlans,
      data,
      recordNetWorth: true,
    }),

  updateSipPlan: (id, data) =>
    updateTrackerEntity({
      getState: get,
      table: db.financeSipPlans,
      existing: get().sipPlans.find((s) => s.id === id),
      data,
      recordNetWorth: true,
    }),

  deleteSipPlan: (id) =>
    softDeleteTrackerEntity({
      getState: get,
      table: db.financeSipPlans,
      existing: get().sipPlans.find((s) => s.id === id),
      extraFields: { isActive: false },
      recordNetWorth: true,
    }),

  payMonthlySip: (sipId, accountId, date) => payMonthlySipImpl(get(), sipId, accountId, date),

  addRecurringBill: (data) =>
    addTrackerEntity<FinanceRecurringBill, typeof data>({
      getState: get,
      table: db.financeRecurringBills,
      data,
    }),

  updateRecurringBill: (id, data) => {
    const existing = get().recurringBills.find((b) => b.id === id);
    const payload =
      existing && data.amount !== undefined && data.amount !== existing.amount
        ? { ...data, previousAmount: existing.amount }
        : data;
    return updateTrackerEntity({
      getState: get,
      table: db.financeRecurringBills,
      existing,
      data: payload,
    });
  },

  deleteRecurringBill: (id) =>
    softDeleteTrackerEntity({
      getState: get,
      table: db.financeRecurringBills,
      existing: get().recurringBills.find((b) => b.id === id),
      extraFields: { isActive: false },
    }),

  payRecurringBill: (billId, accountId, date) =>
    payRecurringBillImpl(get(), billId, accountId, date),
});
