import Dexie, { type EntityTable } from 'dexie';
import type { Habit, HabitCompletion, Goal, Milestone, UserSettings, HabitFormData, GoalFormData, MilestoneFormData } from './types';

// Define the database schema
const db = new Dexie('HabitFlowDB') as Dexie & {
  habits: EntityTable<Habit, 'id'>;
  completions: EntityTable<HabitCompletion, 'id'>;
  goals: EntityTable<Goal, 'id'>;
  milestones: EntityTable<Milestone, 'id'>;
  userSettings: EntityTable<UserSettings, 'id'>;
};

// Schema version 2 - Added compound index for completions
db.version(2).stores({
  habits: 'id, name, category, archived, order, createdAt',
  completions: 'id, habitId, date, [habitId+date]',
  goals: 'id, title, areaOfLife, status, archived, isFocus, deadline, createdAt',
  milestones: 'id, goalId, completed, order',
  userSettings: 'id, userId',
});

// ==================
// HABIT FUNCTIONS
// ==================

export async function getHabits(): Promise<Habit[]> {
  return db.habits.filter(h => !h.archived).sortBy('order');
}

export async function createHabit(data: HabitFormData): Promise<Habit> {
  const now = new Date().toISOString();
  const habit: Habit = {
    id: crypto.randomUUID(),
    name: data.name,
    icon: data.icon || '✓',
    category: data.category,
    targetDaysPerWeek: data.targetDaysPerWeek,
    archived: false,
    order: await db.habits.count(),
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

export async function toggleCompletion(habitId: string, date: string): Promise<HabitCompletion | null> {
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
      habitId,
      date,
      completed: true,
    };
    await db.completions.add(completion);
    return completion;
  }
}

export async function getAllCompletionsInRange(startDate: string, endDate: string): Promise<HabitCompletion[]> {
  return db.completions
    .where('date')
    .between(startDate, endDate, true, true)
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

export async function getGoals(): Promise<Goal[]> {
  return db.goals.filter(g => !g.archived).toArray();
}

export async function createGoal(data: Omit<Goal, 'id' | 'createdAt' | 'startDate'>): Promise<Goal> {
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

export async function getSettings(): Promise<UserSettings | undefined> {
  return db.userSettings.toArray().then(settings => settings[0]);
}

export async function updateSettings(data: Partial<UserSettings>): Promise<void> {
  const existing = await getSettings();

  if (existing) {
    await db.userSettings.update(existing.id, data);
  } else {
    const settings: UserSettings = {
      id: crypto.randomUUID(),
      theme: data.theme || 'system',
      userName: data.userName,
      weekStartsOn: data.weekStartsOn ?? 0,
      showMotivationalQuotes: data.showMotivationalQuotes ?? true,
      defaultCategory: data.defaultCategory || 'health',
      createdAt: new Date().toISOString(),
    };
    await db.userSettings.add(settings);
  }
}

// ==================
// DEMO DATA
// ==================

export async function seedDemoData(): Promise<void> {
  // Clear existing data
  await db.habits.clear();
  await db.completions.clear();
  await db.goals.clear();
  await db.milestones.clear();

  // Create demo habits
  const demoHabits: Habit[] = [
    {
      id: crypto.randomUUID(),
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
          habitId: habit.id,
          date: dateStr,
          completed: true,
        });
      }
    });
  }

  await db.completions.bulkAdd(completions);
}

export { db };
