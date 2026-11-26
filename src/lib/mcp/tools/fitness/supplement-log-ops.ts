import { getSupabaseAdmin } from '../../supabase-admin';
import { getInsertMetadata, getSoftDeleteMetadata, getUpdateMetadata } from '../../sync-helpers';
import { mapSupplementInventoryFromRow, mapSupplementLogFromRow } from '../../mappers';
import { deriveSupplementRemainingServings } from '@/lib/fitness/shared-analytics';
import { mcpError, mcpJson, pickDefinedColumns } from '../tool-helpers';

const LOG_UPDATE_COLUMNS = [
  ['date', 'date'],
  ['servingsTaken', 'servings_taken'],
  ['notes', 'notes'],
] as const;

type UserId = string;
type SupId = string;
type IsoDate = string;

export async function recomputeSupplementRemaining(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  supRow: Record<string, unknown>
) {
  const mappedSup = mapSupplementInventoryFromRow(supRow);
  const { data: allLogs } = await supabase
    .from('supplement_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('supplement_id', mappedSup.id)
    .is('deleted_at', null);

  const nextRemaining = deriveSupplementRemainingServings(
    mappedSup,
    (allLogs || []).map(mapSupplementLogFromRow)
  );
  await supabase
    .from('supplement_inventory')
    .update({ remaining_servings: nextRemaining, ...getUpdateMetadata(supRow) })
    .eq('user_id', userId)
    .eq('id', mappedSup.id);
  return nextRemaining;
}

export async function listSupplementLogs(userId: UserId, args: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('supplement_logs').select('*').eq('user_id', userId);
  if (args.supplementId) query = query.eq('supplement_id', String(args.supplementId));
  if (args.date) query = query.eq('date', String(args.date));
  if (args.startDate) query = query.gte('date', String(args.startDate));
  if (args.endDate) query = query.lte('date', String(args.endDate));
  if (!args.includeDeleted) query = query.is('deleted_at', null);

  const { data, error } = await query.order('date', { ascending: false }).order('taken_at', { ascending: false });
  if (error) return mcpError(`Failed to list supplement logs: ${error.message}`);
  const logs = (data || []).map(mapSupplementLogFromRow);
  return mcpJson({ count: logs.length, logs });
}

function buildSupLogPatch(existingLog: Record<string, unknown>, args: Record<string, unknown>) {
  if (args.action === 'delete_log') return getSoftDeleteMetadata(existingLog);
  if (args.action === 'restore_log') return { deleted_at: null, ...getUpdateMetadata(existingLog) };
  return { ...pickDefinedColumns(args, LOG_UPDATE_COLUMNS), ...getUpdateMetadata(existingLog) };
}

async function fetchSupplementLogById(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  logId: string
) {
  const { data, error } = await supabase
    .from('supplement_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('id', logId)
    .single();
  return error || !data ? null : data;
}

export async function mutateSupplementLog(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  if (!args.logId) return { error: `Validation Error: logId is required for ${args.action}.` };
  if (args.action === 'delete_log' && !args.confirm) {
    return { error: 'Confirmation Required: delete_log requires confirm: true.' };
  }

  const existingLog = await fetchSupplementLogById(supabase, userId, String(args.logId));
  if (!existingLog) return { error: `Supplement log not found: ${args.logId}` };

  const { data: updatedLog, error } = await supabase
    .from('supplement_logs')
    .update(buildSupLogPatch(existingLog, args))
    .eq('user_id', userId)
    .eq('id', String(args.logId))
    .select()
    .single();
  if (error) throw error;

  const { data: parentSup } = await supabase
    .from('supplement_inventory')
    .select('*')
    .eq('user_id', userId)
    .eq('id', existingLog.supplement_id)
    .maybeSingle();

  const remainingServings = parentSup ? await recomputeSupplementRemaining(supabase, userId, parentSup) : null;
  return { payload: { action: args.action, log: mapSupplementLogFromRow(updatedLog), remainingServings } };
}

export async function logSupplementDose(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  todayIst: IsoDate,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  if (!args.supplementId) return { error: 'Validation Error: supplementId is required for log_dose.' };
  const supId: SupId = String(args.supplementId);

  const { data: supRow, error: supFetchErr } = await supabase
    .from('supplement_inventory')
    .select('*')
    .eq('user_id', userId)
    .eq('id', supId)
    .is('deleted_at', null)
    .single();
  if (supFetchErr || !supRow) return { error: `Supplement not found: ${supId}` };

  const mappedSup = mapSupplementInventoryFromRow(supRow);
  const doseServings = Math.max(0.1, Number(args.servingsTaken ?? mappedSup.dailyDosage ?? 1));
  const dateIst = String(args.date || todayIst);

  const { data: newLogRow, error: logInsErr } = await supabase
    .from('supplement_logs')
    .insert({
      user_id: userId,
      supplement_id: mappedSup.id,
      date: dateIst,
      servings_taken: doseServings,
      taken_at: new Date().toISOString(),
      notes: args.notes ?? null,
      ...getInsertMetadata(),
    })
    .select()
    .single();
  if (logInsErr) throw logInsErr;

  const nextRemaining = await recomputeSupplementRemaining(supabase, userId, supRow);
  return {
    payload: {
      action: 'dose_logged',
      log: mapSupplementLogFromRow(newLogRow),
      remainingServings: nextRemaining,
    },
  };
}
