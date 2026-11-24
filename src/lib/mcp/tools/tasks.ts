import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { getMcpAuthContext, hasScope } from '../auth';
import { getSupabaseAdmin } from '../supabase-admin';
import { getInsertMetadata, getUpdateMetadata } from '../sync-helpers';
import { logMcpToolInvocation } from '../audit';

export function registerTasksTools(server: McpServer) {
  // 6. get_tasks
  server.registerTool(
    'get_tasks',
    {
      title: 'Get Tasks & Subtasks',
      description:
        'Retrieves tasks with filtering by status, priority, due dates, linked goal, tags, parent task, or text search.',
      inputSchema: {
        status: z
          .enum(['todo', 'in_progress', 'done', 'archived', 'all'])
          .optional()
          .default('all')
          .describe('Filter by task status'),
        priority: z.enum(['low', 'medium', 'high']).optional().describe('Filter by priority'),
        dueBefore: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Due on or before YYYY-MM-DD'),
        dueAfter: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Due on or after YYYY-MM-DD'),
        goalId: z.string().uuid().optional().describe('Filter by linked goal UUID'),
        parentTaskId: z.string().uuid().optional().describe('Filter subtasks by parent task UUID'),
        tag: z.string().optional().describe('Filter by tag'),
        search: z.string().optional().describe('Text search across title, description, and notes'),
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
      let query = supabase.from('tasks').select('*').eq('user_id', auth.userId);

      if (args.status && args.status !== 'all') {
        query = query.eq('status', args.status);
      } else if (!args.status || args.status === 'all') {
        // By default omit archived unless specifically asked for archived or all
        // If 'all', do nothing
      }

      if (args.priority) {
        query = query.eq('priority', args.priority);
      }
      if (args.goalId) {
        query = query.eq('goal_id', args.goalId);
      }
      if (args.parentTaskId) {
        query = query.eq('parent_task_id', args.parentTaskId);
      }
      if (args.dueBefore) {
        query = query.lte('due_date', args.dueBefore);
      }
      if (args.dueAfter) {
        query = query.gte('due_date', args.dueAfter);
      }
      if (args.search) {
        query = query.or(
          `title.ilike.%${args.search}%,description.ilike.%${args.search}%,notes.ilike.%${args.search}%`
        );
      }

      query = query.order('created_at', { ascending: false });

      const { data: tasks, error } = await query;
      if (error) {
        return { isError: true, content: [{ type: 'text', text: `Failed to fetch tasks: ${error.message}` }] };
      }

      let filtered = tasks || [];
      if (args.tag) {
        filtered = filtered.filter((t) => Array.isArray(t.tags) && t.tags.includes(args.tag));
      }

      // Count subtasks
      const parentTaskIds = new Set(filtered.map((t) => t.id));
      const subtaskCounts = new Map<string, number>();
      for (const t of filtered) {
        if (t.parent_task_id) {
          subtaskCounts.set(t.parent_task_id, (subtaskCounts.get(t.parent_task_id) || 0) + 1);
        }
      }

      const result = filtered.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        notes: t.notes,
        status: t.status,
        priority: t.priority,
        dueDate: t.due_date,
        goalId: t.goal_id,
        parentTaskId: t.parent_task_id,
        subtasksCount: subtaskCounts.get(t.id) || 0,
        tags: t.tags || [],
        isUrgent: t.is_urgent,
        isImportant: t.is_important,
        estimatedTime: t.estimated_time,
        actualTime: t.actual_time,
        recurrenceRule: t.recurrence_rule,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }));

      return {
        content: [{ type: 'text', text: JSON.stringify({ count: result.length, tasks: result }, null, 2) }],
      };
    }
  );

  // 7. manage_task
  server.registerTool(
    'manage_task',
    {
      title: 'Manage Task or Subtask',
      description:
        'Create, update, toggle completion status, archive (soft-delete), or restore a task. Note: Archiving cascades to subtasks and requires confirm: true.',
      inputSchema: {
        action: z.enum(['create', 'update', 'toggle_status', 'archive', 'restore']).describe('Action to execute'),
        taskId: z.string().uuid().optional().describe('Task UUID (required for update, toggle_status, archive, restore)'),
        title: z.string().min(1).max(255).optional().describe('Task title'),
        description: z.string().optional().describe('Task description'),
        notes: z.string().optional().describe('Detailed markdown notes or checklist items'),
        status: z.enum(['todo', 'in_progress', 'done', 'archived']).optional().describe('Task status'),
        priority: z.enum(['low', 'medium', 'high']).optional().describe('Task priority'),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().describe('Due date (YYYY-MM-DD) or null to clear'),
        goalId: z.string().uuid().nullable().optional().describe('Linked Goal UUID or null to clear'),
        parentTaskId: z.string().uuid().nullable().optional().describe('Parent task UUID if this is a subtask'),
        tags: z.array(z.string()).optional().describe('Tags list'),
        recurrenceRule: z.string().nullable().optional().describe('Recurrence rule (e.g. daily, weekly) or null to clear'),
        estimatedTime: z.number().int().min(0).optional().describe('Estimated duration in minutes'),
        actualTime: z.number().int().min(0).optional().describe('Actual duration in minutes'),
        isUrgent: z.boolean().optional().describe('Eisenhower Matrix urgent flag'),
        isImportant: z.boolean().optional().describe('Eisenhower Matrix important flag'),
        metadata: z.record(z.string(), z.any()).optional().describe('Custom metadata payload'),
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

          let depth = 0;
          if (args.parentTaskId) {
            const { data: parent } = await supabase
              .from('tasks')
              .select('depth')
              .eq('user_id', auth.userId)
              .eq('id', args.parentTaskId)
              .single();
            depth = (parent?.depth || 0) + 1;
          }

          const meta = getInsertMetadata();
          const newTask = {
            user_id: auth.userId,
            title: args.title.trim(),
            description: args.description || null,
            notes: args.notes || null,
            status: args.status || 'todo',
            priority: args.priority || 'medium',
            due_date: args.dueDate || null,
            goal_id: args.goalId || null,
            parent_task_id: args.parentTaskId || null,
            depth,
            tags: args.tags || [],
            recurrence_rule: args.recurrenceRule || null,
            estimated_time: args.estimatedTime ?? 0,
            actual_time: args.actualTime ?? 0,
            is_urgent: args.isUrgent ?? false,
            is_important: args.isImportant ?? false,
            metadata: args.metadata || {},
            ...meta,
          };

          const { data, error } = await supabase.from('tasks').insert(newTask).select().single();
          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_task',
            action: 'create',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'created', task: data }, null, 2) }] };
        }

        if (!args.taskId) {
          return { isError: true, content: [{ type: 'text', text: 'Validation Error: taskId is required.' }] };
        }

        const { data: existing, error: fetchErr } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', auth.userId)
          .eq('id', args.taskId)
          .single();

        if (fetchErr || !existing) {
          return { isError: true, content: [{ type: 'text', text: `Task not found: ${args.taskId}` }] };
        }

        if (args.action === 'archive') {
          if (!args.confirm) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: 'Confirmation Required: Archiving this task cascades to all its subtasks and requires confirm: true.',
                },
              ],
            };
          }

          // Fetch all child subtasks recursively or directly
          const { data: subtasks } = await supabase
            .from('tasks')
            .select('id, generation_counter')
            .eq('user_id', auth.userId)
            .eq('parent_task_id', args.taskId);

          const affectedSubtaskIds: string[] = [];
          for (const sub of subtasks || []) {
            const subMeta = getUpdateMetadata(sub);
            await supabase
              .from('tasks')
              .update({ status: 'archived', ...subMeta })
              .eq('id', sub.id);
            affectedSubtaskIds.push(sub.id);
          }

          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('tasks')
            .update({ status: 'archived', ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.taskId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_task',
            action: 'archive',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ action: 'archived', task: data, affectedSubtaskIds }, null, 2),
              },
            ],
          };
        }

        if (args.action === 'restore') {
          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('tasks')
            .update({ status: 'todo', ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.taskId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_task',
            action: 'restore',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'restored', task: data }, null, 2) }] };
        }

        if (args.action === 'toggle_status') {
          const newStatus = existing.status === 'done' ? 'todo' : 'done';
          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('tasks')
            .update({ status: newStatus, ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.taskId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_task',
            action: 'toggle_status',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'toggle_status', task: data }, null, 2) }] };
        }

        if (args.action === 'update') {
          const updates: Record<string, any> = {};
          if (args.title !== undefined) updates.title = args.title.trim();
          if (args.description !== undefined) updates.description = args.description;
          if (args.notes !== undefined) updates.notes = args.notes;
          if (args.status !== undefined) updates.status = args.status;
          if (args.priority !== undefined) updates.priority = args.priority;
          if (args.dueDate !== undefined) updates.due_date = args.dueDate;
          if (args.goalId !== undefined) updates.goal_id = args.goalId;
          if (args.parentTaskId !== undefined) updates.parent_task_id = args.parentTaskId;
          if (args.tags !== undefined) updates.tags = args.tags;
          if (args.recurrenceRule !== undefined) updates.recurrence_rule = args.recurrenceRule;
          if (args.estimatedTime !== undefined) updates.estimated_time = args.estimatedTime;
          if (args.actualTime !== undefined) updates.actual_time = args.actualTime;
          if (args.isUrgent !== undefined) updates.is_urgent = args.isUrgent;
          if (args.isImportant !== undefined) updates.is_important = args.isImportant;
          if (args.metadata !== undefined) updates.metadata = args.metadata;

          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('tasks')
            .update({ ...updates, ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.taskId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_task',
            action: 'update',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'updated', task: data }, null, 2) }] };
        }

        return { isError: true, content: [{ type: 'text', text: `Unknown action: ${args.action}` }] };
      } catch (err: any) {
        await logMcpToolInvocation(auth, {
          toolName: 'manage_task',
          action: args.action,
          input: args,
          status: 'error',
          errorMessage: err.message,
          durationMs: Date.now() - start,
        });
        return { isError: true, content: [{ type: 'text', text: `Failed to manage task: ${err.message}` }] };
      }
    }
  );
}
