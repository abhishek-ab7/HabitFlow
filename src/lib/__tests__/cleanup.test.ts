import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { ALL_DEXIE_TABLE_NAMES, clearAllLocalData } from '../cleanup';

describe('cleanup utilities', () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearAllLocalData();
  });

  it('tracks all 27 Dexie tables and clears every one including creditCardStatements and fitness tables', async () => {
    expect(ALL_DEXIE_TABLE_NAMES).toHaveLength(27);
    expect(ALL_DEXIE_TABLE_NAMES).toContain('creditCardStatements');
    expect(ALL_DEXIE_TABLE_NAMES).toContain('mealLogs');
    expect(ALL_DEXIE_TABLE_NAMES).toContain('supplementInventory');

    const now = new Date().toISOString();
    await db.habits.add({
      id: 'h-1',
      userId: 'u-1',
      name: 'Run',
      category: 'health',
      frequencyType: 'daily',
      targetCount: 1,
      archived: false,
      order: 0,
      createdAt: now,
      updatedAt: now,
    } as never);
    await db.creditCardStatements.add({
      id: 'cc-1',
      userId: 'u-1',
      accountId: 'acc-1',
      cycleKey: '2026-11',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      dueDate: '2026-12-15',
      totalAmount: 1000,
      paidAmount: 0,
      status: 'open',
      updatedAt: now,
    } as never);
    await db.mealLogs.add({
      id: 'm-1',
      userId: 'u-1',
      date: '2026-11-25',
      mealType: 'lunch',
      name: 'Dal Rice',
      calories: 500,
      proteinG: 18,
      carbsG: 70,
      fatsG: 12,
      createdAt: now,
      updatedAt: now,
    } as never);

    localStorage.setItem('habitflow_color_theme', 'warm-stone-forest');
    localStorage.setItem('habit_sync_last_at_u-1', now);
    localStorage.setItem('flowfinance_fresh_start_v2_u-1', '1');
    localStorage.setItem('hf_fitness_staples_seeded_u-1', '1');
    localStorage.setItem('ai_coach_advice_u-1', '{}');
    localStorage.setItem('feedback_settings', '{}');
    localStorage.setItem('unrelated_key', 'keep');

    await clearAllLocalData();

    expect(await db.habits.count()).toBe(0);
    expect(await db.creditCardStatements.count()).toBe(0);
    expect(await db.mealLogs.count()).toBe(0);

    expect(localStorage.getItem('habitflow_color_theme')).toBeNull();
    expect(localStorage.getItem('habit_sync_last_at_u-1')).toBeNull();
    expect(localStorage.getItem('flowfinance_fresh_start_v2_u-1')).toBeNull();
    expect(localStorage.getItem('hf_fitness_staples_seeded_u-1')).toBeNull();
    expect(localStorage.getItem('ai_coach_advice_u-1')).toBeNull();
    expect(localStorage.getItem('feedback_settings')).toBeNull();
    expect(localStorage.getItem('unrelated_key')).toBe('keep');
  });
});
