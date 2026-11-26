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
function isFriendShareLeg(tx: FinanceTransaction): boolean {
  const hasTag = (tx.tags || []).some((t) => t.toLowerCase() === 'friend-share');
  return hasTag || /^\s*friend\s+split\s*$/i.test(tx.subcategory || '');
}

function hasFoodOrJunkHints(tx: FinanceTransaction): boolean {
  const hasFoodTag = (tx.tags || []).some((t) => /\b(junk|junk_food|fitness_meal|food)\b/i.test(t));
  return hasFoodTag || /\b(junk|food|dining|restaurant|cafe)\b/i.test(tx.subcategory || '');
}

export function isFoodOrJunkTransaction(
  tx: FinanceTransaction,
  catMap: Map<string, FinanceCategory>
): boolean {
  const isActiveExpense = Boolean(tx) && !tx.deletedAt && tx.type === 'expense';
  if (!isActiveExpense || isFriendShareLeg(tx)) return false;

  const kind = classifyCategoryBridgeKind(catMap.get(tx.categoryId));
  if (kind === 'junk' || kind === 'food_dining') return true;
  if (kind === 'health_supplements') return false;
  return hasFoodOrJunkHints(tx);
}

function isTransactionJunk(
  tx: FinanceTransaction,
  catMap: Map<string, FinanceCategory>
): boolean {
  const kind = classifyCategoryBridgeKind(catMap.get(tx.categoryId));
  if (kind === 'junk') return true;
  return /\bjunk\b/i.test(tx.subcategory || '') || (tx.tags || []).some((t) => /\bjunk\b/i.test(t));
}

function findTokenOverlap(mealText: string, txText: string): string[] {
  const mealToks = extractFoodTokens(mealText);
  const txToks = extractFoodTokens(txText);
  return Array.from(mealToks.canonical).filter((c) => txToks.canonical.has(c));
}

function hasDirectSubstringMatch(mealName: string, tx: FinanceTransaction): boolean {
  const mealClean = mealName.trim().toLowerCase();
  const txClean = (tx.merchantName || tx.title || '').trim().toLowerCase();
  if (mealClean.length < 4 || txClean.length < 4) return false;
  return mealClean.includes(txClean) || txClean.includes(mealClean);
}

function buildTextMatchResult(
  directSubstr: boolean,
  overlap: string[],
  isJunkAligned: boolean
): { score: number; confidence: 'high'; reason: string } {
  const base = directSubstr ? 95 : 85;
  const bonus = Math.min(15, overlap.length * 5) + (isJunkAligned ? 5 : 0);
  return {
    score: base + bonus,
    confidence: 'high',
    reason: directSubstr ? 'title_match' : `keyword:${overlap[0]}`,
  };
}

function scoreCandidateSignal(params: {
  meal: Pick<MealLog, 'name' | 'date' | 'isJunk' | 'notes'>;
  tx: FinanceTransaction;
  catMap: Map<string, FinanceCategory>;
  txText: string;
  isUniqueJunkPairOnDay?: boolean;
}): { score: number; confidence: 'high' | 'candidate' | 'none'; reason: string } {
  const txJunk = isTransactionJunk(params.tx, params.catMap);
  const bothJunk = Boolean(params.meal.isJunk && txJunk);
  if (bothJunk && params.isUniqueJunkPairOnDay) {
    return { score: 80, confidence: 'high', reason: 'unique_same_day_junk_pair' };
  }
  if (bothJunk) {
    return { score: 55, confidence: 'candidate', reason: 'same_day_junk' };
  }
  const isDelivery = DELIVERY_APPS_REGEX.test(params.txText);
  const isFoodCat = classifyCategoryBridgeKind(params.catMap.get(params.tx.categoryId)) === 'food_dining';
  if (isDelivery || isFoodCat) {
    return { score: 55, confidence: 'candidate', reason: 'same_day_food' };
  }
  return { score: 0, confidence: 'none', reason: 'no_signal' };
}

function buildCombinedTexts(meal: Pick<MealLog, 'name' | 'notes'>, tx: FinanceTransaction) {
  return {
    mealText: `${meal.name || ''} ${meal.notes || ''}`.trim(),
    txText: `${tx.title || ''} ${tx.merchantName || ''} ${tx.rawMerchant || ''} ${tx.subcategory || ''} ${tx.notes || ''}`.trim(),
  };
}

export function scoreMealTransactionMatch(
  meal: Pick<MealLog, 'name' | 'date' | 'isJunk' | 'notes'>,
  tx: FinanceTransaction,
  catMap: Map<string, FinanceCategory>,
  opts?: { isUniqueJunkPairOnDay?: boolean }
): { score: number; confidence: 'high' | 'candidate' | 'none'; reason: string } {
  const mealDay = (meal.date || '').slice(0, 10);
  const txDay = (tx.date || '').slice(0, 10);
  if (!mealDay || mealDay !== txDay) return { score: 0, confidence: 'none', reason: 'different_date' };
  if (!isFoodOrJunkTransaction(tx, catMap)) return { score: 0, confidence: 'none', reason: 'not_food_or_junk' };

  const { mealText, txText } = buildCombinedTexts(meal, tx);
  const overlap = findTokenOverlap(mealText, txText);
  const directSubstr = hasDirectSubstringMatch(meal.name, tx);

  if (directSubstr || overlap.length > 0) {
    return buildTextMatchResult(directSubstr, overlap, Boolean(meal.isJunk) === isTransactionJunk(tx, catMap));
  }

  return scoreCandidateSignal({
    meal,
    tx,
    catMap,
    txText,
    isUniqueJunkPairOnDay: opts?.isUniqueJunkPairOnDay,
  });
}

function collectLinkedTransactionIds(allMeals: MealLog[], currentMealId: string): Set<string> {
  return new Set(
    allMeals
      .filter((m) => !m.deletedAt && m.id !== currentMealId && Boolean(m.linkedTransactionId))
      .map((m) => m.linkedTransactionId as string)
  );
}

function countUnlinkedDayJunkMeals(allMeals: MealLog[], mealDay: string): number {
  return allMeals.filter((m) => !m.deletedAt && m.isJunk && !m.linkedTransactionId && m.date.slice(0, 10) === mealDay).length;
}

function countUnlinkedDayJunkTxs(
  transactions: FinanceTransaction[],
  mealDay: string,
  alreadyLinkedTxIds: Set<string>,
  catMap: Map<string, FinanceCategory>
): number {
  return transactions.filter(
    (t) =>
      !alreadyLinkedTxIds.has(t.id) &&
      t.date.slice(0, 10) === mealDay &&
      isFoodOrJunkTransaction(t, catMap) &&
      isTransactionJunk(t, catMap)
  ).length;
}

function hasUniqueSameDayJunkPair(params: {
  isMealJunk?: boolean;
  mealDay: string;
  allMeals: MealLog[];
  transactions: FinanceTransaction[];
  alreadyLinkedTxIds: Set<string>;
  catMap: Map<string, FinanceCategory>;
}): boolean {
  const { isMealJunk, mealDay, allMeals, transactions, alreadyLinkedTxIds, catMap } = params;
  if (!isMealJunk) return false;
  if (countUnlinkedDayJunkMeals(allMeals, mealDay) > 1) return false;
  return countUnlinkedDayJunkTxs(transactions, mealDay, alreadyLinkedTxIds, catMap) === 1;
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
  const alreadyLinkedTxIds = collectLinkedTransactionIds(allMeals, meal.id);
  const isUniqueJunkPairOnDay = hasUniqueSameDayJunkPair({
    isMealJunk: meal.isJunk,
    mealDay,
    allMeals,
    transactions,
    alreadyLinkedTxIds,
    catMap,
  });

  const candidates: MealFinanceMatchCandidate[] = [];
  for (const tx of transactions) {
    if (alreadyLinkedTxIds.has(tx.id)) continue;
    const scored = scoreMealTransactionMatch(meal, tx, catMap, { isUniqueJunkPairOnDay });
    if (scored.confidence !== 'none') candidates.push({ transaction: tx, ...scored });
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
  const unlinkedDayMeals = meals.filter((m) => !m.deletedAt && m.date.slice(0, 10) === txDay && !m.linkedTransactionId);
  if (unlinkedDayMeals.length === 0) return null;

  const isUniqueJunkPairOnDay =
    isTransactionJunk(tx, catMap) && unlinkedDayMeals.filter((m) => m.isJunk).length === 1;

  return unlinkedDayMeals
    .map((meal) => ({ meal, ...scoreMealTransactionMatch(meal, tx, catMap, { isUniqueJunkPairOnDay }) }))
    .filter((res) => res.confidence !== 'none')
    .sort((a, b) => b.score - a.score)[0] ?? null;
}
