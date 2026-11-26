/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FitnessDailyLog } from '@/lib/types';

export function toNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function toNullableNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function hasScalarValue<T>(val: T | null | undefined): val is T {
  return val !== null && val !== undefined && val !== '';
}

function pickScalar<T>(
  localVal: T | null | undefined,
  remoteVal: T | null | undefined,
  remoteNewer: boolean
): T | null {
  const hasLocal = hasScalarValue(localVal);
  const hasRemote = hasScalarValue(remoteVal);
  if (!hasLocal && !hasRemote) return null;
  if (!hasLocal) return remoteVal as T;
  if (!hasRemote) return localVal as T;
  return remoteNewer ? (remoteVal as T) : (localVal as T);
}

function pickByRecency<T>(
  localVal: T | undefined,
  remoteVal: T | undefined,
  remoteNewer: boolean,
  fallback: T
): T {
  const primary = remoteNewer ? remoteVal : localVal;
  if (primary !== undefined) return primary;
  const secondary = remoteNewer ? localVal : remoteVal;
  return secondary !== undefined ? secondary : fallback;
}

function isRemoteNewer(local: FitnessDailyLog, remote: any): boolean {
  const remoteGen = toNum(remote.generation_counter, 1);
  const localGen = toNum(local.generationCounter, 1);
  if (remoteGen !== localGen) return remoteGen > localGen;
  const remoteUpdated = remote.updated_at ? new Date(remote.updated_at).getTime() : 0;
  const localUpdated = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
  return remoteUpdated > localUpdated;
}

function hasBodyMetricDiff(merged: FitnessDailyLog, remote: any): boolean {
  return (
    merged.weightKg !== toNullableNum(remote.weight_kg) ||
    merged.waistInches !== toNullableNum(remote.waist_inches) ||
    merged.waterMl !== toNum(remote.water_ml, 0) ||
    merged.steps !== toNum(remote.steps, 0)
  );
}

function hasRecoveryMetricDiff(merged: FitnessDailyLog, remote: any): boolean {
  return (
    merged.sleepHours !== toNullableNum(remote.sleep_hours) ||
    merged.sleepQuality !== toNullableNum(remote.sleep_quality) ||
    merged.energyLevel !== toNullableNum(remote.energy_level) ||
    merged.sorenessLevel !== toNullableNum(remote.soreness_level)
  );
}

function hasMetricDiff(merged: FitnessDailyLog, remote: any): boolean {
  return hasBodyMetricDiff(merged, remote) || hasRecoveryMetricDiff(merged, remote);
}

function hasBooleanModeDiff(merged: FitnessDailyLog, remote: any): boolean {
  return (
    Boolean(merged.lowEnergyMode) !== Boolean(remote.low_energy_mode) ||
    Boolean(merged.junkFreeOverride) !== Boolean(remote.junk_free_override)
  );
}

function hasFlagOrTextDiff(
  merged: FitnessDailyLog,
  remote: any,
  mergedRestedIds: string[],
  remoteRestedIds: string[]
): boolean {
  return (
    hasBooleanModeDiff(merged, remote) ||
    JSON.stringify(mergedRestedIds) !== JSON.stringify(remoteRestedIds) ||
    (merged.notes ?? null) !== (remote.notes ?? null) ||
    (merged.deletedAt ?? null) !== (remote.deleted_at ?? null)
  );
}

function resolveRestedHabitIds(local: FitnessDailyLog, remote: any, remoteNewer: boolean) {
  const remoteRestedIds: string[] = Array.isArray(remote.rested_habit_ids)
    ? remote.rested_habit_ids
    : [];
  const localRestedIds: string[] = Array.isArray(local.restedHabitIds) ? local.restedHabitIds : [];
  const mergedRestedIds = pickByRecency(
    local.restedHabitIds !== undefined ? localRestedIds : undefined,
    remote.rested_habit_ids !== undefined ? remoteRestedIds : undefined,
    remoteNewer,
    []
  );
  const includeField =
    mergedRestedIds.length > 0 ||
    local.restedHabitIds !== undefined ||
    remote.rested_habit_ids !== undefined;
  return { remoteRestedIds, mergedRestedIds, includeField };
}

function buildMergedMetrics(local: FitnessDailyLog, remote: any, remoteNewer: boolean) {
  return {
    weightKg: pickScalar(local.weightKg, toNullableNum(remote.weight_kg), remoteNewer),
    waistInches: pickScalar(local.waistInches, toNullableNum(remote.waist_inches), remoteNewer),
    waterMl: Math.max(toNum(local.waterMl, 0), toNum(remote.water_ml, 0)),
    steps: Math.max(toNum(local.steps, 0), toNum(remote.steps, 0)),
    sleepHours: pickScalar(local.sleepHours, toNullableNum(remote.sleep_hours), remoteNewer),
    sleepQuality: pickScalar(local.sleepQuality, toNullableNum(remote.sleep_quality), remoteNewer),
    energyLevel: pickScalar(local.energyLevel, toNullableNum(remote.energy_level), remoteNewer),
    sorenessLevel: pickScalar(local.sorenessLevel, toNullableNum(remote.soreness_level), remoteNewer),
  };
}

function buildMergedMeta(local: FitnessDailyLog, remote: any, remoteNewer: boolean) {
  const remoteGen = toNum(remote.generation_counter, 1);
  const localGen = toNum(local.generationCounter, 1);
  const remoteUpdated = remote.updated_at ? new Date(remote.updated_at).getTime() : 0;
  const localUpdated = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
  return {
    remoteGen,
    notes: pickScalar(local.notes, remote.notes ?? null, remoteNewer),
    deletedAt: remote.deleted_at ?? local.deletedAt ?? null,
    generationCounter: Math.max(localGen, remoteGen) + 1,
    isDirty: true,
    createdAt: local.createdAt || remote.created_at || new Date().toISOString(),
    updatedAt: new Date(Math.max(localUpdated, remoteUpdated, Date.now())).toISOString(),
  };
}

function finalizeMergedState(
  merged: FitnessDailyLog,
  remote: any,
  mergedRestedIds: string[],
  remoteRestedIds: string[]
) {
  const differsFromRemote =
    hasMetricDiff(merged, remote) ||
    hasFlagOrTextDiff(merged, remote, mergedRestedIds, remoteRestedIds);

  if (!differsFromRemote) {
    merged.isDirty = false;
    merged.generationCounter = toNum(remote.generation_counter, 1);
    merged.updatedAt = remote.updated_at || merged.updatedAt;
  }

  return { merged, needsPush: differsFromRemote };
}

export function mergeDailyLogWithRemote(
  local: FitnessDailyLog,
  remote: any
): { merged: FitnessDailyLog; needsPush: boolean } {
  const remoteNewer = isRemoteNewer(local, remote);
  const { remoteRestedIds, mergedRestedIds, includeField } = resolveRestedHabitIds(
    local,
    remote,
    remoteNewer
  );
  const meta = buildMergedMeta(local, remote, remoteNewer);

  const merged: FitnessDailyLog = {
    id: remote.id || local.id,
    userId: local.userId,
    date: local.date,
    ...buildMergedMetrics(local, remote, remoteNewer),
    lowEnergyMode: Boolean(pickByRecency(local.lowEnergyMode, remote.low_energy_mode, remoteNewer, false)),
    junkFreeOverride: Boolean(pickByRecency(local.junkFreeOverride, remote.junk_free_override, remoteNewer, false)),
    ...(includeField ? { restedHabitIds: mergedRestedIds } : {}),
    notes: meta.notes,
    deletedAt: meta.deletedAt,
    generationCounter: meta.generationCounter,
    isDirty: meta.isDirty,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  };

  return finalizeMergedState(merged, remote, mergedRestedIds, remoteRestedIds);
}

export function mapDailyLogToLocal(r: any, createdAtFallback?: string): FitnessDailyLog {
  const now = new Date().toISOString();
  return {
    id: r.id,
    userId: r.user_id,
    date: r.date,
    weightKg: toNullableNum(r.weight_kg),
    waistInches: toNullableNum(r.waist_inches),
    waterMl: toNum(r.water_ml, 0),
    steps: toNum(r.steps, 0),
    sleepHours: toNullableNum(r.sleep_hours),
    sleepQuality: toNullableNum(r.sleep_quality),
    energyLevel: toNullableNum(r.energy_level),
    sorenessLevel: toNullableNum(r.soreness_level),
    lowEnergyMode: Boolean(r.low_energy_mode),
    junkFreeOverride: Boolean(r.junk_free_override),
    restedHabitIds: Array.isArray(r.rested_habit_ids) ? r.rested_habit_ids : [],
    notes: r.notes ?? null,
    deletedAt: r.deleted_at ?? null,
    generationCounter: toNum(r.generation_counter, 1),
    isDirty: false,
    createdAt: r.created_at || createdAtFallback || now,
    updatedAt: r.updated_at || now,
  };
}

export function mapDailyLogToRemote(l: FitnessDailyLog, userId: string): Record<string, any> {
  return {
    id: l.id,
    user_id: userId,
    date: l.date,
    weight_kg: l.weightKg ?? null,
    waist_inches: l.waistInches ?? null,
    water_ml: toNum(l.waterMl, 0),
    steps: toNum(l.steps, 0),
    sleep_hours: l.sleepHours ?? null,
    sleep_quality: l.sleepQuality ?? null,
    energy_level: l.energyLevel ?? null,
    soreness_level: l.sorenessLevel ?? null,
    low_energy_mode: Boolean(l.lowEnergyMode),
    junk_free_override: Boolean(l.junkFreeOverride),
    rested_habit_ids: Array.isArray(l.restedHabitIds) ? l.restedHabitIds : [],
    notes: l.notes ?? null,
    deleted_at: l.deletedAt ?? null,
    generation_counter: toNum(l.generationCounter, 1),
    created_at: l.createdAt,
    updated_at: l.updatedAt,
  };
}
