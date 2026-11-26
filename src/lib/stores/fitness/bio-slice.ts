import { db } from '@/lib/db';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { logger } from '@/lib/logger';
import type { FitnessDailyLog } from '@/lib/types';
import type { FitnessSliceCreator, FitnessStoreActions } from './types';
import {
  buildNextDailyLog,
  buildNextFitnessProfile,
  syncProfileWeightIfLatest,
  syncWorkoutRestHabits,
} from './bio/bio-helpers';

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

async function findExistingDailyLog(
  memoryLogs: FitnessDailyLog[],
  userId: string,
  targetDate: string
): Promise<FitnessDailyLog | undefined> {
  const fromMemory = memoryLogs.find((d) => d.date === targetDate && !d.deletedAt);
  if (fromMemory) return fromMemory;
  return db.fitnessDailyLogs
    .where('[userId+date]')
    .equals([userId, targetDate])
    .filter((r) => !r.deletedAt)
    .first();
}

async function emitStepsMediatorIfChanged(
  patch: Partial<FitnessDailyLog>,
  nextLog: FitnessDailyLog,
  normalizedDate: string
): Promise<void> {
  const hasStepsUpdate = patch.steps !== undefined || patch.lowEnergyMode !== undefined;
  if (!hasStepsUpdate || nextLog.steps <= 0) return;

  try {
    const { CrossDomainActionMediator } = await import('../mediator');
    await CrossDomainActionMediator.onFitnessEvent({
      type: 'STEPS_UPDATED',
      date: normalizedDate,
      steps: nextLog.steps,
    });
  } catch (e) {
    logger.warn('[FitnessStore] Steps mediator skipped:', e);
  }
}

async function emitSleepOrJunkMediator(
  patch: Partial<FitnessDailyLog>,
  nextLog: FitnessDailyLog,
  normalizedDate: string
): Promise<void> {
  try {
    const { CrossDomainActionMediator } = await import('../mediator');
    if (patch.sleepHours !== undefined && nextLog.sleepHours !== null) {
      await CrossDomainActionMediator.onFitnessEvent({
        type: 'BIO_LOGGED',
        date: normalizedDate,
        sleepHours: nextLog.sleepHours,
      });
      return;
    }
    if (patch.junkFreeOverride !== undefined) {
      await CrossDomainActionMediator.evaluateZeroJunkRules(normalizedDate);
    }
  } catch (e) {
    logger.warn('[FitnessStore] Bio mediator skipped:', e);
  }
}

async function incrementDailyMetric(params: {
  dailyLogs: FitnessDailyLog[];
  currentUserId: string | null;
  upsertDailyLog: FitnessStoreActions['upsertDailyLog'];
  field: 'waterMl' | 'steps';
  delta: number;
  date?: string;
  userIdOverride?: string;
}): Promise<FitnessDailyLog> {
  const targetDate = params.date || getLocalIsoDate();
  const userId = resolveUserId(params.userIdOverride, params.currentUserId);
  const existing = await findExistingDailyLog(params.dailyLogs, userId, targetDate);
  const currentVal = existing?.[params.field] || 0;
  const nextVal = Math.max(0, currentVal + Math.round(params.delta));
  return params.upsertDailyLog(targetDate, { [params.field]: nextVal }, userId);
}

export const createBioSlice: FitnessSliceCreator<
  Pick<
    FitnessStoreActions,
    | 'upsertProfile'
    | 'upsertDailyLog'
    | 'incrementWater'
    | 'incrementSteps'
    | 'toggleLowEnergyMode'
  >
> = (set, get) => ({
  upsertProfile: async (data, userIdOverride) => {
    const userId = resolveUserId(userIdOverride, get().currentUserId);
    const now = new Date().toISOString();
    const existing =
      get().profile ||
      (await db.fitnessProfiles.where('userId').equals(userId).filter((p) => !p.deletedAt).first());

    const nextProfile = buildNextFitnessProfile({ data, existing, userId, now });
    await db.fitnessProfiles.put(nextProfile);
    set({ profile: nextProfile, currentUserId: userId });
    notifyFitnessSync();
    return nextProfile;
  },

  upsertDailyLog: async (date, patch, userIdOverride) => {
    const userId = resolveUserId(userIdOverride, get().currentUserId);
    const normalizedDate = date || getLocalIsoDate();
    const now = new Date().toISOString();

    const existing = await findExistingDailyLog(get().dailyLogs, userId, normalizedDate);
    const nextLog = buildNextDailyLog({ patch, existing, userId, normalizedDate, now });
    await db.fitnessDailyLogs.put(nextLog);

    await syncProfileWeightIfLatest({
      userId,
      weightKg: patch.weightKg,
      normalizedDate,
      memoryLogs: get().dailyLogs,
      nextLog,
      currentProfile: get().profile,
      setProfile: (profile) => set({ profile }),
      now,
    });

    set((state) => ({
      dailyLogs: [...state.dailyLogs.filter((d) => d.date !== normalizedDate), nextLog].sort(
        (a, b) => a.date.localeCompare(b.date)
      ),
      currentUserId: userId,
    }));

    notifyFitnessSync();
    await emitStepsMediatorIfChanged(patch, nextLog, normalizedDate);
    await emitSleepOrJunkMediator(patch, nextLog, normalizedDate);
    return nextLog;
  },

  toggleLowEnergyMode: async (date, enabled, userIdOverride) => {
    const targetDate = (date || getLocalIsoDate()).slice(0, 10);
    const userId = resolveUserId(userIdOverride, get().currentUserId);
    const existing = await findExistingDailyLog(get().dailyLogs, userId, targetDate);
    const nextEnabled =
      enabled !== undefined ? Boolean(enabled) : !Boolean(existing?.lowEnergyMode);

    const restedHabitIds = await syncWorkoutRestHabits({
      targetDate,
      userId,
      nextEnabled,
      existingRestedHabitIds: existing?.restedHabitIds,
    });

    const updatedLog = await get().upsertDailyLog(
      targetDate,
      { lowEnergyMode: nextEnabled, restedHabitIds: nextEnabled ? restedHabitIds : [] },
      userId
    );
    return { ...updatedLog, restedHabitIds: nextEnabled ? restedHabitIds : [] };
  },

  incrementWater: (deltaMl, date, userIdOverride) =>
    incrementDailyMetric({
      dailyLogs: get().dailyLogs,
      currentUserId: get().currentUserId,
      upsertDailyLog: get().upsertDailyLog,
      field: 'waterMl',
      delta: deltaMl,
      date,
      userIdOverride,
    }),

  incrementSteps: (deltaSteps, date, userIdOverride) =>
    incrementDailyMetric({
      dailyLogs: get().dailyLogs,
      currentUserId: get().currentUserId,
      upsertDailyLog: get().upsertDailyLog,
      field: 'steps',
      delta: deltaSteps,
      date,
      userIdOverride,
    }),
});
