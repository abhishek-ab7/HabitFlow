import { beforeEach, describe, expect, it } from 'vitest';
import { buildCashFlowForecast } from '@/lib/finance/forecast';
import {
  parsePaydayFromNotes,
  resolveEffectivePaydayOfMonth,
  stripPaydayNoteTag,
  upsertPaydayNoteTag,
} from '@/lib/finance/payday';
import { calculateCurrentStreak, getHabitWeekProgress } from '@/lib/calculations';
import { db } from '@/lib/db';
import { useFitnessStore } from '@/lib/stores/fitness';
import { useHabitStore } from '@/lib/stores/habit-store';
import {
  buildAutoMealSupplementNoteTag,
  hasAutoMealSupplementLog,
  matchExpenseToSupplement,
  matchProteinMealToSupplement,
} from '../supplement-meal-bridge';
import {
  findBestMealTransactionMatch,
  findBestTransactionMealMatch,
} from '../meal-finance-matcher';
import { computeCrossDomainInsights } from '@/lib/intelligence/cross-domain-insights';
import type {
  CreditCardStatement,
  EmiTracker,
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceTransaction,
  Habit,
  HabitCompletion,
  MealLog,
  SupplementInventory,
} from '@/lib/types';

describe('Cross-Domain Interconnection Fixes (Client & Domain Engines)', () => {
  const nowIso = '2026-11-25T10:00:00.000Z';

  describe('Bug 1: Persisted paydayOfMonth in buildCashFlowForecast', () => {
    function buildPaydayForecastInputs() {
      const bank: FinanceAccount = {
        id: 'acc-hdfc', userId: 'u1', name: 'HDFC Bank', type: 'bank', balance: 3000, currency: 'INR',
        color: '#10b981', icon: 'Landmark', isDefault: true, archived: false, createdAt: nowIso, updatedAt: nowIso,
      };
      const budget: FinanceBudget = {
        id: 'b-nov', userId: 'u1', monthKey: '2026-11', totalBudget: 15000, expectedIncome: 19000,
        paydayOfMonth: 7, currency: 'INR', createdAt: nowIso, updatedAt: nowIso,
      };
      const emi: EmiTracker = {
        id: 'emi-1', userId: 'u1', loanName: 'Phone EMI', lenderName: 'Bajaj', principalAmount: 12000,
        interestRateAnnual: 0, emiAmount: 2000, tenureMonths: 6, paidMonths: 1, startDate: '2026-10-03',
        billingDayOfMonth: 3, categoryId: 'cat-emi', autoCreateTaskReminder: false, status: 'active',
        createdAt: nowIso, updatedAt: nowIso,
      };
      const ccStmt: CreditCardStatement = {
        id: 'cc-1_2026-11', userId: 'u1', accountId: 'acc-cc', cycleKey: '2026-11',
        periodStart: '2026-10-21', periodEnd: '2026-11-20', dueDate: '2026-12-05',
        calculatedAmount: 5000, manualAdjustment: 0, totalDue: 5000, carriedForwardAmount: 0,
        paidAmount: 0, remainingDue: 5000, status: 'billed', createdAt: nowIso, updatedAt: nowIso,
      };
      return { bank, budget, emi, ccStmt };
    }

    it('shifts salary inflow to saved paydayOfMonth (7th) and exposes Dec 3-5 cash crunch', () => {
      const { bank, budget, emi, ccStmt } = buildPaydayForecastInputs();
      const forecast = buildCashFlowForecast({
        accounts: [bank], transactions: [], budgets: [budget], recurringBills: [], emiTrackers: [emi],
        sipPlans: [], commitments: [], creditCardStatements: [ccStmt], horizonDays: 30,
        includeDiscretionaryBurn: false, referenceDate: '2026-11-28',
      });

      expect(forecast.paydayOfMonth).toBe(7);
      expect(forecast.estimatedMonthlyIncome).toBe(19000);
      const dec1 = forecast.points.find((p) => p.dateStr === '2026-12-01');
      const dec5 = forecast.points.find((p) => p.dateStr === '2026-12-05');
      const dec7 = forecast.points.find((p) => p.dateStr === '2026-12-07');
      expect(dec1?.scheduledInflow).toBe(0);
      expect(dec5?.projectedBalance).toBe(-4000);
      expect(forecast.crunchDate).toBe('2026-12-05');
      expect(dec7?.scheduledInflow).toBe(19000);
      expect(dec7?.projectedBalance).toBe(15000);
    });

    it('clamps paydayOfMonth 31 to month length in February and supports note-tag fallback', () => {
      const tagged = upsertPaydayNoteTag('Salary cycle', 31);
      expect(parsePaydayFromNotes(tagged)).toBe(31);
      expect(stripPaydayNoteTag(tagged)).toBe('Salary cycle');

      const budgetWithTag: FinanceBudget = {
        id: 'b-feb',
        userId: 'u1',
        monthKey: '2027-02',
        totalBudget: 10000,
        expectedIncome: 20000,
        notes: tagged,
        currency: 'INR',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      expect(resolveEffectivePaydayOfMonth([budgetWithTag], '2027-02')).toBe(31);

      const forecast = buildCashFlowForecast({
        accounts: [
          {
            id: 'acc-1',
            userId: 'u1',
            name: 'Bank',
            type: 'bank',
            balance: 1000,
            currency: 'INR',
            color: '#10b981',
            icon: 'Landmark',
            isDefault: true,
            archived: false,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
        ],
        transactions: [],
        budgets: [budgetWithTag],
        recurringBills: [],
        emiTrackers: [],
        sipPlans: [],
        commitments: [],
        horizonDays: 30,
        includeDiscretionaryBurn: false,
        referenceDate: '2027-02-15',
      });

      const feb28 = forecast.points.find((p) => p.dateStr === '2027-02-28');
      expect(feb28?.scheduledInflow).toBe(20000);
    });
  });

  describe('Bug 2: Low-Energy Mode rest completions & streak protection', () => {
    beforeEach(async () => {
      useFitnessStore.getState().clearFitnessState();
      await Promise.all([
        db.fitnessDailyLogs.clear(),
        db.habits.clear(),
        db.completions.clear(),
      ]);
      useHabitStore.setState({ habits: [], completions: [] });
    });

    async function seedLowEnergyHabitFixtures() {
      const gymHabit: Habit = {
        id: 'hab-gym-1', userId: 'u1', name: 'Gym Workout', icon: 'Dumbbell', category: 'health',
        targetDaysPerWeek: 4, frequencyType: 'weekly_flexible', anchorBlock: 'gym',
        autoTrackRule: 'workout_logged', polarity: 'build', archived: false, order: 0,
        createdAt: '2026-11-01T00:00:00.000Z', updatedAt: nowIso,
      };
      const walkHabit: Habit = {
        id: 'hab-walk-1', userId: 'u1', name: 'Morning Walk', icon: 'Footprints', category: 'health',
        targetDaysPerWeek: 7, frequencyType: 'daily', anchorBlock: 'gym', polarity: 'build',
        archived: false, order: 1, createdAt: '2026-11-01T00:00:00.000Z', updatedAt: nowIso,
      };
      await db.habits.bulkPut([gymHabit, walkHabit]);
      const walkDone: HabitCompletion = {
        id: 'comp-walk-today', userId: 'u1', habitId: walkHabit.id, date: '2026-11-25',
        completed: true, status: 'completed', generationCounter: 1, updatedAt: nowIso,
      };
      const gymPrev: HabitCompletion = {
        id: 'comp-gym-prev', userId: 'u1', habitId: gymHabit.id, date: '2026-11-24',
        completed: true, status: 'completed', generationCounter: 1, updatedAt: nowIso,
      };
      await db.completions.bulkPut([walkDone, gymPrev]);
      useHabitStore.setState({ habits: [gymHabit, walkHabit], completions: [walkDone, gymPrev] });
      return { gymHabit, walkHabit };
    }

    it('preserves streaks and reports isRestedToday for explicit Low-Energy rest days, and reverts only auto-rested rows', async () => {
      const { gymHabit, walkHabit } = await seedLowEnergyHabitFixtures();

      const onRes = await useFitnessStore.getState().toggleLowEnergyMode('2026-11-25', true, 'u1');
      expect(onRes.lowEnergyMode).toBe(true);
      expect(onRes.restedHabitIds).toEqual([gymHabit.id]);

      const gymComps = useHabitStore.getState().completions.filter((c) => c.habitId === gymHabit.id);
      const refDate = new Date('2026-11-25T10:00:00');
      const weekProg = getHabitWeekProgress(gymHabit, gymComps, refDate);
      expect(weekProg.isRestedToday).toBe(true);
      expect(weekProg.isSettledToday).toBe(true);
      expect(calculateCurrentStreak(gymComps, refDate, gymHabit)).toBe(1);

      const offRes = await useFitnessStore.getState().toggleLowEnergyMode('2026-11-25', false, 'u1');
      expect(offRes.lowEnergyMode).toBe(false);
      expect(offRes.restedHabitIds).toEqual([]);

      const afterGymToday = useHabitStore.getState().completions.find((c) => c.habitId === gymHabit.id && c.date === '2026-11-25');
      expect(afterGymToday?.status).toBeUndefined();
      expect(afterGymToday?.skipped).toBe(false);

      const afterWalkToday = useHabitStore.getState().completions.find((c) => c.habitId === walkHabit.id && c.date === '2026-11-25');
      expect(afterWalkToday?.completed).toBe(true);
      expect(afterWalkToday?.status).toBe('completed');
    });
  });

  describe('Bug 3: Daily weigh-ins auto-sync to fitness_profile.currentWeightKg', () => {
    beforeEach(async () => {
      useFitnessStore.getState().clearFitnessState();
      await Promise.all([db.fitnessProfiles.clear(), db.fitnessDailyLogs.clear()]);
    });

    it('updates profile.currentWeightKg for latest date and ignores older historical backfills', async () => {
      await useFitnessStore.getState().upsertProfile(
        {
          currentWeightKg: 66.0,
          targetWeightKg: 62.0,
          calorieTarget: 2000,
          proteinTargetG: 140,
        },
        'u1'
      );
      const initialGen = useFitnessStore.getState().profile!.generationCounter || 1;

      await useFitnessStore.getState().upsertDailyLog('2026-11-25', { weightKg: 69.6 }, 'u1');
      expect(useFitnessStore.getState().profile?.currentWeightKg).toBe(69.6);
      expect(useFitnessStore.getState().profile?.generationCounter).toBeGreaterThan(initialGen);

      // Historical backfill on an earlier date must NOT overwrite 69.6
      await useFitnessStore.getState().upsertDailyLog('2026-11-20', { weightKg: 67.2 }, 'u1');
      expect(useFitnessStore.getState().profile?.currentWeightKg).toBe(69.6);
    });
  });

  describe('Bug 4: Protein meal -> supplement deduction & expense -> supplement matchers', () => {
    const nutrabox: SupplementInventory = {
      id: 'sup-nutra',
      userId: 'u1',
      name: 'Soy Protein Isolate',
      brand: 'NutraBox',
      category: 'protein',
      unitLabel: 'scoop',
      totalServings: 30,
      remainingServings: 30,
      dailyDosage: 1,
      costInr: 0,
      proteinPerServingG: 27,
      lowStockThresholdDays: 5,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const creatine: SupplementInventory = {
      id: 'sup-crea',
      userId: 'u1',
      name: 'Creatine Monohydrate',
      brand: 'Wellcore',
      category: 'creatine',
      unitLabel: 'scoop',
      totalServings: 33,
      remainingServings: 33,
      dailyDosage: 1,
      costInr: 0,
      lowStockThresholdDays: 5,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    beforeEach(async () => {
      useFitnessStore.getState().clearFitnessState();
      await Promise.all([
        db.supplementInventory.clear(),
        db.supplementLogs.clear(),
        db.mealLogs.clear(),
      ]);
      await db.supplementInventory.bulkPut([nutrabox, creatine]);
      useFitnessStore.setState({
        supplementInventory: [nutrabox, creatine],
        supplementLogs: [],
        mealLogs: [],
        currentUserId: 'u1',
      });
    });

    it('matches protein supplement meals cleanly and ignores regular whole foods', () => {
      const m1 = matchProteinMealToSupplement(
        { name: 'Nutrabox Soy Protein Isolate (1 scoop, 34g)', quantityMultiplier: 1 },
        [nutrabox, creatine]
      );
      expect(m1?.supplement.id).toBe('sup-nutra');
      expect(m1?.servings).toBe(1);

      expect(
        matchProteinMealToSupplement({ name: '2 Guavas' }, [nutrabox, creatine])
      ).toBeNull();
      expect(
        matchProteinMealToSupplement({ name: 'Milk Tea' }, [nutrabox, creatine])
      ).toBeNull();
      expect(
        matchProteinMealToSupplement({ name: '6 Boiled Eggs' }, [nutrabox, creatine])
      ).toBeNull();
    });

    it('auto-deducts supplement inventory once per protein meal log in fitness-store', async () => {
      const loggedMeal = await useFitnessStore.getState().addMealLog(
        {
          date: '2026-11-25',
          name: 'Nutrabox Soy Protein Isolate (1 scoop, 34g)',
          calories: 128,
          proteinG: 30,
          carbsG: 1,
          fatG: 0.5,
          mealType: 'post_workout',
          quantityMultiplier: 1.5,
          isJunk: false,
        },
        'u1'
      );

      const supState = useFitnessStore.getState();
      expect(supState.supplementLogs).toHaveLength(1);
      expect(supState.supplementLogs[0].servingsTaken).toBe(1.5);
      expect(supState.supplementLogs[0].notes).toContain(
        buildAutoMealSupplementNoteTag(loggedMeal.id)
      );
      expect(
        supState.supplementInventory.find((s) => s.id === 'sup-nutra')?.remainingServings
      ).toBe(28.5);
      expect(
        hasAutoMealSupplementLog(supState.supplementLogs, loggedMeal.id, 'sup-nutra')
      ).toBe(true);
    });

    it('matches Health & Supplements finance expenses to active supplements', () => {
      expect(
        matchExpenseToSupplement({ title: 'NutraBox Soy Protein Refill' }, [nutrabox, creatine])?.id
      ).toBe('sup-nutra');
      expect(
        matchExpenseToSupplement({ title: 'Creatine Monohydrate 100g' }, [nutrabox, creatine])?.id
      ).toBe('sup-crea');
      expect(
        matchExpenseToSupplement({ title: 'Uber Ride' }, [nutrabox, creatine])
      ).toBeNull();
    });
  });

  describe('Bug 5: Meals <-> Finance matcher & Wallet-Waistline deduplication', () => {
    const categories: FinanceCategory[] = [
      {
        id: 'cat-junk',
        userId: 'u1',
        name: 'Junk Food',
        slug: 'junk-food',
        type: 'expense',
        icon: 'Flame',
        color: '#f43f5e',
        subcategories: [],
        monthlyBudgetLimit: 0,
        order: 0,
        isSystem: true,
        archived: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'cat-food',
        userId: 'u1',
        name: 'Food & Dining',
        slug: 'food-dining',
        type: 'expense',
        icon: 'Utensils',
        color: '#f97316',
        subcategories: [],
        monthlyBudgetLimit: 0,
        order: 1,
        isSystem: true,
        archived: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'cat-sup',
        userId: 'u1',
        name: 'Health & Supplements',
        slug: 'medical-supplements',
        type: 'expense',
        icon: 'Pill',
        color: '#06b6d4',
        subcategories: [],
        monthlyBudgetLimit: 0,
        order: 2,
        isSystem: true,
        archived: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    function buildSameDayMatchFixtures() {
      const txPizza: FinanceTransaction = {
        id: 'tx-pizza',
        userId: 'u1',
        title: "Domino's Pizza",
        merchantName: "Domino's Pizza",
        amount: 349,
        type: 'expense',
        categoryId: 'cat-junk',
        accountId: 'acc-1',
        date: '2026-11-25',
        monthKey: '2026-11',
        tags: [],
        isRecurring: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const txSup: FinanceTransaction = {
        id: 'tx-sup',
        userId: 'u1',
        title: 'Pizza Protein Supplement',
        amount: 999,
        type: 'expense',
        categoryId: 'cat-sup',
        accountId: 'acc-1',
        date: '2026-11-25',
        monthKey: '2026-11',
        tags: [],
        isRecurring: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const txOldDay: FinanceTransaction = { ...txPizza, id: 'tx-old', date: '2026-11-24' };
      const mealPizza: MealLog = {
        id: 'meal-pizza',
        userId: 'u1',
        date: '2026-11-25',
        mealType: 'dinner',
        name: 'Pizza (2 slices)',
        calories: 560,
        proteinG: 20,
        carbsG: 68,
        fatG: 22,
        quantityMultiplier: 1,
        isJunk: true,
        source: 'manual',
        loggedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      return { txPizza, txSup, txOldDay, mealPizza };
    }

    it('matches same-day food/junk expenses to unlinked meals and rejects cross-day or non-food expenses', () => {
      const { txPizza, txSup, txOldDay, mealPizza } = buildSameDayMatchFixtures();

      const best = findBestMealTransactionMatch(
        mealPizza,
        [txSup, txOldDay, txPizza],
        [mealPizza],
        categories
      );
      expect(best?.transaction.id).toBe('tx-pizza');
      expect(best?.confidence).toBe('high');

      // Reverse lookup via aliases ("Tea" <-> "Chai")
      const mealChai: MealLog = {
        ...mealPizza,
        id: 'meal-chai',
        name: 'Tea & Biscuits',
        isJunk: true,
      };
      const txChai: FinanceTransaction = {
        ...txPizza,
        id: 'tx-chai',
        title: 'Tapri Chai',
        merchantName: 'Tapri Chai',
        amount: 30,
        categoryId: 'cat-food',
      };
      const rev = findBestTransactionMealMatch(txChai, [mealChai], categories);
      expect(rev?.meal.id).toBe('meal-chai');
      expect(rev?.confidence).toBe('high');

      // Does not match when transaction is in Health & Supplements
      expect(findBestTransactionMealMatch(txSup, [mealPizza], categories)).toBeNull();
    });

    it('never double-counts linked junk meal + transaction in walletWaistline', () => {
      const linkedTx: FinanceTransaction = {
        id: 'tx-j1',
        userId: 'u1',
        title: 'Momos Plate',
        amount: 80,
        type: 'expense',
        categoryId: 'cat-junk',
        accountId: 'acc-1',
        date: '2026-11-25',
        monthKey: '2026-11',
        tags: [],
        isRecurring: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const linkedMeal: MealLog = {
        id: 'm-j1',
        userId: 'u1',
        date: '2026-11-25',
        mealType: 'snack',
        name: 'Steamed Momos',
        calories: 320,
        proteinG: 10,
        carbsG: 42,
        fatG: 12,
        quantityMultiplier: 1,
        isJunk: true,
        linkedTransactionId: 'tx-j1',
        source: 'manual',
        loggedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const insights = computeCrossDomainInsights({
        todayDate: '2026-11-25',
        transactions: [linkedTx],
        categories,
        mealLogs: [linkedMeal],
      });

      expect(insights.walletWaistline.spend30dInr).toBe(80);
      expect(insights.walletWaistline.emptyKcal30d).toBe(320);
      expect(insights.walletWaistline.linkedIncidentCount30d).toBe(1);
      expect(insights.walletWaistline.unlinkedJunkMealCount30d).toBe(0);
    });
  });
});
