import { db } from '@/lib/db';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { deriveSupplementRemainingServings } from '@/lib/fitness/shared-analytics';
import type { SupplementInventory, SupplementLog } from '@/lib/types';
import {
  buildAdjustedSupplement,
  buildNewSupplement,
  buildRestockedSupplement,
  buildUpdatedSupplement,
  findSupplement,
  getActiveLogsForSupplement,
  notifyFitnessSync,
  resolveUserId,
  sortSupplements,
  triggerSupplementMediator,
} from './supplement-helpers';
import type { FitnessSliceCreator, FitnessStoreActions } from './types';

async function refreshSupplementStockAfterLog(
  get: () => { supplementInventory: SupplementInventory[]; supplementLogs: SupplementLog[] },
  set: (fn: (state: { supplementInventory: SupplementInventory[] }) => { supplementInventory: SupplementInventory[] }) => void,
  item: SupplementInventory,
  logsSnapshot: SupplementLog[],
  now: string
): Promise<void> {
  const activeLogs = await getActiveLogsForSupplement(item.id, logsSnapshot);
  const updatedItem: SupplementInventory = {
    ...item,
    remainingServings: deriveSupplementRemainingServings(item, activeLogs),
    generationCounter: (item.generationCounter || 1) + 1,
    isDirty: true,
    updatedAt: now,
  };
  await db.supplementInventory.put(updatedItem);
  set((state) => ({
    supplementInventory: state.supplementInventory.map((s) =>
      s.id === item.id ? updatedItem : s
    ),
  }));
}

async function applySupplementMutation(
  get: () => { supplementInventory: SupplementInventory[]; supplementLogs: SupplementLog[] },
  set: (fn: (state: { supplementInventory: SupplementInventory[] }) => { supplementInventory: SupplementInventory[] }) => void,
  id: string,
  buildNext: (existing: SupplementInventory, activeLogs: SupplementLog[]) => SupplementInventory,
  options: { requireActive?: boolean; sort?: boolean } = {}
): Promise<SupplementInventory | null> {
  const existing = await findSupplement(get().supplementInventory, id);
  if (!existing || (options.requireActive && existing.deletedAt)) return null;

  const activeLogs = await getActiveLogsForSupplement(id, get().supplementLogs);
  const updated = buildNext(existing, activeLogs);
  await db.supplementInventory.put(updated);
  set((state) => {
    const next = state.supplementInventory.map((s) => (s.id === id ? updated : s));
    return { supplementInventory: options.sort ? sortSupplements(next) : next };
  });
  notifyFitnessSync();
  return updated;
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
    const item = buildNewSupplement(data, userId);

    await db.supplementInventory.put(item);
    set((state) => ({
      supplementInventory: sortSupplements([...state.supplementInventory, item]),
      currentUserId: userId,
    }));
    notifyFitnessSync();
    return item;
  },

  updateSupplement: async (id, patch) =>
    applySupplementMutation(
      get,
      set,
      id,
      (existing, activeLogs) => buildUpdatedSupplement(existing, patch, activeLogs),
      { sort: true }
    ),

  deleteSupplement: async (id) => {
    const existing = await findSupplement(get().supplementInventory, id);
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

  restockSupplement: async (supplementId, params) =>
    applySupplementMutation(
      get,
      set,
      supplementId,
      (existing, activeLogs) => buildRestockedSupplement(existing, params, activeLogs),
      { requireActive: true }
    ),

  adjustSupplementStock: async (supplementId, params) =>
    applySupplementMutation(
      get,
      set,
      supplementId,
      (existing, activeLogs) => buildAdjustedSupplement(existing, params, activeLogs),
      { requireActive: true }
    ),

  takeSupplementDose: async (supplementId, params) => {
    const { servings, date, notes, userIdOverride } = params ?? {};
    const item = await findSupplement(get().supplementInventory, supplementId);
    if (!item || item.deletedAt) return null;

    const userId = resolveUserId(userIdOverride, item.userId || get().currentUserId);
    const targetDate = date || getLocalIsoDate();
    const now = new Date().toISOString();
    const logEntry: SupplementLog = {
      id: crypto.randomUUID(),
      userId,
      supplementId,
      date: targetDate,
      servingsTaken: Math.max(0.25, Number(servings ?? item.dailyDosage ?? 1)),
      takenAt: now,
      notes: notes ?? null,
      deletedAt: null,
      generationCounter: 1,
      isDirty: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.supplementLogs.put(logEntry);
    await refreshSupplementStockAfterLog(get, set, item, [logEntry, ...get().supplementLogs], now);
    set((state) => ({
      supplementLogs: [logEntry, ...state.supplementLogs].sort(
        (a, b) => b.date.localeCompare(a.date) || b.takenAt.localeCompare(a.takenAt)
      ),
      currentUserId: userId,
    }));

    notifyFitnessSync();
    await triggerSupplementMediator(targetDate, '[FitnessStore] Supplement mediator skipped:');
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
      if (existingLogsToday.some((l) => l.supplementId === sup.id)) continue;
      const log = await get().takeSupplementDose(sup.id, {
        servings: sup.dailyDosage,
        date: targetDate,
        notes: 'Daily stack',
        userIdOverride,
      });
      if (log) created.push(log);
    }
    return created;
  },

  deleteSupplementLog: async (id) => {
    const existing =
      get().supplementLogs.find((l) => l.id === id) || (await db.supplementLogs.get(id));
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

    const item = await findSupplement(get().supplementInventory, existing.supplementId);
    if (item && !item.deletedAt) {
      const activeLogs = await getActiveLogsForSupplement(existing.supplementId, nextStoreLogs);
      const updatedItem: SupplementInventory = {
        ...item,
        remainingServings: deriveSupplementRemainingServings(item, activeLogs),
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
    await triggerSupplementMediator(existing.date, '[FitnessStore] Supplement undo mediator skipped:');
  },
});
