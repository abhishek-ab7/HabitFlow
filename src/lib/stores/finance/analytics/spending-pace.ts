import type { DailyPacePoint, FinanceTransaction } from '@/lib/types';
import { getPreviousMonthKey, type FinanceStore } from '../helpers';

function sumExpensesForDate(txs: FinanceTransaction[], dateStr: string): number {
  return txs.filter((t) => t.date === dateStr).reduce((sum, t) => sum + t.amount, 0);
}

function getMonthPaceMeta(targetMonth: string) {
  const [yStr, mStr] = targetMonth.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const isFutureMonth =
    year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);
  return { daysInMonth, isCurrentMonth, isFutureMonth, todayDay: now.getDate() };
}

function filterMonthExpenses(transactions: FinanceTransaction[], monthKey: string) {
  return transactions.filter(
    (t) => t.monthKey === monthKey && t.type === 'expense' && !t.deletedAt
  );
}

export function computeDailySpendingPace(
  state: FinanceStore,
  monthKey?: string
): DailyPacePoint[] {
  const targetMonth = monthKey || state.selectedMonth;
  const prevMonth = getPreviousMonthKey(targetMonth);
  const meta = getMonthPaceMeta(targetMonth);
  const monthlyBudget = state.getMonthlySummary(targetMonth).monthlyBudget;
  const currentTxs = filterMonthExpenses(state.transactions, targetMonth);
  const prevTxs = filterMonthExpenses(state.transactions, prevMonth);

  const points: DailyPacePoint[] = [];
  let runningCurrent = 0;
  let runningPrev = 0;

  for (let day = 1; day <= meta.daysInMonth; day++) {
    const padded = String(day).padStart(2, '0');
    const dateStr = `${targetMonth}-${padded}`;
    runningCurrent += sumExpensesForDate(currentTxs, dateStr);
    runningPrev += sumExpensesForDate(prevTxs, `${prevMonth}-${padded}`);
    const isFutureDay = meta.isFutureMonth || (meta.isCurrentMonth && day > meta.todayDay);
    const idealCumulativeBudget =
      monthlyBudget > 0 ? Math.round((monthlyBudget / meta.daysInMonth) * day) : 0;

    points.push({
      day,
      dateStr,
      cumulativeSpent: isFutureDay ? null : runningCurrent,
      idealCumulativeBudget,
      lastMonthCumulativeSpent: runningPrev,
    });
  }

  return points;
}
