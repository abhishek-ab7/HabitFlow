/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import type { ISynchronizer } from '../types';
import type { SyncEngine } from '../sync-engine';
import {
  deduplicateFinanceRecordsInDexie,
  syncCategories,
  syncAccounts,
  syncCreditCardStatements,
  syncBudgets,
  syncCommitments,
  syncDebts,
  syncInstallments,
  syncEmis,
  syncSips,
  syncRecurringBills,
  syncTransactions,
  syncCategorizationRules,
  syncNetWorthSnapshots,
} from './finance';

export { deduplicateFinanceRecordsInDexie } from './finance';

/**
 * FinanceSyncEngine synchronizes FlowFinance V2 tables between Dexie (local IndexedDB)
 * and Supabase PostgreSQL with two-way push + pull, generationCounter conflict resolution,
 * and soft-delete tombstones (deletedAt).
 */
export class FinanceSyncEngine implements ISynchronizer {
  readonly domainName = 'Finance';

  /**
   * Automatically migrates orphaned local-demo-user records in Dexie
   * to the authenticated user ID using indexed userId queries (O(k) where k = orphans).
   */
  public async migrateOrphanedRecords(userId: string): Promise<number> {
    if (!userId || userId === 'local-demo-user') return 0;
    const demoUserId = 'local-demo-user';
    const tables: any[] = [
      db.financeCategories,
      db.financeAccounts,
      db.financeTransactions,
      db.financeBudgets,
      db.monthlyCommitments,
      db.debtRecords,
      db.debtInstallments,
      db.emiTrackers,
      ...(db.financeSipPlans ? [db.financeSipPlans] : []),
      ...(db.financeCategorizationRules ? [db.financeCategorizationRules] : []),
      ...(db.financeRecurringBills ? [db.financeRecurringBills] : []),
      ...(db.financeNetWorthSnapshots ? [db.financeNetWorthSnapshots] : []),
      ...(db.creditCardStatements ? [db.creditCardStatements] : []),
    ];

    let count = 0;
    const now = new Date().toISOString();
    await Promise.all(
      tables.map(async (table) => {
        try {
          const stranded = await table.where('userId').equals(demoUserId).toArray();
          if (stranded.length > 0) {
            await db.transaction('rw', table, async () => {
              await Promise.all(
                stranded.map((item: any) =>
                  table.update(item.id, {
                    userId,
                    isDirty: true,
                    generationCounter: (item.generationCounter || 1) + 1,
                    updatedAt: now,
                  })
                )
              );
            });
            count += stranded.length;
          }
        } catch (err) {
          logger.warn('[FinanceSyncEngine] Error migrating orphaned records in table', err);
        }
      })
    );
    return count;
  }

  async sync(userId: string): Promise<{ pushed: number; pulled: number; status: 'success' | 'partial_failure' }> {
    const supabase = getSupabaseClient();
    let pushed = 0;
    let pulled = 0;
    let hasError = false;

    // Auto-claim any stranded records created offline or before auth was completed
    await this.migrateOrphanedRecords(userId);

    // Clean up any duplicate categories or accounts before syncing
    await deduplicateFinanceRecordsInDexie(userId);

    const applyStep = (res: { pushed: number; pulled: number; hasError: boolean }) => {
      pushed += res.pushed;
      pulled += res.pulled;
      if (res.hasError) hasError = true;
    };

    // Tier 1: Root entities (Categories, Accounts, Commitments, Debts)
    const tier1 = await Promise.all([
      syncCategories(supabase, userId),
      syncAccounts(supabase, userId),
      syncCommitments(supabase, userId),
      syncDebts(supabase, userId),
    ]);
    tier1.forEach(applyStep);

    // Tier 2: Secondary entities depending on Accounts/Debts
    const tier2 = await Promise.all([
      syncCreditCardStatements(supabase, userId),
      syncInstallments(supabase, userId),
      syncEmis(supabase, userId),
      syncSips(supabase, userId),
      syncBudgets(supabase, userId),
    ]);
    tier2.forEach(applyStep);

    // Tier 3: Transactions & standalone trackers depending on Statements/Installments/EMIs/SIPs
    const tier3 = await Promise.all([
      syncTransactions(supabase, userId),
      syncCategorizationRules(supabase, userId),
      syncRecurringBills(supabase, userId),
      syncNetWorthSnapshots(supabase, userId),
    ]);
    tier3.forEach(applyStep);

    // Run local deduplication to ensure any duplicate slugs or accounts in Dexie are merged
    await deduplicateFinanceRecordsInDexie(userId);

    if (pulled > 0) {
      try {
        const { useFinanceStore } = await import('@/lib/stores/finance-store');
        await useFinanceStore.getState().loadFinanceData(userId, true);
      } catch {
        // Non-fatal
      }
    }

    logger.info('[FinanceSyncEngine] Completed FlowFinance V2 two-way sync cycle');
    return {
      pushed,
      pulled,
      status: hasError ? 'partial_failure' : 'success',
    };
  }
}

export async function syncFinanceWithRetry(engine: SyncEngine): Promise<void> {
  if (!engine.userId) return;
  const syncer = new FinanceSyncEngine();
  await syncer.migrateOrphanedRecords(engine.userId);
  await engine.withRetry(() => syncer.sync(engine.userId!), 'syncFinance');
  try {
    const { useFinanceStore } = await import('@/lib/stores/finance-store');
    await useFinanceStore.getState().loadFinanceData(engine.userId);
  } catch (err) {
    logger.warn('[FinanceSyncEngine] Failed to refresh store after sync', err);
  }
}
