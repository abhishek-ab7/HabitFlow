import React from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  if (typeof global.ResizeObserver === 'undefined') {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  }
});
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TodayTasksWidget } from '@/components/dashboard/TodayTasksWidget';
import { BillCalendarView } from '@/components/finance/trackers/BillCalendarView';
import { GoalFormModal } from '@/components/goals/goal-form-modal';
import { GoalCard } from '@/components/goals/goal-card';
import { FocusGoal } from '@/components/dashboard/focus-goal';
import { calculateFitnessGoalProgress } from '@/lib/fitness/shared-analytics';
import { usePomodoroStore } from '@/lib/stores/pomodoro-store';
import { addDays, getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import type { Goal, SupplementInventory, Task } from '@/lib/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'u1' }, isLoading: false }),
}));

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    motion: {
      div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
      circle: ({ children, ...props }: any) => <circle {...props}>{children}</circle>,
      span: ({ children, ...props }: any) => (
        <span {...props}>
          {children && typeof children === 'object' && 'get' in children && typeof children.get === 'function'
            ? children.get()
            : children}
        </span>
      ),
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useInView: () => true,
    useSpring: vi.fn((val) => ({ get: () => val, set: vi.fn(), onChange: vi.fn() })),
    useMotionValue: vi.fn((val) => ({ get: () => val, set: vi.fn(), onChange: vi.fn() })),
    useTransform: vi.fn((val, fn) =>
      typeof fn === 'function' ? fn(typeof val?.get === 'function' ? val.get() : val) : val
    ),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const todayIso = getLocalIsoDate();
const nowIso = `${todayIso}T09:00:00.000Z`;

const {
  mockTaskState,
  mockFinanceState,
  mockFitnessState,
  mockHabitState,
} = vi.hoisted(() => {
  const tIso = new Date().toLocaleDateString('en-CA');
  const mKey = tIso.slice(0, 7);
  const nIso = `${tIso}T09:00:00.000Z`;
  return {
    mockTaskState: {
      tasks: [] as Task[],
      loadTasks: vi.fn(async () => {}),
      toggleTaskComplete: vi.fn(async () => {}),
      editTask: vi.fn(async () => {}),
      removeTask: vi.fn(async () => {}),
      addTask: vi.fn(async () => {}),
      isLoading: false,
    },
    mockFinanceState: {
      selectedMonth: mKey,
      transactions: [],
      accounts: [],
      recurringBills: [],
      emiTrackers: [],
      sipPlans: [],
      debtRecords: [],
      creditCardStatements: [],
      getAllCommitmentLedgers: () => [],
      payRecurringBill: vi.fn(),
      payMonthlyEmi: vi.fn(),
      payMonthlySip: vi.fn(),
      settleCommitmentBalance: vi.fn(),
      getNetWorthSummary: () => ({
        liquidAssets: 50000,
        investmentAssets: 0,
        friendReceivables: 0,
        totalAssets: 50000,
        creditCardLiabilities: 0,
        emiRemainingPrincipal: 0,
        friendPayables: 0,
        totalLiabilities: 0,
        netWorth: 50000,
      }),
      getMonthlySummary: () => ({
        monthKey: mKey,
        totalIncome: 50000,
        totalSpent: 0,
        totalInvested: 0,
        monthlyBudget: 20000,
        remainingBudget: 20000,
        safeToSpendMonthly: 20000,
        safeToSpendDaily: 1000,
        remainingDaysInMonth: 10,
        dayOfMonthProgressPct: 60,
        savingsRate: 50,
        netCashFlow: 50000,
        remainingUnpaidBills: 0,
        remainingUnpaidEmis: 0,
        remainingUnpaidCommitments: 0,
        needsReviewCount: 0,
        categoryBreakdown: [],
      }),
    },
    mockFitnessState: {
      hasLoaded: true,
      profile: {
        id: 'fp1',
        userId: 'u1',
        currentWeightKg: 80,
        startingWeightKg: 85,
        targetWeightKg: 75,
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
          id: 'dl-1',
          userId: 'u1',
          date: tIso,
          weightKg: 80,
          waistInches: 32,
          waterMl: 2000,
          steps: 9000,
          createdAt: nIso,
          updatedAt: nIso,
        },
      ],
      workoutSessions: Array.from({ length: 8 }, (_, idx) => ({
        id: `w-${idx}`,
        userId: 'u1',
        date: `${mKey}-${String(idx + 1).padStart(2, '0')}`,
        title: 'Push',
        workoutType: 'push',
        durationMinutes: 45,
        exercises: [],
        source: 'manual',
        createdAt: nIso,
        updatedAt: nIso,
      })),
      supplementInventory: [] as SupplementInventory[],
      supplementLogs: [],
      loadFitnessData: vi.fn(async () => {}),
      restockSupplement: vi.fn(async () => null),
    },
    mockHabitState: {
      habits: [],
      completions: [],
    },
  };
});

vi.mock('@/lib/stores/task-store', () => ({
  useTaskStore: (sel?: any) => (typeof sel === 'function' ? sel(mockTaskState) : mockTaskState),
}));
vi.mock('@/lib/stores/finance-store', () => ({
  useFinanceStore: (sel?: any) => (typeof sel === 'function' ? sel(mockFinanceState) : mockFinanceState),
  formatINR: (amt: number) => `₹${Math.round(amt || 0).toLocaleString('en-IN')}`,
}));
vi.mock('@/lib/stores/fitness', () => ({
  useFitnessStore: (sel?: any) => (typeof sel === 'function' ? sel(mockFitnessState) : mockFitnessState),
}));
vi.mock('@/lib/stores/habit-store', () => ({
  useHabitStore: (sel?: any) => (typeof sel === 'function' ? sel(mockHabitState) : mockHabitState),
}));

describe('Slice 2C: Top 3 MITs + 2m Start, BillCalendar Health/Supplement Events, Fitness Goals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePomodoroStore.setState({
      mode: 'focus',
      timeLeft: 25 * 60,
      duration: 25 * 60,
      isRunning: false,
      activeTaskId: null,
      activeTaskTitle: null,
    });
  });

  it('TodayTasksWidget renders Top 3 MITs, collapses Other Tasks (N), and launches starter_2m on 2m Start click', async () => {
    mockTaskState.tasks = [
      {
        id: 't1',
        userId: 'u1',
        title: 'Pinned MIT 1',
        status: 'todo',
        priority: 'medium',
        tags: [],
        due_date: todayIso,
        metadata: { isMitForDate: todayIso, mitRank: 1 },
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: 't2',
        userId: 'u1',
        title: 'Pinned MIT 2',
        status: 'todo',
        priority: 'low',
        tags: [],
        due_date: todayIso,
        metadata: { isMitForDate: todayIso, mitRank: 2 },
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: 't3',
        userId: 'u1',
        title: 'Pinned MIT 3',
        status: 'todo',
        priority: 'high',
        tags: [],
        due_date: todayIso,
        metadata: { isMitForDate: todayIso, mitRank: 3 },
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: 't4',
        userId: 'u1',
        title: 'Backlog Task 4',
        status: 'todo',
        priority: 'high',
        tags: [],
        due_date: todayIso,
        created_at: nowIso,
        updated_at: nowIso,
      },
    ];

    render(<TodayTasksWidget isHydrated />);

    const mitZone = screen.getByTestId('top-3-mits-zone');
    expect(mitZone).toHaveTextContent('Pinned MIT 1');
    expect(mitZone).toHaveTextContent('Pinned MIT 2');
    expect(mitZone).toHaveTextContent('Pinned MIT 3');
    expect(mitZone).not.toHaveTextContent('Backlog Task 4');

    // Collapsed Other Tasks (1) drawer
    expect(screen.queryByTestId('other-tasks-drawer-content')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('other-tasks-drawer-toggle'));
    expect(screen.getByTestId('other-tasks-drawer-content')).toHaveTextContent('Backlog Task 4');

    // Click 2m Start on Pinned MIT 1 -> launches starter_2m preset in usePomodoroStore!
    fireEvent.click(screen.getByTestId('task-2m-start-t1'));
    const pomo = usePomodoroStore.getState();
    expect(pomo.mode).toBe('starter_2m');
    expect(pomo.duration).toBe(120);
    expect(pomo.activeTaskId).toBe('t1');
    expect(pomo.isRunning).toBe(true);
  });

  it('BillCalendarView surfaces health_task and supplement_refill events on due/runout days', async () => {
    const dayNum = parseInt(todayIso.slice(8, 10), 10);
    const sameMonthRefillDays = dayNum <= 25 ? 2 : 0; // Stays inside same calendar month!
    const refillDate = addDays(todayIso, sameMonthRefillDays);
    const refillDayNum = parseInt(refillDate.slice(8, 10), 10);

    mockTaskState.tasks = [
      {
        id: 'th-1',
        userId: 'u1',
        title: 'Blood Test Follow-up',
        status: 'todo',
        priority: 'high',
        tags: ['health'],
        due_date: todayIso,
        created_at: nowIso,
        updated_at: nowIso,
      },
    ];

    mockFitnessState.supplementInventory = [
      {
        id: 'sup-whey',
        userId: 'u1',
        name: 'Whey Isolate',
        category: 'protein',
        unitLabel: 'scoop',
        totalServings: 30,
        remainingServings: sameMonthRefillDays,
        dailyDosage: 1,
        costInr: 2500,
        manualAdjustment: sameMonthRefillDays - 30,
        lowStockThresholdDays: 7,
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    render(<BillCalendarView />);

    // Today has Blood Test Follow-up
    expect(screen.getByText('Blood Test Follow-up')).toBeInTheDocument();

    // Select refill day if different from today
    if (refillDayNum !== dayNum) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${refillDayNum}\\b`) }));
    }
    expect(await screen.findByText('Whey Isolate Refill')).toBeInTheDocument();
  });

  it('calculates FitnessGoalLink progress across target_weight (cut & bulk), target_waist, monthly_workouts, and daily_steps_avg', () => {
    const cutProg = calculateFitnessGoalProgress(
      { type: 'target_weight', targetValue: 75, startingValue: 85, unit: 'kg' },
      { profile: mockFitnessState.profile as any, dailyLogs: mockFitnessState.dailyLogs as any, workoutSessions: [], referenceDate: todayIso }
    );
    expect(cutProg.progressPct).toBe(50); // 85 -> 80 halfway to 75

    const bulkProg = calculateFitnessGoalProgress(
      { type: 'target_weight', targetValue: 70, startingValue: 60, unit: 'kg' },
      { dailyLogs: [{ id: 'w1', userId: 'u1', date: todayIso, weightKg: 65, waterMl: 0, steps: 0, createdAt: nowIso, updatedAt: nowIso }], workoutSessions: [], referenceDate: todayIso }
    );
    expect(bulkProg.progressPct).toBe(50); // 60 -> 65 halfway to 70

    const waistProg = calculateFitnessGoalProgress(
      { type: 'target_waist', targetValue: 30, startingValue: 34, unit: 'in' },
      { dailyLogs: [{ id: 'wa1', userId: 'u1', date: todayIso, waistInches: 32, waterMl: 0, steps: 0, createdAt: nowIso, updatedAt: nowIso }], workoutSessions: [], referenceDate: todayIso }
    );
    expect(waistProg.progressPct).toBe(50);

    const workoutProg = calculateFitnessGoalProgress(
      { type: 'monthly_workouts', targetValue: 16, unit: 'workouts' },
      { dailyLogs: [], workoutSessions: mockFitnessState.workoutSessions as any, referenceDate: todayIso }
    );
    expect(workoutProg.currentValue).toBe(8);
    expect(workoutProg.progressPct).toBe(50);

    const stepsProg = calculateFitnessGoalProgress(
      { type: 'daily_steps_avg', targetValue: 10000, unit: 'steps/day' },
      { dailyLogs: mockFitnessState.dailyLogs as any, workoutSessions: [], referenceDate: todayIso }
    );
    expect(stepsProg.currentValue).toBe(9000);
    expect(stepsProg.progressPct).toBe(90);
  });

  it('GoalFormModal submits fitnessLink & GoalCard displays live Fitness Goal progress', async () => {
    const onSubmit = vi.fn();
    render(<GoalFormModal open onOpenChange={vi.fn()} onSubmit={onSubmit} />);
    await act(async () => {});

    fireEvent.change(screen.getByLabelText(/Goal Title/i), {
      target: { value: 'Cut to 75 kg' },
    });
    fireEvent.click(screen.getByLabelText(/Live Fitness Telemetry Link/i));
    fireEvent.change(screen.getByLabelText(/Target \(kg\)/i), {
      target: { value: '75' },
    });
    fireEvent.change(screen.getByLabelText(/Starting Baseline \(kg\)/i), {
      target: { value: '85' },
    });

    await act(async () => {
      const submitBtn = screen.getByRole('button', { name: /Create Goal/i });
      fireEvent.submit(submitBtn.closest('form') || submitBtn);
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cut to 75 kg',
        fitnessLink: expect.objectContaining({
          type: 'target_weight',
          targetValue: 75,
          startingValue: 85,
          unit: 'kg',
        }),
      })
    );

    const goal: Goal = {
      id: 'g-fit-1',
      userId: 'u1',
      title: 'Cut to 75 kg',
      areaOfLife: 'health',
      priority: 'high',
      status: 'in_progress',
      startDate: '2026-11-01',
      deadline: '2027-01-31',
      isFocus: true,
      createdAt: nowIso,
      archived: false,
      fitnessLink: { type: 'target_weight', targetValue: 75, startingValue: 85, unit: 'kg' },
    };

    render(
      <GoalCard
        goal={goal}
        milestones={[]}
        stats={{
          goalId: 'g-fit-1',
          progress: 50,
          milestonesCompleted: 0,
          milestonesTotal: 0,
          daysRemaining: 60,
          daysElapsed: 20,
          totalDays: 80,
          isOnTrack: true,
        }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onArchive={vi.fn()}
        onSetFocus={vi.fn()}
        onToggleMilestone={vi.fn()}
        onAddMilestone={vi.fn()}
      />
    );

    const fitCard = screen.getByTestId('goal-fitness-progress-card');
    expect(fitCard).toHaveTextContent('Target Weight');
    expect(fitCard).toHaveTextContent('50%');
    expect(fitCard).toHaveTextContent('80');

    render(
      <FocusGoal
        goals={[goal]}
        getMilestones={() => []}
        getStats={() => ({
          goalId: 'g-fit-1',
          progress: 50,
          milestonesCompleted: 0,
          milestonesTotal: 0,
          daysRemaining: 60,
          daysElapsed: 20,
          totalDays: 80,
          isOnTrack: true,
          currentFitnessValue: 80,
          targetFitnessValue: 75,
          fitnessUnit: 'kg',
        })}
        onToggleMilestone={vi.fn()}
      />
    );

    expect(screen.getByText('Live Fitness')).toBeInTheDocument();
    expect(screen.getByText('80 kg')).toBeInTheDocument();
    expect(screen.getByText('Target 75 kg')).toBeInTheDocument();
  });
});
