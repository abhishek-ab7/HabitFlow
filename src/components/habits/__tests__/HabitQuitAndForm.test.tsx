import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
import { act, fireEvent, render, screen } from '@testing-library/react';
import { HabitFormModal } from '../habit-form-modal';
import { HabitGrid } from '../habit-grid';
import { useHabitStore } from '@/lib/stores/habit-store';
import { usePomodoroStore } from '@/lib/stores/pomodoro-store';
import type { Habit } from '@/lib/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('HabitFormModal & Quit Habit Grid UI (Slice 2B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useHabitStore.setState({
      habits: [],
      completions: [],
    });
    usePomodoroStore.setState({
      isRunning: false,
      mode: 'focus',
      urgeHabitId: null,
      urgeHabitName: null,
    });
  });

  it('allows creating a Quit habit with anchorBlock and fitness autoTrackRule', async () => {
    const onSubmit = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <HabitFormModal
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(screen.getByLabelText(/Habit Name/i), {
      target: { value: 'No Junk Food' },
    });
    fireEvent.click(screen.getByTestId('habit-polarity-quit'));
    fireEvent.click(screen.getByTestId('habit-anchor-night'));
    fireEvent.change(screen.getByLabelText(/Auto-Track Rule/i), {
      target: { value: 'zero_junk_today' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Create Habit/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'No Junk Food',
        polarity: 'quit',
        anchorBlock: 'night',
        autoTrackRule: 'zero_junk_today',
      })
    );
  });

  it('renders Quit shield/Clean so far badges and launches 10m Urge Timer', () => {
    const quitHabit: Habit = {
      id: 'h_quit_1',
      userId: 'u1',
      name: 'No Junk Food',
      category: 'health',
      targetDaysPerWeek: 7,
      polarity: 'quit',
      anchorBlock: 'night',
      autoTrackRule: 'zero_junk_today',
      archived: false,
      order: 0,
      createdAt: '2026-11-01T00:00:00.000Z',
    };

    const streaks = new Map<string, number>([['h_quit_1', 4]]);

    render(
      <HabitGrid
        habits={[quitHabit]}
        completions={[]}
        selectedMonth={new Date('2026-11-24T10:00:00.000Z')}
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onArchive={vi.fn()}
        streaks={streaks}
      />
    );

    expect(screen.getAllByText(/4d · Clean so far/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Quit').length).toBeGreaterThanOrEqual(1);

    const urgeButtons = screen.getAllByRole('button', { name: /10m Urge/i });
    fireEvent.click(urgeButtons[0]);

    const pomo = usePomodoroStore.getState();
    expect(pomo.mode).toBe('urge_10m');
    expect(pomo.isRunning).toBe(true);
    expect(pomo.urgeHabitId).toBe('h_quit_1');
    expect(pomo.urgeHabitName).toBe('No Junk Food');
  });
});
