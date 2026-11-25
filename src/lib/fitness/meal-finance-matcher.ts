import { classifyCategoryBridgeKind } from '@/lib/fitness/finance-bridge';
import type { FinanceCategory, FinanceTransaction, MealLog } from '@/lib/types';

export interface MealFinanceMatchCandidate {
  transaction: FinanceTransaction;
  score: number;
  confidence: 'high' | 'candidate' | 'none';
  reason: string;
}

export interface TransactionMealMatchCandidate {
  meal: MealLog;
  score: number;
  confidence: 'high' | 'candidate' | 'none';
  reason: string;
}

const GENERIC_MEAL_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'food',
  'meal',
  'meals',
  'junk',
  'snack',
  'snacks',
  'breakfast',
  'lunch',
  'dinner',
  'pre',
  'post',
  'workout',
  'order',
  'paid',
  'expense',
  'online',
  'delivery',
  'plate',
  'bowl',
  'cup',
  'glass',
  'piece',
  'pieces',
  'serving',
]);

const ALIAS_GROUPS: string[][] = [
  ['chai', 'tea'],
  ['momo', 'momos', 'dumpling', 'dumplings'],
  ['biscuit', 'biscuits', 'cookie', 'cookies', 'rusk'],
  ['coffee', 'cafe', 'espresso', 'cappuccino', 'latte', 'coldcoffee'],
  ['pizza', 'dominos', 'pizzahut'],
  ['burger', 'mcdonalds', 'burgerking', 'kfc'],
  ['biryani', 'pulao'],
  ['roll', 'rolls', 'wrap', 'wraps', 'frankie', 'kathi'],
  ['shawarma'],
  ['samosa', 'kachori', 'pakora', 'chaat', 'vadapav'],
  ['sandwich', 'subway', 'sub', 'toast'],
  ['maggi', 'noodles', 'ramen', 'chowmein'],
  ['cake', 'pastry', 'brownie', 'dessert', 'icecream', 'waffle'],
  ['fries', 'chips', 'namkeen'],
  ['dosa', 'idli', 'vada', 'uttapam'],
  ['paratha', 'roti', 'thali', 'dhaba', 'canteen', 'restaurant'],
  ['juice', 'shake', 'smoothie', 'lassi', 'soda', 'cola', 'coke', 'pepsi'],
];

const DELIVERY_APPS_REGEX = /\b(swiggy|zomato|blinkit|zepto|instamart|eatsure)\b/i;

function canonicalizeFoodToken(token: string): string {
  const lower = token.toLowerCase();
  for (let i = 0; i < ALIAS_GROUPS.length; i++) {
    if (ALIAS_GROUPS[i].includes(lower)) {
      return `alias_${i}`;
    }
  }
  return lower;
}

function extractFoodTokens(text: string): { raw: string[]; canonical: Set<string> } {
  const raw = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !/^\d+$/.test(t) && !GENERIC_MEAL_WORDS.has(t));

  const canonical = new Set<string>();
  for (const t of raw) {
    canonical.add(t);
    canonical.add(canonicalizeFoodToken(t));
  }
  return { raw, canonical };
}

function buildCategoryMap(categories: FinanceCategory[]): Map<string, FinanceCategory> {
  return new Map(categories.map((c) => [c.id, c]));
}

/**
 * Returns true if a transaction is an active food or junk expense (excluding friend split share legs).
 */
export function isFoodOrJunkTransaction(
  tx: FinanceTransaction,
  catMap: Map<string, FinanceCategory>
): boolean {
  if (!tx || tx.deletedAt || tx.type !== 'expense') return false;

  const isFriendShareLeg =
    (tx.tags || []).some((t) => t.toLowerCase() === 'friend-share') ||
    /^\s*friend\s+split\s*$/i.test(tx.subcategory || '');
  if (isFriendShareLeg) return false;

  const cat = catMap.get(tx.categoryId);
  const kind = classifyCategoryBridgeKind(cat);
  if (kind === 'junk' || kind === 'food_dining') return true;
  if (kind === 'health_supplements') return false;

  if (
    (tx.tags || []).some((t) => /\b(junk|junk_food|fitness_meal|food)\b/i.test(t)) ||
    /\b(junk|food|dining|restaurant|cafe)\b/i.test(tx.subcategory || '')
  ) {
    return true;
  }

  return false;
}

function isTransactionJunk(
  tx: FinanceTransaction,
  catMap: Map<string, FinanceCategory>
): boolean {
  const cat = catMap.get(tx.categoryId);
  const kind = classifyCategoryBridgeKind(cat);
  return (
    kind === 'junk' ||
    /\bjunk\b/i.test(tx.subcategory || '') ||
    (tx.tags || []).some((t) => /\bjunk\b/i.test(t))
  );
}

/**
 * Scores a same-IST-day meal vs. finance transaction pair.
 */
export function scoreMealTransactionMatch(
  meal: Pick<MealLog, 'name' | 'date' | 'isJunk' | 'notes'>,
  tx: FinanceTransaction,
  catMap: Map<string, FinanceCategory>,
  opts?: { isUniqueJunkPairOnDay?: boolean }
): { score: number; confidence: 'high' | 'candidate' | 'none'; reason: string } {
  const mealDay = (meal.date || '').slice(0, 10);
  const txDay = (tx.date || '').slice(0, 10);
  if (!mealDay || !txDay || mealDay !== txDay) {
    return { score: 0, confidence: 'none', reason: 'different_date' };
  }

  if (!isFoodOrJunkTransaction(tx, catMap)) {
    return { score: 0, confidence: 'none', reason: 'not_food_or_junk' };
  }

  const mealText = `${meal.name || ''} ${meal.notes || ''}`.trim();
  const txText = `${tx.title || ''} ${tx.merchantName || ''} ${tx.rawMerchant || ''} ${tx.subcategory || ''} ${tx.notes || ''}`.trim();

  const mealToks = extractFoodTokens(mealText);
  const txToks = extractFoodTokens(txText);

  const overlap: string[] = [];
  for (const c of mealToks.canonical) {
    if (txToks.canonical.has(c)) {
      overlap.push(c);
    }
  }

  const mealClean = meal.name.trim().toLowerCase();
  const txClean = (tx.merchantName || tx.title || '').trim().toLowerCase();
  const directSubstr =
    mealClean.length >= 4 &&
    txClean.length >= 4 &&
    (mealClean.includes(txClean) || txClean.includes(mealClean));

  const txJunk = isTransactionJunk(tx, catMap);

  if (directSubstr || overlap.length > 0) {
    const score = (directSubstr ? 95 : 85) + Math.min(15, overlap.length * 5) + (meal.isJunk === txJunk ? 5 : 0);
    return {
      score,
      confidence: 'high',
      reason: directSubstr ? 'title_match' : `keyword:${overlap[0]}`,
    };
  }

  if (meal.isJunk && txJunk && opts?.isUniqueJunkPairOnDay) {
    return {
      score: 80,
      confidence: 'high',
      reason: 'unique_same_day_junk_pair',
    };
  }

  if (
    (meal.isJunk && txJunk) ||
    DELIVERY_APPS_REGEX.test(txText) ||
    classifyCategoryBridgeKind(catMap.get(tx.categoryId)) === 'food_dining'
  ) {
    return {
      score: 55,
      confidence: 'candidate',
      reason: meal.isJunk && txJunk ? 'same_day_junk' : 'same_day_food',
    };
  }

  return { score: 0, confidence: 'none', reason: 'no_signal' };
}

/**
 * Returns unlinked same-day food/junk expense candidates for a given meal.
 */
export function findCandidateTransactionsForMeal(
  meal: Pick<MealLog, 'id' | 'name' | 'date' | 'isJunk' | 'notes'>,
  transactions: FinanceTransaction[],
  allMeals: MealLog[],
  categories: FinanceCategory[]
): MealFinanceMatchCandidate[] {
  const catMap = buildCategoryMap(categories);
  const mealDay = (meal.date || '').slice(0, 10);

  const alreadyLinkedTxIds = new Set(
    allMeals
      .filter((m) => !m.deletedAt && m.id !== meal.id && Boolean(m.linkedTransactionId))
      .map((m) => m.linkedTransactionId as string)
  );

  const sameDayUnlinkedJunkMeals = allMeals.filter(
    (m) => !m.deletedAt && m.date.slice(0, 10) === mealDay && m.isJunk && !m.linkedTransactionId
  );
  const sameDayUnlinkedJunkTxs = transactions.filter(
    (t) =>
      !alreadyLinkedTxIds.has(t.id) &&
      t.date.slice(0, 10) === mealDay &&
      isFoodOrJunkTransaction(t, catMap) &&
      isTransactionJunk(t, catMap)
  );

  const isUniqueJunkPairOnDay =
    Boolean(meal.isJunk) &&
    sameDayUnlinkedJunkMeals.length <= 1 &&
    sameDayUnlinkedJunkTxs.length === 1;

  const candidates: MealFinanceMatchCandidate[] = [];
  for (const tx of transactions) {
    if (alreadyLinkedTxIds.has(tx.id)) continue;
    const scored = scoreMealTransactionMatch(meal, tx, catMap, { isUniqueJunkPairOnDay });
    if (scored.confidence !== 'none') {
      candidates.push({
        transaction: tx,
        ...scored,
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score || b.transaction.date.localeCompare(a.transaction.date));
}

/**
 * Finds the best unlinked same-day transaction match for a logged meal.
 */
export function findBestMealTransactionMatch(
  meal: Pick<MealLog, 'id' | 'name' | 'date' | 'isJunk' | 'notes'>,
  transactions: FinanceTransaction[],
  allMeals: MealLog[],
  categories: FinanceCategory[]
): MealFinanceMatchCandidate | null {
  const list = findCandidateTransactionsForMeal(meal, transactions, allMeals, categories);
  return list[0] ?? null;
}

/**
 * Finds the best unlinked same-day meal match for a newly created food/junk transaction.
 */
export function findBestTransactionMealMatch(
  tx: FinanceTransaction,
  meals: MealLog[],
  categories: FinanceCategory[]
): TransactionMealMatchCandidate | null {
  const catMap = buildCategoryMap(categories);
  if (!isFoodOrJunkTransaction(tx, catMap)) return null;

  const txDay = (tx.date || '').slice(0, 10);
  const unlinkedDayMeals = meals.filter(
    (m) => !m.deletedAt && m.date.slice(0, 10) === txDay && !m.linkedTransactionId
  );
  if (unlinkedDayMeals.length === 0) return null;

  const txJunk = isTransactionJunk(tx, catMap);
  const unlinkedJunkDayMeals = unlinkedDayMeals.filter((m) => m.isJunk);
  const isUniqueJunkPairOnDay = txJunk && unlinkedJunkDayMeals.length === 1;

  const scored: TransactionMealMatchCandidate[] = [];
  for (const meal of unlinkedDayMeals) {
    const res = scoreMealTransactionMatch(meal, tx, catMap, { isUniqueJunkPairOnDay });
    if (res.confidence !== 'none') {
      scored.push({
        meal,
        ...res,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored[0] ?? null;
}
