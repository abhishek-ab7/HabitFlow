import { useHabitStore } from './habit-store';
import { useTaskStore } from './task-store';
import { toggleCompletion } from '../db';
import { getSupabaseClient } from '../supabase/client';
import type { Category, FinanceCategory, FinanceTransaction } from '../types';

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
    const targetHabit = habitStore.habits.find((h) => h.id === habitId);

    if (action.type === 'HABIT_COMPLETED') {
      const isAlreadyCompleted = habitStore.completions.some(
        (c) => c.habitId === habitId && c.date === date && c.completed
      );

      if (!isAlreadyCompleted) {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = targetHabit?.userId || session?.user?.id || 'test-user';

        // Toggle in DB to ensure record exists
        const result = await toggleCompletion(habitId, date, userId);

        // Ensure the record is set to completed
        if (!result.completed || result.status !== 'completed') {
          result.completed = true;
          result.status = 'completed';
          result.skipped = false;
          const { db } = await import('../db');
          await db.completions.update(result.id, {
            completed: true,
            status: 'completed',
            skipped: false,
          });
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

        try {
          const { getSyncEngine } = await import('../sync/sync-engine');
          await getSyncEngine().pushCompletion(result);
        } catch {
          // Non-blocking in offline or isolated unit-test environments
        }
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
        const userId = targetHabit?.userId || session?.user?.id || 'test-user';

        // Toggle in DB
        const result = await toggleCompletion(habitId, date, userId);

        // Ensure the record is set to not completed
        if (result.completed || result.status) {
          result.completed = false;
          result.status = undefined;
          result.skipped = false;
          const { db } = await import('../db');
          await db.completions.update(result.id, {
            completed: false,
            status: undefined,
            skipped: false,
          });
        }

        // Remove from store completions state
        useHabitStore.setState({
          completions: habitStore.completions.filter(
            (c) => !(c.habitId === habitId && c.date === date)
          ),
        });

        try {
          const { getSyncEngine } = await import('../sync/sync-engine');
          await getSyncEngine().pushCompletion(result);
        } catch {
          // Non-blocking in offline or isolated unit-test environments
        }
      }
    }
  }

  // Evaluate No-Spend Day rules across target dates or past week
  public static async evaluateNoSpendDayRules(targetDate?: string) {
    const { useFinanceStore } = await import('./finance-store');
    const { getLocalIsoDate } = await import('@/lib/finance/credit-card-cycles');

    // 1. Hydrate habits and completions from Dexie if not yet loaded in useHabitStore
    if (useHabitStore.getState().habits.length === 0) {
      const { db } = await import('../db');
      const [dexieHabits, dexieCompletions] = await Promise.all([
        db.habits.toArray(),
        db.completions.toArray(),
      ]);
      if (dexieHabits.length > 0) {
        useHabitStore.setState({
          habits: dexieHabits,
          completions: dexieCompletions,
        });
      }
    }

    const habitStore = useHabitStore.getState();
    const financeStore = useFinanceStore.getState();

    const noSpendHabits = habitStore.habits.filter(
      (h) => !h.archived && h.autoTrackRule === 'no_spend_day'
    );
    if (noSpendHabits.length === 0) return;

    const todayStr = getLocalIsoDate();
    const datesToEvaluate: string[] = targetDate
      ? [targetDate.slice(0, 10)]
      : Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - i);
          return getLocalIsoDate(d);
        });

    const transactions = financeStore.transactions.filter((t) => !t.deletedAt);
    const categories = financeStore.categories;
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const essentialCategories = new Set([
      'bills_utilities',
      'utilities-bills',
      'rent_housing',
      'rent-housing',
      'education',
      'insurance',
      'healthcare',
      'medical-supplements',
      'groceries_essentials',
      'groceries-household',
      'family-commitments',
      'family_support',
    ]);

    for (const rawDate of datesToEvaluate) {
      const date = rawDate.slice(0, 10);
      const isPastDay = date < todayStr;
      const isToday = date === todayStr;

      const dayExpenses = transactions.filter(
        (t) => t.date.slice(0, 10) === date && t.type === 'expense'
      );

      const discretionarySpend = dayExpenses.reduce((sum, tx) => {
        if (
          tx.linkedEmiId ||
          tx.linkedCommitmentId ||
          tx.linkedSipId ||
          tx.paidStatementId ||
          tx.linkedDebtId
        ) {
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
        // Read fresh completions on each iteration
        const currentCompletions = useHabitStore.getState().completions;
        const isDone = currentCompletions.some(
          (c) => c.habitId === habit.id && c.date === date && c.completed
        );

        if (isPastDay) {
          // Past days: auto-complete if ₹0 discretionary spend; reverse if spent
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
        } else if (isToday) {
          // Today: keep as live tracking badge, do not auto-complete mid-day,
          // but reverse if an expense was logged that breaks the day
          if (discretionarySpend > 0 && isDone) {
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
  }

  // Evaluate Zero-Junk / No-Junk-Food rules for a date (reverses immediately if any Junk Food meal or expense exists)
  public static async evaluateZeroJunkRules(targetDate?: string) {
    const { getLocalIsoDate } = await import('@/lib/finance/credit-card-cycles');
    const { db } = await import('../db');

    if (useHabitStore.getState().habits.length === 0) {
      try {
        const [dexieHabits, dexieCompletions] = await Promise.all([
          db.habits.toArray(),
          db.completions.toArray(),
        ]);
        if (dexieHabits.length > 0) {
          useHabitStore.setState({
            habits: dexieHabits,
            completions: dexieCompletions,
          });
        }
      } catch {
        // Ignore if mocked db lacks tables
      }
    }

    const habitStore = useHabitStore.getState();
    const zeroJunkHabits = habitStore.habits.filter(
      (h) =>
        !h.archived &&
        (h.autoTrackRule === 'zero_junk_today' || h.autoTrackRule === 'no_junk_food')
    );
    if (zeroJunkHabits.length === 0) return;

    const todayStr = getLocalIsoDate();
    const datesToEvaluate = targetDate ? [targetDate.slice(0, 10)] : [todayStr];

    for (const date of datesToEvaluate) {
      let junkFreeOverride = false;
      let hasJunkMeal = false;
      let hasJunkExpense = false;

      try {
        const { useFitnessStore } = await import('./fitness');
        const fitState = useFitnessStore.getState();
        const storeLog = fitState.dailyLogs.find(
          (d) => !d.deletedAt && d.date.slice(0, 10) === date
        );
        if (storeLog?.junkFreeOverride) {
          junkFreeOverride = true;
        } else if (db?.fitnessDailyLogs) {
          const dbLog = await db.fitnessDailyLogs
            .filter((d) => !d.deletedAt && d.date.slice(0, 10) === date)
            .first();
          if (dbLog?.junkFreeOverride) junkFreeOverride = true;
        }

        if (
          fitState.mealLogs.some(
            (m) => !m.deletedAt && m.date.slice(0, 10) === date && m.isJunk
          )
        ) {
          hasJunkMeal = true;
        } else if (db?.mealLogs) {
          const dbMeals = await db.mealLogs
            .filter((m) => !m.deletedAt && m.date.slice(0, 10) === date && Boolean(m.isJunk))
            .toArray();
          if (dbMeals.length > 0) hasJunkMeal = true;
        }
      } catch {
        // Fitness store optional in isolated tests
      }

      try {
        const { useFinanceStore } = await import('./finance-store');
        const finState = useFinanceStore.getState();
        const categories =
          finState.categories.length > 0
            ? finState.categories
            : db?.financeCategories
              ? await db.financeCategories.toArray()
              : [];
        const catMap = new Map(categories.map((c) => [c.id, c]));

        const txs =
          finState.transactions.length > 0
            ? finState.transactions
            : db?.financeTransactions
              ? await db.financeTransactions.toArray()
              : [];

        hasJunkExpense = txs.some((tx) => {
          if (tx.deletedAt || tx.type !== 'expense' || tx.date.slice(0, 10) !== date) {
            return false;
          }
          const cat = catMap.get(tx.categoryId);
          const slug = (cat?.slug || '').toLowerCase();
          const name = (cat?.name || '').toLowerCase();
          return slug.includes('junk') || /junk\s*food/.test(name);
        });
      } catch {
        // Finance store optional in isolated tests
      }

      const hasJunkToday = !junkFreeOverride && (hasJunkMeal || hasJunkExpense);
      const isPastDay = date < todayStr;

      for (const habit of zeroJunkHabits) {
        const currentCompletions = useHabitStore.getState().completions;
        const isDone = currentCompletions.some(
          (c) =>
            c.habitId === habit.id &&
            c.date === date &&
            c.completed &&
            c.status !== 'frozen' &&
            c.status !== 'rest' &&
            !c.skipped
        );

        if (hasJunkToday && isDone) {
          await CrossDomainActionMediator.dispatch({
            type: 'HABIT_UNCOMPLETED',
            payload: {
              habitId: habit.id,
              date,
              difficulty: habit.difficulty || 'medium',
              category: habit.category || 'health',
            },
          });
        } else if (isPastDay && !hasJunkToday && !isDone) {
          await CrossDomainActionMediator.dispatch({
            type: 'HABIT_COMPLETED',
            payload: {
              habitId: habit.id,
              date,
              difficulty: habit.difficulty || 'medium',
              category: habit.category || 'health',
            },
          });
        }
      }
    }
  }

  // Handle FlowFinance events: auto-complete matching money/finance habits & auto-bridge Junk Food -> Diet
  public static async onFinanceEvent(event: {
    type:
      | 'EXPENSE_LOGGED'
      | 'NO_SPEND_DAY'
      | 'EMI_PAID'
      | 'COMMITMENT_SETTLED'
      | 'SIP_COMPLETED';
    date: string;
    amount?: number;
    transaction?: FinanceTransaction;
    category?: FinanceCategory;
    skipAutoDietBridge?: boolean;
  }) {
    // 0. Decision 4 (Fully Automatic Junk Food -> Diet Log Bridge with linkedTransactionId deduplication)
    if (
      event.type === 'EXPENSE_LOGGED' &&
      !event.skipAutoDietBridge &&
      event.transaction?.type === 'expense'
    ) {
      const catSlug = (event.category?.slug || '').toLowerCase();
      const catName = (event.category?.name || '').toLowerCase();
      const isJunkFood = catSlug.includes('junk') || /junk\s*food/.test(catName);
      if (isJunkFood) {
        try {
          const { useGamificationStore } = await import('./gamification-store');
          const { isFitnessModuleEnabled } = await import('../workspace-modules');
          if (!isFitnessModuleEnabled(useGamificationStore.getState().settings)) {
            // Fitness module disabled by user — skip automatic Diet logging
          } else {
            const { useFitnessStore } = await import('./fitness');
            await useFitnessStore.getState().ensureMealForJunkTransaction({
              transactionId: event.transaction.id,
              userId: event.transaction.userId,
              date: event.transaction.date || event.date,
              title: event.transaction.title,
              amountInr: event.transaction.amount,
              notes: event.transaction.notes,
            });
          }
        } catch {
          // Non-blocking bridge if fitness store unavailable in isolated tests
        }
      }
    }

    // 1. Evaluate No-Spend Day rules & Zero-Junk anti-habit rules dynamically
    await CrossDomainActionMediator.evaluateNoSpendDayRules(event.date);
    await CrossDomainActionMediator.evaluateZeroJunkRules(event.date);

    const habitStore = useHabitStore.getState();

    // Auto-complete matching daily expense/finance tracking habits for the date
    const activeHabits = habitStore.habits.filter((h) => !h.archived);

    for (const habit of activeHabits) {
      const rule = habit.autoTrackRule;
      if (habit.polarity === 'quit' && rule !== 'no_spend_day') {
        continue;
      }
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

  // Handle Fitness events: auto-complete matching workout, steps, sleep, protein, supplements & zero-junk habits
  public static async onFitnessEvent(event: {
    type:
      | 'WORKOUT_LOGGED'
      | 'STEPS_UPDATED'
      | 'BIO_LOGGED'
      | 'MEAL_LOGGED'
      | 'SUPPLEMENTS_TAKEN';
    date: string;
    workoutType?: string;
    durationMinutes?: number;
    steps?: number;
    sleepHours?: number | null;
    isJunk?: boolean;
  }) {
    const normalizedDate = event.date.slice(0, 10);

    try {
      const { useGamificationStore } = await import('./gamification-store');
      const { isFitnessModuleEnabled } = await import('../workspace-modules');
      if (!isFitnessModuleEnabled(useGamificationStore.getState().settings)) {
        return;
      }
    } catch {
      // ignore if gamification store unavailable in isolated tests
    }

    if (useHabitStore.getState().habits.length === 0) {
      try {
        const { db } = await import('../db');
        const [dexieHabits, dexieCompletions] = await Promise.all([
          db.habits.toArray(),
          db.completions.toArray(),
        ]);
        if (dexieHabits.length > 0) {
          useHabitStore.setState({
            habits: dexieHabits,
            completions: dexieCompletions,
          });
        }
      } catch {
        // Ignore if Dexie unavailable
      }
    }

    if (event.type === 'MEAL_LOGGED' || event.type === 'BIO_LOGGED') {
      await CrossDomainActionMediator.evaluateZeroJunkRules(normalizedDate);
    }

    let profileProteinTarget = 130;
    let effectiveStepsTarget = 8000;
    let proteinTodayG = 0;
    let allSupplementsTakenToday = false;

    try {
      const { useFitnessStore } = await import('./fitness');
      const { db } = await import('../db');
      const fitState = useFitnessStore.getState();

      if (fitState.profile?.proteinTargetG) {
        profileProteinTarget = fitState.profile.proteinTargetG;
      }

      const dayLog = fitState.dailyLogs.find(
        (d) => !d.deletedAt && d.date.slice(0, 10) === normalizedDate
      );
      effectiveStepsTarget = dayLog?.lowEnergyMode
        ? Math.max(500, Number(fitState.profile?.lowEnergyStepsTarget ?? 3500))
        : Math.max(500, Number(fitState.profile?.stepsTarget ?? 8000));

      if (event.type === 'MEAL_LOGGED') {
        const meals =
          fitState.mealLogs.length > 0
            ? fitState.mealLogs
            : db?.mealLogs
              ? await db.mealLogs.toArray()
              : [];
        proteinTodayG = meals
          .filter((m) => !m.deletedAt && m.date.slice(0, 10) === normalizedDate)
          .reduce((sum, m) => sum + Math.max(0, Number(m.proteinG || 0)), 0);
      }

      if (event.type === 'SUPPLEMENTS_TAKEN') {
        const activeSupps = (
          fitState.supplementInventory.length > 0
            ? fitState.supplementInventory
            : db?.supplementInventory
              ? await db.supplementInventory.toArray()
              : []
        ).filter((s) => !s.deletedAt && s.isActive);

        const logsToday = (
          fitState.supplementLogs.length > 0
            ? fitState.supplementLogs
            : db?.supplementLogs
              ? await db.supplementLogs.toArray()
              : []
        ).filter((l) => !l.deletedAt && l.date.slice(0, 10) === normalizedDate);

        allSupplementsTakenToday =
          activeSupps.length > 0
            ? activeSupps.every((s) => logsToday.some((l) => l.supplementId === s.id))
            : logsToday.length > 0;
      }
    } catch {
      // Optional in isolated unit tests
    }

    const habitStore = useHabitStore.getState();
    const activeHabits = habitStore.habits.filter(
      (h) => !h.archived && h.polarity !== 'quit'
    );

    for (const habit of activeHabits) {
      const rule = habit.autoTrackRule;
      let shouldComplete = false;
      let shouldUncomplete = false;

      if (event.type === 'WORKOUT_LOGGED') {
        if (rule === 'workout_logged') {
          shouldComplete = true;
        } else if (
          (!rule || rule === 'none') &&
          /\b(workout|exercise|gym|training|lift|cardio|run|running|jog|cycling|swim|morning walk)\b/i.test(
            habit.name
          )
        ) {
          shouldComplete = true;
        }
      } else if (event.type === 'STEPS_UPDATED') {
        const target =
          habit.targetValue && habit.targetValue > 0
            ? Math.min(habit.targetValue, effectiveStepsTarget)
            : effectiveStepsTarget;
        if (rule === 'steps_target' && (event.steps || 0) >= target) {
          shouldComplete = true;
        }
      } else if (event.type === 'BIO_LOGGED') {
        const target = habit.targetValue || 7;
        if (rule === 'sleep_target' && (event.sleepHours || 0) >= target) {
          shouldComplete = true;
        }
      } else if (event.type === 'MEAL_LOGGED') {
        if (rule === 'protein_target_met' || rule === 'protein_target') {
          const target = habit.targetValue && habit.targetValue > 0 ? habit.targetValue : profileProteinTarget;
          if (proteinTodayG >= target) {
            shouldComplete = true;
          } else {
            shouldUncomplete = true;
          }
        }
      } else if (event.type === 'SUPPLEMENTS_TAKEN') {
        if (rule === 'supplements_taken_today') {
          if (allSupplementsTakenToday) {
            shouldComplete = true;
          } else {
            shouldUncomplete = true;
          }
        }
      }

      if (!shouldComplete && !shouldUncomplete) continue;

      const alreadyDone = useHabitStore
        .getState()
        .completions.some((c) => c.habitId === habit.id && c.date === normalizedDate && c.completed);

      if (shouldComplete && !alreadyDone) {
        await CrossDomainActionMediator.dispatch({
          type: 'HABIT_COMPLETED',
          payload: {
            habitId: habit.id,
            date: normalizedDate,
            difficulty: habit.difficulty || 'medium',
            category: habit.category || 'health',
          },
        });
      } else if (shouldUncomplete && alreadyDone) {
        await CrossDomainActionMediator.dispatch({
          type: 'HABIT_UNCOMPLETED',
          payload: {
            habitId: habit.id,
            date: normalizedDate,
            difficulty: habit.difficulty || 'medium',
            category: habit.category || 'health',
          },
        });
      }
    }
  }
}
