import { useHabitStore } from '../habit-store';
import type { FinanceCategory, FinanceTransaction, Habit } from '../../types';
import { hydrateHabitsFromDexieIfEmpty, type MediatorAction } from './habit-dispatch';

const ESSENTIAL_CATEGORIES = new Set([
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

type DispatchFn = (action: MediatorAction) => Promise<void>;

function buildDateWindow(
  targetDate: string | undefined,
  getLocalIsoDate: (d?: Date) => string
): string[] {
  if (targetDate) return [targetDate.slice(0, 10)];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return getLocalIsoDate(d);
  });
}

function isLinkedObligation(tx: FinanceTransaction): boolean {
  return Boolean(
    tx.linkedEmiId ||
      tx.linkedCommitmentId ||
      tx.linkedSipId ||
      tx.paidStatementId ||
      tx.linkedDebtId
  );
}

function computeDiscretionarySpend(
  transactions: FinanceTransaction[],
  categoryMap: Map<string, FinanceCategory>,
  date: string
): number {
  return transactions
    .filter((t) => t.date.slice(0, 10) === date && t.type === 'expense')
    .reduce((sum, tx) => {
      if (isLinkedObligation(tx)) return sum;
      const cat = categoryMap.get(tx.categoryId);
      const slug = cat?.slug || cat?.id || '';
      return ESSENTIAL_CATEGORIES.has(slug) ? sum : sum + tx.amount;
    }, 0);
}

function resolveNoSpendAction(params: {
  isPastDay: boolean;
  isToday: boolean;
  discretionarySpend: number;
  isDone: boolean;
}): 'HABIT_COMPLETED' | 'HABIT_UNCOMPLETED' | null {
  if (params.isPastDay && params.discretionarySpend === 0 && !params.isDone) {
    return 'HABIT_COMPLETED';
  }
  if ((params.isPastDay || params.isToday) && params.discretionarySpend > 0 && params.isDone) {
    return 'HABIT_UNCOMPLETED';
  }
  return null;
}

async function syncNoSpendHabitForDate(params: {
  habit: Habit;
  date: string;
  todayStr: string;
  discretionarySpend: number;
  dispatch: DispatchFn;
}): Promise<void> {
  const { habit, date, todayStr, discretionarySpend, dispatch } = params;
  const isDone = useHabitStore
    .getState()
    .completions.some((c) => c.habitId === habit.id && c.date === date && c.completed);

  const actionType = resolveNoSpendAction({
    isPastDay: date < todayStr,
    isToday: date === todayStr,
    discretionarySpend,
    isDone,
  });
  if (!actionType) return;

  await dispatch({
    type: actionType,
    payload: {
      habitId: habit.id,
      date,
      difficulty: habit.difficulty || 'medium',
      category: 'finance',
    },
  });
}

export async function evaluateNoSpendDayRulesImpl(
  dispatch: DispatchFn,
  targetDate?: string
): Promise<void> {
  const { useFinanceStore } = await import('../finance-store');
  const { getLocalIsoDate } = await import('@/lib/finance/credit-card-cycles');

  await hydrateHabitsFromDexieIfEmpty();

  const noSpendHabits = useHabitStore
    .getState()
    .habits.filter((h) => !h.archived && h.autoTrackRule === 'no_spend_day');
  if (noSpendHabits.length === 0) return;

  const todayStr = getLocalIsoDate();
  const datesToEvaluate = buildDateWindow(targetDate, getLocalIsoDate);
  const financeStore = useFinanceStore.getState();
  const transactions = financeStore.transactions.filter((t) => !t.deletedAt);
  const categoryMap = new Map(financeStore.categories.map((c) => [c.id, c]));

  for (const rawDate of datesToEvaluate) {
    const date = rawDate.slice(0, 10);
    const discretionarySpend = computeDiscretionarySpend(transactions, categoryMap, date);
    for (const habit of noSpendHabits) {
      await syncNoSpendHabitForDate({ habit, date, todayStr, discretionarySpend, dispatch });
    }
  }
}
