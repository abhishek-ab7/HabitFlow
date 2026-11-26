/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Goal, Habit, HabitCompletion } from '@/lib/types';
import { upsertRowsWithColumnFallback } from '../engines/column-fallback';

function valOr<T>(value: unknown, fallback: T): T {
  return (value as T) || fallback;
}

export function buildOfflineHabitData(habit: Habit, userId: string): Record<string, any> {
  return {
    id: habit.id,
    user_id: userId,
    name: habit.name,
    icon: valOr(habit.icon, '✓'),
    category: habit.category,
    target_days: habit.targetDaysPerWeek,
    is_archived: habit.archived,
    order_index: habit.order,
    updated_at: new Date().toISOString(),
    is_quantitative: valOr(habit.isQuantitative, false),
    target_value: valOr(habit.targetValue, 0),
    unit: valOr(habit.unit, ''),
    frequency_type: valOr(habit.frequencyType, 'daily'),
    scheduled_days: valOr(habit.scheduledDays, null),
    interval_days: valOr(habit.intervalDays, null),
    auto_track_rule: valOr(habit.autoTrackRule, null),
    polarity: valOr(habit.polarity, 'build'),
    anchor_block: valOr(habit.anchorBlock, null),
    metadata: valOr(habit.metadata, {}),
  };
}

function resolveCompletionStatus(completion: HabitCompletion): string | null {
  if (completion.status) return completion.status;
  if (completion.skipped) return 'rest';
  return completion.completed ? 'completed' : null;
}

export function buildCompletionSyncData(completion: HabitCompletion, userId: string): Record<string, any> {
  return {
    id: completion.id,
    user_id: userId,
    habit_id: completion.habitId,
    date: completion.date,
    completed: completion.completed,
    status: resolveCompletionStatus(completion),
    skipped: completion.skipped ?? completion.status === 'rest',
    rest_reason: valOr(completion.restReason, null),
    notes: valOr(completion.note, null),
    value: valOr(completion.value, 0),
    generation_counter: valOr(completion.generationCounter, 1),
    updated_at: valOr(completion.updatedAt, new Date().toISOString()),
  };
}

export function buildOfflineGoalData(goal: Goal, userId: string): Record<string, any> {
  return {
    id: goal.id,
    user_id: userId,
    title: goal.title,
    description: valOr(goal.description, null),
    category: goal.areaOfLife,
    priority: goal.priority,
    status: goal.status,
    target_date: goal.deadline,
    is_focus: goal.isFocus,
    is_archived: goal.archived,
    financial_link: valOr(goal.financialLink, null),
    fitness_link: valOr(goal.fitnessLink, null),
    metadata: valOr(goal.metadata, {}),
    updated_at: new Date().toISOString(),
  };
}

export function buildOfflineSettingsData(settings: any, userId: string): Record<string, any> {
  return {
    user_id: userId,
    user_name: settings.userName,
    avatar_id: valOr(settings.avatarId, 'avatar-1'),
    week_start_day: settings.weekStartsOn,
    default_category: settings.defaultCategory,
    xp: settings.xp,
    level: settings.level,
    gems: settings.gems,
    streak_shield: settings.streakShield,
    motivation_text: settings.motivation_text,
    show_fitness: settings.showFitness ?? true,
    show_finance: settings.showFinance ?? true,
    show_tasks: settings.showTasks ?? true,
    show_goals: settings.showGoals ?? true,
    show_milestones: settings.showMilestones ?? true,
    habit_only_mode: settings.habitOnlyMode ?? false,
    updated_at: new Date().toISOString(),
  };
}

export async function executeRemoteOperation(
  supabase: any,
  op: { type: 'create' | 'update' | 'delete'; table: string; data: any }
): Promise<void> {
  if (op.type === 'delete') {
    const { error: delErr } = await supabase.from(op.table).delete().eq('id', op.data.id);
    if (delErr) throw delErr;
    return;
  }

  const options = op.table === 'completions' ? { onConflict: 'habit_id,date' } : undefined;
  const { error: upsertErr } = await upsertRowsWithColumnFallback(supabase, op.table, op.data, options);
  if (upsertErr) throw upsertErr;
}
