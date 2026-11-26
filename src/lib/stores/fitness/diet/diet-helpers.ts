import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  buildAutoMealSupplementNoteTag,
  hasAutoMealSupplementLog,
  matchProteinMealToSupplement,
} from '@/lib/fitness/supplement-meal-bridge';
import type {
  MealLog,
  MealLogFormData,
  SupplementInventory,
  SupplementLog,
} from '@/lib/types';
import { roundMacro } from './diet-builders';
export { buildNewMealTemplate, buildTemplateMealInput } from './diet-builders';

export function buildNewMealLog(params: {
  data: MealLogFormData;
  userId: string;
  date: string;
  now: string;
}): MealLog {
  const { data, userId, date, now } = params;
  return {
    id: crypto.randomUUID(),
    userId,
    date,
    mealType: data.mealType || 'snack',
    name: data.name.trim(),
    calories: Math.max(0, Math.round(Number(data.calories) || 0)),
    proteinG: roundMacro(data.proteinG),
    carbsG: roundMacro(data.carbsG),
    fatG: roundMacro(data.fatG),
    fiberG: data.fiberG ?? null,
    quantityMultiplier: Math.max(0.25, Number(data.quantityMultiplier || 1)),
    isJunk: Boolean(data.isJunk),
    templateId: data.templateId ?? null,
    linkedTransactionId: data.linkedTransactionId ?? null,
    source: data.source || 'manual',
    notes: data.notes ?? null,
    loggedAt: data.loggedAt || now,
    deletedAt: null,
    generationCounter: 1,
    isDirty: true,
    createdAt: now,
    updatedAt: now,
  };
}

function roundIfDefined(val: number | undefined): number | undefined {
  return val !== undefined ? roundMacro(val) : undefined;
}

function applyMacroPatch(normalized: Partial<MealLog>, patch: Partial<MealLog>): void {
  for (const key of ['proteinG', 'carbsG', 'fatG'] as const) {
    const val = roundIfDefined(patch[key]);
    if (val !== undefined) normalized[key] = val;
  }
}

function normalizeMealPatchFields(patch: Partial<MealLog>): Partial<MealLog> {
  const normalized: Partial<MealLog> = { ...patch };
  if (patch.name !== undefined) normalized.name = patch.name.trim();
  if (patch.calories !== undefined) {
    normalized.calories = Math.max(0, Math.round(Number(patch.calories) || 0));
  }
  applyMacroPatch(normalized, patch);
  if (patch.quantityMultiplier !== undefined) {
    normalized.quantityMultiplier = Math.max(0.25, Number(patch.quantityMultiplier) || 1);
  }
  if (patch.isJunk !== undefined) normalized.isJunk = Boolean(patch.isJunk);
  return normalized;
}

export function buildUpdatedMealLog(
  existing: MealLog,
  patch: Partial<MealLog>,
  now: string
): MealLog {
  return {
    ...existing,
    ...normalizeMealPatchFields(patch),
    generationCounter: (existing.generationCounter || 1) + 1,
    isDirty: true,
    updatedAt: now,
  };
}

export async function emitMealMediatorEvent(date: string, isJunk: boolean): Promise<void> {
  try {
    const { CrossDomainActionMediator } = await import('../../mediator');
    await CrossDomainActionMediator.onFitnessEvent({ type: 'MEAL_LOGGED', date, isJunk });
  } catch (err) {
    logger.warn('[FitnessStore] Meal mediator skipped:', err);
  }
}

async function loadSupplementInventory(
  memoryInventory: SupplementInventory[],
  userId: string
): Promise<SupplementInventory[]> {
  if (memoryInventory.length > 0) return memoryInventory;
  if (!db.supplementInventory) return [];
  return db.supplementInventory.where('userId').equals(userId).filter((s) => !s.deletedAt).toArray();
}

async function loadSupplementLogs(
  memoryLogs: SupplementLog[],
  supplementId: string
): Promise<SupplementLog[]> {
  if (memoryLogs.length > 0) return memoryLogs;
  if (!db.supplementLogs) return [];
  return db.supplementLogs
    .where('supplementId')
    .equals(supplementId)
    .filter((l) => !l.deletedAt)
    .toArray();
}

export async function autoSyncProteinSupplement(params: {
  meal: MealLog;
  userId: string;
  memoryInventory: SupplementInventory[];
  memoryLogs: SupplementLog[];
  takeSupplementDose: (
    supplementId: string,
    params?: { servings?: number; date?: string; notes?: string | null; userIdOverride?: string }
  ) => Promise<unknown>;
}): Promise<void> {
  const { meal, userId, memoryInventory, memoryLogs, takeSupplementDose } = params;
  if (meal.isJunk) return;
  try {
    const supInventory = await loadSupplementInventory(memoryInventory, userId);
    const supMatch = matchProteinMealToSupplement(meal, supInventory);
    if (!supMatch) return;

    const existingLogs = await loadSupplementLogs(memoryLogs, supMatch.supplement.id);
    if (hasAutoMealSupplementLog(existingLogs, meal.id, supMatch.supplement.id)) return;

    await takeSupplementDose(supMatch.supplement.id, {
      servings: supMatch.servings,
      date: meal.date,
      notes: `Auto-synced from meal: ${meal.name} ${buildAutoMealSupplementNoteTag(meal.id)}`,
      userIdOverride: userId,
    });
  } catch (err) {
    logger.warn('[FitnessStore] Meal->Supplement auto-sync skipped:', err);
  }
}
