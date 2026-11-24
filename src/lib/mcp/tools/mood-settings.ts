import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { getMcpAuthContext, hasScope } from '../auth';
import { getSupabaseAdmin } from '../supabase-admin';
import { getIstIsoDate } from '../config';
import { getInsertMetadata, getUpdateMetadata } from '../sync-helpers';
import { logMcpToolInvocation } from '../audit';

export function registerMoodSettingsTools(server: McpServer) {
  // 11. manage_mood
  server.registerTool(
    'manage_mood',
    {
      title: 'Manage Mood Logs',
      description: 'List historical mood entries or log a mood check-in for a specific IST date.',
      inputSchema: {
        action: z.enum(['list', 'log']).describe('Action: list historical moods or log a new mood'),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
          .optional()
          .describe('Date for mood log (defaults to today in IST)'),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Filter start date for list action'),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Filter end date for list action'),
        mood: z.string().optional().describe('Mood value (e.g. great, good, okay, low, bad, or custom string)'),
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
      const supabase = getSupabaseAdmin();

      if (args.action === 'list') {
        if (!hasScope(auth, 'habitflow:read')) {
          return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:read scope.' }] };
        }

        let query = supabase.from('mood_logs').select('*').eq('user_id', auth.userId);
        if (args.startDate) query = query.gte('date', args.startDate);
        if (args.endDate) query = query.lte('date', args.endDate);
        query = query.order('date', { ascending: false });

        const { data, error } = await query;
        if (error) {
          return { isError: true, content: [{ type: 'text', text: `Failed to fetch moods: ${error.message}` }] };
        }

        return { content: [{ type: 'text', text: JSON.stringify({ count: (data || []).length, moods: data }, null, 2) }] };
      }

      if (args.action === 'log') {
        if (!hasScope(auth, 'habitflow:write')) {
          return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:write scope.' }] };
        }

        if (!args.mood) {
          return { isError: true, content: [{ type: 'text', text: 'Validation Error: mood is required for log action.' }] };
        }

        const dateIst = args.date || getIstIsoDate();
        const start = Date.now();

        try {
          const { data: existing } = await supabase
            .from('mood_logs')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('date', dateIst)
            .maybeSingle();

          let savedMood = null;

          if (existing) {
            const meta = getUpdateMetadata(existing);
            const { data, error } = await supabase
              .from('mood_logs')
              .update({ mood: args.mood, ...meta })
              .eq('id', existing.id)
              .select()
              .single();

            if (error) throw error;
            savedMood = data;
          } else {
            const meta = getInsertMetadata();
            const { data, error } = await supabase
              .from('mood_logs')
              .insert({
                user_id: auth.userId,
                date: dateIst,
                mood: args.mood,
                ...meta,
              })
              .select()
              .single();

            if (error) throw error;
            savedMood = data;
          }

          await logMcpToolInvocation(auth, {
            toolName: 'manage_mood',
            action: 'log',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'logged', entry: savedMood }, null, 2) }] };
        } catch (err: any) {
          await logMcpToolInvocation(auth, {
            toolName: 'manage_mood',
            action: 'log',
            input: args,
            status: 'error',
            errorMessage: err.message,
            durationMs: Date.now() - start,
          });
          return { isError: true, content: [{ type: 'text', text: `Failed to log mood: ${err.message}` }] };
        }
      }

      return { isError: true, content: [{ type: 'text', text: `Unknown action: ${args.action}` }] };
    }
  );

  // 12. get_user_settings
  server.registerTool(
    'get_user_settings',
    {
      title: 'Get User Settings',
      description: 'Retrieves user profile preferences, theme accent, dashboard layout, and gamification level/XP stats.',
      inputSchema: {
        refresh: z.boolean().optional().describe('Force fresh read from database'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (_args) => {
      const auth = getMcpAuthContext();
      if (!hasScope(auth, 'habitflow:read')) {
        return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:read scope.' }] };
      }

      const supabase = getSupabaseAdmin();
      const { data: settings, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', auth.userId)
        .maybeSingle();

      if (error) {
        return { isError: true, content: [{ type: 'text', text: `Failed to fetch user settings: ${error.message}` }] };
      }

      if (!settings) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ message: 'No custom settings recorded yet. Using defaults.' }, null, 2),
            },
          ],
        };
      }

      const result = {
        userName: settings.user_name,
        avatarId: settings.avatar_id,
        weekStartDay: settings.week_start_day,
        defaultCategory: settings.default_category,
        accent: settings.accent,
        motivationText: settings.motivation_text,
        dashboardLayout: settings.dashboard_layout,
        gamification: {
          xp: settings.xp,
          level: settings.level,
          gems: settings.gems,
          streakShield: settings.streak_shield,
          stats: settings.stats,
        },
      };

      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // 13. update_user_settings
  server.registerTool(
    'update_user_settings',
    {
      title: 'Update User Settings',
      description:
        'Updates user profile configuration, week start day, default habit category, motivation text, or dashboard layout.',
      inputSchema: {
        userName: z.string().min(1).max(50).optional().describe('User display name'),
        avatarId: z.string().optional().describe('Avatar identifier'),
        weekStartDay: z.number().int().min(0).max(6).optional().describe('Week start day (0=Sunday, 1=Monday)'),
        defaultCategory: z.string().optional().describe('Default category for new habits'),
        accent: z.string().optional().describe('Theme accent name'),
        motivationText: z.string().optional().describe('Custom dashboard motivation text'),
        dashboardLayout: z.any().optional().describe('Dashboard card arrangement JSON'),
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
      const supabase = getSupabaseAdmin();

      try {
        const { data: existing } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', auth.userId)
          .maybeSingle();

        const updates: Record<string, any> = {};
        if (args.userName !== undefined) updates.user_name = args.userName.trim();
        if (args.avatarId !== undefined) updates.avatar_id = args.avatarId;
        if (args.weekStartDay !== undefined) updates.week_start_day = args.weekStartDay;
        if (args.defaultCategory !== undefined) updates.default_category = args.defaultCategory;
        if (args.accent !== undefined) updates.accent = args.accent;
        if (args.motivationText !== undefined) updates.motivation_text = args.motivationText;
        if (args.dashboardLayout !== undefined) updates.dashboard_layout = args.dashboardLayout;

        let result = null;

        if (existing) {
          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('user_settings')
            .update({ ...updates, ...meta })
            .eq('id', existing.id)
            .select()
            .single();

          if (error) throw error;
          result = data;
        } else {
          const meta = getInsertMetadata();
          const { data, error } = await supabase
            .from('user_settings')
            .insert({
              user_id: auth.userId,
              user_name: args.userName || 'HabitFlow User',
              week_start_day: args.weekStartDay ?? 1,
              ...updates,
              ...meta,
            })
            .select()
            .single();

          if (error) throw error;
          result = data;
        }

        await logMcpToolInvocation(auth, {
          toolName: 'update_user_settings',
          action: 'update',
          input: args,
          status: 'ok',
          durationMs: Date.now() - start,
        });

        return { content: [{ type: 'text', text: JSON.stringify({ updated: true, settings: result }, null, 2) }] };
      } catch (err: any) {
        await logMcpToolInvocation(auth, {
          toolName: 'update_user_settings',
          action: 'update',
          input: args,
          status: 'error',
          errorMessage: err.message,
          durationMs: Date.now() - start,
        });
        return { isError: true, content: [{ type: 'text', text: `Failed to update settings: ${err.message}` }] };
      }
    }
  );
}
