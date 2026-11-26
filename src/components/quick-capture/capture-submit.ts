import { toast } from 'sonner';
import { useFinanceStore } from '@/lib/stores/finance-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import { useTaskStore } from '@/lib/stores/task-store';
import type {
  SupplementInventory,
  UniversalBioAction,
  UniversalCaptureAction,
  UniversalExpenseAction,
  UniversalMealAction,
  UniversalSupplementAction,
  UniversalTaskAction,
  UniversalWorkoutAction,
} from './capture-types';

type FinanceState = ReturnType<typeof useFinanceStore.getState>;
type FitnessState = ReturnType<typeof useFitnessStore.getState>;
type TaskState = ReturnType<typeof useTaskStore.getState>;

function resolveExpenseCategoryId(
  action: UniversalExpenseAction,
  categories: FinanceState['categories']
): string | undefined {
  if (action.categoryId) return action.categoryId;
  if (action.isJunkFood) {
    const junk = categories.find((c) => c.slug.includes('junk') || /junk\s*food/i.test(c.name));
    if (junk) return junk.id;
  }
  return categories[0]?.id;
}

async function submitExpenseActions(params: {
  actions: UniversalExpenseAction[];
  addTransaction: FinanceState['addTransaction'];
  createdTxIdsByActionId: Map<string, string>;
  logsSummary: string[];
}) {
  const freshAccounts = useFinanceStore.getState().accounts.filter((a) => !a.archived && !a.deletedAt);
  const freshCategories = useFinanceStore.getState().categories.filter((c) => !c.archived && !c.deletedAt);

  for (const action of params.actions) {
    const accountId = action.accountId || freshAccounts[0]?.id;
    const categoryId = resolveExpenseCategoryId(action, freshCategories);
    if (!accountId || !categoryId) {
      toast.error('Create a Finance account & category first before logging expenses');
      continue;
    }
    const tx = await params.addTransaction({
      title: action.title, amount: action.amount, type: action.txType,
      categoryId, accountId, date: action.date, tags: ['universal-capture'],
    });
    params.createdTxIdsByActionId.set(action.id, tx.id);
    params.logsSummary.push(`₹${tx.amount} ${tx.title}`);
  }
}

async function submitMealActions(params: {
  actions: UniversalMealAction[];
  uid: string;
  upsertMealFromCapture: FitnessState['upsertMealFromCapture'];
  createdTxIdsByActionId: Map<string, string>;
  logsSummary: string[];
}) {
  for (const action of params.actions) {
    const linkedTxId = action.linkedExpenseActionId ? params.createdTxIdsByActionId.get(action.linkedExpenseActionId) || null : null;
    await params.upsertMealFromCapture({
      userId: params.uid, date: action.date, name: action.name, calories: action.calories,
      proteinG: action.proteinG, carbsG: action.carbsG, fatG: action.fatG,
      mealType: action.mealType, isJunk: action.isJunk, linkedTransactionId: linkedTxId,
      templateId: action.templateId || null,
    });
    params.logsSummary.push(`${action.name} (${action.calories} kcal)`);
  }
}

async function submitWorkoutActions(params: {
  actions: UniversalWorkoutAction[];
  uid: string;
  addWorkoutSession: FitnessState['addWorkoutSession'];
  logsSummary: string[];
}) {
  for (const action of params.actions) {
    await params.addWorkoutSession({
      date: action.date, title: action.title, workoutType: action.workoutType,
      durationMinutes: action.durationMinutes, estimatedCaloriesBurned: action.estimatedCaloriesBurned,
      exercises: action.exercises, source: 'universal_capture',
    }, params.uid);
    params.logsSummary.push(`${action.title} (${action.durationMinutes}m)`);
  }
}

const BIO_PATCH_KEYS: Array<[keyof UniversalBioAction, string]> = [
  ['stepsExact', 'steps'],
  ['sleepHours', 'sleepHours'],
  ['energyLevel', 'energyLevel'],
  ['weightKg', 'weightKg'],
  ['waistInches', 'waistInches'],
];

function buildBioPatch(action: UniversalBioAction): Record<string, number> {
  const patch: Record<string, number> = {};
  for (const [srcKey, destKey] of BIO_PATCH_KEYS) {
    const val = action[srcKey];
    if (typeof val === 'number') patch[destKey] = val;
  }
  return patch;
}

async function submitSingleBioAction(params: {
  action: UniversalBioAction;
  uid: string;
  incrementWater: FitnessState['incrementWater'];
  incrementSteps: FitnessState['incrementSteps'];
  upsertDailyLog: FitnessState['upsertDailyLog'];
}) {
  const { action, uid } = params;
  if (action.waterDeltaMl) await params.incrementWater(action.waterDeltaMl, action.date, uid);
  if (action.stepsDelta) await params.incrementSteps(action.stepsDelta, action.date, uid);
  const patch = buildBioPatch(action);
  if (Object.keys(patch).length > 0) await params.upsertDailyLog(action.date, patch, uid);
}

async function submitBioActions(params: {
  actions: UniversalBioAction[];
  uid: string;
  incrementWater: FitnessState['incrementWater'];
  incrementSteps: FitnessState['incrementSteps'];
  upsertDailyLog: FitnessState['upsertDailyLog'];
  logsSummary: string[];
}) {
  for (const action of params.actions) {
    await submitSingleBioAction({
      action, uid: params.uid,
      incrementWater: params.incrementWater, incrementSteps: params.incrementSteps, upsertDailyLog: params.upsertDailyLog,
    });
    params.logsSummary.push('Bio check-in');
  }
}

function findSupplementTarget(
  action: UniversalSupplementAction,
  supplements: SupplementInventory[]
): SupplementInventory | undefined {
  const active = supplements.filter((s) => !s.deletedAt);
  if (action.supplementId) {
    const byId = active.find((s) => s.id === action.supplementId);
    if (byId) return byId;
  }
  const needle = action.supplementName.toLowerCase();
  return active.find((s) => s.name.toLowerCase().includes(needle));
}

async function submitSupplementActions(params: {
  actions: UniversalSupplementAction[];
  uid: string;
  supplements: SupplementInventory[];
  takeSupplementDose: FitnessState['takeSupplementDose'];
  logsSummary: string[];
}) {
  for (const action of params.actions) {
    const target = findSupplementTarget(action, params.supplements);
    if (!target) {
      toast.info(`Add "${action.supplementName}" in Fitness → Supplements to track stock`);
      continue;
    }
    await params.takeSupplementDose(target.id, action.servings, action.date, null, params.uid);
    params.logsSummary.push(target.name);
  }
}

function buildTaskPayload(action: UniversalTaskAction) {
  return {
    title: action.title,
    priority: action.priority,
    isUrgent: action.isUrgent,
    due_date: action.dueDate,
    estimatedTime: action.estimateMinutes,
    tags: action.domainTag ? [action.domainTag] : [],
    metadata: {
      ...(action.dueTime ? { dueTime: action.dueTime } : {}),
      ...(action.domainTag ? { domain: action.domainTag } : {}),
    },
  };
}

async function submitTaskActions(params: {
  actions: UniversalTaskAction[];
  addTask: TaskState['addTask'];
  logsSummary: string[];
}) {
  for (const action of params.actions) {
    await params.addTask(buildTaskPayload(action));
    params.logsSummary.push(`Task: ${action.title}`);
  }
}

export async function executeQuickCaptureSubmit(params: {
  activeActions: UniversalCaptureAction[];
  uid: string;
  accountsLength: number;
  categoriesLength: number;
  supplements: SupplementInventory[];
  loadFinanceData: FinanceState['loadFinanceData'];
  addTransaction: FinanceState['addTransaction'];
  upsertMealFromCapture: FitnessState['upsertMealFromCapture'];
  addWorkoutSession: FitnessState['addWorkoutSession'];
  incrementWater: FitnessState['incrementWater'];
  incrementSteps: FitnessState['incrementSteps'];
  upsertDailyLog: FitnessState['upsertDailyLog'];
  takeSupplementDose: FitnessState['takeSupplementDose'];
  addTask: TaskState['addTask'];
}): Promise<string[]> {
  const expenses = params.activeActions.filter((a): a is UniversalExpenseAction => a.kind === 'expense');
  const needsFinanceSync = params.accountsLength === 0 || params.categoriesLength === 0;
  if (expenses.length > 0 && needsFinanceSync) {
    await params.loadFinanceData(params.uid);
  }

  const createdTxIdsByActionId = new Map<string, string>();
  const logsSummary: string[] = [];

  await submitExpenseActions({ actions: expenses, addTransaction: params.addTransaction, createdTxIdsByActionId, logsSummary });
  await submitMealActions({
    actions: params.activeActions.filter((a): a is UniversalMealAction => a.kind === 'meal'),
    uid: params.uid, upsertMealFromCapture: params.upsertMealFromCapture, createdTxIdsByActionId, logsSummary,
  });
  await submitWorkoutActions({
    actions: params.activeActions.filter((a): a is UniversalWorkoutAction => a.kind === 'workout'),
    uid: params.uid, addWorkoutSession: params.addWorkoutSession, logsSummary,
  });
  await submitBioActions({
    actions: params.activeActions.filter((a): a is UniversalBioAction => a.kind === 'bio'),
    uid: params.uid, incrementWater: params.incrementWater, incrementSteps: params.incrementSteps, upsertDailyLog: params.upsertDailyLog, logsSummary,
  });
  await submitSupplementActions({
    actions: params.activeActions.filter((a): a is UniversalSupplementAction => a.kind === 'supplement'),
    uid: params.uid, supplements: params.supplements, takeSupplementDose: params.takeSupplementDose, logsSummary,
  });
  await submitTaskActions({
    actions: params.activeActions.filter((a): a is UniversalTaskAction => a.kind === 'task'),
    addTask: params.addTask, logsSummary,
  });

  return logsSummary;
}
