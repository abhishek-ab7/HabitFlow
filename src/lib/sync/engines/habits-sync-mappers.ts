import type { Habit, HabitCompletion } from '@/lib/types';

function mapHabitScheduleToRemote(h: Habit) {
  return {
    target_days: h.targetDaysPerWeek,
    frequency_type: h.frequencyType || (h.targetDaysPerWeek < 7 ? 'weekly_flexible' : 'daily'),
    scheduled_days: h.scheduledDays || null,
    interval_days: h.intervalDays || null,
    allow_bonus_completions: h.allowBonusCompletions ?? true,
    auto_track_rule: h.autoTrackRule || null,
    polarity: h.polarity || 'build',
    anchor_block: h.anchorBlock || null,
  };
}

export function mapHabitToLegacyRow(userId: string, h: Habit) {
  return {
    id: h.id,
    user_id: userId,
    name: h.name,
    icon: h.icon || '✓',
    category: h.category,
    target_days: h.targetDaysPerWeek,
    is_archived: h.archived,
    order_index: h.order,
    is_quantitative: h.isQuantitative || false,
    target_value: h.targetValue || 0,
    unit: h.unit || '',
    generation_counter: h.generationCounter || 1,
    updated_at: new Date().toISOString(),
  };
}

export function mapHabitToRemoteRow(userId: string, h: Habit) {
  return {
    ...mapHabitToLegacyRow(userId, h),
    ...mapHabitScheduleToRemote(h),
    metadata: h.metadata || null,
  };
}

function pickField<T>(remote: any, key: string, fallback: T): T {
  return Object.prototype.hasOwnProperty.call(remote, key) ? (remote[key] ?? undefined) : fallback;
}

function resolveScheduleExtras(remote: any, local: Habit | undefined) {
  return {
    scheduledDays: pickField(remote, 'scheduled_days', local?.scheduledDays),
    intervalDays: pickField(remote, 'interval_days', local?.intervalDays),
    allowBonusCompletions: remote.allow_bonus_completions ?? local?.allowBonusCompletions ?? true,
    autoTrackRule: pickField(remote, 'auto_track_rule', local?.autoTrackRule),
    polarity: pickField(remote, 'polarity', local?.polarity) ?? 'build',
    anchorBlock: pickField(remote, 'anchor_block', local?.anchorBlock),
  };
}

function mapRemoteHabitSchedule(remote: any, local: Habit | undefined) {
  const targetDays = remote.target_days ?? 7;
  const fallbackFreq = targetDays < 7 ? 'weekly_flexible' : 'daily';
  return {
    targetDaysPerWeek: targetDays,
    frequencyType: remote.frequency_type || local?.frequencyType || fallbackFreq,
    ...resolveScheduleExtras(remote, local),
  };
}

export function mapRemoteToLocalHabit(remote: any, local: Habit | undefined): Habit {
  return {
    id: remote.id,
    userId: remote.user_id,
    name: remote.name,
    icon: remote.icon,
    category: remote.category,
    ...mapRemoteHabitSchedule(remote, local),
    metadata: pickField(remote, 'metadata', local?.metadata),
    archived: remote.is_archived,
    order: remote.order_index,
    isQuantitative: remote.is_quantitative,
    targetValue: remote.target_value,
    unit: remote.unit,
    generationCounter: remote.generation_counter || 1,
    createdAt: remote.created_at || remote.updated_at || new Date().toISOString(),
    updatedAt: remote.updated_at,
    isDirty: false,
  };
}

export function mapCompletionToRemoteRow(userId: string, c: HabitCompletion) {
  const status = c.status || (c.skipped ? 'rest' : c.completed ? 'completed' : null);
  return {
    id: c.id,
    user_id: userId,
    habit_id: c.habitId,
    date: c.date,
    completed: c.completed,
    status,
    skipped: c.skipped ?? c.status === 'rest',
    rest_reason: c.restReason || null,
    notes: c.note || null,
    value: c.value || 0,
    generation_counter: c.generationCounter || 1,
    updated_at: new Date().toISOString(),
  };
}

function isRemoteRestCompletion(remote: any): boolean {
  if (remote.status === 'rest' || remote.skipped === true) return true;
  if (Boolean(remote.rest_reason)) return true;
  return /^rest day\b/i.test(String(remote.notes || ''));
}

function resolveCompletionRestFields(remote: any, local: HabitCompletion | undefined, isRest: boolean) {
  const defaultStatus = isRest ? 'rest' : remote.completed ? 'completed' : undefined;
  const rawRestReason = pickField(remote, 'rest_reason', local?.restReason);
  return {
    completed: isRest ? false : remote.completed,
    status: remote.status || defaultStatus,
    skipped: isRest,
    restReason: rawRestReason || (isRest ? 'Low-Energy Day' : undefined),
  };
}

export function mapRemoteToLocalCompletion(
  remote: any,
  local: HabitCompletion | undefined
): HabitCompletion {
  const isRest = isRemoteRestCompletion(remote);
  return {
    id: remote.id,
    userId: remote.user_id,
    habitId: remote.habit_id,
    date: remote.date,
    ...resolveCompletionRestFields(remote, local, isRest),
    note: remote.notes || undefined,
    value: remote.value || 0,
    generationCounter: remote.generation_counter || 1,
    updatedAt: remote.updated_at,
    isDirty: false,
  };
}
