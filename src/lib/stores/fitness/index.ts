import type { EntityTable } from 'dexie';
import { create } from 'zustand';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { createBioSlice } from './bio-slice';
import { createDietSlice } from './diet-slice';
import { createSupplementSlice } from './supplement-slice';
import { createWorkoutSlice } from './workout-slice';
import type { FitnessStore } from './types';

export type { FitnessStore, FitnessStoreActions, FitnessStoreState } from './types';

async function fetchActiveFitnessTables(resolvedId: string) {
  const queryActive = <T extends { id: string; deletedAt?: string | null }>(table: EntityTable<T, 'id'>) =>
    table.where('userId').equals(resolvedId).filter((r) => !r.deletedAt).toArray();

  return Promise.all([
    queryActive(db.fitnessProfiles),
    queryActive(db.fitnessDailyLogs),
    queryActive(db.mealTemplates),
    queryActive(db.mealLogs),
    queryActive(db.workoutSessions),
    queryActive(db.supplementInventory),
    queryActive(db.supplementLogs),
  ]);
}

function buildSortedFitnessState(
  raw: Awaited<ReturnType<typeof fetchActiveFitnessTables>>,
  resolvedId: string
) {
  const [profiles, dailyLogs, mealTemplates, mealLogs, workoutSessions, supplementInventory, supplementLogs] = raw;
  const sortedProfiles = [...profiles].sort(
    (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
  );
  return {
    profile: sortedProfiles[0] || null,
    dailyLogs: [...dailyLogs].sort((a, b) => a.date.localeCompare(b.date)),
    mealTemplates: dedupeMealTemplates(mealTemplates),
    mealLogs: [...mealLogs].sort((a, b) => b.date.localeCompare(a.date) || b.loggedAt.localeCompare(a.loggedAt)),
    workoutSessions: [...workoutSessions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    supplementInventory: [...supplementInventory].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)),
    supplementLogs: [...supplementLogs].sort((a, b) => b.date.localeCompare(a.date) || b.takenAt.localeCompare(a.takenAt)),
    isLoading: false,
    hasLoaded: true,
    currentUserId: resolvedId,
  };
}

function dedupeMealTemplates<T extends { name: string; order: number; generationCounter?: number; updatedAt?: string }>(
  mealTemplates: T[]
): T[] {
  const sorted = [...mealTemplates].sort(
    (a, b) =>
      (b.generationCounter || 0) - (a.generationCounter || 0) ||
      new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
  );
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const tpl of sorted) {
    const key = tpl.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(tpl);
  }
  return unique.sort((a, b) => a.order - b.order);
}

export const useFitnessStore = create<FitnessStore>((set, get, api) => ({
  profile: null,
  dailyLogs: [],
  mealTemplates: [],
  mealLogs: [],
  workoutSessions: [],
  supplementInventory: [],
  supplementLogs: [],
  isLoading: false,
  hasLoaded: false,
  currentUserId: null,

  loadFitnessData: async (userId?: string, force = true) => {
    const resolvedId = userId || get().currentUserId || 'local-demo-user';
    const state = get();
    const isAlreadyLoaded = !force && state.hasLoaded && state.currentUserId === resolvedId;
    if (isAlreadyLoaded) return;

    set({ isLoading: !state.hasLoaded, currentUserId: resolvedId });

    try {
      const raw = await fetchActiveFitnessTables(resolvedId);
      set(buildSortedFitnessState(raw, resolvedId));
      await get().seedStarterStaplesIfEmpty(resolvedId);
    } catch (error) {
      logger.error('[FitnessStore] Failed to load fitness data:', error);
      set({ isLoading: false, hasLoaded: true });
    }
  },

  clearFitnessState: () => {
    set({
      profile: null,
      dailyLogs: [],
      mealTemplates: [],
      mealLogs: [],
      workoutSessions: [],
      supplementInventory: [],
      supplementLogs: [],
      hasLoaded: false,
      isLoading: false,
    });
  },

  ...createBioSlice(set, get, api),
  ...createDietSlice(set, get, api),
  ...createWorkoutSlice(set, get, api),
  ...createSupplementSlice(set, get, api),
}));
