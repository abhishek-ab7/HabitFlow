import type {
  FinanceCategory,
  FinanceTransaction,
  FitnessDailyLog,
  Habit,
  HabitCompletion,
  MealLog,
  MoodLog,
  WorkoutSession,
} from '@/lib/types';
import { normalizeIsoDate } from '@/lib/finance/credit-card-cycles';
import {
  classifyTransactionDomain,
  isDateInRange,
  roundTo,
  type TriggerBucketStat,
  type TriggerPatternInsight,
} from '../insight-types';

function isWorkoutHabit(habit: Habit): boolean {
  const metaText = `${habit.name || ''} ${habit.category || ''}`;
  return (
    !habit.archived &&
    /\b(workout|gym|exercise|lift|lifting|strength|cardio|run|training|pushups?|walk)\b/i.test(metaText)
  );
}

function isHabitScheduledOnDate(habit: Habit, dateIso: string): boolean {
  const created = habit.createdAt ? normalizeIsoDate(habit.createdAt) : '';
  if (created && dateIso < created) return false;
  const hasSpecificDays = habit.frequencyType === 'specific_days' && Array.isArray(habit.scheduledDays);
  if (hasSpecificDays && habit.scheduledDays!.length > 0) {
    return habit.scheduledDays!.includes(new Date(`${dateIso}T00:00:00Z`).getUTCDay());
  }
  return (habit.targetDaysPerWeek ?? 7) >= 7;
}

function isMissedWorkoutCompletion(comp: HabitCompletion | undefined): boolean {
  if (!comp || comp.status === 'missed') return true;
  return !comp.completed && !comp.skipped && comp.status !== 'rest' && comp.status !== 'frozen';
}

function isLowSleep(sleepHours: unknown): boolean {
  return typeof sleepHours === 'number' && sleepHours > 0 && sleepHours < 6.5;
}

function isLowEnergy(energyLevel: unknown): boolean {
  return typeof energyLevel === 'number' && energyLevel > 0 && energyLevel <= 2;
}

function recordFitnessTriggerLog(params: {
  log: FitnessDailyLog;
  observedDates: Set<string>;
  lowSleepDates: Set<string>;
  lowEnergyDates: Set<string>;
  restedHabitsByDate: Map<string, Set<string>>;
}) {
  const { log, observedDates, lowSleepDates, lowEnergyDates, restedHabitsByDate } = params;
  const d = normalizeIsoDate(log.date);
  if (!d) return;
  observedDates.add(d);
  if (Array.isArray(log.restedHabitIds) && log.restedHabitIds.length > 0) {
    restedHabitsByDate.set(d, new Set(log.restedHabitIds));
  }
  if (isLowSleep(log.sleepHours)) lowSleepDates.add(d);
  if (isLowEnergy(log.energyLevel)) lowEnergyDates.add(d);
}

function collectFitnessAndMoodTriggers(
  fitnessLogs30d: FitnessDailyLog[],
  moodLogs30d: MoodLog[],
  observedDates: Set<string>
) {
  const lowSleepDates = new Set<string>();
  const lowEnergyDates = new Set<string>();
  const negativeMoodDates = new Set<string>();
  const restedHabitsByDate = new Map<string, Set<string>>();

  for (const log of fitnessLogs30d) {
    recordFitnessTriggerLog({ log, observedDates, lowSleepDates, lowEnergyDates, restedHabitsByDate });
  }
  for (const m of moodLogs30d) {
    const d = normalizeIsoDate(m.date);
    if (!d) continue;
    observedDates.add(d);
    if (m.mood === 'stressed' || m.mood === 'sad') negativeMoodDates.add(d);
  }

  return { lowSleepDates, lowEnergyDates, negativeMoodDates, restedHabitsByDate };
}

function indexWorkoutCompletions(params: {
  habitCompletions: HabitCompletion[];
  workoutHabitIdSet: Set<string>;
  observedDates: Set<string>;
  window30Start: string;
  todayDate: string;
}) {
  const completionsByHabitDate = new Map<string, HabitCompletion>();
  const missedWorkoutDates = new Set<string>();

  for (const c of params.habitCompletions) {
    if (!isDateInRange(c.date, params.window30Start, params.todayDate)) continue;
    const d = normalizeIsoDate(c.date);
    params.observedDates.add(d);
    completionsByHabitDate.set(`${c.habitId}|${d}`, c);
    if (params.workoutHabitIdSet.has(c.habitId) && c.status === 'missed') missedWorkoutDates.add(d);
  }
  return { completionsByHabitDate, missedWorkoutDates };
}

function hasMissedScheduledWorkout(
  d: string,
  workoutHabits: Habit[],
  restedHabitsByDate: Map<string, Set<string>>,
  completionsByHabitDate: Map<string, HabitCompletion>
): boolean {
  const restedSet = restedHabitsByDate.get(d);
  return workoutHabits.some(
    (habit) =>
      isHabitScheduledOnDate(habit, d) &&
      !restedSet?.has(habit.id) &&
      isMissedWorkoutCompletion(completionsByHabitDate.get(`${habit.id}|${d}`))
  );
}

function collectMissedWorkoutDates(params: {
  habits: Habit[];
  habitCompletions: HabitCompletion[];
  workouts30d: WorkoutSession[];
  restedHabitsByDate: Map<string, Set<string>>;
  observedDates: Set<string>;
  window30Start: string;
  todayDate: string;
}): Set<string> {
  const workoutHabits = params.habits.filter(isWorkoutHabit);
  const workoutHabitIdSet = new Set(workoutHabits.map((h) => h.id));
  const { completionsByHabitDate, missedWorkoutDates } = indexWorkoutCompletions({
    habitCompletions: params.habitCompletions,
    workoutHabitIdSet,
    observedDates: params.observedDates,
    window30Start: params.window30Start,
    todayDate: params.todayDate,
  });

  const workoutSessionDates = new Set(params.workouts30d.map((w) => normalizeIsoDate(w.date)));
  for (const d of params.observedDates) {
    if (d >= params.todayDate || workoutSessionDates.has(d)) continue;
    if (hasMissedScheduledWorkout(d, workoutHabits, params.restedHabitsByDate, completionsByHabitDate)) {
      missedWorkoutDates.add(d);
    }
  }
  return missedWorkoutDates;
}

function computeBucketStat(params: {
  key: TriggerBucketStat['key'];
  label: string;
  dateSet: Set<string>;
  observedDates: Set<string>;
  triggerSpendByDate: Map<string, number>;
}): TriggerBucketStat {
  const { key, label, dateSet, observedDates, triggerSpendByDate } = params;
  const triggerDaysCount = dateSet.size;
  let nonTriggerDaysCount = 0;
  let triggerTotal = 0;
  let nonTriggerTotal = 0;

  for (const d of observedDates) {
    const spend = triggerSpendByDate.get(d) || 0;
    if (dateSet.has(d)) triggerTotal += spend;
    else {
      nonTriggerDaysCount += 1;
      nonTriggerTotal += spend;
    }
  }

  const triggerAvgDailySpendInr = triggerDaysCount > 0 ? roundTo(triggerTotal / triggerDaysCount, 0) : 0;
  const baselineAvgDailySpendInr = nonTriggerDaysCount > 0 ? roundTo(nonTriggerTotal / nonTriggerDaysCount, 0) : 0;
  const spendMultiplier =
    triggerDaysCount > 0 && baselineAvgDailySpendInr > 0
      ? roundTo(triggerAvgDailySpendInr / baselineAvgDailySpendInr, 2)
      : null;

  return {
    key,
    label,
    triggerDaysCount,
    nonTriggerDaysCount,
    triggerAvgDailySpendInr,
    baselineAvgDailySpendInr,
    spendMultiplier,
    totalTriggerSpendInr: roundTo(triggerTotal, 0),
  };
}

function addObservedDates(observedDates: Set<string>, items: Array<{ date: string }>) {
  for (const item of items) {
    observedDates.add(normalizeIsoDate(item.date));
  }
}

function pickTopTriggerBucket(buckets: TriggerBucketStat[]): TriggerBucketStat | null {
  const active = buckets.filter((b) => b.triggerDaysCount > 0 && b.totalTriggerSpendInr > 0);
  if (active.length === 0) return null;
  active.sort((a, b) => (b.spendMultiplier ?? b.triggerAvgDailySpendInr) - (a.spendMultiplier ?? a.triggerAvgDailySpendInr));
  return active[0];
}

function computeNonTriggerSpendTotal(
  observedDates: Set<string>,
  anyTriggerDates: Set<string>,
  triggerSpendByDate: Map<string, number>
): number {
  let total = 0;
  for (const d of observedDates) {
    if (!anyTriggerDates.has(d)) total += triggerSpendByDate.get(d) ?? 0;
  }
  return roundTo(total, 0);
}

function buildTriggerSpendMap(
  expenses30d: FinanceTransaction[],
  catMap: Map<string, FinanceCategory>,
  observedDates: Set<string>
): Map<string, number> {
  const triggerSpendByDate = new Map<string, number>();
  for (const tx of expenses30d) {
    const d = normalizeIsoDate(tx.date);
    observedDates.add(d);
    const domain = classifyTransactionDomain(tx, catMap);
    if (domain.isJunkTx || domain.isIdkSpend) {
      triggerSpendByDate.set(d, (triggerSpendByDate.get(d) ?? 0) + Math.max(0, Number(tx.amount ?? 0)));
    }
  }
  return triggerSpendByDate;
}

function buildTriggerBuckets(params: {
  lowSleepDates: Set<string>;
  lowEnergyDates: Set<string>;
  missedWorkoutDates: Set<string>;
  negativeMoodDates: Set<string>;
  observedDates: Set<string>;
  triggerSpendByDate: Map<string, number>;
}): TriggerBucketStat[] {
  const { observedDates, triggerSpendByDate } = params;
  return [
    computeBucketStat({ key: 'low_sleep', label: 'Short Sleep (<6.5h)', dateSet: params.lowSleepDates, observedDates, triggerSpendByDate }),
    computeBucketStat({ key: 'low_energy', label: 'Low Energy (<=2/5)', dateSet: params.lowEnergyDates, observedDates, triggerSpendByDate }),
    computeBucketStat({ key: 'missed_workout', label: 'Missed Workout Habit', dateSet: params.missedWorkoutDates, observedDates, triggerSpendByDate }),
    computeBucketStat({ key: 'negative_mood', label: 'Stressed / Sad Mood', dateSet: params.negativeMoodDates, observedDates, triggerSpendByDate }),
  ];
}

function buildTriggerReport(params: {
  observedDates: Set<string>;
  anyTriggerDates: Set<string>;
  triggerSpendByDate: Map<string, number>;
  buckets: TriggerBucketStat[];
}): TriggerPatternInsight {
  const { observedDates, anyTriggerDates, triggerSpendByDate, buckets } = params;
  const overall = computeBucketStat({
    key: 'low_sleep',
    label: 'Any Trigger',
    dateSet: anyTriggerDates,
    observedDates,
    triggerSpendByDate,
  });
  const topBucket = pickTopTriggerBucket(buckets);

  return {
    observedDaysCount: observedDates.size,
    triggerDaysCount: anyTriggerDates.size,
    nonTriggerDaysCount: overall.nonTriggerDaysCount,
    totalTriggerJunkIdkSpend30dInr: overall.totalTriggerSpendInr,
    totalNonTriggerJunkIdkSpend30dInr: computeNonTriggerSpendTotal(observedDates, anyTriggerDates, triggerSpendByDate),
    triggerAvgDailySpendInr: overall.triggerAvgDailySpendInr,
    baselineAvgDailySpendInr: overall.baselineAvgDailySpendInr,
    overallSpendMultiplier: overall.spendMultiplier,
    topTrigger: topBucket?.key ?? null,
    topTriggerLabel: topBucket?.label ?? null,
    buckets,
  };
}

export function computeTriggerPatternInsight(params: {
  expenses30d: FinanceTransaction[];
  meals30d: MealLog[];
  workouts30d: WorkoutSession[];
  fitnessLogs30d: FitnessDailyLog[];
  moodLogs30d: MoodLog[];
  habits: Habit[];
  habitCompletions: HabitCompletion[];
  catMap: Map<string, FinanceCategory>;
  window30Start: string;
  todayDate: string;
}): TriggerPatternInsight {
  const observedDates = new Set<string>();
  const { lowSleepDates, lowEnergyDates, negativeMoodDates, restedHabitsByDate } = collectFitnessAndMoodTriggers(
    params.fitnessLogs30d,
    params.moodLogs30d,
    observedDates
  );
  addObservedDates(observedDates, params.meals30d);
  addObservedDates(observedDates, params.workouts30d);

  const triggerSpendByDate = buildTriggerSpendMap(params.expenses30d, params.catMap, observedDates);
  const missedWorkoutDates = collectMissedWorkoutDates({
    habits: params.habits,
    habitCompletions: params.habitCompletions,
    workouts30d: params.workouts30d,
    restedHabitsByDate,
    observedDates,
    window30Start: params.window30Start,
    todayDate: params.todayDate,
  });

  const anyTriggerDates = new Set([...lowSleepDates, ...lowEnergyDates, ...missedWorkoutDates, ...negativeMoodDates]);
  const buckets = buildTriggerBuckets({
    lowSleepDates,
    lowEnergyDates,
    missedWorkoutDates,
    negativeMoodDates,
    observedDates,
    triggerSpendByDate,
  });

  return buildTriggerReport({ observedDates, anyTriggerDates, triggerSpendByDate, buckets });
}
