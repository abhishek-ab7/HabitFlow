import Dexie, { type EntityTable } from 'dexie';
import type { Habit, HabitCompletion, Goal, Milestone, UserSettings, HabitFormData, GoalFormData, MilestoneFormData, Task, TaskFormData, Routine, HabitRoutine } from './types';

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
  // Migrate existing routineId data to habitRoutines junction table
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

// ==================
// HABIT FUNCTIONS
// ==================

export async function getHabits(userId: string): Promise<Habit[]> {
  return db.habits.where('userId').equals(userId).filter(h => !h.archived).sortBy('order');
}

export async function createHabit(data: HabitFormData & { userId: string }): Promise<Habit> {
  const now = new Date().toISOString();
  const habit: Habit = {
    id: crypto.randomUUID(),
    userId: data.userId, // Explicitly set
    name: data.name,
    icon: data.icon || '✓',
    category: data.category,
    targetDaysPerWeek: data.targetDaysPerWeek,
    archived: false,
    order: await db.habits.where('userId').equals(data.userId).count(),
    createdAt: now,
    updatedAt: now,
  };

  await db.habits.add(habit);
  return habit;
}

export async function updateHabit(id: string, data: Partial<Habit>): Promise<void> {
  await db.habits.update(id, { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteHabit(id: string): Promise<void> {
  // Soft delete - mark as archived with timestamp
  const now = new Date().toISOString();
  await db.habits.update(id, {
    archived: true,
    archivedAt: now,
    updatedAt: now
  });
  // Note: We keep completions for history
}

export async function reorderHabits(orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.habits, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.habits.update(orderedIds[i], { order: i });
    }
  });
}

// ==================
// COMPLETION FUNCTIONS
// ==================

export async function toggleCompletion(habitId: string, date: string, userId: string): Promise<HabitCompletion | null> {
  const existing = await db.completions
    .where('[habitId+date]')
    .equals([habitId, date])
    .first();

  if (existing) {
    await db.completions.delete(existing.id);
    return null;
  } else {
    const completion: HabitCompletion = {
      id: crypto.randomUUID(),
      userId,
      habitId,
      date,
      completed: true,
    };
    await db.completions.add(completion);
    return completion;
  }
}

export async function getAllCompletionsInRange(startDate: string, endDate: string, userId: string): Promise<HabitCompletion[]> {
  return db.completions
    .where('date')
    .between(startDate, endDate, true, true)
    .filter(c => c.userId === userId)
    .toArray();
}

export async function cleanupDuplicateCompletions(): Promise<number> {
  // Find and remove duplicate completions (same habitId + date)
  const allCompletions = await db.completions.toArray();
  const seen = new Map<string, string>(); // key: habitId-date, value: first completion id
  const duplicates: string[] = [];

  for (const completion of allCompletions) {
    const key = `${completion.habitId}-${completion.date}`;
    if (seen.has(key)) {
      // This is a duplicate, mark for deletion
      duplicates.push(completion.id);
    } else {
      // First occurrence, keep it
      seen.set(key, completion.id);
    }
  }

  // Delete duplicates
  if (duplicates.length > 0) {
    await db.completions.bulkDelete(duplicates);
  }

  return duplicates.length;
}

export async function cleanupDuplicateHabits(): Promise<number> {
  // Find and remove duplicate habits (same name + category)
  const allHabits = await db.habits.toArray();
  const seen = new Map<string, Habit>(); // key: name-category, value: first habit
  const duplicates: string[] = [];
  const completionUpdates: Array<{ id: string; habitId: string }> = [];

  for (const habit of allHabits) {
    const key = `${habit.name}-${habit.category}`;
    const existing = seen.get(key);

    if (existing) {
      // This is a duplicate
      // Keep the one with earlier creation date
      if (new Date(habit.createdAt) < new Date(existing.createdAt)) {
        // Current habit is older, keep it and delete existing
        duplicates.push(existing.id);

        // Mark completions for update from existing to current
        const comps = await db.completions.where('habitId').equals(existing.id).toArray();
        comps.forEach(c => completionUpdates.push({ id: c.id, habitId: habit.id }));

        seen.set(key, habit);
      } else {
        // Existing is older, delete current
        duplicates.push(habit.id);

        // Mark completions for update from current to existing
        const comps = await db.completions.where('habitId').equals(habit.id).toArray();
        comps.forEach(c => completionUpdates.push({ id: c.id, habitId: existing.id }));
      }
    } else {
      // First occurrence, keep it
      seen.set(key, habit);
    }
  }

  // Update completions to point to the kept habit
  for (const update of completionUpdates) {
    await db.completions.update(update.id, { habitId: update.habitId });
  }

  // Delete duplicate habits
  if (duplicates.length > 0) {
    await db.habits.bulkDelete(duplicates);
  }

  return duplicates.length;
}

export async function cleanupDuplicateGoals(): Promise<number> {
  // Find and remove duplicate goals (same title, case-insensitive)
  const allGoals = await db.goals.toArray();
  const seen = new Map<string, Goal>(); // key: title (lowercase), value: first goal
  const duplicates: string[] = [];
  const milestoneUpdates: Array<{ id: string; goalId: string }> = [];

  for (const goal of allGoals) {
    const key = goal.title.toLowerCase();
    const existing = seen.get(key);

    if (existing) {
      // This is a duplicate
      // Keep the one with earlier creation date
      if (new Date(goal.createdAt) < new Date(existing.createdAt)) {
        // Current goal is older, keep it and delete existing
        duplicates.push(existing.id);

        // Mark milestones for update from existing to current
        const miles = await db.milestones.where('goalId').equals(existing.id).toArray();
        miles.forEach(m => milestoneUpdates.push({ id: m.id, goalId: goal.id }));

        seen.set(key, goal);
      } else {
        // Existing is older, delete current
        duplicates.push(goal.id);

        // Mark milestones for update from current to existing
        const miles = await db.milestones.where('goalId').equals(goal.id).toArray();
        miles.forEach(m => milestoneUpdates.push({ id: m.id, goalId: existing.id }));
      }
    } else {
      // First occurrence, keep it
      seen.set(key, goal);
    }
  }

  // Update milestones to point to the kept goal
  for (const update of milestoneUpdates) {
    await db.milestones.update(update.id, { goalId: update.goalId });
  }

  // Delete duplicate goals
  if (duplicates.length > 0) {
    await db.goals.bulkDelete(duplicates);
  }

  return duplicates.length;
}

// ==================
// GOAL FUNCTIONS
// ==================

export async function getGoals(userId: string): Promise<Goal[]> {
  return db.goals.where('userId').equals(userId).filter(g => !g.archived).toArray();
}

export async function createGoal(data: Omit<Goal, 'id' | 'createdAt' | 'startDate'> & { userId: string }): Promise<Goal> {
  const goal: Goal = {
    id: crypto.randomUUID(),
    ...data,
    createdAt: new Date().toISOString(),
    startDate: new Date().toISOString(),
  };

  await db.goals.add(goal);
  return goal;
}

export async function updateGoal(id: string, data: Partial<Goal>): Promise<void> {
  await db.goals.update(id, data);
}

export async function deleteGoal(id: string): Promise<void> {
  await db.goals.delete(id);
  await db.milestones.where('goalId').equals(id).delete();
}

export async function setFocusGoal(goalId: string): Promise<void> {
  const goal = await db.goals.get(goalId);
  if (goal) {
    // Toggle the focus status
    await db.goals.update(goalId, { isFocus: !goal.isFocus });
  }
}

// ==================
// MILESTONE FUNCTIONS
// ==================

export async function getMilestones(goalId: string): Promise<Milestone[]> {
  return db.milestones.where('goalId').equals(goalId).sortBy('order');
}

export async function createMilestone(data: Omit<Milestone, 'id' | 'completed' | 'order'>): Promise<Milestone> {
  const count = await db.milestones.where('goalId').equals(data.goalId).count();

  const milestone: Milestone = {
    id: crypto.randomUUID(),
    ...data,
    completed: false,
    order: count,
  };

  await db.milestones.add(milestone);
  return milestone;
}

export async function updateMilestone(id: string, data: Partial<Milestone>): Promise<void> {
  await db.milestones.update(id, data);
}

export async function deleteMilestone(id: string): Promise<void> {
  await db.milestones.delete(id);
}

export async function toggleMilestone(id: string): Promise<Milestone | null> {
  const milestone = await db.milestones.get(id);
  if (!milestone) return null;

  const updated: Milestone = {
    ...milestone,
    completed: !milestone.completed,
    completedAt: !milestone.completed ? new Date().toISOString() : undefined,
  };

  await db.milestones.update(id, updated);
  return updated;
}

// ==================
// USER SETTINGS FUNCTIONS
// ==================

export async function getSettings(userId: string): Promise<UserSettings | undefined> {
  return db.userSettings.where('userId').equals(userId).first();
}

export async function updateSettings(data: Partial<UserSettings> & { userId: string }): Promise<void> {
  const existing = await getSettings(data.userId);

  if (existing) {
    await db.userSettings.update(existing.id, data);
  } else {
    const settings: UserSettings = {
      id: crypto.randomUUID(),
      userId: data.userId, // Explicitly set
      theme: data.theme || 'system',
      userName: data.userName,
      weekStartsOn: data.weekStartsOn ?? 0,
      showMotivationalQuotes: data.showMotivationalQuotes ?? true,
      defaultCategory: data.defaultCategory || 'health',
      createdAt: new Date().toISOString(),
      xp: 0,
      level: 1,
      gems: 0,
      streakShield: 0,
      avatarId: 'avatar-1',
    };
    await db.userSettings.add(settings);
  }
}

// ==================
// DEMO DATA
// ==================

export async function seedDemoData(userId: string): Promise<void> {
  // Clear existing data for this user
  await db.habits.where('userId').equals(userId).delete();
  await db.completions.where('userId').equals(userId).delete();
  // Note: We might want to keep goals/milestones or clear them too if they are demo data
  // For now, let's strictly clear what we are about to seed to avoid duplicates if run multiple times

  // Create demo habits
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
      name: 'Meditate',
      icon: '🧘',
      category: 'health',
      targetDaysPerWeek: 7,
      archived: false,
      order: 2,
      createdAt: new Date().toISOString(),
    },
  ];

  await db.habits.bulkAdd(demoHabits);

  // Create demo completions for the past week
  const today = new Date();
  const completions: HabitCompletion[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    demoHabits.forEach((habit, index) => {
      // Random completion pattern
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

export async function getTasks(userId: string): Promise<Task[]> {
  return db.tasks.where('userId').equals(userId).filter(t => t.status !== 'archived').reverse().sortBy('created_at');
}

export async function createTask(data: TaskFormData & { userId: string }): Promise<Task> {
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
  };

  await db.tasks.add(task);
  return task;
}

export async function updateTask(id: string, data: Partial<Task>): Promise<void> {
  await db.tasks.update(id, { ...data, updated_at: new Date().toISOString() });
}

export async function deleteTask(id: string): Promise<void> {
  // Soft delete
  await db.tasks.update(id, { status: 'archived', updated_at: new Date().toISOString() });
}

// ==================
// HABIT-ROUTINE JUNCTION FUNCTIONS
// ==================

export async function linkHabitToRoutine(habitId: string, routineId: string, orderIndex: number = 0): Promise<HabitRoutine> {
  // Check if link already exists
  const existing = await db.habitRoutines
    .where('[habitId+routineId]')
    .equals([habitId, routineId])
    .first();

  if (existing) {
    return existing;
  }

  const link: HabitRoutine = {
    id: crypto.randomUUID(),
    habitId,
    routineId,
    orderIndex,
    createdAt: new Date().toISOString(),
  };

  await db.habitRoutines.add(link);
  return link;
}

export async function unlinkHabitFromRoutine(habitId: string, routineId: string): Promise<void> {
  const link = await db.habitRoutines
    .where('[habitId+routineId]')
    .equals([habitId, routineId])
    .first();

  if (link) {
    await db.habitRoutines.delete(link.id);
  }
}

export async function getRoutinesForHabit(habitId: string): Promise<Routine[]> {
  const links = await db.habitRoutines.where('habitId').equals(habitId).toArray();
  const routineIds = links.map(link => link.routineId);

  const routines = await db.routines.where('id').anyOf(routineIds).toArray();
  return routines;
}

// Batch version to avoid N+1 queries - loads routines for multiple habits at once
export async function getRoutinesForHabits(habitIds: string[]): Promise<Map<string, Routine[]>> {
  // Load all habit-routine links for these habits in one query
  const links = await db.habitRoutines.where('habitId').anyOf(habitIds).toArray();
  
  // Get unique routine IDs
  const routineIds = [...new Set(links.map(link => link.routineId))];
  
  // Load all routines in one query
  const routines = await db.routines.where('id').anyOf(routineIds).toArray();
  
  // Create a map of routineId -> Routine for fast lookup
  const routineMap = new Map(routines.map(r => [r.id, r]));
  
  // Group routines by habitId
  const result = new Map<string, Routine[]>();
  for (const link of links) {
    const routine = routineMap.get(link.routineId);
    if (routine) {
      const existing = result.get(link.habitId) || [];
      result.set(link.habitId, [...existing, routine]);
    }
  }
  
  return result;
}

export async function getHabitsForRoutine(routineId: string): Promise<Habit[]> {
  const links = await db.habitRoutines
    .where('routineId')
    .equals(routineId)
    .sortBy('orderIndex');

  const habitIds = links.map(link => link.habitId);
  const habits = await db.habits.where('id').anyOf(habitIds).toArray();

  // Sort habits according to the order in the routine
  const habitMap = new Map(habits.map(h => [h.id, h]));
  return links.map(link => habitMap.get(link.habitId)).filter(Boolean) as Habit[];
}

export async function updateHabitRoutineOrder(habitId: string, routineId: string, newOrderIndex: number): Promise<void> {
  const link = await db.habitRoutines
    .where('[habitId+routineId]')
    .equals([habitId, routineId])
    .first();

  if (link) {
    await db.habitRoutines.update(link.id, { orderIndex: newOrderIndex });
  }
}

export async function unlinkAllHabitsFromRoutine(routineId: string): Promise<void> {
  const links = await db.habitRoutines.where('routineId').equals(routineId).toArray();
  const linkIds = links.map(link => link.id);
  await db.habitRoutines.bulkDelete(linkIds);
}

export { db };
