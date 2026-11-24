import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { getMcpAuthContext, hasScope } from '../auth';
import { getSupabaseAdmin } from '../supabase-admin';
import { getInsertMetadata, getUpdateMetadata } from '../sync-helpers';
import { logMcpToolInvocation } from '../audit';

export function registerGoalsTools(server: McpServer) {
  // 8. get_goals
  server.registerTool(
    'get_goals',
    {
      title: 'Get Goals & Milestones',
      description:
        'Retrieves high-level goals with their milestone checklists, progress percentages, target dates, and focus status.',
      inputSchema: {
        includeArchived: z.boolean().optional().default(false).describe('Include archived goals'),
        status: z.enum(['not_started', 'in_progress', 'completed', 'on_hold']).optional(),
        focusOnly: z.boolean().optional().describe('Filter only active focus goals (max 2)'),
        category: z.string().optional().describe('Area of life / category filter'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      const auth = getMcpAuthContext();
      if (!hasScope(auth, 'habitflow:read')) {
        return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:read scope.' }] };
      }

      const supabase = getSupabaseAdmin();
      let query = supabase.from('goals').select('*, milestones(*)').eq('user_id', auth.userId);

      if (!args.includeArchived) {
        query = query.eq('is_archived', false);
      }
      if (args.status) {
        query = query.eq('status', args.status);
      }
      if (args.focusOnly) {
        query = query.eq('is_focus', true);
      }
      if (args.category) {
        query = query.eq('category', args.category);
      }

      query = query.order('created_at', { ascending: false });

      const { data: goals, error } = await query;
      if (error) {
        return { isError: true, content: [{ type: 'text', text: `Failed to fetch goals: ${error.message}` }] };
      }

      const formatted = (goals || []).map((g) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        category: g.category,
        priority: g.priority,
        status: g.status,
        progress: g.progress,
        targetDate: g.target_date,
        isFocus: g.is_focus,
        isArchived: g.is_archived,
        milestones: ((g.milestones as any[]) || [])
          .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
          .map((m) => ({
            id: m.id,
            title: m.title,
            isCompleted: m.is_completed,
            completedAt: m.completed_at,
            orderIndex: m.order_index,
          })),
        createdAt: g.created_at,
        updatedAt: g.updated_at,
      }));

      return {
        content: [{ type: 'text', text: JSON.stringify({ count: formatted.length, goals: formatted }, null, 2) }],
      };
    }
  );

  // 9. manage_goal
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
      const auth = getMcpAuthContext();
      if (!hasScope(auth, 'habitflow:write')) {
        return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:write scope.' }] };
      }

      const start = Date.now();
      const supabase = getSupabaseAdmin();

      try {
        if (args.action === 'create') {
          if (!args.title) {
            return { isError: true, content: [{ type: 'text', text: 'Validation Error: title is required for create action.' }] };
          }

          // Check focus goals count if isFocus is true
          if (args.isFocus) {
            const { count } = await supabase
              .from('goals')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', auth.userId)
              .eq('is_archived', false)
              .eq('is_focus', true);

            if ((count || 0) >= 2) {
              return {
                isError: true,
                content: [
                  {
                    type: 'text',
                    text: 'Focus Limit Reached: HabitFlow enforces a maximum of 2 active focus goals. Unset focus on another goal first.',
                  },
                ],
              };
            }
          }

          const meta = getInsertMetadata();
          const newGoal = {
            user_id: auth.userId,
            title: args.title.trim(),
            description: args.description || null,
            category: args.category || 'General',
            priority: args.priority || 'medium',
            status: args.status || 'in_progress',
            target_date: args.targetDate || null,
            progress: args.progress ?? 0,
            is_focus: args.isFocus ?? false,
            is_archived: false,
            ...meta,
          };

          const { data, error } = await supabase.from('goals').insert(newGoal).select().single();
          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_goal',
            action: 'create',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'created', goal: data }, null, 2) }] };
        }

        if (!args.goalId) {
          return { isError: true, content: [{ type: 'text', text: 'Validation Error: goalId is required.' }] };
        }

        const { data: existing, error: fetchErr } = await supabase
          .from('goals')
          .select('*')
          .eq('user_id', auth.userId)
          .eq('id', args.goalId)
          .single();

        if (fetchErr || !existing) {
          return { isError: true, content: [{ type: 'text', text: `Goal not found: ${args.goalId}` }] };
        }

        if (args.action === 'archive') {
          if (!args.confirm) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: 'Confirmation Required: Archiving this goal requires confirm: true.',
                },
              ],
            };
          }

          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('goals')
            .update({ is_archived: true, is_focus: false, ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.goalId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_goal',
            action: 'archive',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'archived', goal: data }, null, 2) }] };
        }

        if (args.action === 'restore') {
          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('goals')
            .update({ is_archived: false, ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.goalId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_goal',
            action: 'restore',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'restored', goal: data }, null, 2) }] };
        }

        if (args.action === 'set_focus') {
          const shouldFocus = args.isFocus !== undefined ? args.isFocus : !existing.is_focus;

          if (shouldFocus) {
            const { count } = await supabase
              .from('goals')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', auth.userId)
              .eq('is_archived', false)
              .eq('is_focus', true)
              .neq('id', args.goalId);

            if ((count || 0) >= 2) {
              return {
                isError: true,
                content: [
                  {
                    type: 'text',
                    text: 'Focus Limit Reached: HabitFlow allows at most 2 focus goals simultaneously.',
                  },
                ],
              };
            }
          }

          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('goals')
            .update({ is_focus: shouldFocus, ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.goalId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_goal',
            action: 'set_focus',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'focus_updated', goal: data }, null, 2) }] };
        }

        if (args.action === 'update') {
          const updates: Record<string, any> = {};
          if (args.title !== undefined) updates.title = args.title.trim();
          if (args.description !== undefined) updates.description = args.description;
          if (args.category !== undefined) updates.category = args.category;
          if (args.priority !== undefined) updates.priority = args.priority;
          if (args.status !== undefined) updates.status = args.status;
          if (args.targetDate !== undefined) updates.target_date = args.targetDate;
          if (args.progress !== undefined) updates.progress = args.progress;

          if (args.isFocus !== undefined) {
            if (args.isFocus && !existing.is_focus) {
              const { count } = await supabase
                .from('goals')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', auth.userId)
                .eq('is_archived', false)
                .eq('is_focus', true)
                .neq('id', args.goalId);

              if ((count || 0) >= 2) {
                return {
                  isError: true,
                  content: [{ type: 'text', text: 'Focus Limit Reached: At most 2 focus goals allowed.' }],
                };
              }
            }
            updates.is_focus = args.isFocus;
          }

          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('goals')
            .update({ ...updates, ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.goalId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_goal',
            action: 'update',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'updated', goal: data }, null, 2) }] };
        }

        return { isError: true, content: [{ type: 'text', text: `Unknown action: ${args.action}` }] };
      } catch (err: any) {
        await logMcpToolInvocation(auth, {
          toolName: 'manage_goal',
          action: args.action,
          input: args,
          status: 'error',
          errorMessage: err.message,
          durationMs: Date.now() - start,
        });
        return { isError: true, content: [{ type: 'text', text: `Failed to manage goal: ${err.message}` }] };
      }
    }
  );

  // 10. manage_milestone
  server.registerTool(
    'manage_milestone',
    {
      title: 'Manage Milestone',
      description:
        'Create, update, toggle completion status, or delete a milestone under a goal. Automatically recalculates parent goal progress.',
      inputSchema: {
        action: z.enum(['create', 'update', 'toggle_complete', 'delete']).describe('Action to perform'),
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
      const auth = getMcpAuthContext();
      if (!hasScope(auth, 'habitflow:write')) {
        return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:write scope.' }] };
      }

      const start = Date.now();
      const supabase = getSupabaseAdmin();

      try {
        // Verify parent goal
        const { data: goal, error: goalErr } = await supabase
          .from('goals')
          .select('*')
          .eq('user_id', auth.userId)
          .eq('id', args.goalId)
          .single();

        if (goalErr || !goal) {
          return { isError: true, content: [{ type: 'text', text: `Parent goal not found: ${args.goalId}` }] };
        }

        let resultMilestone = null;

        if (args.action === 'create') {
          if (!args.title) {
            return { isError: true, content: [{ type: 'text', text: 'Validation Error: title is required.' }] };
          }

          const meta = getInsertMetadata();
          const newMilestone = {
            user_id: auth.userId,
            goal_id: args.goalId,
            title: args.title.trim(),
            is_completed: args.isCompleted ?? false,
            completed_at: args.isCompleted ? new Date().toISOString() : null,
            order_index: args.orderIndex ?? 0,
            ...meta,
          };

          const { data, error } = await supabase.from('milestones').insert(newMilestone).select().single();
          if (error) throw error;
          resultMilestone = data;
        } else {
          if (!args.milestoneId) {
            return { isError: true, content: [{ type: 'text', text: 'Validation Error: milestoneId is required.' }] };
          }

          const { data: existing, error: fetchErr } = await supabase
            .from('milestones')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', args.milestoneId)
            .eq('goal_id', args.goalId)
            .single();

          if (fetchErr || !existing) {
            return { isError: true, content: [{ type: 'text', text: `Milestone not found: ${args.milestoneId}` }] };
          }

          if (args.action === 'delete') {
            if (!args.confirm) {
              return {
                isError: true,
                content: [{ type: 'text', text: 'Confirmation Required: Deleting milestone requires confirm: true.' }],
              };
            }

            const { error: delErr } = await supabase
              .from('milestones')
              .delete()
              .eq('user_id', auth.userId)
              .eq('id', args.milestoneId);

            if (delErr) throw delErr;
            resultMilestone = { id: args.milestoneId, deleted: true };
          } else if (args.action === 'toggle_complete') {
            const nextCompleted = !existing.is_completed;
            const meta = getUpdateMetadata(existing);
            const { data, error } = await supabase
              .from('milestones')
              .update({
                is_completed: nextCompleted,
                completed_at: nextCompleted ? new Date().toISOString() : null,
                ...meta,
              })
              .eq('id', args.milestoneId)
              .select()
              .single();

            if (error) throw error;
            resultMilestone = data;
          } else if (args.action === 'update') {
            const updates: Record<string, any> = {};
            if (args.title !== undefined) updates.title = args.title.trim();
            if (args.orderIndex !== undefined) updates.order_index = args.orderIndex;
            if (args.isCompleted !== undefined) {
              updates.is_completed = args.isCompleted;
              updates.completed_at = args.isCompleted ? new Date().toISOString() : null;
            }

            const meta = getUpdateMetadata(existing);
            const { data, error } = await supabase
              .from('milestones')
              .update({ ...updates, ...meta })
              .eq('id', args.milestoneId)
              .select()
              .single();

            if (error) throw error;
            resultMilestone = data;
          }
        }

        // Recalculate parent goal progress percentage based on all current milestones
        const { data: allMilestones } = await supabase
          .from('milestones')
          .select('is_completed')
          .eq('user_id', auth.userId)
          .eq('goal_id', args.goalId);

        let updatedGoalProgress = goal.progress;
        if (allMilestones && allMilestones.length > 0) {
          const completedCount = allMilestones.filter((m) => m.is_completed).length;
          updatedGoalProgress = Math.round((completedCount / allMilestones.length) * 100);

          const goalMeta = getUpdateMetadata(goal);
          await supabase
            .from('goals')
            .update({
              progress: updatedGoalProgress,
              status: updatedGoalProgress === 100 ? 'completed' : goal.status,
              ...goalMeta,
            })
            .eq('id', args.goalId);
        }

        await logMcpToolInvocation(auth, {
          toolName: 'manage_milestone',
          action: args.action,
          input: args,
          status: 'ok',
          durationMs: Date.now() - start,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  action: args.action,
                  milestone: resultMilestone,
                  parentGoalProgress: updatedGoalProgress,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        await logMcpToolInvocation(auth, {
          toolName: 'manage_milestone',
          action: args.action,
          input: args,
          status: 'error',
          errorMessage: err.message,
          durationMs: Date.now() - start,
        });
        return { isError: true, content: [{ type: 'text', text: `Failed to manage milestone: ${err.message}` }] };
      }
    }
  );
}
