/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSupabaseClient } from '@/lib/supabase/client';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import type { Habit, HabitCompletion, Goal, Milestone, MoodLog } from '@/lib/types';
import { useSyncStatusStore } from '../stores/sync-status-store';
import { logger } from '@/lib/logger';

// Engines imports
import { SyncCoordinator } from './sync-coordinator';
import { HabitsSyncEngine, CompletionsSyncEngine, syncHabitsWithRetry, syncCompletionsWithRetry, pushHabitToRemote } from './engines/habits-sync';
import { GoalsSyncEngine, syncGoalsWithRetry, pushGoalToRemote } from './engines/goals-sync';
import { TasksSyncEngine, syncTasksWithRetry, pushTaskToRemote } from './engines/tasks-sync';
import { MilestonesSyncEngine, syncMilestonesWithRetry } from './engines/milestones-sync';
import { UserSettingsSyncEngine, MoodLogsSyncEngine, syncUserSettingsWithRetry, syncMoodLogsWithRetry, pushUserSettingsToRemote } from './engines/settings-sync';
import { FinanceSyncEngine, syncFinanceWithRetry } from './engines/finance-sync';
import { FitnessSyncEngine, syncFitnessWithRetry } from './engines/fitness-sync';
import { upsertRowsWithColumnFallback } from './engines/column-fallback';
import {
  isFinanceRealtimeTable,
  isFitnessRealtimeTable,
  reloadRealtimeStores,
  subscribeRealtimeTables,
} from './engine-helpers/realtime-registrar';
import { refreshStoresAfterSync } from './engine-helpers/post-sync-refresh';
import {
  buildCompletionSyncData,
  buildOfflineGoalData,
  buildOfflineHabitData,
  buildOfflineSettingsData,
  executeRemoteOperation,
} from './engine-helpers/push-helpers';
import { cleanupLocalDuplicatesWithReport } from './engine-helpers/duplicate-cleanup';
import {
  resolveSessionUserId,
  runTriggeredFinanceSync,
  runTriggeredFitnessSync,
} from './engine-helpers/domain-trigger';
import {
  attachNetworkListeners,
  initializeAuthSession,
  migrateHabitArchivedProperty,
} from './engine-helpers/lifecycle-listeners';

export type SyncTableName = string;
export type SyncRecordId = string;
export type SyncUserId = string;

const syncTableMap: Record<string, (engine: SyncEngine) => Promise<any>> = {
  habits: syncHabitsWithRetry,
  completions: syncCompletionsWithRetry,
  goals: syncGoalsWithRetry,
  tasks: syncTasksWithRetry,
  milestones: syncMilestonesWithRetry,
  user_settings: syncUserSettingsWithRetry,
  mood_logs: syncMoodLogsWithRetry,
  finance_transactions: syncFinanceWithRetry,
  finance_accounts: syncFinanceWithRetry,
  finance_categories: syncFinanceWithRetry,
  monthly_commitments: syncFinanceWithRetry,
  debt_records: syncFinanceWithRetry,
  debt_installments: syncFinanceWithRetry,
  emi_trackers: syncFinanceWithRetry,
  finance_budgets: syncFinanceWithRetry,
  finance_sip_plans: syncFinanceWithRetry,
  finance_categorization_rules: syncFinanceWithRetry,
  finance_recurring_bills: syncFinanceWithRetry,
  finance_net_worth_snapshots: syncFinanceWithRetry,
  credit_card_statements: syncFinanceWithRetry,
  fitness_profiles: syncFitnessWithRetry,
  fitness_daily_logs: syncFitnessWithRetry,
  meal_templates: syncFitnessWithRetry,
  meal_logs: syncFitnessWithRetry,
  workout_sessions: syncFitnessWithRetry,
  supplement_inventory: syncFitnessWithRetry,
  supplement_logs: syncFitnessWithRetry,
};

export type SyncStatus =
  | { type: 'idle'; message?: string }
  | { type: 'syncing'; message: string; progress?: number }
  | { type: 'success'; message: string; syncedAt?: Date }
  | { type: 'error'; message: string; retryable?: boolean };

export interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  table:
    | 'habits'
    | 'completions'
    | 'goals'
    | 'milestones'
    | 'tasks'
    | 'user_settings'
    | 'mood_logs'
    | 'finance_categories'
    | 'finance_accounts'
    | 'finance_transactions'
    | 'finance_budgets'
    | 'monthly_commitments'
    | 'debt_records'
    | 'debt_installments'
    | 'emi_trackers'
    | 'finance_sip_plans'
    | 'finance_categorization_rules'
    | 'finance_recurring_bills'
    | 'fitness_profiles'
    | 'fitness_daily_logs'
    | 'meal_templates'
    | 'meal_logs'
    | 'workout_sessions'
    | 'supplement_inventory'
    | 'supplement_logs';
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
  public goalSyncLock = false;
  public milestoneSyncLock = false;

  // Auth listener & network listener cleanup
  private authSubscription: { unsubscribe: () => void } | null = null;
  private networkAbortController: AbortController | null = null;
  private lastResumeSyncAt = 0;

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

  private getLastSyncTime(userId: SyncUserId): Date | null {
    if (typeof localStorage === 'undefined') return null;
    const stored = localStorage.getItem(`habit_sync_last_at_${userId}`);
    return stored ? new Date(stored) : null;
  }

  private handleAuthStateChange(newUserId: SyncUserId | null) {
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
    const { userId, subscription } = await initializeAuthSession(
      this.supabase,
      (newUserId) => this.handleAuthStateChange(newUserId),
      this.log.bind(this)
    );
    this.userId = userId;
    if (this.userId) {
      this.lastSyncAt = this.getLastSyncTime(this.userId);
    }
    logger.info('[SyncEngine] Auth setup complete, userId:', this.userId);
    this.authReadyResolve();
    this.authSubscription = subscription;
    if (this.userId) {
      this.setupRealtime();
    }
  }

  private canTriggerResumeSync(): boolean {
    if (!this.isOnline || !this.userId) return false;
    if (this.isSyncing || this.syncLock) return false;
    const now = Date.now();
    if (now - this.lastResumeSyncAt < 60_000) return false;
    this.lastResumeSyncAt = now;
    return true;
  }

  private setupNetworkListeners() {
    if (this.networkAbortController) {
      this.networkAbortController.abort();
    }
    this.networkAbortController = attachNetworkListeners({
      onOnline: () => {
        this.isOnline = true;
        this.log('info', 'Back online, syncing pending changes...');
        void this.syncAll();
      },
      onOffline: () => {
        this.isOnline = false;
        this.log('info', 'Offline mode activated');
        this.notifyStatus({ type: 'idle', message: 'Offline - changes will sync when online' });
      },
      canResumeSync: () => this.canTriggerResumeSync(),
      onResumeSync: () => {
        this.log('info', 'App resumed to foreground, triggering sync...');
        void this.syncAll();
      },
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
    await migrateHabitArchivedProperty(this.userId, this.log.bind(this));
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

  private updateSyncStore(store: any, status: SyncStatus) {
    switch (status.type) {
      case 'syncing':
        store.setIsSyncing(true);
        if (status.message) store.setSyncError(null);
        break;
      case 'success':
        store.setIsSyncing(false);
        store.setLastSyncTime(status.syncedAt || new Date());
        store.setSyncError(null);
        break;
      case 'error':
        store.setIsSyncing(false);
        store.setSyncError(status.message);
        break;
      case 'idle':
        store.setIsSyncing(false);
        break;
    }
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
      this.updateSyncStore(store, status);
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
      
      const coordinator = new SyncCoordinator([
        new HabitsSyncEngine(),
        new CompletionsSyncEngine(),
        new GoalsSyncEngine(),
        new TasksSyncEngine(),
        new MilestonesSyncEngine(),
        new UserSettingsSyncEngine(),
        new MoodLogsSyncEngine(),
        new FinanceSyncEngine(),
        new FitnessSyncEngine(),
      ]);

      this.log('info', 'Executing isolated sync domains via SyncCoordinator...');
      const report = await coordinator.syncAll(this.userId);
      this.log('info', 'Sync coordinator report:', report);

      this.notifyStatus({ type: 'syncing', message: 'Cleaning up duplicates...', progress: 80 });
      await this.cleanupLocalDuplicatesWithLogging();

      this.lastSyncAt = new Date();
      if (this.userId && typeof localStorage !== 'undefined') {
        localStorage.setItem(`habit_sync_last_at_${this.userId}`, this.lastSyncAt.toISOString());
      }

      await refreshStoresAfterSync(report, this.userId, this.log.bind(this));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('habitflow-sync-complete', { detail: report }));
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
    await executeRemoteOperation(this.supabase, op);
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

  private async pushOrQueue(
    table: PendingOperation['table'],
    getOfflineData: () => Record<string, any>,
    pushOnline: () => Promise<void>
  ) {
    if (!this.userId) return;
    if (!this.isOnline) {
      this.queueOperation({ type: 'update', table, data: getOfflineData() });
      return;
    }
    await pushOnline();
  }

  async pushHabit(habit: Habit) {
    await this.pushOrQueue(
      'habits',
      () => buildOfflineHabitData(habit, this.userId!),
      () => pushHabitToRemote(this, habit)
    );
  }

  private async softDeleteHabit(habitId: string) {
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

  private async deleteEntity(table: SyncTableName, id: SyncRecordId) {
    if (!this.userId) return;

    if (!this.isOnline) {
      this.queueOperation({
        type: 'delete',
        table: table as any,
        data: { id },
      });
      return;
    }

    await (this.supabase.from(table as any) as any).delete().eq('id', id);
  }

  async archiveHabit(habitId: SyncRecordId) {
    await this.softDeleteHabit(habitId);
  }

  async deleteHabit(habitId: SyncRecordId) {
    await this.softDeleteHabit(habitId);
  }

  async pushCompletion(completion: HabitCompletion) {
    if (!this.userId) return;

    const data = buildCompletionSyncData(completion, this.userId);

    if (!this.isOnline) {
      this.queueOperation({ type: 'update', table: 'completions', data });
      return;
    }

    await upsertRowsWithColumnFallback(this.supabase, 'completions', data, {
      onConflict: 'habit_id,date',
    });
  }

  async deleteCompletion(completionId: SyncRecordId) {
    await this.deleteEntity('completions', completionId);
  }

  async pushGoal(goal: Goal) {
    await this.pushOrQueue(
      'goals',
      () => buildOfflineGoalData(goal, this.userId!),
      () => pushGoalToRemote(this, goal)
    );
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

  async deleteMilestone(milestoneId: SyncRecordId) {
    await this.deleteEntity('milestones', milestoneId);
  }

  async pushTask(task: any) {
    await this.pushOrQueue(
      'tasks' as any,
      () => ({ ...task, user_id: this.userId }),
      () => pushTaskToRemote(this, task)
    );
  }

  async deleteTask(taskId: SyncRecordId) {
    await this.deleteEntity('tasks' as any, taskId);
  }

  async pushUserSettings(settings: any) {
    await this.pushOrQueue(
      'user_settings' as any,
      () => buildOfflineSettingsData(settings, this.userId!),
      () => pushUserSettingsToRemote(this, settings)
    );
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

    await this.supabase.from('mood_logs').upsert(data as any, { onConflict: 'user_id,date' } as any);
  }

  // ===================
  // REALTIME SYNC
  // ===================

  private setupRealtime() {
    if (!this.userId || this.realtimeChannel) return;

    this.realtimeChannel = subscribeRealtimeTables({
      supabase: this.supabase,
      userId: this.userId,
      onTableChange: (table) => this.debouncedSync(table),
      onStatus: (status) => {
        this.log('info', `Realtime subscription status: ${status}`);
      },
    });
  }

  private pendingRealtimeTables = new Set<string>();

  private async syncPendingRealtimeTables(tablesToSync: string[]) {
    let hasFinanceChange = false;
    let hasFitnessChange = false;
    const ranSyncFns = new Set<(engine: SyncEngine) => Promise<any>>();

    for (const t of tablesToSync) {
      try {
        const syncFn = syncTableMap[t];
        if (syncFn && !ranSyncFns.has(syncFn)) {
          ranSyncFns.add(syncFn);
          await syncFn(this);
        }
        if (isFinanceRealtimeTable(t)) hasFinanceChange = true;
        if (isFitnessRealtimeTable(t)) hasFitnessChange = true;
      } catch (error) {
        this.log('error', `Realtime sync failed for ${t}`, error);
      }
    }

    return { hasFinanceChange, hasFitnessChange };
  }

  private debouncedSync(table: SyncTableName) {
    this.pendingRealtimeTables.add(table);

    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }

    this.syncDebounceTimer = setTimeout(async () => {
      const tablesToSync = Array.from(this.pendingRealtimeTables);
      this.pendingRealtimeTables.clear();

      this.log('info', `Realtime change detected in [${tablesToSync.join(', ')}], syncing...`);

      const flags = await this.syncPendingRealtimeTables(tablesToSync);
      await reloadRealtimeStores(flags, this.userId, this.log.bind(this));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('habitflow-sync-complete'));
      }

      this.notifyStatus({ type: 'success', message: 'Data updated' });
    }, SYNC_DEBOUNCE_MS);
  }

  private financeSyncDebounceTimer: NodeJS.Timeout | null = null;
  private fitnessSyncDebounceTimer: NodeJS.Timeout | null = null;

  private scheduleDomainSync(
    timerKey: 'financeSyncDebounceTimer' | 'fitnessSyncDebounceTimer',
    runner: (userId: string) => Promise<void>
  ): void {
    const existing = this[timerKey];
    if (existing) clearTimeout(existing);

    this[timerKey] = setTimeout(async () => {
      await this.authReady;
      this.userId = await resolveSessionUserId(this.supabase, this.userId);
      if (!this.userId || !this.isOnline) return;
      await runner(this.userId);
    }, 400);
  }

  public triggerFinanceSync(): void {
    this.scheduleDomainSync('financeSyncDebounceTimer', (userId) =>
      runTriggeredFinanceSync(userId, this.log.bind(this))
    );
  }

  public triggerFitnessSync(): void {
    this.scheduleDomainSync('fitnessSyncDebounceTimer', (userId) =>
      runTriggeredFitnessSync(userId, this.log.bind(this))
    );
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
    return getLocalIsoDate(date);
  }

  public async batchUpsert(table: SyncTableName, items: any[]) {
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

  private async cleanupLocalDuplicatesWithLogging() {
    if (!this.userId) return;
    await cleanupLocalDuplicatesWithReport(this.log.bind(this));
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
    this.pendingRealtimeTables.clear();
    if (this.duplicateCleanupInterval) {
      clearInterval(this.duplicateCleanupInterval);
      this.duplicateCleanupInterval = null;
    }
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
      this.syncDebounceTimer = null;
    }
    if (this.financeSyncDebounceTimer) {
      clearTimeout(this.financeSyncDebounceTimer);
      this.financeSyncDebounceTimer = null;
    }
    if (this.fitnessSyncDebounceTimer) {
      clearTimeout(this.fitnessSyncDebounceTimer);
      this.fitnessSyncDebounceTimer = null;
    }
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
      this.authSubscription = null;
    }
    if (this.networkAbortController) {
      this.networkAbortController.abort();
      this.networkAbortController = null;
    }
    this.lastSyncAt = null;
    this.lastResumeSyncAt = 0;
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
