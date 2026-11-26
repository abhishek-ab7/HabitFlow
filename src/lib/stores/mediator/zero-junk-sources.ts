import type { FinanceCategory, FinanceTransaction, MealLog } from '../../types';

export type IsoDate = string;

function isJunkMealOnDate(meal: MealLog, date: IsoDate): boolean {
  if (meal.deletedAt) return false;
  if (!meal.isJunk) return false;
  return meal.date.slice(0, 10) === date;
}

function findOverrideInLogs(
  logs: Array<{ deletedAt?: string | null; date: string; junkFreeOverride?: boolean }>,
  date: IsoDate
): boolean {
  return logs.some((d) => !d.deletedAt && d.date.slice(0, 10) === date && Boolean(d.junkFreeOverride));
}

async function hasJunkFreeOverride(date: IsoDate): Promise<boolean> {
  const { db } = await import('../../db');
  const { useFitnessStore } = await import('../fitness');
  const fitState = useFitnessStore.getState();

  if (findOverrideInLogs(fitState.dailyLogs, date)) return true;
  if (!db?.fitnessDailyLogs) return false;

  const dbLog = await db.fitnessDailyLogs
    .filter((d) => !d.deletedAt && d.date.slice(0, 10) === date)
    .first();
  return Boolean(dbLog?.junkFreeOverride);
}

async function hasJunkMealLogged(date: IsoDate): Promise<boolean> {
  const { db } = await import('../../db');
  const { useFitnessStore } = await import('../fitness');
  const fitState = useFitnessStore.getState();

  if (fitState.mealLogs.some((m) => isJunkMealOnDate(m, date))) return true;
  if (!db?.mealLogs) return false;

  const dbMeals = await db.mealLogs.filter((m) => isJunkMealOnDate(m, date)).toArray();
  return dbMeals.length > 0;
}

export async function checkFitnessJunkStatus(date: IsoDate): Promise<{
  junkFreeOverride: boolean;
  hasJunkMeal: boolean;
}> {
  try {
    const [junkFreeOverride, hasJunkMeal] = await Promise.all([
      hasJunkFreeOverride(date),
      hasJunkMealLogged(date),
    ]);
    return { junkFreeOverride, hasJunkMeal };
  } catch {
    return { junkFreeOverride: false, hasJunkMeal: false };
  }
}

function isJunkCategory(cat?: FinanceCategory): boolean {
  const slug = (cat?.slug || '').toLowerCase();
  if (slug.includes('junk')) return true;
  const name = (cat?.name || '').toLowerCase();
  return /junk\s*food/.test(name);
}

function isJunkExpenseTx(
  tx: FinanceTransaction,
  date: IsoDate,
  catMap: Map<string, FinanceCategory>
): boolean {
  if (tx.deletedAt) return false;
  if (tx.type !== 'expense') return false;
  if (tx.date.slice(0, 10) !== date) return false;
  return isJunkCategory(catMap.get(tx.categoryId));
}

async function loadFinanceDataForJunkCheck() {
  const { db } = await import('../../db');
  const { useFinanceStore } = await import('../finance-store');
  const finState = useFinanceStore.getState();

  const categories = finState.categories.length
    ? finState.categories
    : await db?.financeCategories?.toArray() ?? [];
  const txs = finState.transactions.length
    ? finState.transactions
    : await db?.financeTransactions?.toArray() ?? [];

  return { categories, txs };
}

export async function checkFinanceJunkExpense(date: IsoDate): Promise<boolean> {
  try {
    const { categories, txs } = await loadFinanceDataForJunkCheck();
    const catMap = new Map(categories.map((c) => [c.id, c]));
    return txs.some((tx) => isJunkExpenseTx(tx, date, catMap));
  } catch {
    return false;
  }
}
