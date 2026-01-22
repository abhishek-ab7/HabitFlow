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
            console.log(`Removed ${duplicates.length} duplicate(s) for ${key}`);
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
