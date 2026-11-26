 
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { getSupabaseAdmin } from '../../supabase-admin';
import { authorizeMcpTool, mcpError, mcpJson } from '../tool-helpers';

function formatGoalWithMilestones(g: Record<string, any>) {
  const milestones = ((g.milestones as Array<Record<string, any>>) || [])
    .slice()
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map((m) => ({
      id: m.id,
      title: m.title,
      isCompleted: m.is_completed,
      completedAt: m.completed_at,
      orderIndex: m.order_index,
    }));

  return {
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
    financialLink: g.financial_link ?? null,
    fitnessLink: g.fitness_link ?? null,
    metadata: g.metadata ?? {},
    milestones,
    createdAt: g.created_at,
    updatedAt: g.updated_at,
  };
}

export function registerGetGoalsTool(server: McpServer) {
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
      const authRes = authorizeMcpTool('habitflow:read');
      if (!authRes.ok) return authRes.response;

      const supabase = getSupabaseAdmin();
      let query = supabase.from('goals').select('*, milestones(*)').eq('user_id', authRes.auth.userId);

      if (!args.includeArchived) query = query.eq('is_archived', false);
      if (args.status) query = query.eq('status', args.status);
      if (args.focusOnly) query = query.eq('is_focus', true);
      if (args.category) query = query.eq('category', args.category);

      const { data: goals, error } = await query.order('created_at', { ascending: false });
      if (error) return mcpError(`Failed to fetch goals: ${error.message}`);

      const formatted = (goals || []).map(formatGoalWithMilestones);
      return mcpJson({ count: formatted.length, goals: formatted });
    }
  );
}
