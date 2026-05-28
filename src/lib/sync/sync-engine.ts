/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSupabaseClient } from '@/lib/supabase/client';
import { db, cleanupDuplicateGoals, cleanupDuplicateCompletions, cleanupDuplicateHabits } from '@/lib/db';
import { countAllDuplicates } from '@/lib/cleanup';
import type { Habit, HabitCompletion, Goal, Milestone, MoodLog } from '@/lib/types';
import { useSyncStatusStore } from '../stores/sync-status-store';
import { logger } from '@/lib/logger';

// Engines imports
import {
  syncHabitsWithRetry,
  syncCompletionsWithRetry,
  pushHabitToRemote
} from './engines/habits-sync';

import {
  syncRoutinesWithRetry,
  syncHabitRoutinesWithRetry,
  syncRoutineCompletions
} from './engines/routines-sync';

import {
  syncGoalsWithRetry,
  pushGoalToRemote
} from './engines/goals-sync';

import {
  syncMilestonesWithRetry
} from './engines/milestones-sync';

import {
  syncTasksWithRetry,
  pushTaskToRemote
} from './engines/tasks-sync';

import {
  syncUserSettingsWithRetry,
  syncMoodLogsWithRetry,
  pushUserSettingsToRemote
} from './engines/settings-sync';

export type SyncStatus =
  | { type: 'idle'; message?: string }
  | { type: 'syncing'; message: string; progress?: number }
  | { type: 'success'; message: string; syncedAt?: Date }
  | { type: 'error'; message: string; retryable?: boolean };

export interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: 'habits' | 'completions' | 'goals' | 'milestones' | 'tasks' | 'routines' | 'user_settings' | 'habit_routines' | 'mood_logs';
  data: any;
  timestamp: number;
  retryCount: number;
}

const SYNC_DEBOUNCE_MS = 1000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;
const BATCH_SIZE = 50;
const SYNC_WINDOW_DAYS = 90;
const SYNC_VERSION = '2.0.0';

export class SyncEngine {
  public supabase = getSupabaseClient();
  public userId: string | null = null;
  public isSyncing = false;
  private syncLock = false;
  private syncCallbacks: Array<(status: SyncStatus) => void> = [];
  private realtimeChannel: ReturnType<typeof this.supabase.channel> | null = null;
  public pendingOperations: Map<string, PendingOperation> = new Map();
  private syncDebounceTimer: NodeJS.Timeout | null = null;
  private lastSyncAt: Date | null = null;
  public isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Auth ready promise to prevent race conditions
  private authReadyResolve!: () => void;
  public authReady: Promise<void> = new Promise((resolve) => {
    this.authReadyResolve = resolve;
  });

  // Entity-specific sync locks to prevent race conditions
  public habitSyncLock = false;
  public completionSyncLock = false;
  public taskSyncLock = false;
  public routineSyncLock = false;
  public goalSyncLock = false;
  public milestoneSyncLock = false;
  public habitRoutineSyncLock = false;

  // Periodic duplicate cleanup
  private duplicateCleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupAuth();
    this.setupNetworkListeners();
    this.loadPendingOperations();
  }

  // ===================
  // INITIALIZATION
  // ===================

  private getLastSyncTime(userId: string): Date | null {
    if (typeof localStorage === 'undefined') return null;
    const stored = localStorage.getItem(`habit_sync_last_at_${userId}`);
    return stored ? new Date(stored) : null;
  }

  private handleAuthStateChange(newUserId: string | null) {
    if (newUserId === this.userId) return;

    this.userId = newUserId;
    logger.info('[SyncEngine] Auth state changed, new userId:', this.userId);

    if (newUserId) {
      this.lastSyncAt = this.getLastSyncTime(newUserId);
      this.syncAll();
      this.setupRealtime();
    } else {
      this.lastSyncAt = null;
      this.cleanupRealtime();
      this.pendingOperations.clear();
    }
  }

  private async setupAuth() {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      this.userId = session?.user?.id || null;

      if (this.userId) {
        this.lastSyncAt = this.getLastSyncTime(this.userId);
      }

      logger.info('[SyncEngine] Auth setup complete, userId:', this.userId);

      // Resolve the auth ready promise
      this.authReadyResolve();

      this.supabase.auth.onAuthStateChange((_event, session) => {
        const newUserId = session?.user?.id || null;
        this.handleAuthStateChange(newUserId);
      });

      if (this.userId) {
        this.setupRealtime();
      }
    } catch (error) {
      this.log('error', 'Failed to setup auth', error);
      // Resolve anyway to prevent hanging
      this.authReadyResolve();
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

  // ===================
  // MIGRATION METHODS
  // ===================

  private async migrateHabitProperties(): Promise<void> {
    if (!this.userId) return;

    this.log('info', '🔧 Starting habit property migration...');

    try {
      const habits = await db.habits.where('userId').equals(this.userId).toArray();
      let fixedCount = 0;

      for (const habit of habits) {
        if (habit.archived === undefined || habit.archived === null) {
          await db.habits.update(habit.id, { archived: false });
          fixedCount++;
        }
      }

      this.log('info', `✅ Migration complete: Fixed ${fixedCount} habits`);
    } catch (error) {
      this.log('error', `❌ Migration failed: ${error}`);
    }
  }

  async checkAndRunMigrations(): Promise<void> {
    try {
      await this.authReady;
      if (!this.userId) return;

      const storageKey = `sync_version_${this.userId}`;
      const currentVersion = localStorage.getItem(storageKey);

      if (currentVersion !== SYNC_VERSION) {
        this.log('info', `🔄 Version mismatch (${currentVersion} → ${SYNC_VERSION}), running migrations...`);
        await this.migrateHabitProperties();
        localStorage.setItem(storageKey, SYNC_VERSION);
        this.log('info', `✅ Migrations complete, version updated to ${SYNC_VERSION}`);
      } else {
        this.log('info', `✅ Sync version ${SYNC_VERSION} matches, skipping migrations`);
      }
    } catch (error) {
      this.log('error', 'Migration run failed', error);
    }
  }

  private savePendingOperations() {
    if (typeof localStorage === 'undefined') return;
    const operations = Array.from(this.pendingOperations.values());
    localStorage.setItem('habit_sync_pending', JSON.stringify(operations));
  }

  public log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    const prefix = `[SyncEngine]`;
    const timestamp = new Date().toISOString();

    if (level === 'error') {
      logger.error(`${prefix} ${timestamp} - ${message}`, data || '');
      const store = useSyncStatusStore.getState();
      store.setSyncError(`${message} ${data ? JSON.stringify(data) : ''}`);
    } else if (level === 'warn') {
      logger.warn(`${prefix} ${timestamp} - ${message}`, data || '');
    } else {
      logger.info(`${prefix} ${timestamp} - ${message}`, data || '');
    }
  }

  onSyncStatusChange(callback: (status: SyncStatus) => void) {
    this.syncCallbacks.push(callback);
    return () => {
      this.syncCallbacks = this.syncCallbacks.filter(cb => cb !== callback);
    };
  }

  public notifyStatus(status: SyncStatus) {
    this.syncCallbacks.forEach(cb => {
      try {
        cb(status);
      } catch (e) {
        logger.error('Error in sync status callback', e);
      }
    });

    try {
      const store = useSyncStatusStore.getState();
      if (status.type === 'syncing') {
        store.setIsSyncing(true);
        if (status.message) store.setSyncError(null);
      } else if (status.type === 'success') {
        store.setIsSyncing(false);
        store.setLastSyncTime(status.syncedAt || new Date());
        store.setSyncError(null);
      } else if (status.type === 'error') {
        store.setIsSyncing(false);
        store.setSyncError(status.message);
      } else if (status.type === 'idle') {
        store.setIsSyncing(false);
      }
    } catch (error) {
      logger.warn('Failed to update sync status store', error);
    }
  }

  // ===================
  // MAIN SYNC FUNCTIONS
  // ===================

  async syncAll(): Promise<void> {
    await this.authReady;

    if (!this.userId) {
      this.log('warn', '- Sync skipped - no user (after auth ready)');
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
      await this.processPendingOperations();
      this.notifyStatus({ type: 'syncing', message: 'Syncing habits...', progress: 20 });

      const results = await Promise.allSettled([
        syncHabitsWithRetry(this),
        syncGoalsWithRetry(this),
        syncTasksWithRetry(this),
        syncRoutinesWithRetry(this),
        syncUserSettingsWithRetry(this),
      ]);

      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        this.log('error', 'Some sync operations failed', failures);
      }

      this.notifyStatus({ type: 'syncing', message: 'Syncing completions...', progress: 50 });

      await Promise.allSettled([
        syncCompletionsWithRetry(this),
        syncMilestonesWithRetry(this),
        syncHabitRoutinesWithRetry(this),
        syncRoutineCompletions(this),
        syncMoodLogsWithRetry(this),
      ]);

      this.notifyStatus({ type: 'syncing', message: 'Cleaning up duplicates...', progress: 80 });

      await this.cleanupLocalDuplicatesWithLogging();

      if (!this.duplicateCleanupInterval && typeof window !== 'undefined') {
        this.duplicateCleanupInterval = setInterval(() => {
          this.cleanupLocalDuplicatesQuietly();
        }, 30000);
        this.log('info', '🔄 Periodic duplicate cleanup started (every 30s)');
      }

      this.lastSyncAt = new Date();
      if (this.userId && typeof localStorage !== 'undefined') {
        localStorage.setItem(`habit_sync_last_at_${this.userId}`, this.lastSyncAt.toISOString());
      }
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

  public async withRetry<T>(
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

  public async processPendingOperations() {
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

  public queueOperation(op: Omit<PendingOperation, 'id' | 'timestamp' | 'retryCount'>) {
    const operation: PendingOperation = {
      ...op,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.pendingOperations.set(operation.id, operation);
    this.savePendingOperations();

    if (this.isOnline && !this.isSyncing) {
      this.processPendingOperations();
    }
  }

  // ===================
  // PUBLIC CLIENT API
  // ===================

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
          is_quantitative: habit.isQuantitative || false,
          target_value: habit.targetValue || 0,
          unit: habit.unit || '',
        },
      });
      return;
    }

    await pushHabitToRemote(this, habit);
  }

  async archiveHabit(habitId: string) {
    if (!this.userId) return;

    const now = new Date().toISOString();

    if (!this.isOnline) {
      this.queueOperation({
        type: 'update',
        table: 'habits',
        data: {
          id: habitId,
          user_id: this.userId,
          is_archived: true,
          archived_at: now,
          updated_at: now,
        },
      });
      return;
    }

    const { error } = await (this.supabase.from('habits') as any).update({
      is_archived: true,
      updated_at: now,
    } as any).eq('id', habitId).eq('user_id', this.userId);

    if (error) throw error;
  }

  async deleteHabit(habitId: string) {
    if (!this.userId) return;

    const now = new Date().toISOString();

    if (!this.isOnline) {
      this.queueOperation({
        type: 'update',
        table: 'habits',
        data: {
          id: habitId,
          user_id: this.userId,
          is_archived: true,
          archived_at: now,
          updated_at: now,
        },
      });
      return;
    }

    const { error } = await (this.supabase.from('habits') as any).update({
      is_archived: true,
      updated_at: now,
    } as any).eq('id', habitId).eq('user_id', this.userId);

    if (error) throw error;
  }

  async pushCompletion(completion: HabitCompletion) {
    if (!this.userId) return;

    const data = {
      id: completion.id,
      user_id: this.userId,
      habit_id: completion.habitId,
      date: completion.date,
      completed: completion.completed,
      status: completion.status || 'completed',
      notes: completion.note || null,
      value: completion.value || 0,
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

    await pushGoalToRemote(this, goal);
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

    await this.supabase.from('milestones').delete().eq('goal_id', goalId);
    await this.supabase.from('goals').delete().eq('id', goalId);
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

  async pushTask(task: any) {
    if (!this.userId) return;

    if (!this.isOnline) {
      this.queueOperation({
        type: 'update',
        table: 'tasks' as any,
        data: {
          ...task,
          user_id: this.userId,
        },
      });
      return;
    }

    await pushTaskToRemote(this, task);
  }

  async deleteTask(taskId: string) {
    if (!this.userId) return;

    if (!this.isOnline) {
      this.queueOperation({
        type: 'delete',
        table: 'tasks' as any,
        data: { id: taskId },
      });
      return;
    }

    await this.supabase.from('tasks').delete().eq('id', taskId);
  }

  async pushUserSettings(settings: any) {
    if (!this.userId) return;

    if (!this.isOnline) {
      this.queueOperation({
        type: 'update',
        table: 'user_settings' as any,
        data: {
          user_id: this.userId,
          user_name: settings.userName,
          avatar_id: settings.avatarId || 'avatar-1',
          week_start_day: settings.weekStartsOn,
          default_category: settings.defaultCategory,
          xp: settings.xp,
          level: settings.level,
          gems: settings.gems,
          streak_shield: settings.streakShield,
          motivation_text: settings.motivation_text,
          updated_at: new Date().toISOString(),
        },
      });
      return;
    }

    await pushUserSettingsToRemote(this, settings);
  }

  async pushMoodLog(log: MoodLog) {
    if (!this.userId) return;

    const data = {
      id: log.id,
      user_id: this.userId,
      date: log.date,
      mood: log.mood,
      updated_at: new Date().toISOString(),
    };

    if (!this.isOnline) {
      this.queueOperation({ type: 'update', table: 'mood_logs', data });
      return;
    }

    await this.supabase.from('mood_logs').upsert(data as any);
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
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${this.userId}` },
        () => this.debouncedSync('tasks')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'milestones', filter: `user_id=eq.${this.userId}` },
        () => this.debouncedSync('milestones')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'routines', filter: `user_id=eq.${this.userId}` },
        () => this.debouncedSync('routines')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_settings', filter: `user_id=eq.${this.userId}` },
        () => this.debouncedSync('user_settings')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'habit_routines' },
        () => this.debouncedSync('habit_routines')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'routine_completions', filter: `user_id=eq.${this.userId}` },
        () => this.debouncedSync('routine_completions')
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
            await syncHabitsWithRetry(this);
            break;
          case 'completions':
            await syncCompletionsWithRetry(this);
            break;
          case 'goals':
            await syncGoalsWithRetry(this);
            break;
          case 'tasks':
            await syncTasksWithRetry(this);
            break;
          case 'milestones':
            await syncMilestonesWithRetry(this);
            break;
          case 'routines':
            await syncRoutinesWithRetry(this);
            break;
          case 'user_settings':
            await syncUserSettingsWithRetry(this);
            break;
          case 'habit_routines':
            await syncHabitRoutinesWithRetry(this);
            break;
          case 'routine_completions':
            await syncRoutineCompletions(this);
            break;
          case 'mood_logs':
            await syncMoodLogsWithRetry(this);
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

  public getStartDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - SYNC_WINDOW_DAYS);
    return date.toISOString().split('T')[0];
  }

  public async batchUpsert(table: string, items: any[]) {
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const { error } = await this.supabase.from(table).upsert(batch as any);
      if (error) {
        this.log('error', `Batch upsert failed for ${table}: ${error.message}`, {
          code: error.code,
          details: error.details,
          hint: error.hint,
          batchSize: batch.length
        });
        throw error;
      }
    }
  }

  private async cleanupLocalDuplicates() {
    if (!this.userId) return;

    try {
      const habits = await db.habits.where('userId').equals(this.userId).toArray();
      const habitKeys = new Map<string, Habit>();

      for (const habit of habits) {
        const key = `${habit.name.toLowerCase()}-${habit.category}`;
        const existing = habitKeys.get(key);

        if (existing) {
          const keepHabit = new Date(habit.createdAt) < new Date(existing.createdAt) ? habit : existing;
          const deleteHabit = keepHabit === habit ? existing : habit;

          this.log('info', `Cleaning up duplicate habit: ${deleteHabit.name}`);

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

      await cleanupDuplicateGoals();
      await cleanupDuplicateCompletions();
    } catch (error) {
      this.log('error', 'Cleanup failed', error);
    }
  }

  private async cleanupLocalDuplicatesWithLogging() {
    if (!this.userId) return;

    try {
      const before = await countAllDuplicates();

      await cleanupDuplicateCompletions();
      await cleanupDuplicateGoals();
      await cleanupDuplicateHabits();

      const after = await countAllDuplicates();

      if (before.completions > 0 || before.habits > 0 || before.goals > 0) {
        this.log('warn', `🧹 Cleaned duplicates: ${before.completions} completions, ${before.habits} habits, ${before.goals} goals`);
      }
    } catch (error) {
      this.log('error', 'Cleanup with logging failed', error);
    }
  }

  private async cleanupLocalDuplicatesQuietly() {
    try {
      await this.cleanupLocalDuplicatesWithLogging();
    } catch (error) {
      logger.error('[SyncEngine] Auto-cleanup failed:', error);
    }
  }

  public deduplicateByKey<T extends { updatedAt?: string; createdAt?: string }>(
    items: T[],
    keyFn: (item: T) => string
  ): T[] {
    const seen = new Map<string, T>();

    for (const item of items) {
      const key = keyFn(item);
      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, item);
      } else {
        const itemTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
        const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();

        if (itemTime > existingTime) {
          seen.set(key, item);
        }
      }
    }

    return Array.from(seen.values());
  }

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

  public reset() {
    this.cleanupRealtime();
    this.pendingOperations.clear();
    if (this.duplicateCleanupInterval) {
      clearInterval(this.duplicateCleanupInterval);
      this.duplicateCleanupInterval = null;
    }
    this.lastSyncAt = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('habit_sync_pending');
    }
    this.log('info', '🔄 SyncEngine reset. Cleared in-memory queues and unsubscribed realtime.');
  }
}

let syncEngine: SyncEngine | null = null;

export function getSyncEngine(): SyncEngine {
  if (!syncEngine) {
    syncEngine = new SyncEngine();
  }
  return syncEngine;
}
