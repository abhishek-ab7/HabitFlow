import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifyCategoryBridgeKind,
  estimateDietBridgePreview,
  executeFinanceFitnessBridge,
  findMatchingSupplementId,
  inferSupplementCategoryFromTitle,
} from '../finance-bridge';
import { useFitnessStore } from '@/lib/stores/fitness';
import type { SupplementInventory } from '@/lib/types';

const nowIso = '2026-11-24T10:00:00.000Z';

function makeSupp(patch: Partial<SupplementInventory>): SupplementInventory {
  return {
    id: 'sup_1',
    userId: 'u1',
    name: 'Whey Isolate',
    category: 'protein',
    unitLabel: 'scoop',
    totalServings: 30,
    remainingServings: 10,
    dailyDosage: 1,
    costInr: 1999,
    lowStockThresholdDays: 7,
    isActive: true,
    createdAt: nowIso,
    updatedAt: nowIso,
    ...patch,
  };
}

describe('Finance <-> Diet & Supplement Bridge (Decision 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('classifies Junk Food, Food & Dining, Health & Supplements, and unrelated categories accurately', () => {
    expect(classifyCategoryBridgeKind({ slug: 'junk-food', name: 'Junk Food' })).toBe('junk');
    expect(classifyCategoryBridgeKind({ slug: 'food-dining', name: 'Food & Dining' })).toBe('food_dining');
    expect(classifyCategoryBridgeKind({ slug: 'medical-supplements', name: 'Health & Supplements' })).toBe(
      'health_supplements'
    );
    expect(classifyCategoryBridgeKind({ slug: 'transport-travel', name: 'Transport' })).toBe('none');
    expect(classifyCategoryBridgeKind(null)).toBe('none');
  });

  it('infers valid SupplementCategory values from transaction titles', () => {
    expect(inferSupplementCategoryFromTitle('ON Gold Whey Protein')).toBe('protein');
    expect(inferSupplementCategoryFromTitle('Creatine Monohydrate 250g')).toBe('creatine');
    expect(inferSupplementCategoryFromTitle('Fish Oil Omega 3')).toBe('omega');
    expect(inferSupplementCategoryFromTitle('Citrulline Pre-Workout')).toBe('pre_workout');
    expect(inferSupplementCategoryFromTitle('Magnesium Glycinate')).toBe('mineral');
    expect(inferSupplementCategoryFromTitle('Vitamin D3 60k')).toBe('vitamin');
    expect(inferSupplementCategoryFromTitle('Electrolyte ORS')).toBe('other');
    expect(inferSupplementCategoryFromTitle('Ashwagandha')).toBe('other');
  });

  it('matches active supplement inventory or falls back to __new__', () => {
    const inv: SupplementInventory[] = [
      makeSupp({ id: 'sup_whey', name: 'Optimum Whey Isolate', isActive: true }),
      makeSupp({ id: 'sup_deleted', name: 'Creatine Old', deletedAt: nowIso }),
      makeSupp({ id: 'sup_vit', name: 'Vitamin D3 Drops', category: 'vitamin' }),
    ];

    expect(findMatchingSupplementId('Whey refill 1299', inv)).toBe('sup_whey');
    expect(findMatchingSupplementId('Vit D3', inv)).toBe('sup_vit');
    expect(findMatchingSupplementId('Creatine Monohydrate', inv)).toBe('__new__');
    expect(findMatchingSupplementId('Anything', [])).toBe('__new__');
  });

  it('estimates Diet bridge preview using Hinglish food catalog and INR fallback', () => {
    const momo = estimateDietBridgePreview('Momos outside gate', 60, true);
    expect(momo.calories).toBe(350);
    expect(momo.proteinG).toBe(10);
    expect(momo.mealType).toBe('snack');

    const unknownDining = estimateDietBridgePreview('Canteen Special Meal', 200, false);
    expect(unknownDining.calories).toBe(300); // 200 * 1.5
    expect(unknownDining.proteinG).toBe(16);
    expect(unknownDining.mealType).toBe('lunch');

    const unknownJunk = estimateDietBridgePreview('Midnight Street Platter', 400, true);
    expect(unknownJunk.calories).toBe(550); // >=350 INR heuristic
  });

  it('never double-logs Junk Food in UI bridge, logs Food & Dining only when opted-in, and restocks/creates supplements', async () => {
    const upsertMealFromCapture = vi.fn().mockResolvedValue({});
    const restockSupplement = vi.fn().mockResolvedValue(makeSupp({ id: 'sup_whey', name: 'Whey Isolate' }));
    const addSupplement = vi.fn().mockResolvedValue(makeSupp({ id: 'sup_new', name: 'Creatine Monohydrate' }));

    useFitnessStore.setState({
      upsertMealFromCapture,
      restockSupplement,
      addSupplement,
    } as Partial<ReturnType<typeof useFitnessStore.getState>> as never);

    // 1. Junk Food is auto-logged via CrossDomainActionMediator.onFinanceEvent -> bridge skips
    const junkRes = await executeFinanceFitnessBridge({
      bridgeKind: 'junk',
      transaction: { id: 'tx_j', title: 'Pizza', amount: 300, date: '2026-11-24', type: 'expense' },
      alsoLogToDiet: true,
    });
    expect(junkRes).toEqual({});
    expect(upsertMealFromCapture).not.toHaveBeenCalled();

    // 2. Food & Dining with toggle OFF -> skips
    const foodOff = await executeFinanceFitnessBridge({
      bridgeKind: 'food_dining',
      transaction: { id: 'tx_f1', title: 'Dinner', amount: 220, date: '2026-11-24', type: 'expense' },
      alsoLogToDiet: false,
    });
    expect(foodOff).toEqual({});
    expect(upsertMealFromCapture).not.toHaveBeenCalled();

    // 3. Food & Dining with toggle ON -> calls upsertMealFromCapture
    const foodOn = await executeFinanceFitnessBridge({
      bridgeKind: 'food_dining',
      transaction: { id: 'tx_f2', title: 'Chicken Rice Bowl', amount: 280, date: '2026-11-24', type: 'expense' },
      userId: 'u1',
      alsoLogToDiet: true,
      dietCalories: 510,
      dietProteinG: 40,
    });
    expect(foodOn).toEqual({ dietLogged: true });
    expect(upsertMealFromCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        linkedTransactionId: 'tx_f2',
        calories: 510,
        proteinG: 40,
        isJunk: false,
        source: 'finance_bridge',
      })
    );

    // 4. Health & Supplements restocking existing item
    const restockRes = await executeFinanceFitnessBridge({
      bridgeKind: 'health_supplements',
      transaction: { id: 'tx_s1', title: 'Whey 1kg', amount: 1299, date: '2026-11-24', type: 'expense' },
      restockSupplement: true,
      supplementId: 'sup_whey',
      restockServings: 33,
    });
    expect(restockRes).toEqual({ supplementRestocked: 'Whey Isolate' });
    expect(restockSupplement).toHaveBeenCalledWith('sup_whey', {
      servingsAdded: 33,
      costInr: 1299,
      linkedTransactionId: 'tx_s1',
      date: '2026-11-24',
    });

    // 5. Health & Supplements creating new item
    const createRes = await executeFinanceFitnessBridge({
      bridgeKind: 'health_supplements',
      transaction: { id: 'tx_s2', title: 'Creatine Monohydrate', amount: 899, date: '2026-11-24', type: 'expense' },
      userId: 'u1',
      restockSupplement: true,
      supplementId: '__new__',
      restockServings: 60,
    });
    expect(createRes).toEqual({ supplementRestocked: 'Creatine Monohydrate' });
    expect(addSupplement).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Creatine Monohydrate',
        category: 'creatine',
        totalServings: 60,
        costInr: 899,
        linkedTransactionId: 'tx_s2',
      }),
      'u1'
    );

    // 6. Income / non-expense never bridges
    const incomeRes = await executeFinanceFitnessBridge({
      bridgeKind: 'health_supplements',
      transaction: { id: 'tx_inc', title: 'Refund', amount: 500, date: '2026-11-24', type: 'income' },
      restockSupplement: true,
    });
    expect(incomeRes).toEqual({});
  });
});
