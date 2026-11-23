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
      toArray: vi.fn().mockResolvedValue([]),
    },
    habits: {
      toArray: vi.fn().mockResolvedValue([]),
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

  describe('evaluateNoSpendDayRules', () => {
    const noSpendHabit = {
      id: 'habit-nospend-1',
      userId: 'test-user',
      name: 'No-Spend Day',
      category: 'finance' as const,
      targetDaysPerWeek: 7,
      autoTrackRule: 'no_spend_day' as const,
      createdAt: '2026-11-01',
      archived: false,
      order: 1,
    };

    it('auto-completes past days with ₹0 spend but does NOT auto-complete today mid-day', async () => {
      const { useFinanceStore } = await import('../finance-store');
      const { getLocalIsoDate } = await import('@/lib/finance/credit-card-cycles');

      const todayStr = getLocalIsoDate();
      const pastDate = '2026-11-10'; // Clearly in the past

      useHabitStore.setState({
        habits: [noSpendHabit],
        completions: [],
      });
      useFinanceStore.setState({
        transactions: [],
        categories: [],
      });

      vi.mocked(toggleCompletion).mockImplementation(async (habitId, date, userId) => ({
        id: `comp-${date}`,
        userId,
        habitId,
        date,
        completed: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      // Evaluate past date: should auto-complete
      await CrossDomainActionMediator.evaluateNoSpendDayRules(pastDate);
      expect(useHabitStore.getState().completions.some((c) => c.date === pastDate && c.completed)).toBe(true);

      // Evaluate today: should NOT auto-complete mid-day even with 0 spend
      await CrossDomainActionMediator.evaluateNoSpendDayRules(todayStr);
      expect(useHabitStore.getState().completions.some((c) => c.date === todayStr)).toBe(false);
    });

    it('reverses completion if discretionary spend is logged on a past day', async () => {
      const { useFinanceStore } = await import('../finance-store');
      const pastDate = '2026-11-12';

      useHabitStore.setState({
        habits: [noSpendHabit],
        completions: [
          {
            id: 'comp-12',
            userId: 'test-user',
            habitId: noSpendHabit.id,
            date: pastDate,
            completed: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      // Discretionary spend added for pastDate
      useFinanceStore.setState({
        transactions: [
          {
            id: 'tx-1',
            userId: 'test-user',
            title: 'Dinner out',
            amount: 450,
            type: 'expense',
            categoryId: 'cat-dining',
            accountId: 'acc-1',
            date: pastDate,
            monthKey: '2026-11',
            tags: [],
            isRecurring: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        categories: [
          {
            id: 'cat-dining',
            userId: 'test-user',
            name: 'Dining',
            slug: 'food-dining',
            type: 'expense',
            color: '#f97316',
            icon: 'Utensils',
            monthlyBudgetLimit: 0,
            subcategories: [],
            isSystem: false,
            archived: false,
            order: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      vi.mocked(toggleCompletion).mockResolvedValue({
        id: 'comp-12',
        userId: 'test-user',
        habitId: noSpendHabit.id,
        date: pastDate,
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await CrossDomainActionMediator.evaluateNoSpendDayRules(pastDate);
      expect(useHabitStore.getState().completions.some((c) => c.date === pastDate && c.completed)).toBe(false);
    });

    it('does not break no-spend day for essential expenses like groceries-household or utilities-bills', async () => {
      const { useFinanceStore } = await import('../finance-store');
      const pastDate = '2026-11-15';

      useHabitStore.setState({
        habits: [noSpendHabit],
        completions: [],
      });

      // Essential grocery spend added for pastDate
      useFinanceStore.setState({
        transactions: [
          {
            id: 'tx-essential',
            userId: 'test-user',
            title: 'Weekly Groceries',
            amount: 1500,
            type: 'expense',
            categoryId: 'cat-groceries',
            accountId: 'acc-1',
            date: pastDate,
            monthKey: '2026-11',
            tags: [],
            isRecurring: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        categories: [
          {
            id: 'cat-groceries',
            userId: 'test-user',
            name: 'Groceries',
            slug: 'groceries-household',
            type: 'expense',
            color: '#10b981',
            icon: 'ShoppingBasket',
            monthlyBudgetLimit: 0,
            subcategories: [],
            isSystem: true,
            archived: false,
            order: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      vi.mocked(toggleCompletion).mockImplementation(async (habitId, date, userId) => ({
        id: `comp-${date}`,
        userId,
        habitId,
        date,
        completed: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      await CrossDomainActionMediator.evaluateNoSpendDayRules(pastDate);
      // Essential spend should NOT count as discretionary spend, so past day auto-completes
      expect(useHabitStore.getState().completions.some((c) => c.date === pastDate && c.completed)).toBe(true);
    });
  });
});
