/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import type {
  FinanceCategorizationRule,
  FinanceNetWorthSnapshot,
  FinanceTransaction,
} from '@/lib/types';
import { type SyncStepResult, upsertWithColumnFallback } from './finance-sync-types';
import { syncFinanceEntity } from './finance-sync-runner';

function orVal<T>(value: unknown, fallback: T): T {
  return (value as T) || fallback;
}

function numOr(value: unknown, fallback = 0): number {
  return Number(value || fallback);
}

function isoTimestamps(r: { created_at?: string; updated_at?: string }) {
  const now = new Date().toISOString();
  return {
    createdAt: r.created_at || r.updated_at || now,
    updatedAt: r.updated_at || now,
    isDirty: false,
  };
}

function mapTxCoreToRemote(tx: FinanceTransaction, userId: string) {
  const localToday = getLocalIsoDate();
  const safeMonthKey = tx.monthKey || (tx.date ? tx.date.slice(0, 7) : localToday.slice(0, 7));
  return {
    id: tx.id,
    user_id: userId,
    title: orVal(tx.title, 'Untitled Transaction'),
    merchant_name: orVal(tx.merchantName, null),
    raw_merchant: orVal(tx.rawMerchant, null),
    amount: numOr(tx.amount),
    type: orVal(tx.type, 'expense'),
    category_id: tx.categoryId,
    subcategory: orVal(tx.subcategory, null),
    account_id: tx.accountId,
    to_account_id: orVal(tx.toAccountId, null),
    date: orVal(tx.date, localToday),
    month_key: safeMonthKey,
    notes: orVal(tx.notes, null),
    tags: Array.isArray(tx.tags) ? tx.tags : [],
  };
}

function mapTxLinksToRemote(tx: FinanceTransaction) {
  return {
    is_recurring: !!tx.isRecurring,
    recurrence_rule: orVal(tx.recurrenceRule, null),
    needs_review: !!tx.needsReview,
    split_group_id: orVal(tx.splitGroupId, null),
    linked_commitment_id: orVal(tx.linkedCommitmentId, null),
    commitment_contribution_type: tx.linkedCommitmentId
      ? orVal(tx.commitmentContributionType, 'offset_expense')
      : null,
    linked_debt_id: orVal(tx.linkedDebtId, null),
    linked_debt_installment_id: orVal(tx.linkedDebtInstallmentId, null),
    linked_emi_id: orVal(tx.linkedEmiId, null),
    linked_sip_id: orVal(tx.linkedSipId, null),
    statement_cycle_key: tx.statementCycleKey ?? null,
    paid_statement_id: tx.paidStatementId ?? null,
    is_credit_card_payment: !!tx.isCreditCardPayment,
    deleted_at: orVal(tx.deletedAt, null),
    generation_counter: orVal(tx.generationCounter, 1),
    created_at: orVal(tx.createdAt, new Date().toISOString()),
    updated_at: orVal(tx.updatedAt, new Date().toISOString()),
  };
}

function mapTxCoreToLocal(r: any, local: FinanceTransaction | undefined) {
  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    merchantName: r.merchant_name ?? local?.merchantName,
    rawMerchant: r.raw_merchant ?? local?.rawMerchant,
    amount: numOr(r.amount),
    type: orVal(r.type, 'expense') as FinanceTransaction['type'],
    categoryId: r.category_id,
    subcategory: orVal(r.subcategory, undefined),
    accountId: r.account_id,
    toAccountId: orVal(r.to_account_id, undefined),
    date: r.date,
    monthKey: r.month_key || (r.date ? r.date.slice(0, 7) : ''),
    notes: orVal(r.notes, undefined),
    tags: Array.isArray(r.tags) ? r.tags : [],
  };
}

function mapTxLinksToLocal(r: any, local: FinanceTransaction | undefined) {
  return {
    isRecurring: !!r.is_recurring,
    recurrenceRule: orVal(r.recurrence_rule, undefined),
    needsReview: r.needs_review ?? local?.needsReview ?? false,
    splitGroupId: r.split_group_id ?? local?.splitGroupId ?? null,
    linkedCommitmentId: orVal(r.linked_commitment_id, null),
    commitmentContributionType: orVal(r.commitment_contribution_type, null),
    linkedDebtId: orVal(r.linked_debt_id, null),
    linkedDebtInstallmentId: orVal(r.linked_debt_installment_id, null),
    linkedEmiId: orVal(r.linked_emi_id, null),
    linkedSipId: r.linked_sip_id ?? local?.linkedSipId ?? null,
    statementCycleKey: r.statement_cycle_key ?? local?.statementCycleKey ?? null,
    paidStatementId: r.paid_statement_id ?? local?.paidStatementId ?? null,
    isCreditCardPayment: r.is_credit_card_payment ?? local?.isCreditCardPayment ?? false,
    deletedAt: orVal(r.deleted_at, null),
    generationCounter: orVal(r.generation_counter, 1),
    ...isoTimestamps(r),
  };
}

export async function syncTransactions(supabase: any, userId: string): Promise<SyncStepResult> {
  return syncFinanceEntity<FinanceTransaction, any>(supabase, userId, {
    label: 'Transaction',
    remoteTable: 'finance_transactions',
    table: db.financeTransactions,
    deleteOnTombstone: true,
    toRemotePayload: (tx, uid) => ({
      ...mapTxCoreToRemote(tx, uid),
      ...mapTxLinksToRemote(tx),
    }),
    retryUpsert: async (sb, payload, _tx, error) => {
      if (error?.code !== '23503') return { error };
      logger.warn(
        '[FinanceSyncEngine] Foreign key 23503 violation on transaction upsert, retrying with unlinked references:',
        error
      );
      return upsertWithColumnFallback(sb, 'finance_transactions', {
        ...payload,
        linked_commitment_id: null,
        commitment_contribution_type: null,
        linked_debt_id: null,
        linked_debt_installment_id: null,
        linked_emi_id: null,
        linked_sip_id: null,
        paid_statement_id: null,
      });
    },
    toLocalRecord: (r, local) => ({
      ...mapTxCoreToLocal(r, local),
      ...mapTxLinksToLocal(r, local),
    }),
  });
}

export async function syncCategorizationRules(supabase: any, userId: string): Promise<SyncStepResult> {
  return syncFinanceEntity<FinanceCategorizationRule, any>(supabase, userId, {
    label: 'Rule',
    remoteTable: 'finance_categorization_rules',
    table: db.financeCategorizationRules,
    reportPullError: true,
    catchUnexpectedError: true,
    toRemotePayload: (rule, uid) => ({
      id: rule.id,
      user_id: uid,
      match_pattern: rule.matchPattern,
      clean_merchant_name: rule.cleanMerchantName,
      category_id: rule.categoryId,
      subcategory: orVal(rule.subcategory, null),
      default_tags: orVal(rule.defaultTags, []),
      is_active: rule.isActive && !rule.deletedAt,
      deleted_at: orVal(rule.deletedAt, null),
      generation_counter: orVal(rule.generationCounter, 1),
      created_at: rule.createdAt,
      updated_at: rule.updatedAt,
    }),
    toLocalRecord: (r) => ({
      id: r.id,
      userId: r.user_id,
      matchPattern: r.match_pattern,
      cleanMerchantName: r.clean_merchant_name,
      categoryId: r.category_id,
      subcategory: orVal(r.subcategory, undefined),
      defaultTags: orVal(r.default_tags, []),
      isActive: !!r.is_active,
      deletedAt: orVal(r.deleted_at, null),
      generationCounter: orVal(r.generation_counter, 1),
      ...isoTimestamps(r),
    }),
  });
}

const SNAPSHOT_AMOUNT_PAIRS = [
  ['liquidAssets', 'liquid_assets'],
  ['investmentAssets', 'investment_assets'],
  ['friendReceivables', 'friend_receivables'],
  ['totalAssets', 'total_assets'],
  ['creditCardLiabilities', 'credit_card_liabilities'],
  ['emiRemainingPrincipal', 'emi_remaining_principal'],
  ['friendPayables', 'friend_payables'],
  ['totalLiabilities', 'total_liabilities'],
  ['netWorth', 'net_worth'],
] as const;

function mapSnapshotAmounts(
  source: Record<string, any>,
  direction: 'toRemote' | 'toLocal'
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [localKey, remoteKey] of SNAPSHOT_AMOUNT_PAIRS) {
    const srcKey = direction === 'toRemote' ? localKey : remoteKey;
    const dstKey = direction === 'toRemote' ? remoteKey : localKey;
    result[dstKey] = numOr(source[srcKey]);
  }
  return result;
}

export async function syncNetWorthSnapshots(supabase: any, userId: string): Promise<SyncStepResult> {
  return syncFinanceEntity<FinanceNetWorthSnapshot, any>(supabase, userId, {
    label: 'Net worth snapshot',
    remoteTable: 'finance_net_worth_snapshots',
    table: db.financeNetWorthSnapshots,
    trackMissingTable: true,
    reportPullError: true,
    catchUnexpectedError: true,
    onConflict: 'user_id,month_key',
    toRemotePayload: (snap, uid) => ({
      id: snap.id,
      user_id: uid,
      month_key: snap.monthKey,
      snapshot_date: snap.snapshotDate,
      deleted_at: orVal(snap.deletedAt, null),
      generation_counter: orVal(snap.generationCounter, 1),
      created_at: snap.createdAt,
      updated_at: snap.updatedAt,
      ...mapSnapshotAmounts(snap, 'toRemote'),
    }),
    toLocalRecord: (r) =>
      ({
        id: r.id,
        userId: r.user_id,
        monthKey: r.month_key,
        snapshotDate: r.snapshot_date,
        deletedAt: orVal(r.deleted_at, null),
        generationCounter: orVal(r.generation_counter, 1),
        ...mapSnapshotAmounts(r, 'toLocal'),
        ...isoTimestamps(r),
      }) as FinanceNetWorthSnapshot,
  });
}
