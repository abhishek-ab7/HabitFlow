import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { handleGetTasks, handleManageTask } from './tasks-handlers';

export function registerTasksTools(server: McpServer) {
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
    handleGetTasks
  );

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
        metadata: z
          .record(z.string(), z.any())
          .optional()
          .describe('Custom metadata payload (supports MIT pinning: { isMitForDate: "YYYY-MM-DD", mitRank: 1|2|3 })'),
        restoreSubtasks: z.boolean().optional().default(false).describe('When restoring, also restore archived descendant subtasks'),
        confirm: z.boolean().optional().describe('Confirmation flag required for destructive actions like archive'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    handleManageTask
  );
}
