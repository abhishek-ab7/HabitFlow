import { db } from '@/lib/db';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { deriveSupplementRemainingServings } from '@/lib/fitness/shared-analytics';
import { logger } from '@/lib/logger';
import type { SupplementInventory, SupplementLog } from '@/lib/types';
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

async function getActiveLogsForSupplement(
  supplementId: string,
  storeLogs: SupplementLog[]
): Promise<SupplementLog[]> {
  try {
    const dbLogs = await db.supplementLogs
      .where('supplementId')
      .equals(supplementId)
      .filter((l) => !l.deletedAt)
      .toArray();
    return dbLogs;
  } catch {
    // Fallback to in-memory logs if Dexie query unavailable
  }
  return storeLogs.filter((l) => !l.deletedAt && l.supplementId === supplementId);
}

export const createSupplementSlice: FitnessSliceCreator<
  Pick<
    FitnessStoreActions,
    | 'addSupplement'
    | 'updateSupplement'
    | 'deleteSupplement'
    | 'restockSupplement'
    | 'takeSupplementDose'
    | 'deleteSupplementLog'
    | 'adjustSupplementStock'
    | 'takeTodaySupplementStack'
  >
> = (set, get) => ({
  addSupplement: async (data, userIdOverride) => {
    const userId = resolveUserId(userIdOverride, get().currentUserId);
    const now = new Date().toISOString();
    const totalServings = Math.max(1, Number(data.totalServings) || 30);
    const category = data.category || 'other';

    const manualAdjustment =
      data.manualAdjustment !== undefined
        ? Number(data.manualAdjustment)
        : data.remainingServings !== undefined
          ? Number((Math.max(0, Number(data.remainingServings)) - totalServings).toFixed(2))
          : 0;

    const remainingServings = Math.max(
      0,
      Number((totalServings + manualAdjustment).toFixed(2))
    );

    const inferredProtein =
      data.proteinPerServingG !== undefined
        ? data.proteinPerServingG
        : category === 'protein' || /\b(whey|casein|protein|isolate)\b/i.test(data.name)
          ? 24
          : null;

    const item: SupplementInventory = {
      id: crypto.randomUUID(),
      userId,
      name: data.name.trim(),
      brand: data.brand ?? null,
      category,
      unitLabel: data.unitLabel || 'scoop',
      totalServings,
      remainingServings,
      dailyDosage: Math.max(0.25, Number(data.dailyDosage || 1)),
      costInr: Math.max(0, Number(data.costInr || 0)),
      proteinPerServingG: inferredProtein,
      manualAdjustment,
      anchorBlock: data.anchorBlock ?? null,
      lowStockThresholdDays: Math.max(1, Math.round(Number(data.lowStockThresholdDays || 7))),
      linkedTransactionId: data.linkedTransactionId ?? null,
      lastRestockedAt: data.lastRestockedAt ?? getLocalIsoDate(),
      isActive: data.isActive !== false,
      notes: data.notes ?? null,
      deletedAt: null,
      generationCounter: 1,
      isDirty: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.supplementInventory.put(item);
    set((state) => ({
      supplementInventory: [...state.supplementInventory, item].sort((a, b) =>
        Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)
      ),
      currentUserId: userId,
    }));
    notifyFitnessSync();
    return item;
  },

  updateSupplement: async (id, patch) => {
    const existing =
      get().supplementInventory.find((s) => s.id === id) ||
      (await db.supplementInventory.get(id));
    if (!existing) return null;

    const now = new Date().toISOString();
    const activeLogs = await getActiveLogsForSupplement(id, get().supplementLogs);
    const mergedDraft: SupplementInventory = {
      ...existing,
      ...patch,
      name: patch.name !== undefined ? patch.name.trim() : existing.name,
    };

    // If caller edited remainingServings without explicitly supplying manualAdjustment,
    // adjust manualAdjustment so derived remaining matches requested value.
    if (patch.remainingServings !== undefined && patch.manualAdjustment === undefined) {
      const takenSum = activeLogs.reduce((sum, l) => sum + Math.max(0, Number(l.servingsTaken || 0)), 0);
      mergedDraft.manualAdjustment = Number(
        (Math.max(0, Number(patch.remainingServings)) - mergedDraft.totalServings + takenSum).toFixed(2)
      );
    }

    const derivedRemaining = deriveSupplementRemainingServings(mergedDraft, activeLogs);
    const updated: SupplementInventory = {
      ...mergedDraft,
      remainingServings: derivedRemaining,
      generationCounter: (existing.generationCounter || 1) + 1,
      isDirty: true,
      updatedAt: now,
    };

    await db.supplementInventory.put(updated);
    set((state) => ({
      supplementInventory: state.supplementInventory
        .map((s) => (s.id === id ? updated : s))
        .sort((a, b) =>
          Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)
        ),
    }));
    notifyFitnessSync();
    return updated;
  },

  deleteSupplement: async (id) => {
    const existing =
      get().supplementInventory.find((s) => s.id === id) ||
      (await db.supplementInventory.get(id));
    if (!existing) return;

    const now = new Date().toISOString();
    await db.supplementInventory.update(id, {
      deletedAt: now,
      updatedAt: now,
      isDirty: true,
      generationCounter: (existing.generationCounter || 1) + 1,
    });

    set((state) => ({
      supplementInventory: state.supplementInventory.filter((s) => s.id !== id),
    }));
    notifyFitnessSync();
  },

  restockSupplement: async (supplementId, params) => {
    const existing =
      get().supplementInventory.find((s) => s.id === supplementId) ||
      (await db.supplementInventory.get(supplementId));
    if (!existing || existing.deletedAt) return null;

    const activeLogs = await getActiveLogsForSupplement(supplementId, get().supplementLogs);
    const prevDerived = deriveSupplementRemainingServings(existing, activeLogs);
    const takenSum = activeLogs.reduce(
      (sum, l) => sum + Math.max(0, Number(l.servingsTaken || 0)),
      0
    );

    const added = Math.max(0, Number(params.servingsAdded ?? existing.totalServings));
    const nextTotal =
      params.servingsAdded !== undefined && params.servingsAdded > 0 && params.costInr !== undefined
        ? added
        : Math.max(existing.totalServings, added);

    const targetRemaining = Number((prevDerived + added).toFixed(2));
    const nextManualAdjustment = Number(
      (targetRemaining + takenSum - nextTotal).toFixed(2)
    );
    const now = new Date().toISOString();

    const updated: SupplementInventory = {
      ...existing,
      totalServings: nextTotal,
      manualAdjustment: nextManualAdjustment,
      remainingServings: targetRemaining,
      costInr: params.costInr !== undefined ? Math.max(0, Number(params.costInr)) : existing.costInr,
      linkedTransactionId:
        params.linkedTransactionId !== undefined
          ? params.linkedTransactionId
          : existing.linkedTransactionId,
      lastRestockedAt: params.date || getLocalIsoDate(),
      isActive: true,
      generationCounter: (existing.generationCounter || 1) + 1,
      isDirty: true,
      updatedAt: now,
    };

    await db.supplementInventory.put(updated);
    set((state) => ({
      supplementInventory: state.supplementInventory.map((s) =>
        s.id === supplementId ? updated : s
      ),
    }));
    notifyFitnessSync();
    return updated;
  },

  adjustSupplementStock: async (supplementId, params) => {
    const existing =
      get().supplementInventory.find((s) => s.id === supplementId) ||
      (await db.supplementInventory.get(supplementId));
    if (!existing || existing.deletedAt) return null;

    const activeLogs = await getActiveLogsForSupplement(supplementId, get().supplementLogs);
    const prevDerived = deriveSupplementRemainingServings(existing, activeLogs);
    const takenSum = activeLogs.reduce(
      (sum, l) => sum + Math.max(0, Number(l.servingsTaken || 0)),
      0
    );

    const desiredRemaining =
      params.targetRemaining !== undefined
        ? Math.max(0, Number(params.targetRemaining))
        : Math.max(0, Number((prevDerived + Number(params.delta || 0)).toFixed(2)));

    const nextManualAdjustment = Number(
      (desiredRemaining - existing.totalServings + takenSum).toFixed(2)
    );

    const now = new Date().toISOString();
    const updated: SupplementInventory = {
      ...existing,
      manualAdjustment: nextManualAdjustment,
      remainingServings: desiredRemaining,
      generationCounter: (existing.generationCounter || 1) + 1,
      isDirty: true,
      updatedAt: now,
    };

    await db.supplementInventory.put(updated);
    set((state) => ({
      supplementInventory: state.supplementInventory.map((s) =>
        s.id === supplementId ? updated : s
      ),
    }));
    notifyFitnessSync();
    return updated;
  },

  takeSupplementDose: async (
    supplementId,
    servings,
    date,
    notes,
    userIdOverride
  ) => {
    const item =
      get().supplementInventory.find((s) => s.id === supplementId && !s.deletedAt) ||
      (await db.supplementInventory.get(supplementId));
    if (!item || item.deletedAt) return null;

    const userId = resolveUserId(userIdOverride, item.userId || get().currentUserId);
    const dose = Math.max(0.25, Number(servings ?? item.dailyDosage ?? 1));
    const targetDate = date || getLocalIsoDate();
    const now = new Date().toISOString();

    const logEntry: SupplementLog = {
      id: crypto.randomUUID(),
      userId,
      supplementId,
      date: targetDate,
      servingsTaken: dose,
      takenAt: now,
      notes: notes ?? null,
      deletedAt: null,
      generationCounter: 1,
      isDirty: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.supplementLogs.put(logEntry);
    const activeLogs = await getActiveLogsForSupplement(supplementId, [
      logEntry,
      ...get().supplementLogs,
    ]);
    const derivedRemaining = deriveSupplementRemainingServings(item, activeLogs);

    const updatedItem: SupplementInventory = {
      ...item,
      remainingServings: derivedRemaining,
      generationCounter: (item.generationCounter || 1) + 1,
      isDirty: true,
      updatedAt: now,
    };

    await db.supplementInventory.put(updatedItem);

    set((state) => ({
      supplementLogs: [logEntry, ...state.supplementLogs].sort(
        (a, b) => b.date.localeCompare(a.date) || b.takenAt.localeCompare(a.takenAt)
      ),
      supplementInventory: state.supplementInventory.map((s) =>
        s.id === supplementId ? updatedItem : s
      ),
      currentUserId: userId,
    }));

    notifyFitnessSync();

    try {
      const { CrossDomainActionMediator } = await import('../mediator');
      await CrossDomainActionMediator.onFitnessEvent({
        type: 'SUPPLEMENTS_TAKEN',
        date: targetDate,
      });
    } catch (err) {
      logger.warn('[FitnessStore] Supplement mediator skipped:', err);
    }

    return logEntry;
  },

  takeTodaySupplementStack: async (date, userIdOverride) => {
    const targetDate = (date || getLocalIsoDate()).slice(0, 10);
    const activeSupps = get().supplementInventory.filter((s) => !s.deletedAt && s.isActive);
    const existingLogsToday = get().supplementLogs.filter(
      (l) => !l.deletedAt && l.date.slice(0, 10) === targetDate
    );

    const created: SupplementLog[] = [];
    for (const sup of activeSupps) {
      const alreadyTaken = existingLogsToday.some((l) => l.supplementId === sup.id);
      if (alreadyTaken) continue;
      const log = await get().takeSupplementDose(
        sup.id,
        sup.dailyDosage,
        targetDate,
        'Daily stack',
        userIdOverride
      );
      if (log) created.push(log);
    }

    return created;
  },

  deleteSupplementLog: async (id) => {
    const existing =
      get().supplementLogs.find((l) => l.id === id) ||
      (await db.supplementLogs.get(id));
    if (!existing) return;

    const now = new Date().toISOString();
    await db.supplementLogs.update(id, {
      deletedAt: now,
      updatedAt: now,
      isDirty: true,
      generationCounter: (existing.generationCounter || 1) + 1,
    });

    const nextStoreLogs = get().supplementLogs.filter((l) => l.id !== id);
    set({ supplementLogs: nextStoreLogs });

    // Recompute derived stock cleanly from remaining active logs
    const item =
      get().supplementInventory.find((s) => s.id === existing.supplementId) ||
      (await db.supplementInventory.get(existing.supplementId));

    if (item && !item.deletedAt) {
      const activeLogs = await getActiveLogsForSupplement(
        existing.supplementId,
        nextStoreLogs
      );
      const derivedRemaining = deriveSupplementRemainingServings(item, activeLogs);
      const updatedItem: SupplementInventory = {
        ...item,
        remainingServings: derivedRemaining,
        generationCounter: (item.generationCounter || 1) + 1,
        isDirty: true,
        updatedAt: now,
      };
      await db.supplementInventory.put(updatedItem);
      set((state) => ({
        supplementInventory: state.supplementInventory.map((s) =>
          s.id === updatedItem.id ? updatedItem : s
        ),
      }));
    }

    notifyFitnessSync();

    try {
      const { CrossDomainActionMediator } = await import('../mediator');
      await CrossDomainActionMediator.onFitnessEvent({
        type: 'SUPPLEMENTS_TAKEN',
        date: existing.date,
      });
    } catch (err) {
      logger.warn('[FitnessStore] Supplement undo mediator skipped:', err);
    }
  },
});
