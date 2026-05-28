import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTaskStore } from '../task-store';
import { useGamificationStore, XP_PER_TASK } from '../gamification-store';
import type { Task, TaskFormData } from '../../types';

// Mock dependencies
vi.mock('../../db', () => ({
  getTasks: vi.fn(),
  createTask: vi.fn(async (data) => ({ id: 't1', created_at: '2026-03-01T12:00:00Z', ...data })),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
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
    pushTask: vi.fn(),
    deleteTask: vi.fn(),
  }))
}));

// Mock gamification store
vi.mock('../gamification-store', () => {
    const addXpMock = vi.fn();
    return {
        XP_PER_TASK: 10,
        useGamificationStore: {
            getState: () => ({ addXp: addXpMock })
        }
    };
});

describe('task-store', () => {
  beforeEach(() => {
    useTaskStore.setState({
      tasks: [],
      isLoading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  it('Initial state is empty', () => {
    const state = useTaskStore.getState();
    expect(state.tasks).toEqual([]);
    expect(state.isLoading).toBe(false);
  });

  it('addTask creates task and syncs', async () => {
    const { addTask } = useTaskStore.getState();
    const formData: TaskFormData = {
      title: 'New Task',
      description: 'Test',
      priority: 'high',
      due_date: '2026-03-10'
    };

    const task = await addTask(formData);
    
    expect(task.id).toBe('t1');
    expect(task.title).toBe('New Task');
    
    const state = useTaskStore.getState();
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].id).toBe('t1');
  });

  it('editTask updates task', async () => {
    useTaskStore.setState({ 
      tasks: [
        { id: 't1', userId: 'u1', title: 'Old', priority: 'low', status: 'todo' } as Task
      ]
    });
    
    const { editTask } = useTaskStore.getState();
    await editTask('t1', { title: 'New Title', priority: 'high' });
    
    const state = useTaskStore.getState();
    expect(state.tasks[0].title).toBe('New Title');
    expect(state.tasks[0].priority).toBe('high');
  });

  it('removeTask removes task', async () => {
    useTaskStore.setState({ 
      tasks: [
        { id: 't1', userId: 'u1', title: 'T1' } as Task,
        { id: 't2', userId: 'u1', title: 'T2' } as Task
      ]
    });
    
    const { removeTask } = useTaskStore.getState();
    await removeTask('t1');
    
    const state = useTaskStore.getState();
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].id).toBe('t2');
  });

  it('toggleTaskComplete toggles status and awards XP', async () => {
    useTaskStore.setState({ 
      tasks: [
        { id: 't1', userId: 'u1', title: 'T1', status: 'todo' } as Task
      ]
    });
    
    const addXpMock = useGamificationStore.getState().addXp;
    const { toggleTaskComplete } = useTaskStore.getState();
    
    // Complete task -> Should add XP
    await toggleTaskComplete('t1');
    expect(useTaskStore.getState().tasks[0].status).toBe('done');
    expect(addXpMock).toHaveBeenCalledWith(XP_PER_TASK);
    
    vi.clearAllMocks();
    
    // Uncomplete task -> Should subtract XP
    await toggleTaskComplete('t1');
    expect(useTaskStore.getState().tasks[0].status).toBe('todo');
    expect(addXpMock).toHaveBeenCalledWith(-XP_PER_TASK);
  });

  it('getActiveTasks and getCompletedTasks filter correctly', () => {
    useTaskStore.setState({ 
      tasks: [
        { id: 't1', status: 'todo' } as Task,
        { id: 't2', status: 'in_progress' } as Task,
        { id: 't3', status: 'done' } as Task,
        { id: 't4', status: 'archived' } as Task,
      ]
    });
    
    const { getActiveTasks, getCompletedTasks } = useTaskStore.getState();
    
    const active = getActiveTasks();
    expect(active).toHaveLength(2); // todo, in_progress
    expect(active.map(t => t.id)).toEqual(['t1', 't2']);
    
    const completed = getCompletedTasks();
    expect(completed).toHaveLength(1); // done
    expect(completed[0].id).toBe('t3');
  });

  it('getTasksByDate filters by due_date', () => {
    useTaskStore.setState({ 
      tasks: [
        { id: 't1', due_date: '2026-03-10' } as Task,
        { id: 't2', due_date: '2026-03-10T15:00:00Z' } as Task,
        { id: 't3', due_date: '2026-03-11' } as Task,
        { id: 't4', due_date: null } as unknown as Task,
      ]
    });
    
    const { getTasksByDate } = useTaskStore.getState();
    
    const tasksFor10th = getTasksByDate('2026-03-10');
    expect(tasksFor10th).toHaveLength(2);
    expect(tasksFor10th.map(t => t.id)).toEqual(['t1', 't2']);
    
    const tasksFor11th = getTasksByDate('2026-03-11');
    expect(tasksFor11th).toHaveLength(1);
    expect(tasksFor11th[0].id).toBe('t3');
  });
});
