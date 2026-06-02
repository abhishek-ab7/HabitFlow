import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CrossDomainActionMediator } from '../mediator';
import { useHabitStore } from '../habit-store';
import { useGamificationStore } from '../gamification-store';
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
    vi.clearAllMocks();
  });

  /**
   * Test Suite 1 - Test A: HABIT_COMPLETED action dispatch
   * Verify that:
   * 1. The habit completion row is added in habit-store.
   * 2. XP is correctly incremented in gamification-store based on the difficulty payload.
   */
  it('should add a completion row in habit-store and award XP in gamification-store for HABIT_COMPLETED', async () => {
    // Arrange
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

    // Initial state
    expect(useHabitStore.getState().completions).toHaveLength(0);
    expect(useGamificationStore.getState().totalXp).toBe(0);

    // Act
    await CrossDomainActionMediator.dispatch({
      type: 'HABIT_COMPLETED',
      payload: {
        habitId,
        date,
        difficulty: 'hard', // should award 30 XP
        category: 'work',
      },
    });

    // Assert
    // 1. Check completion row added in habit-store
    const completions = useHabitStore.getState().completions;
    expect(completions).toHaveLength(1);
    expect(completions[0]).toEqual(mockCompletion);
    expect(toggleCompletion).toHaveBeenCalledWith(habitId, date, 'test-user');

    // 2. Check XP incremented in gamification-store
    expect(useGamificationStore.getState().totalXp).toBe(30);
  });

  /**
   * Test Suite 1 - Test B: HABIT_UNCOMPLETED action dispatch
   * Verify that:
   * 1. The completion row is removed from habit-store.
   * 2. XP is deducted in gamification-store.
   */
  it('should remove the completion row in habit-store and deduct XP in gamification-store for HABIT_UNCOMPLETED', async () => {
    // Arrange
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

    // Set initial store state
    useHabitStore.setState({
      completions: [mockCompletion],
    });
    useGamificationStore.setState({
      totalXp: 100,
      xp: 0,
      level: 1,
    });

    const mockUncompletion = {
      ...mockCompletion,
      completed: false,
    };
    vi.mocked(toggleCompletion).mockResolvedValue(mockUncompletion);

    // Act
    await CrossDomainActionMediator.dispatch({
      type: 'HABIT_UNCOMPLETED',
      payload: {
        habitId,
        date,
        difficulty: 'easy', // should deduct 10 XP
        category: 'health',
      },
    });

    // Assert
    // 1. Check completion row removed in habit-store
    const completions = useHabitStore.getState().completions;
    expect(completions).toHaveLength(0);
    expect(toggleCompletion).toHaveBeenCalledWith(habitId, date, 'test-user');

    // 2. Check XP deducted in gamification-store
    expect(useGamificationStore.getState().totalXp).toBe(90);
  });
});
