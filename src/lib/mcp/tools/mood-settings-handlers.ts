import { getMcpAuthContext, hasScope } from '../auth';
import { getSupabaseAdmin } from '../supabase-admin';
import { getIstIsoDate } from '../config';
import { getInsertMetadata, getUpdateMetadata } from '../sync-helpers';
import { logMcpToolInvocation } from '../audit';

function mcpError(text: string) {
  return { isError: true, content: [{ type: 'text' as const, text }] };
}

function mcpJson(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
}

async function listMoodEntries(userId: string, args: any) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('mood_logs').select('*').eq('user_id', userId);
  if (args.startDate) query = query.gte('date', args.startDate);
  if (args.endDate) query = query.lte('date', args.endDate);
  const { data, error } = await query.order('date', { ascending: false });
  if (error) return mcpError(`Failed to fetch moods: ${error.message}`);
  return mcpJson({ count: (data || []).length, moods: data });
}

async function logMoodEntry(auth: ReturnType<typeof getMcpAuthContext>, args: any) {
  if (!args.mood) return mcpError('Validation Error: mood is required for log action.');
  const dateIst = args.date || getIstIsoDate();
  const start = Date.now();
  const supabase = getSupabaseAdmin();

  try {
    const { data: existing } = await supabase
      .from('mood_logs')
      .select('*')
      .eq('user_id', auth.userId)
      .eq('date', dateIst)
      .maybeSingle();

    const query = existing
      ? supabase.from('mood_logs').update({ mood: args.mood, ...getUpdateMetadata(existing) }).eq('id', existing.id)
      : supabase.from('mood_logs').insert({ user_id: auth.userId, date: dateIst, mood: args.mood, ...getInsertMetadata() });

    const { data, error } = await query.select().single();
    if (error) throw error;

    await logMcpToolInvocation(auth, {
      toolName: 'manage_mood',
      action: 'log',
      input: args,
      status: 'ok',
      durationMs: Date.now() - start,
    });
    return mcpJson({ action: 'logged', entry: data });
  } catch (err: any) {
    await logMcpToolInvocation(auth, {
      toolName: 'manage_mood',
      action: 'log',
      input: args,
      status: 'error',
      errorMessage: err.message,
      durationMs: Date.now() - start,
    });
    return mcpError(`Failed to log mood: ${err.message}`);
  }
}

async function deleteMoodEntry(auth: ReturnType<typeof getMcpAuthContext>, args: any) {
  if (!args.confirm) {
    return mcpError('Confirmation Required: Deleting a mood log requires confirm: true.');
  }
  const start = Date.now();
  const supabase = getSupabaseAdmin();

  try {
    let query = supabase.from('mood_logs').select('*').eq('user_id', auth.userId);
    query = args.moodId ? query.eq('id', args.moodId) : query.eq('date', args.date || getIstIsoDate());
    const { data: existing, error: fetchErr } = await query.maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing) return mcpError('Mood log entry not found.');

    const { error: delErr } = await supabase
      .from('mood_logs')
      .delete()
      .eq('user_id', auth.userId)
      .eq('id', existing.id);
    if (delErr) throw delErr;

    await logMcpToolInvocation(auth, {
      toolName: 'manage_mood',
      action: 'delete',
      input: args,
      status: 'ok',
      durationMs: Date.now() - start,
    });
    return mcpJson({ action: 'deleted', deletedEntry: existing });
  } catch (err: any) {
    await logMcpToolInvocation(auth, {
      toolName: 'manage_mood',
      action: 'delete',
      input: args,
      status: 'error',
      errorMessage: err.message,
      durationMs: Date.now() - start,
    });
    return mcpError(`Failed to delete mood: ${err.message}`);
  }
}

export async function handleManageMood(args: any) {
  const auth = getMcpAuthContext();
  if (args.action === 'list') {
    if (!hasScope(auth, 'habitflow:read')) return mcpError('Forbidden: Missing habitflow:read scope.');
    return listMoodEntries(auth.userId, args);
  }
  if (!hasScope(auth, 'habitflow:write')) return mcpError('Forbidden: Missing habitflow:write scope.');
  if (args.action === 'log') return logMoodEntry(auth, args);
  if (args.action === 'delete') return deleteMoodEntry(auth, args);
  return mcpError(`Unknown action: ${args.action}`);
}

export async function handleGetUserSettings() {
  const auth = getMcpAuthContext();
  if (!hasScope(auth, 'habitflow:read')) return mcpError('Forbidden: Missing habitflow:read scope.');

  const supabase = getSupabaseAdmin();
  const { data: settings, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', auth.userId)
    .maybeSingle();

  if (error) return mcpError(`Failed to fetch user settings: ${error.message}`);
  if (!settings) return mcpJson({ message: 'No custom settings recorded yet. Using defaults.' });

  return mcpJson({
    userName: settings.user_name,
    avatarId: settings.avatar_id,
    weekStartDay: settings.week_start_day,
    defaultCategory: settings.default_category,
    accent: settings.accent,
    motivationText: settings.motivation_text,
    dashboardLayout: settings.dashboard_layout,
    modules: {
      showFitness: settings.show_fitness ?? true,
      showFinance: settings.show_finance ?? true,
      showTasks: settings.show_tasks ?? true,
      showGoals: settings.show_goals ?? true,
      showMilestones: settings.show_milestones ?? true,
      habitOnlyMode: settings.habit_only_mode ?? false,
    },
    gamification: {
      xp: settings.xp,
      level: settings.level,
      gems: settings.gems,
      streakShield: settings.streak_shield,
      stats: settings.stats,
      unlockedThemes: settings.unlocked_themes || [],
    },
  });
}

const SETTINGS_FIELD_MAP: Array<[string, string, ((v: any) => any)?]> = [
  ['userName', 'user_name', (v) => v.trim()],
  ['avatarId', 'avatar_id'],
  ['weekStartDay', 'week_start_day'],
  ['defaultCategory', 'default_category'],
  ['accent', 'accent'],
  ['motivationText', 'motivation_text'],
  ['dashboardLayout', 'dashboard_layout'],
  ['showFitness', 'show_fitness'],
  ['showFinance', 'show_finance'],
  ['showTasks', 'show_tasks'],
  ['showGoals', 'show_goals'],
  ['showMilestones', 'show_milestones'],
  ['habitOnlyMode', 'habit_only_mode'],
  ['streakShield', 'streak_shield'],
];

function buildUserSettingsUpdates(args: any): Record<string, any> {
  const updates: Record<string, any> = {};
  for (const [argKey, dbKey, transform] of SETTINGS_FIELD_MAP) {
    if (args[argKey] !== undefined) {
      updates[dbKey] = transform ? transform(args[argKey]) : args[argKey];
    }
  }
  return updates;
}

export async function handleUpdateUserSettings(args: any) {
  const auth = getMcpAuthContext();
  if (!hasScope(auth, 'habitflow:write')) return mcpError('Forbidden: Missing habitflow:write scope.');

  const start = Date.now();
  const supabase = getSupabaseAdmin();

  try {
    const { data: existing } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', auth.userId)
      .maybeSingle();

    const updates = buildUserSettingsUpdates(args);
    const query = existing
      ? supabase.from('user_settings').update({ ...updates, ...getUpdateMetadata(existing) }).eq('id', existing.id)
      : supabase.from('user_settings').insert({
          user_id: auth.userId,
          user_name: args.userName || 'HabitFlow User',
          week_start_day: args.weekStartDay ?? 1,
          ...updates,
          ...getInsertMetadata(),
        });

    const { data, error } = await query.select().single();
    if (error) throw error;

    await logMcpToolInvocation(auth, {
      toolName: 'update_user_settings',
      action: 'update',
      input: args,
      status: 'ok',
      durationMs: Date.now() - start,
    });
    return mcpJson({ updated: true, settings: data });
  } catch (err: any) {
    await logMcpToolInvocation(auth, {
      toolName: 'update_user_settings',
      action: 'update',
      input: args,
      status: 'error',
      errorMessage: err.message,
      durationMs: Date.now() - start,
    });
    return mcpError(`Failed to update settings: ${err.message}`);
  }
}
