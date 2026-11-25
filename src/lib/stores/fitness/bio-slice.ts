import {
  clearRestCompletion,
  db,
  markRestCompletion,
} from '@/lib/db';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { logger } from '@/lib/logger';
import type { FitnessDailyLog, FitnessProfile } from '@/lib/types';
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

const EXERCISE_HABIT_PATTERN =
  /\b(workout|exercise|gym|training|lift|cardio|run|running|jog|cycling|swim|morning walk)\b/i;

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
      (await db.fitnessProfiles
        .where('userId')
        .equals(userId)
        .filter((p) => !p.deletedAt)
        .first());

    const nextProfile: FitnessProfile = {
      id: existing?.id || crypto.randomUUID(),
      userId,
      heightCm: data.heightCm !== undefined ? data.heightCm : existing?.heightCm ?? null,
      currentWeightKg:
        data.currentWeightKg !== undefined
          ? data.currentWeightKg
          : existing?.currentWeightKg ?? null,
      targetWeightKg:
        data.targetWeightKg !== undefined
          ? data.targetWeightKg
          : existing?.targetWeightKg ?? null,
      startingWeightKg:
        data.startingWeightKg !== undefined
          ? data.startingWeightKg
          : existing?.startingWeightKg ?? data.currentWeightKg ?? null,
      targetWaistInches:
        data.targetWaistInches !== undefined
          ? data.targetWaistInches
          : existing?.targetWaistInches ?? null,
      calorieTarget: Math.max(
        800,
        Math.round(data.calorieTarget ?? existing?.calorieTarget ?? 2000)
      ),
      proteinTargetG: Math.max(
        20,
        Math.round(data.proteinTargetG ?? existing?.proteinTargetG ?? 130)
      ),
      carbsTargetG:
        data.carbsTargetG !== undefined
          ? data.carbsTargetG
          : existing?.carbsTargetG ?? 210,
      fatTargetG:
        data.fatTargetG !== undefined ? data.fatTargetG : existing?.fatTargetG ?? 60,
      waterTargetMl: Math.max(
        500,
        Math.round(data.waterTargetMl ?? existing?.waterTargetMl ?? 3000)
      ),
      stepsTarget: Math.max(
        1000,
        Math.round(data.stepsTarget ?? existing?.stepsTarget ?? 8000)
      ),
      sleepTargetHours: Math.max(
        4,
        Math.min(14, Number(data.sleepTargetHours ?? existing?.sleepTargetHours ?? 7.5))
      ),
      activityLevel: data.activityLevel ?? existing?.activityLevel ?? 'moderate',
      goalType: data.goalType ?? existing?.goalType ?? 'fat_loss',
      dietPreference: data.dietPreference ?? existing?.dietPreference ?? 'non_veg',
      gymScheduleDays:
        data.gymScheduleDays ?? existing?.gymScheduleDays ?? [1, 2, 3, 4, 5, 6],
      lowEnergyCalorieCeiling:
        data.lowEnergyCalorieCeiling !== undefined
          ? data.lowEnergyCalorieCeiling
          : existing?.lowEnergyCalorieCeiling ?? null,
      lowEnergyStepsTarget:
        data.lowEnergyStepsTarget !== undefined
          ? data.lowEnergyStepsTarget
          : existing?.lowEnergyStepsTarget ?? 3500,
      deletedAt: null,
      generationCounter: (existing?.generationCounter || 0) + 1,
      isDirty: true,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await db.fitnessProfiles.put(nextProfile);
    set({ profile: nextProfile, currentUserId: userId });
    notifyFitnessSync();
    return nextProfile;
  },

  upsertDailyLog: async (date, patch, userIdOverride) => {
    const userId = resolveUserId(userIdOverride, get().currentUserId);
    const normalizedDate = date || getLocalIsoDate();
    const now = new Date().toISOString();

    const existingInDb = await db.fitnessDailyLogs
      .where('[userId+date]')
      .equals([userId, normalizedDate])
      .filter((row) => !row.deletedAt)
      .first();

    const existing =
      existingInDb ||
      get().dailyLogs.find((d) => d.date === normalizedDate && !d.deletedAt);

    const nextLog: FitnessDailyLog = {
      id: existing?.id || crypto.randomUUID(),
      userId,
      date: normalizedDate,
      weightKg:
        patch.weightKg !== undefined
          ? patch.weightKg
          : existing?.weightKg ?? null,
      waistInches:
        patch.waistInches !== undefined
          ? patch.waistInches
          : existing?.waistInches ?? null,
      waterMl: Math.max(
        0,
        Math.round(patch.waterMl !== undefined ? patch.waterMl : existing?.waterMl ?? 0)
      ),
      steps: Math.max(
        0,
        Math.round(patch.steps !== undefined ? patch.steps : existing?.steps ?? 0)
      ),
      sleepHours:
        patch.sleepHours !== undefined
          ? patch.sleepHours
          : existing?.sleepHours ?? null,
      sleepQuality:
        patch.sleepQuality !== undefined
          ? patch.sleepQuality
          : existing?.sleepQuality ?? null,
      energyLevel:
        patch.energyLevel !== undefined
          ? patch.energyLevel
          : existing?.energyLevel ?? null,
      sorenessLevel:
        patch.sorenessLevel !== undefined
          ? patch.sorenessLevel
          : existing?.sorenessLevel ?? null,
      lowEnergyMode:
        patch.lowEnergyMode !== undefined
          ? Boolean(patch.lowEnergyMode)
          : Boolean(existing?.lowEnergyMode),
      junkFreeOverride:
        patch.junkFreeOverride !== undefined
          ? Boolean(patch.junkFreeOverride)
          : Boolean(existing?.junkFreeOverride),
      restedHabitIds:
        patch.restedHabitIds !== undefined
          ? patch.restedHabitIds
          : existing?.restedHabitIds,
      notes: patch.notes !== undefined ? patch.notes : existing?.notes ?? null,
      deletedAt: null,
      generationCounter: (existing?.generationCounter || 0) + 1,
      isDirty: true,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await db.fitnessDailyLogs.put(nextLog);

    // Keep profile.currentWeightKg synced when today's weight is updated
    if (patch.weightKg !== undefined && patch.weightKg !== null) {
      const profile = get().profile;
      if (profile) {
        const updatedProfile: FitnessProfile = {
          ...profile,
          currentWeightKg: patch.weightKg,
          startingWeightKg: profile.startingWeightKg ?? patch.weightKg,
          generationCounter: (profile.generationCounter || 0) + 1,
          isDirty: true,
          updatedAt: now,
        };
        await db.fitnessProfiles.put(updatedProfile);
        set({ profile: updatedProfile });
      }
    }

    set((state) => {
      const filtered = state.dailyLogs.filter((d) => d.date !== normalizedDate);
      const next = [...filtered, nextLog].sort((a, b) => a.date.localeCompare(b.date));
      return { dailyLogs: next, currentUserId: userId };
    });

    notifyFitnessSync();

    if ((patch.steps !== undefined || patch.lowEnergyMode !== undefined) && nextLog.steps > 0) {
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

    if (patch.sleepHours !== undefined && nextLog.sleepHours !== null) {
      try {
        const { CrossDomainActionMediator } = await import('../mediator');
        await CrossDomainActionMediator.onFitnessEvent({
          type: 'BIO_LOGGED',
          date: normalizedDate,
          sleepHours: nextLog.sleepHours,
        });
      } catch (e) {
        logger.warn('[FitnessStore] Bio sleep mediator skipped:', e);
      }
    } else if (patch.junkFreeOverride !== undefined) {
      try {
        const { CrossDomainActionMediator } = await import('../mediator');
        await CrossDomainActionMediator.evaluateZeroJunkRules(normalizedDate);
      } catch (e) {
        logger.warn('[FitnessStore] Junk-free override mediator skipped:', e);
      }
    }

    return nextLog;
  },

  toggleLowEnergyMode: async (date, enabled, userIdOverride) => {
    const targetDate = (date || getLocalIsoDate()).slice(0, 10);
    const userId = resolveUserId(userIdOverride, get().currentUserId);
    const existing =
      get().dailyLogs.find((d) => d.date === targetDate && !d.deletedAt) ||
      (await db.fitnessDailyLogs
        .where('[userId+date]')
        .equals([userId, targetDate])
        .filter((r) => !r.deletedAt)
        .first());

    const nextEnabled =
      enabled !== undefined ? Boolean(enabled) : !Boolean(existing?.lowEnergyMode);

    const restedHabitIds: string[] = [];

    // Mark scheduled exercise/workout habits as guilt-free `rest` via markRestCompletion
    // (and restore if toggling Low-Energy Mode off when previously marked by Low-Energy Mode).
    try {
      const { useHabitStore } = await import('../habit-store');
      if (useHabitStore.getState().habits.length === 0) {
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
      }

      const habitState = useHabitStore.getState();
      const workoutHabits = habitState.habits.filter((h) => {
        if (h.archived || h.polarity === 'quit') return false;
        if (h.autoTrackRule && h.autoTrackRule !== 'none') {
          return h.autoTrackRule === 'workout_logged';
        }
        return (
          h.anchorBlock === 'gym' ||
          EXERCISE_HABIT_PATTERN.test(h.name)
        );
      });

      for (const habit of workoutHabits) {
        const currentComps = useHabitStore.getState().completions;
        const existingComp = currentComps.find(
          (c) => c.habitId === habit.id && c.date === targetDate
        );

        if (nextEnabled) {
          if (existingComp?.completed) {
            continue;
          }
          if (existingComp?.status === 'rest') {
            if (existingComp.restReason === 'Low-Energy Day') {
              restedHabitIds.push(habit.id);
            }
            continue;
          }
          const restComp = await markRestCompletion(
            habit.id,
            targetDate,
            habit.userId || userId,
            'Low-Energy Day'
          );
          restedHabitIds.push(habit.id);
          useHabitStore.setState((state) => ({
            completions: [
              ...state.completions.filter(
                (c) => !(c.habitId === habit.id && c.date === targetDate)
              ),
              restComp,
            ],
          }));
          try {
            const { getSyncEngine } = await import('@/lib/sync');
            await getSyncEngine().pushCompletion(restComp);
          } catch {
            // Non-blocking in offline / isolated test env
          }
        } else if (
          existingComp?.status === 'rest' &&
          (existingComp.restReason === 'Low-Energy Day' ||
            existing?.restedHabitIds?.includes(habit.id))
        ) {
          const cleared = await clearRestCompletion(
            habit.id,
            targetDate,
            habit.userId || userId
          );
          useHabitStore.setState((state) => ({
            completions: [
              ...state.completions.filter(
                (c) => !(c.habitId === habit.id && c.date === targetDate)
              ),
              cleared,
            ],
          }));
          try {
            const { getSyncEngine } = await import('@/lib/sync');
            await getSyncEngine().pushCompletion(cleared);
          } catch {
            // Non-blocking in offline / isolated test env
          }
        }
      }
    } catch (err) {
      logger.warn('[FitnessStore] Low-energy habit rest sync skipped:', err);
    }

    const updatedLog = await get().upsertDailyLog(
      targetDate,
      {
        lowEnergyMode: nextEnabled,
        restedHabitIds: nextEnabled ? restedHabitIds : [],
      },
      userId
    );

    return {
      ...updatedLog,
      restedHabitIds: nextEnabled ? restedHabitIds : [],
    };
  },

  incrementWater: async (deltaMl, date, userIdOverride) => {
    const targetDate = date || getLocalIsoDate();
    const userId = resolveUserId(userIdOverride, get().currentUserId);
    const existing =
      get().dailyLogs.find((d) => d.date === targetDate && !d.deletedAt) ||
      (await db.fitnessDailyLogs
        .where('[userId+date]')
        .equals([userId, targetDate])
        .filter((r) => !r.deletedAt)
        .first());

    const currentWater = existing?.waterMl || 0;
    return get().upsertDailyLog(
      targetDate,
      { waterMl: Math.max(0, currentWater + Math.round(deltaMl)) },
      userId
    );
  },

  incrementSteps: async (deltaSteps, date, userIdOverride) => {
    const targetDate = date || getLocalIsoDate();
    const userId = resolveUserId(userIdOverride, get().currentUserId);
    const existing =
      get().dailyLogs.find((d) => d.date === targetDate && !d.deletedAt) ||
      (await db.fitnessDailyLogs
        .where('[userId+date]')
        .equals([userId, targetDate])
        .filter((r) => !r.deletedAt)
        .first());

    const currentSteps = existing?.steps || 0;
    return get().upsertDailyLog(
      targetDate,
      { steps: Math.max(0, currentSteps + Math.round(deltaSteps)) },
      userId
    );
  },
});
