import { describe, it, expect } from 'vitest';
import { computeCrossDomainInsights } from '../cross-domain-insights';
import type {
  DebtRecord,
  FinanceCategory,
  FinanceTransaction,
  FitnessDailyLog,
  Habit,
  HabitCompletion,
  MealLog,
  MoodLog,
  SupplementInventory,
  SupplementLog,
  WorkoutSession,
} from '@/lib/types';

const nowIso = '2026-11-25T10:00:00.000Z';

function makeCat(id: string, name: string, slug: string): FinanceCategory {
  return {
    id,
    userId: 'u1',
    name,
    slug,
    type: 'expense',
    icon: 'Tag',
    color: '#000',
    monthlyBudgetLimit: 0,
    subcategories: [],
    order: 0,
    isSystem: false,
    archived: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function makeTx(
  id: string,
  date: string,
  amount: number,
  categoryId: string,
  title: string,
  extra: Partial<FinanceTransaction> = {}
): FinanceTransaction {
  return {
    id,
    userId: 'u1',
    title,
    amount,
    type: 'expense',
    categoryId,
    accountId: 'acc-upi',
    date,
    monthKey: date.slice(0, 7),
    tags: [],
    isRecurring: false,
    createdAt: nowIso,
    updatedAt: nowIso,
    ...extra,
  };
}

describe('Cross-Domain Intelligence Engine (computeCrossDomainInsights)', () => {
  it('handles completely empty inputs gracefully without NaN or alerts', () => {
    const report = computeCrossDomainInsights({ todayDate: '2026-11-25' });

    expect(report.todayDate).toBe('2026-11-25');
    expect(report.walletWaistline.spend14dInr).toBe(0);
    expect(report.walletWaistline.spend30dInr).toBe(0);
    expect(report.walletWaistline.fatLossDragKg30d).toBe(0);
    expect(report.gymSupplementRoi.gymRoiGrade).toBe('N/A');
    expect(report.triggers.overallSpendMultiplier).toBeNull();
    expect(report.socialSpendDiet.hasSpike).toBe(false);
    expect(report.alerts).toEqual([]);
  });

  it('computes Wallet <-> Waistline 14d/30d junk spend, linkedTransactionId deduped kcal, fat-loss drag & 70% savings', () => {
    const categories = [
      makeCat('cat-junk', 'Junk Food', 'junk-food'),
      makeCat('cat-food', 'Food & Dining', 'food-dining'),
    ];
    const transactions = [
      makeTx('tx-1', '2026-11-24', 350, 'cat-junk', 'Momos & Cold Drink'),
      makeTx('tx-2', '2026-11-18', 650, 'cat-junk', 'Pizza Night'),
      // Older than 14d (11..25 = 14d window [2026-11-12..2026-11-25]), inside 30d
      makeTx('tx-3', '2026-11-05', 1000, 'cat-junk', 'Burger Combo'),
      // Non-junk normal food should NOT count toward junk spend
      makeTx('tx-4', '2026-11-22', 200, 'cat-food', 'Boiled Eggs & Oats'),
    ];

    const mealLogs: MealLog[] = [
      {
        id: 'm1',
        userId: 'u1',
        date: '2026-11-24',
        mealType: 'snack',
        name: 'Momos & Cold Drink',
        calories: 700,
        proteinG: 10,
        carbsG: 90,
        fatG: 28,
        quantityMultiplier: 1,
        isJunk: true,
        linkedTransactionId: 'tx-1',
        source: 'finance_bridge',
        loggedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      // Duplicate bridge row sharing linkedTransactionId 'tx-1' MUST be deduped!
      {
        id: 'm1-dup',
        userId: 'u1',
        date: '2026-11-24',
        mealType: 'snack',
        name: 'Momos & Cold Drink (Dup)',
        calories: 700,
        proteinG: 10,
        carbsG: 90,
        fatG: 28,
        quantityMultiplier: 1,
        isJunk: true,
        linkedTransactionId: 'tx-1',
        source: 'finance_bridge',
        loggedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'm2',
        userId: 'u1',
        date: '2026-11-18',
        mealType: 'dinner',
        name: 'Pizza Night',
        calories: 1400,
        proteinG: 35,
        carbsG: 160,
        fatG: 65,
        quantityMultiplier: 1,
        isJunk: true,
        linkedTransactionId: 'tx-2',
        source: 'finance_bridge',
        loggedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'm3',
        userId: 'u1',
        date: '2026-11-05',
        mealType: 'lunch',
        name: 'Burger Combo',
        calories: 1750,
        proteinG: 28,
        carbsG: 190,
        fatG: 80,
        quantityMultiplier: 1,
        isJunk: true,
        linkedTransactionId: null,
        source: 'manual',
        loggedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    const report = computeCrossDomainInsights({
      todayDate: '2026-11-25',
      transactions,
      categories,
      mealLogs,
    });

    const ww = report.walletWaistline;
    expect(ww.spend14dInr).toBe(1000); // 350 + 650
    expect(ww.spend30dInr).toBe(2000); // 350 + 650 + 1000
    expect(ww.emptyKcal14d).toBe(2100); // 700 + 1400 (m1-dup ignored!)
    expect(ww.emptyKcal30d).toBe(3850); // 2100 + 1750
    expect(ww.fatLossDragKg30d).toBe(0.5); // 3850 / 7700 = 0.50 kg
    expect(ww.savings70PctMonthlyInr).toBe(1400); // 70% of 2000
    expect(ww.linkedIncidentCount14d).toBe(2); // tx-1 + tx-2
    expect(ww.linkedIncidentCount30d).toBe(4); // tx-1 + tx-2 + tx-3 + unlinked m3
    expect(ww.unlinkedJunkMealCount30d).toBe(1);
    expect(report.alerts.some((a) => a.pillar === 'wallet_waistline')).toBe(true);
  });

  it('audits Gym ROI (4x/week target & zero-workout F grade) and Supplement ₹/scoop + ₹/25g protein grade', () => {
    const categories = [makeCat('cat-health', 'Health & Gym', 'health-gym')];
    const transactions = [makeTx('tx-gym', '2026-11-02', 2400, 'cat-health', 'Cult Gym Monthly')];

    const supplementInventory: SupplementInventory[] = [
      {
        id: 'sup-whey',
        userId: 'u1',
        name: 'ON Gold Whey',
        category: 'protein',
        unitLabel: 'scoop',
        totalServings: 60,
        remainingServings: 50,
        dailyDosage: 1,
        costInr: 4800, // ₹80/scoop, 24g protein -> ₹83.33/25g -> Grade B
        proteinPerServingG: 24,
        manualAdjustment: 0,
        lowStockThresholdDays: 7,
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    const supplementLogs: SupplementLog[] = Array.from({ length: 24 }, (_, idx) => ({
      id: `sl-${idx}`,
      userId: 'u1',
      supplementId: 'sup-whey',
      date: `2026-11-${String(Math.min(25, idx + 1)).padStart(2, '0')}`,
      servingsTaken: 1,
      takenAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    }));

    // Case A: 0 workouts -> Grade F critical alert
    const zeroReport = computeCrossDomainInsights({
      todayDate: '2026-11-25',
      transactions,
      categories,
      supplementInventory,
      supplementLogs,
      workoutSessions: [],
    });
    expect(zeroReport.gymSupplementRoi.gymSpend30dInr).toBe(2400);
    expect(zeroReport.gymSupplementRoi.workouts30dCount).toBe(0);
    expect(zeroReport.gymSupplementRoi.gymRoiGrade).toBe('F');
    expect(zeroReport.gymSupplementRoi.targetGymCostPerWorkoutInr).toBe(150); // 2400 / 16
    expect(zeroReport.gymSupplementRoi.primaryCostPerScoopInr).toBe(80);
    expect(zeroReport.gymSupplementRoi.primaryCostPer25gProteinInr).toBe(83.33);
    expect(zeroReport.gymSupplementRoi.primaryProteinGrade).toBe('B');

    // Case B: 8 workouts -> ₹300/workout vs ₹150 target
    const workoutSessions: WorkoutSession[] = Array.from({ length: 8 }, (_, idx) => ({
      id: `w-${idx}`,
      userId: 'u1',
      date: `2026-11-${String(idx * 2 + 2).padStart(2, '0')}`,
      title: 'Push/Pull',
      workoutType: 'push',
      durationMinutes: 50,
      exercises: [],
      source: 'manual',
      createdAt: nowIso,
      updatedAt: nowIso,
    }));
    const activeReport = computeCrossDomainInsights({
      todayDate: '2026-11-25',
      transactions,
      categories,
      supplementInventory,
      supplementLogs,
      workoutSessions,
    });
    expect(activeReport.gymSupplementRoi.gymCostPerWorkoutInr).toBe(300);
    expect(activeReport.gymSupplementRoi.gymRoiGrade).toBe('C');
  });

  it('detects sleep/energy/mood/missed-workout triggers vs same-day Junk & idk spend multiplier', () => {
    const categories = [
      makeCat('cat-junk', 'Junk Food', 'junk-food'),
      makeCat('cat-misc', 'Misc', 'misc'),
    ];
    const fitnessDailyLogs: FitnessDailyLog[] = [
      { id: 'f1', userId: 'u1', date: '2026-11-20', sleepHours: 5.5, energyLevel: 2, waterMl: 2000, steps: 4000, createdAt: nowIso, updatedAt: nowIso },
      { id: 'f2', userId: 'u1', date: '2026-11-21', sleepHours: 5.8, energyLevel: 3, waterMl: 2200, steps: 5000, createdAt: nowIso, updatedAt: nowIso },
      { id: 'f3', userId: 'u1', date: '2026-11-22', sleepHours: 8.0, energyLevel: 4, waterMl: 3000, steps: 9000, createdAt: nowIso, updatedAt: nowIso },
      { id: 'f4', userId: 'u1', date: '2026-11-23', sleepHours: 7.8, energyLevel: 5, waterMl: 3000, steps: 9500, createdAt: nowIso, updatedAt: nowIso },
    ];
    const moodLogs: MoodLog[] = [
      { id: 'mo1', userId: 'u1', date: '2026-11-21', mood: 'stressed' },
      { id: 'mo2', userId: 'u1', date: '2026-11-22', mood: 'happy' },
    ];
    const habits: Habit[] = [
      {
        id: 'h-gym',
        userId: 'u1',
        name: 'Evening Gym Workout',
        category: 'health',
        targetDaysPerWeek: 7,
        createdAt: '2026-11-01',
        archived: false,
        order: 0,
      },
    ];
    const habitCompletions: HabitCompletion[] = [
      { id: 'c1', userId: 'u1', habitId: 'h-gym', date: '2026-11-20', completed: false, status: 'missed' },
      { id: 'c2', userId: 'u1', habitId: 'h-gym', date: '2026-11-21', completed: false, status: 'missed' },
      { id: 'c3', userId: 'u1', habitId: 'h-gym', date: '2026-11-22', completed: true, status: 'completed' },
      { id: 'c4', userId: 'u1', habitId: 'h-gym', date: '2026-11-23', completed: true, status: 'completed' },
    ];
    const transactions = [
      // Trigger days: 20th & 21st -> ₹600 + ₹400 = ₹1000 total (avg ₹500/day)
      makeTx('tx-t1', '2026-11-20', 600, 'cat-junk', 'Late night Swiggy junk'),
      makeTx('tx-t2', '2026-11-21', 400, 'cat-misc', 'idk random snack'),
      // Baseline days: 22nd & 23rd -> ₹200 + ₹0 = ₹200 total (avg ₹100/day)
      makeTx('tx-b1', '2026-11-22', 200, 'cat-junk', 'Ice cream'),
    ];

    const report = computeCrossDomainInsights({
      todayDate: '2026-11-25',
      categories,
      transactions,
      fitnessDailyLogs,
      moodLogs,
      habits,
      habitCompletions,
    });

    expect(report.triggers.triggerDaysCount).toBe(2);
    expect(report.triggers.nonTriggerDaysCount).toBe(2);
    expect(report.triggers.triggerAvgDailySpendInr).toBe(500);
    expect(report.triggers.baselineAvgDailySpendInr).toBe(100);
    expect(report.triggers.overallSpendMultiplier).toBe(5);
    expect(report.alerts.some((a) => a.pillar === 'trigger_pattern')).toBe(true);
  });

  it('correlates social split food hangouts with calorie spikes and suggests swaps', () => {
    const categories = [makeCat('cat-food', 'Food & Dining', 'food-dining')];
    const debtRecords: DebtRecord[] = [
      {
        id: 'd-split',
        userId: 'u1',
        personName: 'Rohan',
        direction: 'lent',
        title: 'Cafe pizza split',
        principalAmount: 600,
        totalRepaidAmount: 0,
        remainingAmount: 600,
        startDate: '2026-11-24',
        repaymentSchedule: 'flexible',
        status: 'active',
        bucketType: 'everyday_split',
        color: '#000',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];
    const transactions = [
      makeTx('tx-social', '2026-11-24', 900, 'cat-food', 'Group cafe dinner', {
        splitGroupId: 'split-1',
        linkedDebtId: 'd-split',
      }),
      makeTx('tx-solo', '2026-11-23', 180, 'cat-food', 'Solo chicken bowl'),
    ];
    const mealLogs: MealLog[] = [
      {
        id: 'ms1',
        userId: 'u1',
        date: '2026-11-24',
        mealType: 'dinner',
        name: 'Cafe pizza & shake',
        calories: 1900,
        proteinG: 35,
        carbsG: 200,
        fatG: 80,
        quantityMultiplier: 1,
        isJunk: true,
        source: 'manual',
        loggedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'ms2',
        userId: 'u1',
        date: '2026-11-23',
        mealType: 'dinner',
        name: 'Chicken rice bowl',
        calories: 650,
        proteinG: 45,
        carbsG: 70,
        fatG: 15,
        quantityMultiplier: 1,
        isJunk: false,
        source: 'manual',
        loggedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    const report = computeCrossDomainInsights({
      todayDate: '2026-11-25',
      categories,
      debtRecords,
      transactions,
      mealLogs,
    });

    expect(report.socialSpendDiet.hasSpike).toBe(true);
    expect(report.socialSpendDiet.socialFoodSpend30dInr).toBe(900);
    expect(report.socialSpendDiet.hangoutSpendMultiplier).toBe(5); // 900 vs 180
    expect(report.socialSpendDiet.hangoutCalorieSpikeKcal).toBe(1250); // 1900 - 650
    expect(report.socialSpendDiet.suggestedSwaps.length).toBeGreaterThan(0);
    expect(report.alerts.some((a) => a.pillar === 'social_spend_diet')).toBe(true);
  });

  it('excludes friend-share split debt legs and unlinked mirror everyday_split debts from double/triple counting', () => {
    const categories = [
      makeCat('cat-junk', 'Junk Food', 'junk-food'),
      makeCat('cat-debt', 'Debt & Lending', 'debt-lending'),
    ];
    const transactions = [
      // Mirrors splitTransactionWithFriend(): user share + friend-share debt leg sharing splitGroupId & tags
      makeTx('tx-user-share', '2026-11-24', 500, 'cat-junk', 'Pizza Hut Split', {
        splitGroupId: 'split-grp-1',
        tags: ['split', 'Rahul', 'junk'],
      }),
      makeTx('tx-friend-leg', '2026-11-24', 500, 'cat-debt', 'Pizza Hut Split', {
        subcategory: 'Friend Split',
        splitGroupId: 'split-grp-1',
        tags: ['split', 'Rahul', 'junk', 'friend-share'],
      }),
    ];
    const debtRecords: DebtRecord[] = [
      {
        id: 'd-split-unlinked',
        userId: 'u1',
        personName: 'Rahul',
        direction: 'lent',
        title: 'Everyday Split: Pizza Hut Split',
        principalAmount: 500,
        totalRepaidAmount: 0,
        remainingAmount: 500,
        startDate: '2026-11-24',
        repaymentSchedule: 'flexible',
        status: 'active',
        bucketType: 'everyday_split',
        color: '#000',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    const report = computeCrossDomainInsights({
      todayDate: '2026-11-25',
      categories,
      transactions,
      debtRecords,
    });

    expect(report.walletWaistline.spend14dInr).toBe(500);
    expect(report.socialSpendDiet.socialFoodEventCount30d).toBe(1);
    expect(report.socialSpendDiet.socialFoodSpend30dInr).toBe(500);
  });

  it('does not falsely mark today unlogged or rested workout habits as missed-workout triggers', () => {
    const categories = [makeCat('cat-junk', 'Junk Food', 'junk-food')];
    const habits: Habit[] = [
      {
        id: 'h-gym',
        userId: 'u1',
        name: 'Evening Gym Workout',
        category: 'health',
        targetDaysPerWeek: 7,
        createdAt: '2026-11-01',
        archived: false,
        order: 0,
      },
    ];
    const fitnessDailyLogs: FitnessDailyLog[] = [
      {
        id: 'fd-rest',
        userId: 'u1',
        date: '2026-11-24',
        sleepHours: 7.5,
        energyLevel: 3,
        waterMl: 3000,
        steps: 6000,
        restedHabitIds: ['h-gym'],
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];
    const habitCompletions: HabitCompletion[] = [
      {
        id: 'c-prev',
        userId: 'u1',
        habitId: 'h-gym',
        date: '2026-11-23',
        completed: true,
        status: 'completed',
      },
    ];
    const transactions = [makeTx('tx-today', '2026-11-25', 300, 'cat-junk', 'Evening snack')];

    const report = computeCrossDomainInsights({
      todayDate: '2026-11-25',
      categories,
      habits,
      habitCompletions,
      fitnessDailyLogs,
      transactions,
    });

    expect(report.triggers.triggerDaysCount).toBe(0);
  });
});
