/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  Category,
  CompletionStatus,
  Habit,
  HabitAnchorBlock,
  HabitCompletion,
  HabitFrequencyType,
  HabitPolarity,
  MoodLog,
  MoodType,
} from '@/lib/types';
import { bool, num, optNum, optStr, rowIdentity, rowTimestamps, str } from './row-utils';

export function mapHabitFromRow(r: Record<string, any>, fallbackDateIso?: string): Habit {
  const targetDaysPerWeek = num(r.target_days, 7);
  const defaultFreq = targetDaysPerWeek < 7 ? 'weekly_flexible' : 'daily';
  const timestamps = rowTimestamps(r, fallbackDateIso);

  return {
    ...rowIdentity(r),
    name: str(r.name),
    category: str(r.category, 'health') as Category,
    targetDaysPerWeek,
    frequencyType: str(r.frequency_type, defaultFreq) as HabitFrequencyType,
    scheduledDays: Array.isArray(r.scheduled_days) ? r.scheduled_days : undefined,
    intervalDays: optNum(r.interval_days),
    allowBonusCompletions: r.allow_bonus_completions ?? undefined,
    autoTrackRule: r.auto_track_rule ?? undefined,
    polarity: str(r.polarity, 'build') as HabitPolarity,
    anchorBlock: (r.anchor_block || undefined) as HabitAnchorBlock | undefined,
    isQuantitative: bool(r.is_quantitative),
    targetValue: optNum(r.target_value),
    unit: r.unit ?? undefined,
    metadata: r.metadata && typeof r.metadata === 'object' ? r.metadata : undefined,
    archived: bool(r.is_archived),
    order: num(r.order_index),
    icon: optStr(r.icon),
    generationCounter: timestamps.generationCounter,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  };
}

const VALID_COMPLETION_STATUSES = new Set<CompletionStatus>([
  'completed',
  'rest',
  'missed',
  'frozen',
]);

function isLegacyRestRow(r: Record<string, any>): boolean {
  if (r.skipped === true || Boolean(r.rest_reason)) return true;
  return /^rest day\b/i.test(str(r.notes));
}

export function resolveCompletionStatusFromRow(
  r: Record<string, any>
): CompletionStatus | undefined {
  if (VALID_COMPLETION_STATUSES.has(r.status as CompletionStatus)) {
    return r.status as CompletionStatus;
  }
  if (r.status === 'uncompleted') return undefined;
  if (isLegacyRestRow(r)) return 'rest';
  return r.completed === true ? 'completed' : undefined;
}

export function mapHabitCompletionFromRow(
  r: Record<string, any>,
  fallbackUserId = ''
): HabitCompletion {
  const resolvedStatus = resolveCompletionStatusFromRow(r);
  const isRest = resolvedStatus === 'rest';

  return {
    ...rowIdentity(r, fallbackUserId),
    habitId: str(r.habit_id),
    date: str(r.date),
    completed: resolvedStatus === 'completed' || (bool(r.completed) && !isRest),
    skipped: Boolean(r.skipped) || isRest || undefined,
    status: resolvedStatus,
    restReason: r.rest_reason || (isRest ? 'Low-Energy Day' : undefined),
    note: optStr(r.notes),
    value: optNum(r.value),
    createdAt: optStr(r.created_at),
    updatedAt: optStr(r.updated_at),
    generationCounter: num(r.generation_counter, 1),
  };
}

export function mapMoodLogFromRow(
  r: Record<string, any>,
  fallbackUserId = ''
): MoodLog {
  return {
    ...rowIdentity(r, fallbackUserId),
    date: str(r.date).slice(0, 10),
    mood: str(r.mood, 'neutral') as MoodType,
    createdAt: optStr(r.created_at),
    updatedAt: optStr(r.updated_at),
    generationCounter: num(r.generation_counter, 1),
  };
}
