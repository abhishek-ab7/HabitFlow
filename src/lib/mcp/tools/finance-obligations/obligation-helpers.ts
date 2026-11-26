 
import { getSupabaseAdmin } from '../../supabase-admin';
import {
  applyAccountBalanceDelta,
  getInsertMetadata,
  getSoftDeleteMetadata,
  getUpdateMetadata,
  resolveFallbackFinanceCategoryId,
} from '../../sync-helpers';
import { mcpError, mcpJson } from '../tool-helpers';

export async function listObligationRows(params: {
  table: 'finance_recurring_bills' | 'emi_trackers' | 'finance_sip_plans' | 'monthly_commitments';
  userId: string;
  includeArchived: boolean;
  orderCols: string[];
  resultKey: string;
  errorLabel: string;
}) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from(params.table).select('*').eq('user_id', params.userId);
  if (!params.includeArchived) query = query.is('deleted_at', null);
  for (const col of params.orderCols) {
    query = query.order(col);
  }

  const { data, error } = await query;
  if (error) return mcpError(`Failed to fetch ${params.errorLabel}: ${error.message}`);
  return mcpJson({ count: (data || []).length, [params.resultKey]: data || [] });
}

export async function archiveObligationRow(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  table: 'finance_recurring_bills' | 'emi_trackers' | 'finance_sip_plans' | 'monthly_commitments';
  id: string;
  existing: Record<string, any>;
  extraPatch?: Record<string, unknown>;
  confirm?: boolean;
  confirmMessage: string;
}) {
  if (!params.confirm) return { error: params.confirmMessage };
  const { data, error } = await params.supabase
    .from(params.table)
    .update({ ...params.extraPatch, ...getSoftDeleteMetadata(params.existing) })
    .eq('id', params.id)
    .select()
    .single();
  if (error) throw error;
  return { data };
}

export async function restoreObligationRow(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  table: 'finance_recurring_bills' | 'emi_trackers' | 'finance_sip_plans' | 'monthly_commitments';
  userId: string;
  id: string;
  existing: Record<string, any>;
  extraPatch?: Record<string, unknown>;
}) {
  const { data, error } = await params.supabase
    .from(params.table)
    .update({ deleted_at: null, ...params.extraPatch, ...getUpdateMetadata(params.existing) })
    .eq('user_id', params.userId)
    .eq('id', params.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function insertLinkedObligationTx(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  accountId: string;
  categoryId: string | null;
  fallbackSlugs: string[];
  txFields: Record<string, unknown>;
  amount: number;
}) {
  const txCategoryId =
    params.categoryId ||
    (await resolveFallbackFinanceCategoryId(params.supabase, params.userId, params.fallbackSlugs));
  const txPayload = {
    user_id: params.userId,
    category_id: txCategoryId,
    account_id: params.accountId,
    amount: params.amount,
    ...params.txFields,
    ...getInsertMetadata(),
  };

  const { data: tx, error } = await params.supabase
    .from('finance_transactions')
    .insert(txPayload)
    .select()
    .single();
  if (error) throw error;

  await applyAccountBalanceDelta(params.supabase, params.userId, [
    { accountId: params.accountId, delta: -params.amount },
  ]);
  return tx;
}
