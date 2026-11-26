import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { hasScope } from '../../auth';
import type { McpAuthContext } from '../../auth';
import { getSupabaseAdmin } from '../../supabase-admin';
import { getIstIsoDate } from '../../config';
import { createLinkedFinanceExpense, getInsertMetadata, getUpdateMetadata } from '../../sync-helpers';
import { mapMealLogFromRow } from '../../mappers';
import {
  authorizeMcpTool,
  logAndReturnMcpError,
  logAndReturnMcpSuccess,
  mcpError,
  mcpJson,
  pickDefinedColumns,
} from '../tool-helpers';
import { tryAutoDeductProteinSupplement, tryAutoLinkMealToTransaction } from './meal-helpers';
import {
  deleteOrRestoreMealTemplate,
  listMealTemplates,
  softDeleteOrRestoreRow,
  upsertMealTemplate,
} from './meal-template-ops';

const MEAL_UPDATE_COLUMNS = [
  ['date', 'date'],
  ['mealType', 'meal_type'],
  ['proteinG', 'protein_g'],
  ['carbsG', 'carbs_g'],
  ['fatG', 'fat_g'],
  ['fiberG', 'fiber_g'],
  ['quantityMultiplier', 'quantity_multiplier'],
  ['isJunk', 'is_junk'],
  ['linkedTransactionId', 'linked_transaction_id'],
  ['notes', 'notes'],
] as const;

type UserId = string;

function orVal<T>(value: T | undefined | null, fallback: T): T {
  return value ?? fallback;
}

function applyMealDateFilter(query: any, args: Record<string, unknown>) {
  if (!args.startDate && !args.endDate) return query.eq('date', String(args.date || getIstIsoDate()));
  let next = args.startDate ? query.gte('date', String(args.startDate)) : query;
  if (args.endDate) next = next.lte('date', String(args.endDate));
  return next;
}

function buildMealListQuery(userId: UserId, args: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('meal_logs').select('*').eq('user_id', userId);
  if (!args.includeDeleted) query = query.is('deleted_at', null);
  return applyMealDateFilter(query, args).order('logged_at', { ascending: false });
}

async function listMealLogs(userId: UserId, args: Record<string, unknown>) {
  const { data, error } = await buildMealListQuery(userId, args);
  if (error) return mcpError(`Failed to list meals: ${error.message}`);
  const meals = (data || []).map(mapMealLogFromRow);
  return mcpJson({ count: meals.length, meals });
}

async function deleteOrRestoreMeal(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  if (!args.mealId) return { error: `Validation Error: mealId is required for ${args.action}.` };
  const isDelete = args.action === 'delete';
  const res = await softDeleteOrRestoreRow({
    supabase,
    table: 'meal_logs',
    userId,
    id: String(args.mealId),
    isDelete,
    confirm: args.confirm,
    notFoundLabel: 'Meal log',
  });
  if (res.error || !res.data) return { error: res.error };
  return { payload: { action: isDelete ? 'deleted' : 'restored', meal: mapMealLogFromRow(res.data) } };
}

async function fetchActiveMealLog(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  mealId: string
) {
  const { data, error } = await supabase
    .from('meal_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('id', mealId)
    .is('deleted_at', null)
    .single();
  return error || !data ? null : data;
}

function buildMealUpdatePatch(existing: Record<string, unknown>, args: Record<string, unknown>) {
  const updates = pickDefinedColumns(args, MEAL_UPDATE_COLUMNS);
  if (args.name !== undefined) updates.name = String(args.name).trim();
  if (args.calories !== undefined) updates.calories = Math.round(Number(args.calories));
  return { ...updates, ...getUpdateMetadata(existing) };
}

async function updateMealLog(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  if (!args.mealId) return { error: 'Validation Error: mealId is required for update.' };
  const existing = await fetchActiveMealLog(supabase, userId, String(args.mealId));
  if (!existing) return { error: `Meal log not found: ${args.mealId}` };

  const { data, error } = await supabase
    .from('meal_logs')
    .update(buildMealUpdatePatch(existing, args))
    .eq('user_id', userId)
    .eq('id', String(args.mealId))
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'updated', meal: mapMealLogFromRow(data) } };
}

function resolveMacroValue(explicit: unknown, templateVal: unknown, mult: number): number {
  return explicit !== undefined ? Number(explicit) : Number(templateVal || 0) * mult;
}

function resolveFiberValue(explicit: unknown, tplFiber: unknown, mult: number): number | null {
  if (explicit !== undefined) return explicit as number | null;
  return tplFiber != null ? Number(tplFiber) * mult : null;
}

function buildLoggedMealPayload(params: {
  userId: UserId;
  dateIst: string;
  mealName: string;
  isJunkMeal: boolean;
  mult: number;
  templateRow: Record<string, unknown> | null;
  resolvedLinkedTxId: string | null;
  args: Record<string, unknown>;
}) {
  const { args, templateRow, mult } = params;
  return {
    user_id: params.userId,
    date: params.dateIst,
    meal_type: orVal(args.mealType, orVal(templateRow?.meal_type, 'snack')),
    name: params.mealName,
    calories: Math.round(resolveMacroValue(args.calories, templateRow?.calories, mult)),
    protein_g: resolveMacroValue(args.proteinG, templateRow?.protein_g, mult),
    carbs_g: resolveMacroValue(args.carbsG, templateRow?.carbs_g, mult),
    fat_g: resolveMacroValue(args.fatG, templateRow?.fat_g, mult),
    fiber_g: resolveFiberValue(args.fiberG, templateRow?.fiber_g, mult),
    quantity_multiplier: mult,
    is_junk: params.isJunkMeal,
    template_id: orVal(args.templateId, null),
    linked_transaction_id: params.resolvedLinkedTxId,
    source: 'mcp',
    notes: orVal(args.notes, null),
    logged_at: new Date().toISOString(),
    ...getInsertMetadata(),
  };
}

function validateCompoundExpenseArgs(auth: McpAuthContext, args: Record<string, unknown>): string | null {
  if (!args.accountId) return 'Validation Error: accountId is required when expenseAmount is provided.';
  if (!hasScope(auth, 'habitflow:finance:write')) {
    return 'Forbidden: Missing habitflow:finance:write scope for compound meal expense logging.';
  }
  return null;
}

async function createCompoundMealExpense(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  auth: McpAuthContext;
  mealName: string;
  isJunkMeal: boolean;
  dateIst: string;
  args: Record<string, unknown>;
}) {
  const { supabase, auth, mealName, isJunkMeal, dateIst, args } = params;
  if (!args.expenseAmount || Number(args.expenseAmount) <= 0) return { linkedTxResult: null };
  const err = validateCompoundExpenseArgs(auth, args);
  if (err) return { error: err };

  const linkedTxResult = await createLinkedFinanceExpense(supabase, auth.userId, {
    title: mealName,
    merchantName: String(args.merchantName || mealName),
    amount: Number(args.expenseAmount),
    accountId: String(args.accountId),
    categoryId: args.expenseCategoryId ? String(args.expenseCategoryId) : undefined,
    preferredCategorySlugs: ['food-dining', 'other'],
    subcategory: isJunkMeal ? 'Junk Food' : 'Healthy Meal',
    date: dateIst,
    notes: String(args.notes ?? `Logged via meal: ${mealName}`),
    tags: ['fitness_meal', ...(isJunkMeal ? ['junk_food'] : [])],
  });
  return { linkedTxResult };
}

async function fetchMealTemplateRow(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  templateId?: unknown
) {
  if (!templateId) return null;
  const { data } = await supabase
    .from('meal_templates')
    .select('*')
    .eq('user_id', userId)
    .eq('id', String(templateId))
    .maybeSingle();
  return data;
}

async function resolveMealLinkedTransaction(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  auth: McpAuthContext;
  mealName: string;
  dateIst: string;
  isJunkMeal: boolean;
  explicitTxId: string | null;
  notes?: string | null;
}) {
  if (params.explicitTxId) return { resolvedLinkedTxId: params.explicitTxId, autoLinkedTransaction: null };
  const autoLinkedTransaction = await tryAutoLinkMealToTransaction(params);
  return {
    resolvedLinkedTxId: autoLinkedTransaction?.id ?? null,
    autoLinkedTransaction,
  };
}

async function insertMealAndRunHooks(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: UserId;
  dateIst: string;
  mealName: string;
  isJunkMeal: boolean;
  insertPayload: Record<string, unknown>;
  autoLinkedTransaction: { id: string; title: string; amount: number; date: string } | null;
  linkedTxResult: { transaction: Record<string, unknown>; updatedAccounts: { id: string; newBalance: number }[] } | null | undefined;
}) {
  const { supabase, userId, dateIst, mealName, isJunkMeal, insertPayload, autoLinkedTransaction, linkedTxResult } = params;
  const { data, error } = await supabase.from('meal_logs').insert(insertPayload).select().single();
  if (error) throw error;

  const mappedMeal = mapMealLogFromRow(data);
  const autoLoggedSupplement = !isJunkMeal
    ? await tryAutoDeductProteinSupplement({ supabase, userId, mappedMeal, mealName, dateIst })
    : null;

  return {
    payload: {
      action: 'logged',
      meal: mappedMeal,
      ...(autoLoggedSupplement ? { autoLoggedSupplement } : {}),
      ...(autoLinkedTransaction ? { autoLinkedTransaction } : {}),
      ...(linkedTxResult
        ? { linkedTransaction: linkedTxResult.transaction, updatedAccounts: linkedTxResult.updatedAccounts }
        : {}),
    },
  };
}

function resolveIsJunkMeal(args: Record<string, unknown>, templateRow: Record<string, unknown> | null): boolean {
  return args.isJunk !== undefined ? Boolean(args.isJunk) : Boolean(templateRow?.is_junk);
}

function resolveMealName(args: Record<string, unknown>, templateRow: Record<string, unknown> | null): string {
  return String(args.name || templateRow?.name || '').trim();
}

async function logNewMeal(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  auth: McpAuthContext,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  const templateRow = await fetchMealTemplateRow(supabase, auth.userId, args.templateId);
  const mealName = resolveMealName(args, templateRow);
  if (!mealName) return { error: 'Validation Error: name or valid templateId is required.' };

  const dateIst = String(args.date || getIstIsoDate());
  const isJunkMeal = resolveIsJunkMeal(args, templateRow);

  const expRes = await createCompoundMealExpense({ supabase, auth, mealName, isJunkMeal, dateIst, args });
  if (expRes.error) return { error: expRes.error };

  const { resolvedLinkedTxId, autoLinkedTransaction } = await resolveMealLinkedTransaction({
    supabase,
    auth,
    mealName,
    dateIst,
    isJunkMeal,
    explicitTxId: orVal(expRes.linkedTxResult?.transaction.id, orVal(args.linkedTransactionId, null)) as string | null,
    notes: args.notes as string | null | undefined,
  });

  const insertPayload = buildLoggedMealPayload({
    userId: auth.userId,
    dateIst,
    mealName,
    isJunkMeal,
    mult: Math.max(0.1, Number(orVal(args.quantityMultiplier, 1))),
    templateRow,
    resolvedLinkedTxId,
    args,
  });

  return insertMealAndRunHooks({
    supabase,
    userId: auth.userId,
    dateIst,
    mealName,
    isJunkMeal,
    insertPayload,
    autoLinkedTransaction,
    linkedTxResult: expRes.linkedTxResult,
  });
}

const MEAL_WRITE_HANDLERS: Record<
  string,
  (supabase: ReturnType<typeof getSupabaseAdmin>, auth: McpAuthContext, args: Record<string, unknown>) => Promise<{ error?: string; payload?: unknown }>
> = {
  delete: (supabase, auth, args) => deleteOrRestoreMeal(supabase, auth.userId, args),
  restore: (supabase, auth, args) => deleteOrRestoreMeal(supabase, auth.userId, args),
  update: (supabase, auth, args) => updateMealLog(supabase, auth.userId, args),
  delete_template: (supabase, auth, args) => deleteOrRestoreMealTemplate(supabase, auth.userId, args),
  restore_template: (supabase, auth, args) => deleteOrRestoreMealTemplate(supabase, auth.userId, args),
  upsert_template: (supabase, auth, args) => upsertMealTemplate(supabase, auth.userId, args),
  log: (supabase, auth, args) => logNewMeal(supabase, auth, args),
};

async function handleManageMealsWrite(auth: McpAuthContext, args: Record<string, unknown>) {
  const startMs = Date.now();
  const handler = MEAL_WRITE_HANDLERS[String(args.action)] ?? MEAL_WRITE_HANDLERS.log;

  try {
    const outcome = await handler(getSupabaseAdmin(), auth, args);
    if (outcome.error) return mcpError(outcome.error);
    return logAndReturnMcpSuccess({
      auth,
      toolName: 'manage_meals',
      action: String(args.action),
      input: args,
      startMs,
      payload: outcome.payload,
    });
  } catch (error) {
    return logAndReturnMcpError({
      auth,
      toolName: 'manage_meals',
      action: String(args.action),
      input: args,
      startMs,
      error,
      prefix: 'Failed to manage meals',
    });
  }
}

export function registerManageMealsTool(server: McpServer) {
  server.registerTool(
    'manage_meals',
    {
      title: 'Manage Meals & Saved Templates',
      description:
        'Full CRUD for meal logs and Indian staple meal templates: list, log (optionally creating a linked finance expense when expenseAmount + accountId are provided), update, soft-delete, restore, list_templates, upsert_template, delete_template, restore_template.',
      inputSchema: {
        action: z
          .enum(['list', 'log', 'update', 'delete', 'restore', 'list_templates', 'upsert_template', 'delete_template', 'restore_template'])
          .describe('Meal management action'),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        includeDeleted: z.boolean().optional().default(false),
        mealId: z.string().uuid().optional().describe('Meal log UUID for update, delete, restore'),
        templateId: z.string().uuid().optional().describe('Template UUID for upsert, delete_template, restore_template, or template lookup'),
        name: z.string().min(1).max(160).optional(),
        mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout']).optional(),
        calories: z.number().min(0).optional(),
        proteinG: z.number().min(0).optional(),
        carbsG: z.number().min(0).optional(),
        fatG: z.number().min(0).optional(),
        fiberG: z.number().min(0).nullable().optional(),
        quantityMultiplier: z.number().min(0.1).max(20).optional(),
        isJunk: z.boolean().optional(),
        servingLabel: z.string().optional(),
        hindiAliases: z.array(z.string()).optional(),
        isPinned: z.boolean().optional(),
        linkedTransactionId: z.string().uuid().nullable().optional(),
        expenseAmount: z.number().positive().optional().describe('Optional INR amount spent to auto-create a linked expense transaction (requires accountId & habitflow:finance:write)'),
        accountId: z.string().uuid().optional().describe('Source finance account UUID for compound paid-meal logging'),
        expenseCategoryId: z.string().uuid().optional().describe('Optional finance category UUID for compound meal expense'),
        merchantName: z.string().optional().describe('Optional restaurant/merchant name for compound meal expense'),
        notes: z.string().nullable().optional(),
        confirm: z.boolean().optional().describe('Required for delete and delete_template'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      if (args.action === 'list' || args.action === 'list_templates') {
        const authRes = authorizeMcpTool('habitflow:read');
        if (!authRes.ok) return authRes.response;
        return args.action === 'list_templates'
          ? listMealTemplates(authRes.auth.userId, args.includeDeleted)
          : listMealLogs(authRes.auth.userId, args);
      }
      const authRes = authorizeMcpTool('habitflow:write');
      if (!authRes.ok) return authRes.response;
      return handleManageMealsWrite(authRes.auth, args);
    }
  );
}
