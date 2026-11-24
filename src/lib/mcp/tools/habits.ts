import { z } from 'zod';
import { parseISO } from 'date-fns';
import type { McpServer } from '@modelcontextprotocol/server';
import { getMcpAuthContext, hasScope } from '../auth';
import { getSupabaseAdmin } from '../supabase-admin';
import { getIstIsoDate } from '../config';
import { getInsertMetadata, getUpdateMetadata } from '../sync-helpers';
import { logMcpToolInvocation } from '../audit';
import { mapHabitCompletionFromRow, mapHabitFromRow } from '../mappers';
import { calculateHabitStats, getHabitWeekProgress } from '@/lib/calculations';

export function registerHabitsTools(server: McpServer) {
  // 3. get_habits
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
      const auth = getMcpAuthContext();
      if (!hasScope(auth, 'habitflow:read')) {
        return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:read scope.' }] };
      }

      const dateIst = args.date || getIstIsoDate();
      const supabase = getSupabaseAdmin();

      let query = supabase.from('habits').select('*').eq('user_id', auth.userId);
      if (!args.includeArchived) {
        query = query.eq('is_archived', false);
      }
      if (args.category) {
        query = query.eq('category', args.category);
      }
      query = query.order('order_index', { ascending: true });

      const { data: habits, error: habitsError } = await query;
      if (habitsError) {
        return { isError: true, content: [{ type: 'text', text: `Failed to fetch habits: ${habitsError.message}` }] };
      }

      // Fetch completions for streak & today calculations
      const historyDate = new Date(`${dateIst}T00:00:00`);
      historyDate.setDate(historyDate.getDate() - (args.historyDays || 30));
      const historyStartIso = historyDate.toISOString().substring(0, 10);

      const { data: completions } = await supabase
        .from('completions')
        .select('*')
        .eq('user_id', auth.userId)
        .gte('date', historyStartIso)
        .lte('date', dateIst);

      const allCompletions = completions || [];
      const todayCompletionsMap = new Map(
        allCompletions.filter((c) => c.date === dateIst).map((c) => [c.habit_id, c])
      );

      const refDate = parseISO(dateIst);
      const enrichedHabits = (habits || []).map((h) => {
        const habitCompletions = allCompletions
          .filter((c) => c.habit_id === h.id)
          .map((c) => mapHabitCompletionFromRow(c, auth.userId));

        const habitObj = mapHabitFromRow(h, `${dateIst}T00:00:00.000Z`);

        const stats = calculateHabitStats(habitObj, habitCompletions, refDate);
        const todayComp = todayCompletionsMap.get(h.id);

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
          isArchived: h.is_archived,
          currentStreak: stats.currentStreak,
          longestStreak: stats.bestStreak,
          completionRate: stats.completionRate,
          weekProgress: getHabitWeekProgress(habitObj, habitCompletions, refDate),
          todayStatus: todayComp?.status || (todayComp?.completed ? 'completed' : 'pending'),
          todayValue: todayComp?.value ?? null,
          todayNotes: todayComp?.notes ?? null,
        };
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ dateIst, count: enrichedHabits.length, habits: enrichedHabits }, null, 2),
          },
        ],
      };
    }
  );

  // 4. manage_habit
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
      const auth = getMcpAuthContext();
      if (!hasScope(auth, 'habitflow:write')) {
        return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:write scope.' }] };
      }

      const start = Date.now();
      const supabase = getSupabaseAdmin();

      try {
        if (args.action === 'create') {
          if (!args.name) {
            return { isError: true, content: [{ type: 'text', text: 'Validation Error: name is required for create action.' }] };
          }

          const meta = getInsertMetadata();
          const newHabit = {
            user_id: auth.userId,
            name: args.name.trim(),
            description: args.description || null,
            icon: args.icon || 'Sparkles',
            color: args.color || '#10B981',
            category: args.category || 'General',
            frequency_type: args.frequency_type || 'daily',
            target_days: args.target_days || 7,
            scheduled_days: args.scheduled_days || [0, 1, 2, 3, 4, 5, 6],
            interval_days: args.interval_days || 1,
            allow_bonus_completions: args.allow_bonus_completions ?? false,
            auto_track_rule: args.auto_track_rule || null,
            is_quantitative: args.is_quantitative ?? false,
            target_value: args.target_value ?? null,
            unit: args.unit || null,
            order_index: args.order_index ?? 0,
            is_archived: false,
            ...meta,
          };

          const { data, error } = await supabase.from('habits').insert(newHabit).select().single();
          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_habit',
            action: 'create',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'created', habit: data }, null, 2) }] };
        }

        if (!args.habitId) {
          return { isError: true, content: [{ type: 'text', text: 'Validation Error: habitId is required.' }] };
        }

        // Fetch existing habit
        const { data: existing, error: fetchErr } = await supabase
          .from('habits')
          .select('*')
          .eq('user_id', auth.userId)
          .eq('id', args.habitId)
          .single();

        if (fetchErr || !existing) {
          return { isError: true, content: [{ type: 'text', text: `Habit not found: ${args.habitId}` }] };
        }

        if (args.action === 'archive') {
          if (!args.confirm) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: 'Confirmation Required: Archiving this habit requires confirm: true in tool arguments.',
                },
              ],
            };
          }

          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('habits')
            .update({ is_archived: true, ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.habitId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_habit',
            action: 'archive',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'archived', habit: data }, null, 2) }] };
        }

        if (args.action === 'restore') {
          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('habits')
            .update({ is_archived: false, ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.habitId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_habit',
            action: 'restore',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'restored', habit: data }, null, 2) }] };
        }

        if (args.action === 'update') {
          const updates: Record<string, any> = {};
          if (args.name !== undefined) updates.name = args.name.trim();
          if (args.description !== undefined) updates.description = args.description;
          if (args.icon !== undefined) updates.icon = args.icon;
          if (args.color !== undefined) updates.color = args.color;
          if (args.category !== undefined) updates.category = args.category;
          if (args.frequency_type !== undefined) updates.frequency_type = args.frequency_type;
          if (args.target_days !== undefined) updates.target_days = args.target_days;
          if (args.scheduled_days !== undefined) updates.scheduled_days = args.scheduled_days;
          if (args.interval_days !== undefined) updates.interval_days = args.interval_days;
          if (args.allow_bonus_completions !== undefined) updates.allow_bonus_completions = args.allow_bonus_completions;
          if (args.auto_track_rule !== undefined) updates.auto_track_rule = args.auto_track_rule;
          if (args.is_quantitative !== undefined) updates.is_quantitative = args.is_quantitative;
          if (args.target_value !== undefined) updates.target_value = args.target_value;
          if (args.unit !== undefined) updates.unit = args.unit;
          if (args.order_index !== undefined) updates.order_index = args.order_index;

          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('habits')
            .update({ ...updates, ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.habitId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_habit',
            action: 'update',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'updated', habit: data }, null, 2) }] };
        }

        return { isError: true, content: [{ type: 'text', text: `Unknown action: ${args.action}` }] };
      } catch (err: any) {
        await logMcpToolInvocation(auth, {
          toolName: 'manage_habit',
          action: args.action,
          input: args,
          status: 'error',
          errorMessage: err.message,
          durationMs: Date.now() - start,
        });
        return { isError: true, content: [{ type: 'text', text: `Failed to manage habit: ${err.message}` }] };
      }
    }
  );

  // 5. log_habit_completion
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
      const auth = getMcpAuthContext();
      if (!hasScope(auth, 'habitflow:write')) {
        return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:write scope.' }] };
      }

      const start = Date.now();
      const dateIst = args.date || getIstIsoDate();
      const supabase = getSupabaseAdmin();

      try {
        // Verify habit exists and belongs to user
        const { data: habit, error: habitErr } = await supabase
          .from('habits')
          .select('*')
          .eq('user_id', auth.userId)
          .eq('id', args.habitId)
          .single();

        if (habitErr || !habit) {
          return { isError: true, content: [{ type: 'text', text: `Habit not found: ${args.habitId}` }] };
        }

        const isCompleted = args.status === 'completed';
        const isSkipped = args.status === 'rest' || args.status === 'frozen';

        // Check if a completion already exists for (habit_id, date)
        const { data: existing } = await supabase
          .from('completions')
          .select('*')
          .eq('user_id', auth.userId)
          .eq('habit_id', args.habitId)
          .eq('date', dateIst)
          .maybeSingle();

        let savedCompletion = null;

        if (existing) {
          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('completions')
            .update({
              completed: isCompleted,
              skipped: isSkipped,
              status: args.status,
              rest_reason: args.restReason || null,
              notes: args.notes !== undefined ? args.notes : existing.notes,
              value: args.value !== undefined ? args.value : existing.value,
              ...meta,
            })
            .eq('id', existing.id)
            .select()
            .single();

          if (error) throw error;
          savedCompletion = data;
        } else {
          const meta = getInsertMetadata();
          const { data, error } = await supabase
            .from('completions')
            .insert({
              user_id: auth.userId,
              habit_id: args.habitId,
              date: dateIst,
              completed: isCompleted,
              skipped: isSkipped,
              status: args.status,
              rest_reason: args.restReason || null,
              notes: args.notes || null,
              value: args.value ?? null,
              ...meta,
            })
            .select()
            .single();

          if (error) throw error;
          savedCompletion = data;
        }

        await logMcpToolInvocation(auth, {
          toolName: 'log_habit_completion',
          action: args.status,
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
                  habitName: habit.name,
                  dateIst,
                  status: args.status,
                  completion: savedCompletion,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        await logMcpToolInvocation(auth, {
          toolName: 'log_habit_completion',
          action: args.status,
          input: args,
          status: 'error',
          errorMessage: err.message,
          durationMs: Date.now() - start,
        });
        return { isError: true, content: [{ type: 'text', text: `Failed to log completion: ${err.message}` }] };
      }
    }
  );
}
