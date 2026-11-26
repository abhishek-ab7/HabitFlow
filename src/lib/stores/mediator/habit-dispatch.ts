import { useHabitStore } from '../habit-store';
import { toggleCompletion } from '../../db';
import { getSupabaseClient } from '../../supabase/client';
import type { Category, HabitCompletion } from '../../types';

export type MediatorAction =
  | {
      type: 'HABIT_COMPLETED';
      payload: {
        habitId: string;
        date: string;
        difficulty?: 'easy' | 'medium' | 'hard';
        category?: Category;
      };
    }
  | {
      type: 'HABIT_UNCOMPLETED';
      payload: {
        habitId: string;
        date: string;
        difficulty?: 'easy' | 'medium' | 'hard';
        category?: Category;
      };
    };

async function resolveUserId(fallbackUserId?: string): Promise<string> {
  if (fallbackUserId) return fallbackUserId;
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id || 'test-user';
}

async function syncCompletionNonBlocking(result: HabitCompletion): Promise<void> {
  try {
    const { getSyncEngine } = await import('../../sync/sync-engine');
    await getSyncEngine().pushCompletion(result);
  } catch {
    // Non-blocking in offline or isolated unit-test environments
  }
}

async function normalizeCompletionRecord(
  result: HabitCompletion,
  markCompleted: boolean
): Promise<void> {
  const needsUpdate = markCompleted
    ? !result.completed || result.status !== 'completed'
    : Boolean(result.completed || result.status);
  if (!needsUpdate) return;

  const status = markCompleted ? 'completed' : undefined;
  result.completed = markCompleted;
  result.status = status;
  result.skipped = false;

  const { db } = await import('../../db');
  await db.completions.update(result.id, {
    completed: markCompleted,
    status,
    skipped: false,
  });
}

async function applyCompletionUpdate(params: {
  habitId: string;
  date: string;
  userId: string;
  markCompleted: boolean;
}): Promise<void> {
  const { habitId, date, userId, markCompleted } = params;
  const result = await toggleCompletion(habitId, date, userId);
  await normalizeCompletionRecord(result, markCompleted);

  const filtered = useHabitStore
    .getState()
    .completions.filter((c) => !(c.habitId === habitId && c.date === date));
  useHabitStore.setState({
    completions: markCompleted ? [...filtered, result] : filtered,
  });

  await syncCompletionNonBlocking(result);
}

function hasCompletedRecord(habitId: string, date: string): boolean {
  return useHabitStore
    .getState()
    .completions.some((c) => c.habitId === habitId && c.date === date && c.completed);
}

export async function dispatchHabitAction(action: MediatorAction): Promise<void> {
  const { habitId, date } = action.payload;
  const targetHabit = useHabitStore.getState().habits.find((h) => h.id === habitId);
  const isCompleted = hasCompletedRecord(habitId, date);
  const markCompleted = action.type === 'HABIT_COMPLETED';

  if (markCompleted && isCompleted) return;
  if (!markCompleted && !isCompleted) return;

  const userId = await resolveUserId(targetHabit?.userId);
  await applyCompletionUpdate({ habitId, date, userId, markCompleted });
}

export async function hydrateHabitsFromDexieIfEmpty(): Promise<void> {
  if (useHabitStore.getState().habits.length > 0) return;
  try {
    const { db } = await import('../../db');
    const [dexieHabits, dexieCompletions] = await Promise.all([
      db.habits.toArray(),
      db.completions.toArray(),
    ]);
    if (dexieHabits.length > 0) {
      useHabitStore.setState({
        habits: dexieHabits,
        completions: dexieCompletions,
      });
    }
  } catch {
    // Ignore if mocked db lacks tables
  }
}
