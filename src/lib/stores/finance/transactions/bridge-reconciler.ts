import { db } from '@/lib/db';
import { classifyCategoryBridgeKind } from '@/lib/fitness/finance-bridge';
import { estimateHinglishFoodMacros } from '@/lib/fitness/meal-estimator';
import type { FinanceCategory, FinanceTransaction, MealLog } from '@/lib/types';

async function loadUniqueLinkedMeals(txId: string, storeMeals: MealLog[]): Promise<MealLog[]> {
  const dbLinked = db.mealLogs
    ? await db.mealLogs.where('linkedTransactionId').equals(txId).toArray()
    : [];
  const seenIds = new Set<string>();
  return [...storeMeals, ...dbLinked].filter((m) => {
    if (seenIds.has(m.id)) return false;
    seenIds.add(m.id);
    return !m.deletedAt && m.linkedTransactionId === txId;
  });
}

async function updateBridgeMealFromTx(meal: MealLog, tx: FinanceTransaction): Promise<void> {
  const { useFitnessStore } = await import('../../fitness');
  const estimate = estimateHinglishFoodMacros(tx.title, {
    amountInr: tx.amount,
    forceJunk: true,
  });
  const updatedMeal: MealLog = {
    ...meal,
    date: tx.date,
    mealType: estimate.mealType,
    name: tx.title.trim() || estimate.name,
    calories: estimate.calories,
    proteinG: estimate.proteinG,
    carbsG: estimate.carbsG,
    fatG: estimate.fatG,
    isJunk: true,
    notes: tx.notes || `Auto-logged from Junk Food expense (₹${Math.round(tx.amount)})`,
    generationCounter: (meal.generationCounter || 1) + 1,
    isDirty: true,
    updatedAt: new Date().toISOString(),
  };

  await db.mealLogs.put(updatedMeal);
  useFitnessStore.setState((state) => ({
    mealLogs: state.mealLogs
      .map((m) => (m.id === updatedMeal.id ? updatedMeal : m))
      .sort((a, b) => b.date.localeCompare(a.date) || b.loggedAt.localeCompare(a.loggedAt)),
  }));
}

async function deleteBridgeMeals(
  meals: MealLog[],
  deleteMealLog: (id: string) => Promise<void>
): Promise<void> {
  for (const m of meals) {
    if (m.source === 'finance_bridge') await deleteMealLog(m.id);
  }
}

export async function reconcileFinanceBridgeMealForTransaction(
  tx: FinanceTransaction,
  categories: FinanceCategory[]
): Promise<void> {
  try {
    const { useFitnessStore } = await import('../../fitness');
    const fitState = useFitnessStore.getState();
    const cat = categories.find((c) => c.id === tx.categoryId);
    const isActiveJunkExpense =
      !tx.deletedAt && tx.type === 'expense' && classifyCategoryBridgeKind(cat) === 'junk';
    const linkedMeals = await loadUniqueLinkedMeals(tx.id, fitState.mealLogs);

    if (!isActiveJunkExpense) {
      await deleteBridgeMeals(linkedMeals, fitState.deleteMealLog);
      return;
    }

    const bridgeMeals = linkedMeals.filter((m) => m.source === 'finance_bridge');
    if (bridgeMeals.length > 0) {
      await Promise.all(bridgeMeals.map((meal) => updateBridgeMealFromTx(meal, tx)));
      return;
    }

    if (linkedMeals.length === 0) {
      await fitState.ensureMealForJunkTransaction({
        transactionId: tx.id,
        userId: tx.userId,
        date: tx.date,
        title: tx.title,
        amountInr: tx.amount,
        notes: tx.notes,
      });
    }
  } catch {
    // Non-blocking fitness bridge reconciliation
  }
}

export async function cleanupBridgeMealsForDeletedTx(txId: string): Promise<void> {
  try {
    const { useFitnessStore } = await import('../../fitness');
    const fitState = useFitnessStore.getState();
    const linked = await loadUniqueLinkedMeals(txId, fitState.mealLogs);
    await deleteBridgeMeals(linked, fitState.deleteMealLog);
  } catch {
    // Non-blocking fitness bridge cleanup
  }
}
