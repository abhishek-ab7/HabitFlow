import { db } from './db';

/**
 * Clean up duplicate habit completions
 * This removes duplicate completions that have the same habitId and date
 * but different IDs (caused by sync issues)
 */
export async function cleanupDuplicateCompletions(): Promise<number> {
    const allCompletions = await db.completions.toArray();

    // Group by habitId+date
    const completionMap = new Map<string, typeof allCompletions>();

    for (const completion of allCompletions) {
        const key = `${completion.habitId}-${completion.date}`;
        if (!completionMap.has(key)) {
            completionMap.set(key, []);
        }
        completionMap.get(key)!.push(completion);
    }

    // Find and remove duplicates
    let removedCount = 0;
    for (const [key, completions] of completionMap.entries()) {
        if (completions.length > 1) {
            // Keep the first one, delete the rest
            const [keep, ...duplicates] = completions;
            for (const duplicate of duplicates) {
                await db.completions.delete(duplicate.id);
                removedCount++;
            }
            console.log(`Removed ${duplicates.length} duplicate completion(s) for ${key}`);
        }
    }

    return removedCount;
}

/**
 * Get count of duplicate completions without removing them
 */
export async function countDuplicateCompletions(): Promise<number> {
    const allCompletions = await db.completions.toArray();
    const seen = new Set<string>();
    let duplicates = 0;

    for (const completion of allCompletions) {
        const key = `${completion.habitId}-${completion.date}`;
        if (seen.has(key)) {
            duplicates++;
        } else {
            seen.add(key);
        }
    }

    return duplicates;
}

/**
 * Clean up duplicate habits (same name + category)
 */
export async function cleanupDuplicateHabits(): Promise<number> {
    const allHabits = await db.habits.toArray();
    const habitMap = new Map<string, typeof allHabits>();

    // Group by name+category
    for (const habit of allHabits) {
        const key = `${habit.name}-${habit.category}`;
        if (!habitMap.has(key)) {
            habitMap.set(key, []);
        }
        habitMap.get(key)!.push(habit);
    }

    let removedCount = 0;
    for (const [key, habits] of habitMap.entries()) {
        if (habits.length > 1) {
            // Keep the oldest one (by createdAt), delete the rest
            const sorted = habits.sort((a, b) => 
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            const [keep, ...duplicates] = sorted;

            // Migrate completions from duplicates to the kept habit
            for (const duplicate of duplicates) {
                const completions = await db.completions.where('habitId').equals(duplicate.id).toArray();
                for (const completion of completions) {
                    // Check if completion already exists for this date
                    const existing = await db.completions
                        .where('[habitId+date]')
                        .equals([keep.id, completion.date])
                        .first();
                    
                    if (!existing) {
                        await db.completions.update(completion.id, { habitId: keep.id });
                    } else {
                        await db.completions.delete(completion.id);
                    }
                }
                
                // Delete the duplicate habit
                await db.habits.delete(duplicate.id);
                removedCount++;
            }
            console.log(`Removed ${duplicates.length} duplicate habit(s) for ${key}`);
        }
    }

    return removedCount;
}

/**
 * Count duplicate habits without removing them
 */
export async function countDuplicateHabits(): Promise<number> {
    const allHabits = await db.habits.toArray();
    const seen = new Set<string>();
    let duplicates = 0;

    for (const habit of allHabits) {
        const key = `${habit.name}-${habit.category}`;
        if (seen.has(key)) {
            duplicates++;
        } else {
            seen.add(key);
        }
    }

    return duplicates;
}

/**
 * Clean up duplicate goals (same title)
 */
export async function cleanupDuplicateGoals(): Promise<number> {
    const allGoals = await db.goals.toArray();
    const goalMap = new Map<string, typeof allGoals>();

    // Group by title (case-insensitive)
    for (const goal of allGoals) {
        const key = goal.title.toLowerCase();
        if (!goalMap.has(key)) {
            goalMap.set(key, []);
        }
        goalMap.get(key)!.push(goal);
    }

    let removedCount = 0;
    for (const [key, goals] of goalMap.entries()) {
        if (goals.length > 1) {
            // Keep the oldest one (by createdAt), delete the rest
            const sorted = goals.sort((a, b) => 
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            const [keep, ...duplicates] = sorted;

            // Migrate milestones from duplicates to the kept goal
            for (const duplicate of duplicates) {
                const milestones = await db.milestones.where('goalId').equals(duplicate.id).toArray();
                for (const milestone of milestones) {
                    await db.milestones.update(milestone.id, { goalId: keep.id });
                }
                
                // Delete the duplicate goal
                await db.goals.delete(duplicate.id);
                removedCount++;
            }
            console.log(`Removed ${duplicates.length} duplicate goal(s) for ${key}`);
        }
    }

    return removedCount;
}

/**
 * Count duplicate goals without removing them
 */
export async function countDuplicateGoals(): Promise<number> {
    const allGoals = await db.goals.toArray();
    const seen = new Set<string>();
    let duplicates = 0;

    for (const goal of allGoals) {
        const key = goal.title.toLowerCase();
        if (seen.has(key)) {
            duplicates++;
        } else {
            seen.add(key);
        }
    }

    return duplicates;
}

/**
 * Clean all duplicates at once
 */
export async function cleanupAllDuplicates(): Promise<{
    habits: number;
    goals: number;
    completions: number;
}> {
    const habits = await cleanupDuplicateHabits();
    const goals = await cleanupDuplicateGoals();
    const completions = await cleanupDuplicateCompletions();
    
    return { habits, goals, completions };
}

/**
 * Count all duplicates
 */
export async function countAllDuplicates(): Promise<{
    habits: number;
    goals: number;
    completions: number;
}> {
    const habits = await countDuplicateHabits();
    const goals = await countDuplicateGoals();
    const completions = await countDuplicateCompletions();
    
    return { habits, goals, completions };
}
