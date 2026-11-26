import { db } from '@/lib/db';
import { clearAllLocalData } from '@/lib/cleanup';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { UserSettings } from '@/lib/types';

const REMOTE_USER_TABLES = [
  'completions',
  'milestones',
  'tasks',
  'mood_logs',
  'supplement_logs',
  'supplement_inventory',
  'workout_sessions',
  'meal_logs',
  'meal_templates',
  'fitness_daily_logs',
  'fitness_profiles',
  'finance_transactions',
  'finance_budgets',
  'monthly_commitments',
  'debt_installments',
  'debt_records',
  'emi_trackers',
  'finance_sip_plans',
  'finance_categorization_rules',
  'finance_recurring_bills',
  'finance_net_worth_snapshots',
  'credit_card_statements',
];

const REMOTE_PARENT_TABLES = ['habits', 'goals', 'finance_accounts', 'finance_categories'];

export function buildDefaultUserSettings(userId: string, userName = ''): UserSettings {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    userId,
    theme: 'system',
    accent: 'mint',
    userName,
    weekStartsOn: 0,
    showMotivationalQuotes: true,
    defaultCategory: 'health',
    createdAt: now,
    updatedAt: now,
    xp: 0,
    level: 1,
    gems: 0,
    streakShield: 0,
    avatarId: 'avatar-1',
    soundEnabled: true,
    hapticsEnabled: true,
    showTasks: true,
    showGoals: true,
    showMilestones: true,
    showFinance: true,
    showFitness: true,
    habitOnlyMode: false,
  };
}

export async function clearAllWorkspaceData(params: { userId: string; fullName?: string }) {
  const { getSyncEngine } = await import('@/lib/sync');
  getSyncEngine().reset();

  const supabase = getSupabaseClient();
  const uid = params.userId;
  await Promise.all(REMOTE_USER_TABLES.map((table) => supabase.from(table as never).delete().eq('user_id', uid)));
  await Promise.all(REMOTE_PARENT_TABLES.map((table) => supabase.from(table as never).delete().eq('user_id', uid)));

  await supabase.from('user_settings').update({
    user_name: params.fullName || 'Anonymous',
    avatar_id: 'avatar-1',
    week_start_day: 0,
    default_category: 'health',
    xp: 0,
    level: 1,
    gems: 0,
    streak_shield: 0,
    show_tasks: true,
    show_goals: true,
    show_milestones: true,
    show_finance: true,
    show_fitness: true,
    habit_only_mode: false,
    stats: { vitality: 1, intelligence: 1, discipline: 1, charisma: 1, wealth: 1, creativity: 1 },
    unlocked_themes: [],
    motivation_text: '',
    dashboard_layout: [],
    updated_at: new Date().toISOString(),
  } as never).eq('user_id', uid);

  await clearAllLocalData({ preserveTheme: true });
  try {
    const { useFitnessStore } = await import('@/lib/stores/fitness');
    useFitnessStore.getState().clearFitnessState();
  } catch {
    // non-blocking
  }

  const defaultSettings = {
    ...buildDefaultUserSettings(uid, params.fullName || 'Anonymous'),
    stats: { vitality: 1, intelligence: 1, discipline: 1, charisma: 1, wealth: 1, creativity: 1 },
    unlockedThemes: [],
    motivation_text: '',
    dashboardLayout: [],
  };
  await db.userSettings.add(defaultSettings as never);
}
