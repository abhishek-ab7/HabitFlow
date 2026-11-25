import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { isFitnessModuleEnabled } from '@/lib/workspace-modules';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import { useHabitStore } from '@/lib/stores/habit-store';
import { CrossDomainActionMediator } from '@/lib/stores/mediator';
import { FitnessPageContent } from '@/components/fitness/FitnessPageContent';
import SettingsPageContent from '@/components/settings/SettingsPageContent';
import type { FinanceCategory, FinanceTransaction, UserSettings } from '@/lib/types';

const mockUpdateSettings = vi.fn();
const mockGetSettings = vi.fn();
const mockPushUserSettings = vi.fn();
const mockUser = {
  id: 'user-toggle-1',
  email: 'toggle@example.com',
  user_metadata: {},
};

vi.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    theme: 'system',
    setTheme: vi.fn(),
    resolvedTheme: 'light',
    colorTheme: 'obsidian-mint',
    setColorTheme: vi.fn(),
    accentOverride: 'theme',
    setAccentOverride: vi.fn(),
    resetAppearance: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/settings',
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock('@/providers/sync-provider', () => ({
  useSync: () => ({
    isSyncing: false,
    isStoragePersistent: true,
    syncStatus: 'idle',
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/components/settings/DataVaultCard', () => ({
  DataVaultCard: () => <div data-testid="data-vault-mock" />,
}));

vi.mock('@/components/settings/SyncStatusPanel', () => ({
  SyncStatusPanel: () => <div data-testid="sync-status-mock" />,
}));

vi.mock('@/components/settings/McpConnectionsCard', () => ({
  McpConnectionsCard: () => <div data-testid="mcp-connections-mock" />,
}));

vi.mock('@/components/settings/SettingsHero', () => ({
  SettingsHero: () => <div data-testid="settings-hero-mock" />,
}));

vi.mock('@/components/settings/AvatarSelector', () => ({
  AvatarSelector: () => null,
}));

vi.mock('@/components/settings/password-change-modal', () => ({
  PasswordChangeModal: () => null,
}));

const mockUserStoreValue = {
  displayName: 'Tester',
  email: 'toggle@example.com',
  setDisplayName: vi.fn(),
  saveDisplayNameToServer: vi.fn(async () => {}),
  loadUser: vi.fn(async () => {}),
};

vi.mock('@/lib/stores/user-store', () => ({
  useUserStore: () => mockUserStoreValue,
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: 'user-toggle-1' } } },
      })),
    },
  }),
}));

vi.mock('@/lib/sync', () => ({
  getSyncEngine: () => ({
    pushUserSettings: mockPushUserSettings,
    forceSyncAll: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock('@/lib/cleanup', () => ({
  cleanupAllDuplicates: vi.fn(async () => ({ habitsRemoved: 0, goalsRemoved: 0, completionsRemoved: 0 })),
  countAllDuplicates: vi.fn(async () => ({ habits: 0, goals: 0, completions: 0 })),
}));

vi.mock('@/lib/force-sync', () => ({
  forcePushAllHabits: vi.fn(async () => {}),
}));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return {
    ...actual,
    getSettings: (...args: unknown[]) => mockGetSettings(...args),
    updateSettings: (...args: unknown[]) => mockUpdateSettings(...args),
  };
});

function makeSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    id: 'settings-1',
    userId: 'user-toggle-1',
    theme: 'system',
    accent: 'mint',
    userName: 'Tester',
    weekStartsOn: 0,
    showMotivationalQuotes: true,
    defaultCategory: 'health',
    createdAt: '2026-11-24T10:00:00.000Z',
    updatedAt: '2026-11-24T10:00:00.000Z',
    xp: 0,
    level: 1,
    gems: 0,
    streakShield: 0,
    avatarId: 'avatar-1',
    showTasks: true,
    showGoals: true,
    showMilestones: true,
    showFinance: true,
    showFitness: true,
    habitOnlyMode: false,
    ...overrides,
  };
}

describe('Fitness Feature Settings ON/OFF Toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const initialSettings = makeSettings({ showFitness: true });
    mockGetSettings.mockResolvedValue(initialSettings);
    mockUpdateSettings.mockResolvedValue(undefined);
    useGamificationStore.setState({
      settings: initialSettings,
      streakShield: 0,
      isLoading: false,
    });
    useHabitStore.setState({ habits: [], completions: [] });
    useFitnessStore.setState({
      hasLoaded: true,
      currentUserId: 'user-toggle-1',
      profile: null,
      dailyLogs: [],
      mealTemplates: [],
      mealLogs: [],
      workoutSessions: [],
      supplementInventory: [],
      supplementLogs: [],
    });
  });

  it('evaluates isFitnessModuleEnabled correctly across flags', () => {
    expect(isFitnessModuleEnabled(null)).toBe(true);
    expect(isFitnessModuleEnabled({ showFitness: true, habitOnlyMode: false })).toBe(true);
    expect(isFitnessModuleEnabled({ showFitness: false, habitOnlyMode: false })).toBe(false);
    expect(isFitnessModuleEnabled({ showFitness: true, habitOnlyMode: true })).toBe(false);
  });

  it('toggles Body & Fitness off and back on from SettingsPageContent', async () => {
    render(<SettingsPageContent />);

    const toggle = await screen.findByTestId('toggle-fitness-module');
    expect(toggle).toHaveAttribute('role', 'switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toHaveTextContent('On');

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-toggle-1',
          showFitness: false,
        })
      );
      expect(useGamificationStore.getState().settings?.showFitness).toBe(false);
    });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveTextContent('Off');

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-toggle-1',
          showFitness: true,
        })
      );
      expect(useGamificationStore.getState().settings?.showFitness).toBe(true);
    });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toHaveTextContent('On');
  });

  it('shows disabled state with 1-click re-enable on /fitness when turned off', async () => {
    useGamificationStore.setState({
      settings: makeSettings({ showFitness: false }),
    });

    render(<FitnessPageContent />);

    expect(screen.getByTestId('fitness-module-disabled')).toBeInTheDocument();
    expect(screen.getByText(/Body & Fitness Module is Turned Off/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Turn On Body & Fitness/i }));

    await waitFor(() => {
      expect(useGamificationStore.getState().settings?.showFitness).toBe(true);
    });
  });

  it('skips automatic Junk Food -> Diet bridging in mediator when Fitness is turned off', async () => {
    const ensureMealSpy = vi.fn(async () => null);
    useFitnessStore.setState({
      ensureMealForJunkTransaction: ensureMealSpy as any,
    });
    useGamificationStore.setState({
      settings: makeSettings({ showFitness: false }),
    });

    const junkCategory: FinanceCategory = {
      id: 'cat-junk',
      userId: 'user-toggle-1',
      name: 'Junk Food',
      slug: 'junk-food',
      type: 'expense',
      icon: 'Flame',
      color: '#ef4444',
      subcategories: [],
      monthlyBudgetLimit: 300,
      rolloverEnabled: false,
      order: 1,
      isSystem: true,
      archived: false,
      generationCounter: 1,
      createdAt: '2026-11-24T10:00:00.000Z',
      updatedAt: '2026-11-24T10:00:00.000Z',
    };

    const junkTx: FinanceTransaction = {
      id: 'tx-junk-1',
      userId: 'user-toggle-1',
      title: 'Momo',
      amount: 60,
      type: 'expense',
      categoryId: 'cat-junk',
      accountId: 'acc-1',
      date: '2026-11-25',
      monthKey: '2026-11',
      tags: [],
      isRecurring: false,
      needsReview: false,
      generationCounter: 1,
      createdAt: '2026-11-25T10:00:00.000Z',
      updatedAt: '2026-11-25T10:00:00.000Z',
    };

    await CrossDomainActionMediator.onFinanceEvent({
      type: 'EXPENSE_LOGGED',
      date: '2026-11-25',
      amount: 60,
      transaction: junkTx,
      category: junkCategory,
    });

    expect(ensureMealSpy).not.toHaveBeenCalled();

    useGamificationStore.setState({
      settings: makeSettings({ showFitness: true }),
    });

    await CrossDomainActionMediator.onFinanceEvent({
      type: 'EXPENSE_LOGGED',
      date: '2026-11-25',
      amount: 60,
      transaction: junkTx,
      category: junkCategory,
    });

    expect(ensureMealSpy).toHaveBeenCalledTimes(1);
  });
});
