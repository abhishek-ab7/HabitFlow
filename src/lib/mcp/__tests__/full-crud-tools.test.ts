import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getIstIsoDate, getIstMonthKey } from '../config';

const { mockAuthCtx, tableStore } = vi.hoisted(() => ({
  mockAuthCtx: {
    userId: 'user-crud-1',
    authMode: 'secret' as const,
    scopes: ['habitflow:read', 'habitflow:write', 'habitflow:finance:read', 'habitflow:finance:write'],
    clientId: 'test-client',
  },
  tableStore: new Map<string, any[]>(),
}));

import { makeMcpSupabaseFake } from './test-supabase-fake';

function makeSupabaseFake() {
  return makeMcpSupabaseFake(tableStore);
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
  return JSON.parse(res.content[0].text);
}

describe('Complete HabitFlow MCP CRUD Suite (36 Tools Across Habits, Finance & Fitness)', () => {
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
    mockAuthCtx.scopes = [
      'habitflow:read',
      'habitflow:write',
      'habitflow:finance:read',
      'habitflow:finance:write',
    ];
    await setupHabitFlowMcpServer(fakeServer);
  });

  it('registers all 36 domain tools, 7 resources, and 5 prompts', () => {
    expect(registeredTools.size).toBe(36);
    expect(registeredResources.size).toBe(7);
    expect(registeredPrompts.size).toBe(5);
    expect(registeredTools.has('manage_habit_completions')).toBe(true);
    expect(registeredTools.has('manage_habit_stacks')).toBe(true);
    expect(registeredTools.has('manage_fitness_profile')).toBe(true);
  });

  it('handles Habits, Completions, Habit Stacks, Tasks (recursive archive/restore), Milestones, Mood & Settings toggles', async () => {
    const today = getIstIsoDate();

    // 1. Habit create/update with difficulty & metadata + completions CRUD
    const manageHabit = registeredTools.get('manage_habit')!;
    const hCreated = parseResult(
      await manageHabit.handler({
        action: 'create',
        name: 'Deep Work',
        difficulty: 'hard',
        metadata: { block: 'AM' },
      })
    ).habit;
    expect(hCreated.difficulty).toBe('hard');
    expect(hCreated.metadata).toEqual({ block: 'AM' });

    const completionsTool = registeredTools.get('manage_habit_completions')!;
    await completionsTool.handler({ action: 'log', habitId: hCreated.id, date: today, status: 'completed', value: 90 });
    const listedComps = parseResult(await completionsTool.handler({ action: 'list', habitId: hCreated.id }));
    expect(listedComps.count).toBe(1);

    const delCompDenied = await completionsTool.handler({ action: 'delete', habitId: hCreated.id, date: today });
    expect(delCompDenied.isError).toBe(true);
    const delCompOk = parseResult(
      await completionsTool.handler({ action: 'delete', habitId: hCreated.id, date: today, confirm: true })
    );
    expect(delCompOk.action).toBe('deleted');

    // 2. Habit Stacks CRUD
    const stacksTool = registeredTools.get('manage_habit_stacks')!;
    const stackRes = parseResult(
      await stacksTool.handler({
        action: 'create',
        name: 'Morning Kickstart',
        triggerHabitId: hCreated.id,
        stackedHabitIds: [hCreated.id],
        difficulty: 'easy',
      })
    );
    expect(stackRes.stack.name).toBe('Morning Kickstart');

    const activated = parseResult(
      await stacksTool.handler({ action: 'activate', stackId: stackRes.stack.id, isActive: true })
    );
    expect(activated.stack.is_active).toBe(true);
    expect(activated.stack.activation_count).toBe(1);

    await stacksTool.handler({ action: 'delete', stackId: stackRes.stack.id, confirm: true });
    expect(parseResult(await stacksTool.handler({ action: 'list' })).count).toBe(0);

    // 3. Tasks multi-level subtask cascade archive & restore
    const taskTool = registeredTools.get('manage_task')!;
    const root = parseResult(await taskTool.handler({ action: 'create', title: 'Root Task' })).task;
    const child = parseResult(await taskTool.handler({ action: 'create', title: 'Child Task', parentTaskId: root.id })).task;
    const grand = parseResult(await taskTool.handler({ action: 'create', title: 'Grandchild Task', parentTaskId: child.id })).task;

    const archRes = parseResult(await taskTool.handler({ action: 'archive', taskId: root.id, confirm: true }));
    expect(archRes.affectedSubtaskIds).toEqual([child.id, grand.id]);

    const resTask = parseResult(
      await taskTool.handler({ action: 'restore', taskId: root.id, restoreSubtasks: true })
    );
    expect(resTask.restoredSubtaskIds).toEqual([child.id, grand.id]);

    // 4. Milestones list + Mood delete
    const goalTool = registeredTools.get('manage_goal')!;
    const goal = parseResult(await goalTool.handler({ action: 'create', title: 'Run 10K', metadata: { pace: '5:00' } })).goal;
    const milestoneTool = registeredTools.get('manage_milestone')!;
    await milestoneTool.handler({ action: 'create', goalId: goal.id, title: '5K tempo' });
    const msList = parseResult(await milestoneTool.handler({ action: 'list', goalId: goal.id }));
    expect(msList.count).toBe(1);

    const moodTool = registeredTools.get('manage_mood')!;
    await moodTool.handler({ action: 'log', date: today, mood: 'happy' });
    await moodTool.handler({ action: 'delete', date: today, confirm: true });
    expect(parseResult(await moodTool.handler({ action: 'list' })).count).toBe(0);

    // 5. User settings module toggles (showFitness, habitOnlyMode)
    const updateSettings = registeredTools.get('update_user_settings')!;
    const getSettings = registeredTools.get('get_user_settings')!;
    await updateSettings.handler({ showFitness: false, habitOnlyMode: true, streakShield: 2 });
    const settingsOut = parseResult(await getSettings.handler({}));
    expect(settingsOut.modules.showFitness).toBe(false);
    expect(settingsOut.modules.habitOnlyMode).toBe(true);
    expect(settingsOut.gamification.streakShield).toBe(2);
  });

  async function assertNetWorthAndBudgetCrud({ today, monthKey }: { today: string; monthKey: string }) {
    const nwTool = registeredTools.get('manage_net_worth_snapshot')!;
    const nwCap = parseResult(await nwTool.handler({ action: 'capture', monthKey }));
    expect(nwCap.snapshot.snapshot_date).toBe(today);
    expect(nwCap.snapshot.emi_remaining_principal).toBe(0);
    expect(nwCap.snapshot.net_worth).toBe(9500);

    const nwUpd = parseResult(await nwTool.handler({ action: 'update', monthKey, netWorth: 12000 }));
    expect(nwUpd.snapshot.net_worth).toBe(12000);
    await nwTool.handler({ action: 'delete', monthKey, confirm: true });
    expect(parseResult(await nwTool.handler({ action: 'list' })).count).toBe(0);
    await nwTool.handler({ action: 'restore', monthKey });
    expect(parseResult(await nwTool.handler({ action: 'list' })).count).toBe(1);

    const budgetTool = registeredTools.get('manage_finance_budget')!;
    await budgetTool.handler({ action: 'upsert', monthKey, totalBudget: 25000 });
    expect(parseResult(await budgetTool.handler({ action: 'list' })).count).toBe(1);
    await budgetTool.handler({ action: 'delete', monthKey, confirm: true });
    expect(parseResult(await budgetTool.handler({ action: 'list' })).count).toBe(0);
    await budgetTool.handler({ action: 'restore', monthKey });
    expect(parseResult(await budgetTool.handler({ action: 'list' })).count).toBe(1);
  }

  async function assertFriendLoanInstallmentsCrud({ bankId }: { bankId: string }) {
    const debtTool = registeredTools.get('manage_friend_debt')!;
    const loan = parseResult(
      await debtTool.handler({
        action: 'create_entry', personName: 'Amit', direction: 'lent', bucketType: 'long_term_loan', principalAmount: 5000,
      })
    ).debtRecord;

    const updatedLoan = parseResult(
      await debtTool.handler({ action: 'update_entry', debtId: loan.id, notes: 'Bike repair' })
    ).debtRecord;
    expect(updatedLoan.bucket_type).toBe('long_term_loan');

    const payRes = parseResult(
      await debtTool.handler({ action: 'record_payment', debtId: loan.id, paymentAmount: 2000, linkedAccountId: bankId })
    );
    expect(payRes.debtRecord.remaining_amount).toBe(3000);

    const updPay = parseResult(
      await debtTool.handler({ action: 'update_payment', installmentId: payRes.installment.id, paymentAmount: 2500 })
    );
    expect(updPay.debtRecord.remaining_amount).toBe(2500);

    const delPay = parseResult(
      await debtTool.handler({ action: 'delete_payment', installmentId: payRes.installment.id, confirm: true })
    );
    expect(delPay.debtRecord.remaining_amount).toBe(5000);

    const restPay = parseResult(
      await debtTool.handler({ action: 'restore_payment', installmentId: payRes.installment.id })
    );
    expect(restPay.debtRecord.remaining_amount).toBe(2500);
  }

  it('handles Finance CRUD + bugfixes (fallback category, net worth columns, tx restore, friend installments)', async () => {
    const today = getIstIsoDate();
    const monthKey = getIstMonthKey();

    const accTool = registeredTools.get('manage_finance_account')!;
    const bank = parseResult(
      await accTool.handler({ action: 'create', name: 'HDFC Bank', type: 'bank', balance: 10000 })
    ).account;

    const txTool = registeredTools.get('manage_transaction')!;
    const txRes = parseResult(
      await txTool.handler({ action: 'create', title: 'Metro Ticket', amount: 500, type: 'expense', accountId: bank.id, date: today })
    );
    expect(txRes.transaction.category_id).toBeTruthy();
    expect(txRes.updatedAccounts[0].newBalance).toBe(9500);

    const delTx = parseResult(await txTool.handler({ action: 'delete', transactionId: txRes.transaction.id, confirm: true }));
    expect(delTx.updatedAccounts[0].newBalance).toBe(10000);
    const resTx = parseResult(await txTool.handler({ action: 'restore', transactionId: txRes.transaction.id }));
    expect(resTx.updatedAccounts[0].newBalance).toBe(9500);

    await assertNetWorthAndBudgetCrud({ today, monthKey });
    await assertFriendLoanInstallmentsCrud({ bankId: bank.id });
  });

  it('handles Fitness profile & daily body metrics CRUD with Low-Energy gym auto-rest hooks', async () => {
    const today = getIstIsoDate();
    const gymHabit = parseResult(
      await registeredTools.get('manage_habit')!.handler({ action: 'create', name: 'Push Day', anchor_block: 'gym' })
    ).habit;

    const profTool = registeredTools.get('manage_fitness_profile')!;
    const pUpsert = parseResult(
      await profTool.handler({ action: 'upsert', calorieTarget: 2100, proteinTargetG: 150, lowEnergyCalorieCeiling: 1750 })
    );
    expect(pUpsert.profile.calorieTarget).toBe(2100);
    await profTool.handler({ action: 'delete', confirm: true });
    expect(parseResult(await profTool.handler({ action: 'get' })).profile).toBeNull();
    await profTool.handler({ action: 'restore' });
    expect(parseResult(await profTool.handler({ action: 'get' })).profile.proteinTargetG).toBe(150);

    const bodyTool = registeredTools.get('log_daily_body_metrics')!;
    const lowRes = parseResult(
      await bodyTool.handler({ action: 'upsert', date: today, lowEnergyMode: true, autoRestGymHabits: true, steps: 4200 })
    );
    expect(lowRes.autoRestedHabitIds).toEqual([gymHabit.id]);
    expect(lowRes.dailyLog.restedHabitIds).toEqual([gymHabit.id]);
    expect(parseResult(await bodyTool.handler({ action: 'list' })).count).toBe(1);
    await bodyTool.handler({ action: 'delete', date: today, confirm: true });
    expect(parseResult(await bodyTool.handler({ action: 'list' })).count).toBe(0);
    await bodyTool.handler({ action: 'restore', date: today });
    expect(parseResult(await bodyTool.handler({ action: 'list' })).count).toBe(1);
  });

  it('handles Fitness meals, workouts & supplements CRUD with compound expense & stock recompute', async () => {
    const today = getIstIsoDate();
    const bank = parseResult(
      await registeredTools.get('manage_finance_account')!.handler({ action: 'create', name: 'UPI Wallet', type: 'upi', balance: 5000 })
    ).account;

    const mealTool = registeredTools.get('manage_meals')!;
    const tpl = parseResult(await mealTool.handler({ action: 'upsert_template', name: 'Chicken Bowl', calories: 550, proteinG: 42 })).template;
    const paidMeal = parseResult(await mealTool.handler({ action: 'log', templateId: tpl.id, date: today, expenseAmount: 320, accountId: bank.id }));
    expect(paidMeal.meal.linkedTransactionId).toBe(paidMeal.linkedTransaction.id);
    expect(paidMeal.updatedAccounts[0].newBalance).toBe(4680);

    expect(parseResult(await mealTool.handler({ action: 'update', mealId: paidMeal.meal.id, calories: 600 })).meal.calories).toBe(600);
    await mealTool.handler({ action: 'delete', mealId: paidMeal.meal.id, confirm: true });
    await mealTool.handler({ action: 'restore', mealId: paidMeal.meal.id });
    expect(parseResult(await mealTool.handler({ action: 'list', date: today })).count).toBe(1);
    await mealTool.handler({ action: 'delete_template', templateId: tpl.id, confirm: true });
    expect(parseResult(await mealTool.handler({ action: 'list_templates' })).count).toBe(0);
    await mealTool.handler({ action: 'restore_template', templateId: tpl.id });
    expect(parseResult(await mealTool.handler({ action: 'list_templates' })).count).toBe(1);

    const workoutTool = registeredTools.get('manage_workouts')!;
    const wLog = parseResult(await workoutTool.handler({ action: 'log', date: today, title: 'Upper A', durationMinutes: 45 })).workout;
    expect(parseResult(await workoutTool.handler({ action: 'update', workoutId: wLog.id, durationMinutes: 60, rpe: 8 })).workout.durationMinutes).toBe(60);
    await workoutTool.handler({ action: 'delete', workoutId: wLog.id, confirm: true });
    await workoutTool.handler({ action: 'restore', workoutId: wLog.id });
    expect(parseResult(await workoutTool.handler({ action: 'list' })).count).toBe(1);

    const supTool = registeredTools.get('manage_supplements')!;
    const whey = parseResult(await supTool.handler({ action: 'upsert_item', name: 'Whey Isolate', totalServings: 30, costInr: 2500 })).item;
    const dose = parseResult(await supTool.handler({ action: 'log_dose', supplementId: whey.id, date: today, servingsTaken: 2 }));
    expect(dose.remainingServings).toBe(28);
    expect(parseResult(await supTool.handler({ action: 'update_log', logId: dose.log.id, servingsTaken: 3 })).remainingServings).toBe(27);
    expect(parseResult(await supTool.handler({ action: 'delete_log', logId: dose.log.id, confirm: true })).remainingServings).toBe(30);
    expect(parseResult(await supTool.handler({ action: 'restore_log', logId: dose.log.id })).remainingServings).toBe(27);

    const restock = parseResult(await supTool.handler({ action: 'restock_item', supplementId: whey.id, addedServings: 30, expenseAmount: 2600, accountId: bank.id }));
    expect(restock.item.remainingServings).toBe(57);
    expect(restock.item.linkedTransactionId).toBe(restock.linkedTransaction.id);
    expect(restock.updatedAccounts[0].newBalance).toBe(2080);

    await supTool.handler({ action: 'delete_item', supplementId: whey.id, confirm: true });
    expect(parseResult(await supTool.handler({ action: 'list_inventory' })).items.length).toBe(0);
    await supTool.handler({ action: 'restore_item', supplementId: whey.id });
    expect(parseResult(await supTool.handler({ action: 'list_inventory' })).items.length).toBe(1);
  });
});
