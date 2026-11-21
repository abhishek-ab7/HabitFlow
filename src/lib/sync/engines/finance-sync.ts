/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import type { ISynchronizer } from '../types';
import type { SyncEngine } from '../sync-engine';

const missingRemoteFinanceTables = new Set<string>();
const missingRemoteFinanceColumns = new Map<string, Set<string>>();

function isMissingRelationError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = `${err.message || ''} ${err.details || ''} ${err.hint || ''}`;
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('Could not find the table') ||
    msg.includes('in the schema cache') ||
    msg.includes('does not exist') ||
    Number(err.status) === 404 ||
    Number(err.statusCode) === 404
  );
}

function getMissingColumnName(err: any): string | null {
  if (!err) return null;
  const msg = `${err.message || ''} ${err.details || ''} ${err.hint || ''}`;
  const m =
    msg.match(/Could not find the ['"]([a-z0-9_]+)['"] column/i) ||
    msg.match(/column\s+["']?([a-z0-9_]+)["']?\s+(?:of|does not exist)/i) ||
    msg.match(/column\s+["']?([a-z0-9_]+)["']?\s+does not exist/i);
  return m ? m[1] : null;
}

function stripKnownMissingColumns(table: string, payload: Record<string, any>): Record<string, any> {
  const cols = missingRemoteFinanceColumns.get(table);
  if (!cols || cols.size === 0) return payload;
  const copy = { ...payload };
  for (const col of cols) delete copy[col];
  return copy;
}

function recordMissingColumn(table: string, col: string) {
  let set = missingRemoteFinanceColumns.get(table);
  if (!set) {
    set = new Set();
    missingRemoteFinanceColumns.set(table, set);
  }
  set.add(col);
  logger.info(`[FinanceSyncEngine] Detected missing remote column '${col}' on table '${table}'. Stripping for subsequent upserts.`);
}

async function upsertWithColumnFallback(
  supabase: any,
  table: string,
  payload: Record<string, any>,
  options?: { onConflict?: string }
): Promise<{ error: any }> {
  let currentPayload = stripKnownMissingColumns(table, payload);
  let result = options?.onConflict
    ? await (supabase.from(table) as any).upsert(currentPayload, options)
    : await (supabase.from(table) as any).upsert(currentPayload);
  let error = result.error;
  let attempts = 0;
  while (
    error &&
    attempts < 8 &&
    ((error as any).code === 'PGRST204' ||
      (error as any).code === '42703' ||
      String(error.message || '').includes('Could not find') ||
      String(error.message || '').includes('does not exist'))
  ) {
    const missingCol = getMissingColumnName(error);
    if (missingCol && Object.prototype.hasOwnProperty.call(currentPayload, missingCol)) {
      recordMissingColumn(table, missingCol);
      currentPayload = stripKnownMissingColumns(table, currentPayload);
      attempts++;
      result = options?.onConflict
        ? await (supabase.from(table) as any).upsert(currentPayload, options)
        : await (supabase.from(table) as any).upsert(currentPayload);
      error = result.error;
    } else {
      break;
    }
  }
  return { error };
}

/**
 * Automatically cleans up any duplicate categories (same slug) or accounts (same name + type)
 * in Dexie IndexedDB for the specified user, remapping any foreign-key transaction references
 * to the canonical record and deleting redundant duplicates.
 */
export async function deduplicateFinanceRecordsInDexie(userId: string): Promise<void> {
  if (!userId) return;

  try {
    // 1. Deduplicate Categories by slug
    const allCats = await db.financeCategories.where('userId').equals(userId).toArray();
    const catsBySlug = new Map<string, typeof allCats>();
    for (const cat of allCats) {
      if (!cat.slug || cat.deletedAt) continue;
      const list = catsBySlug.get(cat.slug) || [];
      list.push(cat);
      catsBySlug.set(cat.slug, list);
    }

    for (const [, catGroup] of catsBySlug) {
      if (catGroup.length <= 1) continue;

      let bestCat = catGroup[0];
      let bestScore = -1;

      for (const cat of catGroup) {
        const txCount = await db.financeTransactions.where('categoryId').equals(cat.id).count();
        const commCount = await db.monthlyCommitments.filter((m) => m.defaultCategoryId === cat.id).count();
        const ruleCount = db.financeCategorizationRules
          ? await db.financeCategorizationRules.where('categoryId').equals(cat.id).count()
          : 0;
        const budgetBonus = (cat.monthlyBudgetLimit || 0) > 0 ? 50 : 0;
        const score = txCount * 10 + commCount * 10 + ruleCount * 10 + budgetBonus;

        if (score > bestScore) {
          bestScore = score;
          bestCat = cat;
        }
      }

      for (const cat of catGroup) {
        if (cat.id === bestCat.id) continue;

        const txs = await db.financeTransactions.where('categoryId').equals(cat.id).toArray();
        for (const tx of txs) {
          await db.financeTransactions.update(tx.id, { categoryId: bestCat.id });
        }

        const comms = await db.monthlyCommitments.filter((m) => m.defaultCategoryId === cat.id).toArray();
        for (const comm of comms) {
          await db.monthlyCommitments.update(comm.id, { defaultCategoryId: bestCat.id });
        }

        if (db.financeCategorizationRules) {
          const rules = await db.financeCategorizationRules.where('categoryId').equals(cat.id).toArray();
          for (const rule of rules) {
            await db.financeCategorizationRules.update(rule.id, { categoryId: bestCat.id });
          }
        }

        await db.financeCategories.delete(cat.id);
      }
    }

    // 2. Deduplicate Accounts by (name, type)
    const allAccs = await db.financeAccounts.where('userId').equals(userId).toArray();
    const accsByKey = new Map<string, typeof allAccs>();
    for (const acc of allAccs) {
      if (!acc.name || acc.deletedAt) continue;
      const key = `${acc.name.trim().toLowerCase()}_${acc.type}`;
      const list = accsByKey.get(key) || [];
      list.push(acc);
      accsByKey.set(key, list);
    }

    for (const [, accGroup] of accsByKey) {
      if (accGroup.length <= 1) continue;

      let bestAcc = accGroup[0];
      let bestScore = -1;

      for (const acc of accGroup) {
        const txCount = await db.financeTransactions.where('accountId').equals(acc.id).count();
        const balanceBonus = Math.abs(acc.balance || 0) > 0 ? 100 : 0;
        const score = txCount * 10 + balanceBonus;

        if (score > bestScore) {
          bestScore = score;
          bestAcc = acc;
        }
      }

      for (const acc of accGroup) {
        if (acc.id === bestAcc.id) continue;

        if ((acc.balance || 0) !== 0 && (bestAcc.balance || 0) === 0) {
          await db.financeAccounts.update(bestAcc.id, { balance: acc.balance });
          bestAcc.balance = acc.balance;
        }

        const txs = await db.financeTransactions.where('accountId').equals(acc.id).toArray();
        for (const tx of txs) {
          await db.financeTransactions.update(tx.id, { accountId: bestAcc.id });
        }

        await db.financeAccounts.delete(acc.id);
      }
    }
  } catch (err) {
    logger.warn('[FinanceSyncEngine] Deduplication error in Dexie:', err);
  }
}

/**
 * FinanceSyncEngine synchronizes FlowFinance V2 tables between Dexie (local IndexedDB)
 * and Supabase PostgreSQL with two-way push + pull, generationCounter conflict resolution,
 * and soft-delete tombstones (deletedAt).
 */
export class FinanceSyncEngine implements ISynchronizer {
  readonly domainName = 'Finance';

  private shouldApplyRemote(local: any | undefined, remote: any): boolean {
    if (!local) return true;
    const remoteGen = Number(remote.generation_counter || 0);
    const localGen = Number(local.generationCounter || 0);
    if (remoteGen > localGen) return true;
    if (remoteGen === localGen && remote.updated_at && local.updatedAt) {
      return new Date(remote.updated_at).getTime() > new Date(local.updatedAt).getTime();
    }
    return false;
  }

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

    // 1. Sync Dirty Local Categories -> Remote
    const dirtyCategories = await db.financeCategories
      .where('userId')
      .equals(userId)
      .filter((c) => c.isDirty !== false)
      .toArray();

    for (const cat of dirtyCategories) {
      const payload = {
        id: cat.id,
        user_id: userId,
        name: cat.name,
        slug: cat.slug,
        type: cat.type,
        icon: cat.icon,
        color: cat.color,
        monthly_budget_limit: Number(cat.monthlyBudgetLimit || 0),
        rollover_enabled: !!cat.rolloverEnabled,
        subcategories: cat.subcategories || [],
        order_index: cat.order ?? 0,
        is_system: !!cat.isSystem,
        is_archived: !!cat.archived || !!cat.deletedAt,
        deleted_at: cat.deletedAt || null,
        generation_counter: cat.generationCounter || 1,
        created_at: cat.createdAt || new Date().toISOString(),
        updated_at: cat.updatedAt || new Date().toISOString(),
      };
      const { error } = await upsertWithColumnFallback(supabase, 'finance_categories', payload);
      if (!error) {
        await db.financeCategories.update(cat.id, { isDirty: false });
        pushed++;
      } else {
        logger.error('[FinanceSyncEngine] Category upsert failed:', error);
        hasError = true;
      }
    }

    // Pull Remote Categories -> Local
    try {
      const { data: remoteCats, error: pullCatErr } = await (supabase
        .from('finance_categories') as any)
        .select('*')
        .eq('user_id', userId);
      if (!pullCatErr && Array.isArray(remoteCats)) {
        for (const r of remoteCats) {
          let local = await db.financeCategories.get(r.id);
          if (!local && r.slug) {
            const sameSlug = await db.financeCategories
              .where('userId')
              .equals(r.user_id)
              .filter((c) => c.slug === r.slug)
              .first();
            if (sameSlug && sameSlug.id !== r.id) {
              const txs = await db.financeTransactions.where('categoryId').equals(sameSlug.id).toArray();
              for (const tx of txs) {
                await db.financeTransactions.update(tx.id, { categoryId: r.id });
              }
              await db.financeCategories.delete(sameSlug.id);
              local = sameSlug;
            }
          }
          if (this.shouldApplyRemote(local, r)) {
            await db.financeCategories.put({
              id: r.id,
              userId: r.user_id,
              name: r.name,
              slug: r.slug,
              type: r.type,
              icon: r.icon,
              color: r.color,
              monthlyBudgetLimit: Number(r.monthly_budget_limit || 0),
              rolloverEnabled: r.rollover_enabled ?? local?.rolloverEnabled ?? false,
              subcategories: r.subcategories || [],
              order: r.order_index ?? 0,
              isSystem: !!r.is_system,
              archived: !!r.is_archived,
              deletedAt: r.deleted_at || (r.is_archived ? r.updated_at : null),
              generationCounter: r.generation_counter || 1,
              createdAt: r.created_at || r.updated_at || new Date().toISOString(),
              updatedAt: r.updated_at || new Date().toISOString(),
              isDirty: false,
            });
            pulled++;
          }
        }
      }
    } catch {
      // Non-fatal if remote table unavailable
    }

    // 2. Sync Dirty Local Accounts -> Remote
    const dirtyAccounts = await db.financeAccounts
      .where('userId')
      .equals(userId)
      .filter((a) => a.isDirty !== false)
      .toArray();

    for (const acc of dirtyAccounts) {
      const payload = {
        id: acc.id,
        user_id: userId,
        name: acc.name,
        type: acc.type,
        balance: Number(acc.balance || 0),
        credit_limit: acc.creditLimit !== undefined ? Number(acc.creditLimit) : null,
        billing_day: acc.billingDay ?? acc.statementDay ?? null,
        statement_day: acc.statementDay ?? acc.billingDay ?? null,
        due_day: acc.dueDay ?? null,
        grace_period_days: acc.gracePeriodDays ?? null,
        last_statement_checked_at: acc.lastStatementCheckedAt ?? null,
        include_in_net_worth: acc.includeInNetWorth !== false,
        currency: acc.currency || 'INR',
        color: acc.color || '#10b981',
        icon: acc.icon || 'Landmark',
        is_default: !!acc.isDefault,
        is_archived: !!acc.archived || !!acc.deletedAt,
        deleted_at: acc.deletedAt || null,
        generation_counter: acc.generationCounter || 1,
        created_at: acc.createdAt || new Date().toISOString(),
        updated_at: acc.updatedAt || new Date().toISOString(),
      };
      const { error } = await upsertWithColumnFallback(supabase, 'finance_accounts', payload);
      if (!error) {
        await db.financeAccounts.update(acc.id, { isDirty: false });
        pushed++;
      } else {
        logger.error('[FinanceSyncEngine] Account upsert failed:', error);
        hasError = true;
      }
    }

    // Pull Remote Accounts -> Local
    try {
      const { data: remoteAccs, error: pullAccErr } = await (supabase
        .from('finance_accounts') as any)
        .select('*')
        .eq('user_id', userId);
      if (!pullAccErr && Array.isArray(remoteAccs)) {
        for (const r of remoteAccs) {
          let local = await db.financeAccounts.get(r.id);
          if (!local && r.name && r.type) {
            const sameDefaultAcc = await db.financeAccounts
              .where('userId')
              .equals(r.user_id)
              .filter((a) => a.name === r.name && a.type === r.type && a.balance === 0 && !a.archived)
              .first();
            if (sameDefaultAcc && sameDefaultAcc.id !== r.id) {
              const txCount = await db.financeTransactions.where('accountId').equals(sameDefaultAcc.id).count();
              if (txCount === 0) {
                await db.financeAccounts.delete(sameDefaultAcc.id);
                local = sameDefaultAcc;
              }
            }
          }
          if (this.shouldApplyRemote(local, r)) {
            await db.financeAccounts.put({
              id: r.id,
              userId: r.user_id,
              name: r.name,
              type: r.type,
              balance: Number(r.balance || 0),
              creditLimit: r.credit_limit !== null && r.credit_limit !== undefined ? Number(r.credit_limit) : local?.creditLimit,
              billingDay: r.billing_day ?? r.statement_day ?? local?.billingDay,
              statementDay: r.statement_day ?? r.billing_day ?? local?.statementDay,
              dueDay: r.due_day ?? local?.dueDay,
              gracePeriodDays: r.grace_period_days ?? local?.gracePeriodDays,
              lastStatementCheckedAt: r.last_statement_checked_at ?? local?.lastStatementCheckedAt,
              includeInNetWorth: r.include_in_net_worth ?? local?.includeInNetWorth ?? true,
              currency: r.currency || 'INR',
              color: r.color || '#10b981',
              icon: r.icon || 'Wallet',
              isDefault: !!r.is_default,
              archived: !!r.is_archived,
              deletedAt: r.deleted_at || null,
              generationCounter: r.generation_counter || 1,
              createdAt: r.created_at || r.updated_at || new Date().toISOString(),
              updatedAt: r.updated_at || new Date().toISOString(),
              isDirty: false,
            });
            pulled++;
          }
        }
      }
    } catch {
      // Non-fatal
    }

    // 3. Sync Dirty Monthly Commitments -> Remote
    const dirtyCommitments = await db.monthlyCommitments
      .where('userId')
      .equals(userId)
      .filter((c) => c.isDirty !== false)
      .toArray();

    for (const comm of dirtyCommitments) {
      const payload = {
        id: comm.id,
        user_id: userId,
        title: comm.title,
        recipient_name: comm.recipientName,
        relationship: comm.relationship || 'Family',
        monthly_target_amount: Number(comm.monthlyTargetAmount || 0),
        due_day_of_month: Number(comm.dueDayOfMonth || 5),
        category: comm.category || 'family_support',
        default_category_id: comm.defaultCategoryId || null,
        auto_rollover_overpayment: !!comm.autoRolloverOverpayment,
        icon: comm.icon || 'HeartHandshake',
        color: comm.color || '#ec4899',
        is_active: comm.isActive && !comm.deletedAt,
        notes: comm.notes || null,
        deleted_at: comm.deletedAt || null,
        generation_counter: comm.generationCounter || 1,
        created_at: comm.createdAt || new Date().toISOString(),
        updated_at: comm.updatedAt || new Date().toISOString(),
      };
      const { error } = await upsertWithColumnFallback(supabase, 'monthly_commitments', payload);
      if (!error) {
        await db.monthlyCommitments.update(comm.id, { isDirty: false });
        pushed++;
      } else {
        logger.error('[FinanceSyncEngine] Commitment upsert failed:', error);
        hasError = true;
      }
    }

    // Pull Remote Monthly Commitments -> Local
    try {
      const { data: remoteComms, error: pullCommErr } = await (supabase
        .from('monthly_commitments') as any)
        .select('*')
        .eq('user_id', userId);
      if (!pullCommErr && Array.isArray(remoteComms)) {
        for (const r of remoteComms) {
          const local = await db.monthlyCommitments.get(r.id);
          if (this.shouldApplyRemote(local, r)) {
            await db.monthlyCommitments.put({
              id: r.id,
              userId: r.user_id,
              title: r.title,
              recipientName: r.recipient_name,
              relationship: r.relationship || 'Family',
              monthlyTargetAmount: Number(r.monthly_target_amount || 0),
              dueDayOfMonth: Number(r.due_day_of_month || 5),
              category: r.category || 'family_support',
              defaultCategoryId: r.default_category_id || undefined,
              autoRolloverOverpayment: !!r.auto_rollover_overpayment,
              icon: r.icon || 'HeartHandshake',
              color: r.color || '#ec4899',
              isActive: !!r.is_active,
              notes: r.notes || undefined,
              deletedAt: r.deleted_at || null,
              generationCounter: r.generation_counter || 1,
              createdAt: r.created_at || r.updated_at || new Date().toISOString(),
              updatedAt: r.updated_at || new Date().toISOString(),
              isDirty: false,
            });
            pulled++;
          }
        }
      }
    } catch {
      // Non-fatal
    }

    // 4. Sync Dirty Debt Records -> Remote
    const dirtyDebts = await db.debtRecords
      .where('userId')
      .equals(userId)
      .filter((d) => d.isDirty !== false)
      .toArray();

    for (const debt of dirtyDebts) {
      const payload = {
        id: debt.id,
        user_id: userId,
        person_name: debt.personName,
        contact_info: debt.contactInfo || null,
        direction: debt.direction,
        title: debt.title,
        principal_amount: debt.principalAmount,
        total_repaid_amount: debt.totalRepaidAmount,
        remaining_amount: debt.remainingAmount,
        start_date: debt.startDate,
        target_settlement_date: debt.targetSettlementDate || null,
        repayment_schedule: debt.repaymentSchedule,
        planned_monthly_installment: debt.plannedMonthlyInstallment || null,
        due_day_of_month: debt.dueDayOfMonth || null,
        status: debt.deletedAt ? 'archived' : debt.status,
        bucket_type: debt.bucketType || 'long_term_loan',
        is_emi: !!debt.isEmi,
        emi_amount: debt.emiAmount ?? null,
        emi_due_day: debt.emiDueDay ?? null,
        total_installments: debt.totalInstallments ?? null,
        paid_installments: debt.paidInstallments ?? 0,
        notes: debt.notes || null,
        color: debt.color,
        deleted_at: debt.deletedAt || null,
        generation_counter: debt.generationCounter || 1,
        created_at: debt.createdAt,
        updated_at: debt.updatedAt,
      };
      const { error } = await upsertWithColumnFallback(supabase, 'debt_records', payload);
      if (!error) {
        await db.debtRecords.update(debt.id, { isDirty: false });
        pushed++;
      } else {
        logger.error('[FinanceSyncEngine] Debt upsert failed:', error);
        hasError = true;
      }
    }

    // Pull Remote Debt Records -> Local
    try {
      const { data: remoteDebts, error: pullDebtErr } = await (supabase
        .from('debt_records') as any)
        .select('*')
        .eq('user_id', userId);
      if (!pullDebtErr && Array.isArray(remoteDebts)) {
        for (const r of remoteDebts) {
          const local = await db.debtRecords.get(r.id);
          if (this.shouldApplyRemote(local, r)) {
            await db.debtRecords.put({
              id: r.id,
              userId: r.user_id,
              personName: r.person_name,
              contactInfo: r.contact_info || undefined,
              direction: r.direction,
              title: r.title,
              principalAmount: Number(r.principal_amount || 0),
              totalRepaidAmount: Number(r.total_repaid_amount || 0),
              remainingAmount: Number(r.remaining_amount || 0),
              startDate: r.start_date,
              targetSettlementDate: r.target_settlement_date || undefined,
              repaymentSchedule: r.repayment_schedule || 'flexible',
              plannedMonthlyInstallment: r.planned_monthly_installment
                ? Number(r.planned_monthly_installment)
                : undefined,
              dueDayOfMonth: r.due_day_of_month ? Number(r.due_day_of_month) : undefined,
              status: r.status || 'active',
              bucketType: (r.bucket_type as any) || 'long_term_loan',
              isEmi: r.is_emi ?? false,
              emiAmount: r.emi_amount ? Number(r.emi_amount) : undefined,
              emiDueDay: r.emi_due_day ? Number(r.emi_due_day) : undefined,
              totalInstallments: r.total_installments ? Number(r.total_installments) : undefined,
              paidInstallments: r.paid_installments ? Number(r.paid_installments) : 0,
              notes: r.notes || undefined,
              color: r.color || '#3b82f6',
              deletedAt: r.deleted_at || null,
              generationCounter: r.generation_counter || 1,
              createdAt: r.created_at || r.updated_at || new Date().toISOString(),
              updatedAt: r.updated_at || new Date().toISOString(),
              isDirty: false,
            });
            pulled++;
          }
        }
      }
    } catch {
      // Non-fatal
    }

    // 5. Sync Dirty Debt Installments -> Remote
    const dirtyInstallments = await db.debtInstallments
      .where('userId')
      .equals(userId)
      .filter((i) => i.isDirty !== false)
      .toArray();

    for (const inst of dirtyInstallments) {
      const payload = {
        id: inst.id,
        user_id: userId,
        debt_id: inst.debtId,
        amount: inst.amount,
        date: inst.date,
        month_key: inst.monthKey,
        payment_method: inst.paymentMethod,
        transaction_id: inst.transactionId || null,
        note: inst.note || null,
        balance_after_payment: inst.balanceAfterPayment,
        deleted_at: inst.deletedAt || null,
        generation_counter: inst.generationCounter || 1,
        created_at: inst.createdAt,
        updated_at: inst.updatedAt,
      };
      const { error } = await upsertWithColumnFallback(supabase, 'debt_installments', payload);
      if (!error) {
        await db.debtInstallments.update(inst.id, { isDirty: false });
        pushed++;
      } else {
        logger.error('[FinanceSyncEngine] Installment upsert failed:', error);
        hasError = true;
      }
    }

    // Pull Remote Debt Installments -> Local
    try {
      const { data: remoteInsts, error: pullInstErr } = await (supabase
        .from('debt_installments') as any)
        .select('*')
        .eq('user_id', userId);
      if (!pullInstErr && Array.isArray(remoteInsts)) {
        for (const r of remoteInsts) {
          const local = await db.debtInstallments.get(r.id);
          if (this.shouldApplyRemote(local, r)) {
            await db.debtInstallments.put({
              id: r.id,
              userId: r.user_id,
              debtId: r.debt_id,
              amount: Number(r.amount || 0),
              date: r.date,
              monthKey: r.month_key,
              paymentMethod: r.payment_method || 'upi',
              transactionId: r.transaction_id || null,
              note: r.note || undefined,
              balanceAfterPayment: Number(r.balance_after_payment || 0),
              deletedAt: r.deleted_at || null,
              generationCounter: r.generation_counter || 1,
              createdAt: r.created_at || r.updated_at || new Date().toISOString(),
              updatedAt: r.updated_at || new Date().toISOString(),
              isDirty: false,
            });
            pulled++;
          }
        }
      }
    } catch {
      // Non-fatal
    }

    // 6. Sync Dirty EMI Trackers -> Remote
    const dirtyEmis = await db.emiTrackers
      .where('userId')
      .equals(userId)
      .filter((e) => e.isDirty !== false)
      .toArray();

    for (const emi of dirtyEmis) {
      const payload = {
        id: emi.id,
        user_id: userId,
        loan_name: emi.loanName,
        lender_name: emi.lenderName,
        principal_amount: emi.principalAmount,
        interest_rate_annual: emi.interestRateAnnual,
        emi_amount: emi.emiAmount,
        tenure_months: emi.tenureMonths,
        paid_months: emi.paidMonths,
        start_date: emi.startDate,
        billing_day_of_month: emi.billingDayOfMonth,
        category_id: emi.categoryId || null,
        account_id: emi.accountId || null,
        auto_create_task_reminder: emi.autoCreateTaskReminder,
        last_paid_month_key: emi.lastPaidMonthKey || null,
        status: emi.status,
        notes: emi.notes || null,
        deleted_at: emi.deletedAt || null,
        generation_counter: emi.generationCounter || 1,
        created_at: emi.createdAt,
        updated_at: emi.updatedAt,
      };
      const { error } = await upsertWithColumnFallback(supabase, 'emi_trackers', payload);
      if (!error) {
        await db.emiTrackers.update(emi.id, { isDirty: false });
        pushed++;
      } else {
        logger.error('[FinanceSyncEngine] EMI upsert failed:', error);
        hasError = true;
      }
    }

    // Pull Remote EMI Trackers -> Local
    try {
      const { data: remoteEmis, error: pullEmiErr } = await (supabase
        .from('emi_trackers') as any)
        .select('*')
        .eq('user_id', userId);
      if (!pullEmiErr && Array.isArray(remoteEmis)) {
        for (const r of remoteEmis) {
          const local = await db.emiTrackers.get(r.id);
          if (this.shouldApplyRemote(local, r)) {
            await db.emiTrackers.put({
              id: r.id,
              userId: r.user_id,
              loanName: r.loan_name,
              lenderName: r.lender_name,
              principalAmount: Number(r.principal_amount || 0),
              interestRateAnnual: Number(r.interest_rate_annual || 0),
              emiAmount: Number(r.emi_amount || 0),
              tenureMonths: Number(r.tenure_months || 1),
              paidMonths: Number(r.paid_months || 0),
              startDate: r.start_date,
              billingDayOfMonth: Number(r.billing_day_of_month || 5),
              categoryId: r.category_id,
              accountId: r.account_id || undefined,
              autoCreateTaskReminder: !!r.auto_create_task_reminder,
              lastPaidMonthKey: r.last_paid_month_key || undefined,
              status: r.status || 'active',
              notes: r.notes || undefined,
              deletedAt: r.deleted_at || null,
              generationCounter: r.generation_counter || 1,
              createdAt: r.created_at || r.updated_at || new Date().toISOString(),
              updatedAt: r.updated_at || new Date().toISOString(),
              isDirty: false,
            });
            pulled++;
          }
        }
      }
    } catch {
      // Non-fatal
    }

    // 7. Sync Dirty Finance Transactions -> Remote
    const dirtyTransactions = await db.financeTransactions
      .where('userId')
      .equals(userId)
      .filter((t) => t.isDirty !== false)
      .toArray();

    for (const tx of dirtyTransactions) {
      if (tx.deletedAt) {
        const { error } = await (supabase.from('finance_transactions') as any)
          .delete()
          .eq('id', tx.id)
          .eq('user_id', userId);
        if (!error) {
          await db.financeTransactions.delete(tx.id);
          pushed++;
        } else {
          logger.error('[FinanceSyncEngine] Transaction remote delete failed:', error);
          hasError = true;
        }
        continue;
      }

      const safeMonthKey = tx.monthKey || (tx.date ? tx.date.slice(0, 7) : new Date().toISOString().slice(0, 7));
      const safeDate = tx.date || new Date().toISOString().slice(0, 10);
      const payload = {
        id: tx.id,
        user_id: userId,
        title: tx.title || 'Untitled Transaction',
        merchant_name: tx.merchantName || null,
        raw_merchant: tx.rawMerchant || null,
        amount: Number(tx.amount || 0),
        type: tx.type || 'expense',
        category_id: tx.categoryId,
        subcategory: tx.subcategory || null,
        account_id: tx.accountId,
        to_account_id: tx.toAccountId || null,
        date: safeDate,
        month_key: safeMonthKey,
        notes: tx.notes || null,
        tags: Array.isArray(tx.tags) ? tx.tags : [],
        is_recurring: !!tx.isRecurring,
        recurrence_rule: tx.recurrenceRule || null,
        needs_review: !!tx.needsReview,
        split_group_id: tx.splitGroupId || null,
        linked_commitment_id: tx.linkedCommitmentId || null,
        commitment_contribution_type: tx.linkedCommitmentId ? (tx.commitmentContributionType || 'offset_expense') : null,
        linked_debt_id: tx.linkedDebtId || null,
        linked_debt_installment_id: tx.linkedDebtInstallmentId || null,
        linked_emi_id: tx.linkedEmiId || null,
        linked_sip_id: tx.linkedSipId || null,
        statement_cycle_key: tx.statementCycleKey ?? null,
        paid_statement_id: tx.paidStatementId ?? null,
        is_credit_card_payment: !!tx.isCreditCardPayment,
        deleted_at: tx.deletedAt || null,
        generation_counter: tx.generationCounter || 1,
        created_at: tx.createdAt || new Date().toISOString(),
        updated_at: tx.updatedAt || new Date().toISOString(),
      };
      let { error } = await upsertWithColumnFallback(supabase, 'finance_transactions', payload);
      if (error && (error as any).code === '23503') {
        logger.warn('[FinanceSyncEngine] Foreign key 23503 violation on transaction upsert, retrying with unlinked references:', error);
        const unlinkedPayload = {
          ...payload,
          linked_commitment_id: null,
          commitment_contribution_type: null,
          linked_debt_id: null,
          linked_debt_installment_id: null,
          linked_emi_id: null,
          linked_sip_id: null,
        };
        const retryResult = await upsertWithColumnFallback(supabase, 'finance_transactions', unlinkedPayload);
        error = retryResult.error;
      }
      if (!error) {
        await db.financeTransactions.update(tx.id, { isDirty: false });
        pushed++;
      } else {
        logger.error('[FinanceSyncEngine] Transaction upsert failed:', error);
        hasError = true;
      }
    }

    // Pull Remote Finance Transactions -> Local
    try {
      const { data: remoteTxs, error: pullTxErr } = await (supabase
        .from('finance_transactions') as any)
        .select('*')
        .eq('user_id', userId);
      if (!pullTxErr && Array.isArray(remoteTxs)) {
        for (const r of remoteTxs) {
          const local = await db.financeTransactions.get(r.id);
          if (this.shouldApplyRemote(local, r)) {
            await db.financeTransactions.put({
              id: r.id,
              userId: r.user_id,
              title: r.title,
              merchantName: r.merchant_name ?? local?.merchantName,
              rawMerchant: r.raw_merchant ?? local?.rawMerchant,
              amount: Number(r.amount || 0),
              type: r.type || 'expense',
              categoryId: r.category_id,
              subcategory: r.subcategory || undefined,
              accountId: r.account_id,
              toAccountId: r.to_account_id || undefined,
              date: r.date,
              monthKey: r.month_key || (r.date ? r.date.slice(0, 7) : ''),
              notes: r.notes || undefined,
              tags: Array.isArray(r.tags) ? r.tags : [],
              isRecurring: !!r.is_recurring,
              recurrenceRule: r.recurrence_rule || undefined,
              needsReview: r.needs_review ?? local?.needsReview ?? false,
              splitGroupId: r.split_group_id ?? local?.splitGroupId ?? null,
              linkedCommitmentId: r.linked_commitment_id || null,
              commitmentContributionType: r.commitment_contribution_type || null,
              linkedDebtId: r.linked_debt_id || null,
              linkedDebtInstallmentId: r.linked_debt_installment_id || null,
              linkedEmiId: r.linked_emi_id || null,
              linkedSipId: r.linked_sip_id ?? local?.linkedSipId ?? null,
              statementCycleKey: r.statement_cycle_key ?? local?.statementCycleKey ?? null,
              paidStatementId: r.paid_statement_id ?? local?.paidStatementId ?? null,
              isCreditCardPayment: r.is_credit_card_payment ?? local?.isCreditCardPayment ?? false,
              deletedAt: r.deleted_at || null,
              generationCounter: r.generation_counter || 1,
              createdAt: r.created_at || r.updated_at || new Date().toISOString(),
              updatedAt: r.updated_at || new Date().toISOString(),
              isDirty: false,
            });
            pulled++;
          }
        }
      }
    } catch {
      // Non-fatal
    }

    // 8. Sync Dirty Finance Budgets -> Remote
    const dirtyBudgets = await db.financeBudgets
      .where('userId')
      .equals(userId)
      .filter((b) => b.isDirty !== false)
      .toArray();

    for (const budget of dirtyBudgets) {
      if (budget.deletedAt) {
        const { error } = await (supabase.from('finance_budgets') as any)
          .delete()
          .eq('id', budget.id)
          .eq('user_id', userId);
        if (!error) {
          await db.financeBudgets.delete(budget.id);
          pushed++;
        } else {
          logger.error('[FinanceSyncEngine] Budget remote delete failed:', error);
          hasError = true;
        }
        continue;
      }

      const payload = {
        id: budget.id,
        user_id: userId,
        month_key: budget.monthKey,
        total_budget: budget.totalBudget,
        expected_income: budget.expectedIncome,
        planned_sip_amount: Number(budget.plannedSipAmount || 0),
        budget_mode: budget.budgetMode || 'cap',
        assigned_income: budget.assignedIncome !== undefined ? Number(budget.assignedIncome) : null,
        currency: budget.currency,
        notes: budget.notes || null,
        deleted_at: budget.deletedAt || null,
        generation_counter: budget.generationCounter || 1,
        created_at: budget.createdAt,
        updated_at: budget.updatedAt,
      };
      const { error } = await upsertWithColumnFallback(supabase, 'finance_budgets', payload, {
        onConflict: 'user_id,month_key',
      });
      if (!error) {
        await db.financeBudgets.update(budget.id, { isDirty: false });
        pushed++;
      } else {
        logger.error('[FinanceSyncEngine] Budget upsert failed:', error);
        hasError = true;
      }
    }

    // Pull Remote Finance Budgets -> Local
    try {
      const { data: remoteBudgets, error: pullBudgetErr } = await (supabase
        .from('finance_budgets') as any)
        .select('*')
        .eq('user_id', userId);
      if (!pullBudgetErr && Array.isArray(remoteBudgets)) {
        for (const r of remoteBudgets) {
          let local = await db.financeBudgets.get(r.id);
          if (!local && r.month_key) {
            const sameMonth = await db.financeBudgets
              .where('[userId+monthKey]')
              .equals([r.user_id, r.month_key])
              .first();
            if (sameMonth && sameMonth.id !== r.id) {
              await db.financeBudgets.delete(sameMonth.id);
              local = sameMonth;
            }
          }
          if (this.shouldApplyRemote(local, r)) {
            await db.financeBudgets.put({
              id: r.id,
              userId: r.user_id,
              monthKey: r.month_key,
              totalBudget: Number(r.total_budget || 0),
              expectedIncome: Number(r.expected_income || 0),
              plannedSipAmount: r.planned_sip_amount ? Number(r.planned_sip_amount) : (local?.plannedSipAmount ?? 0),
              budgetMode: r.budget_mode === 'zero_based' ? 'zero_based' : (local?.budgetMode || 'cap'),
              assignedIncome: r.assigned_income !== null && r.assigned_income !== undefined ? Number(r.assigned_income) : local?.assignedIncome,
              currency: r.currency || 'INR',
              notes: r.notes || undefined,
              deletedAt: r.deleted_at || null,
              generationCounter: r.generation_counter || 1,
              createdAt: r.created_at || r.updated_at || new Date().toISOString(),
              updatedAt: r.updated_at || new Date().toISOString(),
              isDirty: false,
            });
            pulled++;
          }
        }
      }
    } catch {
      // Non-fatal
    }

    // 9. Sync for V2 SIP Plans, Categorization Rules & Recurring Bills
    try {
      if (db.financeSipPlans) {
        const dirtySips = await db.financeSipPlans
          .where('userId')
          .equals(userId)
          .filter((s) => s.isDirty !== false)
          .toArray();
        for (const sip of dirtySips) {
          const { error } = await upsertWithColumnFallback(supabase, 'finance_sip_plans', {
            id: sip.id,
            user_id: userId,
            name: sip.name,
            platform: sip.platform || null,
            asset_class: sip.assetClass,
            monthly_amount: sip.monthlyAmount,
            sip_day_of_month: sip.sipDayOfMonth,
            start_date: sip.startDate,
            total_invested: sip.totalInvested,
            current_value: sip.currentValue,
            expected_return_annual: sip.expectedReturnAnnual || null,
            account_id: sip.accountId || null,
            category_id: sip.categoryId || null,
            last_invested_month_key: sip.lastInvestedMonthKey || null,
            is_active: sip.isActive && !sip.deletedAt,
            color: sip.color,
            notes: sip.notes || null,
            deleted_at: sip.deletedAt || null,
            generation_counter: sip.generationCounter || 1,
            created_at: sip.createdAt,
            updated_at: sip.updatedAt,
          });
          if (!error) {
            await db.financeSipPlans.update(sip.id, { isDirty: false });
            pushed++;
          } else {
            logger.error('[FinanceSyncEngine] SIP plan upsert failed:', error);
          }
        }

        const { data: remoteSips, error: pullSipErr } = await (supabase
          .from('finance_sip_plans') as any)
          .select('*')
          .eq('user_id', userId);
        if (!pullSipErr && Array.isArray(remoteSips)) {
          for (const r of remoteSips) {
            const local = await db.financeSipPlans.get(r.id);
            if (this.shouldApplyRemote(local, r)) {
              await db.financeSipPlans.put({
                id: r.id,
                userId: r.user_id,
                name: r.name,
                platform: r.platform || undefined,
                assetClass: r.asset_class || 'equity_mf',
                monthlyAmount: Number(r.monthly_amount || 0),
                sipDayOfMonth: Number(r.sip_day_of_month || 5),
                startDate: r.start_date,
                totalInvested: Number(r.total_invested || 0),
                currentValue: Number(r.current_value || 0),
                expectedReturnAnnual: r.expected_return_annual ? Number(r.expected_return_annual) : undefined,
                accountId: r.account_id || undefined,
                categoryId: r.category_id || undefined,
                lastInvestedMonthKey: r.last_invested_month_key || undefined,
                isActive: !!r.is_active,
                color: r.color || '#10b981',
                notes: r.notes || undefined,
                deletedAt: r.deleted_at || null,
                generationCounter: r.generation_counter || 1,
                createdAt: r.created_at || r.updated_at || new Date().toISOString(),
                updatedAt: r.updated_at || new Date().toISOString(),
                isDirty: false,
              });
              pulled++;
            }
          }
        }
      }

      if (db.financeCategorizationRules) {
        const dirtyRules = await db.financeCategorizationRules
          .where('userId')
          .equals(userId)
          .filter((r) => r.isDirty !== false)
          .toArray();
        for (const rule of dirtyRules) {
          const { error } = await upsertWithColumnFallback(supabase, 'finance_categorization_rules', {
            id: rule.id,
            user_id: userId,
            match_pattern: rule.matchPattern,
            clean_merchant_name: rule.cleanMerchantName,
            category_id: rule.categoryId,
            subcategory: rule.subcategory || null,
            default_tags: rule.defaultTags || [],
            is_active: rule.isActive && !rule.deletedAt,
            deleted_at: rule.deletedAt || null,
            generation_counter: rule.generationCounter || 1,
            created_at: rule.createdAt,
            updated_at: rule.updatedAt,
          });
          if (!error) {
            await db.financeCategorizationRules.update(rule.id, { isDirty: false });
            pushed++;
          }
        }
        const { data: remoteRules } = await (supabase.from('finance_categorization_rules') as any)
          .select('*')
          .eq('user_id', userId);
        if (Array.isArray(remoteRules)) {
          for (const r of remoteRules) {
            const local = await db.financeCategorizationRules.get(r.id);
            if (this.shouldApplyRemote(local, r)) {
              await db.financeCategorizationRules.put({
                id: r.id,
                userId: r.user_id,
                matchPattern: r.match_pattern,
                cleanMerchantName: r.clean_merchant_name,
                categoryId: r.category_id,
                subcategory: r.subcategory || undefined,
                defaultTags: r.default_tags || [],
                isActive: !!r.is_active,
                deletedAt: r.deleted_at || null,
                generationCounter: r.generation_counter || 1,
                createdAt: r.created_at || r.updated_at || new Date().toISOString(),
                updatedAt: r.updated_at || new Date().toISOString(),
                isDirty: false,
              });
              pulled++;
            }
          }
        }
      }

      if (db.financeRecurringBills) {
        const dirtyBills = await db.financeRecurringBills
          .where('userId')
          .equals(userId)
          .filter((b) => b.isDirty !== false)
          .toArray();
        for (const bill of dirtyBills) {
          const { error } = await upsertWithColumnFallback(supabase, 'finance_recurring_bills', {
            id: bill.id,
            user_id: userId,
            name: bill.name,
            amount: bill.amount,
            previous_amount: bill.previousAmount || null,
            cadence: bill.cadence,
            due_day_of_month: bill.dueDayOfMonth,
            category_id: bill.categoryId,
            account_id: bill.accountId || null,
            auto_log: bill.autoLog,
            last_paid_month_key: bill.lastPaidMonthKey || null,
            is_active: bill.isActive && !bill.deletedAt,
            color: bill.color,
            icon: bill.icon,
            deleted_at: bill.deletedAt || null,
            generation_counter: bill.generationCounter || 1,
            created_at: bill.createdAt,
            updated_at: bill.updatedAt,
          });
          if (!error) {
            await db.financeRecurringBills.update(bill.id, { isDirty: false });
            pushed++;
          }
        }
        const { data: remoteBills } = await (supabase.from('finance_recurring_bills') as any)
          .select('*')
          .eq('user_id', userId);
        if (Array.isArray(remoteBills)) {
          for (const r of remoteBills) {
            const local = await db.financeRecurringBills.get(r.id);
            if (this.shouldApplyRemote(local, r)) {
              await db.financeRecurringBills.put({
                id: r.id,
                userId: r.user_id,
                name: r.name,
                amount: Number(r.amount || 0),
                previousAmount: r.previous_amount ? Number(r.previous_amount) : undefined,
                cadence: r.cadence || 'monthly',
                dueDayOfMonth: Number(r.due_day_of_month || 5),
                categoryId: r.category_id,
                accountId: r.account_id || undefined,
                autoLog: !!r.auto_log,
                lastPaidMonthKey: r.last_paid_month_key || undefined,
                isActive: !!r.is_active,
                color: r.color || '#6366f1',
                icon: r.icon || 'Calendar',
                deletedAt: r.deleted_at || null,
                generationCounter: r.generation_counter || 1,
                createdAt: r.created_at || r.updated_at || new Date().toISOString(),
                updatedAt: r.updated_at || new Date().toISOString(),
                isDirty: false,
              });
              pulled++;
            }
          }
        }
      }

      if (db.financeNetWorthSnapshots && !missingRemoteFinanceTables.has('finance_net_worth_snapshots')) {
        const dirtySnapshots = await db.financeNetWorthSnapshots
          .where('userId')
          .equals(userId)
          .filter((s) => s.isDirty !== false)
          .toArray();
        for (const snap of dirtySnapshots) {
          if (missingRemoteFinanceTables.has('finance_net_worth_snapshots')) break;
          const { error } = await upsertWithColumnFallback(
            supabase,
            'finance_net_worth_snapshots',
            {
              id: snap.id,
              user_id: userId,
              month_key: snap.monthKey,
              snapshot_date: snap.snapshotDate,
              liquid_assets: Number(snap.liquidAssets || 0),
              investment_assets: Number(snap.investmentAssets || 0),
              friend_receivables: Number(snap.friendReceivables || 0),
              total_assets: Number(snap.totalAssets || 0),
              credit_card_liabilities: Number(snap.creditCardLiabilities || 0),
              emi_remaining_principal: Number(snap.emiRemainingPrincipal || 0),
              friend_payables: Number(snap.friendPayables || 0),
              total_liabilities: Number(snap.totalLiabilities || 0),
              net_worth: Number(snap.netWorth || 0),
              deleted_at: snap.deletedAt || null,
              generation_counter: snap.generationCounter || 1,
              created_at: snap.createdAt,
              updated_at: snap.updatedAt,
            },
            { onConflict: 'user_id,month_key' }
          );
          if (error) {
            if (isMissingRelationError(error)) {
              missingRemoteFinanceTables.add('finance_net_worth_snapshots');
              logger.info('[FinanceSyncEngine] Skipping unmigrated table finance_net_worth_snapshots for this session.');
              break;
            }
          } else {
            await db.financeNetWorthSnapshots.update(snap.id, { isDirty: false });
            pushed++;
          }
        }
        if (!missingRemoteFinanceTables.has('finance_net_worth_snapshots')) {
          const { data: remoteSnaps, error: pullSnapError } = await (supabase.from('finance_net_worth_snapshots') as any)
            .select('*')
            .eq('user_id', userId);
          if (pullSnapError && isMissingRelationError(pullSnapError)) {
            missingRemoteFinanceTables.add('finance_net_worth_snapshots');
          } else if (Array.isArray(remoteSnaps)) {
            for (const r of remoteSnaps) {
              const local = await db.financeNetWorthSnapshots.get(r.id);
              if (this.shouldApplyRemote(local, r)) {
                await db.financeNetWorthSnapshots.put({
                  id: r.id,
                  userId: r.user_id,
                  monthKey: r.month_key,
                  snapshotDate: r.snapshot_date,
                  liquidAssets: Number(r.liquid_assets || 0),
                  investmentAssets: Number(r.investment_assets || 0),
                  friendReceivables: Number(r.friend_receivables || 0),
                  totalAssets: Number(r.total_assets || 0),
                  creditCardLiabilities: Number(r.credit_card_liabilities || 0),
                  emiRemainingPrincipal: Number(r.emi_remaining_principal || 0),
                  friendPayables: Number(r.friend_payables || 0),
                  totalLiabilities: Number(r.total_liabilities || 0),
                  netWorth: Number(r.net_worth || 0),
                  deletedAt: r.deleted_at || null,
                  generationCounter: r.generation_counter || 1,
                  createdAt: r.created_at || r.updated_at || new Date().toISOString(),
                  updatedAt: r.updated_at || new Date().toISOString(),
                  isDirty: false,
                });
                pulled++;
              }
            }
          }
        }
      }
    } catch {
      // Non-fatal
    }

    // 13. Sync Dirty Credit Card Statements -> Remote
    try {
      if (db.creditCardStatements && !missingRemoteFinanceTables.has('credit_card_statements')) {
        const dirtyStatements = await db.creditCardStatements
          .where('userId')
          .equals(userId)
          .filter((s) => s.isDirty !== false)
          .toArray();

        for (const s of dirtyStatements) {
          if (s.deletedAt) {
            const { error } = await (supabase.from('credit_card_statements') as any)
              .delete()
              .eq('id', s.id)
              .eq('user_id', userId);
            if (error) {
              if (isMissingRelationError(error)) {
                missingRemoteFinanceTables.add('credit_card_statements');
                break;
              }
            } else {
              await db.creditCardStatements.delete(s.id);
              pushed++;
            }
            continue;
          }

          const payload = {
            id: s.id,
            user_id: userId,
            account_id: s.accountId,
            cycle_key: s.cycleKey,
            period_start: s.periodStart,
            period_end: s.periodEnd,
            due_date: s.dueDate,
            calculated_amount: Number(s.calculatedAmount || 0),
            manual_adjustment: Number(s.manualAdjustment || 0),
            total_due: Number(s.totalDue || 0),
            carried_forward_amount: Number(s.carriedForwardAmount || 0),
            paid_amount: Number(s.paidAmount || 0),
            remaining_due: Number(s.remainingDue || 0),
            status: s.status || 'billed',
            paid_at: s.paidAt || null,
            notes: s.notes || null,
            generation_counter: s.generationCounter || 1,
            created_at: s.createdAt || new Date().toISOString(),
            updated_at: s.updatedAt || new Date().toISOString(),
            deleted_at: s.deletedAt || null,
          };
          const { error } = await upsertWithColumnFallback(
            supabase,
            'credit_card_statements',
            payload,
            { onConflict: 'user_id,account_id,cycle_key' }
          );
          if (error) {
            if (isMissingRelationError(error)) {
              missingRemoteFinanceTables.add('credit_card_statements');
              logger.info('[FinanceSyncEngine] Skipping unmigrated table credit_card_statements for this session.');
              break;
            } else {
              logger.error('[FinanceSyncEngine] CreditCardStatement upsert failed:', error);
              hasError = true;
            }
          } else {
            await db.creditCardStatements.update(s.id, { isDirty: false });
            pushed++;
          }
        }

        if (!missingRemoteFinanceTables.has('credit_card_statements')) {
          const { data: remoteStmts, error: pullStmtError } = await (supabase.from('credit_card_statements') as any)
            .select('*')
            .eq('user_id', userId);
          if (pullStmtError && isMissingRelationError(pullStmtError)) {
            missingRemoteFinanceTables.add('credit_card_statements');
          } else if (Array.isArray(remoteStmts)) {
            for (const r of remoteStmts) {
              const local = await db.creditCardStatements.get(r.id);
              if (this.shouldApplyRemote(local, r)) {
                await db.creditCardStatements.put({
                  id: r.id,
                  userId: r.user_id,
                  accountId: r.account_id,
                  cycleKey: r.cycle_key,
                  periodStart: r.period_start,
                  periodEnd: r.period_end,
                  dueDate: r.due_date,
                  calculatedAmount: Number(r.calculated_amount || 0),
                  manualAdjustment: Number(r.manual_adjustment || 0),
                  totalDue: Number(r.total_due || 0),
                  carriedForwardAmount: Number(r.carried_forward_amount || 0),
                  paidAmount: Number(r.paid_amount || 0),
                  remainingDue: Number(r.remaining_due || 0),
                  status: r.status as any,
                  paidAt: r.paid_at || null,
                  notes: r.notes || undefined,
                  generationCounter: r.generation_counter || 1,
                  createdAt: r.created_at || r.updated_at || new Date().toISOString(),
                  updatedAt: r.updated_at || new Date().toISOString(),
                  deletedAt: r.deleted_at || null,
                  isDirty: false,
                });
                pulled++;
              }
            }
          }
        }
      }
    } catch {
      // Non-fatal
    }

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

