import { useHabitStore } from './habit-store';
import { useTaskStore } from './task-store';
import { toggleCompletion } from '../db';
import { getSupabaseClient } from '../supabase/client';
import type { Category } from '../types';

export type MediatorAction =
  | {
      type: 'HABIT_COMPLETED';
      payload: {
        habitId: string;
        date: string;
        difficulty?: 'easy' | 'medium' | 'hard';
        category?: Category;
      };
    }
  | {
      type: 'HABIT_UNCOMPLETED';
      payload: {
        habitId: string;
        date: string;
        difficulty?: 'easy' | 'medium' | 'hard';
        category?: Category;
      };
    };

export class CrossDomainActionMediator {
  // Toggle habit completion via habit store
  public static async toggleHabitCompletion(habitId: string, date: string) {
    const habitStore = useHabitStore.getState();
    await habitStore.toggle(habitId, date);
  }

  // Toggle task completion via task store
  public static async toggleTaskCompletion(taskId: string) {
    const taskStore = useTaskStore.getState();
    await taskStore.toggleTaskComplete(taskId);
  }

  // Orchestrate multi-store updates for custom actions
  public static async dispatch(action: MediatorAction) {
    const habitStore = useHabitStore.getState();
    const { habitId, date } = action.payload;

    if (action.type === 'HABIT_COMPLETED') {
      const isAlreadyCompleted = habitStore.completions.some(
        (c) => c.habitId === habitId && c.date === date && c.completed
      );

      if (!isAlreadyCompleted) {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user?.id || 'test-user';

        // Toggle in DB to ensure record exists
        const result = await toggleCompletion(habitId, date, userId);

        // Ensure the record is set to completed
        if (!result.completed) {
          result.completed = true;
          const { db } = await import('../db');
          await db.completions.update(result.id, { completed: true });
        }

        // Add to store completions state
        useHabitStore.setState({
          completions: [
            ...habitStore.completions.filter(
              (c) => !(c.habitId === habitId && c.date === date)
            ),
            result,
          ],
        });
      }
    } else if (action.type === 'HABIT_UNCOMPLETED') {
      const existingIndex = habitStore.completions.findIndex(
        (c) => c.habitId === habitId && c.date === date && c.completed
      );

      if (existingIndex !== -1) {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user?.id || 'test-user';

        // Toggle in DB
        const result = await toggleCompletion(habitId, date, userId);

        // Ensure the record is set to not completed
        if (result.completed) {
          result.completed = false;
          const { db } = await import('../db');
          await db.completions.update(result.id, { completed: false });
        }

        // Remove from store completions state
        useHabitStore.setState({
          completions: habitStore.completions.filter(
            (c) => !(c.habitId === habitId && c.date === date)
          ),
        });
      }
    }
  }

  // Evaluate No-Spend Day rules across target dates or past week
  public static async evaluateNoSpendDayRules(targetDate?: string) {
    const { useFinanceStore } = await import('./finance-store');
    const habitStore = useHabitStore.getState();
    const financeStore = useFinanceStore.getState();

    const noSpendHabits = habitStore.habits.filter(
      (h) => !h.archived && (h.autoTrackRule === 'no_spend_day' || h.autoTrackRule === ('no_spend' as any))
    );
    if (noSpendHabits.length === 0) return;

    const today = new Date();
    const datesToEvaluate: string[] = targetDate
      ? [targetDate]
      : Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(today.getDate() - i);
          return d.toISOString().split('T')[0];
        });

    const transactions = financeStore.transactions.filter((t) => !t.deletedAt);
    const categories = financeStore.categories;
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const essentialCategories = new Set([
      'bills_utilities',
      'rent_housing',
      'education',
      'insurance',
      'healthcare',
      'groceries_essentials',
    ]);

    for (const date of datesToEvaluate) {
      const dayExpenses = transactions.filter((t) => t.date === date && t.type === 'expense');

      const discretionarySpend = dayExpenses.reduce((sum, tx) => {
        if (tx.linkedEmiId || tx.linkedCommitmentId || tx.linkedSipId || tx.paidStatementId || tx.linkedDebtId) {
          return sum;
        }
        const cat = categoryMap.get(tx.categoryId);
        const slug = cat?.slug || cat?.id || '';
        if (essentialCategories.has(slug)) {
          return sum;
        }
        return sum + tx.amount;
      }, 0);

      for (const habit of noSpendHabits) {
        const isDone = habitStore.completions.some(
          (c) => c.habitId === habit.id && c.date === date && c.completed
        );

        if (discretionarySpend === 0 && !isDone) {
          await CrossDomainActionMediator.dispatch({
            type: 'HABIT_COMPLETED',
            payload: {
              habitId: habit.id,
              date,
              difficulty: habit.difficulty || 'medium',
              category: 'finance',
            },
          });
        } else if (discretionarySpend > 0 && isDone) {
          await CrossDomainActionMediator.dispatch({
            type: 'HABIT_UNCOMPLETED',
            payload: {
              habitId: habit.id,
              date,
              difficulty: habit.difficulty || 'medium',
              category: 'finance',
            },
          });
        }
      }
    }
  }

  // Handle FlowFinance events: auto-complete matching money/finance habits
  public static async onFinanceEvent(event: {
    type:
      | 'EXPENSE_LOGGED'
      | 'NO_SPEND_DAY'
      | 'EMI_PAID'
      | 'COMMITMENT_SETTLED'
      | 'SIP_COMPLETED';
    date: string;
    amount?: number;
  }) {
    // 1. Evaluate No-Spend Day rules dynamically (auto-tick if 0, auto-reverse if spent)
    await CrossDomainActionMediator.evaluateNoSpendDayRules(event.date);

    const habitStore = useHabitStore.getState();

    // Auto-complete matching daily expense/finance tracking habits for the date
    const activeHabits = habitStore.habits.filter((h) => !h.archived);

    for (const habit of activeHabits) {
      const rule = habit.autoTrackRule;
      let shouldComplete = false;

      if (rule === 'log_expense_today' && event.type === 'EXPENSE_LOGGED') {
        shouldComplete = true;
      } else if (rule === 'sip_completed_month' && event.type === 'SIP_COMPLETED') {
        shouldComplete = true;
      } else if (rule === 'no_spend_day' && event.type === 'NO_SPEND_DAY') {
        shouldComplete = true;
      } else if (rule === 'under_daily_safe_spend' && event.type === 'EXPENSE_LOGGED') {
        shouldComplete = true;
      } else if (
        !rule &&
        event.type === 'EXPENSE_LOGGED' &&
        (habit.category === 'finance' ||
          /expense|budget|spend|finance|money|track/i.test(habit.name))
      ) {
        shouldComplete = true;
      } else if (
        !rule &&
        event.type === 'SIP_COMPLETED' &&
        /sip|invest|wealth|mutual fund/i.test(habit.name)
      ) {
        shouldComplete = true;
      }

      if (!shouldComplete) continue;

      const alreadyDone = habitStore.completions.some(
        (c) => c.habitId === habit.id && c.date === event.date && c.completed
      );
      if (!alreadyDone) {
        await CrossDomainActionMediator.dispatch({
          type: 'HABIT_COMPLETED',
          payload: {
            habitId: habit.id,
            date: event.date,
            difficulty: habit.difficulty || 'easy',
            category: 'finance',
          },
        });
      }
    }
  }
}
