import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QuickCaptureModal } from '../QuickCaptureModal';
import { useFinanceStore } from '@/lib/stores/finance-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import { useTaskStore } from '@/lib/stores/task-store';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('QuickCaptureModal (10-Second Universal Capture RTL Smoke)', () => {
  const addTransactionMock = vi.fn().mockResolvedValue({ id: 'tx_capture_1', amount: 60, title: 'Momo' });
  const upsertMealFromCaptureMock = vi.fn().mockResolvedValue({ id: 'meal_1', calories: 350 });
  const incrementWaterMock = vi.fn().mockResolvedValue({});
  const incrementStepsMock = vi.fn().mockResolvedValue({});
  const addTaskMock = vi.fn().mockResolvedValue({ id: 'task_1' });

  beforeEach(() => {
    vi.clearAllMocks();
    useFinanceStore.setState({
      accounts: [
        {
          id: 'acc_slice',
          userId: 'test-user',
          name: 'Slice CC',
          type: 'credit_card',
          balance: 0,
          currency: 'INR',
          color: '#6366f1',
          icon: 'credit-card',
          isDefault: false,
          archived: false,
          createdAt: '2026-11-24',
          updatedAt: '2026-11-24',
        },
      ],
      categories: [
        {
          id: 'cat_junk',
          userId: 'test-user',
          name: 'Junk Food',
          slug: 'junk-food',
          type: 'expense',
          icon: 'pizza',
          color: '#ef4444',
          monthlyBudgetLimit: 0,
          subcategories: [],
          order: 0,
          isSystem: true,
          archived: false,
          createdAt: '2026-11-24',
          updatedAt: '2026-11-24',
        },
      ],
      loadFinanceData: vi.fn().mockResolvedValue(undefined),
      addTransaction: addTransactionMock,
    } as Partial<ReturnType<typeof useFinanceStore.getState>> as never);

    useFitnessStore.setState({
      hasLoaded: true,
      mealTemplates: [],
      supplementInventory: [],
      loadFitnessData: vi.fn().mockResolvedValue(undefined),
      upsertMealFromCapture: upsertMealFromCaptureMock,
      incrementWater: incrementWaterMock,
      incrementSteps: incrementStepsMock,
    } as Partial<ReturnType<typeof useFitnessStore.getState>> as never);

    useTaskStore.setState({
      addTask: addTaskMock,
    } as Partial<ReturnType<typeof useTaskStore.getState>> as never);
  });

  it('opens on custom event, previews compound "momo 60 slice" actions, and executes linked mutations', async () => {
    render(<QuickCaptureModal />);

    await act(async () => {
      window.dispatchEvent(new Event('open-quick-capture'));
    });

    expect(screen.getByText('10-Second Universal Capture')).toBeInTheDocument();
    expect(screen.getByText('+250ml')).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/momo 60 slice/i);
    fireEvent.change(input, { target: { value: 'momo 60 slice' } });

    await waitFor(() => {
      expect(screen.getByText(/Detected Actions \(2\/2\)/i)).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /Log All \(2\)/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(addTransactionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 60,
          categoryId: 'cat_junk',
          accountId: 'acc_slice',
        })
      );
      expect(upsertMealFromCaptureMock).toHaveBeenCalledWith(
        expect.objectContaining({
          calories: 350,
          isJunk: true,
          linkedTransactionId: 'tx_capture_1',
        })
      );
    });
  });
});
