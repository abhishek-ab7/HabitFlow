import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { McpAuthContext } from '../../auth';
import { getSupabaseAdmin } from '../../supabase-admin';
import { getIstMonthKey } from '../../config';
import { getInsertMetadata, getSoftDeleteMetadata, getUpdateMetadata } from '../../sync-helpers';
import { mapFinanceBudgetFromRow } from '../../mappers';
import {
  normalizePaydayOfMonth,
  parsePaydayFromNotes,
  resolveEffectivePaydayOfMonth,
  upsertPaydayNoteTag,
} from '@/lib/finance/payday';
import {
  authorizeMcpTool,
  logAndReturnMcpError,
  logAndReturnMcpSuccess,
  mcpError,
  mcpJson,
  pickDefinedColumns,
} from '../tool-helpers';

const BUDGET_UPDATE_COLUMNS = [
  ['totalBudget', 'total_budget'],
  ['expectedIncome', 'expected_income'],
  ['plannedSipAmount', 'planned_sip_amount'],
  ['budgetMode', 'budget_mode'],
  ['assignedIncome', 'assigned_income'],
  ['notes', 'notes'],
] as const;

type UserId = string;
type MonthKey = string;

function isMissingPaydayColError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  return e.code === 'PGRST204' || e.code === '42703' || String(e.message || '').includes('payday_of_month');
}

function buildBudgetListQuery(userId: UserId, args: { includeDeleted?: boolean; limit?: number }) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('finance_budgets').select('*').eq('user_id', userId);
  if (!args.includeDeleted) query = query.is('deleted_at', null);
  return query.order('month_key', { ascending: false }).limit(args.limit || 12);
}

async function listBudgets(userId: UserId, args: { includeDeleted?: boolean; limit?: number }) {
  const { data, error } = await buildBudgetListQuery(userId, args);
  if (error) return mcpError(`Failed to list budgets: ${error.message}`);
  return mcpJson({ count: (data || []).length, budgets: data || [] });
}

function resolveBudgetPayday(budget: Record<string, unknown>, effectivePaydayOfMonth: number) {
  return (
    normalizePaydayOfMonth(budget.payday_of_month as number | undefined) ??
    parsePaydayFromNotes(budget.notes as string | undefined) ??
    effectivePaydayOfMonth
  );
}

async function getBudgetOverview(userId: UserId, monthKey: MonthKey) {
  const supabase = getSupabaseAdmin();
  const [{ data: allBudgets }, { data: categories }] = await Promise.all([
    supabase.from('finance_budgets').select('*').eq('user_id', userId).is('deleted_at', null),
    supabase.from('finance_categories').select('id, name, monthly_budget_limit').eq('user_id', userId).is('deleted_at', null),
  ]);

  const mappedBudgets = (allBudgets || []).map(mapFinanceBudgetFromRow);
  const budget = (allBudgets || []).find((b: Record<string, unknown>) => b.month_key === monthKey) ?? null;
  const effectivePaydayOfMonth = resolveEffectivePaydayOfMonth(mappedBudgets, monthKey) ?? 1;

  return mcpJson({
    monthKey,
    budget: budget ? { ...budget, payday_of_month: resolveBudgetPayday(budget, effectivePaydayOfMonth) } : null,
    effectivePaydayOfMonth,
    categoryBudgets: categories || [],
  });
}

async function saveBudgetWithPaydayFallback(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  existingId?: string;
  payload: Record<string, unknown>;
  fallbackNotesBase: string | null | undefined;
  normalizedPayday: number | null | undefined;
}) {
  const { supabase, existingId, payload, fallbackNotesBase, normalizedPayday } = params;
  const runWrite = (row: Record<string, unknown>) =>
    existingId
      ? supabase.from('finance_budgets').update(row).eq('id', existingId).select().single()
      : supabase.from('finance_budgets').insert(row).select().single();

  const { data, error } = await runWrite(payload);
  if (!error) return data;
  if (normalizedPayday != null && isMissingPaydayColError(error)) {
    const fallback = { ...payload };
    delete fallback.payday_of_month;
    fallback.notes = upsertPaydayNoteTag(fallbackNotesBase, normalizedPayday);
    const retry = await runWrite(fallback);
    if (retry.error) throw retry.error;
    return retry.data;
  }
  throw error;
}

async function updateSingleCategoryLimit(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  item: { categoryId: string; monthlyBudgetLimit: number }
) {
  const { data: cat } = await supabase
    .from('finance_categories')
    .select('*')
    .eq('user_id', userId)
    .eq('id', item.categoryId)
    .single();
  if (!cat) return null;
  const { data: updatedCat } = await supabase
    .from('finance_categories')
    .update({ monthly_budget_limit: item.monthlyBudgetLimit, ...getUpdateMetadata(cat) })
    .eq('id', cat.id)
    .select()
    .single();
  return updatedCat;
}

async function applyCategoryLimitUpdates(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  categoryLimits?: Array<{ categoryId: string; monthlyBudgetLimit: number }>
) {
  const updatedCategories = [];
  for (const item of categoryLimits || []) {
    const updatedCat = await updateSingleCategoryLimit(supabase, userId, item);
    if (updatedCat) updatedCategories.push(updatedCat);
  }
  return updatedCategories;
}

function orVal<T>(value: T | undefined | null, fallback: T): T {
  return value ?? fallback;
}

function buildNewBudgetPayload(
  userId: UserId,
  monthKey: MonthKey,
  args: Record<string, unknown>,
  normalizedPayday: number | null | undefined
) {
  return {
    user_id: userId,
    month_key: monthKey,
    total_budget: orVal(args.totalBudget, 0),
    expected_income: orVal(args.expectedIncome, 0),
    planned_sip_amount: orVal(args.plannedSipAmount, 0),
    ...(normalizedPayday !== undefined ? { payday_of_month: normalizedPayday } : {}),
    budget_mode: orVal(args.budgetMode, 'cap'),
    assigned_income: orVal(args.assignedIncome, 0),
    notes: orVal(args.notes, null),
    currency: 'INR',
    ...getInsertMetadata(),
  };
}

function buildBudgetWritePayload(params: {
  existing: Record<string, unknown> | null;
  userId: UserId;
  monthKey: MonthKey;
  args: Record<string, unknown>;
  normalizedPayday: number | null | undefined;
}) {
  const { existing, userId, monthKey, args, normalizedPayday } = params;
  if (!existing) return buildNewBudgetPayload(userId, monthKey, args, normalizedPayday);
  return {
    ...pickDefinedColumns(args, BUDGET_UPDATE_COLUMNS),
    ...(normalizedPayday !== undefined ? { payday_of_month: normalizedPayday } : {}),
    ...getUpdateMetadata(existing),
  };
}

async function upsertBudgetRecord(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  monthKey: MonthKey,
  args: Record<string, unknown>
): Promise<{ payload: unknown }> {
  const { data: existing } = await supabase
    .from('finance_budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('month_key', monthKey)
    .is('deleted_at', null)
    .maybeSingle();

  const normalizedPayday =
    args.paydayOfMonth !== undefined ? normalizePaydayOfMonth(args.paydayOfMonth as number) : undefined;
  const payload = buildBudgetWritePayload({ existing, userId, monthKey, args, normalizedPayday });

  const savedBudget = await saveBudgetWithPaydayFallback({
    supabase,
    existingId: existing?.id,
    payload,
    fallbackNotesBase: (args.notes !== undefined ? args.notes : existing?.notes) as string | null | undefined,
    normalizedPayday,
  });

  const updatedCategoryLimits = await applyCategoryLimitUpdates(
    supabase,
    userId,
    args.categoryLimits as Array<{ categoryId: string; monthlyBudgetLimit: number }> | undefined
  );
  return { payload: { action: 'budget_upserted', monthKey, budget: savedBudget, updatedCategoryLimits } };
}

async function fetchBudgetForMutation(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  monthKey: MonthKey,
  budgetId?: unknown
) {
  const baseQuery = supabase.from('finance_budgets').select('*').eq('user_id', userId);
  const query = budgetId ? baseQuery.eq('id', String(budgetId)) : baseQuery.eq('month_key', monthKey);
  const { data: existing, error: fetchErr } = await query.maybeSingle();
  if (fetchErr) throw fetchErr;
  return existing;
}

function buildBudgetMutationPatch(action: unknown, existing: Record<string, unknown>) {
  return action === 'delete' ? getSoftDeleteMetadata(existing) : { deleted_at: null, ...getUpdateMetadata(existing) };
}

async function deleteOrRestoreBudget(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  monthKey: MonthKey,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  if (args.action === 'delete' && !args.confirm) {
    return { error: 'Confirmation Required: Deleting a budget requires confirm: true.' };
  }
  const existing = await fetchBudgetForMutation(supabase, userId, monthKey, args.budgetId);
  if (!existing) return { error: `Budget not found for ${args.budgetId || monthKey}` };

  const { data, error } = await supabase
    .from('finance_budgets')
    .update(buildBudgetMutationPatch(args.action, existing))
    .eq('user_id', userId)
    .eq('id', existing.id)
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: args.action === 'delete' ? 'deleted' : 'restored', budget: data } };
}

async function dispatchBudgetWrite(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  monthKey: MonthKey,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  return args.action === 'upsert'
    ? upsertBudgetRecord(supabase, userId, monthKey, args)
    : deleteOrRestoreBudget(supabase, userId, monthKey, args);
}

async function handleManageBudgetWrite(auth: McpAuthContext, args: Record<string, unknown>) {
  const startMs = Date.now();
  const monthKey = String(args.monthKey || getIstMonthKey());

  try {
    const outcome = await dispatchBudgetWrite(getSupabaseAdmin(), auth.userId, monthKey, args);
    if (outcome.error) return mcpError(outcome.error);

    return logAndReturnMcpSuccess({
      auth,
      toolName: 'manage_finance_budget',
      action: String(args.action),
      input: args,
      startMs,
      payload: outcome.payload,
    });
  } catch (error) {
    return logAndReturnMcpError({
      auth,
      toolName: 'manage_finance_budget',
      action: String(args.action),
      input: args,
      startMs,
      error,
      prefix: `Failed to ${args.action} budget`,
    });
  }
}

export function registerManageFinanceBudgetTool(server: McpServer) {
  server.registerTool(
    'manage_finance_budget',
    {
      title: 'Manage Finance Budget',
      description:
        'Get, list, upsert, delete (soft-delete), or restore monthly spending caps, expected income, planned SIP allocation, and per-category budget limits.',
      inputSchema: {
        action: z.enum(['get', 'list', 'upsert', 'delete', 'restore']).describe('Action to perform'),
        budgetId: z.string().uuid().optional().describe('Optional budget UUID for delete/restore'),
        monthKey: z.string().regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM').optional().describe('Month key (defaults to current month in IST)'),
        limit: z.number().int().min(1).max(24).optional().default(12).describe('Number of months for list'),
        includeDeleted: z.boolean().optional().default(false),
        totalBudget: z.number().min(0).optional().describe('Overall monthly spending limit'),
        expectedIncome: z.number().min(0).optional().describe('Expected monthly salary/inflows'),
        plannedSipAmount: z.number().min(0).optional().describe('Planned monthly SIP investment goal'),
        paydayOfMonth: z.number().int().min(1).max(31).optional().describe('Day of month (1-31) when salary/expected income arrives'),
        budgetMode: z.enum(['cap', 'zero_based']).optional(),
        assignedIncome: z.number().min(0).optional(),
        notes: z.string().optional(),
        categoryLimits: z
          .array(z.object({ categoryId: z.string().uuid(), monthlyBudgetLimit: z.number().min(0) }))
          .optional()
          .describe('Optional batch updates to individual category monthly budget limits'),
        confirm: z.boolean().optional().describe('Confirmation flag required for delete'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      if (args.action === 'list' || args.action === 'get') {
        const authRes = authorizeMcpTool('habitflow:finance:read');
        if (!authRes.ok) return authRes.response;
        return args.action === 'list'
          ? listBudgets(authRes.auth.userId, args)
          : getBudgetOverview(authRes.auth.userId, args.monthKey || getIstMonthKey());
      }
      const authRes = authorizeMcpTool('habitflow:finance:write');
      if (!authRes.ok) return authRes.response;
      return handleManageBudgetWrite(authRes.auth, args);
    }
  );
}
