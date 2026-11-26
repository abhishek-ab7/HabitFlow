import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { McpAuthContext } from '../../auth';
import { getSupabaseAdmin } from '../../supabase-admin';
import { getIstIsoDate } from '../../config';
import { getInsertMetadata, getUpdateMetadata } from '../../sync-helpers';
import { mapWorkoutSessionFromRow } from '../../mappers';
import { getProgressiveOverloadHint } from '@/lib/fitness/shared-analytics';
import {
  authorizeMcpTool,
  logAndReturnMcpError,
  logAndReturnMcpSuccess,
  mcpError,
  mcpJson,
  pickDefinedColumns,
} from '../tool-helpers';
import { softDeleteOrRestoreRow } from './meal-template-ops';

const EXERCISE_SET_SCHEMA = z.object({
  reps: z.number().int().min(0),
  weightKg: z.number().min(0),
  rpe: z.number().min(1).max(10).optional(),
  isWarmup: z.boolean().optional(),
});

const EXERCISE_SCHEMA = z.object({
  name: z.string().min(1).max(120),
  muscleGroup: z
    .enum(['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'core', 'cardio', 'full_body', 'other'])
    .optional(),
  sets: z.array(EXERCISE_SET_SCHEMA).default([]),
  notes: z.string().optional(),
});

const WORKOUT_UPDATE_COLUMNS = [
  ['date', 'date'],
  ['workoutType', 'workout_type'],
  ['durationMinutes', 'duration_minutes'],
  ['estimatedCaloriesBurned', 'estimated_calories_burned'],
  ['exercises', 'exercises'],
  ['rpe', 'rpe'],
  ['notes', 'notes'],
] as const;

type UserId = string;

function buildOverloadHintsResponse(
  sessions: ReturnType<typeof mapWorkoutSessionFromRow>[],
  exerciseName?: unknown
) {
  if (exerciseName) {
    const hint = getProgressiveOverloadHint(sessions, String(exerciseName));
    return mcpJson({ exerciseName, hint });
  }
  const distinctNames = Array.from(
    new Set(sessions.flatMap((s) => (s.exercises || []).map((ex) => ex.name)).filter(Boolean))
  ).slice(0, 12);
  const hints = distinctNames.map((name) => getProgressiveOverloadHint(sessions, name)).filter(Boolean);
  return mcpJson({ count: hints.length, hints });
}

function buildWorkoutListQuery(userId: UserId, args: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('workout_sessions').select('*').eq('user_id', userId);
  if (!args.includeDeleted || args.action === 'get_overload_hints') query = query.is('deleted_at', null);
  if (args.startDate) query = query.gte('date', String(args.startDate));
  if (args.endDate) query = query.lte('date', String(args.endDate));
  return query.order('date', { ascending: false }).limit(50);
}

async function handleWorkoutRead(userId: UserId, args: Record<string, unknown>) {
  const { data, error } = await buildWorkoutListQuery(userId, args);
  if (error) return mcpError(`Failed to fetch workouts: ${error.message}`);

  const sessions = (data || []).map(mapWorkoutSessionFromRow);
  if (args.action === 'list') return mcpJson({ count: sessions.length, workouts: sessions });
  return buildOverloadHintsResponse(sessions, args.exerciseName);
}

async function deleteOrRestoreWorkout(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  if (!args.workoutId) return { error: `Validation Error: workoutId is required for ${args.action}.` };
  const isDelete = args.action === 'delete';
  const res = await softDeleteOrRestoreRow({
    supabase,
    table: 'workout_sessions',
    userId,
    id: String(args.workoutId),
    isDelete,
    confirm: args.confirm,
    notFoundLabel: 'Workout session',
  });
  if (res.error || !res.data) return { error: res.error };
  return { payload: { action: isDelete ? 'deleted' : 'restored', workout: mapWorkoutSessionFromRow(res.data) } };
}

async function updateWorkoutSession(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  if (!args.workoutId) return { error: 'Validation Error: workoutId is required for update.' };
  const { data: existing, error: fetchErr } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('id', String(args.workoutId))
    .is('deleted_at', null)
    .single();
  if (fetchErr || !existing) return { error: `Workout session not found: ${args.workoutId}` };

  const updates = pickDefinedColumns(args, WORKOUT_UPDATE_COLUMNS);
  if (args.title !== undefined) updates.title = String(args.title).trim();

  const { data, error } = await supabase
    .from('workout_sessions')
    .update({ ...updates, ...getUpdateMetadata(existing) })
    .eq('user_id', userId)
    .eq('id', String(args.workoutId))
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'updated', workout: mapWorkoutSessionFromRow(data) } };
}

function buildNewWorkoutRow(userId: UserId, args: Record<string, unknown>) {
  return {
    user_id: userId,
    date: args.date || getIstIsoDate(),
    title: String(args.title).trim(),
    workout_type: args.workoutType || 'strength',
    duration_minutes: args.durationMinutes ?? 45,
    estimated_calories_burned: args.estimatedCaloriesBurned ?? null,
    exercises: args.exercises || [],
    rpe: args.rpe ?? null,
    notes: args.notes ?? null,
    source: 'mcp',
    ...getInsertMetadata(),
  };
}

async function logNewWorkout(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  if (!args.title) return { error: 'Validation Error: title is required to log workout.' };
  const { data, error } = await supabase
    .from('workout_sessions')
    .insert(buildNewWorkoutRow(userId, args))
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'logged', workout: mapWorkoutSessionFromRow(data) } };
}

const WORKOUT_WRITE_HANDLERS: Record<
  string,
  (supabase: ReturnType<typeof getSupabaseAdmin>, userId: UserId, args: Record<string, unknown>) => Promise<{ error?: string; payload?: unknown }>
> = {
  delete: deleteOrRestoreWorkout,
  restore: deleteOrRestoreWorkout,
  update: updateWorkoutSession,
  log: logNewWorkout,
};

async function handleWorkoutWrite(auth: McpAuthContext, args: Record<string, unknown>) {
  const startMs = Date.now();
  const handler = WORKOUT_WRITE_HANDLERS[String(args.action)] ?? logNewWorkout;

  try {
    const outcome = await handler(getSupabaseAdmin(), auth.userId, args);
    if (outcome.error) return mcpError(outcome.error);

    return logAndReturnMcpSuccess({
      auth,
      toolName: 'manage_workouts',
      action: String(args.action),
      input: args,
      startMs,
      payload: outcome.payload,
    });
  } catch (error) {
    return logAndReturnMcpError({
      auth,
      toolName: 'manage_workouts',
      action: String(args.action),
      input: args,
      startMs,
      error,
      prefix: 'Failed to manage workout',
    });
  }
}

export function registerManageWorkoutsTool(server: McpServer) {
  server.registerTool(
    'manage_workouts',
    {
      title: 'Manage Workout Sessions & Overload Hints',
      description:
        'Full CRUD for workouts: list sessions, log a gym/cardio session with exercises & sets JSONB, update an existing session, compute progressive overload hints, soft-delete (confirm: true), or restore.',
      inputSchema: {
        action: z.enum(['list', 'log', 'update', 'get_overload_hints', 'delete', 'restore']).describe('Workout action'),
        workoutId: z.string().uuid().optional().describe('Workout session UUID for update, delete, or restore'),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        includeDeleted: z.boolean().optional().default(false),
        title: z.string().min(1).max(160).optional(),
        workoutType: z
          .enum(['push', 'pull', 'legs', 'upper', 'lower', 'full_body', 'cardio', 'mobility', 'sports', 'strength'])
          .optional(),
        durationMinutes: z.number().int().min(1).max(600).optional(),
        estimatedCaloriesBurned: z.number().int().min(0).nullable().optional(),
        exercises: z.array(EXERCISE_SCHEMA).optional(),
        exerciseName: z.string().optional().describe('Specific exercise name to compute progressive overload hint for'),
        rpe: z.number().int().min(1).max(10).nullable().optional(),
        notes: z.string().nullable().optional(),
        confirm: z.boolean().optional().describe('Required for delete'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      if (args.action === 'list' || args.action === 'get_overload_hints') {
        const authRes = authorizeMcpTool('habitflow:read');
        if (!authRes.ok) return authRes.response;
        return handleWorkoutRead(authRes.auth.userId, args);
      }
      const authRes = authorizeMcpTool('habitflow:write');
      if (!authRes.ok) return authRes.response;
      return handleWorkoutWrite(authRes.auth, args);
    }
  );
}
