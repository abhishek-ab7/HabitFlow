import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ActivityTab } from '../ActivityTab';
import { useFinanceStore } from '@/lib/stores/finance-store';
import type { FinanceAccount, FinanceCategory, FinanceTransaction } from '@/lib/types';

let iconRenderCount = 0;
vi.mock('../CategoryIcon', () => ({
  CategoryIcon: () => {
    iconRenderCount += 1;
    return <span data-testid="cat-icon" />;
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const cat: FinanceCategory = {
  id: 'c1',
  userId: 'u1',
  name: 'Food',
  slug: 'food',
  type: 'expense',
  icon: 'utensils',
  color: '#10b981',
  monthlyBudgetLimit: 5000,
  subcategories: [],
  order: 0,
  isSystem: false,
  archived: false,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

const acc: FinanceAccount = {
  id: 'a1',
  userId: 'u1',
  name: 'Bank',
  type: 'bank',
  currency: 'INR',
  color: '#10b981',
  icon: 'wallet',
  balance: 10000,
  isDefault: true,
  archived: false,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

const makeTx = (id: string, title: string): FinanceTransaction => ({
  id,
  userId: 'u1',
  title,
  amount: 250,
  type: 'expense',
  categoryId: 'c1',
  accountId: 'a1',
  date: '2026-11-24',
  monthKey: '2026-11',
  isRecurring: false,
  tags: [],
  needsReview: false,
  createdAt: '2026-11-24T10:00:00.000Z',
  updatedAt: '2026-11-24T10:00:00.000Z',
});

describe('ActivityTransactionRow render isolation', () => {
  beforeEach(() => {
    iconRenderCount = 0;
    useFinanceStore.setState({
      selectedMonth: '2026-11',
      categories: [cat],
      accounts: [acc],
      commitments: [],
      transactions: [makeTx('t1', 'Lunch'), makeTx('t2', 'Dinner'), makeTx('t3', 'Coffee')],
      filters: {
        searchQuery: '',
        type: 'all',
        categoryId: 'all',
        accountId: 'all',
        commitmentId: 'all',
        debtId: 'all',
        tag: 'all',
        needsReview: 'all',
      },
    });
  });

  it('selecting one row re-renders only that row, not sibling rows', () => {
    render(
      <ActivityTab
        onEditTransaction={vi.fn()}
        onOpenAddTransaction={vi.fn()}
        onOpenSmsImport={vi.fn()}
      />
    );

    iconRenderCount = 0;
    const selectBtns = screen.getAllByRole('button', { name: /Select transaction/i });
    fireEvent.click(selectBtns[0]);

    expect(iconRenderCount).toBe(1);
  });
});
