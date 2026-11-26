/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '@/lib/db';
import type {
  DebtInstallment,
  DebtRecord,
  EmiTracker,
  FinanceRecurringBill,
  FinanceSipPlan,
  MonthlyCommitment,
} from '@/lib/types';
import { type SyncStepResult } from './finance-sync-types';
import { syncFinanceEntity } from './finance-sync-runner';

function orVal<T>(value: unknown, fallback: T): T {
  return (value as T) || fallback;
}

function numOr(value: unknown, fallback = 0): number {
  return Number(value || fallback);
}

function optNum(value: unknown): number | undefined {
  return value ? Number(value) : undefined;
}

function isoTimestamps(r: { created_at?: string; updated_at?: string }) {
  const now = new Date().toISOString();
  return {
    createdAt: r.created_at || r.updated_at || now,
    updatedAt: r.updated_at || now,
    isDirty: false,
  };
}

export async function syncCommitments(supabase: any, userId: string): Promise<SyncStepResult> {
  return syncFinanceEntity<MonthlyCommitment, any>(supabase, userId, {
    label: 'Commitment',
    remoteTable: 'monthly_commitments',
    table: db.monthlyCommitments,
    toRemotePayload: (comm, uid) => ({
      id: comm.id,
      user_id: uid,
      title: comm.title,
      recipient_name: comm.recipientName,
      relationship: orVal(comm.relationship, 'Family'),
      monthly_target_amount: numOr(comm.monthlyTargetAmount),
      due_day_of_month: numOr(comm.dueDayOfMonth, 5),
      category: orVal(comm.category, 'family_support'),
      default_category_id: orVal(comm.defaultCategoryId, null),
      auto_rollover_overpayment: !!comm.autoRolloverOverpayment,
      icon: orVal(comm.icon, 'HeartHandshake'),
      color: orVal(comm.color, '#ec4899'),
      is_active: comm.isActive && !comm.deletedAt,
      notes: orVal(comm.notes, null),
      deleted_at: orVal(comm.deletedAt, null),
      generation_counter: orVal(comm.generationCounter, 1),
      created_at: orVal(comm.createdAt, new Date().toISOString()),
      updated_at: orVal(comm.updatedAt, new Date().toISOString()),
    }),
    toLocalRecord: (r) => ({
      id: r.id,
      userId: r.user_id,
      title: r.title,
      recipientName: r.recipient_name,
      relationship: orVal(r.relationship, 'Family'),
      monthlyTargetAmount: numOr(r.monthly_target_amount),
      dueDayOfMonth: numOr(r.due_day_of_month, 5),
      category: orVal(r.category, 'family_support'),
      defaultCategoryId: orVal(r.default_category_id, undefined),
      autoRolloverOverpayment: !!r.auto_rollover_overpayment,
      icon: orVal(r.icon, 'HeartHandshake'),
      color: orVal(r.color, '#ec4899'),
      isActive: !!r.is_active,
      notes: orVal(r.notes, undefined),
      deletedAt: orVal(r.deleted_at, null),
      generationCounter: orVal(r.generation_counter, 1),
      ...isoTimestamps(r),
    }),
  });
}

function mapDebtCoreToRemote(debt: DebtRecord, userId: string) {
  return {
    id: debt.id,
    user_id: userId,
    person_name: debt.personName,
    contact_info: orVal(debt.contactInfo, null),
    direction: debt.direction,
    title: debt.title,
    principal_amount: debt.principalAmount,
    total_repaid_amount: debt.totalRepaidAmount,
    remaining_amount: debt.remainingAmount,
    start_date: debt.startDate,
    target_settlement_date: orVal(debt.targetSettlementDate, null),
    repayment_schedule: debt.repaymentSchedule,
    planned_monthly_installment: orVal(debt.plannedMonthlyInstallment, null),
    due_day_of_month: orVal(debt.dueDayOfMonth, null),
  };
}

function mapDebtMetaToRemote(debt: DebtRecord) {
  return {
    status: debt.deletedAt ? 'archived' : debt.status,
    bucket_type: orVal(debt.bucketType, 'long_term_loan'),
    is_emi: !!debt.isEmi,
    emi_amount: debt.emiAmount ?? null,
    emi_due_day: debt.emiDueDay ?? null,
    total_installments: debt.totalInstallments ?? null,
    paid_installments: debt.paidInstallments ?? 0,
    notes: orVal(debt.notes, null),
    color: debt.color,
    deleted_at: orVal(debt.deletedAt, null),
    generation_counter: orVal(debt.generationCounter, 1),
    created_at: debt.createdAt,
    updated_at: debt.updatedAt,
  };
}

function mapDebtToLocal(r: any): DebtRecord {
  return {
    id: r.id,
    userId: r.user_id,
    personName: r.person_name,
    contactInfo: orVal(r.contact_info, undefined),
    direction: r.direction,
    title: r.title,
    principalAmount: numOr(r.principal_amount),
    totalRepaidAmount: numOr(r.total_repaid_amount),
    remainingAmount: numOr(r.remaining_amount),
    startDate: r.start_date,
    targetSettlementDate: orVal(r.target_settlement_date, undefined),
    repaymentSchedule: orVal(r.repayment_schedule, 'flexible'),
    plannedMonthlyInstallment: optNum(r.planned_monthly_installment),
    dueDayOfMonth: optNum(r.due_day_of_month),
    status: orVal(r.status, 'active'),
    bucketType: orVal(r.bucket_type, 'long_term_loan'),
    isEmi: r.is_emi ?? false,
    emiAmount: optNum(r.emi_amount),
    emiDueDay: optNum(r.emi_due_day),
    totalInstallments: optNum(r.total_installments),
    paidInstallments: optNum(r.paid_installments) ?? 0,
    notes: orVal(r.notes, undefined),
    color: orVal(r.color, '#3b82f6'),
    deletedAt: orVal(r.deleted_at, null),
    generationCounter: orVal(r.generation_counter, 1),
    ...isoTimestamps(r),
  };
}

export async function syncDebts(supabase: any, userId: string): Promise<SyncStepResult> {
  return syncFinanceEntity<DebtRecord, any>(supabase, userId, {
    label: 'Debt',
    remoteTable: 'debt_records',
    table: db.debtRecords,
    toRemotePayload: (debt, uid) => ({
      ...mapDebtCoreToRemote(debt, uid),
      ...mapDebtMetaToRemote(debt),
    }),
    toLocalRecord: (r) => mapDebtToLocal(r),
  });
}

export async function syncInstallments(supabase: any, userId: string): Promise<SyncStepResult> {
  return syncFinanceEntity<DebtInstallment, any>(supabase, userId, {
    label: 'Installment',
    remoteTable: 'debt_installments',
    table: db.debtInstallments,
    toRemotePayload: (inst, uid) => ({
      id: inst.id,
      user_id: uid,
      debt_id: inst.debtId,
      amount: inst.amount,
      date: inst.date,
      month_key: inst.monthKey,
      payment_method: inst.paymentMethod,
      transaction_id: orVal(inst.transactionId, null),
      note: orVal(inst.note, null),
      balance_after_payment: inst.balanceAfterPayment,
      deleted_at: orVal(inst.deletedAt, null),
      generation_counter: orVal(inst.generationCounter, 1),
      created_at: inst.createdAt,
      updated_at: inst.updatedAt,
    }),
    toLocalRecord: (r) => ({
      id: r.id,
      userId: r.user_id,
      debtId: r.debt_id,
      amount: numOr(r.amount),
      date: r.date,
      monthKey: r.month_key,
      paymentMethod: orVal(r.payment_method, 'upi'),
      transactionId: orVal(r.transaction_id, null),
      note: orVal(r.note, undefined),
      balanceAfterPayment: numOr(r.balance_after_payment),
      deletedAt: orVal(r.deleted_at, null),
      generationCounter: orVal(r.generation_counter, 1),
      ...isoTimestamps(r),
    }),
  });
}

export async function syncEmis(supabase: any, userId: string): Promise<SyncStepResult> {
  return syncFinanceEntity<EmiTracker, any>(supabase, userId, {
    label: 'EMI',
    remoteTable: 'emi_trackers',
    table: db.emiTrackers,
    toRemotePayload: (emi, uid) => ({
      id: emi.id,
      user_id: uid,
      loan_name: emi.loanName,
      lender_name: emi.lenderName,
      principal_amount: emi.principalAmount,
      interest_rate_annual: emi.interestRateAnnual,
      emi_amount: emi.emiAmount,
      tenure_months: emi.tenureMonths,
      paid_months: emi.paidMonths,
      start_date: emi.startDate,
      billing_day_of_month: emi.billingDayOfMonth,
      category_id: orVal(emi.categoryId, null),
      account_id: orVal(emi.accountId, null),
      auto_create_task_reminder: emi.autoCreateTaskReminder,
      last_paid_month_key: orVal(emi.lastPaidMonthKey, null),
      status: emi.status,
      notes: orVal(emi.notes, null),
      deleted_at: orVal(emi.deletedAt, null),
      generation_counter: orVal(emi.generationCounter, 1),
      created_at: emi.createdAt,
      updated_at: emi.updatedAt,
    }),
    toLocalRecord: (r) => ({
      id: r.id,
      userId: r.user_id,
      loanName: r.loan_name,
      lenderName: r.lender_name,
      principalAmount: numOr(r.principal_amount),
      interestRateAnnual: numOr(r.interest_rate_annual),
      emiAmount: numOr(r.emi_amount),
      tenureMonths: numOr(r.tenure_months, 1),
      paidMonths: numOr(r.paid_months),
      startDate: r.start_date,
      billingDayOfMonth: numOr(r.billing_day_of_month, 5),
      categoryId: r.category_id,
      accountId: orVal(r.account_id, undefined),
      autoCreateTaskReminder: !!r.auto_create_task_reminder,
      lastPaidMonthKey: orVal(r.last_paid_month_key, undefined),
      status: orVal(r.status, 'active'),
      notes: orVal(r.notes, undefined),
      deletedAt: orVal(r.deleted_at, null),
      generationCounter: orVal(r.generation_counter, 1),
      ...isoTimestamps(r),
    }),
  });
}

export async function syncSips(supabase: any, userId: string): Promise<SyncStepResult> {
  return syncFinanceEntity<FinanceSipPlan, any>(supabase, userId, {
    label: 'SIP plan',
    remoteTable: 'finance_sip_plans',
    table: db.financeSipPlans,
    reportPullError: true,
    catchUnexpectedError: true,
    toRemotePayload: (sip, uid) => ({
      id: sip.id,
      user_id: uid,
      name: sip.name,
      platform: orVal(sip.platform, null),
      asset_class: sip.assetClass,
      monthly_amount: sip.monthlyAmount,
      sip_day_of_month: sip.sipDayOfMonth,
      start_date: sip.startDate,
      total_invested: sip.totalInvested,
      current_value: sip.currentValue,
      expected_return_annual: orVal(sip.expectedReturnAnnual, null),
      account_id: orVal(sip.accountId, null),
      category_id: orVal(sip.categoryId, null),
      last_invested_month_key: orVal(sip.lastInvestedMonthKey, null),
      is_active: sip.isActive && !sip.deletedAt,
      color: sip.color,
      notes: orVal(sip.notes, null),
      deleted_at: orVal(sip.deletedAt, null),
      generation_counter: orVal(sip.generationCounter, 1),
      created_at: sip.createdAt,
      updated_at: sip.updatedAt,
    }),
    toLocalRecord: (r) => ({
      id: r.id,
      userId: r.user_id,
      name: r.name,
      platform: orVal(r.platform, undefined),
      assetClass: orVal(r.asset_class, 'equity_mf'),
      monthlyAmount: numOr(r.monthly_amount),
      sipDayOfMonth: numOr(r.sip_day_of_month, 5),
      startDate: r.start_date,
      totalInvested: numOr(r.total_invested),
      currentValue: numOr(r.current_value),
      expectedReturnAnnual: optNum(r.expected_return_annual),
      accountId: orVal(r.account_id, undefined),
      categoryId: orVal(r.category_id, undefined),
      lastInvestedMonthKey: orVal(r.last_invested_month_key, undefined),
      isActive: !!r.is_active,
      color: orVal(r.color, '#10b981'),
      notes: orVal(r.notes, undefined),
      deletedAt: orVal(r.deleted_at, null),
      generationCounter: orVal(r.generation_counter, 1),
      ...isoTimestamps(r),
    }),
  });
}

export async function syncRecurringBills(supabase: any, userId: string): Promise<SyncStepResult> {
  return syncFinanceEntity<FinanceRecurringBill, any>(supabase, userId, {
    label: 'Recurring bill',
    remoteTable: 'finance_recurring_bills',
    table: db.financeRecurringBills,
    reportPullError: true,
    catchUnexpectedError: true,
    toRemotePayload: (bill, uid) => ({
      id: bill.id,
      user_id: uid,
      name: bill.name,
      amount: bill.amount,
      previous_amount: orVal(bill.previousAmount, null),
      cadence: bill.cadence,
      due_day_of_month: bill.dueDayOfMonth,
      category_id: bill.categoryId,
      account_id: orVal(bill.accountId, null),
      auto_log: bill.autoLog,
      last_paid_month_key: orVal(bill.lastPaidMonthKey, null),
      is_active: bill.isActive && !bill.deletedAt,
      color: bill.color,
      icon: bill.icon,
      deleted_at: orVal(bill.deletedAt, null),
      generation_counter: orVal(bill.generationCounter, 1),
      created_at: bill.createdAt,
      updated_at: bill.updatedAt,
    }),
    toLocalRecord: (r) => ({
      id: r.id,
      userId: r.user_id,
      name: r.name,
      amount: numOr(r.amount),
      previousAmount: optNum(r.previous_amount),
      cadence: orVal(r.cadence, 'monthly'),
      dueDayOfMonth: numOr(r.due_day_of_month, 5),
      categoryId: r.category_id,
      accountId: orVal(r.account_id, undefined),
      autoLog: !!r.auto_log,
      lastPaidMonthKey: orVal(r.last_paid_month_key, undefined),
      isActive: !!r.is_active,
      color: orVal(r.color, '#6366f1'),
      icon: orVal(r.icon, 'Calendar'),
      deletedAt: orVal(r.deleted_at, null),
      generationCounter: orVal(r.generation_counter, 1),
      ...isoTimestamps(r),
    }),
  });
}
