import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { CoachSwarmOutput } from '@/lib/ai/graphs/coach-swarm-types';
import { AICoachWidget } from '../../AICoachWidget';

const { mockPush, mockAddTask, mockToastSuccess, mockToastError, mockLoadUser } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockAddTask: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockLoadUser: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'alex@example.com' },
  }),
}));

vi.mock('@/lib/stores/user-store', () => ({
  useUserStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      displayName: 'Alex',
      email: 'alex@example.com',
      isLoading: false,
      loadUser: mockLoadUser,
    }),
}));

vi.mock('@/lib/stores/habit-store', () => ({
  useHabitStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      habits: [{ id: 'h1', name: 'Morning Run', archived: false }],
      completions: [],
    }),
}));

vi.mock('@/lib/stores/task-store', () => {
  const useTaskStore = (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      tasks: [],
      addTask: mockAddTask,
    });
  useTaskStore.getState = () => ({
    tasks: [],
    addTask: mockAddTask,
  });
  return { useTaskStore };
});

vi.mock('@/lib/stores/gamification-store', () => ({
  useGamificationStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      settings: { habitOnlyMode: false, showFinance: true },
    }),
}));

vi.mock('@/lib/stores/finance-store', () => ({
  useFinanceStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      transactions: [],
      categories: [],
      debtRecords: [],
      getSpendingAnomalies: () => [],
    }),
}));

vi.mock('@/lib/stores/fitness', () => ({
  useFitnessStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      profile: { proteinTargetG: 140, calorieTarget: 2200 },
      dailyLogs: [],
      mealLogs: [],
      workoutSessions: [],
      supplementInventory: [],
      supplementLogs: [],
    }),
}));

vi.mock('@/lib/stores/mood-store', () => ({
  useMoodStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      moodLogs: [],
    }),
}));

vi.mock('@/lib/intelligence/cross-domain-insights', () => ({
  computeCrossDomainInsights: () => ({
    alerts: [],
    walletWaistline: {
      spend14dInr: 0,
      emptyKcal14d: 0,
      fatLossDragKg14d: 0,
      savings70PctMonthlyInr: 0,
    },
    gymSupplementRoi: {
      gymCostPerWorkoutInr: null,
      primaryCostPer25gProteinInr: null,
    },
    triggers: {
      overallSpendMultiplier: 1,
      topTriggerLabel: null,
    },
    socialSpendDiet: {
      socialFoodSpend30dInr: 0,
    },
  }),
}));

const MOCK_BRIEFING: CoachSwarmOutput = {
  greeting: 'Good morning, Alex!',
  focus: 'Protect your morning habit block and review weekend dining spend.',
  quote: 'Small disciplines repeated with consistency lead to great achievements.',
  consultedSpecialists: ['cfo', 'habit', 'fitness'],
  actionProposals: [
    {
      id: 'prop-task-1',
      specialist: 'habit',
      label: 'Schedule 15m evening wind-down',
      description: 'Lock in sleep consistency to support tomorrow’s workout.',
      kind: 'create_task',
      payload: {
        title: '15m evening wind-down',
        priority: 'high',
      },
    },
    {
      id: 'prop-nav-1',
      specialist: 'cfo',
      label: 'Review Dining Budget',
      description: 'Check this week’s food delivery spending in Finance.',
      kind: 'navigate',
      payload: {
        target: 'finance',
      },
    },
  ],
  guardrail: {
    handoffsUsed: 3,
    maxHandoffs: 4,
    tokenBudget: 4000,
    readOnlyEnforced: true,
  },
};

describe('AICoachWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockAddTask.mockResolvedValue({ id: 'task-new' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => MOCK_BRIEFING,
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders briefing with SpecialistBadgeStrip and CoachActionCard and never auto-executes on fetch', async () => {
    render(<AICoachWidget />);

    fireEvent.click(screen.getByRole('button', { name: /generate daily briefing/i }));

    expect(await screen.findByTestId('specialist-badge-strip')).toBeInTheDocument();
    expect(screen.getByText('Personal CFO')).toBeInTheDocument();
    expect(screen.getByText('Habit Psychologist')).toBeInTheDocument();
    expect(screen.getByText('Fitness Coach')).toBeInTheDocument();

    expect(screen.getByTestId('coach-action-proposals')).toBeInTheDocument();
    expect(screen.getByText('Schedule 15m evening wind-down')).toBeInTheDocument();
    expect(screen.getByText('Review Dining Budget')).toBeInTheDocument();

    // HITL guardrail: nothing auto-executes on fetch
    expect(mockAddTask).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('calls addTask, shows toast, and removes the card when clicking Accept on a create_task proposal', async () => {
    render(<AICoachWidget />);

    fireEvent.click(screen.getByRole('button', { name: /generate daily briefing/i }));
    await screen.findByTestId('coach-action-proposals');

    const acceptButtons = screen.getAllByRole('button', { name: /^accept$/i });
    fireEvent.click(acceptButtons[0]);

    await waitFor(() => {
      expect(mockAddTask).toHaveBeenCalledTimes(1);
    });
    expect(mockAddTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '15m evening wind-down',
        priority: 'high',
      })
    );
    expect(mockToastSuccess).toHaveBeenCalledWith('Task added: 15m evening wind-down');
    expect(screen.queryByText('Schedule 15m evening wind-down')).not.toBeInTheDocument();
    // Second proposal remains visible
    expect(screen.getByText('Review Dining Budget')).toBeInTheDocument();
  });

  it('navigates when clicking Accept on a navigate proposal and removes card on Dismiss without calling addTask', async () => {
    render(<AICoachWidget />);

    fireEvent.click(screen.getByRole('button', { name: /generate daily briefing/i }));
    await screen.findByTestId('coach-action-proposals');

    const dismissButtons = screen.getAllByRole('button', { name: /^dismiss$/i });
    fireEvent.click(dismissButtons[0]);

    expect(screen.queryByText('Schedule 15m evening wind-down')).not.toBeInTheDocument();
    expect(mockAddTask).not.toHaveBeenCalled();

    const remainingAccept = screen.getByRole('button', { name: /^accept$/i });
    fireEvent.click(remainingAccept);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/finance');
    });
  });
});
