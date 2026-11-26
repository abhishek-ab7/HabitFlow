import { useHabitStore } from '../habit-store';
import type { Habit } from '../../types';
import { hydrateHabitsFromDexieIfEmpty, type MediatorAction } from './habit-dispatch';
import {
  isFitnessEnabled,
  loadFitnessEvalContext,
  type FitnessEvalContext,
} from './fitness-event-context';

export interface FitnessMediatorEvent {
  type: 'WORKOUT_LOGGED' | 'STEPS_UPDATED' | 'BIO_LOGGED' | 'MEAL_LOGGED' | 'SUPPLEMENTS_TAKEN';
  date: string;
  workoutType?: string;
  durationMinutes?: number;
  steps?: number;
  sleepHours?: number | null;
  isJunk?: boolean;
}

type DispatchFn = (action: MediatorAction) => Promise<void>;

const WORKOUT_NAME_RE =
  /\b(workout|exercise|gym|training|lift|cardio|run|running|jog|cycling|swim|morning walk)\b/i;

function evaluateWorkoutOutcome(habit: Habit): 'complete' | null {
  const rule = habit.autoTrackRule;
  if (rule === 'workout_logged') return 'complete';
  if ((!rule || rule === 'none') && WORKOUT_NAME_RE.test(habit.name)) return 'complete';
  return null;
}

function evaluateStepsOutcome(
  habit: Habit,
  event: FitnessMediatorEvent,
  ctx: FitnessEvalContext
): 'complete' | null {
  if (habit.autoTrackRule !== 'steps_target') return null;
  const target =
    habit.targetValue && habit.targetValue > 0
      ? Math.min(habit.targetValue, ctx.effectiveStepsTarget)
      : ctx.effectiveStepsTarget;
  return (event.steps || 0) >= target ? 'complete' : null;
}

function evaluateProteinOutcome(
  habit: Habit,
  ctx: FitnessEvalContext
): 'complete' | 'uncomplete' | null {
  const rule = habit.autoTrackRule;
  if (rule !== 'protein_target_met' && rule !== 'protein_target') return null;
  const target =
    habit.targetValue && habit.targetValue > 0 ? habit.targetValue : ctx.profileProteinTarget;
  return ctx.proteinTodayG >= target ? 'complete' : 'uncomplete';
}

function evaluateHabitOutcome(
  habit: Habit,
  event: FitnessMediatorEvent,
  ctx: FitnessEvalContext
): 'complete' | 'uncomplete' | null {
  if (event.type === 'WORKOUT_LOGGED') return evaluateWorkoutOutcome(habit);
  if (event.type === 'STEPS_UPDATED') return evaluateStepsOutcome(habit, event, ctx);
  if (event.type === 'MEAL_LOGGED') return evaluateProteinOutcome(habit, ctx);
  if (event.type === 'BIO_LOGGED' && habit.autoTrackRule === 'sleep_target') {
    return (event.sleepHours || 0) >= (habit.targetValue || 7) ? 'complete' : null;
  }
  if (event.type === 'SUPPLEMENTS_TAKEN' && habit.autoTrackRule === 'supplements_taken_today') {
    return ctx.allSupplementsTakenToday ? 'complete' : 'uncomplete';
  }
  return null;
}

function resolveActionType(
  outcome: 'complete' | 'uncomplete',
  alreadyDone: boolean
): 'HABIT_COMPLETED' | 'HABIT_UNCOMPLETED' | null {
  if (outcome === 'complete' && !alreadyDone) return 'HABIT_COMPLETED';
  if (outcome === 'uncomplete' && alreadyDone) return 'HABIT_UNCOMPLETED';
  return null;
}

async function dispatchOutcomeIfNeeded(params: {
  habit: Habit;
  normalizedDate: string;
  outcome: 'complete' | 'uncomplete';
  dispatch: DispatchFn;
}): Promise<void> {
  const { habit, normalizedDate, outcome, dispatch } = params;
  const alreadyDone = useHabitStore
    .getState()
    .completions.some(
      (c) => c.habitId === habit.id && c.date === normalizedDate && c.completed
    );

  const actionType = resolveActionType(outcome, alreadyDone);
  if (!actionType) return;

  await dispatch({
    type: actionType,
    payload: {
      habitId: habit.id,
      date: normalizedDate,
      difficulty: habit.difficulty || 'medium',
      category: habit.category || 'health',
    },
  });
}

export async function handleFitnessEventImpl(
  event: FitnessMediatorEvent,
  deps: {
    dispatch: DispatchFn;
    evaluateZeroJunk: (date?: string) => Promise<void>;
  }
): Promise<void> {
  const normalizedDate = event.date.slice(0, 10);
  if (!(await isFitnessEnabled())) return;

  await hydrateHabitsFromDexieIfEmpty();
  if (event.type === 'MEAL_LOGGED' || event.type === 'BIO_LOGGED') {
    await deps.evaluateZeroJunk(normalizedDate);
  }

  const ctx = await loadFitnessEvalContext(event.type, normalizedDate);
  const activeHabits = useHabitStore
    .getState()
    .habits.filter((h) => !h.archived && h.polarity !== 'quit');

  for (const habit of activeHabits) {
    const outcome = evaluateHabitOutcome(habit, event, ctx);
    if (!outcome) continue;
    await dispatchOutcomeIfNeeded({
      habit,
      normalizedDate,
      outcome,
      dispatch: deps.dispatch,
    });
  }
}
