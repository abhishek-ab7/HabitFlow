import { ISynchronizer, SyncReport } from './types';
import { useSyncStatusStore } from '../stores/sync-status-store';
import { logger } from '@/lib/logger';

export class SyncCoordinator {
  private synchronizers: ISynchronizer[] = [];

  constructor(synchronizers: ISynchronizer[]) {
    this.synchronizers = synchronizers;
  }

  public registerSynchronizer(synchronizer: ISynchronizer): void {
    this.synchronizers.push(synchronizer);
  }

  public async syncAll(userId: string | null): Promise<SyncReport> {
    const report: SyncReport = {
      timestamp: new Date().toISOString(),
      globalStatus: 'healthy',
      details: {}
    };

    if (!userId) {
      logger.warn('[SyncCoordinator] Sync skipped: No authenticated user session.');
      report.globalStatus = 'failed';
      return report;
    }

    useSyncStatusStore.getState().setIsSyncing(true);
    let failedDomains = 0;

    // Parallel execution with isolation barriers (independent catch blocks)
    await Promise.all(
      this.synchronizers.map(async (synchronizer) => {
        try {
          logger.info(`[SyncCoordinator] Initializing sync pipeline for domain: ${synchronizer.domainName}`);
          const result = await synchronizer.sync(userId);
          
          report.details[synchronizer.domainName] = {
            status: 'success',
            pushed: result.pushed,
            pulled: result.pulled
          };
        } catch (error: any) {
          failedDomains++;
          logger.error(`[SyncCoordinator] Critical boundary failure inside [${synchronizer.domainName}] domain:`, error);
          
          report.details[synchronizer.domainName] = {
            status: 'failed',
            error: error?.message || 'Unknown synchronization error',
            pushed: 0,
            pulled: 0
          };
        }
      })
    );

    // Evaluate collective degradation metrics
    if (failedDomains === this.synchronizers.length) {
      report.globalStatus = 'failed';
      useSyncStatusStore.getState().setSyncError('Global synchronization pipeline completely failed.');
    } else if (failedDomains > 0) {
      report.globalStatus = 'degraded';
      useSyncStatusStore.getState().setSyncError(`Sync partially completed. Degraded domains: ${failedDomains}`);
    } else {
      useSyncStatusStore.getState().setLastSyncTime(new Date());
      useSyncStatusStore.getState().setSyncError(null);
    }

    useSyncStatusStore.getState().setIsSyncing(false);
    return report;
  }
}
