import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { FinanceAccount, FinanceCategory, FinanceTransaction } from '@/lib/types';

export type FinanceRecordId = string;
export type FinanceUserId = string;

interface RemapPair {
  fromId: FinanceRecordId;
  toId: FinanceRecordId;
}

interface AccountRemapParams extends RemapPair {
  userId: FinanceUserId;
}

function groupByKey<T>(items: T[], getKey: (item: T) => string | null): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;
    const list = grouped.get(key) || [];
    list.push(item);
    grouped.set(key, list);
  }
  return grouped;
}

async function pickBestByScore<T>(
  items: T[],
  scoreFn: (item: T) => Promise<number>
): Promise<T> {
  let best = items[0];
  let bestScore = -1;

  for (const item of items) {
    const score = await scoreFn(item);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}

async function countCategoryRules(categoryId: FinanceRecordId): Promise<number> {
  if (!db.financeCategorizationRules) return 0;
  return db.financeCategorizationRules.where('categoryId').equals(categoryId).count();
}

async function scoreCategory(cat: { id: FinanceRecordId; monthlyBudgetLimit?: number }): Promise<number> {
  const txCount = await db.financeTransactions.where('categoryId').equals(cat.id).count();
  const commCount = await db.monthlyCommitments.filter((m) => m.defaultCategoryId === cat.id).count();
  const ruleCount = await countCategoryRules(cat.id);
  const budgetBonus = (cat.monthlyBudgetLimit || 0) > 0 ? 50 : 0;
  return txCount * 10 + commCount * 10 + ruleCount * 10 + budgetBonus;
}

async function remapCategoryRules({ fromId, toId }: RemapPair): Promise<void> {
  if (!db.financeCategorizationRules) return;
  const rules = await db.financeCategorizationRules.where('categoryId').equals(fromId).toArray();
  for (const rule of rules) {
    await db.financeCategorizationRules.update(rule.id, { categoryId: toId });
  }
}

async function remapCategoryReferences({ fromId, toId }: RemapPair): Promise<void> {
  const txs = await db.financeTransactions.where('categoryId').equals(fromId).toArray();
  for (const tx of txs) {
    await db.financeTransactions.update(tx.id, { categoryId: toId });
  }

  const comms = await db.monthlyCommitments.filter((m) => m.defaultCategoryId === fromId).toArray();
  for (const comm of comms) {
    await db.monthlyCommitments.update(comm.id, { defaultCategoryId: toId });
  }

  await remapCategoryRules({ fromId, toId });
}

async function mergeCategoryGroup(catGroup: Array<{ id: FinanceRecordId; monthlyBudgetLimit?: number }>): Promise<void> {
  if (catGroup.length <= 1) return;
  const bestCat = await pickBestByScore(catGroup, scoreCategory);
  for (const cat of catGroup) {
    if (cat.id === bestCat.id) continue;
    await remapCategoryReferences({ fromId: cat.id, toId: bestCat.id });
    await db.financeCategories.delete(cat.id);
  }
}

function getCategorySlugKey(cat: FinanceCategory): string | null {
  if (!cat.slug || cat.deletedAt) return null;
  return cat.slug;
}

async function deduplicateCategories(userId: FinanceUserId): Promise<void> {
  const allCats = await db.financeCategories.where('userId').equals(userId).toArray();
  const catsBySlug = groupByKey(allCats, getCategorySlugKey);

  for (const catGroup of catsBySlug.values()) {
    await mergeCategoryGroup(catGroup);
  }
}

async function countAccountStatements(accountId: FinanceRecordId): Promise<number> {
  if (!db.creditCardStatements) return 0;
  return db.creditCardStatements.where('accountId').equals(accountId).count();
}

async function scoreAccount(
  acc: { id: FinanceRecordId; balance?: number },
  userId: FinanceUserId
): Promise<number> {
  const txCount = await db.financeTransactions.where('accountId').equals(acc.id).count();
  const toTxCount = await db.financeTransactions
    .where('userId')
    .equals(userId)
    .filter((t) => t.toAccountId === acc.id)
    .count();
  const stmtCount = await countAccountStatements(acc.id);
  const balanceBonus = Math.abs(acc.balance || 0) > 0 ? 100 : 0;
  return (txCount + toTxCount + stmtCount) * 10 + balanceBonus;
}

async function remapStatementPaidTransactions(
  userId: FinanceUserId,
  fromStmtId: FinanceRecordId,
  toStmtId: FinanceRecordId
): Promise<void> {
  const linkedTxs = await db.financeTransactions
    .where('userId')
    .equals(userId)
    .filter((t) => t.paidStatementId === fromStmtId)
    .toArray();
  for (const ltx of linkedTxs) {
    await db.financeTransactions.update(ltx.id, { paidStatementId: toStmtId });
  }
}

async function remapAccountStatements({ fromId, toId, userId }: AccountRemapParams): Promise<void> {
  if (!db.creditCardStatements) return;
  const stmts = await db.creditCardStatements.where('accountId').equals(fromId).toArray();
  for (const stmt of stmts) {
    const existingOnBest = await db.creditCardStatements
      .where('[accountId+cycleKey]')
      .equals([toId, stmt.cycleKey])
      .first();
    if (!existingOnBest) {
      await db.creditCardStatements.update(stmt.id, { accountId: toId });
      continue;
    }
    await remapStatementPaidTransactions(userId, stmt.id, existingOnBest.id);
    await db.creditCardStatements.delete(stmt.id);
  }
}

async function remapAccountReferences(params: AccountRemapParams): Promise<void> {
  const { fromId, toId, userId } = params;
  const txs = await db.financeTransactions.where('accountId').equals(fromId).toArray();
  for (const tx of txs) {
    await db.financeTransactions.update(tx.id, { accountId: toId });
  }

  const incomingTxs = await db.financeTransactions
    .where('userId')
    .equals(userId)
    .filter((t) => t.toAccountId === fromId)
    .toArray();
  for (const tx of incomingTxs) {
    await db.financeTransactions.update(tx.id, { toAccountId: toId });
  }

  await remapAccountStatements(params);
}

async function carryOverBalanceIfEmpty(
  acc: { balance?: number },
  bestAcc: { id: FinanceRecordId; balance?: number }
): Promise<void> {
  if ((bestAcc.balance || 0) !== 0) return;
  if ((acc.balance || 0) === 0) return;
  await db.financeAccounts.update(bestAcc.id, { balance: acc.balance });
  bestAcc.balance = acc.balance;
}

async function mergeAccountGroup(
  accGroup: Array<{ id: FinanceRecordId; balance?: number }>,
  userId: FinanceUserId
): Promise<void> {
  if (accGroup.length <= 1) return;
  const bestAcc = await pickBestByScore(accGroup, (acc) => scoreAccount(acc, userId));
  for (const acc of accGroup) {
    if (acc.id === bestAcc.id) continue;
    await carryOverBalanceIfEmpty(acc, bestAcc);
    await remapAccountReferences({ fromId: acc.id, toId: bestAcc.id, userId });
    await db.financeAccounts.delete(acc.id);
  }
}

function getAccountNameKey(acc: FinanceAccount): string | null {
  if (!acc.name || acc.deletedAt) return null;
  return `${acc.name.trim().toLowerCase()}_${acc.type}`;
}

async function deduplicateAccounts(userId: FinanceUserId): Promise<void> {
  const allAccs = await db.financeAccounts.where('userId').equals(userId).toArray();
  const accsByKey = groupByKey(allAccs, getAccountNameKey);

  for (const accGroup of accsByKey.values()) {
    await mergeAccountGroup(accGroup, userId);
  }
}

function compareSplitLegs(
  a: { id: FinanceRecordId; createdAt?: string },
  b: { id: FinanceRecordId; createdAt?: string }
): number {
  return (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id);
}

async function softDeleteDuplicateBucket(
  bucket: Array<{ id: FinanceRecordId; createdAt?: string; generationCounter?: number }>,
  nowIso: string
): Promise<void> {
  if (bucket.length <= 1) return;
  bucket.sort(compareSplitLegs);
  for (const dup of bucket.slice(1)) {
    await db.financeTransactions.update(dup.id, {
      deletedAt: nowIso,
      isDirty: true,
      generationCounter: (dup.generationCounter || 1) + 1,
      updatedAt: nowIso,
    });
  }
}

function getRepairedSplitLegKey(tx: FinanceTransaction): string | null {
  if (!tx.notes?.includes('(repaired)') || !tx.tags?.includes('friend-share')) return null;
  return `${tx.splitGroupId}__${tx.amount}_${tx.accountId}_${tx.date}`;
}

async function deduplicateRepairedSplitLegs(userId: FinanceUserId): Promise<void> {
  const splitTxs = await db.financeTransactions
    .where('userId')
    .equals(userId)
    .filter((t) => !t.deletedAt && Boolean(t.splitGroupId))
    .toArray();

  const repairedByKey = groupByKey(splitTxs, getRepairedSplitLegKey);
  const nowIso = new Date().toISOString();
  for (const bucket of repairedByKey.values()) {
    await softDeleteDuplicateBucket(bucket, nowIso);
  }
}

/**
 * Automatically cleans up any duplicate categories (same slug) or accounts (same name + type)
 * in Dexie IndexedDB for the specified user, remapping any foreign-key transaction references
 * to the canonical record and deleting redundant duplicates.
 */
export async function deduplicateFinanceRecordsInDexie(userId: FinanceUserId): Promise<void> {
  if (!userId) return;

  try {
    await deduplicateCategories(userId);
    await deduplicateAccounts(userId);
    await deduplicateRepairedSplitLegs(userId);
  } catch (err) {
    logger.warn('[FinanceSyncEngine] Deduplication error in Dexie:', err);
  }
}
