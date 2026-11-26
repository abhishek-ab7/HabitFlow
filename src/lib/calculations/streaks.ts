import { differenceInDays, endOfWeek, getDay, parseISO, startOfWeek, subDays } from 'date-fns';
import type { Habit, HabitCompletion, HabitFrequencyType } from '../types';
import {
  formatDate,
  getEffectiveTargetDaysPerWeek,
  getHabitFrequencyType,
  isCountableCompletion,
  isExplicitRestCompletion,
  isHabitAutoRestOnDate,
} from './date-and-schedule';

function isWeekStillAchievable(params: {
  wEndObj: Date;
  today: Date;
  completedCount: number;
  frozenCount: number;
  target: number;
}): boolean {
  const { wEndObj, today, completedCount, frozenCount, target } = params;
  const daysRemaining = Math.max(0, differenceInDays(wEndObj, today) + (completedCount > 0 ? 0 : 1));
  return completedCount + frozenCount + daysRemaining >= target;
}

export function calculateWeeklyStreak(
  habit: Habit,
  completions: HabitCompletion[],
  today: Date = new Date()
): number {
  const habitComps = completions.filter((c) => c.habitId === habit.id || !c.habitId);
  if (habitComps.length === 0) return 0;

  const weekStartsOn = habit.weekStartsOn ?? 1;
  const target = getEffectiveTargetDaysPerWeek(habit);
  let currentWeekStart = startOfWeek(today, { weekStartsOn });
  let weeklyStreak = 0;

  for (let w = 0; w < 52; w++) {
    const wStartStr = formatDate(currentWeekStart);
    const wEndObj = endOfWeek(currentWeekStart, { weekStartsOn });
    const weekComps = habitComps.filter((c) => c.date >= wStartStr && c.date <= formatDate(wEndObj));
    const completedCount = weekComps.filter(isCountableCompletion).length;
    const frozenCount = weekComps.filter((c) => c.status === 'frozen').length;

    if (completedCount + frozenCount >= target) {
      weeklyStreak++;
      currentWeekStart = subDays(currentWeekStart, 7);
      continue;
    }
    if (w === 0 && isWeekStillAchievable({ wEndObj, today, completedCount, frozenCount, target })) {
      currentWeekStart = subDays(currentWeekStart, 7);
      continue;
    }
    break;
  }

  return weeklyStreak;
}

function isFrozenOrRest(comp: HabitCompletion | undefined): boolean {
  return Boolean(comp && (comp.status === 'frozen' || isExplicitRestCompletion(comp)));
}

function isDailyStreakEntry(c: HabitCompletion): boolean {
  return Boolean(c.completed || isFrozenOrRest(c));
}

function walkDailyStreakBackwards(completionsMap: Map<string, HabitCompletion>, startDate: Date): number {
  let streak = 0;
  let currentDate = startDate;
  for (let i = 0; i < 365; i++) {
    const comp = completionsMap.get(formatDate(currentDate));
    if (!comp) break;
    if (isCountableCompletion(comp)) streak++;
    currentDate = subDays(currentDate, 1);
  }
  return streak;
}

function buildDailyCompletionsMap(completions: HabitCompletion[]): Map<string, HabitCompletion> {
  const map = new Map<string, HabitCompletion>();
  for (const c of completions) {
    if (isDailyStreakEntry(c)) map.set(c.date, c);
  }
  return map;
}

function calculateDailyCurrentStreak(completions: HabitCompletion[], today: Date): number {
  const completionsMap = buildDailyCompletionsMap(completions);
  if (completionsMap.size === 0) return 0;

  const todayStr = formatDate(today);
  const yesterday = subDays(today, 1);
  if (completionsMap.has(todayStr)) return walkDailyStreakBackwards(completionsMap, today);
  if (completionsMap.has(formatDate(yesterday))) return walkDailyStreakBackwards(completionsMap, yesterday);
  return 0;
}

function resolveFloorDateStr(completions: HabitCompletion[], habit: Habit, today: Date): string {
  const earliest = completions.reduce((min, c) => (c.date < min ? c.date : min), formatDate(today));
  const created = habit.createdAt ? formatDate(habit.createdAt) : earliest;
  return earliest < created ? earliest : created;
}

function canUseWeeklyFlexibleOffDay(
  currentDate: Date,
  weekStartsOn: 0 | 1,
  weekOffDaysUsed: Map<string, number>,
  allowedOffDaysPerWeek: number
): boolean {
  const wkStart = formatDate(startOfWeek(currentDate, { weekStartsOn }));
  const used = weekOffDaysUsed.get(wkStart) || 0;
  if (used >= allowedOffDaysPerWeek) return false;
  weekOffDaysUsed.set(wkStart, used + 1);
  return true;
}

function isSpecificDayScheduled(habit: Habit, currentDate: Date): boolean {
  const dow = getDay(currentDate);
  return !habit.scheduledDays || habit.scheduledDays.length === 0 || habit.scheduledDays.includes(dow);
}

function canSkipScheduledOrFlexibleOffDay(params: {
  freq: HabitFrequencyType;
  habit: Habit;
  currentDate: Date;
  dateStr: string;
  isExplicitRest: boolean;
  weekOffDaysUsed: Map<string, number>;
  allowedOffDaysPerWeek: number;
  completions?: HabitCompletion[];
}): boolean {
  const { freq, habit, currentDate, dateStr, isExplicitRest, weekOffDaysUsed, allowedOffDaysPerWeek, completions } =
    params;
  if (isExplicitRest) return true;
  if (freq === 'specific_days') return !isSpecificDayScheduled(habit, currentDate);
  if (freq === 'interval') return Boolean(completions && isHabitAutoRestOnDate(habit, completions, dateStr));
  if (freq === 'weekly_flexible') {
    return canUseWeeklyFlexibleOffDay(currentDate, habit.weekStartsOn ?? 1, weekOffDaysUsed, allowedOffDaysPerWeek);
  }
  return false;
}

function canSkipGapDay(params: {
  isFrozen: boolean;
  freq: HabitFrequencyType;
  habit: Habit;
  currentDate: Date;
  dateStr: string;
  isExplicitRest: boolean;
  weekOffDaysUsed: Map<string, number>;
  allowedOffDaysPerWeek: number;
  completions?: HabitCompletion[];
}): boolean {
  if (params.isFrozen) return true;
  return canSkipScheduledOrFlexibleOffDay(params);
}

export function calculateCurrentStreak(
  completions: HabitCompletion[],
  today: Date = new Date(),
  habit?: Habit
): number {
  if (completions.length === 0) return 0;
  const freq = getHabitFrequencyType(habit);
  if (!habit || freq === 'daily') return calculateDailyCurrentStreak(completions, today);
  if (!completions.some(isCountableCompletion)) return 0;

  const completionsMap = new Map(completions.map((c) => [c.date, c]));
  const floorDateStr = resolveFloorDateStr(completions, habit, today);
  const allowedOffDaysPerWeek = Math.max(0, 7 - getEffectiveTargetDaysPerWeek(habit));
  const weekOffDaysUsed = new Map<string, number>();

  const todayComp = completionsMap.get(formatDate(today));
  let currentDate = todayComp && isDailyStreakEntry(todayComp) ? today : subDays(today, 1);
  let streak = 0;

  for (let i = 0; i < 365; i++) {
    const dateStr = formatDate(currentDate);
    if (dateStr < floorDateStr && streak > 0) break;

    const comp = completionsMap.get(dateStr);
    if (comp && isCountableCompletion(comp)) {
      streak++;
      currentDate = subDays(currentDate, 1);
      continue;
    }
    const skippable = canSkipGapDay({
      isFrozen: comp?.status === 'frozen',
      freq,
      habit,
      currentDate,
      dateStr,
      isExplicitRest: Boolean(comp && isExplicitRestCompletion(comp)),
      weekOffDaysUsed,
      allowedOffDaysPerWeek,
      completions,
    });
    if (!skippable) break;
    currentDate = subDays(currentDate, 1);
  }
  return streak;
}

function stepDailyBestStreak(
  current: HabitCompletion,
  prevDateStr: string,
  state: { currentStreak: number; bestStreak: number }
) {
  const diff = differenceInDays(parseISO(current.date), parseISO(prevDateStr));
  const countable = isCountableCompletion(current);
  if (diff === 1) {
    if (countable) state.currentStreak++;
    state.bestStreak = Math.max(state.bestStreak, state.currentStreak);
  } else if (diff > 1) {
    state.currentStreak = countable ? 1 : 0;
    state.bestStreak = Math.max(state.bestStreak, state.currentStreak);
  }
}

function calculateDailyBestStreak(completions: HabitCompletion[]): number {
  const sorted = [...completions].filter(isDailyStreakEntry).sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return 0;

  const initial = isCountableCompletion(sorted[0]) ? 1 : 0;
  const state = { currentStreak: initial, bestStreak: initial };
  for (let i = 1; i < sorted.length; i++) {
    stepDailyBestStreak(sorted[i], sorted[i - 1].date, state);
  }
  return state.bestStreak;
}

function isIntervalGapBridged(params: {
  startDateStr: string;
  endDateStr: string;
  interval: number;
  frozenDatesSet: Set<string>;
  restDatesSet: Set<string>;
}): boolean {
  let cursor = parseISO(params.startDateStr);
  const targetEnd = parseISO(params.endDateStr);
  let daysSinceDone = 0;
  while (differenceInDays(targetEnd, cursor) > 1) {
    cursor = subDays(cursor, -1);
    const dStr = formatDate(cursor);
    daysSinceDone++;
    if (params.frozenDatesSet.has(dStr) || params.restDatesSet.has(dStr)) daysSinceDone = 0;
    else if (daysSinceDone >= params.interval) return false;
  }
  return true;
}

function calculateIntervalBestStreak(
  sortedCompleted: string[],
  interval: number,
  frozenDatesSet: Set<string>,
  restDatesSet: Set<string>
): number {
  let best = 1;
  let run = 1;
  for (let i = 1; i < sortedCompleted.length; i++) {
    const startDateStr = sortedCompleted[i - 1];
    const endDateStr = sortedCompleted[i];
    const diff = differenceInDays(parseISO(endDateStr), parseISO(startDateStr));
    const bridged =
      diff <= interval || isIntervalGapBridged({ startDateStr, endDateStr, interval, frozenDatesSet, restDatesSet });
    run = bridged ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

function buildBestStreakDateSets(completions: HabitCompletion[]) {
  const completedDatesSet = new Set<string>();
  const frozenDatesSet = new Set<string>();
  const restDatesSet = new Set<string>();
  for (const c of completions) {
    if (c.status === 'frozen') frozenDatesSet.add(c.date);
    else if (isExplicitRestCompletion(c)) restDatesSet.add(c.date);
    else if (c.completed) completedDatesSet.add(c.date);
  }
  return { completedDatesSet, frozenDatesSet, restDatesSet };
}

function walkSpanBestStreak(params: {
  habit: Habit;
  freq: HabitFrequencyType;
  sortedCompleted: string[];
  completedDatesSet: Set<string>;
  frozenDatesSet: Set<string>;
  restDatesSet: Set<string>;
}): number {
  const { habit, freq, sortedCompleted, completedDatesSet, frozenDatesSet, restDatesSet } = params;
  const earliest = parseISO(sortedCompleted[0]);
  const latest = parseISO(sortedCompleted[sortedCompleted.length - 1]);
  const totalSpanDays = Math.min(1825, Math.max(0, differenceInDays(latest, earliest)));
  const allowedOffDaysPerWeek = Math.max(0, 7 - getEffectiveTargetDaysPerWeek(habit));
  const weekOffDaysUsed = new Map<string, number>();

  let best = 0;
  let run = 0;
  for (let offset = 0; offset <= totalSpanDays; offset++) {
    const currentDate = subDays(latest, totalSpanDays - offset);
    const dateStr = formatDate(currentDate);
    if (completedDatesSet.has(dateStr)) {
      run++;
      if (run > best) best = run;
      continue;
    }
    const skippable = canSkipGapDay({
      isFrozen: frozenDatesSet.has(dateStr),
      freq,
      habit,
      currentDate,
      dateStr,
      isExplicitRest: restDatesSet.has(dateStr),
      weekOffDaysUsed,
      allowedOffDaysPerWeek,
    });
    if (!skippable) run = 0;
  }
  return best;
}

export function calculateBestStreak(completions: HabitCompletion[], habit?: Habit): number {
  if (completions.length === 0) return 0;
  const freq = getHabitFrequencyType(habit);
  if (!habit || freq === 'daily') return calculateDailyBestStreak(completions);

  const { completedDatesSet, frozenDatesSet, restDatesSet } = buildBestStreakDateSets(completions);
  if (completedDatesSet.size === 0) return 0;

  const sortedCompleted = Array.from(completedDatesSet).sort();
  if (freq === 'interval') {
    return calculateIntervalBestStreak(sortedCompleted, Math.max(1, habit.intervalDays || 2), frozenDatesSet, restDatesSet);
  }

  return walkSpanBestStreak({
    habit,
    freq,
    sortedCompleted,
    completedDatesSet,
    frozenDatesSet,
    restDatesSet,
  });
}
