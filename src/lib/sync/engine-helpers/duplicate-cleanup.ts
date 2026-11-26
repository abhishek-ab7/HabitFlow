/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, cleanupDuplicateGoals, cleanupDuplicateCompletions, cleanupDuplicateHabits } from '@/lib/db';
import { countAllDuplicates } from '@/lib/cleanup';
import type { Habit } from '@/lib/types';
import type { SyncLogFn } from './realtime-registrar';

export async function mergeDuplicateHabitRecord(
  keepHabit: Habit,
  deleteHabit: Habit,
  log: SyncLogFn
): Promise<void> {
  log('info', `Cleaning up duplicate habit: ${deleteHabit.name}`);

  const completions = await db.completions.where('habitId').equals(deleteHabit.id).toArray();
  for (const c of completions) {
    const exists = await db.completions
      .where('[habitId+date]')
      .equals([keepHabit.id, c.date])
      .first();
    if (!exists) {
      await db.completions.update(c.id, { habitId: keepHabit.id });
    } else {
      await db.completions.delete(c.id);
    }
  }

  await db.habits.delete(deleteHabit.id);
}

export async function cleanupLocalDuplicatesForUser(
  userId: string,
  log: SyncLogFn
): Promise<void> {
  try {
    const habits = await db.habits.where('userId').equals(userId).toArray();
    const habitKeys = new Map<string, Habit>();

    for (const habit of habits) {
      const key = `${habit.name.toLowerCase()}-${habit.category}`;
      const existing = habitKeys.get(key);
      if (!existing) {
        habitKeys.set(key, habit);
        continue;
      }

      const keepHabit = new Date(habit.createdAt) < new Date(existing.createdAt) ? habit : existing;
      const deleteHabit = keepHabit === habit ? existing : habit;
      await mergeDuplicateHabitRecord(keepHabit, deleteHabit, log);
      habitKeys.set(key, keepHabit);
    }

    await cleanupDuplicateGoals();
    await cleanupDuplicateCompletions();
  } catch (error) {
    log('error', 'Cleanup failed', error);
  }
}

export async function cleanupLocalDuplicatesWithReport(log: SyncLogFn): Promise<void> {
  try {
    const before = await countAllDuplicates();
    await cleanupDuplicateCompletions();
    await cleanupDuplicateGoals();
    await cleanupDuplicateHabits();
    await countAllDuplicates();

    const totalDuplicates = before.completions + before.habits + before.goals;
    if (totalDuplicates > 0) {
      log(
        'warn',
        `🧹 Cleaned duplicates: ${before.completions} completions, ${before.habits} habits, ${before.goals} goals`
      );
    }
  } catch (error) {
    log('error', 'Cleanup with logging failed', error);
  }
}
