import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FitnessPageContent } from '../FitnessPageContent';
import { useFitnessStore } from '@/lib/stores/fitness';
import { useHabitStore } from '@/lib/stores/habit-store';
import { STARTER_INDIAN_STAPLES } from '@/lib/fitness/meal-estimator';

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'user-fit-1', email: 'fit@example.com' },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('/fitness Page & 5-Tab Shell RTL Smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const nowIso = '2026-11-24T10:00:00.000Z';

    useFitnessStore.setState({
      hasLoaded: true,
      currentUserId: 'user-fit-1',
      profile: {
        id: 'prof_1',
        userId: 'user-fit-1',
        currentWeightKg: 74,
        targetWeightKg: 68,
        calorieTarget: 2000,
        proteinTargetG: 130,
        waterTargetMl: 3000,
        stepsTarget: 8000,
        sleepTargetHours: 7.5,
        lowEnergyCalorieCeiling: 2250,
        lowEnergyStepsTarget: 3500,
        activityLevel: 'moderate',
        goalType: 'fat_loss',
        dietPreference: 'non_veg',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      dailyLogs: [],
      mealTemplates: STARTER_INDIAN_STAPLES.map((s, idx) => ({
        ...s,
        id: `tpl_${idx}`,
        userId: 'user-fit-1',
        order: idx,
        createdAt: nowIso,
        updatedAt: nowIso,
      })),
      mealLogs: [],
      workoutSessions: [],
      supplementInventory: [
        {
          id: 'sup_whey',
          userId: 'user-fit-1',
          name: 'Whey Isolate',
          category: 'protein',
          unitLabel: 'scoop',
          totalServings: 30,
          remainingServings: 24,
          dailyDosage: 1,
          costInr: 1500,
          proteinPerServingG: 24,
          anchorBlock: 'gym',
          lowStockThresholdDays: 7,
          isActive: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ],
      supplementLogs: [],
      loadFitnessData: vi.fn().mockResolvedValue(undefined),
    } as Partial<ReturnType<typeof useFitnessStore.getState>> as never);

    useHabitStore.setState({
      habits: [
        {
          id: 'h_quit',
          userId: 'user-fit-1',
          name: 'No Junk Food',
          category: 'health',
          targetDaysPerWeek: 7,
          polarity: 'quit',
          anchorBlock: 'night',
          autoTrackRule: 'zero_junk_today',
          archived: false,
          order: 0,
          createdAt: nowIso,
        },
      ],
      completions: [],
    });
  });

  it('renders all 5 fitness tabs and switches cleanly across Fuel, Body, Workouts, Supplements & Routines', async () => {
    render(<FitnessPageContent />);

    // Default tab: Fuel & Check-In
    expect(screen.getByText(/Body, Fuel & Fitness/i)).toBeInTheDocument();
    expect(screen.getByTestId('low-energy-toggle')).toBeInTheDocument();
    expect(screen.getByText('4 Boiled Eggs')).toBeInTheDocument();

    // Tab 2: Body Trends
    fireEvent.click(screen.getByRole('tab', { name: /Body Trends/i }));
    expect(await screen.findByText(/7-Day Rolling Average Weight/i)).toBeInTheDocument();

    // Tab 3: Workouts
    fireEvent.click(screen.getByRole('tab', { name: /Workouts/i }));
    expect(await screen.findByText(/Log Gym \/ Training Session/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Push' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '90s' })).toBeInTheDocument();

    // Tab 4: Supplements
    fireEvent.click(screen.getByRole('tab', { name: /Supplements/i }));
    expect(await screen.findByText(/Supplement Stock & Protein ROI/i)).toBeInTheDocument();
    expect(screen.getAllByText('Whey Isolate').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Boiled Eggs/i).length).toBeGreaterThanOrEqual(2);

    // Tab 5: Routines & Quit
    fireEvent.click(screen.getByRole('tab', { name: /Routines & Quit/i }));
    expect(await screen.findByText(/Anti-Habits \("Quit" Trackers\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Morning Anchor/i)).toBeInTheDocument();
    expect(screen.getByText(/Night Shutdown/i)).toBeInTheDocument();
  }, 15000);
});
