import Dexie, { type EntityTable } from 'dexie';
import { syncSensoryPrefsFromSettings } from '@/lib/feedback/sensory-engine';
import type {
  Habit,
  HabitCompletion,
  Goal,
  Milestone,
  UserSettings,
  HabitFormData,
  GoalFormData,
  MilestoneFormData,
  Task,
  TaskFormData,
  MoodLog,
  MoodType,
  FinanceAccount,
  FinanceCategory,
  FinanceTransaction,
  FinanceBudget,
  MonthlyCommitment,
  DebtRecord,
  DebtInstallment,
  EmiTracker,
  FinanceSipPlan,
  FinanceCategorizationRule,
  FinanceRecurringBill,
  FinanceNetWorthSnapshot,
  CreditCardStatement,
  FitnessProfile,
  FitnessDailyLog,
  MealTemplate,
  MealLog,
  WorkoutSession,
  SupplementInventory,
  SupplementLog,
} from './types';

// Domain Type Aliases to resolve Primitive Obsession
export type UserId = string;
export type HabitId = string;
export type GoalId = string;
export type MilestoneId = string;
export type TaskId = string;
export type ISODate = string;

// Define the database schema
const db = new Dexie('HabitFlowDB') as Dexie & {
  habits: EntityTable<Habit, 'id'>;
  completions: EntityTable<HabitCompletion, 'id'>;
  goals: EntityTable<Goal, 'id'>;
  milestones: EntityTable<Milestone, 'id'>;
  userSettings: EntityTable<UserSettings, 'id'>;
  tasks: EntityTable<Task, 'id'>;
  moodLogs: EntityTable<MoodLog, 'id'>;
  financeCategories: EntityTable<FinanceCategory, 'id'>;
  financeAccounts: EntityTable<FinanceAccount, 'id'>;
  financeTransactions: EntityTable<FinanceTransaction, 'id'>;
  financeBudgets: EntityTable<FinanceBudget, 'id'>;
  monthlyCommitments: EntityTable<MonthlyCommitment, 'id'>;
  debtRecords: EntityTable<DebtRecord, 'id'>;
  debtInstallments: EntityTable<DebtInstallment, 'id'>;
  emiTrackers: EntityTable<EmiTracker, 'id'>;
  financeSipPlans: EntityTable<FinanceSipPlan, 'id'>;
  financeCategorizationRules: EntityTable<FinanceCategorizationRule, 'id'>;
  financeRecurringBills: EntityTable<FinanceRecurringBill, 'id'>;
  financeNetWorthSnapshots: EntityTable<FinanceNetWorthSnapshot, 'id'>;
  creditCardStatements: EntityTable<CreditCardStatement, 'id'>;
  fitnessProfiles: EntityTable<FitnessProfile, 'id'>;
  fitnessDailyLogs: EntityTable<FitnessDailyLog, 'id'>;
  mealTemplates: EntityTable<MealTemplate, 'id'>;
  mealLogs: EntityTable<MealLog, 'id'>;
  workoutSessions: EntityTable<WorkoutSession, 'id'>;
  supplementInventory: EntityTable<SupplementInventory, 'id'>;
  supplementLogs: EntityTable<SupplementLog, 'id'>;
};

// Schema version 5 - Added HabitRoutines junction table for many-to-many
db.version(5).stores({
  habits: 'id, userId, name, category, archived, order, createdAt, routineId',
  completions: 'id, userId, habitId, date, [habitId+date]',
  goals: 'id, userId, title, areaOfLife, status, archived, isFocus, deadline, createdAt',
  milestones: 'id, userId, goalId, completed, order',
  userSettings: 'id, userId',
  tasks: 'id, userId, status, priority, due_date, created_at',
  routines: 'id, userId, isActive, orderIndex',
  habitRoutines: 'id, habitId, routineId, [habitId+routineId]',
}).upgrade(async tx => {
  const habits = await tx.table('habits').toArray();
  const habitRoutines = habits
    .filter((h: any) => h.routineId)
    .map((h: any) => ({
      id: crypto.randomUUID(),
      habitId: h.id,
      routineId: h.routineId,
      orderIndex: 0,
      createdAt: new Date().toISOString(),
    }));

  if (habitRoutines.length > 0) {
    await tx.table('habitRoutines').bulkAdd(habitRoutines);
  }
});

// Schema version 6 - Add updatedAt timestamps for conflict resolution
db.version(6).stores({
  habits: 'id, userId, name, category, archived, order, createdAt, routineId',
  completions: 'id, userId, habitId, date, [habitId+date], updatedAt',
  goals: 'id, userId, title, areaOfLife, status, archived, isFocus, deadline, createdAt, updatedAt',
  milestones: 'id, userId, goalId, completed, order, updatedAt',
  userSettings: 'id, userId, updatedAt',
  tasks: 'id, userId, status, priority, due_date, created_at, updated_at',
  routines: 'id, userId, isActive, orderIndex, updatedAt',
  habitRoutines: 'id, habitId, routineId, [habitId+routineId], updatedAt',
}).upgrade(async tx => {
  const now = new Date().toISOString();

  // Completions
  const completions = await tx.table('completions').toArray();
  for (const c of completions) {
    if (!c.updatedAt) {
      await tx.table('completions').update(c.id, {
        updatedAt: c.createdAt || now
      });
    }
  }

  // Milestones
  const milestones = await tx.table('milestones').toArray();
  for (const m of milestones) {
    if (!m.updatedAt) {
      await tx.table('milestones').update(m.id, {
        updatedAt: m.createdAt || now
      });
    }
  }

  // Goals
  const goals = await tx.table('goals').toArray();
  for (const g of goals) {
    if (!g.updatedAt) {
      await tx.table('goals').update(g.id, {
        updatedAt: g.createdAt || now
      });
    }
  }

  // UserSettings
  const settings = await tx.table('userSettings').toArray();
  for (const s of settings) {
    if (!s.updatedAt) {
      await tx.table('userSettings').update(s.id, {
        updatedAt: s.createdAt || now
      });
    }
  }

  // Routines
  const routines = await tx.table('routines').toArray();
  for (const r of routines) {
    if (!r.updatedAt) {
      await tx.table('routines').update(r.id, {
        updatedAt: r.createdAt || now
      });
    }
  }

  // HabitRoutines
  const habitRoutines = await tx.table('habitRoutines').toArray();
  for (const hr of habitRoutines) {
    if (!hr.updatedAt) {
      await tx.table('habitRoutines').update(hr.id, {
        updatedAt: hr.createdAt || now
      });
    }
  }
});

// Schema version 7 - Add sub-tasks and routine completions
db.version(7).stores({
  habits: 'id, userId, name, category, archived, order, createdAt, routineId',
  completions: 'id, userId, habitId, date, [habitId+date], updatedAt',
  goals: 'id, userId, title, areaOfLife, status, archived, isFocus, deadline, createdAt, updatedAt',
  milestones: 'id, userId, goalId, completed, order, updatedAt',
  userSettings: 'id, userId, updatedAt',
  tasks: 'id, userId, status, priority, due_date, created_at, updated_at, parentTaskId, depth',
  routines: 'id, userId, isActive, orderIndex, updatedAt',
  habitRoutines: 'id, habitId, routineId, [habitId+routineId], updatedAt',
  routineCompletions: 'id, userId, routineId, date, [routineId+date], updatedAt',
}).upgrade(async tx => {
  const tasks = await tx.table('tasks').toArray();
  for (const task of tasks) {
    if (task.depth === undefined) {
      await tx.table('tasks').update(task.id, {
        depth: 0,
        parentTaskId: null
      });
    }
  }
});

// Schema version 8 - Add moodLogs table for premium features
db.version(8).stores({
  habits: 'id, userId, name, category, archived, order, createdAt, routineId, isQuantitative',
  completions: 'id, userId, habitId, date, [habitId+date], updatedAt',
  goals: 'id, userId, title, areaOfLife, status, archived, isFocus, deadline, createdAt, updatedAt',
  milestones: 'id, userId, goalId, completed, order, updatedAt',
  userSettings: 'id, userId, updatedAt',
  tasks: 'id, userId, status, priority, due_date, created_at, updated_at, parentTaskId, depth',
  routines: 'id, userId, isActive, orderIndex, updatedAt',
  habitRoutines: 'id, habitId, routineId, [habitId+routineId], updatedAt',
  routineCompletions: 'id, userId, routineId, date, [routineId+date], updatedAt',
  moodLogs: 'id, userId, date, [userId+date], updatedAt',
});

// Schema version 9 - Add generationCounter for conflict resolution
db.version(9).stores({
  habits: 'id, userId, name, category, archived, order, createdAt, routineId, isQuantitative',
  completions: 'id, userId, habitId, date, [habitId+date], updatedAt',
  goals: 'id, userId, title, areaOfLife, status, archived, isFocus, deadline, createdAt, updatedAt',
  milestones: 'id, userId, goalId, completed, order, updatedAt',
  userSettings: 'id, userId, updatedAt',
  tasks: 'id, userId, status, priority, due_date, created_at, updated_at, parentTaskId, depth',
  routines: 'id, userId, isActive, orderIndex, updatedAt',
  habitRoutines: 'id, habitId, routineId, [habitId+routineId], updatedAt',
  routineCompletions: 'id, userId, routineId, date, [routineId+date], updatedAt',
  moodLogs: 'id, userId, date, [userId+date], updatedAt',
}).upgrade(async tx => {
  const tables = ['habits', 'completions', 'goals', 'milestones', 'userSettings', 'tasks', 'routines', 'habitRoutines', 'routineCompletions', 'moodLogs'];
  for (const tableName of tables) {
    const items = await tx.table(tableName).toArray();
    for (const item of items) {
      if (item.generationCounter === undefined) {
        await tx.table(tableName).update(item.id, {
          generationCounter: 1
        });
      }
    }
  }
});

// Schema version 10 - Remove routines, habitRoutines, and routineCompletions tables
db.version(10).stores({
  habits: 'id, userId, name, category, archived, order, createdAt, isQuantitative',
  completions: 'id, userId, habitId, date, [habitId+date], updatedAt',
  goals: 'id, userId, title, areaOfLife, status, archived, isFocus, deadline, createdAt, updatedAt',
  milestones: 'id, userId, goalId, completed, order, updatedAt',
  userSettings: 'id, userId, updatedAt',
  tasks: 'id, userId, status, priority, due_date, created_at, updated_at, parentTaskId, depth',
  moodLogs: 'id, userId, date, [userId+date], updatedAt',
  routines: null,
  habitRoutines: null,
  routineCompletions: null
});

// Schema version 11 - Add FlowFinance personal finance, monthly commitments, debt ledger, and EMI tracker tables
db.version(11).stores({
  habits: 'id, userId, name, category, archived, order, createdAt, isQuantitative',
  completions: 'id, userId, habitId, date, [habitId+date], updatedAt',
  goals: 'id, userId, title, areaOfLife, status, archived, isFocus, deadline, createdAt, updatedAt',
  milestones: 'id, userId, goalId, completed, order, updatedAt',
  userSettings: 'id, userId, updatedAt',
  tasks: 'id, userId, status, priority, due_date, created_at, updated_at, parentTaskId, depth',
  moodLogs: 'id, userId, date, [userId+date], updatedAt',
  financeCategories: 'id, userId, slug, type, order, archived, updatedAt',
  financeAccounts: 'id, userId, type, isDefault, archived, updatedAt',
  financeTransactions: 'id, userId, date, monthKey, categoryId, accountId, type, linkedCommitmentId, linkedDebtId, linkedEmiId, [userId+monthKey], updatedAt',
  financeBudgets: 'id, userId, monthKey, [userId+monthKey], updatedAt',
  monthlyCommitments: 'id, userId, isActive, dueDayOfMonth, updatedAt',
  debtRecords: 'id, userId, direction, status, updatedAt',
  debtInstallments: 'id, userId, debtId, date, monthKey, transactionId, updatedAt',
  emiTrackers: 'id, userId, status, billingDayOfMonth, updatedAt',
});

// Schema version 12 - HabitFlow V2: Flexible Habits & Rest Days, SIP Plans, Categorization Rules, Recurring Bills
db.version(12).stores({
  habits: 'id, userId, name, category, archived, order, createdAt, isQuantitative, frequencyType',
  completions: 'id, userId, habitId, date, [habitId+date], status, updatedAt',
  goals: 'id, userId, title, areaOfLife, status, archived, isFocus, deadline, createdAt, updatedAt',
  milestones: 'id, userId, goalId, completed, order, updatedAt',
  userSettings: 'id, userId, updatedAt',
  tasks: 'id, userId, status, priority, due_date, created_at, updated_at, parentTaskId, depth',
  moodLogs: 'id, userId, date, [userId+date], updatedAt',
  financeCategories: 'id, userId, slug, type, order, archived, updatedAt',
  financeAccounts: 'id, userId, type, isDefault, archived, updatedAt',
  financeTransactions: 'id, userId, date, monthKey, categoryId, accountId, type, linkedCommitmentId, linkedDebtId, linkedEmiId, linkedSipId, needsReview, [userId+monthKey], updatedAt',
  financeBudgets: 'id, userId, monthKey, [userId+monthKey], updatedAt',
  monthlyCommitments: 'id, userId, isActive, dueDayOfMonth, updatedAt',
  debtRecords: 'id, userId, direction, status, updatedAt',
  debtInstallments: 'id, userId, debtId, date, monthKey, transactionId, updatedAt',
  emiTrackers: 'id, userId, status, billingDayOfMonth, updatedAt',
  financeSipPlans: 'id, userId, isActive, sipDayOfMonth, updatedAt',
  financeCategorizationRules: 'id, userId, isActive, categoryId, updatedAt',
  financeRecurringBills: 'id, userId, isActive, dueDayOfMonth, updatedAt',
}).upgrade(async tx => {
  const habits = await tx.table('habits').toArray();
  for (const h of habits) {
    if (!h.frequencyType) {
      const freq = (h.targetDaysPerWeek ?? 7) < 7 ? 'weekly_flexible' : 'daily';
      await tx.table('habits').update(h.id, {
        frequencyType: freq,
        allowBonusCompletions: true,
      });
    }
  }
  const completions = await tx.table('completions').toArray();
  for (const c of completions) {
    if (c.skipped && !c.status) {
      await tx.table('completions').update(c.id, { status: 'rest' });
    }
  }
});

// Schema version 13 - Finance V3: Net Worth Historical Snapshots & Split Group indexing
db.version(13).stores({
  habits: 'id, userId, name, category, archived, order, createdAt, isQuantitative, frequencyType',
  completions: 'id, userId, habitId, date, [habitId+date], status, updatedAt',
  goals: 'id, userId, title, areaOfLife, status, archived, isFocus, deadline, createdAt, updatedAt',
  milestones: 'id, userId, goalId, completed, order, updatedAt',
  userSettings: 'id, userId, updatedAt',
  tasks: 'id, userId, status, priority, due_date, created_at, updated_at, parentTaskId, depth',
  moodLogs: 'id, userId, date, [userId+date], updatedAt',
  financeCategories: 'id, userId, slug, type, order, archived, updatedAt',
  financeAccounts: 'id, userId, type, isDefault, archived, updatedAt',
  financeTransactions: 'id, userId, date, monthKey, categoryId, accountId, type, linkedCommitmentId, linkedDebtId, linkedEmiId, linkedSipId, splitGroupId, needsReview, [userId+monthKey], updatedAt',
  financeBudgets: 'id, userId, monthKey, [userId+monthKey], updatedAt',
  monthlyCommitments: 'id, userId, isActive, dueDayOfMonth, updatedAt',
  debtRecords: 'id, userId, direction, status, updatedAt',
  debtInstallments: 'id, userId, debtId, date, monthKey, transactionId, updatedAt',
  emiTrackers: 'id, userId, status, billingDayOfMonth, updatedAt',
  financeSipPlans: 'id, userId, isActive, sipDayOfMonth, updatedAt',
  financeCategorizationRules: 'id, userId, isActive, categoryId, updatedAt',
  financeRecurringBills: 'id, userId, isActive, dueDayOfMonth, updatedAt',
  financeNetWorthSnapshots: 'id, userId, monthKey, [userId+monthKey], updatedAt',
});

// Schema version 14 - Per-Friend Isolated Ledgers: Everyday Splits vs. Long-Term Loans / EMIs
db.version(14).stores({
  debtRecords: 'id, userId, direction, status, bucketType, updatedAt',
}).upgrade(async (tx) => {
  const debts = await tx.table('debtRecords').toArray();
  for (const d of debts) {
    if (!d.bucketType) {
      await tx.table('debtRecords').update(d.id, {
        bucketType: 'long_term_loan',
        isEmi: d.isEmi ?? false,
        paidInstallments: d.paidInstallments ?? 0,
      });
    }
  }
});

// Schema version 15 - Multi-Card Credit Card Billing Cycles & Dual-Bucket Statements
db.version(15).stores({
  creditCardStatements: 'id, userId, accountId, cycleKey, [accountId+cycleKey], status, dueDate, updatedAt, deletedAt',
});

// Schema version 16 - Quick Notes persistence on Tasks
db.version(16).stores({
  tasks: 'id, userId, status, priority, due_date, created_at, updated_at, parentTaskId, depth',
}).upgrade(async (tx) => {
  const existingTasks = await tx.table('tasks').toArray();
  for (const t of existingTasks) {
    if (t.notes === undefined) {
      await tx.table('tasks').update(t.id, { notes: null });
    }
  }
});

// Schema version 17 - Phase 2 Life OS: Fitness, Diet, Bio Check-Ins, Workouts & Supplement Inventory
db.version(17).stores({
  habits: 'id, userId, name, category, archived, order, createdAt, isQuantitative, frequencyType, polarity, anchorBlock',
  fitnessProfiles: 'id, userId, updatedAt, deletedAt',
  fitnessDailyLogs: 'id, userId, date, [userId+date], updatedAt, deletedAt',
  mealTemplates: 'id, userId, name, isPinned, order, updatedAt, deletedAt',
  mealLogs: 'id, userId, date, [userId+date], mealType, linkedTransactionId, templateId, isJunk, updatedAt, deletedAt',
  workoutSessions: 'id, userId, date, [userId+date], workoutType, updatedAt, deletedAt',
  supplementInventory: 'id, userId, name, category, isActive, linkedTransactionId, updatedAt, deletedAt',
  supplementLogs: 'id, userId, supplementId, date, [userId+date], updatedAt, deletedAt',
});

// Schema version 18 - Phase 2B Life OS: Derived Supplement Stock, Protein ROI, Anchor Block & Low-Energy Mode
db.version(18).stores({
  supplementInventory: 'id, userId, name, category, anchorBlock, isActive, linkedTransactionId, updatedAt, deletedAt',
}).upgrade(async (tx) => {
  const supplements = await tx.table('supplementInventory').toArray();
  const logs = await tx.table('supplementLogs').toArray();
  const activeLogsBySup = new Map<string, number>();
  for (const log of logs) {
    if (!log.deletedAt) {
      activeLogsBySup.set(
        log.supplementId,
        (activeLogsBySup.get(log.supplementId) || 0) + Number(log.servingsTaken || 0)
      );
    }
  }
  for (const s of supplements) {
    if (s.manualAdjustment === undefined) {
      const taken = activeLogsBySup.get(s.id) || 0;
      const expectedWithoutAdj = Math.max(0, Number(s.totalServings || 0) - taken);
      const currentRem = Number(s.remainingServings ?? expectedWithoutAdj);
      const inferredAdjustment = Number((currentRem - expectedWithoutAdj).toFixed(2));
      await tx.table('supplementInventory').update(s.id, {
        manualAdjustment: inferredAdjustment,
      });
    }
  }
});

// Schema version 19 - Compound string-safe indexes for cold start & incremental sync performance
db.version(19).stores({
  habits: 'id, userId, name, category, archived, order, createdAt, updatedAt, isQuantitative, frequencyType, polarity, anchorBlock',
  completions: 'id, userId, habitId, date, [habitId+date], [userId+date], status, updatedAt',
  tasks: 'id, userId, status, [userId+status], priority, due_date, created_at, updated_at, parentTaskId, depth',
  financeCategories: 'id, userId, slug, [userId+slug], type, order, archived, updatedAt',
  financeTransactions: 'id, userId, date, [userId+date], monthKey, categoryId, accountId, toAccountId, paidStatementId, type, linkedCommitmentId, linkedDebtId, linkedEmiId, linkedSipId, splitGroupId, needsReview, [userId+monthKey], updatedAt',
  monthlyCommitments: 'id, userId, isActive, dueDayOfMonth, defaultCategoryId, updatedAt',
});

// Register hooks for syncing database tables automatically
const syncTables = [
  'habits', 'completions', 'goals', 'milestones', 
  'userSettings', 'tasks', 'moodLogs',
  'financeCategories', 'financeAccounts', 'financeTransactions',
  'financeBudgets', 'monthlyCommitments', 'debtRecords',
  'debtInstallments', 'emiTrackers',
  'financeSipPlans', 'financeCategorizationRules', 'financeRecurringBills',
  'financeNetWorthSnapshots', 'creditCardStatements',
  'fitnessProfiles', 'fitnessDailyLogs', 'mealTemplates',
  'mealLogs', 'workoutSessions', 'supplementInventory', 'supplementLogs'
];

syncTables.forEach(tableName => {
  db.table(tableName).hook('creating', (_primKey, obj: any) => {
    if (obj.isDirty === false) {
      return;
    }
    obj.isDirty = true;
    if (obj.generationCounter === undefined) {
      obj.generationCounter = 1;
    }
  });

  db.table(tableName).hook('updating', (mods: any, _primKey, obj: any) => {
    if (mods.isDirty === false) {
      return undefined;
    }
    const nextCounter = (obj.generationCounter || 1) + 1;
    return {
      isDirty: true,
      generationCounter: nextCounter
    };
  });
});

// ==================
// HELPERS FOR REFACTORING
// ==================

async function getOrCreateCompletion(
  habitId: HabitId,
  date: ISODate,
  userId: UserId,
  defaults: Partial<HabitCompletion> = {}
): Promise<{ existing: boolean; completion: HabitCompletion }> {
  const existing = await db.completions
    .where('[habitId+date]')
    .equals([habitId, date])
    .first();

  if (existing) {
    return { existing: true, completion: existing };
  }

  const now = new Date().toISOString();
  const completion: HabitCompletion = {
    id: crypto.randomUUID(),
    userId,
    habitId,
    date,
    completed: false,
    createdAt: now,
    updatedAt: now,
    ...defaults
  };
  return { existing: false, completion };
}

function resolveDuplicateEntity<T extends { id: string; createdAt: string }>(
  existing: T,
  current: T
): { keepId: string; discardId: string } {
  const isExistingOlder = new Date(existing.createdAt) < new Date(current.createdAt);
  return isExistingOlder
    ? { keepId: existing.id, discardId: current.id }
    : { keepId: current.id, discardId: existing.id };
}

// ==================
// HABIT FUNCTIONS
// ==================

export async function getHabits(userId: UserId): Promise<Habit[]> {
  if (!userId) return [];
  return db.habits.where('userId').equals(userId).filter(h => !h.archived).sortBy('order');
}

export async function getArchivedHabits(userId: UserId): Promise<Habit[]> {
  if (!userId) return [];
  return db.habits.where('userId').equals(userId).filter(h => !!h.archived).toArray();
}

export async function createHabit(data: HabitFormData & { userId: UserId }): Promise<Habit> {
  const now = new Date().toISOString();
  const inferredFrequency =
    data.frequencyType ||
    (data.targetDaysPerWeek < 7 ? 'weekly_flexible' : 'daily');

  const habit: Habit = {
    id: crypto.randomUUID(),
    userId: data.userId,
    name: data.name,
    icon: data.icon || '✓',
    category: data.category,
    targetDaysPerWeek: data.targetDaysPerWeek,
    frequencyType: inferredFrequency,
    scheduledDays: data.scheduledDays,
    intervalDays: data.intervalDays,
    allowBonusCompletions: data.allowBonusCompletions ?? true,
    autoTrackRule: data.autoTrackRule,
    polarity: data.polarity || 'build',
    anchorBlock: data.anchorBlock,
    archived: false,
    order: await db.habits.where('userId').equals(data.userId).count(),
    createdAt: now,
    updatedAt: now,
    isQuantitative: data.isQuantitative ?? false,
    targetValue: data.targetValue ?? 0,
    unit: data.unit ?? '',
    difficulty: data.difficulty || 'medium',
    metadata: data.metadata,
  };

  await db.habits.add(habit);
  return habit;
}

export async function updateHabit(id: HabitId, data: Partial<Habit>): Promise<void> {
  await db.habits.update(id, { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteHabit(id: HabitId): Promise<void> {
  const now = new Date().toISOString();
  await db.habits.update(id, {
    archived: true,
    archivedAt: now,
    updatedAt: now
  });
}

export async function reorderHabits(orderedIds: HabitId[]): Promise<void> {
  await db.transaction('rw', db.habits, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.habits.update(orderedIds[i], { order: i });
    }
  });
}

// ==================
// COMPLETION FUNCTIONS
// ==================

export async function toggleCompletion(habitId: HabitId, date: ISODate, userId: UserId): Promise<HabitCompletion> {
  const { existing, completion } = await getOrCreateCompletion(habitId, date, userId, {
    completed: true,
    status: 'completed',
    skipped: false,
  });
  const now = new Date().toISOString();

  if (existing) {
    // If it was marked as a rest day or frozen, a 1-tap primary click marks it completed
    if (completion.status === 'rest' || completion.skipped || completion.status === 'frozen') {
      completion.completed = true;
      completion.status = 'completed';
      completion.skipped = false;
      completion.restReason = undefined;
    } else {
      completion.completed = !completion.completed;
      completion.status = completion.completed ? 'completed' : undefined;
      completion.skipped = false;
    }
    completion.updatedAt = now;
    await db.completions.update(completion.id, completion);
  } else {
    completion.status = 'completed';
    completion.skipped = false;
    await db.completions.add(completion);
  }
  return completion;
}

export async function markRestCompletion(
  habitId: HabitId,
  date: ISODate,
  userId: UserId,
  reason?: string
): Promise<HabitCompletion> {
  const { existing, completion } = await getOrCreateCompletion(habitId, date, userId, {
    completed: false,
    status: 'rest',
    skipped: true,
    restReason: reason || 'Recovery',
  });
  const now = new Date().toISOString();
  const normalizedReason = reason || 'Recovery';

  completion.completed = false;
  completion.status = 'rest';
  completion.skipped = true;
  completion.restReason = normalizedReason;
  if (!completion.note || /^Rest Day:\s*(Low-Energy|Recovery)/i.test(completion.note)) {
    completion.note = `Rest Day: ${normalizedReason}`;
  }
  completion.updatedAt = now;

  if (existing) {
    await db.completions.update(completion.id, completion);
  } else {
    await db.completions.add(completion);
  }
  const persisted = await db.completions.get(completion.id);
  return persisted || completion;
}

export async function clearRestCompletion(
  habitId: HabitId,
  date: ISODate,
  userId: UserId
): Promise<HabitCompletion> {
  const { existing, completion } = await getOrCreateCompletion(habitId, date, userId, {
    completed: false,
  });
  const now = new Date().toISOString();

  completion.completed = false;
  completion.status = undefined;
  completion.skipped = false;
  if (
    completion.note &&
    ((completion.restReason && completion.note === `Rest Day: ${completion.restReason}`) ||
      /^Rest Day:\s*(Low-Energy|Recovery)/i.test(completion.note))
  ) {
    completion.note = undefined;
  }
  completion.restReason = undefined;
  completion.updatedAt = now;

  if (existing) {
    await db.completions.update(completion.id, completion);
  }
  const persisted = await db.completions.get(completion.id);
  return persisted || completion;
}

export async function freezeCompletion(habitId: HabitId, date: ISODate, userId: UserId): Promise<HabitCompletion> {
  const { existing, completion } = await getOrCreateCompletion(habitId, date, userId, { completed: true, status: 'frozen' });
  const now = new Date().toISOString();

  completion.completed = true;
  completion.status = 'frozen';
  completion.skipped = false;
  completion.updatedAt = now;

  if (existing) {
    await db.completions.update(completion.id, completion);
  } else {
    await db.completions.add(completion);
  }
  return completion;
}

export async function unfreezeCompletion(habitId: HabitId, date: ISODate, userId: UserId): Promise<HabitCompletion> {
  const { existing, completion } = await getOrCreateCompletion(habitId, date, userId, { completed: false });
  const now = new Date().toISOString();

  completion.completed = false;
  completion.status = undefined;
  completion.skipped = false;
  completion.updatedAt = now;

  if (existing) {
    await db.completions.update(completion.id, completion);
  }
  return completion;
}

export async function batchCompleteHabits(habitIds: HabitId[], date: ISODate, userId: UserId): Promise<HabitCompletion[]> {
  const results: HabitCompletion[] = [];
  
  await db.transaction('rw', db.completions, async () => {
    for (const habitId of habitIds) {
      const existing = await db.completions
        .where('[habitId+date]')
        .equals([habitId, date])
        .first();

      const now = new Date().toISOString();

      if (existing) {
        if (!existing.completed || existing.status !== 'completed') {
          const updated: HabitCompletion = {
            ...existing,
            completed: true,
            status: 'completed',
            updatedAt: now
          };
          await db.completions.update(existing.id, updated);
          results.push(updated);
        } else {
          results.push(existing);
        }
      } else {
        const newCompletion: HabitCompletion = {
          id: crypto.randomUUID(),
          habitId,
          date,
          completed: true,
          status: 'completed',
          userId,
          createdAt: now,
          updatedAt: now
        };
        await db.completions.add(newCompletion);
        results.push(newCompletion);
      }
    }
  });

  return results;
}

export async function getAllCompletionsInRange(startDate: ISODate, endDate: ISODate, userId: UserId): Promise<HabitCompletion[]> {
  return db.completions
    .where('date')
    .between(startDate, endDate, true, true)
    .filter(c => c.userId === userId)
    .toArray();
}

export async function cleanupDuplicateCompletions(): Promise<number> {
  const allCompletions = await db.completions.toArray();
  const seen = new Map<string, string>();
  const duplicates: string[] = [];

  for (const completion of allCompletions) {
    const key = `${completion.habitId}-${completion.date}`;
    if (seen.has(key)) {
      duplicates.push(completion.id);
    } else {
      seen.set(key, completion.id);
    }
  }

  if (duplicates.length > 0) {
    await db.completions.bulkDelete(duplicates);
  }

  return duplicates.length;
}

export async function cleanupDuplicateHabits(): Promise<number> {
  const allHabits = await db.habits.toArray();
  const seen = new Map<string, Habit>();
  const duplicates: string[] = [];
  const completionUpdates: Array<{ id: string; habitId: HabitId }> = [];

  for (const habit of allHabits) {
    const key = `${habit.name}-${habit.category}`;
    const existing = seen.get(key);

    if (existing) {
      const { keepId, discardId } = resolveDuplicateEntity(existing, habit);
      duplicates.push(discardId);

      const keptHabit = keepId === habit.id ? habit : existing;
      seen.set(key, keptHabit);

      const comps = await db.completions.where('habitId').equals(discardId).toArray();
      comps.forEach(c => completionUpdates.push({ id: c.id, habitId: keepId }));
    } else {
      seen.set(key, habit);
    }
  }

  for (const update of completionUpdates) {
    await db.completions.update(update.id, { habitId: update.habitId });
  }

  if (duplicates.length > 0) {
    await db.habits.bulkDelete(duplicates);
  }

  return duplicates.length;
}

export async function cleanupDuplicateGoals(): Promise<number> {
  const allGoals = await db.goals.toArray();
  const seen = new Map<string, Goal>();
  const duplicates: string[] = [];
  const milestoneUpdates: Array<{ id: string; goalId: GoalId }> = [];

  for (const goal of allGoals) {
    const key = goal.title.toLowerCase();
    const existing = seen.get(key);

    if (existing) {
      const { keepId, discardId } = resolveDuplicateEntity(existing, goal);
      duplicates.push(discardId);

      const keptGoal = keepId === goal.id ? goal : existing;
      seen.set(key, keptGoal);

      const miles = await db.milestones.where('goalId').equals(discardId).toArray();
      miles.forEach(m => milestoneUpdates.push({ id: m.id, goalId: keepId }));
    } else {
      seen.set(key, goal);
    }
  }

  for (const update of milestoneUpdates) {
    await db.milestones.update(update.id, { goalId: update.goalId });
  }

  if (duplicates.length > 0) {
    await db.goals.bulkDelete(duplicates);
  }

  return duplicates.length;
}

// ==================
// GOAL FUNCTIONS
// ==================

export async function getGoals(userId: UserId): Promise<Goal[]> {
  if (!userId) return [];
  return db.goals.where('userId').equals(userId).filter(g => !g.archived).toArray();
}

export async function createGoal(data: Omit<Goal, 'id' | 'createdAt' | 'startDate'> & { userId: UserId }): Promise<Goal> {
  const now = new Date().toISOString();
  const goal: Goal = {
    id: crypto.randomUUID(),
    ...data,
    createdAt: now,
    startDate: now,
    updatedAt: now,
  };

  await db.goals.add(goal);
  return goal;
}

export async function updateGoal(id: GoalId, data: Partial<Goal>): Promise<void> {
  await db.goals.update(id, { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteGoal(id: GoalId): Promise<void> {
  await db.goals.delete(id);
  await db.milestones.where('goalId').equals(id).delete();
}

export async function setFocusGoal(goalId: GoalId): Promise<void> {
  const goal = await db.goals.get(goalId);
  if (goal) {
    await db.goals.update(goalId, {
      isFocus: !goal.isFocus,
      updatedAt: new Date().toISOString()
    });
  }
}

// ==================
// MILESTONE FUNCTIONS
// ==================

export async function getMilestones(goalId: GoalId): Promise<Milestone[]> {
  return db.milestones.where('goalId').equals(goalId).sortBy('order');
}

export async function createMilestone(data: Omit<Milestone, 'id' | 'completed' | 'order'>): Promise<Milestone> {
  const count = await db.milestones.where('goalId').equals(data.goalId).count();
  const now = new Date().toISOString();

  const milestone: Milestone = {
    id: crypto.randomUUID(),
    ...data,
    completed: false,
    order: count,
    createdAt: now,
    updatedAt: now,
  };

  await db.milestones.add(milestone);
  return milestone;
}

export async function updateMilestone(id: MilestoneId, data: Partial<Milestone>): Promise<void> {
  await db.milestones.update(id, { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteMilestone(id: MilestoneId): Promise<void> {
  await db.milestones.delete(id);
}

export async function toggleMilestone(id: MilestoneId): Promise<Milestone | null> {
  const milestone = await db.milestones.get(id);
  if (!milestone) return null;

  const now = new Date().toISOString();
  const updated: Milestone = {
    ...milestone,
    completed: !milestone.completed,
    completedAt: !milestone.completed ? now : undefined,
    updatedAt: now,
  };

  await db.milestones.update(id, updated);
  return updated;
}

// ==================
// USER SETTINGS FUNCTIONS
// ==================

export async function getSettings(userId: UserId): Promise<UserSettings | undefined> {
  if (!userId) return undefined;
  return db.userSettings.where('userId').equals(userId).first();
}

export async function updateSettings(data: Partial<UserSettings> & { userId: UserId }): Promise<void> {
  if (!data.userId) return;
  const existing = await getSettings(data.userId);
  const now = new Date().toISOString();

  if (existing) {
    await db.userSettings.update(existing.id, { ...data, updatedAt: now });
    if (data.soundEnabled !== undefined || data.hapticsEnabled !== undefined) {
      syncSensoryPrefsFromSettings({
        soundEnabled: data.soundEnabled ?? existing.soundEnabled,
        hapticsEnabled: data.hapticsEnabled ?? existing.hapticsEnabled,
      });
    }
  } else {
    const settings: UserSettings = {
      id: crypto.randomUUID(),
      userId: data.userId,
      theme: data.theme || 'system',
      accent: data.accent || 'mint',
      userName: data.userName,
      weekStartsOn: data.weekStartsOn ?? 0,
      showMotivationalQuotes: data.showMotivationalQuotes ?? true,
      defaultCategory: data.defaultCategory || 'health',
      createdAt: now,
      updatedAt: now,
      xp: 0,
      level: 1,
      gems: 0,
      streakShield: 0,
      avatarId: 'avatar-1',
      soundEnabled: data.soundEnabled ?? true,
      hapticsEnabled: data.hapticsEnabled ?? true,
      stats: data.stats || {
        vitality: 1,
        intelligence: 1,
        discipline: 1,
        charisma: 1,
        wealth: 1,
        creativity: 1,
      },
      showTasks: data.showTasks ?? true,
      showGoals: data.showGoals ?? true,
      showMilestones: data.showMilestones ?? true,
      showFinance: data.showFinance ?? true,
      showFitness: data.showFitness ?? true,
      habitOnlyMode: data.habitOnlyMode ?? false,
      unlockedThemes: data.unlockedThemes || [],
      dashboardLayout: data.dashboardLayout || [
        { id: 'metrics', size: 'full', hidden: false, pinned: true },
        { id: 'today-tasks', size: 'full', hidden: false, pinned: false },
        { id: 'finance-overview', size: 'full', hidden: false, pinned: false },
        { id: 'habit-overview', size: '1/2', hidden: false, pinned: false },
        { id: 'focus-goal', size: '1/2', hidden: false, pinned: false },
        { id: 'ai-coach', size: '1/2', hidden: false, pinned: false },
        { id: 'weekly-review', size: '1/2', hidden: false, pinned: false }
      ],
    };
    await db.userSettings.add(settings);
    syncSensoryPrefsFromSettings(settings);
  }
}

// ==================
// DEMO DATA
// ==================

export async function seedDemoData(userId: UserId): Promise<void> {
  await db.habits.where('userId').equals(userId).delete();
  await db.completions.where('userId').equals(userId).delete();

  const demoHabits: Habit[] = [
    {
      id: crypto.randomUUID(),
      userId: userId,
      name: 'Morning Exercise',
      icon: '🏃',
      category: 'health',
      targetDaysPerWeek: 5,
      archived: false,
      order: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      userId: userId,
      name: 'Read for 30 minutes',
      icon: '📚',
      category: 'learning',
      targetDaysPerWeek: 7,
      archived: false,
      order: 1,
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      userId: userId,
      name: 'Morning Meditation',
      icon: '🧘',
      category: 'health',
      targetDaysPerWeek: 7,
      archived: false,
      order: 2,
      createdAt: new Date().toISOString(),
    },
  ];

  await db.habits.bulkAdd(demoHabits);

  const today = new Date();
  const completions: HabitCompletion[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    demoHabits.forEach((habit, index) => {
      if (Math.random() > 0.3) {
        completions.push({
          id: crypto.randomUUID(),
          userId: userId,
          habitId: habit.id,
          date: dateStr,
          completed: true,
        });
      }
    });
  }

  await db.completions.bulkAdd(completions);
}

// ==================
// TASK FUNCTIONS
// ==================

export async function getTasks(userId: UserId): Promise<Task[]> {
  if (!userId) return [];
  return db.tasks.where('userId').equals(userId).filter(t => t.status !== 'archived').reverse().sortBy('created_at');
}

export async function createTask(data: TaskFormData & { userId: UserId }): Promise<Task> {
  const now = new Date().toISOString();
  const task: Task = {
    id: crypto.randomUUID(),
    userId: data.userId,
    title: data.title,
    description: data.description || null,
    notes: data.notes || null,
    status: 'todo',
    priority: data.priority,
    due_date: data.due_date || null,
    goal_id: data.goal_id || null,
    tags: data.tags || [],
    metadata: data.metadata || {},
    created_at: now,
    updated_at: now,
    recurrenceRule: data.recurrenceRule || '',
    estimatedTime: data.estimatedTime || 0,
    actualTime: data.actualTime || 0,
    isUrgent: data.isUrgent ?? false,
    isImportant: data.isImportant ?? false,
    parentTaskId: data.parentTaskId || null,
    depth: data.depth || 0,
  };

  await db.tasks.add(task);
  return task;
}

export async function updateTask(id: TaskId, data: Partial<Task>): Promise<void> {
  await db.tasks.update(id, { ...data, updated_at: new Date().toISOString() });
}

export async function deleteTask(id: TaskId): Promise<void> {
  const now = new Date().toISOString();
  await db.tasks.update(id, { status: 'archived', updated_at: now });
  
  // Recursively archive child tasks
  const childTasks = await db.tasks.where('parentTaskId').equals(id).toArray();
  for (const child of childTasks) {
    await deleteTask(child.id);
  }
}

// ==================
// HABIT COMPLETION VALUES AND NOTES
// ==================

export async function updateCompletionNote(
  habitId: HabitId,
  date: ISODate,
  note: string,
  userId: UserId
): Promise<HabitCompletion> {
  const { existing, completion } = await getOrCreateCompletion(habitId, date, userId, { completed: true, note });
  const now = new Date().toISOString();

  completion.note = note;
  completion.updatedAt = now;
  if (!existing) {
    completion.completed = true;
  }

  if (existing) {
    await db.completions.update(completion.id, completion);
  } else {
    await db.completions.add(completion);
  }
  return completion;
}

export async function updateCompletionValue(
  habitId: HabitId,
  date: ISODate,
  value: number,
  userId: UserId
): Promise<HabitCompletion> {
  const habit = await db.habits.get(habitId);
  const targetValue = habit?.targetValue || 1;
  const completed = value >= targetValue;

  const { existing, completion } = await getOrCreateCompletion(habitId, date, userId, { completed, value });
  const now = new Date().toISOString();

  completion.value = value;
  completion.completed = completed;
  completion.updatedAt = now;

  if (existing) {
    await db.completions.update(completion.id, completion);
  } else {
    await db.completions.add(completion);
  }
  return completion;
}

// ==================
// MOOD LOG FUNCTIONS
// ==================

export async function getMoodLogs(
  userId: UserId,
  startDate: ISODate,
  endDate: ISODate
): Promise<MoodLog[]> {
  if (!userId) return [];
  return db.moodLogs
    .where('date')
    .between(startDate, endDate, true, true)
    .filter(log => log.userId === userId)
    .toArray();
}

export async function setMoodLog(
  userId: UserId,
  date: ISODate,
  mood: MoodType
): Promise<MoodLog> {
  const existing = await db.moodLogs
    .where('[userId+date]')
    .equals([userId, date])
    .first();

  const now = new Date().toISOString();

  if (existing) {
    const updated: MoodLog = {
      ...existing,
      mood,
      updatedAt: now,
    };
    await db.moodLogs.update(existing.id, updated);
    return updated;
  } else {
    const newLog: MoodLog = {
      id: crypto.randomUUID(),
      userId,
      date,
      mood,
      createdAt: now,
      updatedAt: now,
    };
    await db.moodLogs.add(newLog);
    return newLog;
  }
}

export { db };
