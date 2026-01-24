import { getSupabaseClient } from '@/lib/supabase/client';
import { db, cleanupDuplicateCompletions } from '@/lib/db';
import type { Habit, HabitCompletion, Goal, Milestone } from '@/lib/types';

export class SyncEngine {
  private supabase = getSupabaseClient();
  private userId: string | null = null;
  private isSyncing = false;
  private syncCallbacks: Array<(status: SyncStatus) => void> = [];
  private realtimeChannel: ReturnType<typeof this.supabase.channel> | null = null;

  constructor() {
    this.setupAuth();
  }

  private async setupAuth() {
    const { data: { session } } = await this.supabase.auth.getSession();
    this.userId = session?.user?.id || null;

    // Listen for auth changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user?.id || null;

      if (newUserId !== this.userId) {
        this.userId = newUserId;

        if (newUserId) {
          // User logged in - sync data
          this.syncAll();
          this.setupRealtime();
        } else {
          // User logged out - clean up realtime
          this.cleanupRealtime();
        }
      }
    });

    // If already logged in, set up realtime
    if (this.userId) {
      this.setupRealtime();
    }
  }

  onSyncStatusChange(callback: (status: SyncStatus) => void) {
    this.syncCallbacks.push(callback);
    return () => {
      this.syncCallbacks = this.syncCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyStatus(status: SyncStatus) {
    this.syncCallbacks.forEach(cb => cb(status));
  }

  // ===================
  // MAIN SYNC FUNCTIONS
  // ===================

  async syncAll(): Promise<void> {
    if (!this.userId || this.isSyncing) return;

    this.isSyncing = true;
    this.notifyStatus({ type: 'syncing', message: 'Syncing data...' });

    try {
      await Promise.all([
        this.syncHabits(),
        this.syncCompletions(),
        this.syncGoals(),
        this.syncMilestones(),
      ]);

      // Clean up any duplicate completions after sync
      await cleanupDuplicateCompletions();

      this.notifyStatus({ type: 'success', message: 'All data synced' });
    } catch (error) {
      console.error('Sync error:', error);
      this.notifyStatus({ type: 'error', message: 'Sync failed' });
    } finally {
      this.isSyncing = false;
    }
  }

  // ===================
  // HABITS SYNC
  // ===================

  private async syncHabits() {
    if (!this.userId) return;

    // Pull from Supabase
    const { data: remoteHabits, error } = await this.supabase
      .from('habits')
      .select('*')
      .eq('user_id', this.userId)
      .eq('is_archived', false);

    if (error) throw error;

    // Get local habits
    const localHabits = await db.habits.toArray();

    // Create maps for efficient lookup
    const remoteMap = new Map((remoteHabits || []).map((h: any) => [h.id, h]));
    // Map by name+category to detect duplicates
    const remoteByNameCategory = new Map(
      (remoteHabits || []).map((h: any) => [`${h.name}-${h.category}`, h])
    );

    // Process local habits
    for (const local of localHabits) {
      if (local.archived) continue;

      const nameKey = `${local.name}-${local.category}`;
      const existingRemote = remoteByNameCategory.get(nameKey);

      if (existingRemote) {
        // This habit already exists remotely (by name+category)
        // Update local to use the remote ID to prevent duplicates
        if (local.id !== existingRemote.id) {
          // Delete the local duplicate and replace with remote version
          await db.habits.delete(local.id);
          // Migrate completions to use the remote habit ID
          const localCompletions = await db.completions
            .where('habitId')
            .equals(local.id)
            .toArray();
          
          for (const completion of localCompletions) {
            // Check if completion already exists for this date with remote habit ID
            const existing = await db.completions
              .where('[habitId+date]')
              .equals([existingRemote.id, completion.date])
              .first();
            
            if (!existing) {
              // Update to use remote habit ID
              await db.completions.update(completion.id, {
                habitId: existingRemote.id,
              });
              // Also push to remote
              await this.supabase.from('completions').upsert({
                id: completion.id,
                user_id: this.userId!,
                habit_id: existingRemote.id,
                date: completion.date,
                completed: completion.completed,
                notes: completion.note || null,
              } as any);
            } else {
              // Delete duplicate completion
              await db.completions.delete(completion.id);
            }
          }
        }
      } else if (!remoteMap.has(local.id)) {
        // Push new local habit that doesn't exist remotely
        await this.supabase.from('habits').upsert({
          id: local.id,
          user_id: this.userId!,
          name: local.name,
          description: null,
          icon: local.icon || '✓',
          color: '#6366f1',
          category: local.category,
          frequency: { type: 'daily', days: [0, 1, 2, 3, 4, 5, 6] },
          target_days: local.targetDaysPerWeek,
          reminder_time: null,
          is_archived: local.archived,
          order_index: local.order,
        } as any);
        
        // Add to remote map to track it
        remoteByNameCategory.set(nameKey, { id: local.id, name: local.name, category: local.category });
      }
    }

    // Update local with remote habits (only non-duplicate ones)
    for (const remote of (remoteHabits || []) as any[]) {
      const localHabit: Habit = {
        id: remote.id,
        name: remote.name,
        icon: remote.icon,
        category: remote.category as any,
        targetDaysPerWeek: remote.target_days,
        archived: remote.is_archived,
        order: remote.order_index,
        createdAt: remote.created_at,
      };

      await db.habits.put(localHabit);
    }
  }

  async pushHabit(habit: Habit) {
    if (!this.userId) return;

    await this.supabase.from('habits').upsert({
      id: habit.id,
      user_id: this.userId,
      name: habit.name,
      description: null,
      icon: habit.icon || '✓',
      color: '#6366f1',
      category: habit.category,
      frequency: { type: 'daily', days: [0, 1, 2, 3, 4, 5, 6] },
      target_days: habit.targetDaysPerWeek,
      reminder_time: null,
      is_archived: habit.archived,
      order_index: habit.order,
    } as any);
  }

  async deleteHabit(habitId: string) {
    if (!this.userId) return;
    await this.supabase.from('habits').delete().eq('id', habitId);
  }

  // ===================
  // COMPLETIONS SYNC
  // ===================

  private async syncCompletions() {
    if (!this.userId) return;

    // Pull completions from last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const startDate = ninetyDaysAgo.toISOString().split('T')[0];

    const { data: remoteCompletions, error } = await this.supabase
      .from('completions')
      .select('*')
      .eq('user_id', this.userId)
      .gte('date', startDate);

    if (error) throw error;

    // Get local completions
    const localCompletions = await db.completions
      .where('date')
      .aboveOrEqual(startDate)
      .toArray();

    const remoteMap = new Map(
      (remoteCompletions || []).map((c: any) => [`${c.habit_id}-${c.date}`, c])
    );
    const localMap = new Map(
      localCompletions.map(c => [`${c.habitId}-${c.date}`, c])
    );

    // Push local completions that don't exist remotely
    for (const local of localCompletions) {
      const key = `${local.habitId}-${local.date}`;
      if (!remoteMap.has(key)) {
        await this.supabase.from('completions').insert({
          id: local.id,
          user_id: this.userId!,
          habit_id: local.habitId,
          date: local.date,
          completed: local.completed,
          notes: local.note || null,
        } as any);
      }
    }

    // Update local with remote completions
    for (const remote of (remoteCompletions || []) as any[]) {
      // Check if completions with this habitId+date already exist locally
      const existingCompletions = await db.completions
        .where('[habitId+date]')
        .equals([remote.habit_id, remote.date])
        .toArray();

      if (existingCompletions.length > 0) {
        // Keep the first one and update it, delete any duplicates
        const [first, ...duplicates] = existingCompletions;
        
        // Delete duplicates
        for (const dup of duplicates) {
          await db.completions.delete(dup.id);
        }
        
        // Update the first one with remote data (prefer remote as source of truth)
        await db.completions.update(first.id, {
          completed: remote.completed,
          note: remote.notes || undefined,
        });
      } else {
        // Add new completion
        const localCompletion: HabitCompletion = {
          id: remote.id,
          habitId: remote.habit_id,
          date: remote.date,
          completed: remote.completed,
          note: remote.notes || undefined,
        };
        await db.completions.put(localCompletion);
      }
    }
  }

  async pushCompletion(completion: HabitCompletion) {
    if (!this.userId) return;

    await this.supabase.from('completions').upsert({
      id: completion.id,
      user_id: this.userId,
      habit_id: completion.habitId,
      date: completion.date,
      completed: completion.completed,
      notes: completion.note || null,
    } as any);
  }

  async deleteCompletion(completionId: string) {
    if (!this.userId) return;
    await this.supabase.from('completions').delete().eq('id', completionId);
  }

  // ===================
  // GOALS SYNC
  // ===================

  private async syncGoals() {
    if (!this.userId) return;

    const { data: remoteGoals, error } = await this.supabase
      .from('goals')
      .select('*')
      .eq('user_id', this.userId)
      .eq('is_archived', false);

    if (error) throw error;

    const localGoals = await db.goals.toArray();
    const remoteMap = new Map((remoteGoals || []).map((g: any) => [g.id, g]));
    // Map by title to detect duplicates
    const remoteByTitle = new Map(
      (remoteGoals || []).map((g: any) => [g.title.toLowerCase(), g])
    );

    // Process local goals
    for (const local of localGoals) {
      if (local.archived) continue;

      const existingRemote = remoteByTitle.get(local.title.toLowerCase());

      if (existingRemote && existingRemote.id !== local.id) {
        // This goal already exists remotely - delete local duplicate
        await db.goals.delete(local.id);
        // Migrate milestones to use the remote goal ID
        const localMilestones = await db.milestones
          .where('goalId')
          .equals(local.id)
          .toArray();
        
        for (const milestone of localMilestones) {
          await db.milestones.update(milestone.id, {
            goalId: existingRemote.id,
          });
          // Push to remote
          await this.supabase.from('milestones').upsert({
            id: milestone.id,
            user_id: this.userId!,
            goal_id: existingRemote.id,
            title: milestone.title,
            is_completed: milestone.completed,
            completed_at: milestone.completedAt,
            order_index: milestone.order,
          } as any);
        }
      } else if (!remoteMap.has(local.id)) {
        // Push new local goal that doesn't exist remotely
        await this.supabase.from('goals').upsert({
          id: local.id,
          user_id: this.userId!,
          title: local.title,
          description: local.description || null,
          category: local.areaOfLife,
          priority: local.priority,
          status: local.status,
          target_date: local.deadline,
          progress: 0,
          is_focus: local.isFocus,
          is_archived: local.archived,
        } as any);
        
        remoteByTitle.set(local.title.toLowerCase(), { id: local.id, title: local.title });
      }
    }

    // Update local with remote
    for (const remote of (remoteGoals || []) as any[]) {
      const localGoal: Goal = {
        id: remote.id,
        title: remote.title,
        description: remote.description || undefined,
        areaOfLife: remote.category as any,
        priority: remote.priority as any,
        status: remote.status as any,
        deadline: remote.target_date,
        isFocus: remote.is_focus,
        archived: remote.is_archived,
        createdAt: remote.created_at,
        startDate: remote.created_at,
      };

      await db.goals.put(localGoal);
    }
  }

  async pushGoal(goal: Goal) {
    if (!this.userId) return;

    await this.supabase.from('goals').upsert({
      id: goal.id,
      user_id: this.userId,
      title: goal.title,
      description: goal.description || null,
      category: goal.areaOfLife,
      priority: goal.priority,
      status: goal.status,
      target_date: goal.deadline,
      progress: 0,
      is_focus: goal.isFocus,
      is_archived: goal.archived,
    } as any);
  }

  async deleteGoal(goalId: string) {
    if (!this.userId) return;
    await this.supabase.from('goals').delete().eq('id', goalId);
  }

  // ===================
  // MILESTONES SYNC
  // ===================

  private async syncMilestones() {
    if (!this.userId) return;

    const { data: remoteMilestones, error } = await this.supabase
      .from('milestones')
      .select('*')
      .eq('user_id', this.userId);

    if (error) throw error;

    const localMilestones = await db.milestones.toArray();
    const remoteMap = new Map((remoteMilestones || []).map((m: any) => [m.id, m]));

    // Push local milestones
    for (const local of localMilestones) {
      if (!remoteMap.has(local.id)) {
        await this.supabase.from('milestones').insert({
          id: local.id,
          user_id: this.userId!,
          goal_id: local.goalId,
          title: local.title,
          is_completed: local.completed,
          completed_at: local.completedAt,
          order_index: local.order,
        } as any);
      }
    }

    // Update local with remote
    for (const remote of (remoteMilestones || []) as any[]) {
      const localMilestone: Milestone = {
        id: remote.id,
        goalId: remote.goal_id,
        title: remote.title,
        completed: remote.is_completed,
        completedAt: remote.completed_at || undefined,
        order: remote.order_index,
      };

      await db.milestones.put(localMilestone);
    }
  }

  async pushMilestone(milestone: Milestone) {
    if (!this.userId) return;

    await this.supabase.from('milestones').upsert({
      id: milestone.id,
      user_id: this.userId,
      goal_id: milestone.goalId,
      title: milestone.title,
      is_completed: milestone.completed,
      completed_at: milestone.completedAt,
      order_index: milestone.order,
    } as any);
  }

  async deleteMilestone(milestoneId: string) {
    if (!this.userId) return;
    await this.supabase.from('milestones').delete().eq('id', milestoneId);
  }

  // ===================
  // REALTIME SYNC
  // ===================

  private setupRealtime() {
    if (!this.userId || this.realtimeChannel) return;

    this.realtimeChannel = this.supabase
      .channel('db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'habits', filter: `user_id=eq.${this.userId}` },
        () => this.syncHabits()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'completions', filter: `user_id=eq.${this.userId}` },
        () => this.syncCompletions()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'goals', filter: `user_id=eq.${this.userId}` },
        () => this.syncGoals()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'milestones', filter: `user_id=eq.${this.userId}` },
        () => this.syncMilestones()
      )
      .subscribe();
  }

  private cleanupRealtime() {
    if (this.realtimeChannel) {
      this.supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }
}

export type SyncStatus =
  | { type: 'idle'; message?: string }
  | { type: 'syncing'; message: string }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };

// Singleton instance
let syncEngine: SyncEngine | null = null;

export function getSyncEngine(): SyncEngine {
  if (!syncEngine) {
    syncEngine = new SyncEngine();
  }
  return syncEngine;
}
