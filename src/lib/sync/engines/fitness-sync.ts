/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/client';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ISynchronizer } from '../types';

export interface FitnessSyncResult {
  domain: string;
  pushed: number;
  pulled: number;
  status: 'success' | 'partial_failure';
  errors: string[];
  durationMs: number;
}
import type {
  FitnessDailyLog,
  FitnessProfile,
  MealLog,
  MealTemplate,
  SupplementInventory,
  SupplementLog,
  WorkoutSession,
} from '@/lib/types';
import {
  isMissingRelationError,
  shouldApplyRemoteRecord,
  upsertRowsWithColumnFallback,
} from './column-fallback';

const missingRemoteFitnessTables = new Set<string>();

export function clearFitnessMissingTableCache(table?: string) {
  if (table) {
    missingRemoteFitnessTables.delete(table);
  } else {
    missingRemoteFitnessTables.clear();
  }
}

function toNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toNullableNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function mergeDailyLogWithRemote(
  local: FitnessDailyLog,
  remote: any
): { merged: FitnessDailyLog; needsPush: boolean } {
  const remoteGen = toNum(remote.generation_counter, 1);
  const localGen = toNum(local.generationCounter, 1);
  const remoteUpdated = remote.updated_at ? new Date(remote.updated_at).getTime() : 0;
  const localUpdated = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
  const remoteNewer =
    remoteGen > localGen || (remoteGen === localGen && remoteUpdated > localUpdated);

  const pickScalar = <T>(localVal: T | null | undefined, remoteVal: T | null | undefined): T | null => {
    const hasLocal = localVal !== null && localVal !== undefined && localVal !== '';
    const hasRemote = remoteVal !== null && remoteVal !== undefined && remoteVal !== '';
    if (!hasLocal && hasRemote) return remoteVal as T;
    if (hasLocal && !hasRemote) return localVal as T;
    if (!hasLocal && !hasRemote) return null;
    return remoteNewer ? (remoteVal as T) : (localVal as T);
  };

  const remoteWater = toNum(remote.water_ml, 0);
  const localWater = toNum(local.waterMl, 0);
  const remoteSteps = toNum(remote.steps, 0);
  const localSteps = toNum(local.steps, 0);

  const mergedWater = Math.max(localWater, remoteWater);
  const mergedSteps = Math.max(localSteps, remoteSteps);
  const mergedLowEnergyMode = remoteNewer
    ? remote.low_energy_mode !== undefined
      ? Boolean(remote.low_energy_mode)
      : Boolean(local.lowEnergyMode)
    : local.lowEnergyMode !== undefined
      ? Boolean(local.lowEnergyMode)
      : Boolean(remote.low_energy_mode);
  const mergedJunkFreeOverride = remoteNewer
    ? remote.junk_free_override !== undefined
      ? Boolean(remote.junk_free_override)
      : Boolean(local.junkFreeOverride)
    : local.junkFreeOverride !== undefined
      ? Boolean(local.junkFreeOverride)
      : Boolean(remote.junk_free_override);
  const remoteRestedIds: string[] = Array.isArray(remote.rested_habit_ids)
    ? remote.rested_habit_ids
    : [];
  const localRestedIds: string[] = Array.isArray(local.restedHabitIds)
    ? local.restedHabitIds
    : [];
  const mergedRestedIds = remoteNewer
    ? remote.rested_habit_ids !== undefined
      ? remoteRestedIds
      : localRestedIds
    : local.restedHabitIds !== undefined
      ? localRestedIds
      : remoteRestedIds;

  const merged: FitnessDailyLog = {
    id: remote.id || local.id,
    userId: local.userId,
    date: local.date,
    weightKg: pickScalar(local.weightKg, toNullableNum(remote.weight_kg)),
    waistInches: pickScalar(local.waistInches, toNullableNum(remote.waist_inches)),
    waterMl: mergedWater,
    steps: mergedSteps,
    sleepHours: pickScalar(local.sleepHours, toNullableNum(remote.sleep_hours)),
    sleepQuality: pickScalar(local.sleepQuality, toNullableNum(remote.sleep_quality)),
    energyLevel: pickScalar(local.energyLevel, toNullableNum(remote.energy_level)),
    sorenessLevel: pickScalar(local.sorenessLevel, toNullableNum(remote.soreness_level)),
    lowEnergyMode: mergedLowEnergyMode,
    junkFreeOverride: mergedJunkFreeOverride,
    ...(mergedRestedIds.length > 0 ||
    local.restedHabitIds !== undefined ||
    remote.rested_habit_ids !== undefined
      ? { restedHabitIds: mergedRestedIds }
      : {}),
    notes: pickScalar(local.notes, remote.notes ?? null),
    deletedAt: remote.deleted_at ?? local.deletedAt ?? null,
    generationCounter: Math.max(localGen, remoteGen) + 1,
    isDirty: true,
    createdAt: local.createdAt || remote.created_at || new Date().toISOString(),
    updatedAt: new Date(Math.max(localUpdated, remoteUpdated, Date.now())).toISOString(),
  };

  const differsFromRemote =
    merged.weightKg !== toNullableNum(remote.weight_kg) ||
    merged.waistInches !== toNullableNum(remote.waist_inches) ||
    merged.waterMl !== remoteWater ||
    merged.steps !== remoteSteps ||
    merged.sleepHours !== toNullableNum(remote.sleep_hours) ||
    merged.sleepQuality !== toNullableNum(remote.sleep_quality) ||
    merged.energyLevel !== toNullableNum(remote.energy_level) ||
    merged.sorenessLevel !== toNullableNum(remote.soreness_level) ||
    Boolean(merged.lowEnergyMode) !== Boolean(remote.low_energy_mode) ||
    Boolean(merged.junkFreeOverride) !== Boolean(remote.junk_free_override) ||
    JSON.stringify(mergedRestedIds) !== JSON.stringify(remoteRestedIds) ||
    (merged.notes ?? null) !== (remote.notes ?? null) ||
    (merged.deletedAt ?? null) !== (remote.deleted_at ?? null);

  if (!differsFromRemote) {
    merged.isDirty = false;
    merged.generationCounter = remoteGen;
    merged.updatedAt = remote.updated_at || merged.updatedAt;
  }

  return { merged, needsPush: differsFromRemote };
}

export class FitnessSyncEngine implements ISynchronizer {
  readonly domainName = 'Fitness';

  private log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    if (level === 'error') logger.error(`[FitnessSync] ${message}`, data);
    else if (level === 'warn') logger.warn(`[FitnessSync] ${message}`, data);
    else logger.info(`[FitnessSync] ${message}`, data);
  }

  private async migrateOrphanedRecords(userId: string) {
    try {
      const tables = [
        'fitnessProfiles',
        'fitnessDailyLogs',
        'mealTemplates',
        'mealLogs',
        'workoutSessions',
        'supplementInventory',
        'supplementLogs',
      ] as const;

      for (const tbl of tables) {
        const table = db.table(tbl);
        const allRows = await table.toArray();
        const orphans = allRows.filter(
          (row: any) => row.userId === 'local-demo-user' || !row.userId
        );
        if (orphans.length > 0) {
          this.log('info', `Migrating ${orphans.length} orphaned ${tbl} records to ${userId}`);
          for (const orphan of orphans) {
            await table.update(orphan.id, { userId, isDirty: true });
          }
        }
      }
    } catch (e) {
      this.log('error', 'Failed to migrate orphaned fitness records', e);
    }
  }

  private async pullTable(supabase: any, remoteTable: string, userId: string): Promise<any[] | null> {
    if (missingRemoteFitnessTables.has(remoteTable)) return null;

    const { data, error } = await supabase
      .from(remoteTable)
      .select('*')
      .eq('user_id', userId);

    if (error) {
      if (isMissingRelationError(error)) {
        missingRemoteFitnessTables.add(remoteTable);
        this.log('warn', `Remote table '${remoteTable}' does not exist yet; skipping until migration is applied.`);
        return null;
      }
      throw error;
    }

    return Array.isArray(data) ? data : [];
  }

  private async pushBatched(
    supabase: any,
    remoteTable: string,
    payloads: Record<string, any>[],
    options?: { onConflict?: string }
  ): Promise<boolean> {
    if (payloads.length === 0 || missingRemoteFitnessTables.has(remoteTable)) {
      return true;
    }

    const CHUNK = 50;
    for (let i = 0; i < payloads.length; i += CHUNK) {
      const batch = payloads.slice(i, i + CHUNK);
      const { error } = await upsertRowsWithColumnFallback(supabase, remoteTable, batch, options);
      if (error) {
        if (isMissingRelationError(error)) {
          missingRemoteFitnessTables.add(remoteTable);
          this.log('warn', `Remote table '${remoteTable}' missing on push; skipping.`);
          return false;
        }
        throw error;
      }
    }

    return true;
  }

  private async deduplicateProfiles(userId: string) {
    const profiles = await db.fitnessProfiles.where('userId').equals(userId).toArray();
    if (profiles.length <= 1) return;

    profiles.sort((a, b) => {
      if (Boolean(a.deletedAt) !== Boolean(b.deletedAt)) {
        return a.deletedAt ? 1 : -1;
      }
      const genDiff = toNum(b.generationCounter, 0) - toNum(a.generationCounter, 0);
      if (genDiff !== 0) return genDiff;
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });

    const staleIds = profiles.slice(1).map((p) => p.id);
    if (staleIds.length > 0) {
      await db.fitnessProfiles.bulkDelete(staleIds);
    }
  }

  private async deduplicateDailyLogs(userId: string) {
    const logs = await db.fitnessDailyLogs.where('userId').equals(userId).toArray();
    const byDate = new Map<string, FitnessDailyLog[]>();
    for (const row of logs) {
      const list = byDate.get(row.date) || [];
      list.push(row);
      byDate.set(row.date, list);
    }

    const toDelete: string[] = [];
    for (const group of byDate.values()) {
      if (group.length <= 1) continue;
      group.sort((a, b) => {
        if (Boolean(a.deletedAt) !== Boolean(b.deletedAt)) {
          return a.deletedAt ? 1 : -1;
        }
        const genDiff = toNum(b.generationCounter, 0) - toNum(a.generationCounter, 0);
        if (genDiff !== 0) return genDiff;
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      });
      for (const dup of group.slice(1)) {
        toDelete.push(dup.id);
      }
    }

    if (toDelete.length > 0) {
      await db.fitnessDailyLogs.bulkDelete(toDelete);
    }
  }

  async syncProfiles(supabase: any, userId: string): Promise<{ pushed: number; pulled: number }> {
    let pushed = 0;
    let pulled = 0;
    await this.deduplicateProfiles(userId);

    const remoteRows = await this.pullTable(supabase, 'fitness_profiles', userId);
    if (remoteRows === null) return { pushed, pulled };

    const localProfiles = await db.fitnessProfiles.where('userId').equals(userId).toArray();
    const localProfile = localProfiles[0];

    for (const r of remoteRows) {
      if (!localProfile || shouldApplyRemoteRecord(localProfile, r)) {
        const mapped: FitnessProfile = {
          id: r.id,
          userId: r.user_id,
          heightCm: toNullableNum(r.height_cm),
          currentWeightKg: toNullableNum(r.current_weight_kg),
          targetWeightKg: toNullableNum(r.target_weight_kg),
          startingWeightKg: toNullableNum(r.starting_weight_kg),
          targetWaistInches: toNullableNum(r.target_waist_inches),
          calorieTarget: toNum(r.calorie_target, 2000),
          proteinTargetG: toNum(r.protein_target_g, 130),
          carbsTargetG: toNullableNum(r.carbs_target_g),
          fatTargetG: toNullableNum(r.fat_target_g),
          waterTargetMl: toNum(r.water_target_ml, 3000),
          stepsTarget: toNum(r.steps_target, 8000),
          sleepTargetHours: toNum(r.sleep_target_hours, 7.5),
          activityLevel: r.activity_level || 'moderate',
          goalType: r.goal_type || 'fat_loss',
          dietPreference: r.diet_preference || 'non_veg',
          gymScheduleDays: Array.isArray(r.gym_schedule_days) ? r.gym_schedule_days : [1, 2, 3, 4, 5, 6],
          lowEnergyCalorieCeiling: toNullableNum(r.low_energy_calorie_ceiling),
          lowEnergyStepsTarget: toNullableNum(r.low_energy_steps_target),
          deletedAt: r.deleted_at ?? null,
          generationCounter: toNum(r.generation_counter, 1),
          isDirty: false,
          createdAt: r.created_at || new Date().toISOString(),
          updatedAt: r.updated_at || new Date().toISOString(),
        };

        if (localProfile && localProfile.id !== r.id) {
          await db.fitnessProfiles.delete(localProfile.id);
        }
        await db.fitnessProfiles.put(mapped);
        pulled++;
      } else if (localProfile && localProfile.id !== r.id) {
        // Align UUID with remote unique user_id row while preserving newer dirty local values
        await db.fitnessProfiles.delete(localProfile.id);
        await db.fitnessProfiles.put({ ...localProfile, id: r.id, isDirty: true });
      }
    }

    const dirtyProfiles = (await db.fitnessProfiles.where('userId').equals(userId).toArray()).filter(
      (p) => p.isDirty
    );

    if (dirtyProfiles.length > 0) {
      const payloads = dirtyProfiles.map((p) => ({
        id: p.id,
        user_id: userId,
        height_cm: p.heightCm ?? null,
        current_weight_kg: p.currentWeightKg ?? null,
        target_weight_kg: p.targetWeightKg ?? null,
        starting_weight_kg: p.startingWeightKg ?? null,
        target_waist_inches: p.targetWaistInches ?? null,
        calorie_target: p.calorieTarget,
        protein_target_g: p.proteinTargetG,
        carbs_target_g: p.carbsTargetG ?? null,
        fat_target_g: p.fatTargetG ?? null,
        water_target_ml: p.waterTargetMl,
        steps_target: p.stepsTarget,
        sleep_target_hours: p.sleepTargetHours,
        activity_level: p.activityLevel,
        goal_type: p.goalType,
        diet_preference: p.dietPreference,
        gym_schedule_days: p.gymScheduleDays ?? [1, 2, 3, 4, 5, 6],
        low_energy_calorie_ceiling: p.lowEnergyCalorieCeiling ?? null,
        low_energy_steps_target: p.lowEnergyStepsTarget ?? 3500,
        deleted_at: p.deletedAt ?? null,
        generation_counter: toNum(p.generationCounter, 1),
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      }));

      const ok = await this.pushBatched(supabase, 'fitness_profiles', payloads, {
        onConflict: 'user_id',
      });
      if (ok) {
        for (const p of dirtyProfiles) {
          await db.fitnessProfiles.update(p.id, { isDirty: false });
          pushed++;
        }
      }
    }

    return { pushed, pulled };
  }

  async syncDailyLogs(supabase: any, userId: string): Promise<{ pushed: number; pulled: number }> {
    let pushed = 0;
    let pulled = 0;
    await this.deduplicateDailyLogs(userId);

    // 1. Pull FIRST so partial daily edits merge cleanly instead of overwriting remote fields
    const remoteRows = await this.pullTable(supabase, 'fitness_daily_logs', userId);
    if (remoteRows === null) return { pushed, pulled };

    const localLogs = await db.fitnessDailyLogs.where('userId').equals(userId).toArray();
    const localByDate = new Map(localLogs.map((row) => [row.date, row]));
    const localById = new Map(localLogs.map((row) => [row.id, row]));

    for (const r of remoteRows) {
      const localMatch = localByDate.get(r.date) || localById.get(r.id);

      if (!localMatch) {
        const mapped: FitnessDailyLog = {
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
          createdAt: r.created_at || new Date().toISOString(),
          updatedAt: r.updated_at || new Date().toISOString(),
        };
        await db.fitnessDailyLogs.put(mapped);
        localByDate.set(mapped.date, mapped);
        pulled++;
        continue;
      }

      if (localMatch.isDirty) {
        const { merged } = mergeDailyLogWithRemote(localMatch, r);
        if (localMatch.id !== merged.id) {
          await db.fitnessDailyLogs.delete(localMatch.id);
        }
        await db.fitnessDailyLogs.put(merged);
        localByDate.set(merged.date, merged);
        pulled++;
      } else if (shouldApplyRemoteRecord(localMatch, r)) {
        const mapped: FitnessDailyLog = {
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
          createdAt: r.created_at || localMatch.createdAt || new Date().toISOString(),
          updatedAt: r.updated_at || new Date().toISOString(),
        };
        if (localMatch.id !== mapped.id) {
          await db.fitnessDailyLogs.delete(localMatch.id);
        }
        await db.fitnessDailyLogs.put(mapped);
        localByDate.set(mapped.date, mapped);
        pulled++;
      }
    }

    await this.deduplicateDailyLogs(userId);

    // 2. Push remaining dirty daily logs (already merged against remote)
    const dirtyLogs = (await db.fitnessDailyLogs.where('userId').equals(userId).toArray()).filter(
      (row) => row.isDirty
    );

    if (dirtyLogs.length > 0) {
      const payloads = dirtyLogs.map((l) => ({
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
      }));

      const ok = await this.pushBatched(supabase, 'fitness_daily_logs', payloads, {
        onConflict: 'user_id,date',
      });
      if (ok) {
        for (const l of dirtyLogs) {
          await db.fitnessDailyLogs.update(l.id, { isDirty: false });
          pushed++;
        }
      }
    }

    return { pushed, pulled };
  }

  async syncMealTemplates(supabase: any, userId: string): Promise<{ pushed: number; pulled: number }> {
    let pushed = 0;
    let pulled = 0;

    const dirty = (await db.mealTemplates.where('userId').equals(userId).toArray()).filter(
      (row) => row.isDirty
    );
    if (dirty.length > 0) {
      const payloads = dirty.map((t) => ({
        id: t.id,
        user_id: userId,
        name: t.name,
        hindi_aliases: Array.isArray(t.hindiAliases) ? t.hindiAliases : [],
        calories: Math.round(toNum(t.calories, 0)),
        protein_g: toNum(t.proteinG, 0),
        carbs_g: toNum(t.carbsG, 0),
        fat_g: toNum(t.fatG, 0),
        fiber_g: toNullableNum(t.fiberG),
        serving_label: t.servingLabel || '1 serving',
        meal_type: t.mealType ?? null,
        is_junk: Boolean(t.isJunk),
        is_pinned: Boolean(t.isPinned),
        order_index: toNum(t.order, 0),
        deleted_at: t.deletedAt ?? null,
        generation_counter: toNum(t.generationCounter, 1),
        created_at: t.createdAt,
        updated_at: t.updatedAt,
      }));
      const ok = await this.pushBatched(supabase, 'meal_templates', payloads);
      if (ok) {
        for (const t of dirty) {
          await db.mealTemplates.update(t.id, { isDirty: false });
          pushed++;
        }
      }
    }

    const remoteRows = await this.pullTable(supabase, 'meal_templates', userId);
    if (remoteRows === null) return { pushed, pulled };

    const localMap = new Map(
      (await db.mealTemplates.where('userId').equals(userId).toArray()).map((x) => [x.id, x])
    );

    for (const r of remoteRows) {
      const local = localMap.get(r.id);
      if (!local || (!local.isDirty && shouldApplyRemoteRecord(local, r))) {
        const mapped: MealTemplate = {
          id: r.id,
          userId: r.user_id,
          name: r.name,
          hindiAliases: Array.isArray(r.hindi_aliases) ? r.hindi_aliases : [],
          calories: toNum(r.calories, 0),
          proteinG: toNum(r.protein_g, 0),
          carbsG: toNum(r.carbs_g, 0),
          fatG: toNum(r.fat_g, 0),
          fiberG: toNullableNum(r.fiber_g),
          servingLabel: r.serving_label || '1 serving',
          mealType: r.meal_type ?? null,
          isJunk: Boolean(r.is_junk),
          isPinned: Boolean(r.is_pinned),
          order: toNum(r.order_index, 0),
          deletedAt: r.deleted_at ?? null,
          generationCounter: toNum(r.generation_counter, 1),
          isDirty: false,
          createdAt: r.created_at || new Date().toISOString(),
          updatedAt: r.updated_at || new Date().toISOString(),
        };
        await db.mealTemplates.put(mapped);
        pulled++;
      }
    }

    return { pushed, pulled };
  }

  async syncMealLogs(supabase: any, userId: string): Promise<{ pushed: number; pulled: number }> {
    let pushed = 0;
    let pulled = 0;

    const dirty = (await db.mealLogs.where('userId').equals(userId).toArray()).filter(
      (row) => row.isDirty
    );
    if (dirty.length > 0) {
      const payloads = dirty.map((m) => ({
        id: m.id,
        user_id: userId,
        date: m.date,
        meal_type: m.mealType || 'snack',
        name: m.name,
        calories: Math.round(toNum(m.calories, 0)),
        protein_g: toNum(m.proteinG, 0),
        carbs_g: toNum(m.carbsG, 0),
        fat_g: toNum(m.fatG, 0),
        fiber_g: toNullableNum(m.fiberG),
        quantity_multiplier: toNum(m.quantityMultiplier, 1),
        is_junk: Boolean(m.isJunk),
        template_id: m.templateId ?? null,
        linked_transaction_id: m.linkedTransactionId ?? null,
        source: m.source || 'manual',
        notes: m.notes ?? null,
        logged_at: m.loggedAt || m.createdAt,
        deleted_at: m.deletedAt ?? null,
        generation_counter: toNum(m.generationCounter, 1),
        created_at: m.createdAt,
        updated_at: m.updatedAt,
      }));
      const ok = await this.pushBatched(supabase, 'meal_logs', payloads);
      if (ok) {
        for (const m of dirty) {
          await db.mealLogs.update(m.id, { isDirty: false });
          pushed++;
        }
      }
    }

    const remoteRows = await this.pullTable(supabase, 'meal_logs', userId);
    if (remoteRows === null) return { pushed, pulled };

    const localMap = new Map(
      (await db.mealLogs.where('userId').equals(userId).toArray()).map((x) => [x.id, x])
    );

    for (const r of remoteRows) {
      const local = localMap.get(r.id);
      if (!local || (!local.isDirty && shouldApplyRemoteRecord(local, r))) {
        const mapped: MealLog = {
          id: r.id,
          userId: r.user_id,
          date: r.date,
          mealType: r.meal_type || 'snack',
          name: r.name,
          calories: toNum(r.calories, 0),
          proteinG: toNum(r.protein_g, 0),
          carbsG: toNum(r.carbs_g, 0),
          fatG: toNum(r.fat_g, 0),
          fiberG: toNullableNum(r.fiber_g),
          quantityMultiplier: toNum(r.quantity_multiplier, 1),
          isJunk: Boolean(r.is_junk),
          templateId: r.template_id ?? null,
          linkedTransactionId: r.linked_transaction_id ?? null,
          source: r.source || 'manual',
          notes: r.notes ?? null,
          loggedAt: r.logged_at || r.created_at || new Date().toISOString(),
          deletedAt: r.deleted_at ?? null,
          generationCounter: toNum(r.generation_counter, 1),
          isDirty: false,
          createdAt: r.created_at || new Date().toISOString(),
          updatedAt: r.updated_at || new Date().toISOString(),
        };
        await db.mealLogs.put(mapped);
        pulled++;
      }
    }

    return { pushed, pulled };
  }

  async syncWorkoutSessions(supabase: any, userId: string): Promise<{ pushed: number; pulled: number }> {
    let pushed = 0;
    let pulled = 0;

    const dirty = (await db.workoutSessions.where('userId').equals(userId).toArray()).filter(
      (row) => row.isDirty
    );
    if (dirty.length > 0) {
      const payloads = dirty.map((w) => ({
        id: w.id,
        user_id: userId,
        date: w.date,
        title: w.title,
        workout_type: w.workoutType || 'strength',
        duration_minutes: Math.round(toNum(w.durationMinutes, 0)),
        estimated_calories_burned: toNullableNum(w.estimatedCaloriesBurned),
        exercises: Array.isArray(w.exercises) ? w.exercises : [],
        rpe: toNullableNum(w.rpe),
        notes: w.notes ?? null,
        source: w.source || 'manual',
        deleted_at: w.deletedAt ?? null,
        generation_counter: toNum(w.generationCounter, 1),
        created_at: w.createdAt,
        updated_at: w.updatedAt,
      }));
      const ok = await this.pushBatched(supabase, 'workout_sessions', payloads);
      if (ok) {
        for (const w of dirty) {
          await db.workoutSessions.update(w.id, { isDirty: false });
          pushed++;
        }
      }
    }

    const remoteRows = await this.pullTable(supabase, 'workout_sessions', userId);
    if (remoteRows === null) return { pushed, pulled };

    const localMap = new Map(
      (await db.workoutSessions.where('userId').equals(userId).toArray()).map((x) => [x.id, x])
    );

    for (const r of remoteRows) {
      const local = localMap.get(r.id);
      if (!local || (!local.isDirty && shouldApplyRemoteRecord(local, r))) {
        const mapped: WorkoutSession = {
          id: r.id,
          userId: r.user_id,
          date: r.date,
          title: r.title,
          workoutType: r.workout_type || 'strength',
          durationMinutes: toNum(r.duration_minutes, 0),
          estimatedCaloriesBurned: toNullableNum(r.estimated_calories_burned),
          exercises: Array.isArray(r.exercises) ? r.exercises : [],
          rpe: toNullableNum(r.rpe),
          notes: r.notes ?? null,
          source: r.source || 'manual',
          deletedAt: r.deleted_at ?? null,
          generationCounter: toNum(r.generation_counter, 1),
          isDirty: false,
          createdAt: r.created_at || new Date().toISOString(),
          updatedAt: r.updated_at || new Date().toISOString(),
        };
        await db.workoutSessions.put(mapped);
        pulled++;
      }
    }

    return { pushed, pulled };
  }

  async syncSupplementInventory(
    supabase: any,
    userId: string
  ): Promise<{ pushed: number; pulled: number }> {
    let pushed = 0;
    let pulled = 0;

    const dirty = (await db.supplementInventory.where('userId').equals(userId).toArray()).filter(
      (row) => row.isDirty
    );
    if (dirty.length > 0) {
      const payloads = dirty.map((s) => ({
        id: s.id,
        user_id: userId,
        name: s.name,
        brand: s.brand ?? null,
        category: s.category || 'other',
        unit_label: s.unitLabel || 'scoop',
        total_servings: toNum(s.totalServings, 30),
        remaining_servings: toNum(s.remainingServings, 30),
        daily_dosage: toNum(s.dailyDosage, 1),
        cost_inr: toNum(s.costInr, 0),
        protein_per_serving_g: toNullableNum(s.proteinPerServingG),
        manual_adjustment: toNum(s.manualAdjustment, 0),
        anchor_block: s.anchorBlock ?? null,
        low_stock_threshold_days: Math.round(toNum(s.lowStockThresholdDays, 7)),
        linked_transaction_id: s.linkedTransactionId ?? null,
        last_restocked_at: s.lastRestockedAt ?? null,
        is_active: Boolean(s.isActive),
        notes: s.notes ?? null,
        deleted_at: s.deletedAt ?? null,
        generation_counter: toNum(s.generationCounter, 1),
        created_at: s.createdAt,
        updated_at: s.updatedAt,
      }));
      const ok = await this.pushBatched(supabase, 'supplement_inventory', payloads);
      if (ok) {
        for (const s of dirty) {
          await db.supplementInventory.update(s.id, { isDirty: false });
          pushed++;
        }
      }
    }

    const remoteRows = await this.pullTable(supabase, 'supplement_inventory', userId);
    if (remoteRows === null) return { pushed, pulled };

    const localMap = new Map(
      (await db.supplementInventory.where('userId').equals(userId).toArray()).map((x) => [x.id, x])
    );

    for (const r of remoteRows) {
      const local = localMap.get(r.id);
      if (!local || (!local.isDirty && shouldApplyRemoteRecord(local, r))) {
        const mapped: SupplementInventory = {
          id: r.id,
          userId: r.user_id,
          name: r.name,
          brand: r.brand ?? null,
          category: r.category || 'other',
          unitLabel: r.unit_label || 'scoop',
          totalServings: toNum(r.total_servings, 30),
          remainingServings: toNum(r.remaining_servings, 30),
          dailyDosage: toNum(r.daily_dosage, 1),
          costInr: toNum(r.cost_inr, 0),
          proteinPerServingG: toNullableNum(r.protein_per_serving_g),
          manualAdjustment: toNum(r.manual_adjustment, 0),
          anchorBlock: r.anchor_block ?? null,
          lowStockThresholdDays: toNum(r.low_stock_threshold_days, 7),
          linkedTransactionId: r.linked_transaction_id ?? null,
          lastRestockedAt: r.last_restocked_at ?? null,
          isActive: r.is_active !== false,
          notes: r.notes ?? null,
          deletedAt: r.deleted_at ?? null,
          generationCounter: toNum(r.generation_counter, 1),
          isDirty: false,
          createdAt: r.created_at || new Date().toISOString(),
          updatedAt: r.updated_at || new Date().toISOString(),
        };
        await db.supplementInventory.put(mapped);
        pulled++;
      }
    }

    return { pushed, pulled };
  }

  async syncSupplementLogs(supabase: any, userId: string): Promise<{ pushed: number; pulled: number }> {
    let pushed = 0;
    let pulled = 0;

    const dirty = (await db.supplementLogs.where('userId').equals(userId).toArray()).filter(
      (row) => row.isDirty
    );
    if (dirty.length > 0) {
      const payloads = dirty.map((l) => ({
        id: l.id,
        user_id: userId,
        supplement_id: l.supplementId,
        date: l.date,
        servings_taken: toNum(l.servingsTaken, 1),
        taken_at: l.takenAt || l.createdAt,
        notes: l.notes ?? null,
        deleted_at: l.deletedAt ?? null,
        generation_counter: toNum(l.generationCounter, 1),
        created_at: l.createdAt,
        updated_at: l.updatedAt,
      }));
      const ok = await this.pushBatched(supabase, 'supplement_logs', payloads);
      if (ok) {
        for (const l of dirty) {
          await db.supplementLogs.update(l.id, { isDirty: false });
          pushed++;
        }
      }
    }

    const remoteRows = await this.pullTable(supabase, 'supplement_logs', userId);
    if (remoteRows === null) return { pushed, pulled };

    const localMap = new Map(
      (await db.supplementLogs.where('userId').equals(userId).toArray()).map((x) => [x.id, x])
    );

    for (const r of remoteRows) {
      const local = localMap.get(r.id);
      if (!local || (!local.isDirty && shouldApplyRemoteRecord(local, r))) {
        const mapped: SupplementLog = {
          id: r.id,
          userId: r.user_id,
          supplementId: r.supplement_id,
          date: r.date,
          servingsTaken: toNum(r.servings_taken, 1),
          takenAt: r.taken_at || r.created_at || new Date().toISOString(),
          notes: r.notes ?? null,
          deletedAt: r.deleted_at ?? null,
          generationCounter: toNum(r.generation_counter, 1),
          isDirty: false,
          createdAt: r.created_at || new Date().toISOString(),
          updatedAt: r.updated_at || new Date().toISOString(),
        };
        await db.supplementLogs.put(mapped);
        pulled++;
      }
    }

    return { pushed, pulled };
  }

  async sync(userId: string): Promise<FitnessSyncResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let pushed = 0;
    let pulled = 0;

    if (!userId || userId === 'local-demo-user') {
      return {
        domain: this.domainName,
        pushed: 0,
        pulled: 0,
        status: 'success',
        errors: [],
        durationMs: Date.now() - startTime,
      };
    }

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        return {
          domain: this.domainName,
          pushed: 0,
          pulled: 0,
          status: 'success',
          errors: [],
          durationMs: Date.now() - startTime,
        };
      }

      await this.migrateOrphanedRecords(userId);

      // Push/pull in dependency order
      const steps = [
        () => this.syncProfiles(supabase, userId),
        () => this.syncDailyLogs(supabase, userId),
        () => this.syncMealTemplates(supabase, userId),
        () => this.syncMealLogs(supabase, userId),
        () => this.syncWorkoutSessions(supabase, userId),
        () => this.syncSupplementInventory(supabase, userId),
        () => this.syncSupplementLogs(supabase, userId),
      ];

      for (const runStep of steps) {
        try {
          const res = await runStep();
          pushed += res.pushed;
          pulled += res.pulled;
        } catch (err: any) {
          this.log('error', 'Fitness sync step failed', err);
          errors.push(err?.message || String(err));
        }
      }
    } catch (err: any) {
      this.log('error', 'Fitness sync failed', err);
      errors.push(err?.message || String(err));
    }

    return {
      domain: this.domainName,
      pushed,
      pulled,
      status: errors.length > 0 ? 'partial_failure' : 'success',
      errors,
      durationMs: Date.now() - startTime,
    };
  }
}

export async function syncFitnessWithRetry(engine: any): Promise<FitnessSyncResult> {
  const userId = engine?.userId;
  if (!userId || userId === 'local-demo-user') {
    return {
      domain: 'Fitness',
      pushed: 0,
      pulled: 0,
      status: 'success',
      errors: [],
      durationMs: 0,
    };
  }

  const syncEngine = new FitnessSyncEngine();
  const report = await syncEngine.sync(userId);

  if (report.pulled > 0 || report.pushed > 0) {
    try {
      const { useFitnessStore } = await import('@/lib/stores/fitness');
      await useFitnessStore.getState().loadFitnessData(userId);
    } catch (e) {
      engine?.log?.('warn', 'Failed to refresh fitness store after sync', e);
    }
  }

  return report;
}
