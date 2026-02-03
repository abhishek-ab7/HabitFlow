import { getSupabaseClient } from './supabase/client';
import { db } from './db';

/**
 * Force push all local habits to Supabase
 * Use this to sync local data to cloud when auto-sync fails
 */
export async function forcePushAllHabits() {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user?.id) {
        throw new Error("Not authenticated");
    }

    const userId = session.user.id;

    // Get all local habits
    const localHabits = await db.habits
        .where('userId')
        .equals(userId)
        .toArray();

    console.log(`[Force Sync] Pushing ${localHabits.length} habits to Supabase...`);

    // Push each habit to Supabase (upsert)
    const results = [];
    for (const habit of localHabits) {
        const { error } = await supabase.from('habits').upsert({
            id: habit.id,
            user_id: userId,
            name: habit.name,
            description: null,
            icon: habit.icon || '✓',
            color: '#6366f1',
            category: habit.category,
            frequency: { type: 'daily', days: [0, 1, 2, 3, 4, 5, 6] },
            target_days: habit.targetDaysPerWeek,
            reminder_time: null,
            is_archived: habit.archived || false,
            archived_at: habit.archivedAt || null,
            order_index: habit.order,
            created_at: habit.createdAt,
            updated_at: habit.updatedAt || habit.createdAt,
        } as any); // Type assertion to bypass Supabase type issue

        if (error) {
            console.error(`[Force Sync] Failed to push habit ${habit.name}:`, error);
            results.push({ habit: habit.name, success: false, error });
        } else {
            results.push({ habit: habit.name, success: true });
        }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[Force Sync] Complete: ${successCount}/${localHabits.length} habits synced`);

    return {
        total: localHabits.length,
        success: successCount,
        failed: localHabits.length - successCount,
        results
    };
}

/**
 * Force pull all habits from Supabase to local
 * WARNING: This will overwrite local data
 */
export async function forcePullAllHabits() {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user?.id) {
        throw new Error("Not authenticated");
    }

    const userId = session.user.id;

    // Get all remote habits
    const { data: remoteHabits, error } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', userId);

    if (error) throw error;

    console.log(`[Force Pull] Pulling ${remoteHabits?.length || 0} habits from Supabase...`);

    // Clear local habits for this user
    await db.habits.where('userId').equals(userId).delete();

    // Insert remote habits
    if (remoteHabits && remoteHabits.length > 0) {
        const localHabits = remoteHabits.map((remote: any) => ({
            id: remote.id,
            userId: userId,
            name: remote.name,
            icon: remote.icon || '✓',
            category: remote.category,
            targetDaysPerWeek: remote.target_days || 7,
            archived: remote.is_archived || false,
            archivedAt: remote.archived_at || undefined,
            updatedAt: remote.updated_at || remote.created_at,
            order: remote.order_index || 0,
            createdAt: remote.created_at,
        }));

        await db.habits.bulkAdd(localHabits);
    }

    console.log(`[Force Pull] Complete: ${remoteHabits?.length || 0} habits pulled`);

    return {
        total: remoteHabits?.length || 0
    };
}
