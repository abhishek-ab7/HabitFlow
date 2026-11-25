import { db } from '@/lib/db';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { logger } from '@/lib/logger';
import type { WorkoutSession } from '@/lib/types';
import type { FitnessSliceCreator, FitnessStoreActions } from './types';

function notifyFitnessSync() {
  if (typeof window === 'undefined') return;
  import('@/lib/sync/sync-engine')
    .then(({ getSyncEngine }) => {
      getSyncEngine().triggerFitnessSync();
    })
    .catch((err) => {
      logger.warn('[FitnessStore] Sync trigger deferred:', err);
    });
}

function resolveUserId(override?: string, current?: string | null): string {
  return override || current || 'local-demo-user';
}

export const createWorkoutSlice: FitnessSliceCreator<
  Pick<
    FitnessStoreActions,
    'addWorkoutSession' | 'updateWorkoutSession' | 'deleteWorkoutSession'
  >
> = (set, get) => ({
  addWorkoutSession: async (data, userIdOverride) => {
    const userId = resolveUserId(userIdOverride, get().currentUserId);
    const now = new Date().toISOString();
    const date = data.date || getLocalIsoDate();

    const session: WorkoutSession = {
      id: crypto.randomUUID(),
      userId,
      date,
      title: data.title.trim() || 'Workout',
      workoutType: data.workoutType || 'strength',
      durationMinutes: Math.max(1, Math.round(Number(data.durationMinutes) || 30)),
      estimatedCaloriesBurned:
        data.estimatedCaloriesBurned !== undefined
          ? data.estimatedCaloriesBurned
          : Math.round(Math.max(1, Number(data.durationMinutes) || 30) * 6),
      exercises: Array.isArray(data.exercises) ? data.exercises : [],
      rpe: data.rpe ?? null,
      notes: data.notes ?? null,
      source: data.source || 'manual',
      deletedAt: null,
      generationCounter: 1,
      isDirty: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.workoutSessions.put(session);
    set((state) => ({
      workoutSessions: [session, ...state.workoutSessions].sort(
        (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
      ),
      currentUserId: userId,
    }));
    notifyFitnessSync();

    // Auto-complete workout / exercise habits via mediator
    try {
      const { CrossDomainActionMediator } = await import('../mediator');
      await CrossDomainActionMediator.onFitnessEvent({
        type: 'WORKOUT_LOGGED',
        date: session.date,
        workoutType: session.workoutType,
        durationMinutes: session.durationMinutes,
      });
    } catch (err) {
      logger.warn('[FitnessStore] Mediator workout auto-complete skipped:', err);
    }

    return session;
  },

  updateWorkoutSession: async (id, patch) => {
    const existing =
      get().workoutSessions.find((w) => w.id === id) ||
      (await db.workoutSessions.get(id));
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated: WorkoutSession = {
      ...existing,
      ...patch,
      title: patch.title !== undefined ? patch.title.trim() : existing.title,
      generationCounter: (existing.generationCounter || 1) + 1,
      isDirty: true,
      updatedAt: now,
    };

    await db.workoutSessions.put(updated);
    set((state) => ({
      workoutSessions: state.workoutSessions
        .map((w) => (w.id === id ? updated : w))
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    }));
    notifyFitnessSync();
    return updated;
  },

  deleteWorkoutSession: async (id) => {
    const existing =
      get().workoutSessions.find((w) => w.id === id) ||
      (await db.workoutSessions.get(id));
    if (!existing) return;

    const now = new Date().toISOString();
    await db.workoutSessions.update(id, {
      deletedAt: now,
      updatedAt: now,
      isDirty: true,
      generationCounter: (existing.generationCounter || 1) + 1,
    });

    set((state) => ({
      workoutSessions: state.workoutSessions.filter((w) => w.id !== id),
    }));
    notifyFitnessSync();
  },
});
