import { create } from 'zustand';
import {
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  setFocusGoal,
  getMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  toggleMilestone,
  db,
} from '../db';
import { getSupabaseClient } from '../supabase/client';
import type { Goal, Milestone, GoalFormData, MilestoneFormData, GoalStatus, AreaOfLife, Priority } from '../types';
import { calculateGoalStats, getDeadlineStatus } from '../calculations';
import { getSyncEngine } from '../sync';
import {
  computeGoalStatsWithFitness,
  createGoalMilestones,
  emptyGoalStats,
  shouldSkipGoalStoreLoad,
  syncNewGoalAndMilestones,
} from './goal-store-helpers';

export type GoalId = string;
export type MilestoneId = string;

interface GoalState {
  goals: Goal[];
  milestones: Milestone[];
  isLoading: boolean;
  hasLoadedGoals: boolean;
  hasLoadedMilestones: boolean;
  loadedUserId: string | null;
  error: string | null;
  statusFilter: GoalStatus[];
  areaFilter: AreaOfLife[];

  // Actions
  loadGoals: (force?: boolean) => Promise<void>;
  loadAllMilestones: (force?: boolean) => Promise<void>;
  addGoal: (data: GoalFormData) => Promise<Goal>;
  editGoal: (id: GoalId, data: Partial<Goal>) => Promise<void>;
  removeGoal: (id: GoalId) => Promise<void>;
  setFocus: (goalId: GoalId) => Promise<void>;
  addMilestone: (goalId: GoalId, data: MilestoneFormData) => Promise<Milestone>;
  editMilestone: (id: MilestoneId, data: Partial<Milestone>) => Promise<void>;
  removeMilestone: (id: MilestoneId) => Promise<void>;
  toggleMilestoneComplete: (id: MilestoneId) => Promise<void>;
  setStatusFilter: (statuses: GoalStatus[]) => void;
  setAreaFilter: (areas: AreaOfLife[]) => void;

  // Computed
  getGoalStats: (goalId: GoalId) => ReturnType<typeof calculateGoalStats>;
  getGoalMilestones: (goalId: GoalId) => Milestone[];
  getFocusGoal: () => Goal | undefined;
  getFocusGoals: () => Goal[];
  getGoalDeadlineStatus: (goalId: GoalId) => ReturnType<typeof getDeadlineStatus>;
  getFilteredGoals: () => Goal[];
  getActiveGoalsCount: () => number;
  getUpcomingDeadlines: (days?: number) => Goal[];
}

export const useGoalStore = create<GoalState>((set, get) => ({
  goals: [],
  milestones: [],
  isLoading: false,
  hasLoadedGoals: false,
  hasLoadedMilestones: false,
  loadedUserId: null,
  error: null,
  statusFilter: [],
  areaFilter: [],

  loadGoals: async (force = false) => {
    const state = get();
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;

      if (!uid) {
        set({ goals: [], milestones: [], isLoading: false, hasLoadedGoals: false, hasLoadedMilestones: false, loadedUserId: null });
        return;
      }

      if (shouldSkipGoalStoreLoad({ force, hasLoaded: state.hasLoadedGoals, loadedUserId: state.loadedUserId, uid })) {
        return;
      }

      if (!state.hasLoadedGoals) {
        set({ isLoading: true, error: null });
      }

      const goals = await getGoals(uid);
      set({ goals, isLoading: false, hasLoadedGoals: true, loadedUserId: uid });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadAllMilestones: async (force = false) => {
    const state = get();
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;

      if (!uid) {
        set({ milestones: [], hasLoadedMilestones: false });
        return;
      }

      if (shouldSkipGoalStoreLoad({ force, hasLoaded: state.hasLoadedMilestones, loadedUserId: state.loadedUserId, uid })) {
        return;
      }

      const milestones = await db.milestones.where('userId').equals(uid).toArray();
      set({ milestones, hasLoadedMilestones: true, loadedUserId: uid });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  addGoal: async (data: GoalFormData) => {
    const { milestones: milestoneTitles, isFocus, ...goalData } = data;
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error("User not authenticated");
    const userId = session.user.id;

    const goal = await createGoal({
      ...goalData,
      userId,
      status: 'not_started',
      isFocus: isFocus || false,
      archived: false,
    });

    const createdMilestones = await createGoalMilestones(goal.id, milestoneTitles, userId);
    set(state => ({
      goals: [...state.goals, goal],
      milestones: [...state.milestones, ...createdMilestones],
    }));

    if (isFocus) {
      await get().setFocus(goal.id);
    }
    await syncNewGoalAndMilestones(goal, createdMilestones);
    return goal;
  },

  editGoal: async (id: GoalId, data: Partial<Goal>) => {
    await updateGoal(id, data);
    const updatedGoal = get().goals.find(g => g.id === id);

    set(state => ({
      goals: state.goals.map(g => g.id === id ? { ...g, ...data } : g),
    }));

    // Sync to cloud
    if (updatedGoal) {
      try {
        const syncEngine = getSyncEngine();
        await syncEngine.pushGoal({ ...updatedGoal, ...data });
      } catch (error) {
        console.error('Failed to sync goal:', error);
      }
    }
  },

  removeGoal: async (id: GoalId) => {
    await deleteGoal(id);
    set(state => ({
      goals: state.goals.filter(g => g.id !== id),
      milestones: state.milestones.filter(m => m.goalId !== id),
    }));

    // Sync to cloud
    try {
      const syncEngine = getSyncEngine();
      await syncEngine.deleteGoal(id);
    } catch (error) {
      console.error('Failed to sync goal deletion:', error);
    }
  },

  setFocus: async (goalId: GoalId) => {
    const currentGoal = get().goals.find(g => g.id === goalId);
    if (!currentGoal) return;

    // If trying to set as focus (currently not focus)
    if (!currentGoal.isFocus) {
      // Check how many focus goals we already have
      const currentFocusCount = get().goals.filter(g => g.isFocus && !g.archived).length;

      // If we already have 2 focus goals, don't allow setting another
      if (currentFocusCount >= 2) {
        console.warn('Maximum of 2 focus goals allowed');
        return;
      }
    }

    await setFocusGoal(goalId);

    // Toggle the focus status in the store
    const updatedGoals = get().goals.map(g =>
      g.id === goalId ? { ...g, isFocus: !g.isFocus } : g
    );

    set({ goals: updatedGoals });

    // Sync to cloud
    try {
      const syncEngine = getSyncEngine();
      const updatedGoal = updatedGoals.find(g => g.id === goalId);
      if (updatedGoal) {
        await syncEngine.pushGoal(updatedGoal);
      }
    } catch (error) {
      console.error('Failed to sync focus goal:', error);
    }
  },

  addMilestone: async (goalId: GoalId, data: MilestoneFormData) => {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error("User not authenticated");

    const milestone = await createMilestone({ goalId, ...data, userId: session.user.id });
    set(state => ({
      milestones: [...state.milestones, milestone],
    }));

    // Sync to cloud
    try {
      const syncEngine = getSyncEngine();
      await syncEngine.pushMilestone(milestone);
    } catch (error) {
      console.error('Failed to sync milestone:', error);
    }

    return milestone;
  },

  editMilestone: async (id: MilestoneId, data: Partial<Milestone>) => {
    await updateMilestone(id, data);
    const updatedMilestone = get().milestones.find(m => m.id === id);

    set(state => ({
      milestones: state.milestones.map(m => m.id === id ? { ...m, ...data } : m),
    }));

    // Sync to cloud
    if (updatedMilestone) {
      try {
        const syncEngine = getSyncEngine();
        await syncEngine.pushMilestone({ ...updatedMilestone, ...data });
      } catch (error) {
        console.error('Failed to sync milestone:', error);
      }
    }
  },

  removeMilestone: async (id: MilestoneId) => {
    await deleteMilestone(id);
    set(state => ({
      milestones: state.milestones.filter(m => m.id !== id),
    }));

    // Sync to cloud
    try {
      const syncEngine = getSyncEngine();
      await syncEngine.deleteMilestone(id);
    } catch (error) {
      console.error('Failed to sync milestone deletion:', error);
    }
  },

  toggleMilestoneComplete: async (id: MilestoneId) => {
    const updated = await toggleMilestone(id);
    if (updated) {
      set(state => ({
        milestones: state.milestones.map(m => m.id === id ? updated : m),
      }));

      // Sync to cloud
      try {
        const syncEngine = getSyncEngine();
        await syncEngine.pushMilestone(updated);
      } catch (error) {
        console.error('Failed to sync milestone:', error);
      }
    }
  },

  setStatusFilter: (statuses: GoalStatus[]) => {
    set({ statusFilter: statuses });
  },

  setAreaFilter: (areas: AreaOfLife[]) => {
    set({ areaFilter: areas });
  },

  getGoalStats: (goalId: string) => {
    const { goals, milestones } = get();
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return emptyGoalStats(goalId);
    return computeGoalStatsWithFitness(goal, milestones);
  },

  getGoalMilestones: (goalId: string) => {
    return get().milestones
      .filter(m => m.goalId === goalId)
      .sort((a, b) => a.order - b.order);
  },

  getFocusGoal: () => {
    return get().goals.find(g => g.isFocus && !g.archived);
  },

  getFocusGoals: () => {
    // Return up to 2 focus goals, sorted by priority (high first) then deadline (earliest first)
    const focusGoals = get().goals.filter(g => g.isFocus && !g.archived);
    return focusGoals
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      })
      .slice(0, 2);
  },

  getGoalDeadlineStatus: (goalId: string) => {
    const goal = get().goals.find(g => g.id === goalId);
    if (!goal) {
      return { label: 'Unknown', color: 'muted' as const, daysLeft: 0 };
    }
    return getDeadlineStatus(goal.deadline);
  },

  getFilteredGoals: () => {
    const { goals, statusFilter, areaFilter } = get();

    return goals.filter(goal => {
      if (goal.archived) return false;

      if (statusFilter.length > 0 && !statusFilter.includes(goal.status)) {
        return false;
      }

      if (areaFilter.length > 0 && !areaFilter.includes(goal.areaOfLife)) {
        return false;
      }

      return true;
    });
  },

  getActiveGoalsCount: () => {
    return get().goals.filter(g => !g.archived && g.status !== 'completed').length;
  },

  getUpcomingDeadlines: (days: number = 7) => {
    const today = new Date();
    const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

    return get().goals.filter(goal => {
      if (goal.archived || goal.status === 'completed') return false;
      const deadline = new Date(goal.deadline);
      return deadline <= futureDate;
    }).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
  },
}));
