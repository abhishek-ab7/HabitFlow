import { describe, expect, it } from 'vitest';
import {
  computeLifeOsAnalytics,
  computeNormalizedPillarWeights,
  getAnalyticsRangeWindow,
  shiftIsoDate,
  toAnalyticsRangeKey,
  toLegacyTimeRange,
} from '@/lib/analytics/life-os-aggregator';
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceTransaction,
  FitnessDailyLog,
  Habit,
  HabitCompletion,
  MealLog,
  WorkoutSession,
} from '@/lib/types';

// Fixed IST reference: 2026-11-25 14:30 IST (09:00 UTC)
const FIXED_NOW = new Date('2026-11-25T09:00:00.000Z');

describe('life-os-aggregator', () => {
  it('maps legacy TimeRange values and normalizes range windows in IST', () => {
    expect(toAnalyticsRangeKey('week')).toBe('7d');
    expect(toAnalyticsRangeKey('month')).toBe('30d');
    expect(toAnalyticsRangeKey('quarter')).toBe('90d');
    expect(toAnalyticsRangeKey('year')).toBe('year');
    expect(toAnalyticsRangeKey(undefined)).toBe('30d');
    expect(toLegacyTimeRange('7d')).toBe('week');

    // 2026-11-25 22:00 UTC is already 2026-11-26 03:30 IST
    const lateUtcDate = new Date('2026-11-25T22:00:00.000Z');
    const win7d = getAnalyticsRangeWindow('7d', lateUtcDate);
    expect(win7d.todayDateStr).toBe('2026-11-26');
    expect(win7d.startDateStr).toBe('2026-11-20');
    expect(win7d.dayCount).toBe(7);

    const winYear = getAnalyticsRangeWindow('year', FIXED_NOW);
    expect(winYear.startDateStr).toBe('2026-01-01');
    expect(winYear.endDateStr).toBe('2026-11-25');
  });

  it('handles completely empty stores gracefully without NaN or throwing', () => {
    const result = computeLifeOsAnalytics({
      range: '30d',
      referenceDate: FIXED_NOW,
      settings: {
        showFinance: true,
        showFitness: true,
        habitOnlyMode: false,
        weekStartsOn: 1,
      },
    });

    expect(result.lifeOsScore).toBe(0);
    expect(result.habits.hasData).toBe(false);
    expect(result.finance.hasData).toBe(false);
    expect(result.fitness.hasData).toBe(false);
    expect(result.weights).toEqual({ habitsPct: 35, financePct: 35, fitnessPct: 30 });
    expect(result.habits.dailyStats).toHaveLength(30);
    expect(result.finance.dailyCashflow).toHaveLength(30);
    expect(result.fitness.dailyFuelSeries).toHaveLength(30);
  });

  it('re-normalizes pillar weights dynamically when Finance or Fitness are disabled', () => {
    expect(computeNormalizedPillarWeights(true, true)).toEqual({
      habitsPct: 35,
      financePct: 35,
      fitnessPct: 30,
    });
    expect(computeNormalizedPillarWeights(false, true)).toEqual({
      habitsPct: 54,
      financePct: 0,
      fitnessPct: 46,
    });
    expect(computeNormalizedPillarWeights(true, false)).toEqual({
      habitsPct: 50,
      financePct: 50,
      fitnessPct: 0,
    });
    expect(computeNormalizedPillarWeights(false, false)).toEqual({
      habitsPct: 100,
      financePct: 0,
      fitnessPct: 0,
    });

    const habitOnly = computeLifeOsAnalytics({
      range: '7d',
      referenceDate: FIXED_NOW,
      settings: {
        habitOnlyMode: true,
        showFinance: true,
        showFitness: true,
        weekStartsOn: 1,
      },
      habits: [
        {
          id: 'h1',
          userId: 'u1',
          name: 'Deep Work',
          category: 'work',
          frequencyType: 'daily',
          targetDaysPerWeek: 7,
          order: 0,
          archived: false,
          createdAt: '2026-11-01T00:00:00.000Z',
        },
      ],
      completions: Array.from({ length: 7 }, (_, i) => ({
        id: `c-${i}`,
        userId: 'u1',
        habitId: 'h1',
        date: shiftIsoDate('2026-11-25', -i),
        completed: true,
      })),
    });

    expect(habitOnly.modules.habitOnlyMode).toBe(true);
    expect(habitOnly.modules.showFinance).toBe(false);
    expect(habitOnly.modules.showFitness).toBe(false);
    expect(habitOnly.weights).toEqual({ habitsPct: 100, financePct: 0, fitnessPct: 0 });
    expect(habitOnly.habits.completionRatePct).toBe(100);
    expect(habitOnly.lifeOsScore).toBe(100);
    expect(habitOnly.finance.hasData).toBe(false);
    expect(habitOnly.fitness.hasData).toBe(false);
  });

  function buildCrossDomainRangeFixtures() {
    const habits: Habit[] = [{
      id: 'h1', userId: 'u1', name: 'Morning Run', category: 'health', frequencyType: 'daily',
      targetDaysPerWeek: 7, order: 0, archived: false, createdAt: '2026-10-01T00:00:00.000Z',
    }];
    const completions: HabitCompletion[] = [
      { id: 'c1', userId: 'u1', habitId: 'h1', date: '2026-11-25', completed: true },
      { id: 'c2', userId: 'u1', habitId: 'h1', date: '2026-11-24', completed: true },
      { id: 'c3', userId: 'u1', habitId: 'h1', date: '2026-11-10', completed: true },
    ];
    const accounts: FinanceAccount[] = [{
      id: 'acc1', userId: 'u1', name: 'HDFC Bank', type: 'bank', balance: 50000, currency: 'INR',
      color: '#2563eb', icon: 'bank', isDefault: true, archived: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-11-25T00:00:00.000Z',
    }];
    const categories: FinanceCategory[] = [{
      id: 'cat-food', userId: 'u1', name: 'Food & Dining', slug: 'food-dining', type: 'expense',
      icon: 'utensils', color: '#f97316', monthlyBudgetLimit: 10000, subcategories: [], order: 1,
      isSystem: true, archived: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }];
    const transactions: FinanceTransaction[] = [
      {
        id: 't1', userId: 'u1', title: 'Salary', amount: 80000, type: 'income', categoryId: 'cat-inc',
        accountId: 'acc1', date: '2026-11-20', monthKey: '2026-11', tags: [], isRecurring: true,
        createdAt: '2026-11-20T00:00:00.000Z', updatedAt: '2026-11-20T00:00:00.000Z',
      },
      {
        id: 't2', userId: 'u1', title: 'Swiggy Dinner', amount: 500, type: 'expense', categoryId: 'cat-food',
        accountId: 'acc1', date: '2026-11-25', monthKey: '2026-11', tags: [], isRecurring: false,
        createdAt: '2026-11-25T00:00:00.000Z', updatedAt: '2026-11-25T00:00:00.000Z',
      },
      {
        id: 't-old', userId: 'u1', title: 'Old Expense', amount: 9999, type: 'expense', categoryId: 'cat-food',
        accountId: 'acc1', date: '2026-10-05', monthKey: '2026-10', tags: [], isRecurring: false,
        createdAt: '2026-10-05T00:00:00.000Z', updatedAt: '2026-10-05T00:00:00.000Z',
      },
    ];
    const dailyLogs: FitnessDailyLog[] = [
      { id: 'fl1', userId: 'u1', date: '2026-11-24', weightKg: 74.2, waistInches: 32.5, waterMl: 3000, steps: 9000, sleepHours: 7.5, createdAt: '2026-11-24T00:00:00.000Z', updatedAt: '2026-11-24T00:00:00.000Z' },
      { id: 'fl2', userId: 'u1', date: '2026-11-25', weightKg: 74.0, waterMl: 2800, steps: 10000, sleepHours: 8.0, createdAt: '2026-11-25T00:00:00.000Z', updatedAt: '2026-11-25T00:00:00.000Z' },
    ];
    const mealLogs: MealLog[] = [{
      id: 'm1', userId: 'u1', date: '2026-11-25', mealType: 'lunch', name: 'Chicken + Rice',
      calories: 520, proteinG: 42, carbsG: 45, fatG: 12, quantityMultiplier: 1, isJunk: false,
      source: 'staple', loggedAt: '2026-11-25T13:00:00.000Z', createdAt: '2026-11-25T13:00:00.000Z', updatedAt: '2026-11-25T13:00:00.000Z',
    }];
    const workoutSessions: WorkoutSession[] = [{
      id: 'w1', userId: 'u1', date: '2026-11-25', title: 'Push Day', workoutType: 'push', durationMinutes: 55,
      exercises: [{ name: 'Bench Press', sets: [{ reps: 8, weightKg: 60 }] }], source: 'manual',
      createdAt: '2026-11-25T08:00:00.000Z', updatedAt: '2026-11-25T08:00:00.000Z',
    }];
    return { habits, completions, accounts, categories, transactions, dailyLogs, mealLogs, workoutSessions };
  }

  it('aggregates cross-domain Habits, Finance, and Fitness metrics accurately inside range boundaries', () => {
    const fixtures = buildCrossDomainRangeFixtures();
    const snapshot = computeLifeOsAnalytics({
      range: '7d',
      referenceDate: FIXED_NOW,
      settings: { showFinance: true, showFitness: true, habitOnlyMode: false, weekStartsOn: 1 },
      ...fixtures,
    });

    expect(snapshot.habits.periodCompletions).toBe(2);
    expect(snapshot.habits.currentBestActiveStreak).toBe(2);
    expect(snapshot.finance.totalIncome).toBe(80000);
    expect(snapshot.finance.totalExpense).toBe(500);
    expect(snapshot.finance.discretionarySpend).toBe(500);
    expect(snapshot.finance.savingsRatePct).toBe(99);
    expect(snapshot.finance.categorySpend[0]).toMatchObject({ categoryId: 'cat-food', name: 'Food & Dining', amount: 500, sharePct: 100 });
    expect(snapshot.fitness.latestWeightKg).toBe(74.0);
    expect(snapshot.fitness.latestWaistInches).toBe(32.5);
    expect(snapshot.fitness.avgSteps).toBe(9500);
    expect(snapshot.fitness.avgSleepHours).toBe(7.8);
    expect(snapshot.fitness.workoutCount).toBe(1);
    expect(snapshot.fitness.totalVolumeKg).toBe(480);
    expect(snapshot.lifeOsScore).toBeGreaterThan(0);
    expect(snapshot.lifeOsScore).toBeLessThanOrEqual(100);
  });

  it('computes high-habit vs low-habit daily spend correlation inside the range', () => {
    const habits: Habit[] = [{
      id: 'h1', userId: 'u1', name: 'Discipline', category: 'health', frequencyType: 'daily',
      targetDaysPerWeek: 7, order: 0, archived: false, createdAt: '2026-11-01T00:00:00.000Z',
    }];
    const completions: HabitCompletion[] = [
      { id: 'c1', userId: 'u1', habitId: 'h1', date: '2026-11-25', completed: true },
      { id: 'c2', userId: 'u1', habitId: 'h1', date: '2026-11-24', completed: true },
    ];
    const mkTx = (id: string, title: string, amount: number, date: string): FinanceTransaction => ({
      id, userId: 'u1', title, amount, type: 'expense', categoryId: 'cat-food', accountId: 'acc1',
      date, monthKey: '2026-11', tags: [], isRecurring: false, createdAt: `${date}T00:00:00.000Z`, updatedAt: `${date}T00:00:00.000Z`,
    });
    const transactions: FinanceTransaction[] = [
      mkTx('t1', 'Tea', 100, '2026-11-25'),
      mkTx('t2', 'Fruit', 100, '2026-11-24'),
      mkTx('t3', 'Takeout', 600, '2026-11-23'),
      mkTx('t4', 'Snacks', 400, '2026-11-22'),
    ];

    const result = computeLifeOsAnalytics({
      range: '7d',
      referenceDate: FIXED_NOW,
      settings: { showFinance: true, showFitness: false, habitOnlyMode: false, weekStartsOn: 1 },
      habits,
      completions,
      transactions,
    });

    const corr = result.intelligence.habitSpendCorrelation;
    expect(corr.hasEnoughData).toBe(true);
    expect(corr.highHabitDaysCount).toBe(2);
    expect(corr.highHabitAvgSpendInr).toBe(100);
    expect(corr.lowHabitDaysCount).toBe(5);
    expect(corr.lowHabitAvgSpendInr).toBe(200);
    expect(corr.dailySavingsDeltaInr).toBe(100);
  });
});
