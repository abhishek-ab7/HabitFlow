import { useHabitStore } from '../habit-store';
import type { Habit } from '../../types';
import { hydrateHabitsFromDexieIfEmpty, type MediatorAction } from './habit-dispatch';
import {
  checkFinanceJunkExpense,
  checkFitnessJunkStatus,
  type IsoDate,
} from './zero-junk-sources';

type DispatchFn = (action: MediatorAction) => Promise<void>;

function isZeroJunkHabitDone(habitId: string, date: IsoDate): boolean {
  return useHabitStore
    .getState()
    .completions.some(
      (c) =>
        c.habitId === habitId &&
        c.date === date &&
        c.completed &&
        c.status !== 'frozen' &&
        c.status !== 'rest' &&
        !c.skipped
    );
}

function resolveZeroJunkAction(params: {
  isPastDay: boolean;
  hasJunkToday: boolean;
  isDone: boolean;
}): 'HABIT_COMPLETED' | 'HABIT_UNCOMPLETED' | null {
  if (params.hasJunkToday && params.isDone) return 'HABIT_UNCOMPLETED';
  if (params.isPastDay && !params.hasJunkToday && !params.isDone) return 'HABIT_COMPLETED';
  return null;
}

async function syncZeroJunkHabit(params: {
  habit: Habit;
  date: IsoDate;
  isPastDay: boolean;
  hasJunkToday: boolean;
  dispatch: DispatchFn;
}): Promise<void> {
  const { habit, date, isPastDay, hasJunkToday, dispatch } = params;
  const isDone = isZeroJunkHabitDone(habit.id, date);
  const actionType = resolveZeroJunkAction({ isPastDay, hasJunkToday, isDone });
  if (!actionType) return;

  await dispatch({
    type: actionType,
    payload: {
      habitId: habit.id,
      date,
      difficulty: habit.difficulty || 'medium',
      category: habit.category || 'health',
    },
  });
}

async function evaluateDateForZeroJunk(params: {
  date: IsoDate;
  todayStr: IsoDate;
  habits: Habit[];
  dispatch: DispatchFn;
}): Promise<void> {
  const { date, todayStr, habits, dispatch } = params;
  const [{ junkFreeOverride, hasJunkMeal }, hasJunkExpense] = await Promise.all([
    checkFitnessJunkStatus(date),
    checkFinanceJunkExpense(date),
  ]);
  const hasJunkToday = !junkFreeOverride && (hasJunkMeal || hasJunkExpense);
  const isPastDay = date < todayStr;

  for (const habit of habits) {
    await syncZeroJunkHabit({ habit, date, isPastDay, hasJunkToday, dispatch });
  }
}

export async function evaluateZeroJunkRulesImpl(
  dispatch: DispatchFn,
  targetDate?: IsoDate
): Promise<void> {
  const { getLocalIsoDate } = await import('@/lib/finance/credit-card-cycles');
  await hydrateHabitsFromDexieIfEmpty();

  const zeroJunkHabits = useHabitStore
    .getState()
    .habits.filter(
      (h) =>
        !h.archived &&
        (h.autoTrackRule === 'zero_junk_today' || h.autoTrackRule === 'no_junk_food')
    );
  if (zeroJunkHabits.length === 0) return;

  const todayStr = getLocalIsoDate();
  const datesToEvaluate = targetDate ? [targetDate.slice(0, 10)] : [todayStr];

  for (const date of datesToEvaluate) {
    await evaluateDateForZeroJunk({ date, todayStr, habits: zeroJunkHabits, dispatch });
  }
}
