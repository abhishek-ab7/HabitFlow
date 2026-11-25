import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mapFitnessDailyLogFromRow,
  mapFitnessProfileFromRow,
  mapHabitFromRow,
  mapMealLogFromRow,
  mapMealTemplateFromRow,
  mapSupplementInventoryFromRow,
  mapSupplementLogFromRow,
  mapWorkoutSessionFromRow,
} from '../mappers';
import { getIstIsoDate } from '../config';

const { mockAuthCtx, tableStore } = vi.hoisted(() => ({
  mockAuthCtx: {
    userId: 'user-mcp-1',
    scopes: ['habitflow:read', 'habitflow:write', 'habitflow:finance:read'],
    clientId: 'test-client',
    tokenId: 'tok-1',
  },
  tableStore: new Map<string, any[]>(),
}));

function makeSupabaseFake() {
  const createBuilder = (tableName: string) => {
    const filters: Array<(r: any) => boolean> = [];
    let pendingAction: 'select' | 'insert' | 'update' = 'select';
    let payloadData: any = null;
    let isSingle = false;
    let orderCol: string | null = null;
    let orderAsc = true;
    let maxRows: number | null = null;

    const exec = async () => {
      const rows = tableStore.get(tableName) || [];
      const matching = rows.filter((r) => filters.every((fn) => fn(r)));

      if (pendingAction === 'insert') {
        const toInsert = Array.isArray(payloadData) ? payloadData : [payloadData];
        const inserted = toInsert.map((item) => ({ ...item }));
        tableStore.set(tableName, [...rows, ...inserted]);
        return {
          data: isSingle ? inserted[0] : inserted,
          error: null,
        };
      }

      if (pendingAction === 'update') {
        const updatedList: any[] = [];
        const nextRows = rows.map((r) => {
          if (filters.every((fn) => fn(r))) {
            const updated = { ...r, ...payloadData };
            updatedList.push(updated);
            return updated;
          }
          return r;
        });
        tableStore.set(tableName, nextRows);
        return {
          data: isSingle ? updatedList[0] ?? null : updatedList,
          error: null,
        };
      }

      let result = [...matching];
      if (orderCol) {
        result.sort((a, b) => {
          const av = String(a[orderCol!] ?? '');
          const bv = String(b[orderCol!] ?? '');
          return orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
        });
      }
      if (maxRows !== null) {
        result = result.slice(0, maxRows);
      }

      if (isSingle) {
        return { data: result[0] ?? null, error: null };
      }
      return { data: result, error: null };
    };

    const builder: any = {
      select: () => builder,
      insert: (data: any) => {
        pendingAction = 'insert';
        payloadData = data;
        return builder;
      },
      update: (data: any) => {
        pendingAction = 'update';
        payloadData = data;
        return builder;
      },
      eq: (col: string, val: any) => {
        filters.push((r) => r[col] === val);
        return builder;
      },
      neq: (col: string, val: any) => {
        filters.push((r) => r[col] !== val);
        return builder;
      },
      gte: (col: string, val: any) => {
        filters.push((r) => String(r[col] ?? '') >= String(val));
        return builder;
      },
      lte: (col: string, val: any) => {
        filters.push((r) => String(r[col] ?? '') <= String(val));
        return builder;
      },
      is: (col: string, val: any) => {
        filters.push((r) => (r[col] ?? null) === val);
        return builder;
      },
      or: () => builder,
      order: (col: string, opts?: { ascending?: boolean }) => {
        orderCol = col;
        orderAsc = opts?.ascending !== false;
        return builder;
      },
      limit: (n: number) => {
        maxRows = n;
        return builder;
      },
      maybeSingle: () => {
        isSingle = true;
        return exec();
      },
      single: () => {
        isSingle = true;
        return exec();
      },
      then: (resolve: (val: any) => void, reject?: (err: any) => void) =>
        exec().then(resolve, reject),
    };

    return builder;
  };

  return {
    from: (tableName: string) => createBuilder(tableName),
  };
}

vi.mock('../auth', () => ({
  getMcpAuthContext: () => mockAuthCtx,
  hasScope: (auth: typeof mockAuthCtx, scope: string) => auth.scopes.includes(scope),
}));

vi.mock('../supabase-admin', () => ({
  getSupabaseAdmin: () => makeSupabaseFake(),
}));

vi.mock('../audit', () => ({
  logMcpToolInvocation: vi.fn(async () => {}),
}));

import { setupHabitFlowMcpServer } from '../server';
import { z } from 'zod';

describe('MCP Fitness Extension, Mappers, Briefing Fixes & Mood Enum', () => {
  const registeredTools = new Map<string, { config: any; handler: (args: any) => Promise<any> }>();
  const registeredResources = new Map<string, { uri: string; handler: (uri: URL) => Promise<any> }>();
  const registeredPrompts = new Map<string, { config: any; handler: (args: any) => Promise<any> }>();

  const fakeServer: any = {
    registerTool: (name: string, config: any, handler: (args: any) => Promise<any>) => {
      registeredTools.set(name, { config, handler });
    },
    registerResource: (name: string, uri: string, _meta: any, handler: (uri: URL) => Promise<any>) => {
      registeredResources.set(name, { uri, handler });
    },
    registerPrompt: (name: string, config: any, handler: (args: any) => Promise<any>) => {
      registeredPrompts.set(name, { config, handler });
    },
  };

  beforeEach(async () => {
    registeredTools.clear();
    registeredResources.clear();
    registeredPrompts.clear();
    tableStore.clear();
    mockAuthCtx.scopes = ['habitflow:read', 'habitflow:write', 'habitflow:finance:read'];
    await setupHabitFlowMcpServer(fakeServer);
  });

  it('maps all 7 Slice 2A/2B Fitness tables + Habit polarity/anchorBlock faithfully from Postgres snake_case', () => {
    const profile = mapFitnessProfileFromRow({
      id: 'fp-1',
      user_id: 'u1',
      height_cm: '175.5',
      current_weight_kg: '78.2',
      target_weight_kg: '72.0',
      starting_weight_kg: '84.0',
      target_waist_inches: '31.5',
      calorie_target: 1950,
      protein_target_g: 140,
      carbs_target_g: 180,
      fat_target_g: 60,
      water_target_ml: 3500,
      steps_target: 9000,
      sleep_target_hours: '7.5',
      activity_level: 'active',
      goal_type: 'fat_loss',
      diet_preference: 'eggetarian',
      gym_schedule_days: [1, 3, 5],
      low_energy_calorie_ceiling: 1700,
      low_energy_steps_target: 4000,
      generation_counter: 3,
    });
    expect(profile.lowEnergyCalorieCeiling).toBe(1700);
    expect(profile.lowEnergyStepsTarget).toBe(4000);
    expect(profile.generationCounter).toBe(3);

    const dailyLog = mapFitnessDailyLogFromRow({
      id: 'dl-1',
      user_id: 'u1',
      date: '2026-11-25',
      weight_kg: '78.1',
      waist_inches: '32.2',
      water_ml: 2500,
      steps: 8400,
      sleep_hours: '6.2',
      sleep_quality: 3,
      energy_level: 2,
      soreness_level: 4,
      low_energy_mode: true,
      junk_free_override: true,
      rested_habit_ids: ['h-gym'],
    });
    expect(dailyLog.lowEnergyMode).toBe(true);
    expect(dailyLog.junkFreeOverride).toBe(true);
    expect(dailyLog.restedHabitIds).toEqual(['h-gym']);

    const tpl = mapMealTemplateFromRow({
      id: 'mt-1',
      user_id: 'u1',
      name: '4 Boiled Eggs',
      hindi_aliases: ['anda', '4 eggs'],
      calories: 300,
      protein_g: '24',
      carbs_g: '2',
      fat_g: '20',
      serving_label: '4 eggs',
      meal_type: 'breakfast',
      is_junk: false,
      is_pinned: true,
      order_index: 2,
    });
    expect(tpl.hindiAliases).toEqual(['anda', '4 eggs']);
    expect(tpl.proteinG).toBe(24);

    const meal = mapMealLogFromRow({
      id: 'ml-1',
      user_id: 'u1',
      date: '2026-11-25',
      meal_type: 'lunch',
      name: 'Chicken Rice',
      calories: 650,
      protein_g: '45',
      carbs_g: '75',
      fat_g: '16',
      quantity_multiplier: '1',
      is_junk: false,
      linked_transaction_id: 'tx-9',
      source: 'mcp',
    });
    expect(meal.linkedTransactionId).toBe('tx-9');
    expect(meal.source).toBe('mcp');

    const workout = mapWorkoutSessionFromRow({
      id: 'wk-1',
      user_id: 'u1',
      date: '2026-11-25',
      title: 'Push A',
      workout_type: 'push',
      duration_minutes: 55,
      exercises: [{ name: 'Bench Press', sets: [{ reps: 8, weightKg: 60 }] }],
      rpe: 8,
    });
    expect(workout.exercises).toHaveLength(1);
    expect(workout.rpe).toBe(8);

    const sup = mapSupplementInventoryFromRow({
      id: 'sup-1',
      user_id: 'u1',
      name: 'Whey Isolate',
      category: 'protein',
      unit_label: 'scoop',
      total_servings: 60,
      remaining_servings: 45,
      daily_dosage: 1,
      cost_inr: 4500,
      protein_per_serving_g: '25',
      manual_adjustment: -10,
      anchor_block: 'morning',
      low_stock_threshold_days: 7,
      is_active: true,
    });
    expect(sup.proteinPerServingG).toBe(25);
    expect(sup.manualAdjustment).toBe(-10);
    expect(sup.anchorBlock).toBe('morning');

    const supLog = mapSupplementLogFromRow({
      id: 'sl-1',
      user_id: 'u1',
      supplement_id: 'sup-1',
      date: '2026-11-25',
      servings_taken: '1',
    });
    expect(supLog.servingsTaken).toBe(1);

    const habit = mapHabitFromRow({
      id: 'h-1',
      user_id: 'u1',
      name: 'No Junk',
      category: 'health',
      polarity: 'quit',
      anchor_block: 'evening',
      metadata: { source: 'life_os' },
    });
    expect(habit.polarity).toBe('quit');
    expect(habit.anchorBlock).toBe('evening');
  });

  it('registers all 5 Fitness tools & executes field-merged log_daily_body_metrics without null clobber', async () => {
    expect(registeredTools.has('get_fitness_overview')).toBe(true);
    expect(registeredTools.has('log_daily_body_metrics')).toBe(true);
    expect(registeredTools.has('manage_meals')).toBe(true);
    expect(registeredTools.has('manage_workouts')).toBe(true);
    expect(registeredTools.has('manage_supplements')).toBe(true);

    const today = getIstIsoDate();
    tableStore.set('fitness_daily_logs', [
      {
        id: 'dl-existing',
        user_id: 'user-mcp-1',
        date: today,
        weight_kg: 79.0,
        waist_inches: 33.0,
        water_ml: 1500,
        steps: 8200,
        sleep_hours: 7.5,
        energy_level: 4,
        low_energy_mode: false,
        junk_free_override: false,
        rested_habit_ids: [],
        generation_counter: 2,
        deleted_at: null,
      },
    ]);

    const logTool = registeredTools.get('log_daily_body_metrics')!;
    const res = await logTool.handler({ date: today, addWaterMl: 500, sleepHours: 6.2 });
    const parsed = JSON.parse(res.content[0].text);

    expect(parsed.action).toBe('merged_updated');
    // Unspecified weightKg, steps, waistInches MUST NOT be clobbered!
    expect(parsed.dailyLog.weightKg).toBe(79.0);
    expect(parsed.dailyLog.waistInches).toBe(33.0);
    expect(parsed.dailyLog.steps).toBe(8200);
    expect(parsed.dailyLog.waterMl).toBe(2000);
    expect(parsed.dailyLog.sleepHours).toBe(6.2);
    expect(parsed.dailyLog.generationCounter).toBe(3);

    // Scope guard check
    mockAuthCtx.scopes = ['habitflow:read'];
    const denied = await logTool.handler({ date: today, steps: 5000 });
    expect(denied.isError).toBe(true);
  });

  it('manage_meals, manage_workouts (overload hints + confirm delete), and manage_supplements (dose + ROI) work end-to-end', async () => {
    const today = getIstIsoDate();

    const mealsTool = registeredTools.get('manage_meals')!;
    const mealRes = await mealsTool.handler({
      action: 'log',
      date: today,
      name: 'Paneer Bhurji + 2 Roti',
      mealType: 'dinner',
      calories: 560,
      proteinG: 32,
      carbsG: 48,
      fatG: 24,
    });
    const mealCreated = JSON.parse(mealRes.content[0].text);
    expect(mealCreated.meal.name).toBe('Paneer Bhurji + 2 Roti');

    // Delete without confirm: true must error
    const deniedDel = await mealsTool.handler({ action: 'delete', mealId: mealCreated.meal.id });
    expect(deniedDel.isError).toBe(true);

    const workoutTool = registeredTools.get('manage_workouts')!;
    await workoutTool.handler({
      action: 'log',
      date: today,
      title: 'Push A',
      workoutType: 'push',
      durationMinutes: 50,
      exercises: [{ name: 'Bench Press', sets: [{ reps: 10, weightKg: 60 }] }],
    });
    const hintsRes = await workoutTool.handler({
      action: 'get_overload_hints',
      exerciseName: 'Bench Press',
    });
    const hintsJson = JSON.parse(hintsRes.content[0].text);
    expect(hintsJson.hint.exerciseName).toBe('Bench Press');
    expect(hintsJson.hint.recommendedWeightKg).toBeGreaterThanOrEqual(60);

    const supTool = registeredTools.get('manage_supplements')!;
    const supRes = await supTool.handler({
      action: 'upsert_item',
      name: 'ON Whey',
      category: 'protein',
      totalServings: 60,
      costInr: 4800,
      proteinPerServingG: 24,
      anchorBlock: 'morning',
    });
    const supCreated = JSON.parse(supRes.content[0].text);
    const doseRes = await supTool.handler({
      action: 'log_dose',
      supplementId: supCreated.item.id,
      servingsTaken: 2,
      date: today,
    });
    const doseJson = JSON.parse(doseRes.content[0].text);
    expect(doseJson.remainingServings).toBe(58);
  });

  it('enforces manage_mood canonical MoodType enum (happy|calm|neutral|sad|stressed) and exposes tasks metadata + goals links', () => {
    const moodTool = registeredTools.get('manage_mood')!;
    const moodSchema = z.object(moodTool.config.inputSchema);
    expect(moodSchema.safeParse({ action: 'log', mood: 'stressed' }).success).toBe(true);
    expect(moodSchema.safeParse({ action: 'log', mood: 'great' }).success).toBe(false);

    const goalTool = registeredTools.get('manage_goal')!;
    const goalSchema = z.object(goalTool.config.inputSchema);
    expect(
      goalSchema.safeParse({
        action: 'create',
        title: 'Cut Weight',
        fitnessLink: { type: 'target_weight', targetValue: 74, startingValue: 82 },
      }).success
    ).toBe(true);
  });

  it('get_tasks exposes metadata MITs and get_habit_finance_insights fixes debtRecords, obligations & habitConsistencyPct drift + attaches crossDomainInsights', async () => {
    const today = getIstIsoDate();
    const month = today.slice(0, 7);

    tableStore.set('tasks', [
      {
        id: 't1',
        user_id: 'user-mcp-1',
        title: 'MIT Task',
        status: 'todo',
        priority: 'high',
        metadata: { isMitForDate: today, mitRank: 1 },
        tags: [],
      },
    ]);
    const tasksRes = await registeredTools.get('get_tasks')!.handler({});
    expect(JSON.parse(tasksRes.content[0].text).tasks[0].metadata).toEqual({
      isMitForDate: today,
      mitRank: 1,
    });

    tableStore.set('habits', [
      {
        id: 'h1',
        user_id: 'user-mcp-1',
        name: 'Gym',
        category: 'health',
        target_days: 7,
        is_archived: false,
      },
    ]);
    tableStore.set('completions', [
      { id: 'c1', user_id: 'user-mcp-1', habit_id: 'h1', date: today, completed: true },
    ]);
    tableStore.set('debt_records', [
      {
        id: 'd-idle',
        user_id: 'user-mcp-1',
        person_name: 'Amit',
        direction: 'lent',
        title: 'Old dinner split',
        principal_amount: 1200,
        total_repaid_amount: 0,
        remaining_amount: 1200,
        start_date: '2026-09-01',
        repayment_schedule: 'flexible',
        status: 'active',
        bucket_type: 'everyday_split',
        color: '#000',
      },
    ]);
    tableStore.set('finance_categories', [
      {
        id: 'c-junk',
        user_id: 'user-mcp-1',
        name: 'Junk Food',
        slug: 'junk-food',
        type: 'expense',
        monthly_budget_limit: 500,
      },
    ]);
    tableStore.set('finance_transactions', [
      {
        id: 'tx-j',
        user_id: 'user-mcp-1',
        title: 'Momos',
        amount: 300,
        type: 'expense',
        category_id: 'c-junk',
        account_id: 'a1',
        date: today,
        month_key: month,
      },
    ]);

    const insightsRes = await registeredTools.get('get_habit_finance_insights')!.handler({ monthKey: month });
    const insightsJson = JSON.parse(insightsRes.content[0].text);
    expect(insightsJson.crossDomainInsights.walletWaistline.spend14dInr).toBe(300);
    // Uses elapsed days in month rather than naive totalHabits * 30!
    expect(insightsJson.crossDomainSummary.expectedOpportunitiesInPeriod).toBeLessThanOrEqual(31);
    expect(registeredResources.has('fitness_today')).toBe(true);
    expect(registeredPrompts.has('sunday_reset')).toBe(true);
  });

  it('aligns Habit & Supplement anchorBlock enum with HabitAnchorBlock (work/gym) and passes habitCompletions into briefing insights', async () => {
    const today = getIstIsoDate();
    const yesterday = new Date(`${today}T00:00:00Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayIso = yesterday.toISOString().slice(0, 10);

    const habitTool = registeredTools.get('manage_habit')!;
    const habitSchema = z.object(habitTool.config.inputSchema);
    expect(habitSchema.safeParse({ action: 'create', name: 'Deep Work', anchor_block: 'work' }).success).toBe(true);
    expect(habitSchema.safeParse({ action: 'create', name: 'Gym', anchor_block: 'gym' }).success).toBe(true);
    expect(habitSchema.safeParse({ action: 'create', name: 'Invalid', anchor_block: 'midday' }).success).toBe(false);

    const habitRes = await habitTool.handler({
      action: 'create',
      name: 'Deep Work Sprint',
      anchor_block: 'work',
      polarity: 'build',
    });
    expect(habitRes.isError).toBeUndefined();
    expect(JSON.parse(habitRes.content[0].text).habit.anchor_block).toBe('work');

    const supTool = registeredTools.get('manage_supplements')!;
    const supSchema = z.object(supTool.config.inputSchema);
    expect(supSchema.safeParse({ action: 'upsert_item', name: 'Electrolytes', anchorBlock: 'gym' }).success).toBe(true);
    expect(supSchema.safeParse({ action: 'upsert_item', name: 'Electrolytes', anchorBlock: 'evening' }).success).toBe(false);

    const supRes = await supTool.handler({
      action: 'upsert_item',
      name: 'Pre-Workout Electrolytes',
      category: 'pre_workout',
      anchorBlock: 'gym',
      totalServings: 30,
      dailyDosage: 1,
      costInr: 1200,
    });
    expect(supRes.isError).toBeUndefined();
    expect(JSON.parse(supRes.content[0].text).item.anchorBlock).toBe('gym');

    tableStore.set('habits', [
      {
        id: 'h-gym-completed',
        user_id: 'user-mcp-1',
        name: 'Evening Gym Workout',
        category: 'health',
        target_days: 7,
        is_archived: false,
      },
    ]);
    tableStore.set('completions', [
      { id: 'c-yes', user_id: 'user-mcp-1', habit_id: 'h-gym-completed', date: yesterdayIso, completed: true },
    ]);
    tableStore.set('fitness_daily_logs', [
      { id: 'fd-y', user_id: 'user-mcp-1', date: yesterdayIso, sleep_hours: 8, energy_level: 4, steps: 8500, water_ml: 3000 },
    ]);
    tableStore.set('finance_categories', [
      { id: 'c-junk', user_id: 'user-mcp-1', name: 'Junk Food', slug: 'junk-food', type: 'expense' },
    ]);
    tableStore.set('finance_transactions', [
      { id: 'tx-y', user_id: 'user-mcp-1', title: 'Burger', amount: 250, type: 'expense', category_id: 'c-junk', account_id: 'a1', date: yesterdayIso, month_key: yesterdayIso.slice(0, 7) },
    ]);

    const insightsRes = await registeredTools.get('get_habit_finance_insights')!.handler({ monthKey: today.slice(0, 7) });
    const insightsJson = JSON.parse(insightsRes.content[0].text);
    expect(insightsJson.crossDomainInsights.triggers.triggerDaysCount).toBe(0);

    const briefingRes = await registeredTools.get('get_daily_briefing')!.handler({ date: today });
    const briefingJson = JSON.parse(briefingRes.content[0].text);
    expect(briefingJson.crossDomainInsights.triggers.triggerDaysCount).toBe(0);
  });
});
