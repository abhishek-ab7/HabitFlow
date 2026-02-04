/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSupabaseClient } from '@/lib/supabase/client';
import { db, cleanupDuplicateGoals, cleanupDuplicateCompletions } from '@/lib/db';
import { countDuplicateCompletions, countDuplicateHabits, countDuplicateGoals, countAllDuplicates } from '@/lib/cleanup';
import type { Habit, HabitCompletion, Goal, Milestone } from '@/lib/types';
import { useSyncStatusStore } from '../stores/sync-status-store';
import { resolveConflict, mergeGamificationFields } from './conflict-resolution';

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
  table: 'habits' | 'completions' | 'goals' | 'milestones' | 'tasks' | 'routines' | 'user_settings' | 'habit_routines';
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

  // Auth ready promise to prevent race conditions
  private authReadyResolve!: () => void;
  public authReady: Promise<void> = new Promise((resolve) => {
    this.authReadyResolve = resolve;
  });

  // Entity-specific sync locks to prevent race conditions
  private habitSyncLock = false;
  private completionSyncLock = false;
  private taskSyncLock = false;
  private routineSyncLock = false;
  private goalSyncLock = false;
  private milestoneSyncLock = false;

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

  private async setupAuth() {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      this.userId = session?.user?.id || null;

      console.log('[SyncEngine] Auth setup complete, userId:', this.userId);

      // Resolve the auth ready promise
      this.authReadyResolve();

      this.supabase.auth.onAuthStateChange((event, session) => {
        const newUserId = session?.user?.id || null;

        if (newUserId !== this.userId) {
          this.userId = newUserId;
          console.log('[SyncEngine] Auth state changed, new userId:', this.userId);

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

    // Update global store
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
      } else {
        store.setIsSyncing(false);
      }
    } catch (e) {
      // Ignore store errors during sync to prevent crash
      console.warn('Failed to update sync store', e);
    }
  }

  // ===================
  // MAIN SYNC FUNCTIONS
  // ===================

  async syncAll(): Promise<void> {
    // Wait for auth to be ready first
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
      // Process any pending operations first
      await this.processPendingOperations();
      this.notifyStatus({ type: 'syncing', message: 'Syncing habits...', progress: 20 });

      // Sync all data types with proper error handling
      const results = await Promise.allSettled([
        this.syncHabitsWithRetry(),
        this.syncGoalsWithRetry(),
        this.syncTasksWithRetry(),
        this.syncRoutinesWithRetry(),
        this.syncUserSettingsWithRetry(), // NEW: Add user settings sync
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
        this.syncHabitRoutinesWithRetry(), // NEW: Add habit-routines junction sync
        this.syncRoutineCompletions(), // NEW: Routine completions sync
      ]);

      this.notifyStatus({ type: 'syncing', message: 'Cleaning up duplicates...', progress: 80 });

      // Cleanup duplicates with logging
      await this.cleanupLocalDuplicatesWithLogging();

      // Start periodic cleanup if not already running
      if (!this.duplicateCleanupInterval && typeof window !== 'undefined') {
        this.duplicateCleanupInterval = setInterval(() => {
          this.cleanupLocalDuplicatesQuietly();
        }, 30000); // Every 30 seconds
        this.log('info', '🔄 Periodic duplicate cleanup started (every 30s)');
      }

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

    // Prevent concurrent syncs
    if (this.habitSyncLock) {
      this.log('warn', 'Habit sync already running, skipping');
      return;
    }

    this.habitSyncLock = true;
    try {
      return await this.syncHabitsImpl();
    } finally {
      this.habitSyncLock = false;
    }
  }

  private async syncHabitsImpl() {
    if (!this.userId) return;

    this.log('info', '🔄 Starting habit sync...');

    // Pull ALL habits from Supabase (including archived for proper merge)
    const { data: remoteHabits, error } = await this.supabase
      .from('habits')
      .select('*')
      .eq('user_id', this.userId);

    if (error) throw error;

    const localHabits = await db.habits.where('userId').equals(this.userId).toArray();

    this.log('info', `📊 Habit counts: Local=${localHabits.length}, Remote=${remoteHabits?.length || 0}`);

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
        // Same ID exists remotely - use conflict resolution based on updatedAt
        processedRemoteIds.add(remoteById_.id);

        const resolution = resolveConflict(
          { ...local, updatedAt: local.updatedAt || local.createdAt },
          { ...remoteById_, updated_at: remoteById_.updated_at, created_at: remoteById_.created_at },
          {}
        );

        if (resolution.winner === 'local') {
          // Local is newer - push to remote (including archived status)
          await this.pushHabitToRemote(local);
          this.log('info', `🔄 Habit conflict (${local.name}): ${resolution.reason}`);
        } else if (resolution.winner === 'remote') {
          // Remote is newer - update local (including archived status)
          await this.updateLocalHabit(remoteById_);
          this.log('info', `🔄 Habit conflict (${local.name}): ${resolution.reason}`);
        }
        // If equal, do nothing (already in sync)
      } else if (remoteByKey_ && remoteByKey_.id !== local.id) {
        // Different ID but same name+category - merge (remote wins for ID)
        processedRemoteIds.add(remoteByKey_.id);
        await this.mergeHabitToRemote(local, remoteByKey_);
      } else {
        // Local only - push to remote (even if archived, for sync)
        await this.pushHabitToRemote(local);
      }
    }

    // Process remote habits not yet seen (pull to local)
    for (const remote of (remoteHabits || []) as any[]) {
      if (!processedRemoteIds.has(remote.id) && !localById.has(remote.id)) {
        // Remote only - pull to local (even if archived)
        await this.updateLocalHabit(remote);
      }
    }

    // Clean up archived habits that have been synced and are old (optional)
    // This permanently removes habits that have been archived for more than 30 days
    await this.cleanupOldArchivedHabits();
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
      // REMOVED: archived_at (column doesn't exist in Supabase)
      order_index: habit.order,
      updated_at: habit.updatedAt || habit.createdAt,
    } as any);

    if (error) throw error;
  }

  private async updateLocalHabit(remote: any) {
    const localHabit: Habit = {
      id: remote.id,
      userId: this.userId || remote.user_id,
      name: remote.name,
      icon: remote.icon || '✓',
      category: remote.category,
      targetDaysPerWeek: remote.target_days || 7,
      archived: remote.is_archived || false,
      archivedAt: remote.archived_at || undefined,
      updatedAt: remote.updated_at || remote.created_at,
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

    // Soft delete - mark as archived (no timestamp since column doesn't exist)
    // @ts-expect-error - Supabase type issue with update
    const { error } = await this.supabase.from('habits').update({
      is_archived: true,
      updated_at: now,
    }).eq('id', habitId).eq('user_id', this.userId);

    if (error) throw error;
  }

  /**
   * Remove habits that have been archived for more than 30 days
   * This helps keep the database clean and performant
   */
  private async cleanupOldArchivedHabits() {
    if (!this.userId) return;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      // Find locally archived habits older than 30 days
      const oldArchivedHabits = await db.habits
        .where('archived')
        .equals(1)
        .and(h => {
          if (!h.archivedAt) return false;
          return new Date(h.archivedAt) < thirtyDaysAgo;
        })
        .toArray();

      if (oldArchivedHabits.length === 0) return;

      // Delete from local DB
      const habitIds = oldArchivedHabits.map(h => h.id);
      await db.habits.bulkDelete(habitIds);

      // Delete from remote
      await this.supabase
        .from('habits')
        .delete()
        .in('id', habitIds)
        .eq('user_id', this.userId);

      // Delete related completions
      await db.completions.where('habitId').anyOf(habitIds).delete();
      await this.supabase
        .from('completions')
        .delete()
        .in('habit_id', habitIds)
        .eq('user_id', this.userId);

      console.log(`Cleaned up ${habitIds.length} old archived habits`);
    } catch (error) {
      console.error('Error cleaning up old archived habits:', error);
    }
  }

  // ===================
  // COMPLETIONS SYNC
  // ===================

  private async syncCompletionsWithRetry() {
    return this.withRetry(() => this.syncCompletions(), 'Completions sync');
  }

  private async syncCompletions() {
    if (!this.userId) return;

    // Prevent concurrent syncs
    if (this.completionSyncLock) {
      this.log('warn', 'Completion sync already running, skipping');
      return;
    }

    this.completionSyncLock = true;
    try {
      return await this.syncCompletionsImpl();
    } finally {
      this.completionSyncLock = false;
    }
  }

  private async syncCompletionsImpl() {
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
      .filter(c => c.userId === this.userId!)
      .toArray();

    this.log('info', `📊 Completions: Local=${localCompletions.length}, Remote=${remoteCompletions?.length || 0}`);

    // Create lookup maps using habitId-date as unique key
    const remoteMap = new Map(
      (remoteCompletions || []).map((c: any) => [`${c.habit_id}-${c.date}`, c])
    );
    const localMap = new Map(
      localCompletions.map(c => [`${c.habitId}-${c.date}`, c])
    );

    // Track IDs we've seen to avoid duplicates
    const processedKeys = new Set<string>();

    // Collect batch operations
    const toInsertRemote: any[] = [];
    const toUpdateRemote: any[] = [];
    const toUpsertLocal: HabitCompletion[] = [];

    // Process local completions
    for (const local of localCompletions) {
      const key = `${local.habitId}-${local.date}`;
      const remote = remoteMap.get(key);

      processedKeys.add(key);

      if (!remote) {
        // Local only - push to remote
        toInsertRemote.push({
          id: local.id,
          user_id: this.userId,
          habit_id: local.habitId,
          date: local.date,
          completed: local.completed,
          notes: local.note || null,
          created_at: new Date().toISOString(),
        });
      } else if (local.completed !== remote.completed || local.note !== remote.notes) {
        // Both exist but differ - use intelligent conflict resolution
        const resolution = resolveConflict(
          {
            ...local,
            updatedAt: local.updatedAt || local.createdAt,
            completed: local.completed
          },
          {
            ...remote,
            updated_at: remote.updated_at,
            created_at: remote.created_at,
            completed: remote.completed
          },
          { preferCompleted: true } // Completed always wins
        );

        if (resolution.winner === 'local') {
          // Local wins - push to remote
          toUpdateRemote.push({
            id: remote.id, // Keep remote ID to update
            user_id: this.userId,
            habit_id: local.habitId,
            date: local.date,
            completed: local.completed,
            notes: local.note || null,
            updated_at: new Date().toISOString(),
          });
          this.log('info', `🔄 Completion conflict (${local.habitId} on ${local.date}): ${resolution.reason}`);
        } else if (resolution.winner === 'remote') {
          // Remote wins - pull to local
          toUpsertLocal.push({
            id: remote.id,
            userId: this.userId || remote.user_id,
            habitId: remote.habit_id,
            date: remote.date,
            completed: remote.completed,
            note: remote.notes || undefined,
            updatedAt: remote.updated_at,
            createdAt: remote.created_at,
          });
          this.log('info', `🔄 Completion conflict (${local.habitId} on ${local.date}): ${resolution.reason}`);
        }
        // If 'equal', do nothing - already in sync
      }
    }

    // Pull remote completions that don't exist locally
    for (const remote of (remoteCompletions || []) as any[]) {
      const key = `${remote.habit_id}-${remote.date}`;

      if (!processedKeys.has(key) && !localMap.has(key)) {
        toUpsertLocal.push({
          id: remote.id,
          userId: this.userId || remote.user_id,
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
      this.log('info', `✅ Pushed ${toInsertRemote.length} new completions to remote`);
    }

    if (toUpdateRemote.length > 0) {
      await this.batchUpsert('completions', toUpdateRemote);
      this.log('info', `✅ Updated ${toUpdateRemote.length} completions on remote (conflict resolution)`);
    }

    if (toUpsertLocal.length > 0) {
      // DEDUP before writing to prevent duplicates
      const dedupedCompletions = this.deduplicateByKey(
        toUpsertLocal,
        (c) => `${c.habitId}-${c.date}`
      );

      // Use transaction with existence checks for atomicity
      await db.transaction('rw', db.completions, async () => {
        for (const completion of dedupedCompletions) {
          const existing = await db.completions
            .where('[habitId+date]')
            .equals([completion.habitId, completion.date])
            .first();

          if (existing) {
            // Update only if remote is newer
            const shouldUpdate = (completion.updatedAt || completion.createdAt || '') >
              (existing.updatedAt || existing.createdAt || '');
            if (shouldUpdate) {
              await db.completions.update(existing.id, completion);
            }
          } else {
            await db.completions.add(completion);
          }
        }
      });

      this.log('info', `✅ Pulled ${dedupedCompletions.length} completions (deduped from ${toUpsertLocal.length})`);
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

    // Prevent concurrent syncs
    if (this.goalSyncLock) {
      this.log('warn', 'Goal sync already running, skipping');
      return;
    }

    this.goalSyncLock = true;
    try {
      return await this.syncGoalsImpl();
    } finally {
      this.goalSyncLock = false;
    }
  }

  private async syncGoalsImpl() {
    if (!this.userId) return;

    this.log('info', '🔄 Syncing goals from Supabase...');

    const { data: remoteGoals, error } = await this.supabase
      .from('goals')
      .select('*')
      .eq('user_id', this.userId);

    if (error) throw error;

    const localGoals = await db.goals.where('userId').equals(this.userId).toArray();

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

        // Use conflict resolution with "completed status wins"
        const resolution = resolveConflict(
          { ...local, updatedAt: local.updatedAt || local.createdAt },
          { ...remoteById_ },
          { completedStatuses: ['completed'] }
        );

        if (resolution.winner === 'local') {
          await this.pushGoalToRemote(local);
          this.log('info', `🔄 Goal conflict (${local.title}): ${resolution.reason}`);
        } else if (resolution.winner === 'remote') {
          await this.updateLocalGoal(remoteById_);
          this.log('info', `🔄 Goal conflict (${local.title}): ${resolution.reason}`);
        }
        // If 'equal', do nothing - already in sync
      } else if (remoteByTitle_ && remoteByTitle_.id !== local.id) {
        processedRemoteIds.add(remoteByTitle_.id);
        await this.mergeGoalToRemote(local, remoteByTitle_);
      } else if (!local.archived) {
        await this.pushGoalToRemote(local);
        // Mark as processed to prevent duplicate pull
        processedRemoteIds.add(local.id);
      }
    }

    // FIXED: Only pull remote goals that haven't been processed AND don't exist locally
    for (const remote of (remoteGoals || []) as any[]) {
      if (!processedRemoteIds.has(remote.id) && !localById.has(remote.id) && !remote.is_archived) {
        await this.updateLocalGoal(remote);
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
      userId: this.userId || remote.user_id,
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

    // Prevent concurrent syncs
    if (this.milestoneSyncLock) {
      this.log('warn', 'Milestone sync already running, skipping');
      return;
    }

    this.milestoneSyncLock = true;
    try {
      return await this.syncMilestonesImpl();
    } finally {
      this.milestoneSyncLock = false;
    }
  }

  private async syncMilestonesImpl() {
    if (!this.userId) return;

    const { data: remoteMilestones, error } = await this.supabase
      .from('milestones')
      .select('*')
      .eq('user_id', this.userId);

    if (error) throw error;

    const localMilestones = await db.milestones.toArray();
    const remoteMap = new Map((remoteMilestones || []).map((m: any) => [m.id, m]));
    const localMap = new Map(localMilestones.map(m => [m.id, m]));

    // Collect batch operations
    const toInsertRemote: any[] = [];
    const toUpdateRemote: any[] = [];
    const toUpsertLocal: Milestone[] = [];

    // Process local milestones
    for (const local of localMilestones) {
      const remote = remoteMap.get(local.id);

      if (!remote) {
        // Local only - push to remote
        toInsertRemote.push({
          id: local.id,
          user_id: this.userId,
          goal_id: local.goalId,
          title: local.title,
          is_completed: local.completed,
          completed_at: local.completedAt,
          order_index: local.order,
          updated_at: new Date().toISOString(),
        });
      } else if (local.completed !== remote.is_completed || local.title !== remote.title) {
        // Both exist but differ - use conflict resolution with "completed always wins"
        const resolution = resolveConflict(
          { ...local, updatedAt: local.updatedAt || local.createdAt },
          {
            ...remote,
            completed: remote.is_completed,
            updated_at: remote.updated_at,
            created_at: remote.created_at
          },
          { preferCompleted: true }
        );

        if (resolution.winner === 'local') {
          toUpdateRemote.push({
            id: remote.id,
            user_id: this.userId,
            goal_id: local.goalId,
            title: local.title,
            is_completed: local.completed,
            completed_at: local.completedAt,
            order_index: local.order,
            updated_at: new Date().toISOString(),
          });
          this.log('info', `🔄 Milestone conflict (${local.title}): ${resolution.reason}`);
        } else if (resolution.winner === 'remote') {
          toUpsertLocal.push({
            id: remote.id,
            userId: this.userId || remote.user_id,
            goalId: remote.goal_id,
            title: remote.title,
            completed: remote.is_completed || false,
            completedAt: remote.completed_at || undefined,
            order: remote.order_index || 0,
            updatedAt: remote.updated_at,
            createdAt: remote.created_at,
          });
          this.log('info', `🔄 Milestone conflict (${local.title}): ${resolution.reason}`);
        }
        // If 'equal', do nothing
      }
    }

    // Execute batch operations
    if (toInsertRemote.length > 0) {
      await this.batchUpsert('milestones', toInsertRemote);
      this.log('info', `✅ Pushed ${toInsertRemote.length} new milestones to remote`);
    }

    if (toUpdateRemote.length > 0) {
      await this.batchUpsert('milestones', toUpdateRemote);
      this.log('info', `✅ Updated ${toUpdateRemote.length} milestones on remote (conflict resolution)`);
    }

    // Pull remote milestones not in local
    for (const remote of (remoteMilestones || []) as any[]) {
      if (!localMap.has(remote.id)) {
        toUpsertLocal.push({
          id: remote.id,
          userId: this.userId || remote.user_id,
          goalId: remote.goal_id,
          title: remote.title,
          completed: remote.is_completed || false,
          completedAt: remote.completed_at || undefined,
          order: remote.order_index || 0,
          updatedAt: remote.updated_at,
          createdAt: remote.created_at,
        });
      }
    }

    if (toUpsertLocal.length > 0) {
      // DEDUP before writing to prevent duplicates
      const dedupedMilestones = this.deduplicateByKey(
        toUpsertLocal,
        (m) => m.id // Milestones have unique IDs
      );

      // Use transaction with existence checks for atomicity
      await db.transaction('rw', db.milestones, async () => {
        for (const milestone of dedupedMilestones) {
          const existing = await db.milestones.get(milestone.id);

          if (existing) {
            // Update only if remote is newer
            const shouldUpdate = (milestone.updatedAt || milestone.createdAt || '') >
              (existing.updatedAt || existing.createdAt || '');
            if (shouldUpdate) {
              await db.milestones.update(milestone.id, milestone);
            }
          } else {
            await db.milestones.add(milestone);
          }
        }
      });

      this.log('info', `✅ Pulled ${dedupedMilestones.length} milestones (deduped from ${toUpsertLocal.length})`);
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
  // TASKS SYNC
  // ===================

  private async syncTasksWithRetry() {
    return this.withRetry(() => this.syncTasks(), 'Tasks sync');
  }

  private async syncTasks() {
    if (!this.userId) return;

    // Prevent concurrent syncs
    if (this.taskSyncLock) {
      this.log('warn', 'Task sync already running, skipping');
      return;
    }

    this.taskSyncLock = true;
    try {
      return await this.syncTasksImpl();
    } finally {
      this.taskSyncLock = false;
    }
  }

  private async syncTasksImpl() {
    if (!this.userId) return;

    this.log('info', '🔄 Syncing tasks from Supabase...');

    const { data: remoteTasks, error } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('user_id', this.userId);

    if (error) throw error;

    const localTasks = await db.tasks.where('userId').equals(this.userId).toArray();
    const remoteById = new Map((remoteTasks || []).map((t: any) => [t.id, t]));
    const localById = new Map(localTasks.map(t => [t.id, t]));

    // Sort tasks by depth to ensure parents sync before children
    const sortedLocalTasks = [...localTasks].sort((a, b) => (a.depth || 0) - (b.depth || 0));

    // Push local tasks not in remote
    const toInsertRemote: any[] = [];
    for (const local of sortedLocalTasks) {
      if (!remoteById.has(local.id)) {
        // If not archived locally, or archived but we want to sync deletion state
        toInsertRemote.push({
          id: local.id,
          user_id: this.userId,
          title: local.title,
          description: local.description,
          status: local.status,
          priority: local.priority,
          due_date: local.due_date,
          goal_id: local.goal_id,
          parent_task_id: local.parentTaskId || null,
          depth: local.depth || 0,
          tags: local.tags,
          created_at: local.created_at,
          updated_at: local.updated_at,
        });
      } else {
        // Exists in remote, use conflict resolution with "done status wins"
        const remote = remoteById.get(local.id);
        const resolution = resolveConflict(
          { ...local, updatedAt: local.updated_at },
          { ...remote, updated_at: remote.updated_at, created_at: remote.created_at },
          { completedStatuses: ['done'] }
        );

        if (resolution.winner === 'local') {
          await this.pushTaskToRemote(local);
          this.log('info', `🔄 Task conflict (${local.title}): ${resolution.reason}`);
        } else if (resolution.winner === 'remote') {
          await this.updateLocalTask(remote);
          this.log('info', `🔄 Task conflict (${local.title}): ${resolution.reason}`);
        }
        // If 'equal', do nothing
      }
    }

    if (toInsertRemote.length > 0) {
      await this.batchUpsert('tasks', toInsertRemote);
    }

    // Pull remote tasks not in local
    const toUpsertLocal: any[] = [];
    for (const remote of (remoteTasks || []) as any[]) {
      if (!localById.has(remote.id)) {
        toUpsertLocal.push(remote);
      }
    }

    if (toUpsertLocal.length > 0) {
      for (const remote of toUpsertLocal) {
        await this.updateLocalTask(remote);
      }
    }
  }

  private async pushTaskToRemote(task: any) {
    if (!this.userId) return;

    await this.supabase.from('tasks').upsert({
      id: task.id,
      user_id: this.userId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      due_date: task.due_date,
      goal_id: task.goal_id,
      parent_task_id: task.parentTaskId || null,
      depth: task.depth || 0,
      tags: task.tags,
      created_at: task.created_at,
      updated_at: task.updated_at,
    } as any);
  }

  private async updateLocalTask(remote: any) {
    await db.tasks.put({
      id: remote.id,
      userId: this.userId!,
      title: remote.title,
      description: remote.description,
      status: remote.status,
      priority: remote.priority,
      due_date: remote.due_date,
      goal_id: remote.goal_id,
      parentTaskId: remote.parent_task_id || null,
      depth: remote.depth || 0,
      tags: remote.tags || [],
      metadata: {},
      created_at: remote.created_at,
      updated_at: remote.updated_at || remote.created_at,
    });
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

    await this.pushTaskToRemote(task);
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

  // ===================
  // ROUTINES SYNC
  // ===================

  private async syncRoutinesWithRetry() {
    return this.withRetry(() => this.syncRoutines(), 'Routines sync');
  }

  private async syncRoutines() {
    if (!this.userId) return;

    // Prevent concurrent syncs
    if (this.routineSyncLock) {
      this.log('warn', 'Routine sync already running, skipping');
      return;
    }

    this.routineSyncLock = true;
    try {
      return await this.syncRoutinesImpl();
    } finally {
      this.routineSyncLock = false;
    }
  }

  private async syncRoutinesImpl() {
    if (!this.userId) return;

    this.log('info', '🔄 Syncing routines from Supabase...');

    const { data: remoteRoutines, error } = await this.supabase
      .from('routines')
      .select('*')
      .eq('user_id', this.userId);

    if (error) throw error;

    const localRoutines = await db.routines.where('userId').equals(this.userId).toArray();

    const remoteById = new Map((remoteRoutines || []).map((r: any) => [r.id, r]));
    const localById = new Map(localRoutines.map(r => [r.id, r]));
    const processedRemoteIds = new Set<string>();

    // Process local routines
    for (const local of localRoutines) {
      const remote = remoteById.get(local.id);

      if (remote) {
        processedRemoteIds.add(remote.id);

        const resolution = resolveConflict(
          { ...local, updatedAt: local.updatedAt || local.createdAt },
          { ...remote, updated_at: remote.updated_at, created_at: remote.created_at },
          {}
        );

        if (resolution.winner === 'local') {
          await this.pushRoutineToRemote(local);
          this.log('info', `🔄 Routine conflict (${local.title}): ${resolution.reason}`);
        } else if (resolution.winner === 'remote') {
          await this.updateLocalRoutine(remote);
          this.log('info', `🔄 Routine conflict (${local.title}): ${resolution.reason}`);
        }
        // If 'equal', do nothing
      } else {
        // Local only - push to remote
        await this.pushRoutineToRemote(local);
      }
    }

    // Process remote routines not yet seen
    for (const remote of (remoteRoutines || []) as any[]) {
      if (!processedRemoteIds.has(remote.id) && !localById.has(remote.id)) {
        await this.updateLocalRoutine(remote);
      }
    }
  }

  private async pushRoutineToRemote(routine: any) {
    if (!this.userId) return;

    await this.supabase.from('routines').upsert({
      id: routine.id,
      user_id: this.userId,
      title: routine.title,
      description: routine.description || null,
      trigger_type: routine.triggerType,
      trigger_value: routine.triggerValue || null,
      is_active: routine.isActive,
      order_index: routine.orderIndex,
      created_at: routine.createdAt,
      updated_at: routine.updatedAt || routine.createdAt,
    } as any);
  }

  private async updateLocalRoutine(remote: any) {
    await db.routines.put({
      id: remote.id,
      userId: this.userId!,
      title: remote.title,
      description: remote.description,
      triggerType: remote.trigger_type,
      triggerValue: remote.trigger_value,
      isActive: remote.is_active,
      orderIndex: remote.order_index,
      createdAt: remote.created_at,
      updatedAt: remote.updated_at || remote.created_at,
    });
  }

  async pushRoutine(routine: any) {
    if (!this.userId) return;

    if (!this.isOnline) {
      this.queueOperation({
        type: 'update',
        table: 'routines' as any,
        data: {
          id: routine.id,
          user_id: this.userId,
          title: routine.title,
          description: routine.description,
          trigger_type: routine.triggerType,
          trigger_value: routine.triggerValue,
          is_active: routine.isActive,
          order_index: routine.orderIndex,
          updated_at: new Date().toISOString(),
        },
      });
      return;
    }

    await this.pushRoutineToRemote(routine);
  }

  async deleteRoutine(routineId: string) {
    if (!this.userId) return;

    if (!this.isOnline) {
      this.queueOperation({
        type: 'delete',
        table: 'routines' as any,
        data: { id: routineId },
      });
      return;
    }

    await this.supabase.from('routines').delete().eq('id', routineId);
  }

  // ===================
  // USER SETTINGS SYNC
  // ===================

  private async syncUserSettingsWithRetry() {
    return this.withRetry(() => this.syncUserSettings(), 'User settings sync');
  }

  private async syncUserSettings() {
    if (!this.userId) return;

    this.log('info', '🔄 Starting user settings sync...');

    // Pull settings from Supabase
    const { data: remoteSettings, error } = await this.supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', this.userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const localSettings = await db.userSettings.where('userId').equals(this.userId).first();

    this.log('info', `📊 Settings: Local=${!!localSettings}, Remote=${!!remoteSettings}`);

    if (!localSettings && !remoteSettings) {
      // No settings anywhere - create defaults locally
      this.log('info', 'Creating default user settings');
      await db.userSettings.add({
        id: crypto.randomUUID(),
        userId: this.userId,
        theme: 'system',
        weekStartsOn: 0,
        showMotivationalQuotes: true,
        defaultCategory: 'health',
        createdAt: new Date().toISOString(),
        xp: 0,
        level: 1,
        gems: 0,
        streakShield: 0,
        avatarId: 'avatar-1',
      });
      return;
    }

    if (!remoteSettings && localSettings) {
      // Local only - push to remote
      await this.pushUserSettingsToRemote(localSettings);
    } else if (remoteSettings && !localSettings) {
      // Remote only - pull to local
      await this.updateLocalUserSettings(remoteSettings);
    } else if (remoteSettings && localSettings) {
      // Both exist - merge gamification fields (highest value wins) and use timestamp for other fields
      this.log('info', '🎮 Both settings exist, merging with conflict resolution...');

      // First, merge gamification fields to ensure highest values
      const mergedGamification = mergeGamificationFields(
        localSettings,
        remoteSettings as any
      );

      // Then use conflict resolution for other fields based on timestamp
      const resolution = resolveConflict(
        { ...localSettings, updatedAt: localSettings.updatedAt || localSettings.createdAt },
        { ...(remoteSettings as any) },
        {}
      );

      // Merge: Take winner's data for non-gamification fields, but always use merged gamification values
      const winner = resolution.winner === 'local' ? localSettings : remoteSettings;
      const finalSettings = {
        ...winner,
        xp: mergedGamification.xp,
        level: mergedGamification.level,
        gems: mergedGamification.gems,
        streakShield: mergedGamification.streakShield,
      };

      // Push merged settings to both local and remote to ensure consistency
      await this.pushUserSettingsToRemote(finalSettings);
      await this.updateLocalUserSettings(finalSettings);

      this.log('info', `🎮 Settings merged: XP=${finalSettings.xp}, Level=${finalSettings.level}, Gems=${finalSettings.gems}, Shield=${finalSettings.streakShield}`);
      this.log('info', `🔄 ${resolution.reason}`);
    }
  }

  private async pushUserSettingsToRemote(settings: any) {
    if (!this.userId) return;

    const { error } = await this.supabase.from('user_settings').upsert({
      user_id: this.userId,
      user_name: settings.userName || null,
      week_start_day: settings.weekStartsOn || 0,
      default_category: settings.defaultCategory || 'health',
      xp: settings.xp || 0,
      level: settings.level || 1,
      gems: settings.gems || 0,
      streak_shield: settings.streakShield || 0,
      updated_at: new Date().toISOString(),
    } as any, {
      onConflict: 'user_id', // CRITICAL: Tell upsert which column to match on
    });

    if (error) {
      this.log('error', '❌ Failed to push user settings to remote', error);
      throw error;
    }
    this.log('info', '✅ User settings pushed to remote');
  }

  private async updateLocalUserSettings(remote: any) {
    const localSettings = {
      id: crypto.randomUUID(),
      userId: this.userId!,
      theme: 'system' as const,
      userName: remote.user_name,
      weekStartsOn: remote.week_start_day || 0,
      showMotivationalQuotes: true,
      defaultCategory: remote.default_category || 'health',
      createdAt: remote.created_at,
      xp: remote.xp || 0,
      level: remote.level || 1,
      gems: remote.gems || 0,
      streakShield: remote.streak_shield || 0,
      avatarId: 'avatar-1',
    };

    // Check if settings exist for this user
    const existing = await db.userSettings.where('userId').equals(this.userId!).first();

    if (existing) {
      await db.userSettings.update(existing.id, localSettings);
    } else {
      await db.userSettings.add(localSettings);
    }

    // Update Zustand gamification store to reflect synced data
    try {
      const { useGamificationStore } = await import('@/lib/stores/gamification-store');
      const store = useGamificationStore.getState();

      // Only update if values have actually changed
      if (store.xp !== localSettings.xp ||
        store.level !== localSettings.level ||
        store.gems !== localSettings.gems ||
        store.streakShield !== localSettings.streakShield) {

        store.loadGamification(); // Reload from IndexedDB
        this.log('info', `🎮 UI updated: XP=${localSettings.xp}, Level=${localSettings.level}, Gems=${localSettings.gems}`);
      }
    } catch (error) {
      this.log('warn', 'Failed to update gamification UI, but data is synced', error);
    }

    this.log('info', '✅ User settings pulled from remote');
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
          week_start_day: settings.weekStartsOn,
          default_category: settings.defaultCategory,
          xp: settings.xp,
          level: settings.level,
          gems: settings.gems,
          streak_shield: settings.streakShield,
          updated_at: new Date().toISOString(),
        },
      });
      return;
    }

    await this.pushUserSettingsToRemote(settings);
  }

  // ===================
  // HABIT-ROUTINES JUNCTION SYNC
  // ===================

  private async syncHabitRoutinesWithRetry() {
    return this.withRetry(() => this.syncHabitRoutines(), 'Habit-routines sync');
  }

  private async syncHabitRoutines() {
    if (!this.userId) return;

    this.log('info', '🔄 Starting habit-routines junction sync...');

    // Get all habit IDs for this user to filter junction table
    const userHabits = await db.habits.where('userId').equals(this.userId).toArray();
    const userHabitIds = userHabits.map(h => h.id);

    if (userHabitIds.length === 0) {
      this.log('info', 'No habits found, skipping habit-routines sync');
      return;
    }

    // Pull junction records from Supabase (filtered by user's habits)
    const { data: remoteLinks, error } = await this.supabase
      .from('habit_routines')
      .select('*')
      .in('habit_id', userHabitIds);

    if (error) throw error;

    const localLinks = await db.habitRoutines.toArray();

    // Filter local links to only those belonging to user's habits
    const userLocalLinks = localLinks.filter(link => userHabitIds.includes(link.habitId));

    this.log('info', `📊 Habit-Routines: Local=${userLocalLinks.length}, Remote=${remoteLinks?.length || 0}`);

    const remoteMap = new Map((remoteLinks || []).map((l: any) => [`${l.habit_id}-${l.routine_id}`, l]));
    const localMap = new Map(userLocalLinks.map(l => [`${l.habitId}-${l.routineId}`, l]));

    // Collect batch operations
    const toInsertRemote: any[] = [];
    const toUpdateRemote: any[] = [];
    const toUpsertLocal: any[] = [];

    // Process local links
    for (const local of userLocalLinks) {
      const key = `${local.habitId}-${local.routineId}`;
      const remote = remoteMap.get(key);

      if (!remote) {
        // Local only - push to remote
        toInsertRemote.push({
          id: local.id,
          habit_id: local.habitId,
          routine_id: local.routineId,
          order_index: local.orderIndex,
          created_at: local.createdAt,
          updated_at: local.updatedAt || local.createdAt,
        });
      } else if (local.orderIndex !== remote.order_index) {
        // Both exist but differ - use conflict resolution
        const resolution = resolveConflict(
          { ...local, updatedAt: local.updatedAt || local.createdAt },
          { ...remote, updated_at: remote.updated_at, created_at: remote.created_at },
          {}
        );

        if (resolution.winner === 'local') {
          toUpdateRemote.push({
            id: remote.id,
            habit_id: local.habitId,
            routine_id: local.routineId,
            order_index: local.orderIndex,
            updated_at: new Date().toISOString(),
          });
          this.log('info', `🔄 Habit-routine conflict (${key}): ${resolution.reason}`);
        } else if (resolution.winner === 'remote') {
          toUpsertLocal.push({
            id: remote.id,
            habitId: remote.habit_id,
            routineId: remote.routine_id,
            orderIndex: remote.order_index || 0,
            createdAt: remote.created_at,
            updatedAt: remote.updated_at,
          });
          this.log('info', `🔄 Habit-routine conflict (${key}): ${resolution.reason}`);
        }
        // If 'equal', do nothing
      }
    }

    if (toInsertRemote.length > 0) {
      await this.batchUpsert('habit_routines', toInsertRemote);
      this.log('info', `✅ Pushed ${toInsertRemote.length} habit-routine links to remote`);
    }

    if (toUpdateRemote.length > 0) {
      await this.batchUpsert('habit_routines', toUpdateRemote);
      this.log('info', `✅ Updated ${toUpdateRemote.length} habit-routine links on remote (conflict resolution)`);
    }

    // Pull remote links not in local
    for (const remote of (remoteLinks || []) as any[]) {
      const key = `${remote.habit_id}-${remote.routine_id}`;
      if (!localMap.has(key)) {
        toUpsertLocal.push({
          id: remote.id,
          habitId: remote.habit_id,
          routineId: remote.routine_id,
          orderIndex: remote.order_index || 0,
          createdAt: remote.created_at,
          updatedAt: remote.updated_at,
        });
      }
    }

    if (toUpsertLocal.length > 0) {
      // DEDUP before writing to prevent duplicates
      const dedupedLinks = this.deduplicateByKey(
        toUpsertLocal,
        (link) => `${link.habitId}-${link.routineId}` // Composite key
      );

      // Use transaction with existence checks for atomicity
      await db.transaction('rw', db.habitRoutines, async () => {
        for (const link of dedupedLinks) {
          const existing = await db.habitRoutines
            .where('[habitId+routineId]')
            .equals([link.habitId, link.routineId])
            .first();

          if (existing) {
            // Update only if remote is newer
            const shouldUpdate = (link.updatedAt || link.createdAt || '') >
              (existing.updatedAt || existing.createdAt || '');
            if (shouldUpdate) {
              await db.habitRoutines.update(existing.id, link);
            }
          } else {
            await db.habitRoutines.add(link);
          }
        }
      });

      this.log('info', `✅ Pulled ${dedupedLinks.length} habit-routine links (deduped from ${toUpsertLocal.length})`);
    }
  }

  async pushHabitRoutine(link: any) {
    if (!this.userId) return;

    const data = {
      id: link.id,
      habit_id: link.habitId,
      routine_id: link.routineId,
      order_index: link.orderIndex,
      created_at: link.createdAt,
    };

    if (!this.isOnline) {
      this.queueOperation({ type: 'update', table: 'habit_routines' as any, data });
      return;
    }

    await this.supabase.from('habit_routines').upsert(data as any);
  }

  async deleteHabitRoutine(linkId: string) {
    if (!this.userId) return;

    if (!this.isOnline) {
      this.queueOperation({
        type: 'delete',
        table: 'habit_routines' as any,
        data: { id: linkId },
      });
      return;
    }

    await this.supabase.from('habit_routines').delete().eq('id', linkId);
  }

  // ==================
  // ROUTINE COMPLETIONS SYNC
  // ==================

  private async syncRoutineCompletions() {
    if (!this.userId) return;

    const { data: remoteCompletions, error } = await this.supabase
      .from('routine_completions')
      .select('*')
      .eq('user_id', this.userId);

    if (error) throw error;

    const localCompletions = await db.routineCompletions.where('userId').equals(this.userId).toArray();
    const remoteById = new Map((remoteCompletions || []).map((c: any) => [c.id, c]));
    const localById = new Map(localCompletions.map(c => [c.id, c]));

    // Push local completions not in remote
    const toInsertRemote: any[] = [];
    for (const local of localCompletions) {
      if (!remoteById.has(local.id)) {
        toInsertRemote.push({
          id: local.id,
          user_id: this.userId,
          routine_id: local.routineId,
          date: local.date,
          completed: local.completed,
          completed_at: local.completedAt,
          notes: local.notes,
          created_at: local.createdAt,
          updated_at: local.updatedAt,
        });
      } else {
        // Conflict resolution: prefer completed = true
        const remote = remoteById.get(local.id);
        const resolution = resolveConflict(
          { ...local, updatedAt: local.updatedAt },
          { ...remote, updated_at: remote.updated_at },
          { preferCompleted: true }
        );

        if (resolution.winner === 'local') {
          await this.pushRoutineCompletionToRemote(local);
        } else if (resolution.winner === 'remote') {
          await this.updateLocalRoutineCompletion(remote);
        }
      }
    }

    if (toInsertRemote.length > 0) {
      await this.batchUpsert('routine_completions', toInsertRemote);
    }

    // Pull remote completions not in local
    for (const remote of (remoteCompletions || []) as any[]) {
      if (!localById.has(remote.id)) {
        await this.updateLocalRoutineCompletion(remote);
      }
    }
  }

  private async pushRoutineCompletionToRemote(completion: any) {
    if (!this.userId) return;

    await this.supabase.from('routine_completions').upsert({
      id: completion.id,
      user_id: this.userId,
      routine_id: completion.routineId,
      date: completion.date,
      completed: completion.completed,
      completed_at: completion.completedAt,
      notes: completion.notes,
      created_at: completion.createdAt,
      updated_at: completion.updatedAt,
    } as any);
  }

  private async updateLocalRoutineCompletion(remote: any) {
    await db.routineCompletions.put({
      id: remote.id,
      userId: this.userId!,
      routineId: remote.routine_id,
      date: remote.date,
      completed: remote.completed,
      completedAt: remote.completed_at,
      notes: remote.notes,
      createdAt: remote.created_at,
      updatedAt: remote.updated_at,
    });
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
          case 'tasks':
            await this.syncTasksWithRetry();
            break;
          case 'milestones':
            await this.syncMilestonesWithRetry();
            break;
          case 'routines':
            await this.syncRoutinesWithRetry();
            break;
          case 'user_settings':
            await this.syncUserSettingsWithRetry();
            break;
          case 'habit_routines':
            await this.syncHabitRoutinesWithRetry();
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
    if (!this.userId) return;

    try {
      // Cleanup duplicate habits (same name + category)
      const habits = await db.habits.where('userId').equals(this.userId).toArray();
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

      // Cleanup duplicate goals
      await cleanupDuplicateGoals();

      // Cleanup duplicate completions
      await cleanupDuplicateCompletions();

      // Cleanup duplicate tasks (same title + created within 1s? or just let ID handle it?)
      // For tasks, duplicates usually come from ID collisions or double creates.
      // We'll rely on ID uniqueness for now, but maybe same title?

    } catch (error) {
      this.log('error', 'Cleanup failed', error);
    }
  }

  private async cleanupLocalDuplicatesWithLogging() {
    if (!this.userId) return;

    try {
      const before = await countAllDuplicates();

      // Run cleanup
      await cleanupDuplicateCompletions();
      await cleanupDuplicateGoals();

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
      // Silent failure - don't interrupt user experience
      if (process.env.NODE_ENV === 'development') {
        console.error('[SyncEngine] Auto-cleanup failed:', error);
      }
    }
  }

  // ===================
  //DEDUPLICATION HELPERS
  // ===================

  /**
   * Generic deduplication helper - keeps the newest item based on updatedAt/createdAt
   */
  private deduplicateByKey<T extends { updatedAt?: string; createdAt?: string }>(
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
        // Keep the newer one
        const itemTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
        const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();

        if (itemTime > existingTime) {
          seen.set(key, item);
        }
      }
    }

    return Array.from(seen.values());
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
