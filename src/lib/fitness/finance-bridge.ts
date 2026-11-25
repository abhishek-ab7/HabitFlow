import { estimateHinglishFoodMacros } from './meal-estimator';
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

export function classifyCategoryBridgeKind(
  category?: Pick<FinanceCategory, 'slug' | 'name'> | null
): FinanceBridgeKind {
  if (!category) return 'none';
  const slug = (category.slug || '').toLowerCase();
  const name = (category.name || '').toLowerCase();
  const combined = `${slug} ${name}`.trim();

  if (
    slug === 'junk-food' ||
    slug.includes('junk') ||
    /\bjunk\s*food\b/i.test(combined)
  ) {
    return 'junk';
  }

  if (
    slug.includes('food') ||
    slug.includes('dining') ||
    /\b(food|dining|restaurant|cafe|meals?)\b/i.test(combined)
  ) {
    return 'food_dining';
  }

  if (
    slug === 'medical-supplements' ||
    slug === 'health-supplements' ||
    slug.includes('supplement') ||
    /\b(supplement|supplements|whey|creatine|protein|vitamin|medical|pharmacy)\b/i.test(
      combined
    )
  ) {
    return 'health_supplements';
  }

  return 'none';
}

export function inferSupplementCategoryFromTitle(title: string): SupplementCategory {
  const q = title.toLowerCase();
  if (/\b(whey|casein|protein|isolate|plant protein)\b/i.test(q)) return 'protein';
  if (/\b(creatine|monohydrate)\b/i.test(q)) return 'creatine';
  if (/\b(omega|fish oil|epa|dha)\b/i.test(q)) return 'omega';
  if (/\b(pre[\s-]?workout|caffeine|citrulline)\b/i.test(q)) return 'pre_workout';
  if (/\b(zinc|magnesium|calcium|iron)\b/i.test(q)) return 'mineral';
  if (/\b(electrolyte|ors|hydration)\b/i.test(q)) return 'other';
  if (/\b(vitamin|vit\s*d|d3|b12|multivitamin)\b/i.test(q)) {
    return 'vitamin';
  }
  return 'other';
}

export function findMatchingSupplementId(
  title: string,
  inventory: SupplementInventory[]
): string {
  const active = inventory.filter((s) => !s.deletedAt && s.isActive);
  if (active.length === 0) return '__new__';

  const q = title.trim().toLowerCase();
  if (!q) return active[0].id;

  const directMatch = active.find(
    (s) =>
      q.includes(s.name.toLowerCase()) ||
      s.name.toLowerCase().includes(q)
  );
  if (directMatch) return directMatch.id;

  const keywords = ['whey', 'protein', 'creatine', 'omega', 'vitamin', 'd3', 'magnesium', 'zinc', 'fish oil', 'multivitamin'];
  for (const kw of keywords) {
    if (q.includes(kw)) {
      const tokenMatch = active.find((s) => s.name.toLowerCase().includes(kw));
      if (tokenMatch) return tokenMatch.id;
    }
  }

  return '__new__';
}

export function estimateDietBridgePreview(title: string, amountInr: number, isJunk: boolean) {
  const cleanTitle = title.trim() || (isJunk ? 'Junk Snack / Order' : 'Restaurant Meal');
  const est = estimateHinglishFoodMacros(cleanTitle, {
    amountInr,
    forceJunk: isJunk,
  });
  const isCatalogMatch = est.confidence >= 80;
  const calories =
    isCatalogMatch && est.calories > 0
      ? est.calories
      : isJunk
        ? est.calories
        : Math.min(1400, Math.max(250, Math.round((amountInr || 150) * 1.5)));
  const proteinG =
    isCatalogMatch && est.proteinG > 0
      ? est.proteinG
      : isJunk
        ? est.proteinG
        : 16;
  const carbsG = isCatalogMatch ? est.carbsG : isJunk ? est.carbsG : 42;
  const fatG = isCatalogMatch ? est.fatG : isJunk ? est.fatG : 14;
  return {
    name: cleanTitle,
    calories,
    proteinG,
    carbsG,
    fatG,
    mealType: (isCatalogMatch ? est.mealType : isJunk ? est.mealType : 'lunch') as MealType,
  };
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
  const fitness = useFitnessStore.getState();

  // Junk Food is ALWAYS auto-logged via CrossDomainActionMediator.onFinanceEvent;
  // do NOT silently double-log here.
  if (params.bridgeKind === 'food_dining' && params.alsoLogToDiet) {
    const preview = estimateDietBridgePreview(
      params.transaction.title,
      params.transaction.amount,
      false
    );
    await fitness.upsertMealFromCapture({
      userId: params.userId,
      date: params.transaction.date,
      name: preview.name,
      calories:
        params.dietCalories !== undefined && params.dietCalories > 0
          ? Math.round(params.dietCalories)
          : preview.calories,
      proteinG:
        params.dietProteinG !== undefined && params.dietProteinG >= 0
          ? Number(params.dietProteinG)
          : preview.proteinG,
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

  if (params.bridgeKind === 'health_supplements' && params.restockSupplement) {
    const servings = Math.max(1, Math.round(Number(params.restockServings) || 30));
    const chosenId = params.supplementId || '__new__';

    if (chosenId !== '__new__') {
      const updated = await fitness.restockSupplement(chosenId, {
        servingsAdded: servings,
        costInr: params.transaction.amount,
        linkedTransactionId: params.transaction.id,
        date: params.transaction.date,
      });
      if (updated) {
        return { supplementRestocked: updated.name };
      }
    }

    const name =
      (params.newSupplementName || params.transaction.title || 'Supplement').trim() ||
      'Supplement';
    const category = inferSupplementCategoryFromTitle(name);
    const created = await fitness.addSupplement(
      {
        name,
        category,
        totalServings: servings,
        costInr: params.transaction.amount,
        proteinPerServingG: category === 'protein' ? 24 : null,
        linkedTransactionId: params.transaction.id,
        lastRestockedAt: params.transaction.date,
      },
      params.userId
    );
    return { supplementRestocked: created.name };
  }

  return {};
}
