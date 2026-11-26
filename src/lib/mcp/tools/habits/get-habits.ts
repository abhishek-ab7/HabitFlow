 
import { z } from 'zod';
import { parseISO } from 'date-fns';
import type { McpServer } from '@modelcontextprotocol/server';
import { calculateHabitStats, getHabitWeekProgress } from '@/lib/calculations';
import { addDays } from '@/lib/finance/credit-card-cycles';
import { getSupabaseAdmin } from '../../supabase-admin';
import { getIstIsoDate } from '../../config';
import {
  mapHabitCompletionFromRow,
  mapHabitFromRow,
  resolveCompletionStatusFromRow,
} from '../../mappers';
import { authorizeMcpTool, mcpError, mcpJson } from '../tool-helpers';

function formatEnrichedHabit(params: {
  h: Record<string, any>;
  userId: string;
  dateIst: string;
  refDate: Date;
  allCompletions: Array<Record<string, any>>;
  todayCompletionsMap: Map<string, Record<string, any>>;
}) {
  const { h, userId, dateIst, refDate } = params;
  const habitCompletions = params.allCompletions
    .filter((c) => c.habit_id === h.id)
    .map((c) => mapHabitCompletionFromRow(c, userId));

  const habitObj = mapHabitFromRow(h, `${dateIst}T00:00:00.000Z`);
  const stats = calculateHabitStats(habitObj, habitCompletions, refDate);
  const todayComp = params.todayCompletionsMap.get(h.id);
  const todayStatus = (todayComp ? resolveCompletionStatusFromRow(todayComp) : undefined) || 'pending';

  return {
    id: h.id,
    name: h.name,
    description: h.description,
    icon: h.icon,
    color: h.color,
    category: h.category,
    frequencyType: h.frequency_type,
    scheduledDays: h.scheduled_days,
    targetDays: h.target_days,
    isQuantitative: h.is_quantitative,
    targetValue: h.target_value,
    unit: h.unit,
    polarity: h.polarity || 'build',
    anchorBlock: h.anchor_block ?? null,
    metadata: h.metadata || {},
    isArchived: h.is_archived,
    currentStreak: stats.currentStreak,
    longestStreak: stats.bestStreak,
    completionRate: stats.completionRate,
    weekProgress: getHabitWeekProgress(habitObj, habitCompletions, refDate),
    todayStatus,
    todayValue: todayComp?.value ?? null,
    todayNotes: todayComp?.notes ?? null,
  };
}

async function fetchAndFormatHabits(
  userId: string,
  args: { includeArchived?: boolean; category?: string; date?: string; historyDays?: number }
) {
  const dateIst = args.date || getIstIsoDate();
  const supabase = getSupabaseAdmin();

  let query = supabase.from('habits').select('*').eq('user_id', userId);
  if (!args.includeArchived) query = query.eq('is_archived', false);
  if (args.category) query = query.eq('category', args.category);

  const { data: habits, error: habitsError } = await query.order('order_index', { ascending: true });
  if (habitsError) return mcpError(`Failed to fetch habits: ${habitsError.message}`);

  const historyStartIso = addDays(dateIst, -(args.historyDays || 30));
  const { data: completions } = await supabase
    .from('completions')
    .select('*')
    .eq('user_id', userId)
    .gte('date', historyStartIso)
    .lte('date', dateIst);

  const allCompletions = completions || [];
  const todayCompletionsMap = new Map(
    allCompletions.filter((c) => c.date === dateIst).map((c) => [c.habit_id, c])
  );
  const refDate = parseISO(dateIst);
  const enrichedHabits = (habits || []).map((h) =>
    formatEnrichedHabit({ h, userId, dateIst, refDate, allCompletions, todayCompletionsMap })
  );

  return mcpJson({ dateIst, count: enrichedHabits.length, habits: enrichedHabits });
}

export function registerGetHabitsTool(server: McpServer) {
  server.registerTool(
    'get_habits',
    {
      title: 'Get Habits',
      description:
        'Lists habits with streaks, weekly progress, target values, and completion status for a given IST date.',
      inputSchema: {
        includeArchived: z.boolean().optional().default(false).describe('Include archived habits'),
        category: z.string().optional().describe('Filter by habit category'),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
          .optional()
          .describe('Reference date in YYYY-MM-DD (defaults to today in IST)'),
        historyDays: z.number().int().min(7).max(90).optional().default(30).describe('Completions history window in days'),
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
      return fetchAndFormatHabits(authRes.auth.userId, args);
    }
  );
}
