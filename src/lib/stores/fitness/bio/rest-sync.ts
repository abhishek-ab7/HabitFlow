import { clearRestCompletion, db, markRestCompletion } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { Habit, HabitCompletion } from '@/lib/types';

const EXERCISE_HABIT_PATTERN =
  /\b(workout|exercise|gym|training|lift|cardio|run|running|jog|cycling|swim|morning walk)\b/i;

function isWorkoutHabit(h: Habit): boolean {
  if (h.archived || h.polarity === 'quit') return false;
  if (h.autoTrackRule && h.autoTrackRule !== 'none') return h.autoTrackRule === 'workout_logged';
  return h.anchorBlock === 'gym' || EXERCISE_HABIT_PATTERN.test(h.name);
}

async function pushCompletionNonBlocking(comp: HabitCompletion) {
  try {
    const { getSyncEngine } = await import('@/lib/sync');
    await getSyncEngine().pushCompletion(comp);
  } catch {
    // Non-blocking in offline / isolated test env
  }
}

function isLowEnergyRestReason(reason?: string): boolean {
  return reason === 'Low-Energy Day' || reason === 'Low-Energy Mode';
}

async function updateHabitStoreCompletion(comp: HabitCompletion, habitId: string, targetDate: string) {
  const { useHabitStore } = await import('../../habit-store');
  useHabitStore.setState((state) => ({
    completions: [
      ...state.completions.filter((c) => !(c.habitId === habitId && c.date === targetDate)),
      comp,
    ],
  }));
}

async function enableRestForHabit(params: {
  habit: Habit;
  targetDate: string;
  userId: string;
  existingComp: HabitCompletion | undefined;
}): Promise<string | null> {
  const { habit, targetDate, userId, existingComp } = params;
  if (existingComp?.status === 'rest') {
    return isLowEnergyRestReason(existingComp.restReason) ? habit.id : null;
  }
  const restComp = await markRestCompletion(
    habit.id,
    targetDate,
    habit.userId || userId,
    'Low-Energy Day'
  );
  await updateHabitStoreCompletion(restComp, habit.id, targetDate);
  await pushCompletionNonBlocking(restComp);
  return habit.id;
}

function shouldClearRestComp(
  existingComp: HabitCompletion | undefined,
  habitId: string,
  existingRestedHabitIds?: string[]
): boolean {
  if (!existingComp) return false;
  if (existingComp.status !== 'rest' && !existingComp.skipped) return false;
  if (isLowEnergyRestReason(existingComp.restReason)) return true;
  return Boolean(existingRestedHabitIds?.includes(habitId));
}

async function disableRestForHabit(params: {
  habit: Habit;
  targetDate: string;
  userId: string;
  existingComp: HabitCompletion | undefined;
  existingRestedHabitIds?: string[];
}): Promise<void> {
  const { habit, targetDate, userId, existingComp, existingRestedHabitIds } = params;
  if (!shouldClearRestComp(existingComp, habit.id, existingRestedHabitIds)) return;

  const cleared = await clearRestCompletion(habit.id, targetDate, habit.userId || userId);
  await updateHabitStoreCompletion(cleared, habit.id, targetDate);
  await pushCompletionNonBlocking(cleared);
}

async function hydrateHabitStoreIfEmpty() {
  const { useHabitStore } = await import('../../habit-store');
  if (useHabitStore.getState().habits.length > 0) return useHabitStore;

  const [dexieHabits, dexieCompletions] = await Promise.all([
    db.habits.toArray(),
    db.completions.toArray(),
  ]);
  if (dexieHabits.length > 0) {
    useHabitStore.setState({ habits: dexieHabits, completions: dexieCompletions });
  }
  return useHabitStore;
}

async function processSingleWorkoutHabit(params: {
  habit: Habit;
  existingComp: HabitCompletion | undefined;
  targetDate: string;
  userId: string;
  nextEnabled: boolean;
  existingRestedHabitIds?: string[];
}): Promise<string | null> {
  const { habit, existingComp, targetDate, userId, nextEnabled, existingRestedHabitIds } = params;
  if (existingComp?.completed) return null;

  if (nextEnabled) {
    return enableRestForHabit({ habit, targetDate, userId, existingComp });
  }
  await disableRestForHabit({ habit, targetDate, userId, existingComp, existingRestedHabitIds });
  return null;
}

export async function syncWorkoutRestHabits(params: {
  targetDate: string;
  userId: string;
  nextEnabled: boolean;
  existingRestedHabitIds?: string[];
}): Promise<string[]> {
  const { targetDate, userId, nextEnabled, existingRestedHabitIds } = params;
  const restedHabitIds: string[] = [];

  try {
    const habitStore = await hydrateHabitStoreIfEmpty();
    const workoutHabits = habitStore.getState().habits.filter(isWorkoutHabit);

    for (const habit of workoutHabits) {
      const existingComp = habitStore
        .getState()
        .completions.find((c) => c.habitId === habit.id && c.date === targetDate);
      const restedId = await processSingleWorkoutHabit({
        habit,
        existingComp,
        targetDate,
        userId,
        nextEnabled,
        existingRestedHabitIds,
      });
      if (restedId) restedHabitIds.push(restedId);
    }
  } catch (err) {
    logger.warn('[FitnessStore] Low-energy habit rest sync skipped:', err);
  }

  return restedHabitIds;
}
