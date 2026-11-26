import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { McpAuthContext } from '../../auth';
import { getSupabaseAdmin } from '../../supabase-admin';
import { getIstIsoDate } from '../../config';
import { getInsertMetadata, getSoftDeleteMetadata, getUpdateMetadata } from '../../sync-helpers';
import { mapFitnessDailyLogFromRow } from '../../mappers';
import {
  authorizeMcpTool,
  logAndReturnMcpError,
  logAndReturnMcpSuccess,
  mcpError,
  mcpJson,
  pickDefinedColumns,
} from '../tool-helpers';
import {
  autoRestGymHabitsForDay,
  revertLowEnergyRestHabits,
  syncProfileWeightIfLatest,
} from './body-metrics-rest-hook';

const METRICS_UPDATE_COLUMNS = [
  ['weightKg', 'weight_kg'],
  ['waistInches', 'waist_inches'],
  ['steps', 'steps'],
  ['sleepHours', 'sleep_hours'],
  ['sleepQuality', 'sleep_quality'],
  ['energyLevel', 'energy_level'],
  ['sorenessLevel', 'soreness_level'],
  ['lowEnergyMode', 'low_energy_mode'],
  ['junkFreeOverride', 'junk_free_override'],
  ['notes', 'notes'],
] as const;

type UserId = string;
type IsoDate = string;

function orVal<T>(value: T | undefined | null, fallback: T): T {
  return value ?? fallback;
}

function buildRestedHabitIdsForUpdate(
  existing: Record<string, unknown>,
  args: Record<string, unknown>,
  autoRestedIds: string[]
) {
  if (args.lowEnergyMode === false) return args.restedHabitIds ?? [];
  const existingRested = Array.isArray(existing.rested_habit_ids) ? existing.rested_habit_ids : [];
  const baseList = (args.restedHabitIds !== undefined ? args.restedHabitIds : existingRested) as string[];
  return Array.from(new Set([...baseList, ...autoRestedIds]));
}

function shouldUpdateRestedHabits(args: Record<string, unknown>, autoRestedIds: string[]): boolean {
  return args.lowEnergyMode === false || args.restedHabitIds !== undefined || autoRestedIds.length > 0;
}

function resolveWaterMlUpdate(existing: Record<string, unknown>, args: Record<string, unknown>): number | undefined {
  if (args.waterMl !== undefined) return Number(args.waterMl);
  if (args.addWaterMl !== undefined) return Math.max(0, Number(existing.water_ml || 0) + Number(args.addWaterMl));
  return undefined;
}

function buildMetricsUpdatePatch(
  existing: Record<string, unknown>,
  args: Record<string, unknown>,
  autoRestedIds: string[]
) {
  const updates: Record<string, unknown> = {
    ...pickDefinedColumns(args, METRICS_UPDATE_COLUMNS),
    deleted_at: null,
  };
  const nextWater = resolveWaterMlUpdate(existing, args);
  if (nextWater !== undefined) updates.water_ml = nextWater;
  if (shouldUpdateRestedHabits(args, autoRestedIds)) {
    updates.rested_habit_ids = buildRestedHabitIdsForUpdate(existing, args, autoRestedIds);
  }
  return updates;
}

function resolveInitialRestedIds(args: Record<string, unknown>, autoRestedIds: string[]) {
  if (args.lowEnergyMode === false) return orVal(args.restedHabitIds, []);
  return Array.from(new Set([...((args.restedHabitIds as string[] | undefined) ?? []), ...autoRestedIds]));
}

function buildNewMetricsRow(
  userId: UserId,
  dateIst: IsoDate,
  args: Record<string, unknown>,
  autoRestedIds: string[]
) {
  return {
    user_id: userId,
    date: dateIst,
    weight_kg: orVal(args.weightKg, null),
    waist_inches: orVal(args.waistInches, null),
    water_ml: orVal(args.waterMl, orVal(args.addWaterMl, 0)),
    steps: orVal(args.steps, 0),
    sleep_hours: orVal(args.sleepHours, null),
    sleep_quality: orVal(args.sleepQuality, null),
    energy_level: orVal(args.energyLevel, null),
    soreness_level: orVal(args.sorenessLevel, null),
    low_energy_mode: orVal(args.lowEnergyMode, false),
    junk_free_override: orVal(args.junkFreeOverride, false),
    rested_habit_ids: resolveInitialRestedIds(args, autoRestedIds),
    notes: orVal(args.notes, null),
    ...getInsertMetadata(),
  };
}

function buildDailyMetricsListQuery(userId: UserId, args: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('fitness_daily_logs').select('*').eq('user_id', userId);
  if (!args.includeDeleted) query = query.is('deleted_at', null);
  if (args.date) query = query.eq('date', String(args.date));
  if (args.startDate) query = query.gte('date', String(args.startDate));
  if (args.endDate) query = query.lte('date', String(args.endDate));
  return query.order('date', { ascending: false }).limit(Number(args.limit || 30));
}

async function listDailyBodyMetrics(userId: UserId, args: Record<string, unknown>) {
  const { data, error } = await buildDailyMetricsListQuery(userId, args);
  if (error) return mcpError(`Failed to list daily body metrics: ${error.message}`);
  const logs = (data || []).map(mapFitnessDailyLogFromRow);
  return mcpJson({ count: logs.length, logs });
}

async function fetchBodyMetricsLogForMutation(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  dateIst: IsoDate,
  logId?: unknown
) {
  const baseQuery = supabase.from('fitness_daily_logs').select('*').eq('user_id', userId);
  const query = logId ? baseQuery.eq('id', String(logId)) : baseQuery.eq('date', dateIst);
  const { data: existingLog, error: fetchErr } = await query.maybeSingle();
  if (fetchErr) throw fetchErr;
  return existingLog;
}

async function deleteOrRestoreBodyMetrics(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  dateIst: IsoDate,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  const isDelete = args.action === 'delete';
  if (isDelete && !args.confirm) {
    return { error: 'Confirmation Required: delete requires confirm: true.' };
  }
  const existingLog = await fetchBodyMetricsLogForMutation(supabase, userId, dateIst, args.logId);
  if (!existingLog) return { error: `Daily log not found for ${args.logId || dateIst}` };

  const patch = isDelete ? getSoftDeleteMetadata(existingLog) : { deleted_at: null, ...getUpdateMetadata(existingLog) };
  const { data, error } = await supabase
    .from('fitness_daily_logs')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', existingLog.id)
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: isDelete ? 'deleted' : 'restored', dailyLog: mapFitnessDailyLogFromRow(data) } };
}

async function saveMetricsRow(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: UserId;
  dateIst: IsoDate;
  existing: Record<string, unknown> | null;
  args: Record<string, unknown>;
  autoRestedIds: string[];
}) {
  const { supabase, userId, dateIst, existing, args, autoRestedIds } = params;
  const { data, error } = existing
    ? await supabase
        .from('fitness_daily_logs')
        .update({ ...buildMetricsUpdatePatch(existing, args, autoRestedIds), ...getUpdateMetadata(existing) })
        .eq('user_id', userId)
        .eq('id', existing.id)
        .select()
        .single()
    : await supabase
        .from('fitness_daily_logs')
        .insert(buildNewMetricsRow(userId, dateIst, args, autoRestedIds))
        .select()
        .single();
  if (error) throw error;
  return data;
}

async function upsertBodyMetrics(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  dateIst: IsoDate,
  args: Record<string, unknown>
): Promise<{ payload: unknown }> {
  const { data: existing, error: fetchErr } = await supabase
    .from('fitness_daily_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', dateIst)
    .maybeSingle();
  if (fetchErr) throw fetchErr;

  const autoRestedIds =
    args.lowEnergyMode && args.autoRestGymHabits
      ? await autoRestGymHabitsForDay(supabase, userId, dateIst, args.restReason)
      : [];
  const revertedRestHabitIds =
    args.lowEnergyMode === false ? await revertLowEnergyRestHabits(supabase, userId, dateIst, existing) : [];

  const savedRow = await saveMetricsRow({ supabase, userId, dateIst, existing, args, autoRestedIds });
  const profileWeightSynced = await syncProfileWeightIfLatest(supabase, userId, dateIst, args.weightKg);
  return {
    payload: {
      action: existing ? 'merged_updated' : 'created',
      autoRestedHabitIds: autoRestedIds,
      revertedRestHabitIds,
      profileWeightSynced,
      dailyLog: mapFitnessDailyLogFromRow(savedRow),
    },
  };
}

async function dispatchBodyMetricsWrite(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: UserId;
  dateIst: IsoDate;
  action: string;
  args: Record<string, unknown>;
}): Promise<{ error?: string; payload?: unknown }> {
  const { supabase, userId, dateIst, action, args } = params;
  return action === 'delete' || action === 'restore'
    ? deleteOrRestoreBodyMetrics(supabase, userId, dateIst, args)
    : upsertBodyMetrics(supabase, userId, dateIst, args);
}

async function handleBodyMetricsWrite(auth: McpAuthContext, args: Record<string, unknown>) {
  const startMs = Date.now();
  const action = String(args.action || 'upsert');
  const dateIst = String(args.date || getIstIsoDate());

  try {
    const outcome = await dispatchBodyMetricsWrite({
      supabase: getSupabaseAdmin(),
      userId: auth.userId,
      dateIst,
      action,
      args,
    });
    if (outcome.error) return mcpError(outcome.error);

    return logAndReturnMcpSuccess({
      auth,
      toolName: 'log_daily_body_metrics',
      action,
      input: args,
      startMs,
      payload: outcome.payload,
    });
  } catch (error) {
    return logAndReturnMcpError({
      auth,
      toolName: 'log_daily_body_metrics',
      action,
      input: args,
      startMs,
      error,
      prefix: 'Failed to log body metrics',
    });
  }
}

export function registerLogDailyBodyMetricsTool(server: McpServer) {
  server.registerTool(
    'log_daily_body_metrics',
    {
      title: 'Manage Daily Body Metrics',
      description:
        'List, upsert (field-merged without null clobber), soft-delete, or restore fitness_daily_logs. Supports weightKg, waistInches, waterMl/addWaterMl, steps, sleepHours, energyLevel, sorenessLevel, lowEnergyMode (+ optional autoRestGymHabits), junkFreeOverride, and notes.',
      inputSchema: {
        action: z.enum(['upsert', 'list', 'delete', 'restore']).optional().default('upsert').describe('Action to perform (defaults to upsert)'),
        logId: z.string().uuid().optional().describe('Daily log UUID (optional for delete/restore)'),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional().describe('IST date YYYY-MM-DD (defaults to today in IST)'),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Filter start date for list'),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Filter end date for list'),
        limit: z.number().int().min(1).max(90).optional().default(30).describe('Max rows for list'),
        includeDeleted: z.boolean().optional().default(false),
        weightKg: z.number().min(20).max(350).nullable().optional(),
        waistInches: z.number().min(15).max(80).nullable().optional(),
        waterMl: z.number().int().min(0).max(20000).optional().describe('Set exact daily water ml'),
        addWaterMl: z.number().int().min(1).max(5000).optional().describe('Increment daily water ml'),
        steps: z.number().int().min(0).max(150000).optional(),
        sleepHours: z.number().min(0).max(24).nullable().optional(),
        sleepQuality: z.number().int().min(1).max(5).nullable().optional(),
        energyLevel: z.number().int().min(1).max(5).nullable().optional(),
        sorenessLevel: z.number().int().min(1).max(5).nullable().optional(),
        lowEnergyMode: z.boolean().optional(),
        autoRestGymHabits: z.boolean().optional().describe('When lowEnergyMode is true, automatically mark gym-anchored habits as rest for this date'),
        restReason: z.string().optional().describe('Optional reason when auto-resting gym habits in Low-Energy Mode (defaults to Low-Energy Day)'),
        junkFreeOverride: z.boolean().optional(),
        restedHabitIds: z.array(z.string()).optional(),
        notes: z.string().nullable().optional(),
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
      if ((args.action || 'upsert') === 'list') {
        const authRes = authorizeMcpTool('habitflow:read');
        if (!authRes.ok) return authRes.response;
        return listDailyBodyMetrics(authRes.auth.userId, args);
      }
      const authRes = authorizeMcpTool('habitflow:write');
      if (!authRes.ok) return authRes.response;
      return handleBodyMetricsWrite(authRes.auth, args);
    }
  );
}
