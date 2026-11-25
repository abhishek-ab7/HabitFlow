import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { db } from '@/lib/db';
import { AddTransactionModal } from '../AddTransactionModal';
import { SmsImportModal } from '../SmsImportModal';
import { useFinanceStore } from '@/lib/stores/finance-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'bridge@example.com' },
    isLoading: false,
    isAuthenticated: true,
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

describe('Finance <-> Diet & Supplement Bridge Modals (Decision 4 RTL)', () => {
  const userId = 'test-user';
  const today = getLocalIsoDate();

  beforeEach(async () => {
    vi.clearAllMocks();
    await Promise.all([
      db.financeTransactions.clear(),
      db.financeAccounts.clear(),
      db.financeCategories.clear(),
      db.financeBudgets.clear(),
      db.monthlyCommitments.clear(),
      db.debtRecords.clear(),
      db.debtInstallments.clear(),
      db.emiTrackers.clear(),
      db.fitnessProfiles.clear(),
      db.fitnessDailyLogs.clear(),
      db.mealTemplates.clear(),
      db.mealLogs.clear(),
      db.workoutSessions.clear(),
      db.supplementInventory.clear(),
      db.supplementLogs.clear(),
    ]);

    const now = '2026-11-24T10:00:00.000Z';
    await db.financeAccounts.put({
      id: 'acc_upi',
      userId,
      name: 'GPay UPI',
      type: 'upi',
      balance: 5000,
      currency: 'INR',
      color: '#10b981',
      icon: 'Smartphone',
      isDefault: true,
      archived: false,
      createdAt: now,
      updatedAt: now,
    });

    await db.financeCategories.bulkPut([
      {
        id: 'cat_food',
        userId,
        name: 'Food & Dining',
        slug: 'food-dining',
        type: 'expense',
        icon: 'Utensils',
        color: '#f97316',
        monthlyBudgetLimit: 0,
        subcategories: [],
        order: 0,
        isSystem: true,
        archived: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'cat_junk',
        userId,
        name: 'Junk Food',
        slug: 'junk-food',
        type: 'expense',
        icon: 'Flame',
        color: '#f43f5e',
        monthlyBudgetLimit: 0,
        subcategories: [],
        order: 1,
        isSystem: true,
        archived: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'cat_supp',
        userId,
        name: 'Health & Supplements',
        slug: 'medical-supplements',
        type: 'expense',
        icon: 'HeartPulse',
        color: '#06b6d4',
        monthlyBudgetLimit: 0,
        subcategories: [],
        order: 2,
        isSystem: true,
        archived: false,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await db.supplementInventory.bulkPut([
      {
        id: 'sup_whey',
        userId,
        name: 'ON Gold Whey',
        brand: 'Optimum Nutrition',
        category: 'protein',
        unitLabel: 'scoop',
        totalServings: 30,
        remainingServings: 4,
        dailyDosage: 1,
        costInr: 2500,
        proteinPerServingG: 24,
        manualAdjustment: -26,
        lowStockThresholdDays: 7,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'sup_vitd',
        userId,
        name: 'Vitamin D3 2000 IU',
        category: 'vitamin',
        unitLabel: 'cap',
        totalServings: 60,
        remainingServings: 15,
        dailyDosage: 1,
        costInr: 600,
        manualAdjustment: -45,
        lowStockThresholdDays: 7,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await useFinanceStore.getState().loadFinanceData(userId);
    await useFitnessStore.getState().loadFitnessData(userId);
  });

  it('AddTransactionModal auto-logs Junk Food to Diet without asking & never double-logs, offers Food & Dining opt-in, and preserves manual supplement selection on Restock', async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <AddTransactionModal open={true} onOpenChange={onOpenChange} />
    );

    // 1. Default Food & Dining shows optional toggle chip and does NOT log MealLog when unchecked
    expect(screen.getByTestId('food-diet-bridge-chip')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Transaction Amount in Rupees'), {
      target: { value: '140' },
    });
    fireEvent.change(screen.getByLabelText('Merchant or Description'), {
      target: { value: 'Home Tiffin Lunch' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Entry' }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(await db.mealLogs.filter((m) => !m.deletedAt).toArray()).toHaveLength(0);

    // 2. Re-open and switch category to Junk Food -> automatic Diet badge without toggle
    rerender(<AddTransactionModal open={false} onOpenChange={onOpenChange} />);
    rerender(<AddTransactionModal open={true} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Food & Dining/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Junk Food' }));

    expect(screen.getByTestId('junk-auto-diet-badge')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Transaction Amount in Rupees'), {
      target: { value: '60' },
    });
    fireEvent.change(screen.getByLabelText('Merchant or Description'), {
      target: { value: 'Street Momos' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Entry' }));

    await waitFor(async () => {
      const meals = await db.mealLogs.filter((m) => !m.deletedAt).toArray();
      expect(meals).toHaveLength(1);
    });
    const autoMeals = await db.mealLogs.filter((m) => !m.deletedAt).toArray();
    expect(autoMeals[0].isJunk).toBe(true);
    expect(autoMeals[0].source).toBe('finance_bridge');
    expect(autoMeals[0].date).toBe(today);

    // 3. Health & Supplements 1-tap Restock chip preserves manual supplement pick across title edits
    rerender(<AddTransactionModal open={false} onOpenChange={onOpenChange} />);
    rerender(<AddTransactionModal open={true} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Food & Dining/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Health & Supplements' }));

    fireEvent.click(screen.getByTestId('supplement-restock-bridge-chip'));
    const suppSelect = screen.getByLabelText('Target Supplement') as HTMLSelectElement;
    fireEvent.change(suppSelect, { target: { value: 'sup_vitd' } });
    expect(suppSelect.value).toBe('sup_vitd');

    // Editing title to contain "whey" must NOT clobber the user's manual Vitamin D3 pick
    fireEvent.change(screen.getByLabelText('Merchant or Description'), {
      target: { value: 'Apollo Health Whey & Vit D Order' },
    });
    expect(suppSelect.value).toBe('sup_vitd');

    fireEvent.change(screen.getByLabelText('Transaction Amount in Rupees'), {
      target: { value: '899' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Entry' }));

    await waitFor(async () => {
      const vitd = await db.supplementInventory.get('sup_vitd');
      expect(vitd?.remainingServings).toBe(45); // 15 + 30 servings restocked
    });
  }, 15000);

  it('SmsImportModal auto-bridges Junk Food SMS without asking and supports 1-tap Restock Supplement on Health & Supplements SMS', async () => {
    const onOpenChange = vi.fn();
    render(<SmsImportModal open={true} onOpenChange={onOpenChange} />);

    const smsBatch = [
      'Paid Rs. 80.00 to Gupta Momos via GPay UPI on 24-11-26',
      'Paid Rs. 2,500.00 to HealthKart Whey Protein via GPay UPI on 24-11-26',
    ].join('\n\n');

    fireEvent.change(screen.getByLabelText(/Paste one or multiple SMS/i), {
      target: { value: smsBatch },
    });
    fireEvent.click(screen.getByRole('button', { name: /Detect Expenses/i }));

    // Junk Food badge rendered automatically
    expect(await screen.findByText(/Auto-logs ~\d+ kcal to Diet/i)).toBeInTheDocument();

    // Click 1-tap Restock Supplement chip for HealthKart Whey entry
    fireEvent.click(screen.getByRole('button', { name: /Restock Supplement/i }));

    fireEvent.click(screen.getByRole('button', { name: /Import 2 Entries/i }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    const txs = await db.financeTransactions.filter((t) => !t.deletedAt).toArray();
    expect(txs).toHaveLength(2);
    expect(txs.map((t) => ({ title: t.title, categoryId: t.categoryId }))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Gupta Momos', categoryId: 'cat_junk' }),
        expect.objectContaining({ title: 'HealthKart Whey Protein', categoryId: 'cat_supp' }),
      ])
    );

    const meals = await db.mealLogs.filter((m) => !m.deletedAt).toArray();
    expect(meals).toHaveLength(1);
    expect(meals[0].isJunk).toBe(true);
    expect(meals[0].source).toBe('finance_bridge');
    expect(meals[0].name).toBe('Gupta Momos');

    const whey = await db.supplementInventory.get('sup_whey');
    expect(whey?.remainingServings).toBe(34); // 4 + 30 default restock
  }, 15000);
});
