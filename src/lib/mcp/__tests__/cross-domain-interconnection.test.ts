import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getIstIsoDate } from '../config';

const { mockAuthCtx, tableStore } = vi.hoisted(() => ({
  mockAuthCtx: {
    userId: 'user-mcp-xdomain',
    scopes: [
      'habitflow:read',
      'habitflow:write',
      'habitflow:finance:read',
      'habitflow:finance:write',
    ],
    clientId: 'test-client',
    tokenId: 'tok-xdomain',
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

function parseResult(res: any) {
  expect(res.isError).toBeFalsy();
  return JSON.parse(res.content[0].text);
}

describe('MCP Cross-Domain Parity (Bugs 1-5)', () => {
  const registeredTools = new Map<string, { config: any; handler: (args: any) => Promise<any> }>();

  const fakeServer: any = {
    registerTool: (name: string, config: any, handler: (args: any) => Promise<any>) => {
      registeredTools.set(name, { config, handler });
    },
    registerResource: () => {},
    registerPrompt: () => {},
  };

  beforeEach(async () => {
    registeredTools.clear();
    tableStore.clear();
    await setupHabitFlowMcpServer(fakeServer);
  });

  it('Bug 1: manage_finance_budget persists paydayOfMonth and feeds get_finance_overview / get_habit_finance_insights', async () => {
    const todayIst = getIstIsoDate();
    const monthKey = todayIst.slice(0, 7);

    const budgetTool = registeredTools.get('manage_finance_budget')!;
    const upserted = parseResult(
      await budgetTool.handler({
        action: 'upsert',
        monthKey,
        expectedIncome: 19000,
        paydayOfMonth: 7,
      })
    );
    expect(upserted.budget.payday_of_month).toBe(7);
    expect(upserted.budget.generation_counter).toBe(1);

    const got = parseResult(await budgetTool.handler({ action: 'get', monthKey }));
    expect(got.effectivePaydayOfMonth).toBe(7);

    const overviewTool = registeredTools.get('get_finance_overview')!;
    const overview = parseResult(
      await overviewTool.handler({ monthKey, includeForecast: true })
    );
    expect(overview.forecast.paydayOfMonth).toBe(7);
    expect(overview.forecast.estimatedMonthlyIncome).toBe(19000);

    const insightsTool = registeredTools.get('get_habit_finance_insights')!;
    const insights = parseResult(await insightsTool.handler({ monthKey }));
    expect(insights.cashFlowForecast30d.paydayOfMonth).toBe(7);
    expect(insights.cashFlowForecast30d.estimatedMonthlyIncome).toBe(19000);
  });

  it('Bug 2 & Bug 3: log_daily_body_metrics sets status=rest on autoRestGymHabits (preserving completed habits), reverts cleanly, and syncs profile currentWeightKg only on latest date', async () => {
    const todayIst = getIstIsoDate();
    const habitTool = registeredTools.get('manage_habit')!;
    const gymHabit = parseResult(
      await habitTool.handler({ action: 'create', name: 'Gym', anchor_block: 'gym' })
    ).habit;
    const completedHabit = parseResult(
      await habitTool.handler({ action: 'create', name: 'Workout', anchor_block: 'gym' })
    ).habit;

    const compTool = registeredTools.get('log_habit_completion')!;
    await compTool.handler({
      habitId: completedHabit.id,
      date: todayIst,
      status: 'completed',
    });

    const profTool = registeredTools.get('manage_fitness_profile')!;
    await profTool.handler({ action: 'upsert', currentWeightKg: 66.0 });

    const bodyTool = registeredTools.get('log_daily_body_metrics')!;
    const resOn = parseResult(
      await bodyTool.handler({
        action: 'upsert',
        date: todayIst,
        weightKg: 69.6,
        lowEnergyMode: true,
        autoRestGymHabits: true,
      })
    );
    expect(resOn.autoRestedHabitIds).toEqual([gymHabit.id]);
    expect(resOn.profileWeightSynced).toBe(true);

    // Profile currentWeightKg updated + generation_counter bumped
    const profAfter = parseResult(await profTool.handler({ action: 'get' })).profile;
    expect(profAfter.currentWeightKg).toBe(69.6);
    expect(profAfter.generationCounter).toBe(2);

    // Historical weigh-in does NOT overwrite latest 69.6
    const resOld = parseResult(
      await bodyTool.handler({
        action: 'upsert',
        date: '2026-01-05',
        weightKg: 65.0,
      })
    );
    expect(resOld.profileWeightSynced).toBe(false);
    expect(parseResult(await profTool.handler({ action: 'get' })).profile.currentWeightKg).toBe(69.6);

    // get_habits resolves status === 'rest' and isRestedToday === true without overriding completedHabit
    const getHabits = registeredTools.get('get_habits')!;
    const habitsList = parseResult(await getHabits.handler({ date: todayIst })).habits;
    const gymView = habitsList.find((h: any) => h.id === gymHabit.id);
    const doneView = habitsList.find((h: any) => h.id === completedHabit.id);

    expect(gymView.todayStatus).toBe('rest');
    expect(gymView.weekProgress.isRestedToday).toBe(true);
    expect(doneView.todayStatus).toBe('completed');

    // Disabling Low-Energy Mode reverts auto-rested gymHabit and preserves completedHabit
    const resOff = parseResult(
      await bodyTool.handler({
        action: 'upsert',
        date: todayIst,
        lowEnergyMode: false,
      })
    );
    expect(resOff.revertedRestHabitIds).toEqual([gymHabit.id]);

    const habitsAfterOff = parseResult(await getHabits.handler({ date: todayIst })).habits;
    expect(habitsAfterOff.find((h: any) => h.id === gymHabit.id).todayStatus).toBe('pending');
    expect(habitsAfterOff.find((h: any) => h.id === completedHabit.id).todayStatus).toBe('completed');
  });

  it('Bug 4 & Bug 5: manage_meals auto-deducts protein supplement inventory & auto-links matching finance transactions without double-deduction', async () => {
    const todayIst = getIstIsoDate();
    const accTool = registeredTools.get('manage_finance_account')!;
    const bank = parseResult(
      await accTool.handler({ action: 'create', name: 'HDFC Bank', type: 'bank', balance: 5000 })
    ).account;

    const catTool = registeredTools.get('manage_finance_category')!;
    const supCat = parseResult(
      await catTool.handler({ action: 'create', name: 'Health & Supplements', slug: 'medical-supplements' })
    ).category;
    const junkCat = parseResult(
      await catTool.handler({ action: 'create', name: 'Junk Food', slug: 'junk-food' })
    ).category;

    const supTool = registeredTools.get('manage_supplements')!;
    const nutra = parseResult(
      await supTool.handler({
        action: 'upsert_item',
        name: 'Soy Protein Isolate',
        brand: 'NutraBox',
        category: 'protein',
        totalServings: 30,
        costInr: 0,
      })
    ).item;

    // 1. Logging Health & Supplements expense auto-updates cost_inr from 0 -> 1499
    const txTool = registeredTools.get('manage_transaction')!;
    const supTxRes = parseResult(
      await txTool.handler({
        action: 'create',
        title: 'NutraBox Soy Protein Isolate Refill',
        amount: 1499,
        type: 'expense',
        categoryId: supCat.id,
        accountId: bank.id,
        date: todayIst,
      })
    );
    expect(supTxRes.autoSyncedSupplementCost.supplementId).toBe(nutra.id);
    expect(supTxRes.autoSyncedSupplementCost.costInr).toBe(1499);

    // 2. Logging protein shake meal auto-logs 1 scoop & decrements remainingServings 30 -> 29
    const mealTool = registeredTools.get('manage_meals')!;
    const scoopRes = parseResult(
      await mealTool.handler({
        action: 'log',
        name: 'Nutrabox Soy Protein Isolate (1 scoop, 34g)',
        calories: 128,
        proteinG: 30,
        date: todayIst,
      })
    );
    expect(scoopRes.autoLoggedSupplement.supplementId).toBe(nutra.id);
    expect(scoopRes.autoLoggedSupplement.servingsTaken).toBe(1);
    expect(scoopRes.autoLoggedSupplement.remainingServings).toBe(29);

    // Non-supplement whole food must NOT auto-deduct
    const eggsRes = parseResult(
      await mealTool.handler({
        action: 'log',
        name: '6 Boiled Eggs',
        calories: 378,
        proteinG: 33,
        date: todayIst,
      })
    );
    expect(eggsRes.autoLoggedSupplement).toBeUndefined();

    // 3. Food/junk transaction + matching meal auto-links linkedTransactionId
    const pizzaTx = parseResult(
      await txTool.handler({
        action: 'create',
        title: "Domino's Pizza",
        amount: 349,
        type: 'expense',
        categoryId: junkCat.id,
        accountId: bank.id,
        date: todayIst,
      })
    ).transaction;

    const pizzaMealRes = parseResult(
      await mealTool.handler({
        action: 'log',
        name: 'Pizza (2 slices)',
        calories: 560,
        proteinG: 20,
        isJunk: true,
        date: todayIst,
      })
    );
    expect(pizzaMealRes.meal.linkedTransactionId).toBe(pizzaTx.id);
    expect(pizzaMealRes.autoLinkedTransaction.id).toBe(pizzaTx.id);
  });
});
