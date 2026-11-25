import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import AnalyticsPageContent from '../AnalyticsPageContent';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useGoalStore } from '@/lib/stores/goal-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { useMoodStore } from '@/lib/stores/mood-store';
import { useFinanceStore } from '@/lib/stores/finance-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import { useAuth } from '@/providers/auth-provider';

const mockSearchParams = new URLSearchParams('tab=pulse&range=30d');

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/stores/gamification-store', () => ({
  useGamificationStore: vi.fn(),
}));
vi.mock('@/lib/stores/habit-store', () => ({
  useHabitStore: vi.fn(),
}));
vi.mock('@/lib/stores/goal-store', () => ({
  useGoalStore: vi.fn(),
}));
vi.mock('@/lib/stores/task-store', () => ({
  useTaskStore: vi.fn(),
}));
vi.mock('@/lib/stores/mood-store', () => ({
  useMoodStore: vi.fn(),
}));
vi.mock('@/lib/stores/finance-store', () => ({
  useFinanceStore: vi.fn(),
  formatINR: (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`,
}));
vi.mock('@/lib/stores/fitness', () => ({
  useFitnessStore: vi.fn(),
}));

describe('AnalyticsPageContent shell & module visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();

    (useAuth as unknown as Mock).mockReturnValue({ user: { id: 'u1' } });
    (useHabitStore as unknown as Mock).mockImplementation((selector: (s: any) => any) =>
      selector({
        habits: [],
        completions: [],
        loadHabits: vi.fn().mockResolvedValue(undefined),
        loadCompletions: vi.fn().mockResolvedValue(undefined),
      })
    );
    (useGoalStore as unknown as Mock).mockImplementation((selector: (s: any) => any) =>
      selector({
        goals: [],
        milestones: [],
        loadGoals: vi.fn().mockResolvedValue(undefined),
        loadAllMilestones: vi.fn().mockResolvedValue(undefined),
      })
    );
    (useTaskStore as unknown as Mock).mockImplementation((selector: (s: any) => any) =>
      selector({
        tasks: [],
        loadTasks: vi.fn().mockResolvedValue(undefined),
      })
    );
    (useMoodStore as unknown as Mock).mockImplementation((selector: (s: any) => any) =>
      selector({
        moodLogs: [],
        loadMoodLogs: vi.fn().mockResolvedValue(undefined),
      })
    );
    (useFinanceStore as unknown as Mock).mockImplementation((selector: (s: any) => any) =>
      selector({
        accounts: [],
        transactions: [],
        categories: [],
        budgets: [],
        commitments: [],
        debtRecords: [],
        debtInstallments: [],
        emiTrackers: [],
        sipPlans: [],
        recurringBills: [],
        creditCardStatements: [],
        loadFinanceData: vi.fn().mockResolvedValue(undefined),
      })
    );
    (useFitnessStore as unknown as Mock).mockImplementation((selector: (s: any) => any) =>
      selector({
        profile: null,
        dailyLogs: [],
        mealLogs: [],
        workoutSessions: [],
        supplementInventory: [],
        supplementLogs: [],
        loadFitnessData: vi.fn().mockResolvedValue(undefined),
      })
    );
  });

  it('shows all 5 tabs when Finance and Fitness are enabled and switches range pills cleanly', async () => {
    (useGamificationStore as unknown as Mock).mockImplementation((selector: (s: any) => any) =>
      selector({
        settings: {
          showFinance: true,
          showFitness: true,
          habitOnlyMode: false,
          weekStartsOn: 1,
        },
      })
    );

    render(<AnalyticsPageContent />);

    expect(screen.getByRole('tab', { name: /Pulse/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Habits/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Finance/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Fitness/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Review/i })).toBeInTheDocument();

    const range90d = screen.getByRole('button', { name: '90D' });
    fireEvent.click(range90d);
    expect(range90d).toHaveAttribute('aria-pressed', 'true');

    await waitFor(() => {
      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    });
  });

  it('hides Finance and Fitness tabs when habitOnlyMode is active', () => {
    (useGamificationStore as unknown as Mock).mockImplementation((selector: (s: any) => any) =>
      selector({
        settings: {
          showFinance: true,
          showFitness: true,
          habitOnlyMode: true,
          weekStartsOn: 1,
        },
      })
    );

    render(<AnalyticsPageContent />);

    expect(screen.getByRole('tab', { name: /Pulse/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Habits/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Finance/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Fitness/i })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Review/i })).toBeInTheDocument();
  });
});
