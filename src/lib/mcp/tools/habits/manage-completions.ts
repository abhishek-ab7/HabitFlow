import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { McpAuthContext } from '../../auth';
import { getSupabaseAdmin } from '../../supabase-admin';
import { getIstIsoDate } from '../../config';
import { getInsertMetadata, getUpdateMetadata } from '../../sync-helpers';
import {
  authorizeMcpTool,
  logAndReturnMcpError,
  logAndReturnMcpSuccess,
  mcpError,
  mcpJson,
} from '../tool-helpers';

function resolveRestReason(
  args: Record<string, any>,
  existing: Record<string, any>,
  preserveExistingRestReason: boolean
) {
  if (!preserveExistingRestReason) return args.restReason ?? null;
  return args.restReason !== undefined ? args.restReason : existing.rest_reason;
}

function isSkippedStatus(status: string): boolean {
  return status === 'rest' || status === 'frozen';
}

function buildCompletionUpdatePatch(
  args: Record<string, any>,
  existing: Record<string, any>,
  preserveExistingRestReason: boolean
) {
  return {
    completed: args.status === 'completed',
    skipped: isSkippedStatus(args.status),
    status: args.status,
    rest_reason: resolveRestReason(args, existing, preserveExistingRestReason),
    notes: args.notes !== undefined ? args.notes : existing.notes,
    value: args.value !== undefined ? args.value : existing.value,
    ...getUpdateMetadata(existing),
  };
}

async function updateExistingCompletion(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  existing: Record<string, any>;
  args: Record<string, any>;
  preserveExistingRestReason: boolean;
}) {
  const { supabase, existing, args, preserveExistingRestReason } = params;
  const { data, error } = await supabase
    .from('completions')
    .update(buildCompletionUpdatePatch(args, existing, preserveExistingRestReason))
    .eq('id', existing.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function insertNewCompletion(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  dateIst: string;
  args: Record<string, any>;
}) {
  const { supabase, userId, dateIst, args } = params;
  const { data, error } = await supabase
    .from('completions')
    .insert({
      user_id: userId,
      habit_id: args.habitId,
      date: dateIst,
      completed: args.status === 'completed',
      skipped: isSkippedStatus(args.status),
      status: args.status,
      rest_reason: args.restReason ?? null,
      notes: args.notes ?? null,
      value: args.value ?? null,
      ...getInsertMetadata(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function upsertHabitCompletion(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  dateIst: string;
  args: Record<string, any>;
  preserveExistingRestReason: boolean;
}) {
  const { supabase, userId, dateIst, args } = params;
  const { data: habit, error: habitErr } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .eq('id', args.habitId)
    .single();
  if (habitErr || !habit) return { error: `Habit not found: ${args.habitId}` };

  const { data: existing } = await supabase
    .from('completions')
    .select('*')
    .eq('user_id', userId)
    .eq('habit_id', args.habitId)
    .eq('date', dateIst)
    .maybeSingle();

  if (existing) {
    const completion = await updateExistingCompletion({
      supabase,
      existing,
      args,
      preserveExistingRestReason: params.preserveExistingRestReason,
    });
    return { habit, completion, wasExisting: true };
  }

  const completion = await insertNewCompletion({ supabase, userId, dateIst, args });
  return { habit, completion, wasExisting: false };
}

const COMPLETION_EQ_FILTERS = [
  ['habitId', 'habit_id'],
  ['date', 'date'],
  ['status', 'status'],
] as const;

function applyCompletionDateRange(query: any, startDate?: string, endDate?: string) {
  let next = startDate ? query.gte('date', startDate) : query;
  if (endDate) next = next.lte('date', endDate);
  return next;
}

function buildCompletionsListQuery(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: Record<string, any>
) {
  let query = supabase.from('completions').select('*').eq('user_id', userId);
  for (const [argKey, dbCol] of COMPLETION_EQ_FILTERS) {
    if (args[argKey]) query = query.eq(dbCol, args[argKey]);
  }
  query = applyCompletionDateRange(query, args.startDate, args.endDate);
  return query.order('date', { ascending: false }).limit(args.limit || 100);
}

async function listHabitCompletions(userId: string, args: Record<string, any>) {
  const { data, error } = await buildCompletionsListQuery(getSupabaseAdmin(), userId, args);
  if (error) return mcpError(`Failed to fetch completions: ${error.message}`);
  return mcpJson({ count: (data || []).length, completions: data || [] });
}

function hasDeleteTarget(args: Record<string, any>): boolean {
  return Boolean(args.completionId) || Boolean(args.habitId && args.date);
}

async function deleteHabitCompletion(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: Record<string, any>
) {
  if (!args.confirm) {
    return { error: 'Confirmation Required: Deleting a completion requires confirm: true.' };
  }
  if (!hasDeleteTarget(args)) {
    return { error: 'Validation Error: Provide completionId or both habitId and date for delete.' };
  }

  const baseQuery = supabase.from('completions').select('*').eq('user_id', userId);
  const query = args.completionId
    ? baseQuery.eq('id', args.completionId)
    : baseQuery.eq('habit_id', args.habitId).eq('date', args.date);
  const { data: existing } = await query.maybeSingle();
  if (!existing) return { error: 'Completion record not found.' };

  const { error: delErr } = await supabase
    .from('completions')
    .delete()
    .eq('user_id', userId)
    .eq('id', existing.id);
  if (delErr) throw delErr;
  return { payload: { action: 'deleted', deletedCompletion: existing } };
}

async function handleLogHabitCompletion(auth: McpAuthContext, args: Record<string, any>) {
  const startMs = Date.now();
  const dateIst = args.date || getIstIsoDate();
  const supabase = getSupabaseAdmin();

  try {
    const res = await upsertHabitCompletion({
      supabase,
      userId: auth.userId,
      dateIst,
      args,
      preserveExistingRestReason: false,
    });
    if (res.error) return mcpError(res.error);

    return logAndReturnMcpSuccess({
      auth,
      toolName: 'log_habit_completion',
      action: args.status,
      input: args,
      startMs,
      payload: {
        habitName: res.habit.name,
        dateIst,
        status: args.status,
        completion: res.completion,
      },
    });
  } catch (error) {
    return logAndReturnMcpError({
      auth,
      toolName: 'log_habit_completion',
      action: args.status,
      input: args,
      startMs,
      error,
      prefix: 'Failed to log completion',
    });
  }
}

async function dispatchManageCompletions(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  dateIst: string,
  args: Record<string, any>
): Promise<{ error?: string; payload?: unknown }> {
  if (args.action === 'delete') return deleteHabitCompletion(supabase, userId, args);
  if (!args.habitId || !args.status) {
    return { error: 'Validation Error: habitId and status are required for log.' };
  }
  const res = await upsertHabitCompletion({
    supabase,
    userId,
    dateIst,
    args,
    preserveExistingRestReason: true,
  });
  if (res.error) return { error: res.error };
  return {
    payload: {
      action: res.wasExisting ? 'updated' : 'created',
      dateIst,
      completion: res.completion,
    },
  };
}

async function handleManageCompletionsWrite(auth: McpAuthContext, args: Record<string, any>) {
  const startMs = Date.now();
  const dateIst = args.date || getIstIsoDate();
  const supabase = getSupabaseAdmin();

  try {
    const outcome = await dispatchManageCompletions(supabase, auth.userId, dateIst, args);
    if (outcome.error) return mcpError(outcome.error);

    return logAndReturnMcpSuccess({
      auth,
      toolName: 'manage_habit_completions',
      action: args.action,
      input: args,
      startMs,
      payload: outcome.payload,
    });
  } catch (error) {
    return logAndReturnMcpError({
      auth,
      toolName: 'manage_habit_completions',
      action: args.action,
      input: args,
      startMs,
      error,
      prefix: 'Failed to manage habit completions',
    });
  }
}

export function registerLogHabitCompletionTool(server: McpServer) {
  server.registerTool(
    'log_habit_completion',
    {
      title: 'Log Habit Completion',
      description:
        'Log a habit completion, skip, rest day, or quantitative progress for a specific date (defaults to today in IST).',
      inputSchema: {
        habitId: z.string().uuid().describe('Target habit UUID'),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
          .optional()
          .describe('Date of completion (defaults to today in IST)'),
        status: z.enum(['completed', 'uncompleted', 'rest', 'frozen']).describe('Completion status'),
        value: z.number().optional().describe('Quantitative value logged (for quantitative habits)'),
        restReason: z.string().optional().describe('Optional reason if marking as rest or frozen'),
        notes: z.string().optional().describe('Optional daily reflection note'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      const authRes = authorizeMcpTool('habitflow:write');
      if (!authRes.ok) return authRes.response;
      return handleLogHabitCompletion(authRes.auth, args);
    }
  );
}

export function registerManageHabitCompletionsTool(server: McpServer) {
  server.registerTool(
    'manage_habit_completions',
    {
      title: 'Manage Habit Completions',
      description:
        'List historical habit completions/rest/frozen entries, upsert a completion entry, or delete an accidental completion entry (delete requires confirm: true).',
      inputSchema: {
        action: z.enum(['list', 'log', 'delete']).describe('Action to execute'),
        completionId: z.string().uuid().optional().describe('Completion UUID (optional for delete)'),
        habitId: z.string().uuid().optional().describe('Target habit UUID'),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Target date (YYYY-MM-DD, defaults to IST today for log/delete)'),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Filter start date (YYYY-MM-DD) for list'),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Filter end date (YYYY-MM-DD) for list'),
        status: z.enum(['completed', 'uncompleted', 'rest', 'frozen']).optional().describe('Filter (list) or target status (log)'),
        value: z.number().optional().describe('Quantitative value logged'),
        restReason: z.string().optional(),
        notes: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional().default(100),
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
      if (args.action === 'list') {
        const authRes = authorizeMcpTool('habitflow:read');
        if (!authRes.ok) return authRes.response;
        return listHabitCompletions(authRes.auth.userId, args);
      }
      const authRes = authorizeMcpTool('habitflow:write');
      if (!authRes.ok) return authRes.response;
      return handleManageCompletionsWrite(authRes.auth, args);
    }
  );
}
