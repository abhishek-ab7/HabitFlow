import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HabitGrid } from '../habit-grid';
import { useHabitStore } from '@/lib/stores/habit-store';
import { getCellStatusInfo } from '../row/habit-row-helpers';
import type { Habit } from '@/lib/types';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Passthrough spy: counts how many day cells re-derive their status (one call per cell render).
vi.mock('../row/habit-row-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../row/habit-row-helpers')>();
  return { ...actual, getCellStatusInfo: vi.fn(actual.getCellStatusInfo) };
});

const habit: Habit = {
  id: 'h1',
  userId: 'u1',
  name: 'Read',
  category: 'learning',
  targetDaysPerWeek: 7,
  archived: false,
  order: 0,
  createdAt: '2026-11-01T00:00:00.000Z',
};

describe('HabitDayCell render isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useHabitStore.setState({ habits: [], completions: [] });
  });

  it('typing in one cell note popover re-renders at most that cell, not the whole row', () => {
    render(
      <HabitGrid
        habits={[habit]}
        completions={[]}
        selectedMonth={new Date('2026-11-24T10:00:00.000Z')}
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onArchive={vi.fn()}
        streaks={new Map([['h1', 0]])}
      />
    );

    fireEvent.click(screen.getAllByTitle('Add note / edit count')[0]);
    const textarea = screen.getByPlaceholderText(/Write a reflection or note/i);

    vi.mocked(getCellStatusInfo).mockClear();
    fireEvent.change(textarea, { target: { value: 'a' } });

    expect(vi.mocked(getCellStatusInfo).mock.calls.length).toBeLessThanOrEqual(1);
  });
});
