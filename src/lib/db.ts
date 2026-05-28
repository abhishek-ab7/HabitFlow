import Dexie, { type EntityTable } from 'dexie';
import type { Habit, HabitCompletion, Goal, Milestone, UserSettings, HabitFormData, GoalFormData, MilestoneFormData, Task, TaskFormData, Routine, HabitRoutine, RoutineCompletion, MoodLog } from './types';
import type { MoodType } from './types';

// Domain Type Aliases to resolve Primitive Obsession
export type UserId = string;
export type HabitId = string;
export type GoalId = string;
export type MilestoneId = string;
export type TaskId = string;
export type RoutineId = string;
export type ISODate = string;

// Define the database schema
const db = new Dexie('HabitFlowDB') as Dexie & {
  habits: EntityTable<Habit, 'id'>;
  completions: EntityTable<HabitCompletion, 'id'>;
  goals: EntityTable<Goal, 'id'>;
  milestones: EntityTable<Milestone, 'id'>;
  userSettings: EntityTable<UserSettings, 'id'>;
  tasks: EntityTable<Task, 'id'>;
  routines: EntityTable<Routine, 'id'>;
  habitRoutines: EntityTable<HabitRoutine, 'id'>;
  routineCompletions: EntityTable<RoutineCompletion, 'id'>;
  moodLogs: EntityTable<MoodLog, 'id'>;
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
  const habit: Habit = {
    id: crypto.randomUUID(),
    userId: data.userId,
    name: data.name,
    icon: data.icon || '✓',
    category: data.category,
    targetDaysPerWeek: data.targetDaysPerWeek,
    archived: false,
    order: await db.habits.where('userId').equals(data.userId).count(),
    createdAt: now,
    updatedAt: now,
    isQuantitative: data.isQuantitative ?? false,
    targetValue: data.targetValue ?? 0,
    unit: data.unit ?? '',
    difficulty: data.difficulty || 'medium',
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
  const { existing, completion } = await getOrCreateCompletion(habitId, date, userId, { completed: true });
  const now = new Date().toISOString();

  if (existing) {
    completion.completed = !completion.completed;
    completion.updatedAt = now;
    await db.completions.update(completion.id, completion);
  } else {
    await db.completions.add(completion);
  }
  return completion;
}

export async function freezeCompletion(habitId: HabitId, date: ISODate, userId: UserId): Promise<HabitCompletion> {
  const { existing, completion } = await getOrCreateCompletion(habitId, date, userId, { completed: true, status: 'frozen' });
  const now = new Date().toISOString();

  completion.completed = true;
  completion.status = 'frozen';
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
  } else {
    const settings: UserSettings = {
      id: crypto.randomUUID(),
      userId: data.userId,
      theme: data.theme || 'system',
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
      unlockedThemes: data.unlockedThemes || [],
      dashboardLayout: data.dashboardLayout || [
        { id: 'metrics', size: 'full', hidden: false, pinned: true },
        { id: 'today-tasks', size: 'full', hidden: false, pinned: false },
        { id: 'habit-overview', size: '1/2', hidden: false, pinned: false },
        { id: 'focus-goal', size: '1/2', hidden: false, pinned: false },
        { id: 'ai-quote', size: 'full', hidden: false, pinned: false },
        { id: 'ai-coach', size: '1/2', hidden: false, pinned: false },
        { id: 'weekly-review', size: '1/2', hidden: false, pinned: false }
      ],
    };
    await db.userSettings.add(settings);
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
    const dateStr = date.toISOString().split('T')[0];

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
    status: 'todo',
    priority: data.priority,
    due_date: data.due_date || null,
    goal_id: data.goal_id || null,
    tags: data.tags || [],
    metadata: {},
    created_at: now,
    updated_at: now,
    recurrenceRule: data.recurrenceRule || '',
    estimatedTime: data.estimatedTime || 0,
    actualTime: data.actualTime || 0,
    isUrgent: data.isUrgent ?? false,
    isImportant: data.isImportant ?? false,
  };

  await db.tasks.add(task);
  return task;
}

export async function updateTask(id: TaskId, data: Partial<Task>): Promise<void> {
  await db.tasks.update(id, { ...data, updated_at: new Date().toISOString() });
}

export async function deleteTask(id: TaskId): Promise<void> {
  await db.tasks.update(id, { status: 'archived', updated_at: new Date().toISOString() });
}

// ==================
// HABIT-ROUTINE JUNCTION FUNCTIONS
// ==================

export async function linkHabitToRoutine(habitId: HabitId, routineId: RoutineId, orderIndex: number = 0): Promise<HabitRoutine> {
  const existing = await db.habitRoutines
    .where('[habitId+routineId]')
    .equals([habitId, routineId])
    .first();

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const link: HabitRoutine = {
    id: crypto.randomUUID(),
    habitId,
    routineId,
    orderIndex,
    createdAt: now,
    updatedAt: now,
  };

  await db.habitRoutines.add(link);
  return link;
}

export async function unlinkHabitFromRoutine(habitId: HabitId, routineId: RoutineId): Promise<void> {
  const link = await db.habitRoutines
    .where('[habitId+routineId]')
    .equals([habitId, routineId])
    .first();

  if (link) {
    await db.habitRoutines.delete(link.id);
  }
}

export async function getRoutinesForHabit(habitId: HabitId): Promise<Routine[]> {
  const links = await db.habitRoutines.where('habitId').equals(habitId).toArray();
  const routineIds = links.map(link => link.routineId);

  const routines = await db.routines.where('id').anyOf(routineIds).toArray();
  return routines;
}

export async function getRoutinesForHabits(habitIds: HabitId[]): Promise<Map<HabitId, Routine[]>> {
  const links = await db.habitRoutines.where('habitId').anyOf(habitIds).toArray();
  const routineIds = [...new Set(links.map(link => link.routineId))];
  const routines = await db.routines.where('id').anyOf(routineIds).toArray();

  const routineMap = new Map(routines.map(r => [r.id, r]));

  const result = new Map<HabitId, Routine[]>();
  for (const link of links) {
    const routine = routineMap.get(link.routineId);
    if (routine) {
      const existing = result.get(link.habitId) || [];
      result.set(link.habitId, [...existing, routine]);
    }
  }

  return result;
}

export async function getHabitsForRoutine(routineId: RoutineId): Promise<Habit[]> {
  const links = await db.habitRoutines
    .where('routineId')
    .equals(routineId)
    .sortBy('orderIndex');

  const habitIds = links.map(link => link.habitId);
  const habits = await db.habits.where('id').anyOf(habitIds).toArray();

  const habitMap = new Map(habits.map(h => [h.id, h]));
  return links.map(link => habitMap.get(link.habitId)).filter(Boolean) as Habit[];
}

export async function updateHabitRoutineOrder(habitId: HabitId, routineId: RoutineId, newOrderIndex: number): Promise<void> {
  const link = await db.habitRoutines
    .where('[habitId+routineId]')
    .equals([habitId, routineId])
    .first();

  if (link) {
    await db.habitRoutines.update(link.id, {
      orderIndex: newOrderIndex,
      updatedAt: new Date().toISOString()
    });
  }
}

export async function unlinkAllHabitsFromRoutine(routineId: RoutineId): Promise<void> {
  const links = await db.habitRoutines.where('routineId').equals(routineId).toArray();
  const linkIds = links.map(link => link.id);
  await db.habitRoutines.bulkDelete(linkIds);
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
