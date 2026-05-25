import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGoalStore } from '../goal-store';
import type { Goal, Milestone, GoalFormData } from '../../types';

// Mock dependencies
vi.mock('../../db', () => ({
  getGoals: vi.fn(),
  createGoal: vi.fn(async (data) => ({ id: 'g1', ...data })),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
  setFocusGoal: vi.fn(),
  getMilestones: vi.fn(),
  createMilestone: vi.fn(async (data) => ({ id: Math.random().toString(), ...data, completed: false, order: 0 })),
  updateMilestone: vi.fn(),
  deleteMilestone: vi.fn(),
  toggleMilestone: vi.fn(async (id) => ({ id, completed: true })),
  db: {
    milestones: {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    }
  }
}));

vi.mock('../../supabase/client', () => ({
  getSupabaseClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'u1' } } }
      })
    }
  }))
}));

vi.mock('../../sync', () => ({
  getSyncEngine: vi.fn(() => ({
    pushGoal: vi.fn(),
    deleteGoal: vi.fn(),
    pushMilestone: vi.fn(),
    deleteMilestone: vi.fn(),
  }))
}));

describe('goal-store', () => {
  beforeEach(() => {
    useGoalStore.setState({
      goals: [],
      milestones: [],
      isLoading: false,
      error: null,
      statusFilter: [],
      areaFilter: [],
    });
    vi.clearAllMocks();
  });

  it('Initial state is empty', () => {
    const state = useGoalStore.getState();
    expect(state.goals).toEqual([]);
    expect(state.milestones).toEqual([]);
  });

  it('addGoal creates goal and milestones', async () => {
    const { addGoal } = useGoalStore.getState();
    const formData: GoalFormData = {
      title: 'New Goal',
      description: 'Test',
      areaOfLife: 'health',
      priority: 'high',
      startDate: '2026-05-25',
      deadline: '2026-12-31',
      isFocus: false,
      milestones: ['M1', 'M2']
    };

    const result = await addGoal(formData);
    
    expect(result.id).toBe('g1');
    expect(result.title).toBe('New Goal');
    
    const state = useGoalStore.getState();
    expect(state.goals).toHaveLength(1);
    expect(state.milestones).toHaveLength(2);
    expect(state.milestones[0].title).toBe('M1');
  });

  it('editGoal updates goal', async () => {
    const initialGoal: Goal = { 
        id: 'g1', userId: 'u1', title: 'Old', description: '', areaOfLife: 'health', 
        priority: 'high', status: 'not_started', startDate: '2026-03-01', deadline: '2026-12-31', 
        createdAt: '2026-03-01', updatedAt: '2026-03-01', archived: false, isFocus: false 
    };
    useGoalStore.setState({ goals: [initialGoal] });
    
    const { editGoal } = useGoalStore.getState();
    await editGoal('g1', { title: 'New Title', status: 'in_progress' });
    
    const state = useGoalStore.getState();
    expect(state.goals[0].title).toBe('New Title');
    expect(state.goals[0].status).toBe('in_progress');
  });

  it('removeGoal removes goal and associated milestones', async () => {
    useGoalStore.setState({ 
      goals: [{ id: 'g1' } as unknown as Goal],
      milestones: [{ id: 'm1', goalId: 'g1' } as unknown as Milestone, { id: 'm2', goalId: 'g2' } as unknown as Milestone]
    });
    
    const { removeGoal } = useGoalStore.getState();
    await removeGoal('g1');
    
    const state = useGoalStore.getState();
    expect(state.goals).toHaveLength(0);
    expect(state.milestones).toHaveLength(1); // m2 remains
  });

  it('setFocus handles limits', async () => {
    useGoalStore.setState({ 
      goals: [
        { id: 'g1', isFocus: true, archived: false } as unknown as Goal,
        { id: 'g2', isFocus: true, archived: false } as unknown as Goal,
        { id: 'g3', isFocus: false, archived: false } as unknown as Goal,
      ]
    });
    
    const { setFocus } = useGoalStore.getState();
    
    // Max 2 focus goals allowed, should not change state
    await setFocus('g3');
    expect(useGoalStore.getState().goals.find(g => g.id === 'g3')?.isFocus).toBe(false);
    
    // Toggle existing focus off
    await setFocus('g1');
    expect(useGoalStore.getState().goals.find(g => g.id === 'g1')?.isFocus).toBe(false);
    
    // Now can add g3
    await setFocus('g3');
    expect(useGoalStore.getState().goals.find(g => g.id === 'g3')?.isFocus).toBe(true);
  });

  it('getFilteredGoals filters correctly', () => {
    useGoalStore.setState({ 
      goals: [
        { id: 'g1', status: 'not_started', areaOfLife: 'health', archived: false } as unknown as Goal,
        { id: 'g2', status: 'in_progress', areaOfLife: 'work', archived: false } as unknown as Goal,
        { id: 'g3', status: 'completed', areaOfLife: 'health', archived: true } as unknown as Goal,
      ]
    });
    
    const { getFilteredGoals, setStatusFilter, setAreaFilter } = useGoalStore.getState();
    
    // Default: excluding archived
    expect(getFilteredGoals()).toHaveLength(2);
    
    setStatusFilter(['in_progress']);
    expect(getFilteredGoals()).toHaveLength(1);
    expect(getFilteredGoals()[0].id).toBe('g2');
    
    setStatusFilter([]);
    setAreaFilter(['health']);
    expect(getFilteredGoals()).toHaveLength(1);
    expect(getFilteredGoals()[0].id).toBe('g1');
  });

  it('toggleMilestoneComplete updates state', async () => {
    useGoalStore.setState({ 
      milestones: [
        { id: 'm1', goalId: 'g1', completed: false } as unknown as Milestone
      ]
    });
    
    const { toggleMilestoneComplete } = useGoalStore.getState();
    await toggleMilestoneComplete('m1');
    
    const state = useGoalStore.getState();
    expect(state.milestones[0].completed).toBe(true);
  });
});
