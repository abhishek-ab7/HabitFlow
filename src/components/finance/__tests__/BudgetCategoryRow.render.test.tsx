import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MonthlyBudgetModal } from '../MonthlyBudgetModal';
import { useFinanceStore } from '@/lib/stores/finance-store';
import type { FinanceCategory } from '@/lib/types';

let rowIconRenderCount = 0;
vi.mock('../CategoryIcon', () => ({
  CategoryIcon: () => {
    rowIconRenderCount += 1;
    return <span data-testid="budget-cat-icon" />;
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const makeCat = (id: string, name: string): FinanceCategory => ({
  id,
  userId: 'u1',
  name,
  slug: id,
  type: 'expense',
  icon: 'tag',
  color: '#10b981',
  monthlyBudgetLimit: 1000,
  subcategories: [],
  order: 0,
  isSystem: false,
  archived: false,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
});

describe('BudgetCategoryRow render isolation', () => {
  beforeEach(() => {
    rowIconRenderCount = 0;
    useFinanceStore.setState({
      selectedMonth: '2026-11',
      categories: [makeCat('c1', 'Food'), makeCat('c2', 'Rent'), makeCat('c3', 'Travel')],
      budgets: [],
      transactions: [],
    });
  });

  it('editing one category envelope input re-renders only that row', () => {
    render(<MonthlyBudgetModal open={true} onOpenChange={vi.fn()} />);

    rowIconRenderCount = 0;
    const foodInput = screen.getByLabelText('Food');
    fireEvent.change(foodInput, { target: { value: '2500' } });

    expect(rowIconRenderCount).toBe(1);
  });
});
