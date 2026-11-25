import { describe, expect, it } from 'vitest';
import { parseUniversalCapture } from '../universal-parser';
import { STARTER_INDIAN_STAPLES } from '@/lib/fitness/meal-estimator';
import type { MealTemplate, SupplementInventory } from '@/lib/types';

const nowIso = '2026-11-24T10:00:00.000Z';

const templates: MealTemplate[] = STARTER_INDIAN_STAPLES.map((s, idx) => ({
  ...s,
  id: `tpl_${idx}`,
  userId: 'u1',
  order: idx,
  createdAt: nowIso,
  updatedAt: nowIso,
}));

const accounts = [
  { id: 'acc_upi', name: 'HDFC UPI', type: 'upi' },
  { id: 'acc_slice', name: 'Slice CC', type: 'credit_card' },
  { id: 'acc_axis', name: 'Axis CC', type: 'credit_card' },
  { id: 'acc_cash', name: 'Cash Wallet', type: 'cash' },
];

const categories = [
  { id: 'cat_food', name: 'Food & Dining', slug: 'food-dining', type: 'expense' },
  { id: 'cat_junk', name: 'Junk Food', slug: 'junk-food', type: 'expense' },
  { id: 'cat_health', name: 'Health & Supplements', slug: 'health-supplements', type: 'expense' },
  { id: 'cat_transport', name: 'Transport', slug: 'transport-travel', type: 'expense' },
];

const supplements: SupplementInventory[] = [
  {
    id: 'sup_creatine',
    userId: 'u1',
    name: 'Creatine Monohydrate',
    category: 'creatine',
    unitLabel: 'scoop',
    totalServings: 60,
    remainingServings: 45,
    dailyDosage: 1,
    costInr: 999,
    lowStockThresholdDays: 7,
    isActive: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  },
];

const ctx = {
  todayIso: '2026-11-24',
  accounts,
  categories,
  mealTemplates: templates,
  supplements,
};

describe('10-Second Universal Capture Parser', () => {
  it('parses "4 eggs + oats + milk" preserving Oats + Milk combo into 2 separate meals', () => {
    const res = parseUniversalCapture('4 eggs + oats + milk', ctx);
    const meals = res.actions.filter((a) => a.kind === 'meal');

    expect(res.actions).toHaveLength(2);
    expect(meals).toHaveLength(2);
    expect(meals[0]).toMatchObject({ name: '4 Boiled Eggs', calories: 280, proteinG: 24 });
    expect(meals[1]).toMatchObject({ name: 'Oats + Milk', calories: 340, proteinG: 14 });
  });

  it('parses "momo 60 slice" into linked Junk Food expense on Slice CC + Diet meal without duplicate expense/food flags', () => {
    const res = parseUniversalCapture('momo 60 slice', ctx);
    const expenses = res.actions.filter((a) => a.kind === 'expense');
    const meals = res.actions.filter((a) => a.kind === 'meal');

    expect(expenses).toHaveLength(1);
    expect(meals).toHaveLength(1);
    expect(expenses[0]).toMatchObject({
      amount: 60,
      accountId: 'acc_slice',
      categoryId: 'cat_junk',
      isJunkFood: true,
      linkDietMealId: meals[0].id,
    });
    expect(meals[0]).toMatchObject({
      name: 'Momo',
      calories: 350,
      isJunk: true,
      linkedExpenseActionId: expenses[0].id,
    });
  });

  it('parses "push workout 45m + 9000 steps" into workout session + bio exact steps', () => {
    const res = parseUniversalCapture('push workout 45m + 9000 steps', ctx);
    const workouts = res.actions.filter((a) => a.kind === 'workout');
    const bios = res.actions.filter((a) => a.kind === 'bio');

    expect(workouts).toHaveLength(1);
    expect(workouts[0]).toMatchObject({
      title: 'Push Workout',
      workoutType: 'push',
      durationMinutes: 45,
    });
    expect(bios).toHaveLength(1);
    expect(bios[0]).toMatchObject({ stepsExact: 9000 });
  });

  it('parses Hinglish bio check-in ("neend 7.5h, energy 4, wazan 74.2, kamar 32.5, paani 500ml")', () => {
    const res = parseUniversalCapture(
      'neend 7.5h, energy 4, wazan 74.2, kamar 32.5, paani 500ml',
      ctx
    );
    const bios = res.actions.filter((a) => a.kind === 'bio');

    expect(bios).toHaveLength(1);
    expect(bios[0]).toMatchObject({
      sleepHours: 7.5,
      energyLevel: 4,
      weightKg: 74.2,
      waistInches: 32.5,
      waterDeltaMl: 500,
    });
  });

  it('treats bulk supplement purchase "whey 1299 slice" as Health & Supplements expense only (not a consumed meal)', () => {
    const res = parseUniversalCapture('whey 1299 slice', ctx);
    const expenses = res.actions.filter((a) => a.kind === 'expense');
    const meals = res.actions.filter((a) => a.kind === 'meal');

    expect(expenses).toHaveLength(1);
    expect(meals).toHaveLength(0);
    expect(expenses[0]).toMatchObject({
      amount: 1299,
      accountId: 'acc_slice',
      categoryId: 'cat_health',
      isJunkFood: false,
    });
  });

  it('matches supplement dose & falls back cleanly to task for pure reminders', () => {
    const suppRes = parseUniversalCapture('took creatine', ctx);
    const supps = suppRes.actions.filter((a) => a.kind === 'supplement');
    expect(supps).toHaveLength(1);
    expect(supps[0]).toMatchObject({ supplementId: 'sup_creatine' });

    const taskRes = parseUniversalCapture('Pay Slice CC bill tomorrow !p1', ctx);
    const tasks = taskRes.actions.filter((a) => a.kind === 'task');
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      priority: 'high',
      isUrgent: true,
      domainTag: 'finance',
      dueDate: '2026-11-25',
    });
  });

  it('returns empty actions safely for empty/whitespace input', () => {
    expect(parseUniversalCapture('   ', ctx).actions).toEqual([]);
  });
});
