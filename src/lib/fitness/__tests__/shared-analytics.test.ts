import { describe, expect, it } from 'vitest';
import {
  calculate7DayRollingWeight,
  calculateCostPer25gProtein,
  calculateDailyFuelSummary,
  calculateSupplementStockAndRoi,
  calculateWeeklyWaistTrend,
  deriveSupplementRemainingServings,
  getProgressiveOverloadHint,
} from '../shared-analytics';
import {
  estimateHinglishFoodMacros,
  matchMealTemplate,
  STARTER_INDIAN_STAPLES,
} from '../meal-estimator';
import type {
  FitnessDailyLog,
  FitnessProfile,
  MealLog,
  MealTemplate,
  SupplementInventory,
  SupplementLog,
  WorkoutSession,
} from '@/lib/types';

const nowIso = '2026-11-24T10:00:00.000Z';

function makeDailyLog(date: string, patch: Partial<FitnessDailyLog>): FitnessDailyLog {
  return {
    id: `dl_${date}`,
    userId: 'u1',
    date,
    waterMl: 0,
    steps: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
    ...patch,
  };
}

describe('Fitness Shared Analytics & Hinglish Estimator', () => {
  it('computes true 7-day rolling weight average and weekly delta ignoring deleted/zero rows', () => {
    const logs: FitnessDailyLog[] = [
      makeDailyLog('2026-11-10', { weightKg: 76.0 }),
      makeDailyLog('2026-11-12', { weightKg: 75.6 }),
      makeDailyLog('2026-11-14', { weightKg: 75.2 }),
      makeDailyLog('2026-11-15', { weightKg: 70.0, deletedAt: nowIso }), // deleted, ignore
      makeDailyLog('2026-11-18', { weightKg: 74.8 }),
      makeDailyLog('2026-11-20', { weightKg: 74.4 }),
      makeDailyLog('2026-11-21', { weightKg: 0 }), // invalid non-positive
      makeDailyLog('2026-11-24', { weightKg: 74.0 }),
    ];

    const summary = calculate7DayRollingWeight(logs);
    expect(summary.points).toHaveLength(6);
    expect(summary.latestWeightKg).toBe(74.0);
    // Window [Nov 18 .. Nov 24] includes 74.8, 74.4, 74.0 => avg = 74.4
    expect(summary.latestRollingAvgKg).toBe(74.4);
    expect(summary.weeklyDeltaKg).toBeLessThan(0);
  });

  it('aggregates weekly waist trend keeping latest measurement per Monday week', () => {
    const logs: FitnessDailyLog[] = [
      makeDailyLog('2026-11-02', { waistInches: 34.0 }),
      makeDailyLog('2026-11-06', { waistInches: 33.8 }), // same week -> overrides 34.0
      makeDailyLog('2026-11-10', { waistInches: 33.5 }),
      makeDailyLog('2026-11-17', { waistInches: 33.0 }),
    ];

    const trend = calculateWeeklyWaistTrend(logs);
    expect(trend.points).toHaveLength(3);
    expect(trend.startingWaistInches).toBe(33.8);
    expect(trend.latestWaistInches).toBe(33.0);
    expect(trend.totalDeltaInches).toBe(-0.8);
  });

  const DAILY_FUEL_PROFILE: FitnessProfile = {
    id: 'p1',
    userId: 'u1',
    calorieTarget: 2000,
    proteinTargetG: 130,
    waterTargetMl: 3000,
    stepsTarget: 8000,
    sleepTargetHours: 7.5,
    activityLevel: 'moderate',
    goalType: 'fat_loss',
    dietPreference: 'non_veg',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const DAILY_FUEL_MEALS: MealLog[] = [
    {
      id: 'm1',
      userId: 'u1',
      date: '2026-11-24',
      mealType: 'breakfast',
      name: '4 Boiled Eggs',
      calories: 280,
      proteinG: 24,
      carbsG: 2,
      fatG: 20,
      quantityMultiplier: 1,
      isJunk: false,
      source: 'staple',
      loggedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'm2',
      userId: 'u1',
      date: '2026-11-24',
      mealType: 'snack',
      name: 'Momos',
      calories: 350,
      proteinG: 10,
      carbsG: 45,
      fatG: 14,
      quantityMultiplier: 1,
      isJunk: true,
      source: 'finance_bridge',
      loggedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'm3',
      userId: 'u1',
      date: '2026-11-23', // different day -> excluded
      mealType: 'dinner',
      name: 'Old Meal',
      calories: 999,
      proteinG: 50,
      carbsG: 10,
      fatG: 10,
      quantityMultiplier: 1,
      isJunk: false,
      source: 'manual',
      loggedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  function buildDailyFuelFixtures() {
    const todayLog = makeDailyLog('2026-11-24', {
      waterMl: 1500,
      steps: 6400,
      sleepHours: 7.5,
      energyLevel: 4,
    });
    return { profile: DAILY_FUEL_PROFILE, meals: DAILY_FUEL_MEALS, todayLog };
  }

  it('computes Daily Fuel summary for calories, protein, water, steps, junk count', () => {
    const { profile, meals, todayLog } = buildDailyFuelFixtures();

    const fuel = calculateDailyFuelSummary(meals, todayLog, profile, '2026-11-24');
    expect(fuel.caloriesConsumed).toBe(630);
    expect(fuel.caloriesRemaining).toBe(1370);
    expect(fuel.proteinConsumedG).toBe(34);
    expect(fuel.proteinRemainingG).toBe(96);
    expect(fuel.junkMealCount).toBe(1);
    expect(fuel.junkCalories).toBe(350);
    expect(fuel.waterPct).toBe(50);
    expect(fuel.stepsPct).toBe(80);
    expect(fuel.sleepHours).toBe(7.5);
    expect(fuel.energyLevel).toBe(4);
  });

  it('recommends progressive overload +2.5kg when working reps >= 10, else +1 rep', () => {
    const sessions: WorkoutSession[] = [
      {
        id: 'w1',
        userId: 'u1',
        date: '2026-11-20',
        title: 'Push A',
        workoutType: 'push',
        durationMinutes: 45,
        exercises: [
          {
            name: 'Bench Press',
            sets: [
              { weightKg: 40, reps: 10, isWarmup: true },
              { weightKg: 60, reps: 10 },
              { weightKg: 60, reps: 11 },
            ],
          },
          {
            name: 'Overhead Press',
            sets: [
              { weightKg: 35, reps: 7 },
              { weightKg: 35, reps: 8 },
            ],
          },
        ],
        source: 'manual',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    const benchHint = getProgressiveOverloadHint(sessions, 'bench press');
    expect(benchHint).not.toBeNull();
    expect(benchHint?.recommendedWeightKg).toBe(62.5);

    const ohpHint = getProgressiveOverloadHint(sessions, 'Overhead Press');
    expect(ohpHint?.recommendedWeightKg).toBe(35);
    expect(ohpHint?.recommendedReps).toBe(9);
  });

  it('evaluates supplement low stock, per-serving cost, and 30d ROI', () => {
    const inventory: SupplementInventory[] = [
      {
        id: 's1',
        userId: 'u1',
        name: 'Whey Isolate',
        category: 'protein',
        unitLabel: 'scoop',
        totalServings: 30,
        remainingServings: 5,
        dailyDosage: 1,
        costInr: 1500,
        lowStockThresholdDays: 7,
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    const logs: SupplementLog[] = Array.from({ length: 24 }, (_, idx) => ({
      id: `sl_${idx}`,
      userId: 'u1',
      supplementId: 's1',
      date: `2026-11-${String((idx % 24) + 1).padStart(2, '0')}`,
      servingsTaken: 1,
      takenAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    }));

    const res = calculateSupplementStockAndRoi(inventory, logs, '2026-11-24');
    expect(res.lowStockItems).toHaveLength(1);
    expect(res.items[0].derivedRemainingServings).toBe(6); // 30 total - 24 logs
    expect(res.items[0].daysRemaining).toBe(6);
    expect(res.items[0].costPerServingInr).toBe(50);
    expect(res.items[0].proteinPerServingG).toBe(24);
    expect(res.items[0].costPer25gProteinInr).toBe(52.08);
    expect(res.items[0].roiStatus).toBe('high');
  });

  it('derives supplement stock deterministically with manualAdjustment and deleted logs', () => {
    const sup: SupplementInventory = {
      id: 's_derived',
      userId: 'u1',
      name: 'Whey Concentrate',
      category: 'protein',
      unitLabel: 'scoop',
      totalServings: 30,
      remainingServings: 999, // stale field should be ignored by derived formula
      dailyDosage: 1,
      costInr: 1800,
      proteinPerServingG: 24,
      manualAdjustment: -2,
      lowStockThresholdDays: 7,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const logs: SupplementLog[] = [
      {
        id: 'l1',
        userId: 'u1',
        supplementId: 's_derived',
        date: '2026-11-22',
        servingsTaken: 1,
        takenAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'l2',
        userId: 'u1',
        supplementId: 's_derived',
        date: '2026-11-23',
        servingsTaken: 2,
        takenAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'l3_deleted',
        userId: 'u1',
        supplementId: 's_derived',
        date: '2026-11-24',
        servingsTaken: 5,
        takenAt: nowIso,
        deletedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    expect(deriveSupplementRemainingServings(sup, logs)).toBe(25); // 30 - (1 + 2) + (-2)
    expect(calculateCostPer25gProtein(60, 24)).toBe(62.5);
    expect(calculateCostPer25gProtein(0, 24)).toBeNull();
    expect(calculateCostPer25gProtein(60, null)).toBeNull();

    const roi = calculateSupplementStockAndRoi([sup], logs, '2026-11-24');
    const suppBenchmark = roi.proteinBenchmarks.find((b) => b.id === 's_derived');
    expect(suppBenchmark).toMatchObject({
      name: 'Whey Concentrate',
      isSupplement: true,
      costPer25gProteinInr: 62.5,
    });
    // Sorted ascending by ₹/25g protein
    for (let i = 1; i < roi.proteinBenchmarks.length; i++) {
      expect(roi.proteinBenchmarks[i].costPer25gProteinInr).toBeGreaterThanOrEqual(
        roi.proteinBenchmarks[i - 1].costPer25gProteinInr
      );
    }
  });

  it('adjusts calories ceiling & steps target in Low-Energy Mode while preserving protein target', () => {
    const profile: FitnessProfile = {
      id: 'p_le',
      userId: 'u1',
      calorieTarget: 1900,
      proteinTargetG: 140,
      waterTargetMl: 3000,
      stepsTarget: 9000,
      sleepTargetHours: 7.5,
      lowEnergyCalorieCeiling: 2250,
      lowEnergyStepsTarget: 3500,
      activityLevel: 'moderate',
      goalType: 'fat_loss',
      dietPreference: 'non_veg',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const lowEnergyLog = makeDailyLog('2026-11-24', {
      lowEnergyMode: true,
      steps: 3500,
    });

    const summary = calculateDailyFuelSummary([], lowEnergyLog, profile, '2026-11-24');
    expect(summary.lowEnergyMode).toBe(true);
    expect(summary.calorieTarget).toBe(2250);
    expect(summary.baseCalorieTarget).toBe(1900);
    expect(summary.stepsTarget).toBe(3500);
    expect(summary.stepsPct).toBe(100);
    expect(summary.proteinTargetG).toBe(140);
  });

  it('excludes currentSessionId and handles bodyweight progressive overload hints', () => {
    const sessions: WorkoutSession[] = [
      {
        id: 'w_current',
        userId: 'u1',
        date: '2026-11-24',
        title: 'Today',
        workoutType: 'push',
        durationMinutes: 45,
        exercises: [{ name: 'Push-Ups', sets: [{ weightKg: 0, reps: 20 }] }],
        source: 'manual',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'w_prev',
        userId: 'u1',
        date: '2026-11-21',
        title: 'Prev',
        workoutType: 'push',
        durationMinutes: 45,
        exercises: [{ name: 'Push-Ups', sets: [{ weightKg: 0, reps: 15 }] }],
        source: 'manual',
        createdAt: '2026-11-21T10:00:00.000Z',
        updatedAt: '2026-11-21T10:00:00.000Z',
      },
    ];

    const hint = getProgressiveOverloadHint(sessions, 'push-ups', 'w_current');
    expect(hint?.lastDate).toBe('2026-11-21');
    expect(hint?.recommendedWeightKg).toBe(0);
    expect(hint?.recommendedReps).toBe(16);
    expect(getProgressiveOverloadHint(sessions, 'NonExistent')).toBeNull();
  });

  it('matches Indian staple aliases with multipliers and estimates Hinglish junk food', () => {
    const templates: MealTemplate[] = STARTER_INDIAN_STAPLES.map((s, idx) => ({
      ...s,
      id: `tpl_${idx}`,
      userId: 'u1',
      order: idx,
      createdAt: nowIso,
      updatedAt: nowIso,
    }));

    const matchWhey = matchMealTemplate('2 scoops whey', templates);
    expect(matchWhey?.template.name).toBe('Whey Scoop');
    expect(matchWhey?.multiplier).toBe(2);

    const momoEst = estimateHinglishFoodMacros('momo', { amountInr: 60, forceJunk: true });
    expect(momoEst.calories).toBe(350);
    expect(momoEst.isJunk).toBe(true);

    const eggsEst = estimateHinglishFoodMacros('6 boiled eggs');
    expect(eggsEst.calories).toBe(420);
    expect(eggsEst.proteinG).toBe(36);
  });
});
