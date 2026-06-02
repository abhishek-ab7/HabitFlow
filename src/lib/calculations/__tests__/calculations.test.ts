import { describe, it, expect } from 'vitest';
import { calculateCurrentStreak, calculateBestStreak } from '../index';
import type { HabitCompletion } from '../../types';

describe('Pure Function Calculations (Streaks)', () => {
  /**
   * Test Suite 4 - Test A: Streak logic resets correctly with a 2-day gap
   * Verify that a 2-day gap before today resets the current streak.
   */
  it('should reset the current streak count to 0 when there is a 2-day gap before today', () => {
    // Arrange
    const today = new Date('2026-06-05T12:00:00Z');
    // Today is June 5.
    // Yesterday is June 4 (not completed).
    // June 3 is not completed (creating a 2-day gap: June 3 & June 4).
    // The last completed day is June 2.
    const completions: HabitCompletion[] = [
      { id: '1', habitId: 'h1', userId: 'u1', date: '2026-06-01', completed: true },
      { id: '2', habitId: 'h1', userId: 'u1', date: '2026-06-02', completed: true },
      // June 3 (gap)
      // June 4 (gap)
    ];

    // Act
    const currentStreak = calculateCurrentStreak(completions, today);

    // Assert
    expect(currentStreak).toBe(0);
  });

  /**
   * Verify that best streak returns the correct historical maximum regardless of subsequent gaps.
   */
  it('should calculate the best streak correctly even if a 2-day gap resets the current streak', () => {
    // Arrange
    // 3-day streak (June 1 - June 3) -> 2-day gap (June 4 - June 5) -> 2-day streak (June 6 - June 7)
    const completions: HabitCompletion[] = [
      { id: '1', habitId: 'h1', userId: 'u1', date: '2026-06-01', completed: true },
      { id: '2', habitId: 'h1', userId: 'u1', date: '2026-06-02', completed: true },
      { id: '3', habitId: 'h1', userId: 'u1', date: '2026-06-03', completed: true },
      // June 4, June 5 (gaps)
      { id: '4', habitId: 'h1', userId: 'u1', date: '2026-06-06', completed: true },
      { id: '5', habitId: 'h1', userId: 'u1', date: '2026-06-07', completed: true },
    ];

    // Act
    const bestStreak = calculateBestStreak(completions);

    // Assert
    expect(bestStreak).toBe(3);
  });
});
