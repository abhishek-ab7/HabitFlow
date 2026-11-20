import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CrossDomainActionMediator } from '../mediator';
import { useHabitStore } from '../habit-store';
import { toggleCompletion } from '../../db';

vi.mock('../../db', () => ({
  toggleCompletion: vi.fn(),
  updateSettings: vi.fn().mockResolvedValue(undefined),
  getSettings: vi.fn().mockResolvedValue(undefined),
  db: {
    completions: {
      update: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

describe('CrossDomainActionMediator', () => {
  beforeEach(() => {
    useHabitStore.setState({ completions: [] });
    vi.clearAllMocks();
  });

  /**
   * Test Suite 1 - Test A: HABIT_COMPLETED action dispatch
   * Verify that the habit completion row is added in habit-store.
   */
  it('should add a completion row in habit-store for HABIT_COMPLETED', async () => {
    const habitId = 'habit-1';
    const date = '2026-06-02';
    const mockCompletion = {
      id: 'comp-1',
      userId: 'test-user',
      habitId,
      date,
      completed: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(toggleCompletion).mockResolvedValue(mockCompletion);

    expect(useHabitStore.getState().completions).toHaveLength(0);

    await CrossDomainActionMediator.dispatch({
      type: 'HABIT_COMPLETED',
      payload: {
        habitId,
        date,
        difficulty: 'hard',
        category: 'work',
      },
    });

    const completions = useHabitStore.getState().completions;
    expect(completions).toHaveLength(1);
    expect(completions[0]).toEqual(mockCompletion);
    expect(toggleCompletion).toHaveBeenCalledWith(habitId, date, 'test-user');
  });

  /**
   * Test Suite 1 - Test B: HABIT_UNCOMPLETED action dispatch
   * Verify that the completion row is removed from habit-store.
   */
  it('should remove the completion row in habit-store for HABIT_UNCOMPLETED', async () => {
    const habitId = 'habit-1';
    const date = '2026-06-02';
    const mockCompletion = {
      id: 'comp-1',
      userId: 'test-user',
      habitId,
      date,
      completed: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    useHabitStore.setState({
      completions: [mockCompletion],
    });

    const mockUncompletion = {
      ...mockCompletion,
      completed: false,
    };
    vi.mocked(toggleCompletion).mockResolvedValue(mockUncompletion);

    await CrossDomainActionMediator.dispatch({
      type: 'HABIT_UNCOMPLETED',
      payload: {
        habitId,
        date,
        difficulty: 'easy',
        category: 'health',
      },
    });

    const completions = useHabitStore.getState().completions;
    expect(completions).toHaveLength(0);
    expect(toggleCompletion).toHaveBeenCalledWith(habitId, date, 'test-user');
  });
});
