/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSupabaseClient } from '@/lib/supabase/client';
import { db } from '@/lib/db';
import type { Habit, HabitCompletion, Goal, Milestone } from '@/lib/types';

// ===================
// TYPES
// ===================

export type SyncStatus =
  | { type: 'idle'; message?: string }
  | { type: 'syncing'; message: string; progress?: number }
  | { type: 'success'; message: string; syncedAt?: Date }
  | { type: 'error'; message: string; retryable?: boolean };

interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: 'habits' | 'completions' | 'goals' | 'milestones';
  data: any;
  timestamp: number;
  retryCount: number;
}

// ===================
// CONSTANTS
// ===================

const SYNC_DEBOUNCE_MS = 1000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;
const BATCH_SIZE = 50;
const SYNC_WINDOW_DAYS = 90;

// ===================
// SYNC ENGINE
// ===================

export class SyncEngine {
  private supabase = getSupabaseClient();
  private userId: string | null = null;
  private isSyncing = false;
  private syncLock = false;
  private syncCallbacks: Array<(status: SyncStatus) => void> = [];
  private realtimeChannel: ReturnType<typeof this.supabase.channel> | null = null;
  private pendingOperations: Map<string, PendingOperation> = new Map();
  private syncDebounceTimer: NodeJS.Timeout | null = null;
  private lastSyncAt: Date | null = null;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  constructor() {
    this.setupAuth();
    this.setupNetworkListeners();
    this.loadPendingOperations();
  }

  // ===================
  // INITIALIZATION
  // ===================

  private async setupAuth() {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      this.userId = session?.user?.id || null;

      this.supabase.auth.onAuthStateChange((event, session) => {
        const newUserId = session?.user?.id || null;

        if (newUserId !== this.userId) {
          this.userId = newUserId;

          if (newUserId) {
            this.syncAll();
            this.setupRealtime();
          } else {
            this.cleanupRealtime();
            this.pendingOperations.clear();
          }
        }
      });

      if (this.userId) {
        this.setupRealtime();
      }
    } catch (error) {
      this.log('error', 'Failed to setup auth', error);
    }
  }

  private setupNetworkListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.log('info', 'Back online, syncing pending changes...');
      this.processPendingOperations();
      this.syncAll();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.log('info', 'Offline mode activated');
      this.notifyStatus({ type: 'idle', message: 'Offline - changes will sync when online' });
    });
  }

  private async loadPendingOperations() {
    try {
      if (typeof localStorage === 'undefined') return;
      const stored = localStorage.getItem('habit_sync_pending');
      if (stored) {
        const operations = JSON.parse(stored) as PendingOperation[];
        operations.forEach(op => this.pendingOperations.set(op.id, op));
      }
    } catch (error) {
      this.log('warn', 'Failed to load pending operations', error);
    }
  }

  private savePendingOperations() {
    try {
      if (typeof localStorage === 'undefined') return;
      const operations = Array.from(this.pendingOperations.values());
      localStorage.setItem('habit_sync_pending', JSON.stringify(operations));
    } catch (error) {
      this.log('warn', 'Failed to save pending operations', error);
    }
  }

  // ===================
  // LOGGING
  // ===================

  private log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    const prefix = `[SyncEngine]`;
    const timestamp = new Date().toISOString();
    
    if (process.env.NODE_ENV === 'development') {
      switch (level) {
        case 'info':
          console.log(`${prefix} ${timestamp} - ${message}`, data || '');
          break;
        case 'warn':
          console.warn(`${prefix} ${timestamp} - ${message}`, data || '');
          break;
        case 'error':
          console.error(`${prefix} ${timestamp} - ${message}`, data || '');
          break;
      }
    }
  }

  // ===================
  // STATUS MANAGEMENT
  // ===================

  onSyncStatusChange(callback: (status: SyncStatus) => void) {
    this.syncCallbacks.push(callback);
    return () => {
      this.syncCallbacks = this.syncCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyStatus(status: SyncStatus) {
    this.syncCallbacks.forEach(cb => {
      try {
        cb(status);
      } catch (error) {
        this.log('error', 'Status callback error', error);
      }
    });
  }

  // ===================
  // MAIN SYNC FUNCTIONS
  // ===================

  async syncAll(): Promise<void> {
    if (!this.userId) {
      this.log('info', 'Sync skipped - no user');
      return;
    }

    if (this.syncLock) {
      this.log('info', 'Sync already in progress, skipping');
      return;
    }

    if (!this.isOnline) {
      this.notifyStatus({ type: 'idle', message: 'Offline - waiting for connection' });
      return;
    }

    this.syncLock = true;
    this.isSyncing = true;
    this.notifyStatus({ type: 'syncing', message: 'Starting sync...', progress: 0 });

    try {
      // Process any pending operations first
      await this.processPendingOperations();
      this.notifyStatus({ type: 'syncing', message: 'Syncing habits...', progress: 20 });

      // Sync all data types with proper error handling
      const results = await Promise.allSettled([
        this.syncHabitsWithRetry(),
        this.syncGoalsWithRetry(),
      ]);

      // Check for failures
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        this.log('error', 'Some sync operations failed', failures);
      }

      this.notifyStatus({ type: 'syncing', message: 'Syncing completions...', progress: 50 });
      
      // Sync completions and milestones (depends on habits/goals)
      await Promise.allSettled([
        this.syncCompletionsWithRetry(),
        this.syncMilestonesWithRetry(),
      ]);

      this.notifyStatus({ type: 'syncing', message: 'Cleaning up...', progress: 80 });

      // Cleanup duplicates
      await this.cleanupLocalDuplicates();

      this.lastSyncAt = new Date();
      this.notifyStatus({ 
        type: 'success', 
        message: 'All data synced',
        syncedAt: this.lastSyncAt 
      });

      this.log('info', 'Sync completed successfully');
    } catch (error) {
      this.log('error', 'Sync failed', error);
      this.notifyStatus({ 
        type: 'error', 
        message: 'Sync failed - will retry',
        retryable: true 
      });
    } finally {
      this.syncLock = false;
      this.isSyncing = false;
    }
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    name: string,
    maxRetries = MAX_RETRY_ATTEMPTS
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        this.log('warn', `${name} failed (attempt ${attempt}/${maxRetries})`, error?.message);
        
        if (attempt < maxRetries) {
          await this.delay(RETRY_DELAY_MS * attempt);
        }
      }
    }
    
    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===================
  // PENDING OPERATIONS
  // ===================

  private async processPendingOperations() {
    if (this.pendingOperations.size === 0) return;

    this.log('info', `Processing ${this.pendingOperations.size} pending operations`);

    const operations = Array.from(this.pendingOperations.values())
      .sort((a, b) => a.timestamp - b.timestamp);

    for (const op of operations) {
      try {
        await this.executePendingOperation(op);
        this.pendingOperations.delete(op.id);
      } catch {
        op.retryCount++;
        if (op.retryCount >= MAX_RETRY_ATTEMPTS) {
          this.log('error', `Dropping failed operation after ${MAX_RETRY_ATTEMPTS} attempts`, op);
          this.pendingOperations.delete(op.id);
        }
      }
    }

    this.savePendingOperations();
  }

  private async executePendingOperation(op: PendingOperation) {
    if (!this.userId) return;

    switch (op.type) {
      case 'create':
      case 'update':
        await this.supabase.from(op.table).upsert(op.data);
        break;
      case 'delete':
        await this.supabase.from(op.table).delete().eq('id', op.data.id);
        break;
    }
  }

  private queueOperation(op: Omit<PendingOperation, 'id' | 'timestamp' | 'retryCount'>) {
    const operation: PendingOperation = {
      ...op,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0,
    };
    
    this.pendingOperations.set(operation.id, operation);
    this.savePendingOperations();

    // Try to process immediately if online
    if (this.isOnline && !this.isSyncing) {
      this.processPendingOperations();
    }
  }

  // ===================
  // HABITS SYNC
  // ===================

  private async syncHabitsWithRetry() {
    return this.withRetry(() => this.syncHabits(), 'Habits sync');
  }

  private async syncHabits() {
    if (!this.userId) return;

    // Pull ALL habits from Supabase (including archived for proper merge)
    const { data: remoteHabits, error } = await this.supabase
      .from('habits')
      .select('*')
      .eq('user_id', this.userId);

    if (error) throw error;

    const localHabits = await db.habits.toArray();

    // Create lookup maps - use lowercase for case-insensitive matching
    const remoteById = new Map((remoteHabits || []).map((h: any) => [h.id, h]));
    const remoteByKey = new Map(
      (remoteHabits || []).map((h: any) => [`${h.name.toLowerCase()}-${h.category}`, h])
    );
    const localById = new Map(localHabits.map(h => [h.id, h]));

    // Track processed remote habits
    const processedRemoteIds = new Set<string>();

    // Process local habits
    for (const local of localHabits) {
      const remoteById_ = remoteById.get(local.id);
      const habitKey = `${local.name.toLowerCase()}-${local.category}`;
      const remoteByKey_ = remoteByKey.get(habitKey);

      if (remoteById_) {
        // Same ID exists remotely - merge based on timestamp
        processedRemoteIds.add(remoteById_.id);
        const localUpdated = new Date(local.createdAt).getTime();
        const remoteUpdated = new Date(remoteById_.updated_at || remoteById_.created_at).getTime();

        if (localUpdated > remoteUpdated) {
          await this.pushHabitToRemote(local);
        } else {
          await this.updateLocalHabit(remoteById_);
        }
      } else if (remoteByKey_ && remoteByKey_.id !== local.id) {
        // Different ID but same name+category - merge (remote wins for ID)
        processedRemoteIds.add(remoteByKey_.id);
        await this.mergeHabitToRemote(local, remoteByKey_);
      } else if (!local.archived) {
        // Local only and not archived - push to remote
        await this.pushHabitToRemote(local);
      }
    }

    // Process remote habits not yet seen (pull to local)
    for (const remote of (remoteHabits || []) as any[]) {
      if (!processedRemoteIds.has(remote.id) && !localById.has(remote.id)) {
        if (!remote.is_archived) {
          await this.updateLocalHabit(remote);
        }
      }
    }
  }

  private async pushHabitToRemote(habit: Habit) {
    if (!this.userId) return;

    const { error } = await this.supabase.from('habits').upsert({
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
      updated_at: new Date().toISOString(),
    } as any);

    if (error) throw error;
  }

  private async updateLocalHabit(remote: any) {
    const localHabit: Habit = {
      id: remote.id,
      name: remote.name,
      icon: remote.icon || '✓',
      category: remote.category,
      targetDaysPerWeek: remote.target_days || 7,
      archived: remote.is_archived || false,
      order: remote.order_index || 0,
      createdAt: remote.created_at,
    };

    await db.habits.put(localHabit);
  }

  private async mergeHabitToRemote(local: Habit, remote: any) {
    this.log('info', `Merging duplicate habit: "${local.name}" (local: ${local.id}, remote: ${remote.id})`);
    
    // Remote wins for the ID - migrate all completions from local to remote
    const completions = await db.completions
      .where('habitId')
      .equals(local.id)
      .toArray();

    for (const completion of completions) {
      // Check if completion already exists for remote habit on same date
      const existing = await db.completions
        .where('[habitId+date]')
        .equals([remote.id, completion.date])
        .first();

      if (!existing) {
        // Update local completion to use remote habit ID
        await db.completions.update(completion.id, { habitId: remote.id });
        
        // Also push to remote
        if (this.userId) {
          await this.supabase.from('completions').upsert({
            id: completion.id,
            user_id: this.userId,
            habit_id: remote.id,
            date: completion.date,
            completed: completion.completed,
            notes: completion.note || null,
          } as any);
        }
      } else {
        // Duplicate completion - delete local one
        await db.completions.delete(completion.id);
      }
    }

    // Delete the local duplicate habit
    await db.habits.delete(local.id);

    // Update local with remote version
    await this.updateLocalHabit(remote);
  }

  async pushHabit(habit: Habit) {
    if (!this.userId) return;
    
    if (!this.isOnline) {
      this.queueOperation({
        type: 'update',
        table: 'habits',
        data: {
          id: habit.id,
          user_id: this.userId,
          name: habit.name,
          icon: habit.icon || '✓',
          category: habit.category,
          target_days: habit.targetDaysPerWeek,
          is_archived: habit.archived,
          order_index: habit.order,
          updated_at: new Date().toISOString(),
        },
      });
      return;
    }

    await this.pushHabitToRemote(habit);
  }

  async deleteHabit(habitId: string) {
    if (!this.userId) return;

    if (!this.isOnline) {
      this.queueOperation({
        type: 'delete',
        table: 'habits',
        data: { id: habitId },
      });
      return;
    }

    // Delete habit and its completions
    await this.supabase.from('completions').delete().eq('habit_id', habitId);
    await this.supabase.from('habits').delete().eq('id', habitId);
  }

  // ===================
  // COMPLETIONS SYNC
  // ===================

  private async syncCompletionsWithRetry() {
    return this.withRetry(() => this.syncCompletions(), 'Completions sync');
  }

  private async syncCompletions() {
    if (!this.userId) return;

    const startDate = this.getStartDate();

    const { data: remoteCompletions, error } = await this.supabase
      .from('completions')
      .select('*')
      .eq('user_id', this.userId)
      .gte('date', startDate);

    if (error) throw error;

    const localCompletions = await db.completions
      .where('date')
      .aboveOrEqual(startDate)
      .toArray();

    // Create lookup maps using habitId-date as unique key
    const remoteMap = new Map(
      (remoteCompletions || []).map((c: any) => [`${c.habit_id}-${c.date}`, c])
    );
    const localMap = new Map(
      localCompletions.map(c => [`${c.habitId}-${c.date}`, c])
    );

    // Collect batch operations
    const toInsertRemote: any[] = [];
    const toUpsertLocal: HabitCompletion[] = [];

    // Push local completions that don't exist remotely
    for (const local of localCompletions) {
      const key = `${local.habitId}-${local.date}`;
      if (!remoteMap.has(key)) {
        toInsertRemote.push({
          id: local.id,
          user_id: this.userId,
          habit_id: local.habitId,
          date: local.date,
          completed: local.completed,
          notes: local.note || null,
        });
      }
    }

    // Pull remote completions that don't exist locally
    for (const remote of (remoteCompletions || []) as any[]) {
      const key = `${remote.habit_id}-${remote.date}`;
      if (!localMap.has(key)) {
        toUpsertLocal.push({
          id: remote.id,
          habitId: remote.habit_id,
          date: remote.date,
          completed: remote.completed,
          note: remote.notes || undefined,
        });
      }
    }

    // Execute batch operations
    if (toInsertRemote.length > 0) {
      await this.batchUpsert('completions', toInsertRemote);
    }

    if (toUpsertLocal.length > 0) {
      await db.completions.bulkPut(toUpsertLocal);
    }
  }

  async pushCompletion(completion: HabitCompletion) {
    if (!this.userId) return;

    const data = {
      id: completion.id,
      user_id: this.userId,
      habit_id: completion.habitId,
      date: completion.date,
      completed: completion.completed,
      notes: completion.note || null,
    };

    if (!this.isOnline) {
      this.queueOperation({ type: 'update', table: 'completions', data });
      return;
    }

    await this.supabase.from('completions').upsert(data as any);
  }

  async deleteCompletion(completionId: string) {
    if (!this.userId) return;

    if (!this.isOnline) {
      this.queueOperation({
        type: 'delete',
        table: 'completions',
        data: { id: completionId },
      });
      return;
    }

    await this.supabase.from('completions').delete().eq('id', completionId);
  }

  // ===================
  // GOALS SYNC
  // ===================

  private async syncGoalsWithRetry() {
    return this.withRetry(() => this.syncGoals(), 'Goals sync');
  }

  private async syncGoals() {
    if (!this.userId) return;

    const { data: remoteGoals, error } = await this.supabase
      .from('goals')
      .select('*')
      .eq('user_id', this.userId);

    if (error) throw error;

    const localGoals = await db.goals.toArray();

    const remoteById = new Map((remoteGoals || []).map((g: any) => [g.id, g]));
    const remoteByTitle = new Map(
      (remoteGoals || []).map((g: any) => [g.title.toLowerCase(), g])
    );
    const localById = new Map(localGoals.map(g => [g.id, g]));
    const processedRemoteIds = new Set<string>();

    for (const local of localGoals) {
      const remoteById_ = remoteById.get(local.id);
      const remoteByTitle_ = remoteByTitle.get(local.title.toLowerCase());

      if (remoteById_) {
        processedRemoteIds.add(remoteById_.id);
        const localUpdated = new Date(local.createdAt).getTime();
        const remoteUpdated = new Date(remoteById_.updated_at || remoteById_.created_at).getTime();

        if (localUpdated > remoteUpdated) {
          await this.pushGoalToRemote(local);
        } else {
          await this.updateLocalGoal(remoteById_);
        }
      } else if (remoteByTitle_ && remoteByTitle_.id !== local.id) {
        processedRemoteIds.add(remoteByTitle_.id);
        await this.mergeGoalToRemote(local, remoteByTitle_);
      } else if (!local.archived) {
        await this.pushGoalToRemote(local);
      }
    }

    for (const remote of (remoteGoals || []) as any[]) {
      if (!processedRemoteIds.has(remote.id) && !localById.has(remote.id)) {
        if (!remote.is_archived) {
          await this.updateLocalGoal(remote);
        }
      }
    }
  }

  private async pushGoalToRemote(goal: Goal) {
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
      updated_at: new Date().toISOString(),
    } as any);
  }

  private async updateLocalGoal(remote: any) {
    const localGoal: Goal = {
      id: remote.id,
      title: remote.title,
      description: remote.description || undefined,
      areaOfLife: remote.category,
      priority: remote.priority || 'medium',
      status: remote.status || 'not_started',
      deadline: remote.target_date,
      isFocus: remote.is_focus || false,
      archived: remote.is_archived || false,
      createdAt: remote.created_at,
      startDate: remote.created_at,
    };

    await db.goals.put(localGoal);
  }

  private async mergeGoalToRemote(local: Goal, remote: any) {
    this.log('info', `Merging duplicate goal: "${local.title}" (local: ${local.id}, remote: ${remote.id})`);
    
    // Migrate milestones from local to remote
    const milestones = await db.milestones
      .where('goalId')
      .equals(local.id)
      .toArray();

    for (const milestone of milestones) {
      await db.milestones.update(milestone.id, { goalId: remote.id });
      
      if (this.userId) {
        await this.supabase.from('milestones').upsert({
          id: milestone.id,
          user_id: this.userId,
          goal_id: remote.id,
          title: milestone.title,
          is_completed: milestone.completed,
          completed_at: milestone.completedAt,
          order_index: milestone.order,
        } as any);
      }
    }

    // Delete the local duplicate goal
    await db.goals.delete(local.id);
    
    // Update local with remote version
    await this.updateLocalGoal(remote);
  }

  async pushGoal(goal: Goal) {
    if (!this.userId) return;
    
    if (!this.isOnline) {
      this.queueOperation({
        type: 'update',
        table: 'goals',
        data: {
          id: goal.id,
          user_id: this.userId,
          title: goal.title,
          description: goal.description || null,
          category: goal.areaOfLife,
          priority: goal.priority,
          status: goal.status,
          target_date: goal.deadline,
          is_focus: goal.isFocus,
          is_archived: goal.archived,
          updated_at: new Date().toISOString(),
        },
      });
      return;
    }

    await this.pushGoalToRemote(goal);
  }

  async deleteGoal(goalId: string) {
    if (!this.userId) return;

    if (!this.isOnline) {
      this.queueOperation({
        type: 'delete',
        table: 'goals',
        data: { id: goalId },
      });
      return;
    }

    // Delete milestones first, then goal
    await this.supabase.from('milestones').delete().eq('goal_id', goalId);
    await this.supabase.from('goals').delete().eq('id', goalId);
  }

  // ===================
  // MILESTONES SYNC
  // ===================

  private async syncMilestonesWithRetry() {
    return this.withRetry(() => this.syncMilestones(), 'Milestones sync');
  }

  private async syncMilestones() {
    if (!this.userId) return;

    const { data: remoteMilestones, error } = await this.supabase
      .from('milestones')
      .select('*')
      .eq('user_id', this.userId);

    if (error) throw error;

    const localMilestones = await db.milestones.toArray();
    const remoteMap = new Map((remoteMilestones || []).map((m: any) => [m.id, m]));
    const localMap = new Map(localMilestones.map(m => [m.id, m]));

    // Push local milestones not in remote
    const toInsertRemote: any[] = [];
    for (const local of localMilestones) {
      if (!remoteMap.has(local.id)) {
        toInsertRemote.push({
          id: local.id,
          user_id: this.userId,
          goal_id: local.goalId,
          title: local.title,
          is_completed: local.completed,
          completed_at: local.completedAt,
          order_index: local.order,
        });
      }
    }

    if (toInsertRemote.length > 0) {
      await this.batchUpsert('milestones', toInsertRemote);
    }

    // Pull remote milestones not in local
    const toUpsertLocal: Milestone[] = [];
    for (const remote of (remoteMilestones || []) as any[]) {
      if (!localMap.has(remote.id)) {
        toUpsertLocal.push({
          id: remote.id,
          goalId: remote.goal_id,
          title: remote.title,
          completed: remote.is_completed || false,
          completedAt: remote.completed_at || undefined,
          order: remote.order_index || 0,
        });
      }
    }

    if (toUpsertLocal.length > 0) {
      await db.milestones.bulkPut(toUpsertLocal);
    }
  }

  async pushMilestone(milestone: Milestone) {
    if (!this.userId) return;

    const data = {
      id: milestone.id,
      user_id: this.userId,
      goal_id: milestone.goalId,
      title: milestone.title,
      is_completed: milestone.completed,
      completed_at: milestone.completedAt,
      order_index: milestone.order,
    };

    if (!this.isOnline) {
      this.queueOperation({ type: 'update', table: 'milestones', data });
      return;
    }

    await this.supabase.from('milestones').upsert(data as any);
  }

  async deleteMilestone(milestoneId: string) {
    if (!this.userId) return;

    if (!this.isOnline) {
      this.queueOperation({
        type: 'delete',
        table: 'milestones',
        data: { id: milestoneId },
      });
      return;
    }

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
        () => this.debouncedSync('habits')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'completions', filter: `user_id=eq.${this.userId}` },
        () => this.debouncedSync('completions')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'goals', filter: `user_id=eq.${this.userId}` },
        () => this.debouncedSync('goals')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'milestones', filter: `user_id=eq.${this.userId}` },
        () => this.debouncedSync('milestones')
      )
      .subscribe((status) => {
        this.log('info', `Realtime subscription status: ${status}`);
      });
  }

  private debouncedSync(table: string) {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }

    this.syncDebounceTimer = setTimeout(async () => {
      this.log('info', `Realtime change detected in ${table}, syncing...`);
      
      try {
        switch (table) {
          case 'habits':
            await this.syncHabitsWithRetry();
            break;
          case 'completions':
            await this.syncCompletionsWithRetry();
            break;
          case 'goals':
            await this.syncGoalsWithRetry();
            break;
          case 'milestones':
            await this.syncMilestonesWithRetry();
            break;
        }
        
        this.notifyStatus({ type: 'success', message: 'Data updated' });
      } catch (error) {
        this.log('error', `Realtime sync failed for ${table}`, error);
      }
    }, SYNC_DEBOUNCE_MS);
  }

  private cleanupRealtime() {
    if (this.realtimeChannel) {
      this.supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }

  // ===================
  // UTILITIES
  // ===================

  private getStartDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - SYNC_WINDOW_DAYS);
    return date.toISOString().split('T')[0];
  }

  private async batchUpsert(table: string, items: any[]) {
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const { error } = await this.supabase.from(table).upsert(batch as any);
      if (error) {
        this.log('error', `Batch upsert failed for ${table}`, error);
        throw error;
      }
    }
  }

  private async cleanupLocalDuplicates() {
    try {
      // Cleanup duplicate habits (same name + category)
      const habits = await db.habits.toArray();
      const habitKeys = new Map<string, Habit>();
      
      for (const habit of habits) {
        const key = `${habit.name.toLowerCase()}-${habit.category}`;
        const existing = habitKeys.get(key);
        
        if (existing) {
          // Keep the one with earlier creation date
          const keepHabit = new Date(habit.createdAt) < new Date(existing.createdAt) ? habit : existing;
          const deleteHabit = keepHabit === habit ? existing : habit;
          
          this.log('info', `Cleaning up duplicate habit: ${deleteHabit.name}`);
          
          // Migrate completions
          const completions = await db.completions.where('habitId').equals(deleteHabit.id).toArray();
          for (const c of completions) {
            const exists = await db.completions
              .where('[habitId+date]')
              .equals([keepHabit.id, c.date])
              .first();
            if (!exists) {
              await db.completions.update(c.id, { habitId: keepHabit.id });
            } else {
              await db.completions.delete(c.id);
            }
          }
          
          await db.habits.delete(deleteHabit.id);
          habitKeys.set(key, keepHabit);
        } else {
          habitKeys.set(key, habit);
        }
      }

      // Cleanup duplicate goals (same title)
      const goals = await db.goals.toArray();
      const goalKeys = new Map<string, Goal>();
      
      for (const goal of goals) {
        const key = goal.title.toLowerCase();
        const existing = goalKeys.get(key);
        
        if (existing) {
          const keepGoal = new Date(goal.createdAt) < new Date(existing.createdAt) ? goal : existing;
          const deleteGoal = keepGoal === goal ? existing : goal;
          
          this.log('info', `Cleaning up duplicate goal: ${deleteGoal.title}`);
          
          // Migrate milestones
          const milestones = await db.milestones.where('goalId').equals(deleteGoal.id).toArray();
          for (const m of milestones) {
            await db.milestones.update(m.id, { goalId: keepGoal.id });
          }
          
          await db.goals.delete(deleteGoal.id);
          goalKeys.set(key, keepGoal);
        } else {
          goalKeys.set(key, goal);
        }
      }

      // Cleanup duplicate completions (same habitId + date)
      const completions = await db.completions.toArray();
      const completionKeys = new Map<string, HabitCompletion>();
      
      for (const completion of completions) {
        const key = `${completion.habitId}-${completion.date}`;
        if (completionKeys.has(key)) {
          await db.completions.delete(completion.id);
        } else {
          completionKeys.set(key, completion);
        }
      }
    } catch (error) {
      this.log('error', 'Failed to cleanup duplicates', error);
    }
  }

  // Public utility methods
  getSyncMetadata() {
    return {
      lastSyncAt: this.lastSyncAt?.toISOString() || null,
      pendingChanges: this.pendingOperations.size,
      isOnline: this.isOnline,
    };
  }

  isCurrentlySyncing(): boolean {
    return this.isSyncing;
  }

  getOnlineStatus(): boolean {
    return this.isOnline;
  }
}

// ===================
// SINGLETON
// ===================

let syncEngine: SyncEngine | null = null;

export function getSyncEngine(): SyncEngine {
  if (!syncEngine) {
    syncEngine = new SyncEngine();
  }
  return syncEngine;
}
