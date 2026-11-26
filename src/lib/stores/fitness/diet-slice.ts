import { db } from '@/lib/db';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { logger } from '@/lib/logger';
import { estimateHinglishFoodMacros } from '@/lib/fitness/meal-estimator';
import type { MealLog, MealTemplate } from '@/lib/types';
import type { FitnessSliceCreator, FitnessStoreActions } from './types';
import { seedStarterStaplesImpl } from './diet/staple-seeder';
import {
  autoSyncProteinSupplement,
  buildNewMealLog,
  buildNewMealTemplate,
  buildTemplateMealInput,
  buildUpdatedMealLog,
  emitMealMediatorEvent,
} from './diet/diet-helpers';

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

const linkedTxLocks = new Map<string, Promise<MealLog>>();

async function withLinkedTxLock(
  transactionId: string,
  fn: () => Promise<MealLog>
): Promise<MealLog> {
  const previous = linkedTxLocks.get(transactionId);
  const run = (previous ? previous.catch(() => undefined) : Promise.resolve()).then(fn);
  linkedTxLocks.set(transactionId, run);
  try {
    return await run;
  } finally {
    if (linkedTxLocks.get(transactionId) === run) linkedTxLocks.delete(transactionId);
  }
}

function sortMealsDesc(meals: MealLog[]): MealLog[] {
  return meals.sort((a, b) => b.date.localeCompare(a.date) || b.loggedAt.localeCompare(a.loggedAt));
}

async function findLinkedMeal(linkedTransactionId: string, memoryMeals: MealLog[]) {
  const inDb = await db.mealLogs
    .where('linkedTransactionId')
    .equals(linkedTransactionId)
    .filter((m) => !m.deletedAt)
    .first();
  return inDb || memoryMeals.find((m) => m.linkedTransactionId === linkedTransactionId && !m.deletedAt);
}

function buildCaptureMealUpdate(
  existing: MealLog,
  params: Parameters<FitnessStoreActions['upsertMealFromCapture']>[0],
  now: string
): MealLog {
  return {
    ...existing,
    date: params.date,
    mealType: params.mealType || existing.mealType,
    name: params.name.trim() || existing.name,
    calories: Math.max(0, Math.round(params.calories)),
    proteinG: Math.max(0, Number(params.proteinG.toFixed(1))),
    carbsG: Math.max(0, Number((params.carbsG ?? existing.carbsG).toFixed(1))),
    fatG: Math.max(0, Number((params.fatG ?? existing.fatG).toFixed(1))),
    isJunk: params.isJunk ?? existing.isJunk,
    templateId: params.templateId ?? existing.templateId ?? null,
    source: params.source || 'universal_capture',
    notes: params.notes ?? existing.notes ?? null,
    generationCounter: (existing.generationCounter || 1) + 1,
    isDirty: true,
    updatedAt: now,
  };
}

async function softDeleteEntity<T extends { id: string; generationCounter?: number }>(params: {
  id: string;
  existing: T | undefined;
  updateInDb: (id: string, changes: { deletedAt: string; updatedAt: string; isDirty: true; generationCounter: number }) => Promise<unknown>;
  removeFromState: () => void;
}): Promise<T | null> {
  if (!params.existing) return null;
  const now = new Date().toISOString();
  await params.updateInDb(params.id, {
    deletedAt: now,
    updatedAt: now,
    isDirty: true,
    generationCounter: (params.existing.generationCounter || 1) + 1,
  });
  params.removeFromState();
  notifyFitnessSync();
  return params.existing;
}

export const createDietSlice: FitnessSliceCreator<
  Pick<
    FitnessStoreActions,
    | 'seedStarterStaplesIfEmpty'
    | 'addMealLog'
    | 'updateMealLog'
    | 'deleteMealLog'
    | 'logFromTemplate'
    | 'addMealTemplate'
    | 'updateMealTemplate'
    | 'deleteMealTemplate'
    | 'ensureMealForJunkTransaction'
    | 'upsertMealFromCapture'
    | 'linkMealToTransaction'
  >
> = (set, get) => ({
  seedStarterStaplesIfEmpty: (userId) =>
    seedStarterStaplesImpl(userId, (mealTemplates) => {
      set({ mealTemplates });
      notifyFitnessSync();
    }),

  addMealLog: async (data, userIdOverride) => {
    const userId = resolveUserId(userIdOverride, get().currentUserId);
    const meal = buildNewMealLog({
      data,
      userId,
      date: data.date || getLocalIsoDate(),
      now: new Date().toISOString(),
    });

    await db.mealLogs.put(meal);
    set((state) => ({ mealLogs: sortMealsDesc([meal, ...state.mealLogs]), currentUserId: userId }));
    notifyFitnessSync();

    await autoSyncProteinSupplement({
      meal,
      userId,
      memoryInventory: get().supplementInventory,
      memoryLogs: get().supplementLogs,
      takeSupplementDose: get().takeSupplementDose,
    });
    await emitMealMediatorEvent(meal.date, meal.isJunk);
    return meal;
  },

  updateMealLog: async (id, patch) => {
    const existing = get().mealLogs.find((m) => m.id === id) || (await db.mealLogs.get(id));
    if (!existing) return null;

    const updated = buildUpdatedMealLog(existing, patch, new Date().toISOString());
    await db.mealLogs.put(updated);
    set((state) => ({ mealLogs: sortMealsDesc(state.mealLogs.map((m) => (m.id === id ? updated : m))) }));
    notifyFitnessSync();

    await emitMealMediatorEvent(updated.date, updated.isJunk);
    if (existing.date.slice(0, 10) !== updated.date.slice(0, 10)) {
      await emitMealMediatorEvent(existing.date, existing.isJunk);
    }
    return updated;
  },

  deleteMealLog: async (id) => {
    const existing = get().mealLogs.find((m) => m.id === id) || (await db.mealLogs.get(id));
    const deleted = await softDeleteEntity({
      id,
      existing,
      updateInDb: (docId, changes) => db.mealLogs.update(docId, changes),
      removeFromState: () =>
        set((state) => ({ mealLogs: state.mealLogs.filter((m) => m.id !== id) })),
    });
    if (deleted) await emitMealMediatorEvent(deleted.date, false);
  },

  logFromTemplate: async (templateId, options, userIdOverride) => {
    const template =
      get().mealTemplates.find((t) => t.id === templateId && !t.deletedAt) ||
      (await db.mealTemplates.get(templateId));
    if (!template || template.deletedAt) return null;
    return get().addMealLog(
      buildTemplateMealInput(template, options),
      userIdOverride || template.userId
    );
  },

  addMealTemplate: async (data, userIdOverride) => {
    const userId = resolveUserId(userIdOverride, get().currentUserId);
    const maxOrder = get().mealTemplates.reduce((max, t) => Math.max(max, t.order), -1);
    const tpl = buildNewMealTemplate({ data, userId, maxOrder, now: new Date().toISOString() });

    await db.mealTemplates.put(tpl);
    set((state) => ({
      mealTemplates: [...state.mealTemplates, tpl].sort((a, b) => a.order - b.order),
      currentUserId: userId,
    }));
    notifyFitnessSync();
    return tpl;
  },

  updateMealTemplate: async (id, patch) => {
    const existing =
      get().mealTemplates.find((t) => t.id === id) || (await db.mealTemplates.get(id));
    if (!existing) return null;

    const updated: MealTemplate = {
      ...existing,
      ...patch,
      name: patch.name !== undefined ? patch.name.trim() : existing.name,
      generationCounter: (existing.generationCounter || 1) + 1,
      isDirty: true,
      updatedAt: new Date().toISOString(),
    };
    await db.mealTemplates.put(updated);
    set((state) => ({
      mealTemplates: state.mealTemplates
        .map((t) => (t.id === id ? updated : t))
        .sort((a, b) => a.order - b.order),
    }));
    notifyFitnessSync();
    return updated;
  },

  deleteMealTemplate: async (id) => {
    const existing =
      get().mealTemplates.find((t) => t.id === id) || (await db.mealTemplates.get(id));
    await softDeleteEntity({
      id,
      existing,
      updateInDb: (docId, changes) => db.mealTemplates.update(docId, changes),
      removeFromState: () =>
        set((state) => ({ mealTemplates: state.mealTemplates.filter((t) => t.id !== id) })),
    });
  },

  ensureMealForJunkTransaction: ({ transactionId, userId, date, title, amountInr, notes }) =>
    withLinkedTxLock(transactionId, async () => {
      const existing = await findLinkedMeal(transactionId, get().mealLogs);
      if (existing) return existing;

      const estimate = estimateHinglishFoodMacros(title, { amountInr, forceJunk: true });
      return get().addMealLog(
        {
          date,
          mealType: estimate.mealType,
          name: title.trim() || estimate.name,
          calories: estimate.calories,
          proteinG: estimate.proteinG,
          carbsG: estimate.carbsG,
          fatG: estimate.fatG,
          isJunk: true,
          linkedTransactionId: transactionId,
          source: 'finance_bridge',
          notes: notes || `Auto-logged from Junk Food expense (₹${Math.round(amountInr)})`,
        },
        userId
      );
    }),

  upsertMealFromCapture: async (params) => {
    const userId = resolveUserId(params.userId, get().currentUserId);
    const run = async (): Promise<MealLog> => {
      if (params.linkedTransactionId) {
        const existing = await findLinkedMeal(params.linkedTransactionId, get().mealLogs);
        if (existing) {
          const updated = buildCaptureMealUpdate(existing, params, new Date().toISOString());
          await db.mealLogs.put(updated);
          set((state) => ({
            mealLogs: sortMealsDesc(state.mealLogs.map((m) => (m.id === updated.id ? updated : m))),
            currentUserId: userId,
          }));
          notifyFitnessSync();
          await emitMealMediatorEvent(updated.date, updated.isJunk);
          return updated;
        }
      }
      return get().addMealLog(
        {
          date: params.date,
          mealType: params.mealType || 'snack',
          name: params.name,
          calories: params.calories,
          proteinG: params.proteinG,
          carbsG: params.carbsG ?? 0,
          fatG: params.fatG ?? 0,
          isJunk: Boolean(params.isJunk),
          templateId: params.templateId ?? null,
          linkedTransactionId: params.linkedTransactionId ?? null,
          source: params.source || 'universal_capture',
          notes: params.notes ?? null,
        },
        userId
      );
    };

    return params.linkedTransactionId ? withLinkedTxLock(params.linkedTransactionId, run) : run();
  },

  linkMealToTransaction: async (mealId, transactionId) => {
    const existing = get().mealLogs.find((m) => m.id === mealId) || (await db.mealLogs.get(mealId));
    if (!existing || existing.deletedAt) return null;
    const normalizedTxId = transactionId ?? null;
    if ((existing.linkedTransactionId ?? null) === normalizedTxId) return existing;

    const updated: MealLog = {
      ...existing,
      linkedTransactionId: normalizedTxId,
      generationCounter: (existing.generationCounter || 1) + 1,
      isDirty: true,
      updatedAt: new Date().toISOString(),
    };
    await db.mealLogs.put(updated);
    set((state) => ({ mealLogs: sortMealsDesc(state.mealLogs.map((m) => (m.id === mealId ? updated : m))) }));
    notifyFitnessSync();
    return updated;
  },
});
