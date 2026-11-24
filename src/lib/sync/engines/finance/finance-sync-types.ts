/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface SyncStepResult {
  pushed: number;
  pulled: number;
  hasError: boolean;
}

export const missingRemoteFinanceTables = new Set<string>();
export const missingRemoteFinanceColumns = new Map<string, Set<string>>();

export function isMissingRelationError(err: any): boolean {
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

export function getMissingColumnName(err: any): string | null {
  if (!err) return null;
  const msg = `${err.message || ''} ${err.details || ''} ${err.hint || ''}`;
  const m =
    msg.match(/Could not find the ['"]([a-z0-9_]+)['"] column/i) ||
    msg.match(/column\s+["']?([a-z0-9_]+)["']?\s+(?:of|does not exist)/i) ||
    msg.match(/column\s+["']?([a-z0-9_]+)["']?\s+does not exist/i);
  return m ? m[1] : null;
}

export function stripKnownMissingColumns(table: string, payload: Record<string, any>): Record<string, any> {
  const cols = missingRemoteFinanceColumns.get(table);
  if (!cols || cols.size === 0) return payload;
  const copy = { ...payload };
  for (const col of cols) delete copy[col];
  return copy;
}

export function recordMissingColumn(table: string, col: string) {
  let set = missingRemoteFinanceColumns.get(table);
  if (!set) {
    set = new Set();
    missingRemoteFinanceColumns.set(table, set);
  }
  set.add(col);
  logger.info(`[FinanceSyncEngine] Detected missing remote column '${col}' on table '${table}'. Stripping for subsequent upserts.`);
}

export async function upsertWithColumnFallback(
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

export function shouldApplyRemote(local: any | undefined, remote: any): boolean {
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
        const toTxCount = await db.financeTransactions
          .where('userId')
          .equals(userId)
          .filter((t) => t.toAccountId === acc.id)
          .count();
        const stmtCount = db.creditCardStatements
          ? await db.creditCardStatements.where('accountId').equals(acc.id).count()
          : 0;
        const balanceBonus = Math.abs(acc.balance || 0) > 0 ? 100 : 0;
        const score = (txCount + toTxCount + stmtCount) * 10 + balanceBonus;

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

        // Remap incoming transfers (e.g. credit card bill payments) pointing via toAccountId
        const incomingTxs = await db.financeTransactions
          .where('userId')
          .equals(userId)
          .filter((t) => t.toAccountId === acc.id)
          .toArray();
        for (const tx of incomingTxs) {
          await db.financeTransactions.update(tx.id, { toAccountId: bestAcc.id });
        }

        // Remap credit card statements belonging to the duplicate account
        if (db.creditCardStatements) {
          const stmts = await db.creditCardStatements.where('accountId').equals(acc.id).toArray();
          for (const stmt of stmts) {
            const existingOnBest = await db.creditCardStatements
              .where('[accountId+cycleKey]')
              .equals([bestAcc.id, stmt.cycleKey])
              .first();
            if (existingOnBest) {
              // Remap any transactions linked to the discarded statement ID
              const linkedTxs = await db.financeTransactions
                .where('userId')
                .equals(userId)
                .filter((t) => t.paidStatementId === stmt.id)
                .toArray();
              for (const ltx of linkedTxs) {
                await db.financeTransactions.update(ltx.id, { paidStatementId: existingOnBest.id });
              }
              await db.creditCardStatements.delete(stmt.id);
            } else {
              await db.creditCardStatements.update(stmt.id, { accountId: bestAcc.id });
            }
          }
        }

        await db.financeAccounts.delete(acc.id);
      }
    }

    // 3. Soft-delete duplicate `(repaired)` friend-share legs without altering account balances
    const splitTxs = await db.financeTransactions
      .where('userId')
      .equals(userId)
      .filter((t) => !t.deletedAt && Boolean(t.splitGroupId))
      .toArray();
    const repairedByGroupAndSig = new Map<string, typeof splitTxs>();
    for (const tx of splitTxs) {
      if (!tx.notes?.includes('(repaired)') || !tx.tags?.includes('friend-share')) continue;
      const key = `${tx.splitGroupId}__${tx.amount}_${tx.accountId}_${tx.date}`;
      const list = repairedByGroupAndSig.get(key) || [];
      list.push(tx);
      repairedByGroupAndSig.set(key, list);
    }
    const nowIso = new Date().toISOString();
    for (const bucket of repairedByGroupAndSig.values()) {
      if (bucket.length <= 1) continue;
      bucket.sort(
        (a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id)
      );
      for (const dup of bucket.slice(1)) {
        await db.financeTransactions.update(dup.id, {
          deletedAt: nowIso,
          isDirty: true,
          generationCounter: (dup.generationCounter || 1) + 1,
          updatedAt: nowIso,
        });
      }
    }
  } catch (err) {
    logger.warn('[FinanceSyncEngine] Deduplication error in Dexie:', err);
  }
}
