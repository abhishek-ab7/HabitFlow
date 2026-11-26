import type { FinanceTransaction, FinanceTransactionFormData } from '@/lib/types';

function orNull(value?: string | null): string | null {
  return value || null;
}

function buildLinkFields(data: FinanceTransactionFormData) {
  return {
    linkedCommitmentId: orNull(data.linkedCommitmentId),
    commitmentContributionType: data.linkedCommitmentId
      ? data.commitmentContributionType || 'offset_expense'
      : null,
    linkedDebtId: orNull(data.linkedDebtId),
    linkedDebtInstallmentId: null,
    linkedEmiId: orNull(data.linkedEmiId),
    linkedSipId: orNull(data.linkedSipId),
    statementCycleKey: orNull(data.statementCycleKey),
    paidStatementId: orNull(data.paidStatementId),
    splitGroupId: orNull(data.splitGroupId),
  };
}

export function buildNewTransaction(
  data: FinanceTransactionFormData,
  userId: string,
  now: string
): FinanceTransaction {
  return {
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
    monthKey: data.date.slice(0, 7),
    notes: data.notes?.trim(),
    tags: data.tags || [],
    isRecurring: Boolean(data.isRecurring),
    recurrenceRule: data.recurrenceRule,
    isCreditCardPayment: Boolean(data.isCreditCardPayment),
    merchantName: data.merchantName?.trim(),
    rawMerchant: data.rawMerchant?.trim(),
    needsReview: Boolean(data.needsReview),
    isDirty: true,
    generationCounter: 1,
    createdAt: now,
    updatedAt: now,
    ...buildLinkFields(data),
  };
}
