import { db } from '@/lib/db';
import type { FitnessDailyLog, FitnessProfile } from '@/lib/types';

function hasValidWeight(row: FitnessDailyLog): boolean {
  if (row.deletedAt) return false;
  return typeof row.weightKg === 'number' && Number.isFinite(row.weightKg) && row.weightKg > 0;
}

async function loadAllWeightDates(
  userId: string,
  memoryLogs: FitnessDailyLog[],
  nextLog: FitnessDailyLog
): Promise<string[]> {
  let dbLogs: FitnessDailyLog[] = [];
  try {
    dbLogs = await db.fitnessDailyLogs
      .where('userId')
      .equals(userId)
      .filter((row) => !row.deletedAt)
      .toArray();
  } catch {
    // Fallback cleanly to in-memory logs
  }

  return [...memoryLogs, ...dbLogs, nextLog].filter(hasValidWeight).map((r) => r.date.slice(0, 10));
}

function isPositiveFiniteWeight(val: number | null | undefined): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val > 0;
}

async function resolveTargetProfile(
  userId: string,
  currentProfile: FitnessProfile | null
): Promise<FitnessProfile | undefined> {
  if (currentProfile) return currentProfile;
  return db.fitnessProfiles.where('userId').equals(userId).filter((p) => !p.deletedAt).first();
}

export async function syncProfileWeightIfLatest(params: {
  userId: string;
  weightKg: number | null | undefined;
  normalizedDate: string;
  memoryLogs: FitnessDailyLog[];
  nextLog: FitnessDailyLog;
  currentProfile: FitnessProfile | null;
  setProfile: (profile: FitnessProfile) => void;
  now: string;
}): Promise<void> {
  const { weightKg, userId, normalizedDate, memoryLogs, nextLog, currentProfile, setProfile, now } =
    params;
  if (!isPositiveFiniteWeight(weightKg)) return;

  const dates = await loadAllWeightDates(userId, memoryLogs, nextLog);
  const latestDate = dates.reduce<string | null>((max, d) => (!max || d > max ? d : max), null);
  if (latestDate && normalizedDate.slice(0, 10) < latestDate) return;

  const profile = await resolveTargetProfile(userId, currentProfile);
  if (!profile) return;

  const updatedProfile: FitnessProfile = {
    ...profile,
    currentWeightKg: weightKg,
    startingWeightKg: profile.startingWeightKg ?? weightKg,
    generationCounter: (profile.generationCounter || 0) + 1,
    isDirty: true,
    updatedAt: now,
  };
  await db.fitnessProfiles.put(updatedProfile);
  setProfile(updatedProfile);
}
