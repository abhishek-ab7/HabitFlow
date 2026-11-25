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
    fitnessDailyLogs: {
      filter: vi.fn(() => ({ first: vi.fn().mockResolvedValue(undefined) })),
    },
    mealLogs: {
      toArray: vi.fn().mockResolvedValue([]),
      filter: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) })),
    },
    supplementInventory: {
      toArray: vi.fn().mockResolvedValue([]),
    },
    supplementLogs: {
      toArray: vi.fn().mockResolvedValue([]),
    },
    financeCategories: {
      toArray: vi.fn().mockResolvedValue([]),
    },
    financeTransactions: {
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

  describe('onFitnessEvent & evaluateZeroJunkRules', () => {
    it('WORKOUT_LOGGED completes workout habits without false-positively completing Morning Meditation (category=health)', async () => {
      useHabitStore.setState({
        habits: [
          {
            id: 'h_meditation',
            userId: 'test-user',
            name: 'Morning Meditation',
            category: 'health',
            targetDaysPerWeek: 7,
            archived: false,
            order: 0,
            polarity: 'build',
            createdAt: '2026-11-01',
          },
          {
            id: 'h_workout_rule',
            userId: 'test-user',
            name: 'Daily Lift',
            category: 'health',
            targetDaysPerWeek: 5,
            autoTrackRule: 'workout_logged',
            archived: false,
            order: 1,
            polarity: 'build',
            createdAt: '2026-11-01',
          },
          {
            id: 'h_quit',
            userId: 'test-user',
            name: 'No Gym Skip',
            category: 'health',
            targetDaysPerWeek: 7,
            archived: false,
            order: 2,
            polarity: 'quit',
            createdAt: '2026-11-01',
          },
        ],
        completions: [],
      });

      vi.mocked(toggleCompletion).mockImplementation(async (habitId, date, userId) => ({
        id: `comp-${habitId}-${date}`,
        userId,
        habitId,
        date,
        completed: true,
        status: 'completed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      await CrossDomainActionMediator.onFitnessEvent({
        type: 'WORKOUT_LOGGED',
        date: '2026-11-24',
        workoutType: 'push',
        durationMinutes: 45,
      });

      const completedIds = useHabitStore
        .getState()
        .completions.filter((c) => c.completed)
        .map((c) => c.habitId);

      expect(completedIds).toContain('h_workout_rule');
      expect(completedIds).not.toContain('h_meditation');
      expect(completedIds).not.toContain('h_quit');
    });

    it('reverses zero_junk_today habit immediately when any Junk Food meal or Junk Food expense is logged', async () => {
      const { useFitnessStore } = await import('../fitness');
      const { useFinanceStore } = await import('../finance-store');
      const { getLocalIsoDate } = await import('@/lib/finance/credit-card-cycles');
      const todayStr = getLocalIsoDate();

      const zeroJunkHabit = {
        id: 'h_zero_junk',
        userId: 'test-user',
        name: 'No Junk Food',
        category: 'health' as const,
        targetDaysPerWeek: 7,
        autoTrackRule: 'zero_junk_today' as const,
        polarity: 'quit' as const,
        archived: false,
        order: 0,
        createdAt: '2026-11-01',
      };

      // Case A: Junk meal logged
      useHabitStore.setState({
        habits: [zeroJunkHabit],
        completions: [
          {
            id: 'c_zj_1',
            userId: 'test-user',
            habitId: 'h_zero_junk',
            date: todayStr,
            completed: true,
            status: 'completed',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      useFitnessStore.setState({
        dailyLogs: [],
        mealLogs: [
          {
            id: 'm_junk_1',
            userId: 'test-user',
            date: todayStr,
            mealType: 'snack',
            name: 'Pizza',
            calories: 550,
            proteinG: 20,
            carbsG: 60,
            fatG: 24,
            quantityMultiplier: 1,
            isJunk: true,
            source: 'manual',
            loggedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });
      useFinanceStore.setState({ categories: [], transactions: [] });

      vi.mocked(toggleCompletion).mockResolvedValue({
        id: 'c_zj_1',
        userId: 'test-user',
        habitId: 'h_zero_junk',
        date: todayStr,
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await CrossDomainActionMediator.onFitnessEvent({
        type: 'MEAL_LOGGED',
        date: todayStr,
        isJunk: true,
      });

      expect(
        useHabitStore
          .getState()
          .completions.some((c) => c.habitId === 'h_zero_junk' && c.completed)
      ).toBe(false);

      // Case B: Junk Food expense logged (even without meal log)
      useFitnessStore.setState({ dailyLogs: [], mealLogs: [] });
      useHabitStore.setState({
        habits: [zeroJunkHabit],
        completions: [
          {
            id: 'c_zj_2',
            userId: 'test-user',
            habitId: 'h_zero_junk',
            date: todayStr,
            completed: true,
            status: 'completed',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const junkCategory = {
        id: 'cat_junk',
        userId: 'test-user',
        name: 'Junk Food',
        slug: 'junk-food',
        type: 'expense' as const,
        icon: 'pizza',
        color: '#ef4444',
        monthlyBudgetLimit: 1000,
        subcategories: [],
        isSystem: true,
        archived: false,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const junkTx = {
        id: 'tx_junk_1',
        userId: 'test-user',
        title: 'Momos',
        amount: 60,
        type: 'expense' as const,
        categoryId: 'cat_junk',
        accountId: 'acc_1',
        date: todayStr,
        monthKey: todayStr.slice(0, 7),
        tags: [],
        isRecurring: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      useFinanceStore.setState({
        categories: [junkCategory],
        transactions: [junkTx],
      });

      await CrossDomainActionMediator.onFinanceEvent({
        type: 'EXPENSE_LOGGED',
        date: todayStr,
        amount: 60,
        transaction: junkTx,
        category: junkCategory,
        skipAutoDietBridge: true,
      });

      expect(
        useHabitStore
          .getState()
          .completions.some((c) => c.habitId === 'h_zero_junk' && c.completed)
      ).toBe(false);
    });

    it('honors lowEnergyMode steps target when evaluating STEPS_UPDATED', async () => {
      const { useFitnessStore } = await import('../fitness');
      useFitnessStore.setState({
        profile: {
          id: 'prof_1',
          userId: 'test-user',
          calorieTarget: 2000,
          proteinTargetG: 130,
          waterTargetMl: 3000,
          stepsTarget: 8000,
          sleepTargetHours: 7.5,
          lowEnergyStepsTarget: 3500,
          activityLevel: 'moderate',
          goalType: 'fat_loss',
          dietPreference: 'non_veg',
          createdAt: '2026-11-01',
          updatedAt: '2026-11-01',
        },
        dailyLogs: [
          {
            id: 'dl_le',
            userId: 'test-user',
            date: '2026-11-24',
            waterMl: 0,
            steps: 3600,
            lowEnergyMode: true,
            createdAt: '2026-11-24',
            updatedAt: '2026-11-24',
          },
        ],
      });

      useHabitStore.setState({
        habits: [
          {
            id: 'h_steps',
            userId: 'test-user',
            name: 'Daily Steps',
            category: 'health',
            targetDaysPerWeek: 7,
            autoTrackRule: 'steps_target',
            archived: false,
            order: 0,
            createdAt: '2026-11-01',
          },
        ],
        completions: [],
      });

      vi.mocked(toggleCompletion).mockResolvedValue({
        id: 'c_steps',
        userId: 'test-user',
        habitId: 'h_steps',
        date: '2026-11-24',
        completed: true,
        status: 'completed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await CrossDomainActionMediator.onFitnessEvent({
        type: 'STEPS_UPDATED',
        date: '2026-11-24',
        steps: 3600,
      });

      expect(
        useHabitStore
          .getState()
          .completions.some((c) => c.habitId === 'h_steps' && c.completed)
      ).toBe(true);
    });

    it('never auto-completes Quit habits in finance category when EXPENSE_LOGGED fires', async () => {
      const { useFinanceStore } = await import('../finance-store');
      const shoppingCategory = {
        id: 'cat_shop',
        userId: 'test-user',
        name: 'Shopping',
        slug: 'shopping-personal-care',
        type: 'expense' as const,
        icon: 'ShoppingBag',
        color: '#a855f7',
        monthlyBudgetLimit: 0,
        subcategories: [],
        order: 5,
        isSystem: true,
        archived: false,
        createdAt: '2026-11-01',
        updatedAt: '2026-11-01',
      };
      useFinanceStore.setState({
        categories: [shoppingCategory],
        transactions: [],
      });

      useHabitStore.setState({
        habits: [
          {
            id: 'h_quit_impulse',
            userId: 'test-user',
            name: 'No Impulse Expense',
            category: 'finance',
            polarity: 'quit',
            targetDaysPerWeek: 7,
            archived: false,
            order: 0,
            createdAt: '2026-11-01',
          },
          {
            id: 'h_build_log_spend',
            userId: 'test-user',
            name: 'Track Daily Finance',
            category: 'finance',
            polarity: 'build',
            targetDaysPerWeek: 7,
            archived: false,
            order: 1,
            createdAt: '2026-11-01',
          },
        ],
        completions: [],
      });

      vi.mocked(toggleCompletion).mockResolvedValue({
        id: 'c_build_fin',
        userId: 'test-user',
        habitId: 'h_build_log_spend',
        date: '2026-11-24',
        completed: true,
        status: 'completed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await CrossDomainActionMediator.onFinanceEvent({
        type: 'EXPENSE_LOGGED',
        date: '2026-11-24',
        amount: 500,
        category: shoppingCategory,
      });

      const completions = useHabitStore.getState().completions;
      expect(completions.some((c) => c.habitId === 'h_quit_impulse')).toBe(false);
      expect(completions.some((c) => c.habitId === 'h_build_log_spend' && c.completed)).toBe(true);
    });
  });
});
