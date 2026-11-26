import { estimateHinglishFoodMacros } from './meal-estimator';
import { matchExpenseToSupplement } from './supplement-meal-bridge';
import { useFitnessStore } from '@/lib/stores/fitness';
import type {
  FinanceCategory,
  FinanceTransaction,
  MealType,
  SupplementCategory,
  SupplementInventory,
} from '@/lib/types';

export type FinanceBridgeKind =
  | 'junk'
  | 'food_dining'
  | 'health_supplements'
  | 'none';

const BRIDGE_CLASSIFIERS: Array<{
  kind: FinanceBridgeKind;
  match: (slug: string, combined: string) => boolean;
}> = [
  {
    kind: 'junk',
    match: (slug, combined) =>
      slug === 'junk-food' || slug.includes('junk') || /\bjunk\s*food\b/i.test(combined),
  },
  {
    kind: 'food_dining',
    match: (slug, combined) =>
      slug.includes('food') || slug.includes('dining') || /\b(food|dining|restaurant|cafe|meals?)\b/i.test(combined),
  },
  {
    kind: 'health_supplements',
    match: (slug, combined) =>
      slug === 'medical-supplements' ||
      slug === 'health-supplements' ||
      slug.includes('supplement') ||
      /\b(supplement|supplements|whey|creatine|protein|vitamin|medical|pharmacy)\b/i.test(combined),
  },
];

export function classifyCategoryBridgeKind(
  category?: Pick<FinanceCategory, 'slug' | 'name'> | null
): FinanceBridgeKind {
  if (!category) return 'none';
  const slug = (category.slug || '').toLowerCase();
  const combined = `${slug} ${(category.name || '').toLowerCase()}`.trim();
  return BRIDGE_CLASSIFIERS.find((c) => c.match(slug, combined))?.kind ?? 'none';
}

const SUPPLEMENT_CATEGORY_RULES: Array<[RegExp, SupplementCategory]> = [
  [/\b(whey|casein|protein|isolate|plant protein)\b/i, 'protein'],
  [/\b(creatine|monohydrate)\b/i, 'creatine'],
  [/\b(omega|fish oil|epa|dha)\b/i, 'omega'],
  [/\b(pre[\s-]?workout|caffeine|citrulline)\b/i, 'pre_workout'],
  [/\b(zinc|magnesium|calcium|iron)\b/i, 'mineral'],
  [/\b(electrolyte|ors|hydration)\b/i, 'other'],
  [/\b(vitamin|vit\s*d|d3|b12|multivitamin)\b/i, 'vitamin'],
];

export function inferSupplementCategoryFromTitle(title: string): SupplementCategory {
  const q = title.toLowerCase();
  return SUPPLEMENT_CATEGORY_RULES.find(([re]) => re.test(q))?.[1] ?? 'other';
}

export function findMatchingSupplementId(
  title: string,
  inventory: SupplementInventory[]
): string {
  const active = inventory.filter((s) => !s.deletedAt && s.isActive);
  if (active.length === 0) return '__new__';

  const q = title.trim();
  if (!q) return active[0].id;

  const matched = matchExpenseToSupplement({ title: q }, active);
  return matched ? matched.id : '__new__';
}

export function estimateDietBridgePreview(title: string, amountInr: number, isJunk: boolean) {
  const cleanTitle = title.trim() || (isJunk ? 'Junk Snack / Order' : 'Restaurant Meal');
  const est = estimateHinglishFoodMacros(cleanTitle, { amountInr, forceJunk: isJunk });
  const isCatalogMatch = est.confidence >= 80;
  const fallbackCalories = Math.min(1400, Math.max(250, Math.round((amountInr || 150) * 1.5)));

  if (isCatalogMatch || isJunk) {
    return {
      name: cleanTitle,
      calories: est.calories,
      proteinG: est.proteinG,
      carbsG: est.carbsG,
      fatG: est.fatG,
      mealType: est.mealType as MealType,
    };
  }
  return {
    name: cleanTitle,
    calories: fallbackCalories,
    proteinG: 16,
    carbsG: 42,
    fatG: 14,
    mealType: 'lunch' as MealType,
  };
}

function resolveBridgeMealMacros(params: {
  title: string;
  amount: number;
  dietCalories?: number;
  dietProteinG?: number;
}) {
  const preview = estimateDietBridgePreview(params.title, params.amount, false);
  const calories = params.dietCalories && params.dietCalories > 0 ? Math.round(params.dietCalories) : preview.calories;
  const proteinG =
    params.dietProteinG !== undefined && params.dietProteinG >= 0 ? Number(params.dietProteinG) : preview.proteinG;
  return { preview, calories, proteinG };
}

async function handleFoodDiningBridge(params: {
  transaction: Pick<FinanceTransaction, 'id' | 'title' | 'amount' | 'date'>;
  userId?: string;
  dietCalories?: number;
  dietProteinG?: number;
}) {
  const fitness = useFitnessStore.getState();
  const { preview, calories, proteinG } = resolveBridgeMealMacros({
    title: params.transaction.title,
    amount: params.transaction.amount,
    dietCalories: params.dietCalories,
    dietProteinG: params.dietProteinG,
  });

  await fitness.upsertMealFromCapture({
    userId: params.userId,
    date: params.transaction.date,
    name: preview.name,
    calories,
    proteinG,
    carbsG: preview.carbsG,
    fatG: preview.fatG,
    mealType: preview.mealType,
    isJunk: false,
    linkedTransactionId: params.transaction.id,
    source: 'finance_bridge',
    notes: `Linked from ₹${params.transaction.amount} Food & Dining expense`,
  });
  return { dietLogged: true };
}

async function createRestockedSupplementFromTx(params: {
  transaction: Pick<FinanceTransaction, 'id' | 'title' | 'amount' | 'date'>;
  servings: number;
  userId?: string;
  newSupplementName?: string;
}) {
  const name = (params.newSupplementName || params.transaction.title || 'Supplement').trim() || 'Supplement';
  const category = inferSupplementCategoryFromTitle(name);
  const created = await useFitnessStore.getState().addSupplement(
    {
      name,
      category,
      totalServings: params.servings,
      costInr: params.transaction.amount,
      proteinPerServingG: category === 'protein' ? 24 : null,
      linkedTransactionId: params.transaction.id,
      lastRestockedAt: params.transaction.date,
    },
    params.userId
  );
  return { supplementRestocked: created.name };
}

async function handleSupplementRestockBridge(params: {
  transaction: Pick<FinanceTransaction, 'id' | 'title' | 'amount' | 'date'>;
  userId?: string;
  supplementId?: string;
  restockServings?: number;
  newSupplementName?: string;
}) {
  const servings = Math.max(1, Math.round(Number(params.restockServings) || 30));
  const chosenId = params.supplementId || '__new__';

  if (chosenId !== '__new__') {
    const updated = await useFitnessStore.getState().restockSupplement(chosenId, {
      servingsAdded: servings,
      costInr: params.transaction.amount,
      linkedTransactionId: params.transaction.id,
      date: params.transaction.date,
    });
    if (updated) return { supplementRestocked: updated.name };
  }

  return createRestockedSupplementFromTx({
    transaction: params.transaction,
    servings,
    userId: params.userId,
    newSupplementName: params.newSupplementName,
  });
}

export async function executeFinanceFitnessBridge(params: {
  bridgeKind: FinanceBridgeKind;
  transaction: Pick<FinanceTransaction, 'id' | 'title' | 'amount' | 'date' | 'type'>;
  userId?: string;
  alsoLogToDiet?: boolean;
  dietCalories?: number;
  dietProteinG?: number;
  restockSupplement?: boolean;
  supplementId?: string;
  restockServings?: number;
  newSupplementName?: string;
}): Promise<{ dietLogged?: boolean; supplementRestocked?: string }> {
  if (params.transaction.type !== 'expense') return {};
  if (params.bridgeKind === 'food_dining' && params.alsoLogToDiet) {
    return handleFoodDiningBridge(params);
  }
  if (params.bridgeKind === 'health_supplements' && params.restockSupplement) {
    return handleSupplementRestockBridge(params);
  }
  return {};
}
