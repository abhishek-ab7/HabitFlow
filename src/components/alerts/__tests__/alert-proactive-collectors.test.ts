import { describe, expect, it } from 'vitest';
import { addDays } from '@/lib/finance/credit-card-cycles';
import {
  collectEnvelope80PctAlerts,
  collectStreakRecoveryAlerts,
} from '../alert-proactive-collectors';
import type { FinanceCategory, FinanceTransaction, Habit, HabitCompletion } from '@/lib/types';

function makeCategory(limit: number): FinanceCategory {
  return {
    id: 'cat_food',
    userId: 'u1',
    name: 'Food & Dining',
    slug: 'food-dining',
    type: 'expense',
    icon: 'utensils',
    color: '#f97316',
    monthlyBudgetLimit: limit,
    subcategories: [],
    order: 0,
    isSystem: true,
    archived: false,
    createdAt: '2026-11-01',
    updatedAt: '2026-11-01',
  };
}

function makeExpense(amount: number, date: string): FinanceTransaction {
  return {
    id: `tx_${amount}_${date}`,
    userId: 'u1',
    title: 'Swiggy',
    amount,
    type: 'expense',
    categoryId: 'cat_food',
    accountId: 'acc_1',
    date,
    monthKey: date.slice(0, 7),
    isRecurring: false,
    tags: [],
    createdAt: date,
    updatedAt: date,
  };
}

function makeHabit(id = 'h1', twoMin?: string): Habit {
  return {
    id,
    userId: 'u1',
    name: 'Morning Reading',
    category: 'personal',
    targetDaysPerWeek: 7,
    createdAt: '2026-01-01',
    archived: false,
    order: 0,
    metadata: twoMin ? { twoMinuteVersion: twoMin } : undefined,
  };
}

function buildConsecutiveCompletions(habitId: string, endDateIso: string, count: number): HabitCompletion[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `c_${i}`,
    userId: 'u1',
    habitId,
    date: addDays(endDateIso, -i),
    completed: true,
  }));
}

describe('Event-Driven Proactive Nudge Collectors (Phase F2)', () => {
  it('does NOT trigger envelope alert at 79% spend, and DOES trigger at 80% with exact daily safe-spend', () => {
    const todayIso = '2026-11-21'; // 10 days remaining in November (21..30)
    const cat = makeCategory(10000);

    const under = collectEnvelope80PctAlerts({
      todayIso,
      categories: [cat],
      transactions: [makeExpense(7900, '2026-11-15')],
    });
    expect(under).toHaveLength(0);

    const at80 = collectEnvelope80PctAlerts({
      todayIso,
      categories: [cat],
      transactions: [makeExpense(8000, '2026-11-15')],
    });
    expect(at80).toHaveLength(1);
    expect(at80[0].kind).toBe('envelope_80_pct');
    expect(at80[0].title).toContain('80%');
    // Remaining ₹2,000 / 10 days = ₹200/day
    expect(at80[0].subtitle).toContain('₹200/day');
  });

  it('triggers 2-min Streak Recovery ONLY on 3 consecutive missed days after a >14-day streak', () => {
    const todayIso = '2026-11-28';
    const habit = makeHabit('h1', 'Read 2 pages');

    // Case A: 15-day streak ending today-4 (2026-11-24), missed 25, 26, 27 -> TRIGGER
    const comps15 = buildConsecutiveCompletions('h1', addDays(todayIso, -4), 15);
    const triggered = collectStreakRecoveryAlerts({ todayIso, habits: [habit], completions: comps15 });
    expect(triggered).toHaveLength(1);
    expect(triggered[0].kind).toBe('streak_recovery');
    expect(triggered[0].subtitle).toContain('15-day streak');
    expect(triggered[0].subtitle).toContain('Read 2 pages');

    // Case B: Only 10-day streak -> NO TRIGGER
    const comps10 = buildConsecutiveCompletions('h1', addDays(todayIso, -4), 10);
    expect(collectStreakRecoveryAlerts({ todayIso, habits: [habit], completions: comps10 })).toHaveLength(0);

    // Case C: Only 2 missed days (completed today-3) -> NO TRIGGER
    const comps2Missed = buildConsecutiveCompletions('h1', addDays(todayIso, -3), 16);
    expect(collectStreakRecoveryAlerts({ todayIso, habits: [habit], completions: comps2Missed })).toHaveLength(0);
  });
});
