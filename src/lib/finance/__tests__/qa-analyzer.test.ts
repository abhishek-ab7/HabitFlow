import { describe, it, expect } from 'vitest';
import { buildFinanceQAContext } from '../anomalies';
import { buildDeterministicFinanceAnswer } from '../qa-analyzer';
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceTransaction,
  FitnessDailyLog,
  MealLog,
  MonthlyFinanceSummary,
  NetWorthSummary,
  SupplementInventory,
  SupplementLog,
  WorkoutSession,
} from '@/lib/types';

const nowIso = '2026-11-25T10:00:00.000Z';

const baseSummary: MonthlyFinanceSummary = {
  monthKey: '2026-11',
  totalIncome: 80000,
  totalSpent: 24000,
  totalInvested: 15000,
  monthlyBudget: 35000,
  expectedIncome: 80000,
  safeToSpendMonthly: 9000,
  safeToSpendDaily: 1800,
  remainingDaysInMonth: 5,
  dayOfMonthProgressPct: 83,
  savingsRate: 48,
  netSavings: 41000,
  remainingUnpaidBills: 0,
  remainingUnpaidEmis: 0,
  remainingUnpaidCommitments: 0,
  plannedDebtInstallmentsDue: 0,
  remainingPlannedSips: 0,
  needsReviewCount: 0,
  categoryBreakdown: [],
};

const baseNetWorth: NetWorthSummary = {
  liquidAssets: 95000,
  investmentAssets: 250000,
  friendReceivables: 0,
  totalAssets: 345000,
  creditCardLiabilities: 5000,
  emiRemainingPrincipal: 0,
  friendPayables: 0,
  totalLiabilities: 5000,
  netWorth: 340000,
};

describe('Ask Life OS (buildFinanceQAContext & buildDeterministicFinanceAnswer)', () => {
  const categories: FinanceCategory[] = [
    {
      id: 'cat-junk',
      userId: 'u1',
      name: 'Junk Food',
      slug: 'junk-food',
      type: 'expense',
      icon: 'Pizza',
      color: '#f43f5e',
      monthlyBudgetLimit: 1500,
      subcategories: [],
      order: 0,
      isSystem: false,
      archived: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'cat-gym',
      userId: 'u1',
      name: 'Health & Gym',
      slug: 'health-gym',
      type: 'expense',
      icon: 'Dumbbell',
      color: '#10b981',
      monthlyBudgetLimit: 3000,
      subcategories: [],
      order: 1,
      isSystem: false,
      archived: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const accounts: FinanceAccount[] = [
    {
      id: 'acc-upi',
      userId: 'u1',
      name: 'HDFC UPI',
      type: 'bank',
      balance: 95000,
      currency: 'INR',
      color: '#10b981',
      icon: 'Wallet',
      isDefault: true,
      archived: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const transactions: FinanceTransaction[] = [
    {
      id: 'tx-gym',
      userId: 'u1',
      title: 'Gold Gym Membership',
      amount: 2000,
      type: 'expense',
      categoryId: 'cat-gym',
      accountId: 'acc-upi',
      date: '2026-11-01',
      monthKey: '2026-11',
      tags: [],
      isRecurring: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'tx-junk',
      userId: 'u1',
      title: 'Midnight Momos & Fries',
      amount: 600,
      type: 'expense',
      categoryId: 'cat-junk',
      accountId: 'acc-upi',
      date: '2026-11-20',
      monthKey: '2026-11',
      tags: [],
      isRecurring: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const supplementInventory: SupplementInventory[] = [
    {
      id: 'sup-whey',
      userId: 'u1',
      name: 'Myprotein Impact Whey',
      category: 'protein',
      unitLabel: 'scoop',
      totalServings: 40,
      remainingServings: 12,
      dailyDosage: 1,
      costInr: 3200, // 80/scoop, 20g -> 100/25g -> C
      proteinPerServingG: 20,
      manualAdjustment: -28,
      lowStockThresholdDays: 7,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const supplementLogs: SupplementLog[] = [];
  const mealLogs: MealLog[] = [
    {
      id: 'meal-j1',
      userId: 'u1',
      date: '2026-11-20',
      mealType: 'snack',
      name: 'Momos & Fries',
      calories: 1540,
      proteinG: 20,
      carbsG: 170,
      fatG: 75,
      quantityMultiplier: 1,
      isJunk: true,
      linkedTransactionId: 'tx-junk',
      source: 'finance_bridge',
      loggedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
  const fitnessDailyLogs: FitnessDailyLog[] = [
    {
      id: 'fd-1',
      userId: 'u1',
      date: '2026-11-20',
      sleepHours: 5.5,
      energyLevel: 2,
      waterMl: 2000,
      steps: 4500,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'fd-2',
      userId: 'u1',
      date: '2026-11-21',
      sleepHours: 8,
      energyLevel: 4,
      waterMl: 3000,
      steps: 9000,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
  const workoutSessions: WorkoutSession[] = Array.from({ length: 10 }, (_, idx) => ({
    id: `wk-${idx}`,
    userId: 'u1',
    date: `2026-11-${String(idx + 2).padStart(2, '0')}`,
    title: 'Strength',
    workoutType: 'strength',
    durationMinutes: 50,
    exercises: [],
    source: 'manual',
    createdAt: nowIso,
    updatedAt: nowIso,
  }));

  const context = buildFinanceQAContext({
    selectedMonth: '2026-11',
    summary: baseSummary,
    netWorth: baseNetWorth,
    transactions,
    categories,
    accounts,
    recurringBills: [],
    emiTrackers: [],
    sipPlans: [],
    debtRecords: [],
    anomalies: [],
    fitness: {
      todayDate: '2026-11-25',
      fitnessDailyLogs,
      mealLogs,
      workoutSessions,
      supplementInventory,
      supplementLogs,
    },
  });

  it('answers whey/supplement ROI queries accurately with ₹/scoop and ₹/25g protein grade', () => {
    const ans = buildDeterministicFinanceAnswer('What is my whey supplement ROI?', context);
    expect(ans).toContain('Myprotein Impact Whey');
    expect(ans).toContain('₹80');
    expect(ans).toContain('₹100/25g protein');
    expect(ans).toContain('12d stock left');
  });

  it('answers gym ROI queries accurately against 4x/week target', () => {
    const ans = buildDeterministicFinanceAnswer('What is my gym workout ROI this month?', context);
    expect(ans).toContain('₹200/workout'); // 2000 / 10
    expect(ans).toContain('₹125/workout'); // 2000 / 16
    expect(ans).toContain('10 workout');
  });

  it('answers junk food cost, empty kcal & fat-loss drag queries accurately', () => {
    const ans = buildDeterministicFinanceAnswer('What is my junk food cost and kcal impact?', context);
    expect(ans).toContain('₹600');
    expect(ans).toContain('1,540 empty kcal');
    expect(ans).toContain('0.2 kg'); // 1540 / 7700 = 0.2
    expect(ans).toContain('₹420/mo'); // 70% savings
  });

  it('answers sleep/mood spend trigger queries accurately', () => {
    const ans = buildDeterministicFinanceAnswer('Do low sleep days trigger junk spending?', context);
    expect(ans).toContain('1 trigger day');
    expect(ans).toContain('₹600/day');
    expect(ans).toContain('₹0/day');
  });

  it('preserves core finance safe-to-spend deterministic Q&A', () => {
    const ans = buildDeterministicFinanceAnswer('How much can I safely spend per day?', context);
    expect(ans).toContain('₹1,800/day');
    expect(ans).toContain('₹9,000');
  });

  const SOCIAL_TX_FIXTURE = {
    id: 'tx-social-food',
    userId: 'u1',
    title: 'Friends cafe pizza',
    amount: 1200,
    type: 'expense' as const,
    categoryId: 'cat-food',
    accountId: 'acc-1',
    date: '2026-11-21',
    monthKey: '2026-11',
    tags: ['split', 'hangout'],
    splitGroupId: 'sp-hangout',
    isRecurring: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const SOCIAL_CATEGORY_FIXTURE = {
    id: 'cat-food',
    userId: 'u1',
    name: 'Food & Dining',
    slug: 'food-dining',
    type: 'expense' as const,
    icon: 'Utensils',
    color: '#10b981',
    monthlyBudgetLimit: 3000,
    subcategories: [],
    order: 1,
    isSystem: false,
    archived: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const SOCIAL_MEAL_FIXTURE = {
    id: 'meal-social-1',
    userId: 'u1',
    date: '2026-11-21',
    mealType: 'dinner' as const,
    name: 'Pizza & Shake',
    calories: 2100,
    proteinG: 40,
    carbsG: 220,
    fatG: 90,
    quantityMultiplier: 1,
    isJunk: true,
    source: 'manual' as const,
    loggedAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  function buildSocialHangoutContext() {
    return buildFinanceQAContext({
      selectedMonth: '2026-11',
      summary: baseSummary,
      netWorth: baseNetWorth,
      transactions: [...transactions, SOCIAL_TX_FIXTURE],
      categories: [...categories, SOCIAL_CATEGORY_FIXTURE],
      accounts,
      recurringBills: [],
      emiTrackers: [],
      sipPlans: [],
      debtRecords: [],
      anomalies: [],
      fitness: {
        todayDate: '2026-11-25',
        fitnessDailyLogs,
        mealLogs: [...mealLogs, SOCIAL_MEAL_FIXTURE],
        workoutSessions,
        supplementInventory,
        supplementLogs,
      },
    });
  }

  it('answers plural "empty calories" phrasing and social hangout food balance queries accurately', () => {
    const emptyCalAns = buildDeterministicFinanceAnswer('How many empty calories did I consume?', context);
    expect(emptyCalAns).toContain('1,540 empty kcal');

    const socialAns = buildDeterministicFinanceAnswer(
      'How do social hangouts affect my food spending and diet balance?',
      buildSocialHangoutContext()
    );
    expect(socialAns).toContain('1 hangout');
    expect(socialAns).toContain('₹1,200');
    expect(socialAns).toContain('2,100 junk kcal');
  });
});
