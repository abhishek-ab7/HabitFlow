/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  CommitmentCategory,
  DebtBucketType,
  DebtDirection,
  DebtInstallment,
  DebtPaymentMethod,
  DebtRecord,
  DebtRepaymentSchedule,
  DebtStatus,
  EmiStatus,
  EmiTracker,
  FinanceRecurringBill,
  FinanceSipPlan,
  MonthlyCommitment,
  SipAssetClass,
} from '@/lib/types';
import {
  bool,
  nullStr,
  num,
  optNum,
  optStr,
  rowIdentity,
  rowTimestamps,
  str,
} from './row-utils';

export function mapMonthlyCommitmentFromRow(r: Record<string, any>): MonthlyCommitment {
  return {
    ...rowIdentity(r),
    title: str(r.title),
    recipientName: str(r.recipient_name),
    relationship: str(r.relationship, 'Family'),
    monthlyTargetAmount: num(r.monthly_target_amount),
    dueDayOfMonth: num(r.due_day_of_month, 5),
    category: str(r.category, 'family_support') as CommitmentCategory,
    defaultCategoryId: optStr(r.default_category_id),
    autoRolloverOverpayment: bool(r.auto_rollover_overpayment),
    icon: str(r.icon, 'HeartHandshake'),
    color: str(r.color, '#ec4899'),
    isActive: r.is_active !== false,
    notes: optStr(r.notes),
    ...rowTimestamps(r),
  };
}

function mapDebtScheduleFields(r: Record<string, any>) {
  return {
    startDate: str(r.start_date),
    targetSettlementDate: optStr(r.target_settlement_date),
    repaymentSchedule: str(r.repayment_schedule, 'flexible') as DebtRepaymentSchedule,
    plannedMonthlyInstallment: optNum(r.planned_monthly_installment),
    dueDayOfMonth: optNum(r.due_day_of_month),
    status: str(r.status, 'active') as DebtStatus,
    bucketType: str(r.bucket_type, 'long_term_loan') as DebtBucketType,
    isEmi: bool(r.is_emi),
    emiAmount: optNum(r.emi_amount),
    emiDueDay: optNum(r.emi_due_day),
    totalInstallments: optNum(r.total_installments),
    paidInstallments: num(r.paid_installments),
  };
}

export function mapDebtRecordFromRow(r: Record<string, any>): DebtRecord {
  return {
    ...rowIdentity(r),
    personName: str(r.person_name, 'Friend'),
    contactInfo: optStr(r.contact_info),
    direction: str(r.direction, 'lent') as DebtDirection,
    title: str(r.title),
    principalAmount: num(r.principal_amount),
    totalRepaidAmount: num(r.total_repaid_amount),
    remainingAmount: num(r.remaining_amount),
    ...mapDebtScheduleFields(r),
    notes: optStr(r.notes),
    color: str(r.color, '#3b82f6'),
    ...rowTimestamps(r),
  };
}

export function mapDebtInstallmentFromRow(r: Record<string, any>): DebtInstallment {
  const dateStr = str(r.date);
  return {
    ...rowIdentity(r),
    debtId: str(r.debt_id),
    amount: num(r.amount),
    date: dateStr,
    monthKey: str(r.month_key, dateStr.slice(0, 7)),
    paymentMethod: str(r.payment_method, 'upi') as DebtPaymentMethod,
    transactionId: nullStr(r.transaction_id),
    note: optStr(r.note),
    balanceAfterPayment: num(r.balance_after_payment),
    ...rowTimestamps(r),
  };
}

export function mapEmiTrackerFromRow(r: Record<string, any>): EmiTracker {
  return {
    ...rowIdentity(r),
    loanName: str(r.loan_name),
    lenderName: str(r.lender_name),
    principalAmount: num(r.principal_amount),
    interestRateAnnual: num(r.interest_rate_annual),
    emiAmount: num(r.emi_amount),
    tenureMonths: num(r.tenure_months, 1),
    paidMonths: num(r.paid_months),
    startDate: str(r.start_date),
    billingDayOfMonth: num(r.billing_day_of_month, 5),
    categoryId: str(r.category_id),
    accountId: optStr(r.account_id),
    autoCreateTaskReminder: bool(r.auto_create_task_reminder),
    lastPaidMonthKey: optStr(r.last_paid_month_key),
    status: str(r.status, 'active') as EmiStatus,
    notes: optStr(r.notes),
    ...rowTimestamps(r),
  };
}

export function mapFinanceSipPlanFromRow(r: Record<string, any>): FinanceSipPlan {
  return {
    ...rowIdentity(r),
    name: str(r.name),
    platform: optStr(r.platform),
    assetClass: str(r.asset_class, 'equity_mf') as SipAssetClass,
    monthlyAmount: num(r.monthly_amount),
    sipDayOfMonth: num(r.sip_day_of_month, 5),
    startDate: str(r.start_date),
    totalInvested: num(r.total_invested),
    currentValue: num(r.current_value),
    expectedReturnAnnual: optNum(r.expected_return_annual),
    accountId: optStr(r.account_id),
    categoryId: optStr(r.category_id),
    lastInvestedMonthKey: optStr(r.last_invested_month_key),
    isActive: r.is_active !== false,
    color: str(r.color, '#10b981'),
    notes: optStr(r.notes),
    ...rowTimestamps(r),
  };
}

export function mapFinanceRecurringBillFromRow(r: Record<string, any>): FinanceRecurringBill {
  return {
    ...rowIdentity(r),
    name: str(r.name),
    amount: num(r.amount),
    previousAmount: optNum(r.previous_amount),
    cadence: str(r.cadence, 'monthly') as 'monthly' | 'quarterly' | 'yearly',
    dueDayOfMonth: num(r.due_day_of_month, 5),
    categoryId: str(r.category_id),
    accountId: optStr(r.account_id),
    autoLog: bool(r.auto_log),
    lastPaidMonthKey: optStr(r.last_paid_month_key),
    isActive: r.is_active !== false,
    color: str(r.color, '#6366f1'),
    icon: str(r.icon, 'Calendar'),
    ...rowTimestamps(r),
  };
}
