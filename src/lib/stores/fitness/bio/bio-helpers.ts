import type { FitnessDailyLog, FitnessProfile } from '@/lib/types';
export { syncWorkoutRestHabits } from './rest-sync';
export { syncProfileWeightIfLatest } from './weight-sync';

function definedOnly<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

function clampTarget(next: number | undefined, prev: number | undefined, min: number, fallback: number) {
  return Math.max(min, Math.round(next ?? prev ?? fallback));
}

function clampProfileTargets(
  merged: FitnessProfile,
  data: Partial<FitnessProfile>,
  existing: FitnessProfile | null | undefined
) {
  return {
    startingWeightKg: merged.startingWeightKg ?? data.currentWeightKg ?? null,
    calorieTarget: clampTarget(data.calorieTarget, existing?.calorieTarget, 800, 2000),
    proteinTargetG: clampTarget(data.proteinTargetG, existing?.proteinTargetG, 20, 130),
    waterTargetMl: clampTarget(data.waterTargetMl, existing?.waterTargetMl, 500, 3000),
    stepsTarget: clampTarget(data.stepsTarget, existing?.stepsTarget, 1000, 8000),
    sleepTargetHours: Math.max(
      4,
      Math.min(14, Number(data.sleepTargetHours ?? existing?.sleepTargetHours ?? 7.5))
    ),
  };
}

function createEmptyProfile(userId: string, now: string): FitnessProfile {
  return {
    id: crypto.randomUUID(),
    userId,
    heightCm: null,
    currentWeightKg: null,
    targetWeightKg: null,
    startingWeightKg: null,
    targetWaistInches: null,
    calorieTarget: 2000,
    proteinTargetG: 130,
    carbsTargetG: 210,
    fatTargetG: 60,
    waterTargetMl: 3000,
    stepsTarget: 8000,
    sleepTargetHours: 7.5,
    activityLevel: 'moderate',
    goalType: 'fat_loss',
    dietPreference: 'non_veg',
    gymScheduleDays: [1, 2, 3, 4, 5, 6],
    lowEnergyCalorieCeiling: null,
    lowEnergyStepsTarget: 3500,
    deletedAt: null,
    generationCounter: 0,
    isDirty: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildNextFitnessProfile(params: {
  data: Partial<FitnessProfile>;
  existing: FitnessProfile | null | undefined;
  userId: string;
  now: string;
}): FitnessProfile {
  const { data, existing, userId, now } = params;
  const base = existing ? { ...existing } : createEmptyProfile(userId, now);
  const merged = { ...base, ...definedOnly(data) };

  return {
    ...merged,
    ...clampProfileTargets(merged, data, existing),
    deletedAt: null,
    generationCounter: (existing?.generationCounter || 0) + 1,
    isDirty: true,
    updatedAt: now,
  };
}

export function buildNextDailyLog(params: {
  patch: Partial<FitnessDailyLog>;
  existing: FitnessDailyLog | undefined;
  userId: string;
  normalizedDate: string;
  now: string;
}): FitnessDailyLog {
  const { patch, existing, userId, normalizedDate, now } = params;
  const base: FitnessDailyLog = existing
    ? { ...existing }
    : {
        id: crypto.randomUUID(),
        userId,
        date: normalizedDate,
        weightKg: null,
        waistInches: null,
        waterMl: 0,
        steps: 0,
        sleepHours: null,
        sleepQuality: null,
        energyLevel: null,
        sorenessLevel: null,
        lowEnergyMode: false,
        junkFreeOverride: false,
        notes: null,
        deletedAt: null,
        generationCounter: 0,
        isDirty: true,
        createdAt: now,
        updatedAt: now,
      };

  const merged = { ...base, ...definedOnly(patch) };
  return {
    ...merged,
    waterMl: Math.max(0, Math.round(merged.waterMl || 0)),
    steps: Math.max(0, Math.round(merged.steps || 0)),
    lowEnergyMode: Boolean(merged.lowEnergyMode),
    junkFreeOverride: Boolean(merged.junkFreeOverride),
    deletedAt: null,
    generationCounter: (existing?.generationCounter || 0) + 1,
    isDirty: true,
    updatedAt: now,
  };
}
