import { getSupabaseAdmin } from '../../supabase-admin';
import { getInsertMetadata, getSoftDeleteMetadata, getUpdateMetadata } from '../../sync-helpers';
import { mapMealTemplateFromRow } from '../../mappers';
import { mcpError, mcpJson, pickDefinedColumns } from '../tool-helpers';

const TEMPLATE_UPDATE_COLUMNS = [
  ['proteinG', 'protein_g'],
  ['carbsG', 'carbs_g'],
  ['fatG', 'fat_g'],
  ['fiberG', 'fiber_g'],
  ['servingLabel', 'serving_label'],
  ['hindiAliases', 'hindi_aliases'],
  ['mealType', 'meal_type'],
  ['isJunk', 'is_junk'],
  ['isPinned', 'is_pinned'],
] as const;

type UserId = string;

function orVal<T>(value: T | undefined | null, fallback: T): T {
  return value ?? fallback;
}

export async function listMealTemplates(userId: UserId, includeDeleted?: boolean) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('meal_templates').select('*').eq('user_id', userId);
  if (!includeDeleted) query = query.is('deleted_at', null);
  const { data, error } = await query.order('order_index', { ascending: true });
  if (error) return mcpError(`Failed to list meal templates: ${error.message}`);
  const templates = (data || []).map(mapMealTemplateFromRow);
  return mcpJson({ count: templates.length, templates });
}

export async function softDeleteOrRestoreRow(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  table: string;
  userId: UserId;
  id: string;
  isDelete: boolean;
  confirm?: unknown;
  notFoundLabel: string;
}) {
  if (params.isDelete && !params.confirm) {
    return { error: `Confirmation Required: delete requires confirm: true.` };
  }
  const { data: existing, error: fetchErr } = await params.supabase
    .from(params.table)
    .select('*')
    .eq('user_id', params.userId)
    .eq('id', params.id)
    .single();
  if (fetchErr || !existing) return { error: `${params.notFoundLabel} not found: ${params.id}` };

  const patch = params.isDelete ? getSoftDeleteMetadata(existing) : { deleted_at: null, ...getUpdateMetadata(existing) };
  const { data, error } = await params.supabase
    .from(params.table)
    .update(patch)
    .eq('user_id', params.userId)
    .eq('id', params.id)
    .select()
    .single();
  if (error) throw error;
  return { data };
}

export async function deleteOrRestoreMealTemplate(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  if (!args.templateId) return { error: `Validation Error: templateId is required for ${args.action}.` };
  const isDelete = args.action === 'delete_template';
  const res = await softDeleteOrRestoreRow({
    supabase,
    table: 'meal_templates',
    userId,
    id: String(args.templateId),
    isDelete,
    confirm: args.confirm,
    notFoundLabel: 'Meal template',
  });
  if (res.error || !res.data) return { error: res.error };
  return {
    payload: {
      action: isDelete ? 'template_deleted' : 'template_restored',
      template: mapMealTemplateFromRow(res.data),
    },
  };
}

async function updateExistingMealTemplate(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  const { data: existing, error: fetchErr } = await supabase
    .from('meal_templates')
    .select('*')
    .eq('user_id', userId)
    .eq('id', String(args.templateId))
    .single();
  if (fetchErr || !existing) return { error: `Meal template not found: ${args.templateId}` };

  const updates: Record<string, unknown> = { ...pickDefinedColumns(args, TEMPLATE_UPDATE_COLUMNS), deleted_at: null };
  if (args.name !== undefined) updates.name = String(args.name).trim();
  if (args.calories !== undefined) updates.calories = Math.round(Number(args.calories));
  const { data, error } = await supabase
    .from('meal_templates')
    .update({ ...updates, ...getUpdateMetadata(existing) })
    .eq('user_id', userId)
    .eq('id', String(args.templateId))
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'template_updated', template: mapMealTemplateFromRow(data) } };
}

export async function upsertMealTemplate(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  if (args.templateId) return updateExistingMealTemplate(supabase, userId, args);
  if (!args.name) return { error: 'Validation Error: name is required for template.' };

  const { data, error } = await supabase
    .from('meal_templates')
    .insert({
      user_id: userId,
      name: String(args.name).trim(),
      hindi_aliases: orVal(args.hindiAliases, []),
      calories: Math.round(Number(args.calories ?? 0)),
      protein_g: orVal(args.proteinG, 0),
      carbs_g: orVal(args.carbsG, 0),
      fat_g: orVal(args.fatG, 0),
      fiber_g: orVal(args.fiberG, null),
      serving_label: orVal(args.servingLabel, '1 serving'),
      meal_type: orVal(args.mealType, null),
      is_junk: orVal(args.isJunk, false),
      is_pinned: args.isPinned !== false,
      order_index: 0,
      ...getInsertMetadata(),
    })
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'template_created', template: mapMealTemplateFromRow(data) } };
}
