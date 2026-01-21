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
import type { Goal, Milestone, GoalFormData, MilestoneFormData, GoalStatus, AreaOfLife, Priority } from '../types';
import { calculateGoalStats, getDeadlineStatus } from '../calculations';
import { getSyncEngine } from '../sync';

interface GoalState {
  goals: Goal[];
  milestones: Milestone[];
  isLoading: boolean;
  error: string | null;
  statusFilter: GoalStatus[];
  areaFilter: AreaOfLife[];

  // Actions
  loadGoals: () => Promise<void>;
  loadAllMilestones: () => Promise<void>;
  addGoal: (data: GoalFormData) => Promise<Goal>;
  editGoal: (id: string, data: Partial<Goal>) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
  setFocus: (goalId: string) => Promise<void>;
  addMilestone: (goalId: string, data: MilestoneFormData) => Promise<Milestone>;
  editMilestone: (id: string, data: Partial<Milestone>) => Promise<void>;
  removeMilestone: (id: string) => Promise<void>;
  toggleMilestoneComplete: (id: string) => Promise<void>;
  setStatusFilter: (statuses: GoalStatus[]) => void;
  setAreaFilter: (areas: AreaOfLife[]) => void;

  // Computed
  getGoalStats: (goalId: string) => ReturnType<typeof calculateGoalStats>;
  getGoalMilestones: (goalId: string) => Milestone[];
  getFocusGoal: () => Goal | undefined;
  getGoalDeadlineStatus: (goalId: string) => ReturnType<typeof getDeadlineStatus>;
  getFilteredGoals: () => Goal[];
  getActiveGoalsCount: () => number;
  getUpcomingDeadlines: (days?: number) => Goal[];
}

export const useGoalStore = create<GoalState>((set, get) => ({
  goals: [],
  milestones: [],
  isLoading: false,
  error: null,
  statusFilter: [],
  areaFilter: [],

  loadGoals: async () => {
    set({ isLoading: true, error: null });
    try {
      const goals = await getGoals();
      set({ goals, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadAllMilestones: async () => {
    try {
      const milestones = await db.milestones.toArray();
      set({ milestones });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  addGoal: async (data: GoalFormData) => {
    const { milestones: milestoneTitles, ...goalData } = data;

    const goal = await createGoal({
      ...goalData,
      status: 'not_started',
      isFocus: false,
      archived: false,
    });

    // Create milestones
    const createdMilestones: Milestone[] = [];
    for (const title of milestoneTitles) {
      if (title.trim()) {
        const milestone = await createMilestone({ goalId: goal.id, title: title.trim() });
        createdMilestones.push(milestone);
      }
    }

    set(state => ({
      goals: [...state.goals, goal],
      milestones: [...state.milestones, ...createdMilestones],
    }));

    // Sync to cloud
    try {
      const syncEngine = getSyncEngine();
      await syncEngine.pushGoal(goal);
      for (const milestone of createdMilestones) {
        await syncEngine.pushMilestone(milestone);
      }
    } catch (error) {
      console.error('Failed to sync goal:', error);
    }

    return goal;
  },

  editGoal: async (id: string, data: Partial<Goal>) => {
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

  removeGoal: async (id: string) => {
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

  setFocus: async (goalId: string) => {
    await setFocusGoal(goalId);
    const updatedGoals = get().goals.map(g => ({
      ...g,
      isFocus: g.id === goalId,
    }));

    set({ goals: updatedGoals });

    // Sync to cloud
    try {
      const syncEngine = getSyncEngine();
      for (const goal of updatedGoals) {
        await syncEngine.pushGoal(goal);
      }
    } catch (error) {
      console.error('Failed to sync focus goal:', error);
    }
  },

  addMilestone: async (goalId: string, data: MilestoneFormData) => {
    const milestone = await createMilestone({ goalId, ...data });
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

  editMilestone: async (id: string, data: Partial<Milestone>) => {
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

  removeMilestone: async (id: string) => {
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

  toggleMilestoneComplete: async (id: string) => {
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
    if (!goal) {
      return {
        goalId,
        progress: 0,
        milestonesCompleted: 0,
        milestonesTotal: 0,
        daysRemaining: 0,
        daysElapsed: 0,
        totalDays: 0,
        isOnTrack: false,
      };
    }
    return calculateGoalStats(goal, milestones);
  },

  getGoalMilestones: (goalId: string) => {
    return get().milestones
      .filter(m => m.goalId === goalId)
      .sort((a, b) => a.order - b.order);
  },

  getFocusGoal: () => {
    return get().goals.find(g => g.isFocus && !g.archived);
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
