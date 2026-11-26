import type { McpAuthContext } from '../../auth';
import { hasScope } from '../../auth';
import { getSupabaseAdmin } from '../../supabase-admin';
import { getInsertMetadata, getUpdateMetadata } from '../../sync-helpers';
import {
  mapFinanceCategoryFromRow,
  mapFinanceTransactionFromRow,
  mapMealLogFromRow,
  mapSupplementInventoryFromRow,
  mapSupplementLogFromRow,
} from '../../mappers';
import { deriveSupplementRemainingServings } from '@/lib/fitness/shared-analytics';
import {
  buildAutoMealSupplementNoteTag,
  hasAutoMealSupplementLog,
  matchProteinMealToSupplement,
} from '@/lib/fitness/supplement-meal-bridge';
import { findBestMealTransactionMatch } from '@/lib/fitness/meal-finance-matcher';

type MappedMeal = ReturnType<typeof mapMealLogFromRow>;

type UserId = string;
type IsoDate = string;

export async function tryAutoLinkMealToTransaction(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  auth: McpAuthContext;
  mealName: string;
  dateIst: IsoDate;
  isJunkMeal: boolean;
  notes?: string | null;
}) {
  if (!hasScope(params.auth, 'habitflow:finance:read')) return null;

  const [{ data: dayTxs }, { data: finCats }, { data: dayMeals }] = await Promise.all([
    params.supabase
      .from('finance_transactions')
      .select('*')
      .eq('user_id', params.auth.userId)
      .eq('date', params.dateIst)
      .is('deleted_at', null),
    params.supabase.from('finance_categories').select('*').eq('user_id', params.auth.userId).is('deleted_at', null),
    params.supabase
      .from('meal_logs')
      .select('*')
      .eq('user_id', params.auth.userId)
      .eq('date', params.dateIst)
      .is('deleted_at', null),
  ]);

  const txMatch = findBestMealTransactionMatch(
    { id: '__draft__', name: params.mealName, date: params.dateIst, isJunk: params.isJunkMeal, notes: params.notes ?? null },
    (dayTxs || []).map(mapFinanceTransactionFromRow),
    (dayMeals || []).map(mapMealLogFromRow),
    (finCats || []).map(mapFinanceCategoryFromRow)
  );
  if (!txMatch || txMatch.confidence !== 'high') return null;

  return {
    id: txMatch.transaction.id,
    title: txMatch.transaction.title,
    amount: txMatch.transaction.amount,
    date: txMatch.transaction.date,
  };
}

async function recordAutoDeductSupplementLog(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: UserId;
  supMatch: NonNullable<ReturnType<typeof matchProteinMealToSupplement>>;
  supRows: Record<string, unknown>[];
  mappedExistingSupLogs: ReturnType<typeof mapSupplementLogFromRow>[];
  mealId: string;
  mealName: string;
  dateIst: IsoDate;
}) {
  const { supabase, userId, supMatch, supRows, mappedExistingSupLogs, mealId, mealName, dateIst } = params;
  const { data: insSupLog, error: insSupLogErr } = await supabase
    .from('supplement_logs')
    .insert({
      user_id: userId,
      supplement_id: supMatch.supplement.id,
      date: dateIst,
      servings_taken: supMatch.servings,
      taken_at: new Date().toISOString(),
      notes: `Auto-synced from meal: ${mealName} ${buildAutoMealSupplementNoteTag(mealId)}`,
      ...getInsertMetadata(),
    })
    .select()
    .single();
  if (insSupLogErr || !insSupLog) return null;

  const allLogsForSup = [...mappedExistingSupLogs, mapSupplementLogFromRow(insSupLog)];
  const nextRemaining = deriveSupplementRemainingServings(supMatch.supplement, allLogsForSup);
  const rawSupRow = supRows.find((r) => r.id === supMatch.supplement.id);
  const { error: updSupErr } = await supabase
    .from('supplement_inventory')
    .update({ remaining_servings: nextRemaining, ...getUpdateMetadata(rawSupRow) })
    .eq('user_id', userId)
    .eq('id', supMatch.supplement.id);
  if (updSupErr) throw updSupErr;

  return {
    supplementId: supMatch.supplement.id,
    name: supMatch.supplement.name,
    brand: supMatch.supplement.brand ?? null,
    servingsTaken: supMatch.servings,
    remainingServings: nextRemaining,
    logId: insSupLog.id,
  };
}

export async function tryAutoDeductProteinSupplement(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: UserId;
  mappedMeal: MappedMeal;
  mealName: string;
  dateIst: IsoDate;
}) {
  const { supabase, userId, mappedMeal, mealName, dateIst } = params;
  const { data: supRows } = await supabase
    .from('supplement_inventory')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null);

  const mappedSups = (supRows || []).map(mapSupplementInventoryFromRow);
  const supMatch = matchProteinMealToSupplement(mappedMeal, mappedSups);
  if (!supMatch) return null;

  const { data: existingSupLogs } = await supabase
    .from('supplement_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('supplement_id', supMatch.supplement.id)
    .is('deleted_at', null);

  const mappedExistingSupLogs = (existingSupLogs || []).map(mapSupplementLogFromRow);
  if (hasAutoMealSupplementLog(mappedExistingSupLogs, mappedMeal.id, supMatch.supplement.id)) return null;

  return recordAutoDeductSupplementLog({
    supabase,
    userId,
    supMatch,
    supRows: supRows || [],
    mappedExistingSupLogs,
    mealId: mappedMeal.id,
    mealName,
    dateIst,
  });
}
