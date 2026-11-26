import { db } from '@/lib/db';
import { normalizePaydayOfMonth } from '@/lib/finance/payday';
import type { FinanceBudget, FinanceBudgetMode } from '@/lib/types';
import { notifyFinanceSync, resolveCurrentUserId, type FinanceStore } from '../helpers';
export {
  reconcileAccountBalanceImpl,
  recordCurrentNetWorthSnapshotImpl,
} from './net-worth-reconcile';

export interface MonthlyBudgetSettingsOptions {
  expectedIncome?: number;
  plannedSipAmount?: number;
  categoryRollovers?: Record<string, boolean>;
  paydayOfMonth?: number | null;
  budgetMode?: FinanceBudgetMode;
  assignedIncome?: number;
}

function nonNegOrFallback(val: number | undefined, fallback: number): number {
  return val !== undefined ? Math.max(0, Number(val) || 0) : fallback;
}

function resolvePayday(
  paydayOfMonth: number | null | undefined,
  existing: FinanceBudget | undefined
): number | undefined {
  return paydayOfMonth !== undefined
    ? normalizePaydayOfMonth(paydayOfMonth)
    : existing?.paydayOfMonth;
}

function resolveAssignedIncome(
  assignedIncome: number | undefined,
  existing: FinanceBudget | undefined
): number | undefined {
  return assignedIncome !== undefined
    ? Math.max(0, Number(assignedIncome) || 0)
    : existing?.assignedIncome;
}

function buildNormalizedBudgetFields(
  totalBudget: number,
  existing: FinanceBudget | undefined,
  options?: MonthlyBudgetSettingsOptions
) {
  const opt = options ?? {};
  return {
    totalBudget: Math.max(0, Number(totalBudget) || 0),
    expectedIncome: nonNegOrFallback(opt.expectedIncome, existing?.expectedIncome ?? 0),
    plannedSipAmount: nonNegOrFallback(opt.plannedSipAmount, existing?.plannedSipAmount ?? 0),
    paydayOfMonth: resolvePayday(opt.paydayOfMonth, existing),
    budgetMode: opt.budgetMode ?? existing?.budgetMode ?? 'cap',
    assignedIncome: resolveAssignedIncome(opt.assignedIncome, existing),
  };
}

function shouldCreateBudgetRecord(fields: ReturnType<typeof buildNormalizedBudgetFields>): boolean {
  const hasPositiveValue = [
    fields.totalBudget,
    fields.expectedIncome,
    fields.plannedSipAmount,
  ].some((v) => v > 0);
  if (hasPositiveValue) return true;
  return fields.paydayOfMonth !== undefined || fields.budgetMode === 'zero_based';
}

async function persistCategoryLimits(
  categoryLimits: Record<string, number>,
  categoryRollovers: Record<string, boolean> | undefined,
  now: string
): Promise<void> {
  for (const [categoryId, limit] of Object.entries(categoryLimits)) {
    const rolloverFlag = categoryRollovers?.[categoryId];
    await db.financeCategories.update(categoryId, {
      monthlyBudgetLimit: Math.max(0, Number(limit) || 0),
      ...(rolloverFlag !== undefined ? { rolloverEnabled: rolloverFlag } : {}),
      isDirty: true,
      updatedAt: now,
    });
  }
}

async function upsertBudgetDoc(params: {
  existing: FinanceBudget | undefined;
  userId: string;
  monthKey: string;
  fields: ReturnType<typeof buildNormalizedBudgetFields>;
  now: string;
}): Promise<void> {
  const { existing, userId, monthKey, fields, now } = params;
  if (existing) {
    await db.financeBudgets.update(existing.id, { ...fields, isDirty: true, updatedAt: now });
    return;
  }
  if (!shouldCreateBudgetRecord(fields)) return;

  await db.financeBudgets.add({
    id: crypto.randomUUID(),
    userId,
    monthKey,
    ...fields,
    currency: 'INR',
    isDirty: true,
    generationCounter: 1,
    createdAt: now,
    updatedAt: now,
  });
}

export async function setMonthlyBudgetImpl(params: {
  state: FinanceStore;
  monthKey: string;
  totalBudget: number;
  expectedIncome?: number;
  plannedSipAmount?: number;
}): Promise<void> {
  const { state, monthKey, totalBudget, expectedIncome, plannedSipAmount } = params;
  const userId = await resolveCurrentUserId(undefined, state.currentUserId);
  const now = new Date().toISOString();
  const existing = state.budgets.find((b) => b.monthKey === monthKey && b.userId === userId);
  const fields = buildNormalizedBudgetFields(totalBudget, existing, {
    expectedIncome,
    plannedSipAmount,
  });

  if (existing) {
    await db.financeBudgets.update(existing.id, { ...fields, isDirty: true, updatedAt: now });
  } else {
    await db.financeBudgets.add({
      id: crypto.randomUUID(),
      userId,
      monthKey,
      ...fields,
      currency: 'INR',
      isDirty: true,
      generationCounter: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  await state.loadFinanceData(userId);
  notifyFinanceSync();
}

export async function saveMonthlyBudgetSettingsImpl(params: {
  state: FinanceStore;
  monthKey: string;
  totalBudget: number;
  categoryLimits: Record<string, number>;
  options?: MonthlyBudgetSettingsOptions;
}): Promise<void> {
  const { state, monthKey, totalBudget, categoryLimits, options } = params;
  const userId = await resolveCurrentUserId(undefined, state.currentUserId);
  const now = new Date().toISOString();

  await persistCategoryLimits(categoryLimits, options?.categoryRollovers, now);
  const existing = state.budgets.find((b) => b.monthKey === monthKey && b.userId === userId);
  const fields = buildNormalizedBudgetFields(totalBudget, existing, options);

  await upsertBudgetDoc({ existing, userId, monthKey, fields, now });
  await state.loadFinanceData(userId);
  notifyFinanceSync();
}
