import { db } from '@/lib/db';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { deriveSupplementRemainingServings } from '@/lib/fitness/shared-analytics';
import { logger } from '@/lib/logger';
import type { SupplementInventory, SupplementLog } from '@/lib/types';

export function notifyFitnessSync(): void {
  if (typeof window === 'undefined') return;
  import('@/lib/sync/sync-engine')
    .then(({ getSyncEngine }) => {
      getSyncEngine().triggerFitnessSync();
    })
    .catch((err) => {
      logger.warn('[FitnessStore] Sync trigger deferred:', err);
    });
}

export function resolveUserId(override?: string, current?: string | null): string {
  return override || current || 'local-demo-user';
}

export async function getActiveLogsForSupplement(
  supplementId: string,
  storeLogs: SupplementLog[]
): Promise<SupplementLog[]> {
  try {
    return await db.supplementLogs
      .where('supplementId')
      .equals(supplementId)
      .filter((l) => !l.deletedAt)
      .toArray();
  } catch {
    // Fallback to in-memory logs if Dexie query unavailable
  }
  return storeLogs.filter((l) => !l.deletedAt && l.supplementId === supplementId);
}

export async function findSupplement(
  list: SupplementInventory[],
  id: string
): Promise<SupplementInventory | undefined> {
  return list.find((s) => s.id === id) || (await db.supplementInventory.get(id));
}

export function sortSupplements(list: SupplementInventory[]): SupplementInventory[] {
  return [...list].sort(
    (a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)
  );
}

export function sumTakenServings(logs: SupplementLog[]): number {
  return logs.reduce((sum, l) => sum + Math.max(0, Number(l.servingsTaken || 0)), 0);
}

function computeInitialAdjustment(
  data: Partial<SupplementInventory>,
  totalServings: number
): number {
  if (data.manualAdjustment !== undefined) return Number(data.manualAdjustment);
  if (data.remainingServings === undefined) return 0;
  return Number((Math.max(0, Number(data.remainingServings)) - totalServings).toFixed(2));
}

function inferProteinPerServing(
  data: Partial<SupplementInventory> & { name: string },
  category: string
): number | null {
  if (data.proteinPerServingG !== undefined) return data.proteinPerServingG ?? null;
  const isProtein =
    category === 'protein' || /\b(whey|casein|protein|isolate)\b/i.test(data.name);
  return isProtein ? 24 : null;
}

export function buildNewSupplement(
  data: Partial<SupplementInventory> & { name: string },
  userId: string
): SupplementInventory {
  const now = new Date().toISOString();
  const totalServings = Math.max(1, Number(data.totalServings) || 30);
  const category = data.category || 'other';
  const manualAdjustment = computeInitialAdjustment(data, totalServings);
  const remainingServings = Math.max(0, Number((totalServings + manualAdjustment).toFixed(2)));

  return {
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
    proteinPerServingG: inferProteinPerServing(data, category),
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
}

export function buildUpdatedSupplement(
  existing: SupplementInventory,
  patch: Partial<SupplementInventory>,
  activeLogs: SupplementLog[]
): SupplementInventory {
  const now = new Date().toISOString();
  const mergedDraft: SupplementInventory = {
    ...existing,
    ...patch,
    name: patch.name !== undefined ? patch.name.trim() : existing.name,
  };

  if (patch.remainingServings !== undefined && patch.manualAdjustment === undefined) {
    const takenSum = sumTakenServings(activeLogs);
    mergedDraft.manualAdjustment = Number(
      (Math.max(0, Number(patch.remainingServings)) - mergedDraft.totalServings + takenSum).toFixed(2)
    );
  }

  return {
    ...mergedDraft,
    remainingServings: deriveSupplementRemainingServings(mergedDraft, activeLogs),
    generationCounter: (existing.generationCounter || 1) + 1,
    isDirty: true,
    updatedAt: now,
  };
}

export function buildRestockedSupplement(
  existing: SupplementInventory,
  params: { servingsAdded?: number; costInr?: number; linkedTransactionId?: string | null; date?: string },
  activeLogs: SupplementLog[]
): SupplementInventory {
  const prevDerived = deriveSupplementRemainingServings(existing, activeLogs);
  const takenSum = sumTakenServings(activeLogs);
  const added = Math.max(0, Number(params.servingsAdded ?? existing.totalServings));
  const hasExplicitNewPack =
    params.servingsAdded !== undefined && params.servingsAdded > 0 && params.costInr !== undefined;
  const nextTotal = hasExplicitNewPack ? added : Math.max(existing.totalServings, added);
  const targetRemaining = Number((prevDerived + added).toFixed(2));

  return {
    ...existing,
    totalServings: nextTotal,
    manualAdjustment: Number((targetRemaining + takenSum - nextTotal).toFixed(2)),
    remainingServings: targetRemaining,
    costInr: params.costInr !== undefined ? Math.max(0, Number(params.costInr)) : existing.costInr,
    linkedTransactionId:
      params.linkedTransactionId !== undefined ? params.linkedTransactionId : existing.linkedTransactionId,
    lastRestockedAt: params.date || getLocalIsoDate(),
    isActive: true,
    generationCounter: (existing.generationCounter || 1) + 1,
    isDirty: true,
    updatedAt: new Date().toISOString(),
  };
}

export function buildAdjustedSupplement(
  existing: SupplementInventory,
  params: { delta?: number; targetRemaining?: number },
  activeLogs: SupplementLog[]
): SupplementInventory {
  const prevDerived = deriveSupplementRemainingServings(existing, activeLogs);
  const takenSum = sumTakenServings(activeLogs);
  const desiredRemaining =
    params.targetRemaining !== undefined
      ? Math.max(0, Number(params.targetRemaining))
      : Math.max(0, Number((prevDerived + Number(params.delta || 0)).toFixed(2)));

  return {
    ...existing,
    manualAdjustment: Number((desiredRemaining - existing.totalServings + takenSum).toFixed(2)),
    remainingServings: desiredRemaining,
    generationCounter: (existing.generationCounter || 1) + 1,
    isDirty: true,
    updatedAt: new Date().toISOString(),
  };
}

export async function triggerSupplementMediator(date: string, label: string): Promise<void> {
  try {
    const { CrossDomainActionMediator } = await import('../mediator');
    await CrossDomainActionMediator.onFitnessEvent({
      type: 'SUPPLEMENTS_TAKEN',
      date,
    });
  } catch (err) {
    logger.warn(label, err);
  }
}
