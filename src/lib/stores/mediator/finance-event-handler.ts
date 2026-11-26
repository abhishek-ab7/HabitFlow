import { useHabitStore } from '../habit-store';
import type { FinanceCategory, FinanceTransaction, Habit } from '../../types';
import type { MediatorAction } from './habit-dispatch';

export interface FinanceMediatorEvent {
  type: 'EXPENSE_LOGGED' | 'NO_SPEND_DAY' | 'EMI_PAID' | 'COMMITMENT_SETTLED' | 'SIP_COMPLETED';
  date: string;
  amount?: number;
  transaction?: FinanceTransaction;
  category?: FinanceCategory;
  skipAutoDietBridge?: boolean;
}

type DispatchFn = (action: MediatorAction) => Promise<void>;

function isJunkFoodCategory(category?: FinanceCategory): boolean {
  const catSlug = (category?.slug || '').toLowerCase();
  const catName = (category?.name || '').toLowerCase();
  return catSlug.includes('junk') || /junk\s*food/.test(catName);
}

function shouldBridgeJunkExpense(event: FinanceMediatorEvent): boolean {
  if (event.type !== 'EXPENSE_LOGGED' || event.skipAutoDietBridge) return false;
  if (event.transaction?.type !== 'expense') return false;
  return isJunkFoodCategory(event.category);
}

async function linkOrCreateJunkMeal(
  tx: FinanceTransaction,
  eventDate: string,
  category?: FinanceCategory
): Promise<void> {
  const { useFitnessStore } = await import('../fitness');
  const fitState = useFitnessStore.getState();
  const { findBestTransactionMealMatch } = await import('@/lib/fitness/meal-finance-matcher');
  const activeMeals = fitState.mealLogs.filter((m) => !m.deletedAt);
  const existingCategories = category ? [category] : [];
  const matchedMeal = findBestTransactionMealMatch(tx, activeMeals, existingCategories);

  if (matchedMeal?.confidence === 'high') {
    await fitState.linkMealToTransaction(matchedMeal.meal.id, tx.id);
    return;
  }

  await fitState.ensureMealForJunkTransaction({
    transactionId: tx.id,
    userId: tx.userId,
    date: tx.date || eventDate,
    title: tx.title,
    amountInr: tx.amount,
    notes: tx.notes,
  });
}

async function bridgeJunkExpenseToDiet(event: FinanceMediatorEvent): Promise<void> {
  if (!shouldBridgeJunkExpense(event) || !event.transaction) return;

  try {
    const { useGamificationStore } = await import('../gamification-store');
    const { isFitnessModuleEnabled } = await import('../../workspace-modules');
    if (!isFitnessModuleEnabled(useGamificationStore.getState().settings)) return;

    await linkOrCreateJunkMeal(event.transaction, event.date, event.category);
  } catch {
    // Non-blocking bridge if fitness store unavailable in isolated tests
  }
}

const FINANCE_RULE_EVENT_MAP: Record<string, FinanceMediatorEvent['type']> = {
  log_expense_today: 'EXPENSE_LOGGED',
  under_daily_safe_spend: 'EXPENSE_LOGGED',
  sip_completed_month: 'SIP_COMPLETED',
  no_spend_day: 'NO_SPEND_DAY',
};

function matchesFinanceHabit(habit: Habit, eventType: FinanceMediatorEvent['type']): boolean {
  const rule = habit.autoTrackRule;
  if (habit.polarity === 'quit' && rule !== 'no_spend_day') return false;
  if (rule) return FINANCE_RULE_EVENT_MAP[rule] === eventType;

  if (eventType === 'EXPENSE_LOGGED') {
    return (
      habit.category === 'finance' ||
      /expense|budget|spend|finance|money|track/i.test(habit.name)
    );
  }
  if (eventType === 'SIP_COMPLETED') {
    return /sip|invest|wealth|mutual fund/i.test(habit.name);
  }
  return false;
}

export async function handleFinanceEventImpl(
  event: FinanceMediatorEvent,
  deps: {
    dispatch: DispatchFn;
    evaluateNoSpend: (date?: string) => Promise<void>;
    evaluateZeroJunk: (date?: string) => Promise<void>;
  }
): Promise<void> {
  await bridgeJunkExpenseToDiet(event);
  await deps.evaluateNoSpend(event.date);
  await deps.evaluateZeroJunk(event.date);

  const habitStore = useHabitStore.getState();
  const activeHabits = habitStore.habits.filter((h) => !h.archived);

  for (const habit of activeHabits) {
    if (!matchesFinanceHabit(habit, event.type)) continue;

    const alreadyDone = habitStore.completions.some(
      (c) => c.habitId === habit.id && c.date === event.date && c.completed
    );
    if (alreadyDone) continue;

    await deps.dispatch({
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
