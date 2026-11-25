import { create } from 'zustand';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { createBioSlice } from './bio-slice';
import { createDietSlice } from './diet-slice';
import { createSupplementSlice } from './supplement-slice';
import { createWorkoutSlice } from './workout-slice';
import type { FitnessStore } from './types';

export type { FitnessStore, FitnessStoreActions, FitnessStoreState } from './types';

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
    if (!force && state.hasLoaded && state.currentUserId === resolvedId) {
      return;
    }
    set({ isLoading: !state.hasLoaded, currentUserId: resolvedId });

    try {
      const [
        profiles,
        dailyLogs,
        mealTemplates,
        mealLogs,
        workoutSessions,
        supplementInventory,
        supplementLogs,
      ] = await Promise.all([
        db.fitnessProfiles
          .where('userId')
          .equals(resolvedId)
          .filter((p) => !p.deletedAt)
          .toArray(),
        db.fitnessDailyLogs
          .where('userId')
          .equals(resolvedId)
          .filter((d) => !d.deletedAt)
          .toArray(),
        db.mealTemplates
          .where('userId')
          .equals(resolvedId)
          .filter((t) => !t.deletedAt)
          .toArray(),
        db.mealLogs
          .where('userId')
          .equals(resolvedId)
          .filter((m) => !m.deletedAt)
          .toArray(),
        db.workoutSessions
          .where('userId')
          .equals(resolvedId)
          .filter((w) => !w.deletedAt)
          .toArray(),
        db.supplementInventory
          .where('userId')
          .equals(resolvedId)
          .filter((s) => !s.deletedAt)
          .toArray(),
        db.supplementLogs
          .where('userId')
          .equals(resolvedId)
          .filter((l) => !l.deletedAt)
          .toArray(),
      ]);

      // Pick newest active profile if duplicates ever exist
      const sortedProfiles = [...profiles].sort(
        (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );

      // Deduplicate active meal templates by normalized name (keeps most recently updated/highest generation)
      const dedupedTemplates = [...mealTemplates].sort(
        (a, b) =>
          (b.generationCounter || 0) - (a.generationCounter || 0) ||
          new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
      const uniqueTemplates: typeof mealTemplates = [];
      const seenTemplateNames = new Set<string>();
      for (const tpl of dedupedTemplates) {
        const key = tpl.name.trim().toLowerCase();
        if (seenTemplateNames.has(key)) continue;
        seenTemplateNames.add(key);
        uniqueTemplates.push(tpl);
      }

      set({
        profile: sortedProfiles[0] || null,
        dailyLogs: [...dailyLogs].sort((a, b) => a.date.localeCompare(b.date)),
        mealTemplates: uniqueTemplates.sort((a, b) => a.order - b.order),
        mealLogs: [...mealLogs].sort(
          (a, b) => b.date.localeCompare(a.date) || b.loggedAt.localeCompare(a.loggedAt)
        ),
        workoutSessions: [...workoutSessions].sort(
          (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
        ),
        supplementInventory: [...supplementInventory].sort(
          (a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)
        ),
        supplementLogs: [...supplementLogs].sort(
          (a, b) => b.date.localeCompare(a.date) || b.takenAt.localeCompare(a.takenAt)
        ),
        isLoading: false,
        hasLoaded: true,
        currentUserId: resolvedId,
      });

      // Seed starter Indian staples on first open if user has zero templates ever
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
