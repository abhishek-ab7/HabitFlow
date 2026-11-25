import { db } from '@/lib/db';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { logger } from '@/lib/logger';
import {
  estimateHinglishFoodMacros,
  STARTER_INDIAN_STAPLES,
} from '@/lib/fitness/meal-estimator';
import {
  buildAutoMealSupplementNoteTag,
  hasAutoMealSupplementLog,
  matchProteinMealToSupplement,
} from '@/lib/fitness/supplement-meal-bridge';
import type { MealLog, MealTemplate } from '@/lib/types';
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

// Per-transaction serialized lock preventing duplicate Junk Food meals when
// Universal Capture + Finance Mediator fire concurrently.
const linkedTxLocks = new Map<string, Promise<MealLog>>();
const seedingStarterLocks = new Map<string, Promise<void>>();

/**
 * Produces a deterministic RFC-4122-shaped UUID from userId + staple name
 * so multiple devices never generate distinct UUIDs for the same starter staple.
 */
function buildStarterTemplateUuid(userId: string, name: string): string {
  const input = `habitflow:starter_staple:${userId}:${name.trim().toLowerCase()}`;
  const seeds = [0x811c9dc5, 0x9e3779b1, 0x85ebca77, 0xc2b2ae3d];
  const hexParts: string[] = [];
  for (let s = 0; s < seeds.length; s++) {
    let hash = seeds[s] >>> 0;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    hexParts.push(hash.toString(16).padStart(8, '0'));
  }
  const raw = hexParts.join('');
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-8${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}

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
    if (linkedTxLocks.get(transactionId) === run) {
      linkedTxLocks.delete(transactionId);
    }
  }
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
  seedStarterStaplesIfEmpty: async (userId) => {
    if (!userId) return;
    const inflight = seedingStarterLocks.get(userId);
    if (inflight) return inflight;

    const run = (async () => {
      const flagKey = `hf_fitness_staples_seeded_${userId}`;
      const storage =
        typeof window !== 'undefined' &&
        window.localStorage &&
        typeof window.localStorage.getItem === 'function' &&
        typeof window.localStorage.setItem === 'function'
          ? window.localStorage
          : null;

      if (storage?.getItem(flagKey)) {
        return;
      }

      const totalEver = await db.mealTemplates.where('userId').equals(userId).count();
      if (totalEver > 0) {
        storage?.setItem(flagKey, '1');
        return;
      }

      // If authenticated and online, verify Supabase has no templates (including soft-deleted tombstones)
      // before seeding starters on a fresh browser/device.
      if (
        userId !== 'local-demo-user' &&
        (typeof navigator === 'undefined' || navigator.onLine !== false)
      ) {
        try {
          const { getSupabaseClient } = await import('@/lib/supabase/client');
          const supabase = getSupabaseClient();
          if (supabase && typeof supabase.from === 'function') {
            const { count, error } = await (supabase.from('meal_templates') as any)
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId);
            if (!error && typeof count === 'number' && count > 0) {
              storage?.setItem(flagKey, '1');
              return;
            }
          }
        } catch {
          // Non-fatal: test mocks or offline fallback proceed with deterministic IDs
        }
      }

      const recheckEver = await db.mealTemplates.where('userId').equals(userId).count();
      if (recheckEver > 0) return;

      const now = new Date().toISOString();
      const created: MealTemplate[] = STARTER_INDIAN_STAPLES.map((item, idx) => ({
        id: buildStarterTemplateUuid(userId, item.name),
        userId,
        name: item.name,
        hindiAliases: item.hindiAliases,
        calories: item.calories,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
        fiberG: item.fiberG ?? null,
        servingLabel: item.servingLabel,
        mealType: item.mealType ?? null,
        isJunk: item.isJunk,
        isPinned: item.isPinned,
        order: item.order ?? idx,
        deletedAt: null,
        generationCounter: 1,
        isDirty: true,
        createdAt: now,
        updatedAt: now,
      }));

      await db.mealTemplates.bulkPut(created);
      storage?.setItem(flagKey, '1');

      set({
        mealTemplates: [...created].sort((a, b) => a.order - b.order),
      });
      notifyFitnessSync();
    })();

    seedingStarterLocks.set(userId, run);
    try {
      await run;
    } finally {
      if (seedingStarterLocks.get(userId) === run) {
        seedingStarterLocks.delete(userId);
      }
    }
  },

  addMealLog: async (data, userIdOverride) => {
    const userId = resolveUserId(userIdOverride, get().currentUserId);
    const now = new Date().toISOString();
    const date = data.date || getLocalIsoDate();

    const meal: MealLog = {
      id: crypto.randomUUID(),
      userId,
      date,
      mealType: data.mealType || 'snack',
      name: data.name.trim(),
      calories: Math.max(0, Math.round(Number(data.calories) || 0)),
      proteinG: Math.max(0, Number((Number(data.proteinG) || 0).toFixed(1))),
      carbsG: Math.max(0, Number((Number(data.carbsG) || 0).toFixed(1))),
      fatG: Math.max(0, Number((Number(data.fatG) || 0).toFixed(1))),
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

    await db.mealLogs.put(meal);
    set((state) => ({
      mealLogs: [meal, ...state.mealLogs].sort((a, b) =>
        b.date.localeCompare(a.date) || b.loggedAt.localeCompare(a.loggedAt)
      ),
      currentUserId: userId,
    }));
    notifyFitnessSync();

    if (!meal.isJunk) {
      try {
        const supInventory =
          get().supplementInventory.length > 0
            ? get().supplementInventory
            : db.supplementInventory
              ? await db.supplementInventory
                  .where('userId')
                  .equals(userId)
                  .filter((s) => !s.deletedAt)
                  .toArray()
              : [];
        const supMatch = matchProteinMealToSupplement(meal, supInventory);
        if (supMatch) {
          const existingLogs =
            get().supplementLogs.length > 0
              ? get().supplementLogs
              : db.supplementLogs
                ? await db.supplementLogs
                    .where('supplementId')
                    .equals(supMatch.supplement.id)
                    .filter((l) => !l.deletedAt)
                    .toArray()
                : [];
          if (!hasAutoMealSupplementLog(existingLogs, meal.id, supMatch.supplement.id)) {
            await get().takeSupplementDose(
              supMatch.supplement.id,
              supMatch.servings,
              meal.date,
              `Auto-synced from meal: ${meal.name} ${buildAutoMealSupplementNoteTag(meal.id)}`,
              userId
            );
          }
        }
      } catch (err) {
        logger.warn('[FitnessStore] Meal->Supplement auto-sync skipped:', err);
      }
    }

    try {
      const { CrossDomainActionMediator } = await import('../mediator');
      await CrossDomainActionMediator.onFitnessEvent({
        type: 'MEAL_LOGGED',
        date: meal.date,
        isJunk: meal.isJunk,
      });
    } catch (err) {
      logger.warn('[FitnessStore] Meal mediator skipped:', err);
    }

    return meal;
  },

  updateMealLog: async (id, patch) => {
    const existing =
      get().mealLogs.find((m) => m.id === id) || (await db.mealLogs.get(id));
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated: MealLog = {
      ...existing,
      ...(patch.date !== undefined ? { date: patch.date } : {}),
      ...(patch.mealType !== undefined ? { mealType: patch.mealType } : {}),
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.calories !== undefined
        ? { calories: Math.max(0, Math.round(Number(patch.calories) || 0)) }
        : {}),
      ...(patch.proteinG !== undefined
        ? { proteinG: Math.max(0, Number((Number(patch.proteinG) || 0).toFixed(1))) }
        : {}),
      ...(patch.carbsG !== undefined
        ? { carbsG: Math.max(0, Number((Number(patch.carbsG) || 0).toFixed(1))) }
        : {}),
      ...(patch.fatG !== undefined
        ? { fatG: Math.max(0, Number((Number(patch.fatG) || 0).toFixed(1))) }
        : {}),
      ...(patch.fiberG !== undefined ? { fiberG: patch.fiberG } : {}),
      ...(patch.quantityMultiplier !== undefined
        ? { quantityMultiplier: Math.max(0.25, Number(patch.quantityMultiplier) || 1) }
        : {}),
      ...(patch.isJunk !== undefined ? { isJunk: Boolean(patch.isJunk) } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      generationCounter: (existing.generationCounter || 1) + 1,
      isDirty: true,
      updatedAt: now,
    };

    await db.mealLogs.put(updated);
    set((state) => ({
      mealLogs: state.mealLogs
        .map((m) => (m.id === id ? updated : m))
        .sort((a, b) => b.date.localeCompare(a.date) || b.loggedAt.localeCompare(a.loggedAt)),
    }));
    notifyFitnessSync();

    try {
      const { CrossDomainActionMediator } = await import('../mediator');
      await CrossDomainActionMediator.onFitnessEvent({
        type: 'MEAL_LOGGED',
        date: updated.date,
        isJunk: updated.isJunk,
      });
      if (existing.date.slice(0, 10) !== updated.date.slice(0, 10)) {
        await CrossDomainActionMediator.onFitnessEvent({
          type: 'MEAL_LOGGED',
          date: existing.date,
          isJunk: existing.isJunk,
        });
      }
    } catch (err) {
      logger.warn('[FitnessStore] Meal update mediator skipped:', err);
    }

    return updated;
  },

  deleteMealLog: async (id) => {
    const existing =
      get().mealLogs.find((m) => m.id === id) || (await db.mealLogs.get(id));
    if (!existing) return;

    const now = new Date().toISOString();
    await db.mealLogs.update(id, {
      deletedAt: now,
      updatedAt: now,
      isDirty: true,
      generationCounter: (existing.generationCounter || 1) + 1,
    });

    set((state) => ({
      mealLogs: state.mealLogs.filter((m) => m.id !== id),
    }));
    notifyFitnessSync();

    try {
      const { CrossDomainActionMediator } = await import('../mediator');
      await CrossDomainActionMediator.onFitnessEvent({
        type: 'MEAL_LOGGED',
        date: existing.date,
        isJunk: false,
      });
    } catch (err) {
      logger.warn('[FitnessStore] Meal delete mediator skipped:', err);
    }
  },

  logFromTemplate: async (templateId, options, userIdOverride) => {
    const template =
      get().mealTemplates.find((t) => t.id === templateId && !t.deletedAt) ||
      (await db.mealTemplates.get(templateId));
    if (!template || template.deletedAt) return null;

    const mult = Math.max(0.25, Number(options?.multiplier || 1));
    const displayName =
      mult === 1 ? template.name : `${mult}x ${template.name}`;

    return get().addMealLog(
      {
        date: options?.date || getLocalIsoDate(),
        mealType: options?.mealType || template.mealType || 'snack',
        name: displayName,
        calories: Math.round(template.calories * mult),
        proteinG: Number((template.proteinG * mult).toFixed(1)),
        carbsG: Number((template.carbsG * mult).toFixed(1)),
        fatG: Number((template.fatG * mult).toFixed(1)),
        fiberG:
          template.fiberG != null
            ? Number((template.fiberG * mult).toFixed(1))
            : null,
        quantityMultiplier: mult,
        isJunk: template.isJunk,
        templateId: template.id,
        source: options?.source || 'staple',
      },
      userIdOverride || template.userId
    );
  },

  addMealTemplate: async (data, userIdOverride) => {
    const userId = resolveUserId(userIdOverride, get().currentUserId);
    const now = new Date().toISOString();
    const maxOrder = get().mealTemplates.reduce((max, t) => Math.max(max, t.order), -1);

    const tpl: MealTemplate = {
      id: crypto.randomUUID(),
      userId,
      name: data.name.trim(),
      hindiAliases: Array.isArray(data.hindiAliases) ? data.hindiAliases : [],
      calories: Math.max(0, Math.round(Number(data.calories) || 0)),
      proteinG: Math.max(0, Number((Number(data.proteinG) || 0).toFixed(1))),
      carbsG: Math.max(0, Number((Number(data.carbsG) || 0).toFixed(1))),
      fatG: Math.max(0, Number((Number(data.fatG) || 0).toFixed(1))),
      fiberG: data.fiberG ?? null,
      servingLabel: data.servingLabel || '1 serving',
      mealType: data.mealType ?? null,
      isJunk: Boolean(data.isJunk),
      isPinned: data.isPinned !== false,
      order: data.order ?? maxOrder + 1,
      deletedAt: null,
      generationCounter: 1,
      isDirty: true,
      createdAt: now,
      updatedAt: now,
    };

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
      get().mealTemplates.find((t) => t.id === id) ||
      (await db.mealTemplates.get(id));
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated: MealTemplate = {
      ...existing,
      ...patch,
      name: patch.name !== undefined ? patch.name.trim() : existing.name,
      generationCounter: (existing.generationCounter || 1) + 1,
      isDirty: true,
      updatedAt: now,
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
      get().mealTemplates.find((t) => t.id === id) ||
      (await db.mealTemplates.get(id));
    if (!existing) return;

    const now = new Date().toISOString();
    await db.mealTemplates.update(id, {
      deletedAt: now,
      updatedAt: now,
      isDirty: true,
      generationCounter: (existing.generationCounter || 1) + 1,
    });

    set((state) => ({
      mealTemplates: state.mealTemplates.filter((t) => t.id !== id),
    }));
    notifyFitnessSync();
  },

  ensureMealForJunkTransaction: async ({
    transactionId,
    userId,
    date,
    title,
    amountInr,
    notes,
  }) => {
    return withLinkedTxLock(transactionId, async () => {
      const existingInMem = get().mealLogs.find(
        (m) => m.linkedTransactionId === transactionId && !m.deletedAt
      );
      if (existingInMem) return existingInMem;

      const existingInDb = await db.mealLogs
        .where('linkedTransactionId')
        .equals(transactionId)
        .filter((m) => !m.deletedAt)
        .first();
      if (existingInDb) return existingInDb;

      const estimate = estimateHinglishFoodMacros(title, {
        amountInr,
        forceJunk: true,
      });

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
    });
  },

  upsertMealFromCapture: async (params) => {
    const userId = resolveUserId(params.userId, get().currentUserId);
    const run = async (): Promise<MealLog> => {
      if (params.linkedTransactionId) {
        const existingInDb = await db.mealLogs
          .where('linkedTransactionId')
          .equals(params.linkedTransactionId)
          .filter((m) => !m.deletedAt)
          .first();
        const existing =
          existingInDb ||
          get().mealLogs.find(
            (m) => m.linkedTransactionId === params.linkedTransactionId && !m.deletedAt
          );

        if (existing) {
          const now = new Date().toISOString();
          const updated: MealLog = {
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
          await db.mealLogs.put(updated);
          set((state) => ({
            mealLogs: state.mealLogs
              .map((m) => (m.id === updated.id ? updated : m))
              .sort(
                (a, b) =>
                  b.date.localeCompare(a.date) || b.loggedAt.localeCompare(a.loggedAt)
              ),
            currentUserId: userId,
          }));
          notifyFitnessSync();
          try {
            const { CrossDomainActionMediator } = await import('../mediator');
            await CrossDomainActionMediator.onFitnessEvent({
              type: 'MEAL_LOGGED',
              date: updated.date,
              isJunk: updated.isJunk,
            });
          } catch (err) {
            logger.warn('[FitnessStore] Upsert meal mediator skipped:', err);
          }
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

    if (params.linkedTransactionId) {
      return withLinkedTxLock(params.linkedTransactionId, run);
    }
    return run();
  },

  linkMealToTransaction: async (mealId, transactionId) => {
    const existing =
      get().mealLogs.find((m) => m.id === mealId) || (await db.mealLogs.get(mealId));
    if (!existing || existing.deletedAt) return null;

    const normalizedTxId = transactionId ?? null;
    if ((existing.linkedTransactionId ?? null) === normalizedTxId) {
      return existing;
    }

    const now = new Date().toISOString();
    const updated: MealLog = {
      ...existing,
      linkedTransactionId: normalizedTxId,
      generationCounter: (existing.generationCounter || 1) + 1,
      isDirty: true,
      updatedAt: now,
    };

    await db.mealLogs.put(updated);
    set((state) => ({
      mealLogs: state.mealLogs
        .map((m) => (m.id === mealId ? updated : m))
        .sort((a, b) => b.date.localeCompare(a.date) || b.loggedAt.localeCompare(a.loggedAt)),
    }));
    notifyFitnessSync();
    return updated;
  },
});
