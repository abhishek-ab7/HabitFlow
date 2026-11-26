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

const HABIT_UPDATE_COLUMNS = [
  ['description', 'description'],
  ['icon', 'icon'],
  ['color', 'color'],
  ['category', 'category'],
  ['frequency_type', 'frequency_type'],
  ['target_days', 'target_days'],
  ['scheduled_days', 'scheduled_days'],
  ['interval_days', 'interval_days'],
  ['allow_bonus_completions', 'allow_bonus_completions'],
  ['auto_track_rule', 'auto_track_rule'],
  ['is_quantitative', 'is_quantitative'],
  ['target_value', 'target_value'],
  ['unit', 'unit'],
  ['polarity', 'polarity'],
  ['anchor_block', 'anchor_block'],
  ['difficulty', 'difficulty'],
  ['metadata', 'metadata'],
  ['order_index', 'order_index'],
] as const;

function orVal<T>(value: T | undefined | null, fallback: T): T {
  return value ?? fallback;
}

function buildNewHabitRow(userId: string, args: Record<string, any>) {
  return {
    user_id: userId,
    name: String(args.name).trim(),
    description: orVal(args.description, null),
    icon: orVal(args.icon, 'Sparkles'),
    color: orVal(args.color, '#10B981'),
    category: orVal(args.category, 'General'),
    frequency_type: orVal(args.frequency_type, 'daily'),
    target_days: orVal(args.target_days, 7),
    scheduled_days: orVal(args.scheduled_days, [0, 1, 2, 3, 4, 5, 6]),
    interval_days: orVal(args.interval_days, 1),
    allow_bonus_completions: orVal(args.allow_bonus_completions, false),
    auto_track_rule: orVal(args.auto_track_rule, null),
    is_quantitative: orVal(args.is_quantitative, false),
    target_value: orVal(args.target_value, null),
    unit: orVal(args.unit, null),
    polarity: orVal(args.polarity, 'build'),
    anchor_block: orVal(args.anchor_block, null),
    difficulty: orVal(args.difficulty, 'medium'),
    metadata: orVal(args.metadata, {}),
    order_index: orVal(args.order_index, 0),
    is_archived: false,
    ...getInsertMetadata(),
  };
}

async function createHabitRecord(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: Record<string, any>
) {
  if (!args.name) return { error: 'Validation Error: name is required for create action.' };
  const { data, error } = await supabase
    .from('habits')
    .insert(buildNewHabitRow(userId, args))
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'created', habit: data } };
}

async function patchHabitRow(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  habitId: string;
  existing: Record<string, any>;
  patch: Record<string, unknown>;
}) {
  const { data, error } = await params.supabase
    .from('habits')
    .update({ ...params.patch, ...getUpdateMetadata(params.existing) })
    .eq('user_id', params.userId)
    .eq('id', params.habitId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

function buildHabitMutationPatch(args: Record<string, any>) {
  if (args.action === 'archive') return { actionLabel: 'archived', patch: { is_archived: true } };
  if (args.action === 'restore') return { actionLabel: 'restored', patch: { is_archived: false } };
  if (args.action === 'update') {
    const patch = pickDefinedColumns(args, HABIT_UPDATE_COLUMNS);
    if (args.name !== undefined) patch.name = String(args.name).trim();
    return { actionLabel: 'updated', patch };
  }
  return null;
}

async function mutateExistingHabit(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: Record<string, any>
) {
  if (!args.habitId) return { error: 'Validation Error: habitId is required.' };
  const mutation = buildHabitMutationPatch(args);
  if (!mutation) return { error: `Unknown action: ${args.action}` };
  if (args.action === 'archive' && !args.confirm) {
    return { error: 'Confirmation Required: Archiving this habit requires confirm: true in tool arguments.' };
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .eq('id', args.habitId)
    .single();
  if (fetchErr || !existing) return { error: `Habit not found: ${args.habitId}` };

  const habit = await patchHabitRow({
    supabase,
    userId,
    habitId: args.habitId,
    existing,
    patch: mutation.patch,
  });
  return { payload: { action: mutation.actionLabel, habit } };
}

async function handleManageHabit(auth: McpAuthContext, args: Record<string, any>) {
  const startMs = Date.now();
  const supabase = getSupabaseAdmin();

  try {
    const outcome =
      args.action === 'create'
        ? await createHabitRecord(supabase, auth.userId, args)
        : await mutateExistingHabit(supabase, auth.userId, args);

    if (outcome.error) return mcpError(outcome.error);
    return logAndReturnMcpSuccess({
      auth,
      toolName: 'manage_habit',
      action: args.action,
      input: args,
      startMs,
      payload: outcome.payload,
    });
  } catch (error) {
    return logAndReturnMcpError({
      auth,
      toolName: 'manage_habit',
      action: args.action,
      input: args,
      startMs,
      error,
      prefix: 'Failed to manage habit',
    });
  }
}

export function registerManageHabitTool(server: McpServer) {
  server.registerTool(
    'manage_habit',
    {
      title: 'Manage Habit',
      description:
        'Create, update, archive (soft-delete), or restore a habit. Note: Archiving requires confirm: true.',
      inputSchema: {
        action: z.enum(['create', 'update', 'archive', 'restore']).describe('Action to perform'),
        habitId: z.string().uuid().optional().describe('Required for update, archive, or restore'),
        name: z.string().min(1).max(100).optional().describe('Habit name'),
        description: z.string().optional().describe('Habit description/motivation'),
        icon: z.string().optional().describe('Lucide icon name or emoji'),
        color: z.string().optional().describe('Hex color string (e.g. #10B981)'),
        category: z.string().optional().describe('Category (e.g. Health, Productivity, Learning)'),
        frequency_type: z
          .enum(['daily', 'weekly_flexible', 'specific_days', 'interval'])
          .optional()
          .describe('Frequency type'),
        target_days: z.number().int().min(1).max(7).optional().describe('Target days per week for weekly_flexible'),
        scheduled_days: z.array(z.number().int().min(0).max(6)).optional().describe('Days of week [0=Sun..6=Sat] for specific_days'),
        interval_days: z.number().int().min(1).max(365).optional().describe('Interval days for interval frequency'),
        allow_bonus_completions: z.boolean().optional(),
        auto_track_rule: z.any().optional(),
        is_quantitative: z.boolean().optional().describe('Whether habit tracks a numeric value (e.g. pages, minutes)'),
        target_value: z.number().optional().describe('Numeric daily target value'),
        unit: z.string().optional().describe('Unit of measurement (e.g. pages, km, mins)'),
        polarity: z.enum(['build', 'quit']).optional().describe('Habit polarity (build positive habit or quit vice)'),
        anchor_block: z
          .enum(['morning', 'work', 'gym', 'night'])
          .nullable()
          .optional()
          .describe('Daily routine anchor time-block'),
        difficulty: z.enum(['easy', 'medium', 'hard']).optional().describe('Habit difficulty level'),
        metadata: z.record(z.string(), z.any()).optional().describe('Custom habit metadata JSON'),
        order_index: z.number().int().optional(),
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
      return handleManageHabit(authRes.auth, args);
    }
  );
}
