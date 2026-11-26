/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '@/lib/db';
import {
  normalizePaydayOfMonth,
  parsePaydayFromNotes,
  stripPaydayNoteTag,
  upsertPaydayNoteTag,
} from '@/lib/finance/payday';
import type {
  CreditCardStatement,
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
} from '@/lib/types';
import {
  type SyncStepResult,
  missingRemoteFinanceColumns,
  upsertWithColumnFallback,
  shouldApplyRemote,
} from './finance-sync-types';
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

async function resolveCategoryConflict(r: any): Promise<FinanceCategory | undefined> {
  if (!r.slug) return undefined;
  const sameSlug = await db.financeCategories
    .where('userId')
    .equals(r.user_id)
    .filter((c) => c.slug === r.slug)
    .first();
  if (!sameSlug || sameSlug.id === r.id) return undefined;

  const txs = await db.financeTransactions.where('categoryId').equals(sameSlug.id).toArray();
  for (const tx of txs) {
    await db.financeTransactions.update(tx.id, { categoryId: r.id });
  }
  await db.financeCategories.delete(sameSlug.id);
  return sameSlug;
}

export async function syncCategories(supabase: any, userId: string): Promise<SyncStepResult> {
  return syncFinanceEntity<FinanceCategory, any>(supabase, userId, {
    label: 'Category',
    remoteTable: 'finance_categories',
    table: db.financeCategories,
    toRemotePayload: (cat, uid) => ({
      id: cat.id,
      user_id: uid,
      name: cat.name,
      slug: cat.slug,
      type: cat.type,
      icon: cat.icon,
      color: cat.color,
      monthly_budget_limit: numOr(cat.monthlyBudgetLimit),
      rollover_enabled: !!cat.rolloverEnabled,
      subcategories: orVal(cat.subcategories, []),
      order_index: cat.order ?? 0,
      is_system: !!cat.isSystem,
      is_archived: !!cat.archived || !!cat.deletedAt,
      deleted_at: orVal(cat.deletedAt, null),
      generation_counter: orVal(cat.generationCounter, 1),
      created_at: orVal(cat.createdAt, new Date().toISOString()),
      updated_at: orVal(cat.updatedAt, new Date().toISOString()),
    }),
    resolveLocalConflict: (r) => resolveCategoryConflict(r),
    toLocalRecord: (r, local) => ({
      id: r.id,
      userId: r.user_id,
      name: r.name,
      slug: r.slug,
      type: r.type,
      icon: r.icon,
      color: r.color,
      monthlyBudgetLimit: numOr(r.monthly_budget_limit),
      rolloverEnabled: r.rollover_enabled ?? local?.rolloverEnabled ?? false,
      subcategories: orVal(r.subcategories, []),
      order: r.order_index ?? 0,
      isSystem: !!r.is_system,
      archived: !!r.is_archived,
      deletedAt: r.deleted_at || (r.is_archived ? r.updated_at : null),
      generationCounter: orVal(r.generation_counter, 1),
      ...isoTimestamps(r),
    }),
  });
}

function isUnusedDefaultAccount(acc: FinanceAccount, r: { name: string; type: string }): boolean {
  return acc.name === r.name && acc.type === r.type && acc.balance === 0 && !acc.archived;
}

async function resolveAccountConflict(r: any): Promise<FinanceAccount | undefined> {
  if (!r.name || !r.type) return undefined;
  const sameDefaultAcc = await db.financeAccounts
    .where('userId')
    .equals(r.user_id)
    .filter((a) => isUnusedDefaultAccount(a, r))
    .first();
  if (!sameDefaultAcc || sameDefaultAcc.id === r.id) return undefined;

  const txCount = await db.financeTransactions.where('accountId').equals(sameDefaultAcc.id).count();
  if (txCount > 0) return undefined;

  await db.financeAccounts.delete(sameDefaultAcc.id);
  return sameDefaultAcc;
}

function mapAccountToRemote(acc: FinanceAccount, userId: string) {
  return {
    id: acc.id,
    user_id: userId,
    name: acc.name,
    type: acc.type,
    balance: numOr(acc.balance),
    credit_limit: acc.creditLimit !== undefined ? Number(acc.creditLimit) : null,
    billing_day: acc.billingDay ?? acc.statementDay ?? null,
    statement_day: acc.statementDay ?? acc.billingDay ?? null,
    due_day: acc.dueDay ?? null,
    grace_period_days: acc.gracePeriodDays ?? null,
    last_statement_checked_at: acc.lastStatementCheckedAt ?? null,
    include_in_net_worth: acc.includeInNetWorth !== false,
    currency: orVal(acc.currency, 'INR'),
    color: orVal(acc.color, '#10b981'),
    icon: orVal(acc.icon, 'Landmark'),
    is_default: !!acc.isDefault,
    is_archived: !!acc.archived || !!acc.deletedAt,
    deleted_at: orVal(acc.deletedAt, null),
    generation_counter: orVal(acc.generationCounter, 1),
    created_at: orVal(acc.createdAt, new Date().toISOString()),
    updated_at: orVal(acc.updatedAt, new Date().toISOString()),
  };
}

function mapAccountCycleDays(r: any, local: FinanceAccount | undefined) {
  return {
    billingDay: r.billing_day ?? r.statement_day ?? local?.billingDay,
    statementDay: r.statement_day ?? r.billing_day ?? local?.statementDay,
    dueDay: r.due_day ?? local?.dueDay,
    gracePeriodDays: r.grace_period_days ?? local?.gracePeriodDays,
  };
}

function mapAccountBillingFields(r: any, local: FinanceAccount | undefined) {
  const hasLimit = r.credit_limit !== null && r.credit_limit !== undefined;
  return {
    creditLimit: hasLimit ? Number(r.credit_limit) : local?.creditLimit,
    lastStatementCheckedAt: r.last_statement_checked_at ?? local?.lastStatementCheckedAt,
    includeInNetWorth: r.include_in_net_worth ?? local?.includeInNetWorth ?? true,
    ...mapAccountCycleDays(r, local),
  };
}

function mapAccountToLocal(r: any, local: FinanceAccount | undefined): FinanceAccount {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    type: r.type,
    balance: numOr(r.balance),
    currency: orVal(r.currency, 'INR'),
    color: orVal(r.color, '#10b981'),
    icon: orVal(r.icon, 'Wallet'),
    isDefault: !!r.is_default,
    archived: !!r.is_archived,
    deletedAt: orVal(r.deleted_at, null),
    generationCounter: orVal(r.generation_counter, 1),
    ...mapAccountBillingFields(r, local),
    ...isoTimestamps(r),
  };
}

export async function syncAccounts(supabase: any, userId: string): Promise<SyncStepResult> {
  return syncFinanceEntity<FinanceAccount, any>(supabase, userId, {
    label: 'Account',
    remoteTable: 'finance_accounts',
    table: db.financeAccounts,
    toRemotePayload: mapAccountToRemote,
    resolveLocalConflict: (r) => resolveAccountConflict(r),
    toLocalRecord: mapAccountToLocal,
  });
}

async function resolveStatementConflict(
  r: any,
  userId: string
): Promise<CreditCardStatement | undefined> {
  if (!r.account_id || !r.cycle_key) return undefined;
  const sameCycle = await db.creditCardStatements
    .where('[accountId+cycleKey]')
    .equals([r.account_id, r.cycle_key])
    .first();
  if (!sameCycle || sameCycle.id === r.id) return undefined;

  if (shouldApplyRemote(sameCycle, r)) {
    const linkedTxs = await db.financeTransactions
      .where('userId')
      .equals(userId)
      .filter((t) => t.paidStatementId === sameCycle.id)
      .toArray();
    for (const ltx of linkedTxs) {
      await db.financeTransactions.update(ltx.id, { paidStatementId: r.id });
    }
    await db.creditCardStatements.delete(sameCycle.id);
  }
  return sameCycle;
}

export async function syncCreditCardStatements(
  supabase: any,
  userId: string
): Promise<SyncStepResult> {
  return syncFinanceEntity<CreditCardStatement, any>(supabase, userId, {
    label: 'CreditCardStatement',
    remoteTable: 'credit_card_statements',
    table: db.creditCardStatements,
    trackMissingTable: true,
    deleteOnTombstone: true,
    onConflict: 'user_id,account_id,cycle_key',
    toRemotePayload: (s, uid) => ({
      id: s.id,
      user_id: uid,
      account_id: s.accountId,
      cycle_key: s.cycleKey,
      period_start: s.periodStart,
      period_end: s.periodEnd,
      due_date: s.dueDate,
      calculated_amount: numOr(s.calculatedAmount),
      manual_adjustment: numOr(s.manualAdjustment),
      total_due: numOr(s.totalDue),
      carried_forward_amount: numOr(s.carriedForwardAmount),
      paid_amount: numOr(s.paidAmount),
      remaining_due: numOr(s.remainingDue),
      status: orVal(s.status, 'billed'),
      paid_at: orVal(s.paidAt, null),
      notes: orVal(s.notes, null),
      generation_counter: orVal(s.generationCounter, 1),
      created_at: orVal(s.createdAt, new Date().toISOString()),
      updated_at: orVal(s.updatedAt, new Date().toISOString()),
      deleted_at: orVal(s.deletedAt, null),
    }),
    resolveLocalConflict: resolveStatementConflict,
    toLocalRecord: (r) => ({
      id: r.id,
      userId: r.user_id,
      accountId: r.account_id,
      cycleKey: r.cycle_key,
      periodStart: r.period_start,
      periodEnd: r.period_end,
      dueDate: r.due_date,
      calculatedAmount: numOr(r.calculated_amount),
      manualAdjustment: Number(r.manualAdjustment || r.manual_adjustment || 0),
      totalDue: numOr(r.total_due),
      carriedForwardAmount: numOr(r.carried_forward_amount),
      paidAmount: numOr(r.paid_amount),
      remainingDue: numOr(r.remaining_due),
      status: r.status as any,
      paidAt: orVal(r.paid_at, null),
      notes: orVal(r.notes, undefined),
      deletedAt: orVal(r.deleted_at, null),
      generationCounter: orVal(r.generation_counter, 1),
      ...isoTimestamps(r),
    }),
  });
}

function buildBudgetNotes(notes: string | undefined, payday: number | undefined): string | null {
  const hasPaydayMissing = missingRemoteFinanceColumns.get('finance_budgets')?.has('payday_of_month');
  if (payday !== undefined && hasPaydayMissing) {
    return upsertPaydayNoteTag(notes, payday);
  }
  return stripPaydayNoteTag(notes) || null;
}

async function resolveBudgetConflict(r: any): Promise<FinanceBudget | undefined> {
  if (!r.month_key) return undefined;
  const sameMonth = await db.financeBudgets
    .where('[userId+monthKey]')
    .equals([r.user_id, r.month_key])
    .first();
  if (!sameMonth || sameMonth.id === r.id) return undefined;
  await db.financeBudgets.delete(sameMonth.id);
  return sameMonth;
}

function mapBudgetMetrics(r: any, local: FinanceBudget | undefined) {
  const hasAssigned = r.assigned_income !== null && r.assigned_income !== undefined;
  return {
    totalBudget: numOr(r.total_budget),
    expectedIncome: numOr(r.expected_income),
    plannedSipAmount: r.planned_sip_amount
      ? Number(r.planned_sip_amount)
      : local?.plannedSipAmount ?? 0,
    assignedIncome: hasAssigned ? Number(r.assigned_income) : local?.assignedIncome,
  };
}

function mapBudgetToLocal(r: any, local: FinanceBudget | undefined): FinanceBudget {
  return {
    id: r.id,
    userId: r.user_id,
    monthKey: r.month_key,
    paydayOfMonth:
      normalizePaydayOfMonth(r.payday_of_month) ?? parsePaydayFromNotes(r.notes) ?? local?.paydayOfMonth,
    budgetMode: r.budget_mode === 'zero_based' ? 'zero_based' : local?.budgetMode || 'cap',
    currency: orVal(r.currency, 'INR'),
    notes: stripPaydayNoteTag(r.notes),
    deletedAt: orVal(r.deleted_at, null),
    generationCounter: orVal(r.generation_counter, 1),
    ...mapBudgetMetrics(r, local),
    ...isoTimestamps(r),
  };
}

async function retryBudgetPaydayFallback(
  sb: any,
  payload: Record<string, any>,
  budget: FinanceBudget
) {
  const normalizedPayday = normalizePaydayOfMonth(budget.paydayOfMonth);
  if (normalizedPayday === undefined) return { error: null };
  const isPaydayMissing = missingRemoteFinanceColumns.get('finance_budgets')?.has('payday_of_month');
  if (!isPaydayMissing || parsePaydayFromNotes(payload.notes)) return { error: null };

  return upsertWithColumnFallback(
    sb,
    'finance_budgets',
    {
      ...payload,
      notes: upsertPaydayNoteTag(budget.notes, normalizedPayday),
      generation_counter: (budget.generationCounter || 1) + 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,month_key' }
  );
}

export async function syncBudgets(supabase: any, userId: string): Promise<SyncStepResult> {
  return syncFinanceEntity<FinanceBudget, any>(supabase, userId, {
    label: 'Budget',
    remoteTable: 'finance_budgets',
    table: db.financeBudgets,
    deleteOnTombstone: true,
    onConflict: 'user_id,month_key',
    toRemotePayload: (budget, uid) => {
      const normalizedPayday = normalizePaydayOfMonth(budget.paydayOfMonth);
      return {
        id: budget.id,
        user_id: uid,
        month_key: budget.monthKey,
        total_budget: budget.totalBudget,
        expected_income: budget.expectedIncome,
        planned_sip_amount: numOr(budget.plannedSipAmount),
        payday_of_month: normalizedPayday ?? null,
        budget_mode: orVal(budget.budgetMode, 'cap'),
        assigned_income: budget.assignedIncome !== undefined ? Number(budget.assignedIncome) : null,
        currency: budget.currency,
        notes: buildBudgetNotes(budget.notes, normalizedPayday),
        deleted_at: orVal(budget.deletedAt, null),
        generation_counter: orVal(budget.generationCounter, 1),
        created_at: budget.createdAt,
        updated_at: budget.updatedAt,
      };
    },
    onAfterUpsertSuccess: retryBudgetPaydayFallback,
    resolveLocalConflict: (r) => resolveBudgetConflict(r),
    toLocalRecord: mapBudgetToLocal,
  });
}
