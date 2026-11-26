/* eslint-disable @typescript-eslint/no-explicit-any */
import { useSyncStatusStore } from '@/lib/stores/sync-status-store';
import { FinanceSyncEngine } from '../engines/finance-sync';
import { FitnessSyncEngine } from '../engines/fitness-sync';
import type { SyncLogFn } from './realtime-registrar';

export async function resolveSessionUserId(
  supabase: any,
  currentUserId: string | null
): Promise<string | null> {
  if (currentUserId) return currentUserId;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user?.id || null;
  } catch {
    return null;
  }
}

export async function runTriggeredFinanceSync(userId: string, log: SyncLogFn): Promise<void> {
  try {
    const syncer = new FinanceSyncEngine();
    await syncer.migrateOrphanedRecords(userId);
    const result = await syncer.sync(userId);
    if (result.status === 'success') {
      useSyncStatusStore.getState().setLastSyncTime(new Date());
      useSyncStatusStore.getState().setSyncError(null);
    }
    if (result.pulled > 0) {
      const { useFinanceStore } = await import('@/lib/stores/finance-store');
      await useFinanceStore.getState().loadFinanceData(userId);
    }
  } catch (err) {
    log('warn', 'triggerFinanceSync failed', err);
  }
}

export async function runTriggeredFitnessSync(userId: string, log: SyncLogFn): Promise<void> {
  try {
    const syncer = new FitnessSyncEngine();
    const report = await syncer.sync(userId);
    if (report.errors.length === 0) {
      useSyncStatusStore.getState().setLastSyncTime(new Date());
      useSyncStatusStore.getState().setSyncError(null);
    }
    if (report.pulled > 0) {
      const { useFitnessStore } = await import('@/lib/stores/fitness');
      await useFitnessStore.getState().loadFitnessData(userId);
    }
  } catch (err) {
    log('warn', 'triggerFitnessSync failed', err);
  }
}
