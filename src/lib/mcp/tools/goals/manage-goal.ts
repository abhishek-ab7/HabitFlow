import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { McpAuthContext } from '../../auth';
import { getSupabaseAdmin } from '../../supabase-admin';
import { getInsertMetadata, getUpdateMetadata } from '../../sync-helpers';
import {
  authorizeMcpTool,
  logAndReturnMcpError,
  logAndReturnMcpSuccess,
  mcpError,
  pickDefinedColumns,
} from '../tool-helpers';

const FINANCIAL_LINK_SCHEMA = z
  .object({
    type: z.enum(['savings_target', 'debt_payoff', 'net_worth', 'sip_corpus']),
    targetAmount: z.number().min(0),
    startingAmount: z.number().optional(),
    linkedAccountIds: z.array(z.string()).optional(),
    linkedDebtIds: z.array(z.string()).optional(),
    linkedSipIds: z.array(z.string()).optional(),
  })
  .nullable();

const FITNESS_LINK_SCHEMA = z
  .object({
    type: z.enum([
      'target_weight',
      'target_waist',
      'monthly_workouts',
      'daily_steps_avg',
      'workout_consistency',
      'protein_streak',
      'custom',
    ]),
    targetValue: z.number().min(0),
    startingValue: z.number().optional(),
    unit: z.string().optional(),
  })
  .nullable();

const GOAL_UPDATE_COLUMNS = [
  ['description', 'description'],
  ['category', 'category'],
  ['priority', 'priority'],
  ['status', 'status'],
  ['targetDate', 'target_date'],
  ['progress', 'progress'],
  ['financialLink', 'financial_link'],
  ['fitnessLink', 'fitness_link'],
  ['metadata', 'metadata'],
] as const;

async function hasReachedFocusLimit(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  excludeGoalId?: string
): Promise<boolean> {
  let query = supabase
    .from('goals')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_archived', false)
    .eq('is_focus', true);
  if (excludeGoalId) query = query.neq('id', excludeGoalId);
  const { count } = await query;
  return (count || 0) >= 2;
}

function orVal<T>(value: T | undefined | null, fallback: T): T {
  return value ?? fallback;
}

function buildNewGoalRow(userId: string, args: Record<string, any>) {
  return {
    user_id: userId,
    title: String(args.title).trim(),
    description: orVal(args.description, null),
    category: orVal(args.category, 'General'),
    priority: orVal(args.priority, 'medium'),
    status: orVal(args.status, 'in_progress'),
    target_date: orVal(args.targetDate, null),
    progress: orVal(args.progress, 0),
    is_focus: orVal(args.isFocus, false),
    is_archived: false,
    financial_link: orVal(args.financialLink, null),
    fitness_link: orVal(args.fitnessLink, null),
    metadata: orVal(args.metadata, {}),
    ...getInsertMetadata(),
  };
}

async function createGoalRecord(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: Record<string, any>
) {
  if (!args.title) return { error: 'Validation Error: title is required for create action.' };
  if (args.isFocus && (await hasReachedFocusLimit(supabase, userId))) {
    return {
      error:
        'Focus Limit Reached: HabitFlow enforces a maximum of 2 active focus goals. Unset focus on another goal first.',
    };
  }

  const { data, error } = await supabase
    .from('goals')
    .insert(buildNewGoalRow(userId, args))
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'created', goal: data } };
}

async function validateFocusForUpdate(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  existing: Record<string, any>,
  args: Record<string, any>
): Promise<string | null> {
  if (!args.isFocus || existing.is_focus) return null;
  if (await hasReachedFocusLimit(supabase, userId, args.goalId)) {
    return 'Focus Limit Reached: At most 2 focus goals allowed.';
  }
  return null;
}

async function updateGoalFields(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  existing: Record<string, any>,
  args: Record<string, any>
) {
  const updates = pickDefinedColumns(args, GOAL_UPDATE_COLUMNS);
  if (args.title !== undefined) updates.title = String(args.title).trim();

  if (args.isFocus !== undefined) {
    const focusError = await validateFocusForUpdate(supabase, userId, existing, args);
    if (focusError) return { error: focusError };
    updates.is_focus = args.isFocus;
  }

  const { data, error } = await supabase
    .from('goals')
    .update({ ...updates, ...getUpdateMetadata(existing) })
    .eq('user_id', userId)
    .eq('id', args.goalId)
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'updated', goal: data } };
}

async function patchGoalRow(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  existing: Record<string, any>;
  goalId: string;
  patch: Record<string, unknown>;
}) {
  const { data, error } = await params.supabase
    .from('goals')
    .update({ ...params.patch, ...getUpdateMetadata(params.existing) })
    .eq('user_id', params.userId)
    .eq('id', params.goalId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function archiveGoalRecord(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  existing: Record<string, any>,
  args: Record<string, any>
) {
  if (!args.confirm) return { error: 'Confirmation Required: Archiving this goal requires confirm: true.' };
  const goal = await patchGoalRow({
    supabase,
    userId,
    existing,
    goalId: args.goalId,
    patch: { is_archived: true, is_focus: false },
  });
  return { payload: { action: 'archived', goal } };
}

async function setGoalFocusRecord(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  existing: Record<string, any>,
  args: Record<string, any>
) {
  const shouldFocus = args.isFocus !== undefined ? args.isFocus : !existing.is_focus;
  if (shouldFocus && (await hasReachedFocusLimit(supabase, userId, args.goalId))) {
    return { error: 'Focus Limit Reached: HabitFlow allows at most 2 focus goals simultaneously.' };
  }
  const goal = await patchGoalRow({
    supabase,
    userId,
    existing,
    goalId: args.goalId,
    patch: { is_focus: shouldFocus },
  });
  return { payload: { action: 'focus_updated', goal } };
}

async function applyGoalMutation(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  existing: Record<string, any>,
  args: Record<string, any>
) {
  switch (args.action) {
    case 'archive':
      return archiveGoalRecord(supabase, userId, existing, args);
    case 'restore':
      return {
        payload: {
          action: 'restored',
          goal: await patchGoalRow({
            supabase,
            userId,
            existing,
            goalId: args.goalId,
            patch: { is_archived: false },
          }),
        },
      };
    case 'set_focus':
      return setGoalFocusRecord(supabase, userId, existing, args);
    case 'update':
      return updateGoalFields(supabase, userId, existing, args);
    default:
      return { error: `Unknown action: ${args.action}` };
  }
}

async function handleManageGoal(auth: McpAuthContext, args: Record<string, any>) {
  const startMs = Date.now();
  const supabase = getSupabaseAdmin();

  try {
    let outcome: { error?: string; payload?: unknown };
    if (args.action === 'create') {
      outcome = await createGoalRecord(supabase, auth.userId, args);
    } else if (!args.goalId) {
      return mcpError('Validation Error: goalId is required.');
    } else {
      const { data: existing, error: fetchErr } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', auth.userId)
        .eq('id', args.goalId)
        .single();
      if (fetchErr || !existing) return mcpError(`Goal not found: ${args.goalId}`);
      outcome = await applyGoalMutation(supabase, auth.userId, existing, args);
    }

    if (outcome.error) return mcpError(outcome.error);
    return logAndReturnMcpSuccess({
      auth,
      toolName: 'manage_goal',
      action: args.action,
      input: args,
      startMs,
      payload: outcome.payload,
    });
  } catch (error) {
    return logAndReturnMcpError({
      auth,
      toolName: 'manage_goal',
      action: args.action,
      input: args,
      startMs,
      error,
      prefix: 'Failed to manage goal',
    });
  }
}

export function registerManageGoalTool(server: McpServer) {
  server.registerTool(
    'manage_goal',
    {
      title: 'Manage Goal',
      description:
        'Create, update, toggle focus status, archive, or restore a goal. Enforces a maximum of 2 active focus goals. Note: Archiving requires confirm: true.',
      inputSchema: {
        action: z.enum(['create', 'update', 'set_focus', 'archive', 'restore']).describe('Action to perform'),
        goalId: z.string().uuid().optional().describe('Goal UUID (required for update, set_focus, archive, restore)'),
        title: z.string().min(1).max(255).optional().describe('Goal title'),
        description: z.string().optional().describe('Goal description or vision'),
        category: z.string().optional().describe('Area of life (e.g. Career, Health, Finance, Relationships)'),
        priority: z.enum(['low', 'medium', 'high']).optional(),
        status: z.enum(['not_started', 'in_progress', 'completed', 'on_hold']).optional(),
        targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().describe('Target deadline (YYYY-MM-DD)'),
        progress: z.number().int().min(0).max(100).optional().describe('Progress percentage (0-100)'),
        isFocus: z.boolean().optional().describe('Set as top-focus goal (max 2 active)'),
        financialLink: FINANCIAL_LINK_SCHEMA.optional().describe('Optional live financial telemetry link'),
        fitnessLink: FITNESS_LINK_SCHEMA.optional().describe('Optional live fitness telemetry link (target_weight, target_waist, monthly_workouts, daily_steps_avg)'),
        metadata: z.record(z.string(), z.any()).optional().describe('Custom goal metadata JSON'),
        confirm: z.boolean().optional().describe('Confirmation flag required for destructive actions like archive'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      const authRes = authorizeMcpTool('habitflow:write');
      if (!authRes.ok) return authRes.response;
      return handleManageGoal(authRes.auth, args);
    }
  );
}
