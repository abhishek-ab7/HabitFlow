/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  normalizePaydayOfMonth,
  parsePaydayFromNotes,
  stripPaydayNoteTag,
} from '@/lib/finance/payday';
import type {
  CreditCardStatement,
  FinanceAccount,
  FinanceAccountType,
  FinanceBudget,
  FinanceCategory,
  FinanceTransaction,
  FinanceTransactionType,
  StatementStatus,
} from '@/lib/types';
import {
  arrOr,
  bool,
  nullStr,
  num,
  optNum,
  optStr,
  rowIdentity,
  rowTimestamps,
  str,
  strArr,
} from './row-utils';

export function mapFinanceAccountFromRow(r: Record<string, any>): FinanceAccount {
  const billingDay = r.billing_day ?? r.statement_day;
  const statementDay = r.statement_day ?? r.billing_day;

  return {
    ...rowIdentity(r),
    name: str(r.name),
    type: str(r.type, 'bank') as FinanceAccountType,
    balance: num(r.balance),
    creditLimit: optNum(r.credit_limit),
    billingDay: optNum(billingDay),
    statementDay: optNum(statementDay),
    dueDay: optNum(r.due_day),
    gracePeriodDays: optNum(r.grace_period_days),
    lastStatementCheckedAt: optStr(r.last_statement_checked_at),
    includeInNetWorth: r.include_in_net_worth !== false,
    currency: str(r.currency, 'INR'),
    color: str(r.color, '#10b981'),
    icon: str(r.icon, 'Wallet'),
    isDefault: bool(r.is_default),
    archived: bool(r.is_archived),
    ...rowTimestamps(r),
  };
}

export function mapFinanceCategoryFromRow(r: Record<string, any>): FinanceCategory {
  const timestamps = rowTimestamps(r);
  const archived = bool(r.is_archived);
  return {
    ...rowIdentity(r),
    name: str(r.name),
    slug: str(r.slug),
    type: str(r.type, 'expense') as 'expense' | 'income' | 'both',
    icon: str(r.icon, 'Tag'),
    color: str(r.color, '#6B7280'),
    monthlyBudgetLimit: num(r.monthly_budget_limit),
    rolloverEnabled: bool(r.rollover_enabled),
    subcategories: arrOr(r.subcategories, []),
    order: num(r.order_index),
    isSystem: bool(r.is_system),
    archived,
    ...timestamps,
    deletedAt: r.deleted_at || (archived ? timestamps.updatedAt : null),
  };
}

function mapTransactionLinks(r: Record<string, any>) {
  return {
    isRecurring: bool(r.is_recurring),
    recurrenceRule: optStr(r.recurrence_rule),
    needsReview: bool(r.needs_review),
    splitGroupId: nullStr(r.split_group_id),
    linkedCommitmentId: nullStr(r.linked_commitment_id),
    commitmentContributionType: (r.commitment_contribution_type || null) as FinanceTransaction['commitmentContributionType'],
    linkedDebtId: nullStr(r.linked_debt_id),
    linkedDebtInstallmentId: nullStr(r.linked_debt_installment_id),
    linkedEmiId: nullStr(r.linked_emi_id),
    linkedSipId: nullStr(r.linked_sip_id),
    statementCycleKey: nullStr(r.statement_cycle_key),
    paidStatementId: nullStr(r.paid_statement_id),
    isCreditCardPayment: bool(r.is_credit_card_payment),
  };
}

export function mapFinanceTransactionFromRow(r: Record<string, any>): FinanceTransaction {
  const dateStr = str(r.date);
  return {
    ...rowIdentity(r),
    title: str(r.title),
    merchantName: r.merchant_name ?? undefined,
    rawMerchant: r.raw_merchant ?? undefined,
    amount: num(r.amount),
    type: str(r.type, 'expense') as FinanceTransactionType,
    categoryId: str(r.category_id),
    subcategory: optStr(r.subcategory),
    accountId: str(r.account_id),
    toAccountId: optStr(r.to_account_id),
    date: dateStr,
    monthKey: str(r.month_key, dateStr.slice(0, 7)),
    notes: optStr(r.notes),
    tags: strArr(r.tags),
    ...mapTransactionLinks(r),
    ...rowTimestamps(r),
  };
}

export function mapFinanceBudgetFromRow(r: Record<string, any>): FinanceBudget {
  return {
    ...rowIdentity(r),
    monthKey: str(r.month_key),
    totalBudget: num(r.total_budget),
    expectedIncome: num(r.expected_income),
    plannedSipAmount: num(r.planned_sip_amount),
    paydayOfMonth:
      normalizePaydayOfMonth(r.payday_of_month) ?? parsePaydayFromNotes(r.notes),
    budgetMode: r.budget_mode === 'zero_based' ? 'zero_based' : 'cap',
    assignedIncome: optNum(r.assigned_income),
    currency: str(r.currency, 'INR'),
    notes: stripPaydayNoteTag(r.notes),
    ...rowTimestamps(r),
  };
}

export function mapCreditCardStatementFromRow(r: Record<string, any>): CreditCardStatement {
  return {
    id: String(r.id),
    userId: optStr(r.user_id),
    accountId: str(r.account_id),
    cycleKey: str(r.cycle_key),
    periodStart: str(r.period_start),
    periodEnd: str(r.period_end),
    dueDate: str(r.due_date),
    calculatedAmount: num(r.calculated_amount),
    manualAdjustment: num(r.manual_adjustment ?? r.manualAdjustment),
    totalDue: num(r.total_due),
    carriedForwardAmount: num(r.carried_forward_amount),
    paidAmount: num(r.paid_amount),
    remainingDue: num(r.remaining_due),
    status: str(r.status, 'billed') as StatementStatus,
    paidAt: nullStr(r.paid_at),
    notes: optStr(r.notes),
    ...rowTimestamps(r),
  };
}
