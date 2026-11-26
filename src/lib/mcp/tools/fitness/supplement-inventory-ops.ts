import { addDays } from '@/lib/finance/credit-card-cycles';
import { hasScope } from '../../auth';
import type { McpAuthContext } from '../../auth';
import { getSupabaseAdmin } from '../../supabase-admin';
import { createLinkedFinanceExpense, getInsertMetadata, getSoftDeleteMetadata, getUpdateMetadata } from '../../sync-helpers';
import {
  mapFinanceCategoryFromRow,
  mapFinanceTransactionFromRow,
  mapSupplementInventoryFromRow,
  mapSupplementLogFromRow,
  mapWorkoutSessionFromRow,
} from '../../mappers';
import { calculateSupplementStockAndRoi } from '@/lib/fitness/shared-analytics';
import { computeCrossDomainInsights } from '@/lib/intelligence/cross-domain-insights';
import { mcpError, mcpJson, pickDefinedColumns } from '../tool-helpers';

const SUPPLEMENT_UPDATE_COLUMNS = [
  ['brand', 'brand'],
  ['category', 'category'],
  ['unitLabel', 'unit_label'],
  ['totalServings', 'total_servings'],
  ['dailyDosage', 'daily_dosage'],
  ['costInr', 'cost_inr'],
  ['proteinPerServingG', 'protein_per_serving_g'],
  ['anchorBlock', 'anchor_block'],
  ['lowStockThresholdDays', 'low_stock_threshold_days'],
  ['isActive', 'is_active'],
  ['notes', 'notes'],
] as const;

type UserId = string;
type IsoDate = string;

function orVal<T>(value: T | undefined | null, fallback: T): T {
  return value ?? fallback;
}

async function fetchSupplementInventoryAndLogs(userId: UserId, includeDeleted?: unknown, action?: unknown) {
  const supabase = getSupabaseAdmin();
  let invQuery = supabase.from('supplement_inventory').select('*').eq('user_id', userId);
  if (!includeDeleted || action === 'get_roi_audit') invQuery = invQuery.is('deleted_at', null);
  return Promise.all([
    invQuery,
    supabase.from('supplement_logs').select('*').eq('user_id', userId).is('deleted_at', null),
  ]);
}

export async function readInventoryAndRoi(auth: McpAuthContext, todayIst: IsoDate, args: Record<string, unknown>) {
  const [{ data: supRows, error: supErr }, { data: logRows, error: logErr }] = await fetchSupplementInventoryAndLogs(
    auth.userId,
    args.includeDeleted,
    args.action
  );
  if (supErr || logErr) return mcpError(`Failed to fetch supplements: ${(supErr || logErr)?.message}`);

  const inventory = (supRows || []).map(mapSupplementInventoryFromRow);
  const logs = (logRows || []).map(mapSupplementLogFromRow);
  const summary = calculateSupplementStockAndRoi(inventory, logs, todayIst);

  if (args.action === 'list_inventory') {
    return mcpJson({
      todayIst,
      totalMonthlySpendInr: summary.totalMonthlySpendInr,
      items: summary.items,
      lowStockItems: summary.lowStockItems.map((i) => ({
        id: i.supplement.id,
        name: i.supplement.name,
        daysRemaining: i.daysRemaining,
      })),
    });
  }

  return buildRoiAuditResponse({ auth, todayIst, inventory, logs, proteinBenchmarks: summary.proteinBenchmarks });
}

async function fetchFinanceRowsForRoi(supabase: ReturnType<typeof getSupabaseAdmin>, auth: McpAuthContext) {
  if (!hasScope(auth, 'habitflow:finance:read')) return [{ data: [] }, { data: [] }];
  return Promise.all([
    supabase.from('finance_transactions').select('*').eq('user_id', auth.userId).is('deleted_at', null),
    supabase.from('finance_categories').select('*').eq('user_id', auth.userId).is('deleted_at', null),
  ]);
}

async function buildRoiAuditResponse(params: {
  auth: McpAuthContext;
  todayIst: IsoDate;
  inventory: ReturnType<typeof mapSupplementInventoryFromRow>[];
  logs: ReturnType<typeof mapSupplementLogFromRow>[];
  proteinBenchmarks: unknown[];
}) {
  const { auth, todayIst, inventory, logs, proteinBenchmarks } = params;
  const supabase = getSupabaseAdmin();
  const [{ data: workoutRows }, finResults] = await Promise.all([
    supabase.from('workout_sessions').select('*').eq('user_id', auth.userId).is('deleted_at', null).gte('date', addDays(todayIst, -30)),
    fetchFinanceRowsForRoi(supabase, auth),
  ]);

  const [txRes, catRes] = finResults as [{ data: Record<string, unknown>[] | null }, { data: Record<string, unknown>[] | null }];
  const crossDomain = computeCrossDomainInsights({
    todayDate: todayIst,
    transactions: (txRes?.data || []).map(mapFinanceTransactionFromRow),
    categories: (catRes?.data || []).map(mapFinanceCategoryFromRow),
    workoutSessions: (workoutRows || []).map(mapWorkoutSessionFromRow),
    supplementInventory: inventory,
    supplementLogs: logs,
  });
  return mcpJson({
    todayIst,
    gymSupplementRoi: crossDomain.gymSupplementRoi,
    proteinBenchmarks: proteinBenchmarks.slice(0, 6),
  });
}

async function fetchSupplementById(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  supplementId: string,
  activeOnly = false
) {
  let query = supabase.from('supplement_inventory').select('*').eq('user_id', userId).eq('id', supplementId);
  if (activeOnly) query = query.is('deleted_at', null);
  const { data, error } = await query.single();
  return error || !data ? null : data;
}

function buildSupplementArchivePatch(isDelete: boolean, existing: Record<string, unknown>) {
  return isDelete
    ? { is_active: false, ...getSoftDeleteMetadata(existing) }
    : { is_active: true, deleted_at: null, ...getUpdateMetadata(existing) };
}

export async function deleteOrRestoreSupplementItem(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  if (!args.supplementId) return { error: `Validation Error: supplementId is required for ${args.action}.` };
  const isDelete = args.action === 'delete_item';
  if (isDelete && !args.confirm) return { error: 'Confirmation Required: delete_item requires confirm: true.' };

  const existing = await fetchSupplementById(supabase, userId, String(args.supplementId));
  if (!existing) return { error: `Supplement not found: ${args.supplementId}` };

  const { data, error } = await supabase
    .from('supplement_inventory')
    .update(buildSupplementArchivePatch(isDelete, existing))
    .eq('user_id', userId)
    .eq('id', String(args.supplementId))
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: isDelete ? 'item_deleted' : 'item_restored', item: mapSupplementInventoryFromRow(data) } };
}

async function sumSupplementTaken(supabase: ReturnType<typeof getSupabaseAdmin>, userId: UserId, supplementId: string): Promise<number> {
  const { data: supLogs } = await supabase
    .from('supplement_logs')
    .select('servings_taken')
    .eq('user_id', userId)
    .eq('supplement_id', supplementId)
    .is('deleted_at', null);
  return (supLogs || []).reduce((s, l) => s + Math.max(0, Number(l.servings_taken || 0)), 0);
}

async function createRestockExpenseIfRequested(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  auth: McpAuthContext;
  existing: Record<string, unknown>;
  todayIst: IsoDate;
  args: Record<string, unknown>;
}) {
  const { supabase, auth, existing, todayIst, args } = params;
  if (!args.expenseAmount || Number(args.expenseAmount) <= 0) return { linkedTxResult: null };
  if (!args.accountId) return { error: 'Validation Error: accountId is required when expenseAmount is provided.' };
  if (!hasScope(auth, 'habitflow:finance:write')) {
    return { error: 'Forbidden: Missing habitflow:finance:write scope for compound restock expense.' };
  }
  const linkedTxResult = await createLinkedFinanceExpense(supabase, auth.userId, {
    title: `Restock: ${existing.name}`,
    merchantName: String(existing.brand || existing.name),
    amount: Number(args.expenseAmount),
    accountId: String(args.accountId),
    categoryId: args.expenseCategoryId ? String(args.expenseCategoryId) : undefined,
    preferredCategorySlugs: ['health-fitness', 'other'],
    subcategory: 'Supplements',
    date: String(args.date || todayIst),
    notes: String(args.notes ?? `Restocked ${existing.name}`),
    tags: ['supplement_restock', 'fitness'],
  });
  return { linkedTxResult };
}

function resolveRestockTotalServings(existing: Record<string, unknown>, args: Record<string, unknown>): number {
  if (args.totalServings !== undefined) return Number(args.totalServings);
  return Number(orVal(existing.total_servings, 30)) + Number(orVal(args.addedServings, 30));
}

function resolveRestockTargetRemaining(existing: Record<string, unknown>, args: Record<string, unknown>): number {
  if (args.remainingServings !== undefined) return Math.max(0, Number(args.remainingServings));
  const delta = Number(orVal(args.addedServings, orVal(args.totalServings, orVal(existing.total_servings, 30))));
  return Number((Number(orVal(existing.remaining_servings, 0)) + delta).toFixed(2));
}

function computeRestockFields(
  existing: Record<string, unknown>,
  args: Record<string, unknown>,
  takenSum: number
) {
  const nextTotal = resolveRestockTotalServings(existing, args);
  const targetRemaining = resolveRestockTargetRemaining(existing, args);
  return {
    total_servings: nextTotal,
    remaining_servings: targetRemaining,
    manual_adjustment: Number((targetRemaining + takenSum - nextTotal).toFixed(2)),
  };
}

function resolveRestockCostInr(
  args: Record<string, unknown>,
  linkedTxResult: unknown,
  existingCost: unknown
) {
  if (args.costInr !== undefined) return args.costInr;
  return linkedTxResult ? args.expenseAmount : existingCost;
}

async function applyRestockInventoryUpdate(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: UserId;
  supId: string;
  existing: Record<string, unknown>;
  todayIst: IsoDate;
  args: Record<string, unknown>;
  linkedTxResult: { transaction: Record<string, unknown>; updatedAccounts: { id: string; newBalance: number }[] } | null | undefined;
}) {
  const { supabase, userId, supId, existing, todayIst, args, linkedTxResult } = params;
  const takenSum = await sumSupplementTaken(supabase, userId, supId);
  const restockFields = computeRestockFields(existing, args, takenSum);

  const { data: updated, error: updErr } = await supabase
    .from('supplement_inventory')
    .update({
      ...restockFields,
      cost_inr: resolveRestockCostInr(args, linkedTxResult, existing.cost_inr),
      last_restocked_at: String(args.date || todayIst),
      linked_transaction_id: linkedTxResult?.transaction.id ?? existing.linked_transaction_id ?? null,
      is_active: true,
      notes: args.notes !== undefined ? args.notes : existing.notes,
      ...getUpdateMetadata(existing),
    })
    .eq('user_id', userId)
    .eq('id', supId)
    .select()
    .single();
  if (updErr) throw updErr;
  return updated;
}

function formatRestockPayload(
  updated: Record<string, unknown>,
  linkedTxResult: { transaction: Record<string, unknown>; updatedAccounts: { id: string; newBalance: number }[] } | null | undefined
) {
  return {
    action: 'restocked',
    item: mapSupplementInventoryFromRow(updated),
    ...(linkedTxResult
      ? { linkedTransaction: linkedTxResult.transaction, updatedAccounts: linkedTxResult.updatedAccounts }
      : {}),
  };
}

export async function restockSupplementItem(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  auth: McpAuthContext,
  todayIst: IsoDate,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  if (!args.supplementId) return { error: 'Validation Error: supplementId is required for restock_item.' };
  const supId = String(args.supplementId);
  const existing = await fetchSupplementById(supabase, auth.userId, supId, true);
  if (!existing) return { error: `Supplement not found: ${supId}` };

  const expRes = await createRestockExpenseIfRequested({ supabase, auth, existing, todayIst, args });
  if (expRes.error) return { error: expRes.error };

  const updated = await applyRestockInventoryUpdate({
    supabase,
    userId: auth.userId,
    supId,
    existing,
    todayIst,
    args,
    linkedTxResult: expRes.linkedTxResult,
  });

  return { payload: formatRestockPayload(updated, expRes.linkedTxResult) };
}

function computeManualAdj(remaining: number, takenSum: number, total: number): number {
  return Number((remaining + takenSum - total).toFixed(2));
}

async function updateExistingSupplement(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  const supId = String(args.supplementId);
  const existing = await fetchSupplementById(supabase, userId, supId);
  if (!existing) return { error: `Supplement not found: ${supId}` };

  const updates: Record<string, unknown> = { ...pickDefinedColumns(args, SUPPLEMENT_UPDATE_COLUMNS), deleted_at: null };
  if (args.name !== undefined) updates.name = String(args.name).trim();
  if (args.remainingServings !== undefined) {
    const takenSum = await sumSupplementTaken(supabase, userId, supId);
    const nextTotal = Number(args.totalServings ?? existing.total_servings ?? 30);
    const targetRem = Math.max(0, Number(args.remainingServings));
    updates.remaining_servings = targetRem;
    updates.manual_adjustment = computeManualAdj(targetRem, takenSum, nextTotal);
  }

  const { data, error } = await supabase
    .from('supplement_inventory')
    .update({ ...updates, ...getUpdateMetadata(existing) })
    .eq('user_id', userId)
    .eq('id', supId)
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'updated', item: mapSupplementInventoryFromRow(data) } };
}

function buildNewSupplementRow(userId: UserId, todayIst: IsoDate, args: Record<string, unknown>) {
  const totalServings = Math.max(1, Number(args.totalServings ?? 30));
  const remainingServings =
    args.remainingServings !== undefined ? Math.max(0, Number(args.remainingServings)) : totalServings;
  return {
    user_id: userId,
    name: String(args.name).trim(),
    brand: orVal(args.brand, null),
    category: orVal(args.category, 'other'),
    unit_label: orVal(args.unitLabel, 'scoop'),
    total_servings: totalServings,
    remaining_servings: remainingServings,
    manual_adjustment: Number((remainingServings - totalServings).toFixed(2)),
    daily_dosage: orVal(args.dailyDosage, 1),
    cost_inr: orVal(args.costInr, 0),
    protein_per_serving_g: orVal(args.proteinPerServingG, null),
    anchor_block: orVal(args.anchorBlock, null),
    low_stock_threshold_days: orVal(args.lowStockThresholdDays, 7),
    last_restocked_at: todayIst,
    is_active: args.isActive !== false,
    notes: orVal(args.notes, null),
    ...getInsertMetadata(),
  };
}

export async function upsertSupplementItem(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  todayIst: IsoDate,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  if (args.supplementId) return updateExistingSupplement(supabase, userId, args);
  if (!args.name) return { error: 'Validation Error: name is required.' };

  const { data, error } = await supabase
    .from('supplement_inventory')
    .insert(buildNewSupplementRow(userId, todayIst, args))
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'created', item: mapSupplementInventoryFromRow(data) } };
}
