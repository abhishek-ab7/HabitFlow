import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { McpAuthContext } from '../../auth';
import { getSupabaseAdmin } from '../../supabase-admin';
import {
  authorizeMcpTool,
  logAndReturnMcpError,
  logAndReturnMcpSuccess,
  mcpError,
  mcpJson,
  pickDefinedColumns,
} from '../tool-helpers';

const STACK_UPDATE_COLUMNS = [
  ['description', 'description'],
  ['triggerHabitId', 'trigger_habit_id'],
  ['stackedHabitIds', 'stacked_habit_ids'],
  ['suggestedOrder', 'suggested_order'],
  ['aiReasoning', 'ai_reasoning'],
  ['difficulty', 'difficulty'],
  ['estimatedTimeMinutes', 'estimated_time_minutes'],
  ['expectedSuccessRate', 'expected_success_rate'],
  ['isActive', 'is_active'],
] as const;

async function listHabitStacks(userId: string, activeOnly: boolean) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('habit_stacks').select('*').eq('user_id', userId);
  if (activeOnly) query = query.eq('is_active', true);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return mcpError(`Failed to fetch habit stacks: ${error.message}`);
  return mcpJson({ count: (data || []).length, stacks: data || [] });
}

function hasValidStackCreateArgs(args: Record<string, any>): boolean {
  return Boolean(args.name) && Array.isArray(args.stackedHabitIds) && args.stackedHabitIds.length > 0;
}

function orVal<T>(value: T | undefined | null, fallback: T): T {
  return value ?? fallback;
}

function buildNewStackRow(userId: string, args: Record<string, any>, nowIso: string) {
  const isActive = Boolean(args.isActive);
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    name: String(args.name).trim(),
    description: orVal(args.description, null),
    trigger_habit_id: orVal(args.triggerHabitId, null),
    stacked_habit_ids: args.stackedHabitIds,
    suggested_order: orVal(args.suggestedOrder, null),
    ai_reasoning: orVal(args.aiReasoning, null),
    difficulty: orVal(args.difficulty, 'medium'),
    estimated_time_minutes: orVal(args.estimatedTimeMinutes, null),
    expected_success_rate: orVal(args.expectedSuccessRate, null),
    is_active: isActive,
    is_ai_generated: false,
    activation_count: isActive ? 1 : 0,
    last_activated_at: isActive ? nowIso : null,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

async function createHabitStack(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: Record<string, any>,
  nowIso: string
) {
  if (!hasValidStackCreateArgs(args)) {
    return { error: 'Validation Error: name and stackedHabitIds (non-empty) are required.' };
  }

  const { data, error } = await supabase
    .from('habit_stacks')
    .insert(buildNewStackRow(userId, args, nowIso))
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'created', stack: data } };
}

function buildStackUpdatePatch(existing: Record<string, any>, args: Record<string, any>, nowIso: string) {
  if (args.action === 'activate') {
    const nextActive = args.isActive !== undefined ? args.isActive : !existing.is_active;
    return {
      actionName: 'activated',
      patch: {
        is_active: nextActive,
        activation_count: nextActive ? Number(existing.activation_count || 0) + 1 : existing.activation_count,
        last_activated_at: nextActive ? nowIso : existing.last_activated_at,
        updated_at: nowIso,
      },
    };
  }
  return {
    actionName: 'updated',
    patch: {
      ...pickDefinedColumns(args, STACK_UPDATE_COLUMNS),
      ...(args.name !== undefined ? { name: String(args.name).trim() } : {}),
      updated_at: nowIso,
    },
  };
}

type UserId = string;
type StackId = string;
type IsoTimestamp = string;

async function deleteHabitStack(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  stackId: StackId,
  confirm?: boolean
): Promise<{ error?: string; payload?: unknown }> {
  if (!confirm) {
    return { error: 'Confirmation Required: Deleting a habit stack requires confirm: true.' };
  }
  const { error } = await supabase.from('habit_stacks').delete().eq('user_id', userId).eq('id', stackId);
  if (error) throw error;
  return { payload: { action: 'deleted', stackId } };
}

async function fetchStackById(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  stackId: StackId
) {
  const { data: existing, error: fetchErr } = await supabase
    .from('habit_stacks')
    .select('*')
    .eq('user_id', userId)
    .eq('id', stackId)
    .single();
  return fetchErr || !existing ? null : existing;
}

async function mutateExistingStack(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, any>,
  nowIso: IsoTimestamp
): Promise<{ error?: string; payload?: unknown }> {
  if (!args.stackId) return { error: 'Validation Error: stackId is required.' };
  const existing = await fetchStackById(supabase, userId, args.stackId);
  if (!existing) return { error: `Habit stack not found: ${args.stackId}` };

  if (args.action === 'delete') {
    return deleteHabitStack(supabase, userId, args.stackId, args.confirm);
  }

  const { actionName, patch } = buildStackUpdatePatch(existing, args, nowIso);
  const { data, error } = await supabase
    .from('habit_stacks')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', args.stackId)
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: actionName, stack: data } };
}

async function handleManageStackWrite(auth: McpAuthContext, args: Record<string, any>) {
  const startMs = Date.now();
  const nowIso = new Date().toISOString();
  const supabase = getSupabaseAdmin();

  try {
    const outcome =
      args.action === 'create'
        ? await createHabitStack(supabase, auth.userId, args, nowIso)
        : await mutateExistingStack(supabase, auth.userId, args, nowIso);

    if (outcome.error) return mcpError(outcome.error);
    return logAndReturnMcpSuccess({
      auth,
      toolName: 'manage_habit_stacks',
      action: args.action,
      input: args,
      startMs,
      payload: outcome.payload,
    });
  } catch (error) {
    return logAndReturnMcpError({
      auth,
      toolName: 'manage_habit_stacks',
      action: args.action,
      input: args,
      startMs,
      error,
      prefix: 'Failed to manage habit stack',
    });
  }
}

export function registerManageHabitStacksTool(server: McpServer) {
  server.registerTool(
    'manage_habit_stacks',
    {
      title: 'Manage Habit Stacks',
      description:
        'List, create, update, activate/deactivate, or delete Habit Stacks (chained habit routines triggered after an anchor habit).',
      inputSchema: {
        action: z.enum(['list', 'create', 'update', 'activate', 'delete']).describe('Action to perform'),
        stackId: z.string().uuid().optional().describe('Habit Stack UUID (required for update, activate, delete)'),
        activeOnly: z.boolean().optional().default(false).describe('Filter only active stacks for list'),
        name: z.string().min(1).max(160).optional().describe('Stack name'),
        description: z.string().nullable().optional(),
        triggerHabitId: z.string().uuid().nullable().optional().describe('Trigger/anchor habit UUID'),
        stackedHabitIds: z.array(z.string().uuid()).optional().describe('Ordered UUIDs of stacked habits'),
        suggestedOrder: z.array(z.string()).optional(),
        aiReasoning: z.string().nullable().optional(),
        difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
        estimatedTimeMinutes: z.number().int().min(1).max(600).optional(),
        expectedSuccessRate: z.number().int().min(0).max(100).optional(),
        isActive: z.boolean().optional(),
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
        return listHabitStacks(authRes.auth.userId, args.activeOnly);
      }
      const authRes = authorizeMcpTool('habitflow:write');
      if (!authRes.ok) return authRes.response;
      return handleManageStackWrite(authRes.auth, args);
    }
  );
}
