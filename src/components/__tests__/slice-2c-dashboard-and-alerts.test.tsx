import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  computeUnified3DayAlerts,
  HeaderAlertsBell,
  UnifiedAlertManager,
  useUnifiedAlertStore,
} from '@/components/alerts/UnifiedAlertManager';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';

const { mockPush, mockRequestPermission, mockToastWarning } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRequestPermission: vi.fn(async () => 'granted' as NotificationPermission),
  mockToastWarning: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'u1@example.com' }, isLoading: false }),
}));

vi.mock('@/providers/sync-provider', () => ({
  useSync: () => ({ isDataReady: true }),
}));

vi.mock('sonner', () => ({
  toast: {
    warning: mockToastWarning,
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/ai-features-flag', () => ({
  isAIEnabled: () => false,
}));

vi.mock('@/lib/db', () => ({
  db: {
    creditCardStatements: { toArray: vi.fn(async () => []) },
    financeAccounts: { toArray: vi.fn(async () => []) },
    emiTrackers: { toArray: vi.fn(async () => []) },
    monthlyCommitments: { toArray: vi.fn(async () => []) },
    financeRecurringBills: { toArray: vi.fn(async () => []) },
    financeTransactions: { toArray: vi.fn(async () => []) },
    tasks: { toArray: vi.fn(async () => []) },
    supplementInventory: { toArray: vi.fn(async () => []) },
    supplementLogs: { toArray: vi.fn(async () => []) },
  },
}));

const todayIso = getLocalIsoDate();
const nowIso = `${todayIso}T09:00:00.000Z`;

const {
  mockHabitsState,
  mockGoalState,
  mockTaskState,
  mockGamificationState,
  mockFinanceState,
  mockFitnessState,
  mockMoodState,
  mockUserState,
  mockUiState,
} = vi.hoisted(() => {
  const tIso = new Date().toLocaleDateString('en-CA');
  const nIso = `${tIso}T09:00:00.000Z`;
  return {
    mockHabitsState: {
      habits: [
        {
          id: 'h1',
          userId: 'u1',
          name: 'Gym Session',
          category: 'health',
          targetDaysPerWeek: 7,
          archived: false,
          order: 0,
          createdAt: '2026-11-01',
        },
      ],
      completions: [],
      loadCompletions: vi.fn(async () => {}),
      initializeWithDemoData: vi.fn(),
      getTodayProgress: () => ({ completed: 0, total: 1 }),
      getMonthlyProgress: () => 50,
      getCurrentStreaks: () => new Map(),
      toggle: vi.fn(),
      markRestDay: vi.fn(),
    },
    mockGoalState: {
      goals: [],
      loadAllMilestones: vi.fn(async () => {}),
      getFocusGoals: () => [],
      getGoalStats: vi.fn(),
      getGoalMilestones: () => [],
      getActiveGoalsCount: () => 0,
      getUpcomingDeadlines: () => [],
      toggleMilestoneComplete: vi.fn(),
    },
    mockTaskState: {
      tasks: [
        {
          id: 't-mit-1',
          userId: 'u1',
          title: 'MIT Priority Review',
          status: 'todo',
          priority: 'high',
          tags: [],
          due_date: tIso,
          metadata: { isMitForDate: tIso, mitRank: 1 },
          created_at: nIso,
          updated_at: nIso,
        },
      ],
      loadTasks: vi.fn(async () => {}),
      toggleTaskComplete: vi.fn(),
      editTask: vi.fn(async () => {}),
    },
    mockGamificationState: {
      settings: {
        id: 's1',
        userId: 'u1',
        habitOnlyMode: false,
        showFinance: true,
        showFitness: true,
        showGoals: true,
        showTasks: true,
        showMilestones: true,
      },
      loadGamification: vi.fn(async () => {}),
    },
    mockFinanceState: {
      categories: [
        {
          id: 'cat-junk',
          userId: 'u1',
          name: 'Junk Food',
          slug: 'junk-food',
          type: 'expense',
          icon: 'Pizza',
          color: '#f43f5e',
          monthlyBudgetLimit: 500,
          subcategories: [],
          order: 0,
          isSystem: false,
          archived: false,
          createdAt: nIso,
          updatedAt: nIso,
        },
      ],
      transactions: [
        {
          id: 'tx-junk-1',
          userId: 'u1',
          title: 'Midnight Momos',
          amount: 1600,
          type: 'expense',
          categoryId: 'cat-junk',
          accountId: 'acc-upi',
          date: tIso,
          monthKey: tIso.slice(0, 7),
          tags: [],
          isRecurring: false,
          createdAt: nIso,
          updatedAt: nIso,
        },
      ],
      budgets: [],
      debtRecords: [],
      accounts: [],
      creditCardStatements: [],
      loadFinanceData: vi.fn(async () => {}),
      getMonthlySummary: () => ({
        monthKey: tIso.slice(0, 7),
        totalIncome: 50000,
        totalSpent: 1600,
        totalInvested: 0,
        monthlyBudget: 20000,
        remainingBudget: 18400,
        safeToSpendMonthly: 18400,
        safeToSpendDaily: 1200,
        remainingDaysInMonth: 5,
        dayOfMonthProgressPct: 80,
        savingsRate: 60,
        netCashFlow: 48400,
        remainingUnpaidBills: 0,
        remainingUnpaidEmis: 0,
        remainingUnpaidCommitments: 0,
        needsReviewCount: 0,
        categoryBreakdown: [],
      }),
      getNetWorthSummary: () => ({
        liquidAssets: 50000,
        investmentAssets: 0,
        friendReceivables: 0,
        totalAssets: 50000,
        creditCardLiabilities: 4200,
        emiRemainingPrincipal: 10000,
        friendPayables: 0,
        totalLiabilities: 14200,
        netWorth: 35800,
      }),
      getDebtSummary: () => ({
        totalBorrowedRemaining: 5000,
        totalLentRemaining: 0,
        netPosition: -5000,
        plannedInstallmentsThisMonth: 0,
        activeBorrowedCount: 1,
        activeLentCount: 0,
        everydayBorrowedRemaining: 5000,
        everydayLentRemaining: 0,
        everydayNetPosition: -5000,
        longTermBorrowedRemaining: 0,
        longTermLentRemaining: 0,
        longTermNetPosition: 0,
      }),
      getDailySpendingPace: () => [],
      getSpendingAnomalies: () => [],
      getUpcomingFinancialObligations: () => [],
    },
    mockFitnessState: {
      profile: {
        id: 'fp1',
        userId: 'u1',
        calorieTarget: 2000,
        proteinTargetG: 130,
        waterTargetMl: 3000,
        stepsTarget: 8000,
        sleepTargetHours: 7.5,
        activityLevel: 'moderate',
        goalType: 'fat_loss',
        dietPreference: 'non_veg',
        createdAt: nIso,
        updatedAt: nIso,
      },
      dailyLogs: [
        {
          id: 'fd1',
          userId: 'u1',
          date: tIso,
          weightKg: 78.4,
          waistInches: 33.5,
          waterMl: 1500,
          steps: 7200,
          sleepHours: 5.5,
          energyLevel: 2,
          createdAt: nIso,
          updatedAt: nIso,
        },
      ],
      mealLogs: [
        {
          id: 'ml1',
          userId: 'u1',
          date: tIso,
          mealType: 'snack',
          name: 'Midnight Momos',
          calories: 1540,
          proteinG: 20,
          carbsG: 160,
          fatG: 70,
          quantityMultiplier: 1,
          isJunk: true,
          linkedTransactionId: 'tx-junk-1',
          source: 'finance_bridge',
          loggedAt: nIso,
          createdAt: nIso,
          updatedAt: nIso,
        },
      ],
      workoutSessions: [],
      supplementInventory: [],
      supplementLogs: [],
      loadFitnessData: vi.fn(async () => {}),
      incrementWater: vi.fn(),
      toggleLowEnergyMode: vi.fn(async () => ({ restedHabitIds: [] })),
    },
    mockMoodState: {
      moodLogs: [{ id: 'm1', userId: 'u1', date: tIso, mood: 'stressed' }],
      loadMoodLogs: vi.fn(async () => {}),
      getMoodForDate: () => 'stressed',
    },
    mockUserState: { displayName: 'Abhishek' },
    mockUiState: {
      loadDashboardLayout: vi.fn(async () => {}),
      dashboardLayout: ['today-tasks', 'ai-coach', 'weekly-review'],
    },
  };
});

vi.mock('@/lib/stores/habit-store', () => ({ useHabitStore: (sel: any) => sel(mockHabitsState) }));
vi.mock('@/lib/stores/goal-store', () => ({ useGoalStore: (sel: any) => sel(mockGoalState) }));
vi.mock('@/lib/stores/task-store', () => ({
  useTaskStore: (sel?: any) => (typeof sel === 'function' ? sel(mockTaskState) : mockTaskState),
}));
vi.mock('@/lib/stores/gamification-store', () => ({ useGamificationStore: (sel: any) => sel(mockGamificationState) }));
vi.mock('@/lib/stores/finance-store', () => ({
  useFinanceStore: (sel?: any) => (typeof sel === 'function' ? sel(mockFinanceState) : mockFinanceState),
  formatINR: (amt: number) => `₹${Math.round(amt || 0).toLocaleString('en-IN')}`,
}));
vi.mock('@/lib/stores/fitness', () => ({ useFitnessStore: (sel: any) => sel(mockFitnessState) }));
vi.mock('@/lib/stores/mood-store', () => ({ useMoodStore: (sel: any) => sel(mockMoodState) }));
vi.mock('@/lib/stores/user-store', () => ({ useUserStore: (sel: any) => sel(mockUserState) }));
vi.mock('@/lib/stores/ui-store', () => ({ useUIStore: (sel: any) => sel(mockUiState) }));
vi.mock('@/components/dashboard/BentoGrid', () => ({
  BentoGrid: ({ widgets }: { widgets: Record<string, React.ReactNode> }) => (
    <div data-testid="bento-grid">{Object.keys(widgets).join(',')}</div>
  ),
}));
vi.mock('@/components/dashboard/OnboardingWizard', () => ({ default: () => null }));
vi.mock('@/components/dashboard/DashboardTour', () => ({ default: () => null }));
vi.mock('@/components/dashboard/MoodCheckIn', () => ({ MoodCheckIn: () => null }));
vi.mock('@/components/finance/AddTransactionModal', () => ({ AddTransactionModal: () => null }));
vi.mock('@/components/finance/SmsImportModal', () => ({ SmsImportModal: () => null }));
vi.mock('@/components/finance/AskFinancesDrawer', () => ({ AskFinancesDrawer: () => null }));

import DashboardContent from '@/components/dashboard/DashboardContent';
import { WeeklyReviewWidget } from '@/components/dashboard/WeeklyReviewWidget';

describe('Slice 2C: Always-Visible Dashboard Alerts, Unified 3-Day Alerts & 5-Min Sunday Reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof global.IntersectionObserver === 'undefined') {
      global.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() { return []; }
      } as any;
    }
    if (typeof global.ResizeObserver === 'undefined') {
      global.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      } as any;
    }
    localStorage.clear();
    localStorage.setItem('habitflow_onboarded', 'true');
    localStorage.setItem('habitflow_dashboard_tutorial_completed', 'true');
    useUnifiedAlertStore.setState({
      alerts: [],
      dismissedIds: [],
      hasScanned: false,
      notificationPermission: 'default',
    });

    Object.defineProperty(window, 'Notification', {
      configurable: true,
      writable: true,
      value: {
        permission: 'default',
        requestPermission: mockRequestPermission,
      },
    });
  });

  it('renders deterministic Cross-Domain Alerts on DashboardContent even when isAIEnabled() is false', async () => {
    await act(async () => {
      render(<DashboardContent />);
    });

    const alertsSection = await screen.findByTestId('dashboard-deterministic-alerts');
    expect(alertsSection).toBeInTheDocument();
    expect(alertsSection.textContent).toContain('Wallet <-> Waistline');
    expect(alertsSection.textContent).toContain('1,540');
    // Confirm AI coach widget was NOT mounted when isAIEnabled() === false
    expect(screen.getByTestId('bento-grid').textContent).not.toContain('ai-coach');
  });

  it('computeUnified3DayAlerts captures CC due dates, EMIs, rent commitments, health tasks & <=5d supplement stock', () => {
    const alerts = computeUnified3DayAlerts({
      todayIso: '2026-11-25',
      creditCardStatements: [
        {
          id: 'stmt-1',
          accountId: 'acc-slice',
          cycleKey: '2026-11',
          periodStart: '2026-10-22',
          periodEnd: '2026-11-21',
          dueDate: '2026-11-27',
          calculatedAmount: 8500,
          manualAdjustment: 0,
          totalDue: 8500,
          carriedForwardAmount: 0,
          paidAmount: 0,
          remainingDue: 8500,
          status: 'billed',
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ],
      accounts: [
        {
          id: 'acc-slice',
          userId: 'u1',
          name: 'Slice CC',
          type: 'credit_card',
          balance: -8500,
          currency: 'INR',
          color: '#f43f5e',
          icon: 'CreditCard',
          isDefault: false,
          archived: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ],
      emiTrackers: [
        {
          id: 'emi-1',
          userId: 'u1',
          loanName: 'MacBook EMI',
          lenderName: 'HDFC',
          principalAmount: 60000,
          interestRateAnnual: 12,
          tenureMonths: 12,
          emiAmount: 5300,
          billingDayOfMonth: 28,
          startDate: '2026-06-01',
          paidMonths: 5,
          status: 'active',
          categoryId: 'cat-emi',
          autoCreateTaskReminder: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ],
      commitments: [
        {
          id: 'com-rent',
          userId: 'u1',
          title: 'Flat Rent',
          recipientName: 'Landlord',
          relationship: 'Landlord',
          monthlyTargetAmount: 18000,
          dueDayOfMonth: 26,
          category: 'rent',
          autoRolloverOverpayment: false,
          icon: 'Home',
          color: '#000',
          isActive: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ],
      tasks: [
        {
          id: 'task-health-1',
          userId: 'u1',
          title: 'Refill Vitamin D3 prescription',
          status: 'todo',
          priority: 'high',
          tags: ['health'],
          due_date: '2026-11-27',
          created_at: nowIso,
          updated_at: nowIso,
        },
      ],
      supplementInventory: [
        {
          id: 'sup-low',
          userId: 'u1',
          name: 'Creatine Monohydrate',
          category: 'creatine',
          unitLabel: 'scoop',
          totalServings: 60,
          remainingServings: 3,
          dailyDosage: 1,
          costInr: 900,
          manualAdjustment: -57,
          lowStockThresholdDays: 7,
          isActive: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ],
      supplementLogs: [],
    });

    const kinds = alerts.map((a) => a.kind);
    expect(kinds).toContain('credit_card');
    expect(kinds).toContain('emi');
    expect(kinds).toContain('commitment');
    expect(kinds).toContain('health_task');
    expect(kinds).toContain('supplement_low_stock');
  });

  it('UnifiedAlertManager never calls Notification.requestPermission() on mount; HeaderAlertsBell only requests on explicit user click', async () => {
    await act(async () => {
      render(
        <>
          <UnifiedAlertManager />
          <HeaderAlertsBell />
        </>
      );
    });

    // CRITICAL: zero automatic requestPermission() call on mount!
    expect(mockRequestPermission).not.toHaveBeenCalled();

    // Seed active alert into store & open bell popover
    act(() => {
      useUnifiedAlertStore.getState().setAlerts([
        {
          id: 'al-1',
          kind: 'credit_card',
          title: 'Slice CC Due in 2d',
          subtitle: 'Statement 2026-11',
          dueDate: '2026-11-27',
          daysUntil: 2,
          amount: 8500,
          severity: 'warning',
          href: '/finance?tab=trackers',
        },
      ]);
    });

    expect(screen.getByTestId('header-alerts-badge').textContent).toBe('1');
    fireEvent.click(screen.getByTestId('header-alerts-bell'));
    const enableBtn = await screen.findByTestId('enable-browser-notifications-btn');
    await act(async () => {
      fireEvent.click(enableBtn);
    });

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });

  it('WeeklyReviewWidget exposes Mon-Sat Preview Reset toggle showing 4 Truths & saves Top 3 MIT priorities', async () => {
    render(<WeeklyReviewWidget />);

    const launchOrPreviewBtn =
      screen.queryByTestId('preview-sunday-reset-btn') ||
      screen.getByTestId('launch-sunday-reset-btn');
    fireEvent.click(launchOrPreviewBtn);

    expect(await screen.findByTestId('sunday-truth-1')).toHaveTextContent('₹18,400 safe');
    expect(screen.getByTestId('sunday-truth-1')).toHaveTextContent('₹4,200'); // CC float
    expect(screen.getByTestId('sunday-truth-2')).toHaveTextContent('78.4 kg');
    expect(screen.getByTestId('sunday-truth-3')).toHaveTextContent('1,540 kcal');
    expect(screen.getByTestId('sunday-truth-4')).toBeInTheDocument();

    const saveBtn = screen.getByTestId('save-sunday-mits-btn');
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(mockTaskState.editTask).toHaveBeenCalled();
  });

  it('computeUnified3DayAlerts respects quarterly/yearly recurring bill cadence and commitment rollover overpayment', () => {
    const nowIso = '2026-11-25T09:00:00.000Z';
    const alerts = computeUnified3DayAlerts({
      todayIso: '2026-11-25',
      transactions: [
        {
          id: 'tx-rollover',
          userId: 'u1',
          title: 'Advance rent payment',
          amount: 20000,
          type: 'expense',
          categoryId: 'cat-rent',
          accountId: 'acc-1',
          date: '2026-10-05',
          monthKey: '2026-10',
          linkedCommitmentId: 'com-rollover',
          commitmentContributionType: 'direct_payment',
          tags: [],
          isRecurring: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ],
      recurringBills: [
        {
          id: 'bill-quarterly',
          userId: 'u1',
          name: 'Society Maintenance',
          amount: 4500,
          cadence: 'quarterly',
          dueDayOfMonth: 27,
          categoryId: 'cat-home',
          lastPaidMonthKey: '2026-10',
          autoLog: false,
          color: '#000',
          icon: 'Receipt',
          isActive: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        {
          id: 'bill-monthly-due',
          userId: 'u1',
          name: 'Fiber Broadband',
          amount: 999,
          cadence: 'monthly',
          dueDayOfMonth: 27,
          categoryId: 'cat-util',
          lastPaidMonthKey: '2026-10',
          autoLog: false,
          color: '#000',
          icon: 'Receipt',
          isActive: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ],
      commitments: [
        {
          id: 'com-rollover',
          userId: 'u1',
          title: 'Studio Rent',
          recipientName: 'Owner',
          relationship: 'Landlord',
          monthlyTargetAmount: 10000,
          dueDayOfMonth: 27,
          category: 'rent',
          autoRolloverOverpayment: true,
          icon: 'Home',
          color: '#000',
          isActive: true,
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: nowIso,
        },
      ],
    });

    expect(alerts.some((a) => a.id.includes('bill-quarterly'))).toBe(false);
    expect(alerts.some((a) => a.id.includes('com-rollover'))).toBe(false);
    expect(alerts.some((a) => a.id.includes('bill-monthly-due'))).toBe(true);
  });
});
