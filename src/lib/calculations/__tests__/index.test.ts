import { describe, it, expect } from 'vitest';
import { 
  formatDate, 
  calculateCurrentStreak, 
  calculateBestStreak, 
  calculateCompletionRate, 
  calculateMomentum, 
  getDeadlineStatus, 
  calculateCategoryBreakdown 
} from '../index';
import type { HabitCompletion, Habit } from '../../types';

describe('calculations', () => {

  describe('formatDate', () => {
    it('formats Date and string inputs correctly', () => {
      const date = new Date(2026, 2, 10); // March 10, 2026
      expect(formatDate(date)).toBe('2026-03-10');
      expect(formatDate('2026-03-10T00:00:00.000Z')).toBe('2026-03-10');
    });
  });

  describe('calculateCurrentStreak', () => {
    it('returns 0 for no completions', () => {
      expect(calculateCurrentStreak([], new Date())).toBe(0);
    });

    it('returns correct count for consecutive days', () => {
      // 3 consecutive days ending today
      const completions: HabitCompletion[] = [
        { id: '1', habitId: 'h1', userId: 'u1', date: '2026-03-10', completed: true },
        { id: '2', habitId: 'h1', userId: 'u1', date: '2026-03-09', completed: true },
        { id: '3', habitId: 'h1', userId: 'u1', date: '2026-03-08', completed: true },
      ];
      const today = new Date('2026-03-10T12:00:00Z');
      expect(calculateCurrentStreak(completions, today)).toBe(3);
    });

    it('gap breaks streak', () => {
      // Gap on the 8th
      const completions: HabitCompletion[] = [
        { id: '1', habitId: 'h1', userId: 'u1', date: '2026-03-10', completed: true },
        { id: '2', habitId: 'h1', userId: 'u1', date: '2026-03-09', completed: true },
        { id: '3', habitId: 'h1', userId: 'u1', date: '2026-03-07', completed: true }, // Gap
      ];
      const today = new Date('2026-03-10T12:00:00Z');
      expect(calculateCurrentStreak(completions, today)).toBe(2);
    });

    it('streak remains active if yesterday was completed but not today', () => {
      const completions: HabitCompletion[] = [
        { id: '2', habitId: 'h1', userId: 'u1', date: '2026-03-09', completed: true },
        { id: '3', habitId: 'h1', userId: 'u1', date: '2026-03-08', completed: true },
      ];
      const today = new Date('2026-03-10T12:00:00Z');
      expect(calculateCurrentStreak(completions, today)).toBe(2);
    });

    it('returns 0 if last completion was before yesterday', () => {
      const completions: HabitCompletion[] = [
        { id: '3', habitId: 'h1', userId: 'u1', date: '2026-03-08', completed: true },
      ];
      const today = new Date('2026-03-10T12:00:00Z');
      expect(calculateCurrentStreak(completions, today)).toBe(0);
    });
  });

  describe('calculateBestStreak', () => {
    it('finds longest run', () => {
      const completions: HabitCompletion[] = [
        { id: '1', habitId: 'h1', userId: 'u1', date: '2026-03-01', completed: true },
        { id: '2', habitId: 'h1', userId: 'u1', date: '2026-03-02', completed: true },
        { id: '3', habitId: 'h1', userId: 'u1', date: '2026-03-03', completed: true }, // streak 3
        
        { id: '4', habitId: 'h1', userId: 'u1', date: '2026-03-05', completed: true },
        { id: '5', habitId: 'h1', userId: 'u1', date: '2026-03-06', completed: true }, // streak 2
        
        { id: '6', habitId: 'h1', userId: 'u1', date: '2026-03-08', completed: true },
        { id: '7', habitId: 'h1', userId: 'u1', date: '2026-03-09', completed: true },
        { id: '8', habitId: 'h1', userId: 'u1', date: '2026-03-10', completed: true },
        { id: '9', habitId: 'h1', userId: 'u1', date: '2026-03-11', completed: true }, // streak 4
      ];
      expect(calculateBestStreak(completions)).toBe(4);
    });
  });

  describe('calculateCompletionRate', () => {
    it('returns 0 for 0 totalDays', () => {
      const completions = [{ id: '1', habitId: 'h1', userId: 'u1', date: '2026-03-01', completed: true }];
      expect(calculateCompletionRate(completions as HabitCompletion[], 0)).toBe(0);
    });

    it('calculates correct percentage', () => {
      const completions: HabitCompletion[] = [
        { id: '1', habitId: 'h1', userId: 'u1', date: '2026-03-01', completed: true },
        { id: '2', habitId: 'h1', userId: 'u1', date: '2026-03-02', completed: false as any }, // doesn't count
        { id: '3', habitId: 'h1', userId: 'u1', date: '2026-03-03', completed: true },
        { id: '4', habitId: 'h1', userId: 'u1', date: '2026-03-04', completed: true },
      ];
      // 3 completed out of 4 days = 75%
      expect(calculateCompletionRate(completions, 4)).toBe(75);
    });
  });

  describe('calculateMomentum', () => {
    it('returns UP when last 7 days better than previous 7', () => {
      const today = new Date('2026-03-15T12:00:00Z');
      const completions: HabitCompletion[] = [
        { id: '1', habitId: 'h1', userId: 'u1', date: '2026-03-14', completed: true },
        { id: '2', habitId: 'h1', userId: 'u1', date: '2026-03-13', completed: true },
        { id: '3', habitId: 'h1', userId: 'u1', date: '2026-03-07', completed: true }, // previous 7
      ];
      expect(calculateMomentum(completions, today)).toBe('up');
    });

    it('returns DOWN when last 7 days worse than previous 7', () => {
      const today = new Date('2026-03-15T12:00:00Z');
      const completions: HabitCompletion[] = [
        { id: '1', habitId: 'h1', userId: 'u1', date: '2026-03-14', completed: true },
        { id: '2', habitId: 'h1', userId: 'u1', date: '2026-03-08', completed: true }, // previous 7
        { id: '3', habitId: 'h1', userId: 'u1', date: '2026-03-07', completed: true }, // previous 7
      ];
      expect(calculateMomentum(completions, today)).toBe('down');
    });

    it('returns STABLE when equal', () => {
      const today = new Date('2026-03-15T12:00:00Z');
      const completions: HabitCompletion[] = [
        { id: '1', habitId: 'h1', userId: 'u1', date: '2026-03-14', completed: true },
        { id: '3', habitId: 'h1', userId: 'u1', date: '2026-03-07', completed: true }, 
      ];
      expect(calculateMomentum(completions, today)).toBe('stable');
    });
  });

  describe('getDeadlineStatus', () => {
    // We use new Date(2026, 2, 10) carefully so that it's local time (March 10 2026 at midnight), 
    // exactly matching what parseISO does to 'YYYY-MM-DD' dates.
    const todayLocalMidnight = new Date(2026, 2, 10);

    it('returns overdue status', () => {
      const status = getDeadlineStatus('2026-03-05', todayLocalMidnight);
      expect(status.color).toBe('destructive');
      expect(status.daysLeft).toBe(-5);
      expect(status.label).toContain('Overdue');
    });

    it('returns due today status', () => {
      const status = getDeadlineStatus('2026-03-10', todayLocalMidnight);
      expect(status.color).toBe('warning');
      expect(status.daysLeft).toBe(0);
      expect(status.label).toBe('Due today');
    });

    it('returns due tomorrow status', () => {
      const status = getDeadlineStatus('2026-03-11', todayLocalMidnight);
      expect(status.color).toBe('warning');
      expect(status.daysLeft).toBe(1);
      expect(status.label).toBe('Due tomorrow');
    });

    it('returns upcoming status', () => {
      const status = getDeadlineStatus('2026-03-20', todayLocalMidnight);
      expect(status.color).toBe('muted');
      expect(status.daysLeft).toBe(10);
      expect(status.label).toBe('10 days left');
    });
  });

  describe('calculateCategoryBreakdown', () => {
    it('filters by category and calculates percentages', () => {
      const habits = [
        { id: '1', userId: 'u1', name: 'Running', category: 'health', frequency: 'daily', archived: false, createdAt: '2026-03-01' } as unknown as Habit,
        { id: '2', userId: 'u1', name: 'Coding', category: 'learning', frequency: 'daily', archived: false, createdAt: '2026-03-01' } as unknown as Habit,
        { id: '3', userId: 'u1', name: 'Reading', category: 'learning', frequency: 'daily', archived: false, createdAt: '2026-03-01' } as unknown as Habit,
      ];
      const completions: HabitCompletion[] = [
        { id: 'c1', habitId: '1', userId: 'u1', date: '2026-03-10', completed: true },
        { id: 'c2', habitId: '2', userId: 'u1', date: '2026-03-10', completed: true },
      ];
      
      const breakdown = calculateCategoryBreakdown(habits, completions);
      
      expect(breakdown).toHaveLength(2); // health and learning
      
      const health = breakdown.find(b => b.category === 'health');
      expect(health?.count).toBe(1);
      expect(health?.percentage).toBe(33); // 1 out of 3 total habits
      
      const learning = breakdown.find(b => b.category === 'learning');
      expect(learning?.count).toBe(2);
      expect(learning?.percentage).toBe(67); // 2 out of 3 total habits
    });
  });
});
