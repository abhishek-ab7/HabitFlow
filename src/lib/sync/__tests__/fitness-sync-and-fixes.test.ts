import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import {
  clearFitnessMissingTableCache,
  FitnessSyncEngine,
} from '../engines/fitness-sync';
import { clearMissingColumnCache } from '../engines/column-fallback';
import { TasksSyncEngine } from '../engines/tasks-sync';
import { GoalsSyncEngine } from '../engines/goals-sync';
import { HabitsSyncEngine } from '../engines/habits-sync';
import { MoodLogsSyncEngine } from '../engines/settings-sync';
import { useFitnessStore } from '@/lib/stores/fitness';
import { useFinanceStore } from '@/lib/stores/finance-store';
import { useHabitStore } from '@/lib/stores/habit-store';
import { CrossDomainActionMediator } from '@/lib/stores/mediator';
import { getSyncEngine } from '../sync-engine';

const { mockPushCompletion, activeFakeSb } = vi.hoisted(() => ({
  mockPushCompletion: vi.fn().mockResolvedValue(undefined),
  activeFakeSb: { current: null as any },
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => activeFakeSb.current),
  getSupabaseClient: vi.fn(() => activeFakeSb.current),
}));

vi.mock('../sync-engine', () => ({
  getSyncEngine: vi.fn(() => ({
    pushCompletion: mockPushCompletion,
    triggerFinanceSync: vi.fn(),
    triggerFitnessSync: vi.fn(),
  })),
}));

interface RemoteTableBehavior {
  rows?: any[];
  selectError?: any;
  upsertSpy?: ReturnType<typeof vi.fn>;
  missingColumns?: Set<string>;
}

function createMockQueryBuilder(cfg: RemoteTableBehavior) {
  const resultPayload = {
    data: cfg.selectError ? null : cfg.rows || [],
    error: cfg.selectError || null,
  };
  const makeSelectBuilder = () => {
    const p: any = Promise.resolve(resultPayload);
    p.eq = vi.fn(() => makeSelectBuilder());
    p.gt = vi.fn(() => makeSelectBuilder());
    p.order = vi.fn(() => makeSelectBuilder());
    p.single = vi.fn(() =>
      Promise.resolve({ data: cfg.rows?.[0] ?? null, error: cfg.selectError || null })
    );
    return p;
  };
  return makeSelectBuilder;
}

function findMissingColumnError(
  rows: any[],
  missingColumns: Set<string> | undefined,
  tableName: string
) {
  if (!missingColumns) return null;
  for (const row of rows) {
    for (const col of missingColumns) {
      if (!Object.prototype.hasOwnProperty.call(row, col)) continue;
      return {
        code: 'PGRST204',
        message: `Could not find the '${col}' column of '${tableName}' in the schema cache`,
      };
    }
  }
  return null;
}

function makeFakeSupabase(
  userId: string,
  tables: Record<string, RemoteTableBehavior>
) {
  const sb = {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: userId } } },
        error: null,
      }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    },
    from: vi.fn((tableName: string) => {
      const cfg = tables[tableName] || { rows: [] };
      const makeSelectBuilder = createMockQueryBuilder(cfg);
      return {
        select: vi.fn(() => makeSelectBuilder()),
        upsert: vi.fn((payload: any, opts?: any) => {
          cfg.upsertSpy?.(payload, opts);
          const rows = Array.isArray(payload) ? payload : [payload];
          const error = findMissingColumnError(rows, cfg.missingColumns, tableName);
          return Promise.resolve({ error });
        }),
      };
    }),
  };
  activeFakeSb.current = sb;
  return sb;
}

describe('Phase 2A Fitness Sync, Column Fallbacks & Junk Food Diet Bridge', () => {
  const userId = 'user-sync-1';

  beforeEach(async () => {
    vi.clearAllMocks();
    makeFakeSupabase(userId, {});
    clearMissingColumnCache();
    clearFitnessMissingTableCache();
    useFitnessStore.getState().clearFitnessState();
    useHabitStore.setState({ habits: [], completions: [] });

    await Promise.all([
      db.fitnessProfiles.clear(),
      db.fitnessDailyLogs.clear(),
      db.mealTemplates.clear(),
      db.mealLogs.clear(),
      db.workoutSessions.clear(),
      db.supplementInventory.clear(),
      db.supplementLogs.clear(),
      db.habits.clear(),
      db.completions.clear(),
      db.goals.clear(),
      db.tasks.clear(),
      db.moodLogs.clear(),
      db.financeCategories.clear(),
      db.financeAccounts.clear(),
      db.financeTransactions.clear(),
    ]);
  });

  it('FitnessSyncEngine merges partial daily logs (pull-before-push), migrates orphans & deduplicates', async () => {
    const dailyUpsertSpy = vi.fn();
    makeFakeSupabase(userId, {
      fitness_profiles: { rows: [] },
      fitness_daily_logs: {
        upsertSpy: dailyUpsertSpy,
        rows: [
          {
            id: 'remote-dl-1',
            user_id: userId,
            date: '2026-11-24',
            weight_kg: 74.2,
            waist_inches: 32.5,
            water_ml: 1500,
            steps: 3000,
            sleep_hours: 7.5,
            energy_level: 4,
            generation_counter: 5,
            updated_at: '2026-11-24T09:00:00.000Z',
            created_at: '2026-11-24T06:00:00.000Z',
          },
        ],
      },
      meal_templates: { rows: [] },
      meal_logs: { rows: [] },
      workout_sessions: { rows: [] },
      supplement_inventory: { rows: [] },
      supplement_logs: { rows: [] },
    });

    // Local dirty log from desktop has higher steps (8000) & null weight/sleep + orphan record
    await db.fitnessDailyLogs.put({
      id: 'local-dl-1',
      userId: 'local-demo-user', // also verifies orphan migration
      date: '2026-11-24',
      weightKg: null,
      waistInches: null,
      waterMl: 500,
      steps: 8000,
      sleepHours: null,
      energyLevel: null,
      generationCounter: 2,
      isDirty: true,
      createdAt: '2026-11-24T07:00:00.000Z',
      updatedAt: '2026-11-24T08:00:00.000Z',
    });

    const engine = new FitnessSyncEngine();
    const report = await engine.sync(userId);

    expect(report.status).toBe('success');
    expect(report.errors).toEqual([]);
    expect(report.pulled).toBeGreaterThanOrEqual(1);
    expect(report.pushed).toBeGreaterThanOrEqual(1);

    const savedLogs = await db.fitnessDailyLogs.toArray();
    expect(savedLogs).toHaveLength(1);
    expect(savedLogs[0].userId).toBe(userId);
    expect(savedLogs[0].weightKg).toBe(74.2);
    expect(savedLogs[0].sleepHours).toBe(7.5);
    expect(savedLogs[0].waterMl).toBe(1500);
    expect(savedLogs[0].steps).toBe(8000);
    expect(savedLogs[0].isDirty).toBe(false);

    expect(dailyUpsertSpy).toHaveBeenCalledTimes(1);
    const [, upsertOpts] = dailyUpsertSpy.mock.calls[0];
    expect(upsertOpts).toEqual({ onConflict: 'user_id,date' });
  });

  it('FitnessSyncEngine tolerates missing remote tables (PGRST205) cleanly without crashing', async () => {
    makeFakeSupabase(userId, {
      fitness_profiles: { selectError: { code: 'PGRST205', message: 'Could not find the table' } },
      fitness_daily_logs: { selectError: { code: 'PGRST205', message: 'Could not find the table' } },
      meal_templates: { selectError: { code: 'PGRST205', message: 'Could not find the table' } },
      meal_logs: { selectError: { code: 'PGRST205', message: 'Could not find the table' } },
      workout_sessions: { selectError: { code: 'PGRST205', message: 'Could not find the table' } },
      supplement_inventory: { selectError: { code: 'PGRST205', message: 'Could not find the table' } },
      supplement_logs: { selectError: { code: 'PGRST205', message: 'Could not find the table' } },
    });

    const report = await new FitnessSyncEngine().sync(userId);
    expect(report.errors).toEqual([]);
  });

  const seedPhase2SyncEntities = async () => {
    await db.habits.put({
      id: 'h1', userId, name: 'No Junk Food', icon: '🚫', category: 'health',
      targetDaysPerWeek: 7, archived: false, order: 0, polarity: 'quit', anchorBlock: 'night',
      metadata: { urgeMinutes: 10 }, isDirty: true, createdAt: '2026-11-24T00:00:00.000Z', updatedAt: '2026-11-24T00:00:00.000Z',
    });
    await db.goals.put({
      id: 'g1', userId, title: 'Reach 68kg', areaOfLife: 'health', priority: 'high', status: 'in_progress',
      startDate: '2026-11-24', deadline: '2027-03-01', isFocus: true, archived: false,
      fitnessLink: { type: 'target_weight', targetValue: 68, unit: 'kg' }, metadata: { track: 'fat-loss' },
      isDirty: true, createdAt: '2026-11-24T00:00:00.000Z', updatedAt: '2026-11-24T00:00:00.000Z',
    });
    await db.tasks.put({
      id: 't1', userId, title: 'Dentist Follow-up', status: 'todo', priority: 'high', tags: ['health'],
      metadata: { doctorName: 'Dr Rao', clinic: 'Apollo' }, isDirty: true,
      created_at: '2026-11-24T00:00:00.000Z', updated_at: '2026-11-24T00:00:00.000Z',
    });
    await db.moodLogs.put({
      id: 'ml1', userId, date: '2026-11-24', mood: 'happy', isDirty: true,
      createdAt: '2026-11-24T00:00:00.000Z', updatedAt: '2026-11-24T00:00:00.000Z',
    });
  };

  it('HabitsSyncEngine, GoalsSyncEngine, TasksSyncEngine, MoodLogsSyncEngine preserve Phase 2 columns with PGRST204 fallback', async () => {
    const habitUpsert = vi.fn();
    const goalUpsert = vi.fn();
    const taskUpsert = vi.fn();
    const moodUpsert = vi.fn();

    makeFakeSupabase(userId, {
      habits: { upsertSpy: habitUpsert, missingColumns: new Set(['polarity', 'anchor_block']), rows: [] },
      goals: { upsertSpy: goalUpsert, missingColumns: new Set(['fitness_link']), rows: [] },
      tasks: { upsertSpy: taskUpsert, rows: [] },
      mood_logs: { upsertSpy: moodUpsert, rows: [] },
    });

    await seedPhase2SyncEntities();
    await new HabitsSyncEngine().sync(userId);
    await new GoalsSyncEngine().sync(userId);
    await new TasksSyncEngine().sync(userId);
    await new MoodLogsSyncEngine().sync(userId);

    expect((await db.habits.get('h1'))?.isDirty).toBe(false);
    expect((await db.goals.get('g1'))?.isDirty).toBe(false);
    expect(taskUpsert).toHaveBeenCalled();
    const pushedTaskPayload = Array.isArray(taskUpsert.mock.calls[0][0])
      ? taskUpsert.mock.calls[0][0][0]
      : taskUpsert.mock.calls[0][0];
    expect(pushedTaskPayload.metadata).toEqual({ doctorName: 'Dr Rao', clinic: 'Apollo' });
    expect(moodUpsert).toHaveBeenCalled();
    expect(moodUpsert.mock.calls[0][1]).toEqual({ onConflict: 'user_id,date' });
  });

  const seedFinanceCategoriesForBridge = async () => {
    await db.financeAccounts.put({
      id: 'acc_slice', userId, name: 'Slice CC', type: 'credit_card', balance: 0,
      currency: 'INR', color: '#6366f1', icon: 'credit-card', isDefault: false, archived: false,
      createdAt: '2026-11-24T00:00:00.000Z', updatedAt: '2026-11-24T00:00:00.000Z',
    });
    await db.financeCategories.bulkPut([
      {
        id: 'cat_junk', userId, name: 'Junk Food', slug: 'junk-food', type: 'expense',
        icon: 'pizza', color: '#ef4444', monthlyBudgetLimit: 1000, subcategories: [], order: 0,
        isSystem: true, archived: false, createdAt: '2026-11-24T00:00:00.000Z', updatedAt: '2026-11-24T00:00:00.000Z',
      },
      {
        id: 'cat_food', userId, name: 'Food & Dining', slug: 'food-dining', type: 'expense',
        icon: 'utensils', color: '#f59e0b', monthlyBudgetLimit: 3000, subcategories: [], order: 1,
        isSystem: true, archived: false, createdAt: '2026-11-24T00:00:00.000Z', updatedAt: '2026-11-24T00:00:00.000Z',
      },
    ]);
    await useFinanceStore.getState().loadFinanceData(userId);
    await useFitnessStore.getState().loadFitnessData(userId);
  };

  it('Decision 4 Bridge: Junk Food expenses automatically create 1 Diet meal and never double-log with Universal Capture', async () => {
    await seedFinanceCategoriesForBridge();

    const junkTx = await useFinanceStore.getState().addTransaction({
      title: 'Momos outside college', amount: 60, type: 'expense',
      categoryId: 'cat_junk', accountId: 'acc_slice', date: '2026-11-24', tags: [],
    });

    const mealsAfterJunk = await db.mealLogs.toArray();
    expect(mealsAfterJunk).toHaveLength(1);
    expect(mealsAfterJunk[0].isJunk).toBe(true);
    expect(mealsAfterJunk[0].calories).toBe(350);
    expect(mealsAfterJunk[0].linkedTransactionId).toBe(junkTx.id);
    expect(mealsAfterJunk[0].source).toBe('finance_bridge');

    await useFitnessStore.getState().upsertMealFromCapture({
      userId, date: '2026-11-24', name: 'Fried Momos', calories: 420,
      proteinG: 12, isJunk: true, linkedTransactionId: junkTx.id,
    });
    const mealsAfterCompound = await db.mealLogs.toArray();
    expect(mealsAfterCompound).toHaveLength(1);
    expect(mealsAfterCompound[0].calories).toBe(420);
    expect(mealsAfterCompound[0].source).toBe('universal_capture');

    await useFinanceStore.getState().addTransaction({
      title: 'Mess lunch', amount: 120, type: 'expense',
      categoryId: 'cat_food', accountId: 'acc_slice', date: '2026-11-24', tags: [],
    });
    expect(await db.mealLogs.toArray()).toHaveLength(1);
  });

  it('Mediator pushes completions and auto-completes Workout build habits while skipping Quit habits', async () => {
    await db.habits.bulkPut([
      {
        id: 'hab_workout',
        userId,
        name: 'Morning Exercise',
        icon: '🏋️',
        category: 'health',
        targetDaysPerWeek: 6,
        archived: false,
        order: 0,
        polarity: 'build',
        autoTrackRule: 'workout_logged',
        createdAt: '2026-11-24T00:00:00.000Z',
        updatedAt: '2026-11-24T00:00:00.000Z',
      },
      {
        id: 'hab_quit_junk',
        userId,
        name: 'No Gym Skip',
        icon: '🚫',
        category: 'health',
        targetDaysPerWeek: 7,
        archived: false,
        order: 1,
        polarity: 'quit',
        createdAt: '2026-11-24T00:00:00.000Z',
        updatedAt: '2026-11-24T00:00:00.000Z',
      },
    ]);

    useHabitStore.setState({
      habits: await db.habits.toArray(),
      completions: [],
    });

    await CrossDomainActionMediator.onFitnessEvent({
      type: 'WORKOUT_LOGGED',
      date: '2026-11-24',
      workoutType: 'push',
      durationMinutes: 45,
    });

    const completions = useHabitStore.getState().completions;
    expect(completions.some((c) => c.habitId === 'hab_workout' && c.completed)).toBe(true);
    expect(completions.some((c) => c.habitId === 'hab_quit_junk')).toBe(false);
    expect(getSyncEngine().pushCompletion).toHaveBeenCalled();
  });

  const seedLowEnergyHabits = async () => {
    await db.habits.bulkPut([
      {
        id: 'hab_gym', userId, name: 'Push / Pull Workout', icon: '🏋️', category: 'health',
        targetDaysPerWeek: 7, archived: false, order: 0, polarity: 'build',
        anchorBlock: 'gym', autoTrackRule: 'workout_logged',
        createdAt: '2026-11-24T00:00:00.000Z', updatedAt: '2026-11-24T00:00:00.000Z',
      },
      {
        id: 'hab_meditate', userId, name: 'Morning Meditation', icon: '🧘', category: 'health',
        targetDaysPerWeek: 7, archived: false, order: 1, polarity: 'build', anchorBlock: 'morning',
        createdAt: '2026-11-24T00:00:00.000Z', updatedAt: '2026-11-24T00:00:00.000Z',
      },
      {
        id: 'hab_protein', userId, name: 'Post-Gym Protein Goal', icon: '🥤', category: 'health',
        targetDaysPerWeek: 7, archived: false, order: 2, polarity: 'build',
        anchorBlock: 'gym', autoTrackRule: 'protein_target_met',
        createdAt: '2026-11-24T00:00:00.000Z', updatedAt: '2026-11-24T00:00:00.000Z',
      },
    ]);
    useHabitStore.setState({ habits: await db.habits.toArray(), completions: [] });
  };

  it('toggleLowEnergyMode marks workout habits as rest and returns restedHabitIds cleanly', async () => {
    await seedLowEnergyHabits();

    const onResult = await useFitnessStore.getState().toggleLowEnergyMode('2026-11-24', true, userId);
    expect(onResult.lowEnergyMode).toBe(true);
    expect(onResult.restedHabitIds).toEqual(['hab_gym']);

    const gymCompOn = useHabitStore
      .getState()
      .completions.find((c) => c.habitId === 'hab_gym' && c.date === '2026-11-24');
    expect(gymCompOn?.status).toBe('rest');
    expect(gymCompOn?.restReason).toBe('Low-Energy Day');
    expect(
      useHabitStore
        .getState()
        .completions.some((c) => c.habitId === 'hab_meditate' || c.habitId === 'hab_protein')
    ).toBe(false);
  });

  it('toggleLowEnergyMode restores workout habits and cleans up note on toggle off', async () => {
    await seedLowEnergyHabits();
    await useFitnessStore.getState().toggleLowEnergyMode('2026-11-24', true, userId);

    const offResult = await useFitnessStore.getState().toggleLowEnergyMode('2026-11-24', false, userId);
    expect(offResult.lowEnergyMode).toBe(false);
    expect(offResult.restedHabitIds).toEqual([]);

    const gymCompOff = useHabitStore
      .getState()
      .completions.find((c) => c.habitId === 'hab_gym' && c.date === '2026-11-24');
    expect(gymCompOff?.status).toBeUndefined();
    expect(gymCompOff?.skipped).toBe(false);
    expect(gymCompOff?.note).toBeUndefined();
  });

  it('toggleLowEnergyMode re-evaluates existing steps against lowEnergyStepsTarget', async () => {
    await db.fitnessProfiles.put({
      id: 'prof_le_steps',
      userId,
      calorieTarget: 2000,
      proteinTargetG: 130,
      waterTargetMl: 3000,
      stepsTarget: 8000,
      sleepTargetHours: 7.5,
      lowEnergyStepsTarget: 3500,
      activityLevel: 'moderate',
      goalType: 'fat_loss',
      dietPreference: 'non_veg',
      createdAt: '2026-11-24T00:00:00.000Z',
      updatedAt: '2026-11-24T00:00:00.000Z',
    });
    await db.habits.put({
      id: 'hab_steps_le',
      userId,
      name: '8k Steps',
      icon: '👟',
      category: 'health',
      targetDaysPerWeek: 7,
      archived: false,
      order: 0,
      polarity: 'build',
      autoTrackRule: 'steps_target',
      createdAt: '2026-11-24T00:00:00.000Z',
      updatedAt: '2026-11-24T00:00:00.000Z',
    });
    useHabitStore.setState({
      habits: await db.habits.toArray(),
      completions: [],
    });
    await useFitnessStore.getState().loadFitnessData(userId);

    // Log 4,000 steps -> fails 8,000 normal target
    await useFitnessStore.getState().upsertDailyLog('2026-11-24', { steps: 4000 }, userId);
    expect(
      useHabitStore
        .getState()
        .completions.some((c) => c.habitId === 'hab_steps_le' && c.completed)
    ).toBe(false);

    // Turning on Low-Energy Mode lowers target to 3,500 and evaluates existing 4,000 steps -> completes
    await useFitnessStore.getState().toggleLowEnergyMode('2026-11-24', true, userId);
    expect(
      useHabitStore
        .getState()
        .completions.some((c) => c.habitId === 'hab_steps_le' && c.completed)
    ).toBe(true);
  });

  const seedReconcileBridgeFixtures = async () => {
    const junkCat = {
      id: 'cat_junk_sync', userId, name: 'Junk Food', slug: 'junk-food', type: 'expense' as const,
      icon: 'Flame', color: '#ef4444', monthlyBudgetLimit: 0, subcategories: [], order: 0,
      isSystem: true, archived: false, createdAt: '2026-11-24T00:00:00.000Z', updatedAt: '2026-11-24T00:00:00.000Z',
    };
    const shopCat = { ...junkCat, id: 'cat_shop_sync', name: 'Shopping', slug: 'shopping-personal-care' };
    const acc = {
      id: 'acc_upi_sync', userId, name: 'UPI', type: 'upi' as const, balance: 2000, currency: 'INR',
      color: '#10b981', icon: 'Smartphone', isDefault: true, archived: false,
      createdAt: '2026-11-24T00:00:00.000Z', updatedAt: '2026-11-24T00:00:00.000Z',
    };
    await db.financeCategories.bulkPut([junkCat, shopCat]);
    await db.financeAccounts.put(acc);
    await useFinanceStore.getState().loadFinanceData(userId);
    await useFitnessStore.getState().loadFitnessData(userId);
    await useFitnessStore.getState().addMealLog(
      {
        date: '2026-11-24', mealType: 'lunch', name: 'Homemade Dal Rice',
        calories: 520, proteinG: 18, carbsG: 75, fatG: 10, isJunk: false, source: 'manual',
      },
      userId
    );
    return { junkCat, shopCat, acc };
  };

  it('deleteTransaction and updateTransaction reconcile linked finance_bridge MealLogs cleanly', async () => {
    const { junkCat, shopCat, acc } = await seedReconcileBridgeFixtures();
    const tx = await useFinanceStore.getState().addTransaction({
      title: 'Street Momos', amount: 60, type: 'expense',
      categoryId: shopCat.id, accountId: acc.id, date: '2026-11-24', tags: [],
    });
    expect(await db.mealLogs.filter((m) => !m.deletedAt).toArray()).toHaveLength(1);

    await useFinanceStore.getState().updateTransaction(tx.id, {
      categoryId: junkCat.id, title: 'Fried Momos', amount: 120,
    });
    let activeMeals = await db.mealLogs.filter((m) => !m.deletedAt).toArray();
    expect(activeMeals).toHaveLength(2);
    const linked = activeMeals.find((m) => m.linkedTransactionId === tx.id);
    expect(linked?.source).toBe('finance_bridge');
    expect(linked?.isJunk).toBe(true);
    expect(linked?.name).toBe('Fried Momos');

    await useFinanceStore.getState().updateTransaction(tx.id, { categoryId: shopCat.id });
    activeMeals = await db.mealLogs.filter((m) => !m.deletedAt).toArray();
    expect(activeMeals).toHaveLength(1);
    expect(activeMeals[0].name).toBe('Homemade Dal Rice');

    await useFinanceStore.getState().updateTransaction(tx.id, { categoryId: junkCat.id });
    expect(await db.mealLogs.filter((m) => !m.deletedAt).toArray()).toHaveLength(2);

    await useFinanceStore.getState().deleteTransaction(tx.id);
    activeMeals = await db.mealLogs.filter((m) => !m.deletedAt).toArray();
    expect(activeMeals).toHaveLength(1);
    expect(activeMeals[0].name).toBe('Homemade Dal Rice');
  });

  it('HabitsSyncEngine pull clears anchorBlock when remote returns explicit null', async () => {
    await db.habits.put({
      id: 'hab_clear_anchor',
      userId,
      name: 'Read 20 pages',
      icon: '📖',
      category: 'learning',
      targetDaysPerWeek: 7,
      archived: false,
      order: 0,
      polarity: 'build',
      anchorBlock: 'night',
      generationCounter: 1,
      isDirty: false,
      createdAt: '2026-11-24T00:00:00.000Z',
      updatedAt: '2026-11-24T00:00:00.000Z',
    });

    const sb = makeFakeSupabase(userId, {
      habits: {
        rows: [
          {
            id: 'hab_clear_anchor',
            user_id: userId,
            name: 'Read 20 pages',
            icon: '📖',
            category: 'learning',
            target_days_per_week: 7,
            archived: false,
            order_index: 0,
            polarity: 'build',
            anchor_block: null,
            generation_counter: 5,
            created_at: '2026-11-24T00:00:00.000Z',
            updated_at: '2026-11-25T00:00:00.000Z',
          },
        ],
      },
    });
    activeFakeSb.current = sb;

    const engine = new HabitsSyncEngine();
    await engine.sync(userId);

    const updated = await db.habits.get('hab_clear_anchor');
    expect(updated?.anchorBlock).toBeUndefined();
  });

  it('FitnessSyncEngine deduplicates same-named active mealTemplates and skips re-seeding when remote rows exist', async () => {
    const sb = makeFakeSupabase(userId, {
      meal_templates: {
        rows: [
          {
            id: 'tpl-dup-1',
            user_id: userId,
            name: '4 Boiled Eggs',
            hindi_aliases: ['eggs'],
            calories: 280,
            protein_g: 24,
            carbs_g: 2,
            fat_g: 20,
            fiber_g: 0,
            serving_label: '4 whole eggs',
            meal_type: 'breakfast',
            is_junk: false,
            is_pinned: true,
            order_index: 0,
            deleted_at: null,
            generation_counter: 1,
            created_at: '2026-11-25T04:00:00.000Z',
            updated_at: '2026-11-25T04:00:00.000Z',
          },
          {
            id: 'tpl-dup-2',
            user_id: userId,
            name: '4 Boiled Eggs',
            hindi_aliases: ['eggs'],
            calories: 280,
            protein_g: 24,
            carbs_g: 2,
            fat_g: 20,
            fiber_g: 0,
            serving_label: '4 whole eggs',
            meal_type: 'breakfast',
            is_junk: false,
            is_pinned: true,
            order_index: 0,
            deleted_at: null,
            generation_counter: 2,
            created_at: '2026-11-25T09:00:00.000Z',
            updated_at: '2026-11-25T09:00:00.000Z',
          },
        ],
      },
    });
    activeFakeSb.current = sb;

    const engine = new FitnessSyncEngine();
    await engine.syncMealTemplates(sb, userId);

    const active = (await db.mealTemplates.where('userId').equals(userId).toArray()).filter(
      (t) => !t.deletedAt
    );
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('tpl-dup-2');
    const softDeleted = await db.mealTemplates.get('tpl-dup-1');
    expect(softDeleted?.deletedAt).toBeTruthy();

    await useFitnessStore.getState().loadFitnessData(userId, true);
    expect(useFitnessStore.getState().mealTemplates).toHaveLength(1);
  });
});
