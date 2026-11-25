import { db } from './db';

/**
 * All 27 Dexie table names across Core, Finance, and Fitness domains.
 */
export const ALL_DEXIE_TABLE_NAMES = [
  // Core (7)
  'habits',
  'completions',
  'goals',
  'milestones',
  'userSettings',
  'tasks',
  'moodLogs',
  // Finance (13)
  'financeCategories',
  'financeAccounts',
  'financeTransactions',
  'financeBudgets',
  'monthlyCommitments',
  'debtRecords',
  'debtInstallments',
  'emiTrackers',
  'financeSipPlans',
  'financeCategorizationRules',
  'financeRecurringBills',
  'financeNetWorthSnapshots',
  'creditCardStatements',
  // Fitness (7)
  'fitnessProfiles',
  'fitnessDailyLogs',
  'mealTemplates',
  'mealLogs',
  'workoutSessions',
  'supplementInventory',
  'supplementLogs',
] as const;

const LOCAL_STORAGE_PREFIXES = [
  'habitflow_',
  'focus_mode_',
  'sync_version_',
  'habit_sync_',
  'flowfinance_fresh_start_',
  'hf_fitness_staples_seeded_',
  'ai_coach_advice_',
];

const LOCAL_STORAGE_EXACT_KEYS = ['feedback_settings', 'habit_sync_pending'];

/**
 * Clear all local Dexie tables (all 27 tables) and HabitFlow localStorage keys.
 */
export async function clearAllLocalData(options?: { preserveTheme?: boolean }): Promise<void> {
  const clearOps: Promise<void>[] = [];
  for (const tableName of ALL_DEXIE_TABLE_NAMES) {
    const table = (db as unknown as Record<string, { clear?: () => Promise<void> }>)[tableName];
    if (table && typeof table.clear === 'function') {
      clearOps.push(table.clear());
    }
  }
  await Promise.all(clearOps);

  if (typeof localStorage !== 'undefined') {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        LOCAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix)) ||
        LOCAL_STORAGE_EXACT_KEYS.includes(key) ||
        (!options?.preserveTheme && key === 'theme')
      ) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  }
}

async function countDuplicatesBy<T>(rows: T[], getKey: (row: T) => string): Promise<number> {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const row of rows) {
    const key = getKey(row);
    if (seen.has(key)) {
      duplicates++;
    } else {
      seen.add(key);
    }
  }
  return duplicates;
}

/**
 * Clean up duplicate habit completions (same habitId + date).
 */
export async function cleanupDuplicateCompletions(): Promise<number> {
  const allCompletions = await db.completions.toArray();
  const seen = new Map<string, string>();
  const duplicateIds: string[] = [];

  for (const completion of allCompletions) {
    const key = `${completion.habitId}-${completion.date}`;
    if (seen.has(key)) {
      duplicateIds.push(completion.id);
    } else {
      seen.set(key, completion.id);
    }
  }

  if (duplicateIds.length > 0) {
    await db.completions.bulkDelete(duplicateIds);
  }

  return duplicateIds.length;
}

/**
 * Get count of duplicate completions without removing them.
 */
export async function countDuplicateCompletions(): Promise<number> {
  const allCompletions = await db.completions.toArray();
  return countDuplicatesBy(allCompletions, (c) => `${c.habitId}-${c.date}`);
}

/**
 * Clean up duplicate habits (same name + category) and re-parent completions.
 */
export async function cleanupDuplicateHabits(): Promise<number> {
  const allHabits = await db.habits.toArray();
  const habitMap = new Map<string, typeof allHabits>();

  for (const habit of allHabits) {
    const key = `${habit.name}-${habit.category}`;
    const list = habitMap.get(key);
    if (list) list.push(habit);
    else habitMap.set(key, [habit]);
  }

  const duplicateHabitIds: string[] = [];
  const completionUpdates: Array<{ id: string; habitId: string }> = [];
  const completionDeletes: string[] = [];

  for (const habits of habitMap.values()) {
    if (habits.length <= 1) continue;
    const sorted = [...habits].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const [keep, ...duplicates] = sorted;
    const keepCompletions = await db.completions.where('habitId').equals(keep.id).toArray();
    const keepDates = new Set(keepCompletions.map((c) => c.date));

    for (const duplicate of duplicates) {
      duplicateHabitIds.push(duplicate.id);
      const dupCompletions = await db.completions.where('habitId').equals(duplicate.id).toArray();
      for (const completion of dupCompletions) {
        if (!keepDates.has(completion.date)) {
          keepDates.add(completion.date);
          completionUpdates.push({ id: completion.id, habitId: keep.id });
        } else {
          completionDeletes.push(completion.id);
        }
      }
    }
  }

  if (duplicateHabitIds.length > 0 || completionUpdates.length > 0 || completionDeletes.length > 0) {
    await db.transaction('rw', [db.habits, db.completions], async () => {
      for (const upd of completionUpdates) {
        await db.completions.update(upd.id, { habitId: upd.habitId });
      }
      if (completionDeletes.length > 0) {
        await db.completions.bulkDelete(completionDeletes);
      }
      if (duplicateHabitIds.length > 0) {
        await db.habits.bulkDelete(duplicateHabitIds);
      }
    });
  }

  return duplicateHabitIds.length;
}

/**
 * Count duplicate habits without removing them.
 */
export async function countDuplicateHabits(): Promise<number> {
  const allHabits = await db.habits.toArray();
  return countDuplicatesBy(allHabits, (h) => `${h.name}-${h.category}`);
}

/**
 * Clean up duplicate goals (same title, case-insensitive) and re-parent milestones.
 */
export async function cleanupDuplicateGoals(): Promise<number> {
  const allGoals = await db.goals.toArray();
  const goalMap = new Map<string, typeof allGoals>();

  for (const goal of allGoals) {
    const key = goal.title.toLowerCase();
    const list = goalMap.get(key);
    if (list) list.push(goal);
    else goalMap.set(key, [goal]);
  }

  const duplicateGoalIds: string[] = [];
  const milestoneUpdates: Array<{ id: string; goalId: string }> = [];

  for (const goals of goalMap.values()) {
    if (goals.length <= 1) continue;
    const sorted = [...goals].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const [keep, ...duplicates] = sorted;

    for (const duplicate of duplicates) {
      duplicateGoalIds.push(duplicate.id);
      const milestones = await db.milestones.where('goalId').equals(duplicate.id).toArray();
      for (const milestone of milestones) {
        milestoneUpdates.push({ id: milestone.id, goalId: keep.id });
      }
    }
  }

  if (duplicateGoalIds.length > 0 || milestoneUpdates.length > 0) {
    await db.transaction('rw', [db.goals, db.milestones], async () => {
      for (const upd of milestoneUpdates) {
        await db.milestones.update(upd.id, { goalId: upd.goalId });
      }
      if (duplicateGoalIds.length > 0) {
        await db.goals.bulkDelete(duplicateGoalIds);
      }
    });
  }

  return duplicateGoalIds.length;
}

/**
 * Count duplicate goals without removing them.
 */
export async function countDuplicateGoals(): Promise<number> {
  const allGoals = await db.goals.toArray();
  return countDuplicatesBy(allGoals, (g) => g.title.toLowerCase());
}

/**
 * Clean all duplicates at once.
 */
export async function cleanupAllDuplicates(): Promise<{
  habits: number;
  goals: number;
  completions: number;
}> {
  const [habits, goals, completions] = await Promise.all([
    cleanupDuplicateHabits(),
    cleanupDuplicateGoals(),
    cleanupDuplicateCompletions(),
  ]);
  return { habits, goals, completions };
}

/**
 * Count all duplicates.
 */
export async function countAllDuplicates(): Promise<{
  habits: number;
  goals: number;
  completions: number;
}> {
  const [habits, goals, completions] = await Promise.all([
    countDuplicateHabits(),
    countDuplicateGoals(),
    countDuplicateCompletions(),
  ]);
  return { habits, goals, completions };
}
