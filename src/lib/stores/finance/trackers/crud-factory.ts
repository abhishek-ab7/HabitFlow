import { notifyFinanceSync, resolveCurrentUserId, type FinanceStore } from '../helpers';

interface DexieCrudTable<T extends { id: string; userId: string; generationCounter?: number }> {
  add: (item: T) => Promise<unknown>;
  update: (id: string, changes: any) => Promise<unknown>;
}

export async function addTrackerEntity<
  T extends { id: string; userId: string; generationCounter?: number },
  TInput extends object,
>(params: {
  getState: () => FinanceStore;
  table: DexieCrudTable<T>;
  data: TInput;
  recordNetWorth?: boolean;
}): Promise<T> {
  const { getState, table, data, recordNetWorth } = params;
  const userId = await resolveCurrentUserId(undefined, getState().currentUserId);
  const now = new Date().toISOString();
  const entity = {
    ...data,
    id: crypto.randomUUID(),
    userId,
    isDirty: true,
    generationCounter: 1,
    createdAt: now,
    updatedAt: now,
  } as unknown as T;

  await table.add(entity);
  await getState().loadFinanceData(userId);
  if (recordNetWorth) await getState().recordCurrentNetWorthSnapshot();
  notifyFinanceSync();
  return entity;
}

export async function updateTrackerEntity<
  T extends { id: string; userId: string; generationCounter?: number },
>(params: {
  getState: () => FinanceStore;
  table: DexieCrudTable<T>;
  existing: T | undefined;
  data: Record<string, unknown>;
  recordNetWorth?: boolean;
}): Promise<void> {
  const { getState, table, existing, data, recordNetWorth } = params;
  if (!existing) return;

  await table.update(existing.id, {
    ...data,
    isDirty: true,
    generationCounter: (existing.generationCounter || 1) + 1,
    updatedAt: new Date().toISOString(),
  });
  await getState().loadFinanceData(existing.userId);
  if (recordNetWorth) await getState().recordCurrentNetWorthSnapshot();
  notifyFinanceSync();
}

export async function softDeleteTrackerEntity<
  T extends { id: string; userId: string; generationCounter?: number },
>(params: {
  getState: () => FinanceStore;
  table: DexieCrudTable<T>;
  existing: T | undefined;
  extraFields?: Record<string, unknown>;
  recordNetWorth?: boolean;
}): Promise<void> {
  const { getState, table, existing, extraFields, recordNetWorth } = params;
  if (!existing) return;

  const now = new Date().toISOString();
  await table.update(existing.id, {
    ...extraFields,
    deletedAt: now,
    isDirty: true,
    updatedAt: now,
  });
  await getState().loadFinanceData(existing.userId);
  if (recordNetWorth) await getState().recordCurrentNetWorthSnapshot();
  notifyFinanceSync();
}
