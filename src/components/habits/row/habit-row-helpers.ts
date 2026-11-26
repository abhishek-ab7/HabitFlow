import type { Category, Habit, HabitCompletion } from '@/lib/types';
import { isHabitAutoRestOnDate } from '@/lib/calculations';

export interface HabitDayInfo {
  day: number;
  dateStr: string;
  dayOfWeek: number;
  dayLabel: string;
  isWeekend: boolean;
  isFuture: boolean;
  isToday: boolean;
}

export const CATEGORY_COLORS: Record<Category, string> = {
  health: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  work: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  learning: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  personal: 'bg-pink-500/20 text-pink-600 dark:text-pink-400',
  finance: 'bg-sky-500/20 text-sky-600 dark:text-sky-400',
  relationships: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
};

export function getStreakStyle(streak: number): string {
  if (streak >= 100) return 'bg-gradient-to-r from-amber-500 to-orange-500 text-white';
  if (streak >= 30) return 'bg-gradient-to-r from-orange-400 to-red-500 text-white';
  if (streak >= 7) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
  if (streak >= 3) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
  return '';
}

export interface CellStatusInfo {
  comp?: HabitCompletion;
  isCompleted: boolean;
  isFrozen: boolean;
  isRest: boolean;
  isAutoRest: boolean;
}

const NON_COMPLETION_STATUSES = new Set(['frozen', 'rest']);

function isCompletedRecord(comp?: HabitCompletion): boolean {
  if (!comp?.completed || comp.skipped) return false;
  return !NON_COMPLETION_STATUSES.has(comp.status || '');
}

export function getCellStatusInfo(params: {
  habit: Habit;
  completions: HabitCompletion[];
  comp?: HabitCompletion;
  dateStr: string;
}): CellStatusInfo {
  const { habit, completions, comp, dateStr } = params;
  const isCompleted = isCompletedRecord(comp);
  const isFrozen = comp?.status === 'frozen';
  const isRest = comp?.status === 'rest' || Boolean(comp?.skipped);
  const isInactive = !isCompleted && !isFrozen && !isRest;
  const isAutoRest = isInactive && isHabitAutoRestOnDate(habit, completions, dateStr);
  return { comp, isCompleted, isFrozen, isRest, isAutoRest };
}

export function getNextQuantitativeValue(params: {
  currentValue: number;
  target: number;
  isShiftKey: boolean;
}): number {
  const { currentValue, target, isShiftKey } = params;
  if (isShiftKey) return Math.max(0, currentValue - 1);
  return currentValue >= target ? 0 : currentValue + 1;
}

export function countMonthlyCompletions(completionMap: Map<string, HabitCompletion>): number {
  let count = 0;
  completionMap.forEach((c) => {
    if (c.completed && c.status !== 'frozen') count++;
  });
  return count;
}

const CELL_BG_RULES: Array<{ match: (p: { status: CellStatusInfo; isFutureDate: boolean; isTodayDate: boolean }) => boolean; cls: string }> = [
  { match: (p) => p.status.isCompleted, cls: 'bg-success/20 text-success hover:bg-success/30' },
  { match: (p) => p.status.isRest, cls: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30 hover:bg-teal-500/25' },
  { match: (p) => p.status.isFrozen, cls: 'bg-sky-500/20 text-sky-500 hover:bg-sky-500/30' },
  { match: (p) => p.status.isAutoRest, cls: 'bg-muted/20 text-muted-foreground/50 border border-dashed border-border/50' },
  { match: (p) => p.isFutureDate, cls: 'bg-muted/20 cursor-not-allowed opacity-40' },
  { match: (p) => p.isTodayDate, cls: 'bg-primary/10 border-2 border-dashed border-primary/40 hover:bg-primary/20' },
];

const DEFAULT_CELL_BG =
  'bg-muted/75 border border-border/70 hover:bg-muted dark:bg-muted/50 dark:border-border/60 dark:hover:bg-muted/70';

export function getCellBackgroundClass(params: {
  status: CellStatusInfo;
  isFutureDate: boolean;
  isTodayDate: boolean;
}): string {
  return CELL_BG_RULES.find((rule) => rule.match(params))?.cls ?? DEFAULT_CELL_BG;
}

export function getCellDataStatus(status: CellStatusInfo): string {
  if (status.isCompleted) return 'completed';
  if (status.isRest) return 'rest';
  if (status.isFrozen) return 'frozen';
  if (status.isAutoRest) return 'auto-rest';
  return 'pending';
}
