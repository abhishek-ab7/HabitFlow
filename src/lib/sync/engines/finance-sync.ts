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
   * Automatically migrates orphaned local-demo-user or unassigned records in Dexie
   * to the authenticated user ID before synchronizing.
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
    for (const table of tables) {
      try {
        const stranded = await table
          .filter((item: any) => !item.userId || item.userId === demoUserId)
          .toArray();
        for (const item of stranded) {
          await table.update(item.id, {
            userId,
            isDirty: true,
            generationCounter: (item.generationCounter || 1) + 1,
            updatedAt: now,
          });
          count++;
        }
      } catch (err) {
        logger.warn('[FinanceSyncEngine] Error migrating orphaned records in table', err);
      }
    }
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

    // 1. Categories
    applyStep(await syncCategories(supabase, userId));

    // 2. Accounts
    applyStep(await syncAccounts(supabase, userId));

    // 2b. Credit Card Statements (MUST run after accounts and BEFORE transactions so paid_statement_id FK exists)
    applyStep(await syncCreditCardStatements(supabase, userId));

    // 3. Monthly Commitments
    applyStep(await syncCommitments(supabase, userId));

    // 4. Debt Records
    applyStep(await syncDebts(supabase, userId));

    // 5. Debt Installments
    applyStep(await syncInstallments(supabase, userId));

    // 6. EMI Trackers
    applyStep(await syncEmis(supabase, userId));

    // 6b. SIP Plans (MUST run before transactions so linked_sip_id FK exists when syncing offline creations)
    applyStep(await syncSips(supabase, userId));

    // 7. Finance Transactions (FKs depend on Accounts, Statements, Commitments, Debts, Installments, EMIs, SIPs)
    applyStep(await syncTransactions(supabase, userId));

    // 8. Finance Budgets
    applyStep(await syncBudgets(supabase, userId));

    // 9. V2 Trackers: Rules, Recurring Bills, Net Worth Snapshots
    applyStep(await syncCategorizationRules(supabase, userId));
    applyStep(await syncRecurringBills(supabase, userId));
    applyStep(await syncNetWorthSnapshots(supabase, userId));

    // Run local deduplication to ensure any duplicate slugs or accounts in Dexie are merged
    await deduplicateFinanceRecordsInDexie(userId);

    if (pulled > 0) {
      try {
        const { useFinanceStore } = await import('@/lib/stores/finance-store');
        await useFinanceStore.getState().loadFinanceData(userId);
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
