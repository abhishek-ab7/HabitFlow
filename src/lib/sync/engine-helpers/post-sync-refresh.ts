/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SyncLogFn } from './realtime-registrar';

async function runStoreRefresh(
  label: string,
  loader: () => Promise<unknown>,
  log: SyncLogFn
): Promise<void> {
  try {
    await loader();
  } catch (e) {
    log('warn', `Failed to refresh ${label} store after syncAll`, e);
  }
}

function getPulledCount(details: Record<string, { pulled?: number }>, key: string): number {
  return details[key]?.pulled ?? 0;
}

export async function refreshStoresAfterSync(
  report: { details?: Record<string, { pulled?: number }> } | null | undefined,
  userId: string,
  log: SyncLogFn
): Promise<void> {
  const details = report?.details ?? {};

  if (getPulledCount(details, 'Finance') > 0) {
    await runStoreRefresh(
      'finance',
      async () => (await import('@/lib/stores/finance-store')).useFinanceStore.getState().loadFinanceData(userId, true),
      log
    );
  }

  if (getPulledCount(details, 'Fitness') > 0) {
    await runStoreRefresh(
      'fitness',
      async () => (await import('@/lib/stores/fitness')).useFitnessStore.getState().loadFitnessData(userId, true),
      log
    );
  }

  if (getPulledCount(details, 'habits') + getPulledCount(details, 'completions') > 0) {
    await runStoreRefresh(
      'habits',
      async () => (await import('@/lib/stores/habit-store')).useHabitStore.getState().loadHabits(true),
      log
    );
  }

  if (getPulledCount(details, 'tasks') > 0) {
    await runStoreRefresh(
      'tasks',
      async () => (await import('@/lib/stores/task-store')).useTaskStore.getState().loadTasks(true),
      log
    );
  }

  if (getPulledCount(details, 'goals') + getPulledCount(details, 'milestones') > 0) {
    await runStoreRefresh(
      'goals',
      async () => {
        const store = (await import('@/lib/stores/goal-store')).useGoalStore.getState();
        await Promise.all([store.loadGoals(true), store.loadAllMilestones(true)]);
      },
      log
    );
  }

  if (getPulledCount(details, 'user_settings') > 0) {
    await runStoreRefresh(
      'user',
      async () => (await import('@/lib/stores/user-store')).useUserStore.getState().loadUser(true),
      log
    );
  }
}
