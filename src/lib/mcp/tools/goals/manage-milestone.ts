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
  mcpJson,
} from '../tool-helpers';

type UserId = string;
type GoalId = string;
type MilestoneId = string;

async function listMilestones(userId: UserId, goalId: GoalId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .eq('user_id', userId)
    .eq('goal_id', goalId)
    .order('order_index', { ascending: true });
  if (error) return mcpError(`Failed to fetch milestones: ${error.message}`);
  return mcpJson({ goalId, count: (data || []).length, milestones: data || [] });
}

function completedAtFor(isCompleted: boolean): string | null {
  return isCompleted ? new Date().toISOString() : null;
}

async function createMilestoneRecord(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: Record<string, any>
) {
  if (!args.title) return { error: 'Validation Error: title is required.' };
  const isCompleted = Boolean(args.isCompleted);
  const newMilestone = {
    user_id: userId,
    goal_id: args.goalId,
    title: String(args.title).trim(),
    is_completed: isCompleted,
    completed_at: completedAtFor(isCompleted),
    order_index: args.orderIndex ?? 0,
    ...getInsertMetadata(),
  };
  const { data, error } = await supabase.from('milestones').insert(newMilestone).select().single();
  if (error) throw error;
  return { milestone: data };
}

function buildMilestonePatch(existing: Record<string, any>, args: Record<string, any>) {
  if (args.action === 'toggle_complete') {
    const nextCompleted = !existing.is_completed;
    return {
      is_completed: nextCompleted,
      completed_at: completedAtFor(nextCompleted),
    };
  }
  const updates: Record<string, any> = {};
  if (args.title !== undefined) updates.title = String(args.title).trim();
  if (args.orderIndex !== undefined) updates.order_index = args.orderIndex;
  if (args.isCompleted !== undefined) {
    updates.is_completed = args.isCompleted;
    updates.completed_at = completedAtFor(args.isCompleted);
  }
  return updates;
}

async function deleteMilestoneRecord(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, any>
) {
  if (!args.confirm) {
    return { error: 'Confirmation Required: Deleting milestone requires confirm: true.' };
  }
  const { error } = await supabase
    .from('milestones')
    .delete()
    .eq('user_id', userId)
    .eq('id', args.milestoneId);
  if (error) throw error;
  return { milestone: { id: args.milestoneId, deleted: true } };
}

async function fetchMilestoneForGoal(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  goalId: GoalId,
  milestoneId: MilestoneId
) {
  const { data: existing, error: fetchErr } = await supabase
    .from('milestones')
    .select('*')
    .eq('user_id', userId)
    .eq('id', milestoneId)
    .eq('goal_id', goalId)
    .single();
  return fetchErr || !existing ? null : existing;
}

async function mutateExistingMilestone(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: Record<string, any>
) {
  if (!args.milestoneId) return { error: 'Validation Error: milestoneId is required.' };
  const existing = await fetchMilestoneForGoal(supabase, userId, args.goalId, args.milestoneId);
  if (!existing) return { error: `Milestone not found: ${args.milestoneId}` };

  if (args.action === 'delete') return deleteMilestoneRecord(supabase, userId, args);

  const patch = buildMilestonePatch(existing, args);
  const { data, error } = await supabase
    .from('milestones')
    .update({ ...patch, ...getUpdateMetadata(existing) })
    .eq('id', args.milestoneId)
    .select()
    .single();
  if (error) throw error;
  return { milestone: data };
}

function resolveGoalStatus(progress: number, currentStatus: string): string {
  return progress === 100 ? 'completed' : currentStatus;
}

async function recalculateGoalProgress(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  goal: Record<string, any>
): Promise<number> {
  const { data: allMilestones } = await supabase
    .from('milestones')
    .select('is_completed')
    .eq('user_id', userId)
    .eq('goal_id', goal.id);

  if (!allMilestones || allMilestones.length === 0) return goal.progress;
  const completedCount = allMilestones.filter((m) => m.is_completed).length;
  const updatedGoalProgress = Math.round((completedCount / allMilestones.length) * 100);

  await supabase
    .from('goals')
    .update({
      progress: updatedGoalProgress,
      status: resolveGoalStatus(updatedGoalProgress, goal.status),
      ...getUpdateMetadata(goal),
    })
    .eq('id', goal.id);

  return updatedGoalProgress;
}

async function handleMilestoneWrite(auth: McpAuthContext, args: Record<string, any>) {
  const startMs = Date.now();
  const supabase = getSupabaseAdmin();

  try {
    const { data: goal, error: goalErr } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', auth.userId)
      .eq('id', args.goalId)
      .single();
    if (goalErr || !goal) return mcpError(`Parent goal not found: ${args.goalId}`);

    const outcome: { error?: string; milestone?: any } =
      args.action === 'create'
        ? await createMilestoneRecord(supabase, auth.userId, args)
        : await mutateExistingMilestone(supabase, auth.userId, args);
    if (outcome.error) return mcpError(outcome.error);

    const parentGoalProgress = await recalculateGoalProgress(supabase, auth.userId, goal);
    return logAndReturnMcpSuccess({
      auth,
      toolName: 'manage_milestone',
      action: args.action,
      input: args,
      startMs,
      payload: { action: args.action, milestone: outcome.milestone, parentGoalProgress },
    });
  } catch (error) {
    return logAndReturnMcpError({
      auth,
      toolName: 'manage_milestone',
      action: args.action,
      input: args,
      startMs,
      error,
      prefix: 'Failed to manage milestone',
    });
  }
}

export function registerManageMilestoneTool(server: McpServer) {
  server.registerTool(
    'manage_milestone',
    {
      title: 'Manage Milestone',
      description:
        'List, create, update, toggle completion status, or delete a milestone under a goal. Automatically recalculates parent goal progress.',
      inputSchema: {
        action: z.enum(['list', 'create', 'update', 'toggle_complete', 'delete']).describe('Action to perform'),
        goalId: z.string().uuid().describe('Parent Goal UUID'),
        milestoneId: z.string().uuid().optional().describe('Milestone UUID (required for update, toggle_complete, delete)'),
        title: z.string().min(1).max(255).optional().describe('Milestone title'),
        isCompleted: z.boolean().optional().describe('Completion state'),
        orderIndex: z.number().int().optional(),
        confirm: z.boolean().optional().describe('Confirmation flag required for delete action'),
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
        return listMilestones(authRes.auth.userId, args.goalId);
      }
      const authRes = authorizeMcpTool('habitflow:write');
      if (!authRes.ok) return authRes.response;
      return handleMilestoneWrite(authRes.auth, args);
    }
  );
}
