import { db } from '@/lib/db';
import type { DebtRecord, FinanceAccount, FinanceTransaction } from '@/lib/types';

export interface SplitRepairResult {
  repairedCount: number;
  affectedCardIds: string[];
}

const repairedUsers = new Set<string>();

export function resetSplitRepairMigration(userId?: string) {
  if (userId) {
    repairedUsers.delete(userId);
  } else {
    repairedUsers.clear();
  }
}

export function hasUserRunSplitRepair(userId: string): boolean {
  return repairedUsers.has(userId);
}

export function markUserSplitRepairDone(userId: string): void {
  repairedUsers.add(userId);
}

/**
 * Derives a deterministic RFC-4122-shaped UUID from `splitGroupId` so repeated
 * offline repair runs never generate duplicate `(repaired)` friend-share legs.
 */
export function deriveRepairedSplitLegId(splitGroupId: string): string {
  const fnv1a = (input: string, seed: number): number => {
    let hash = seed >>> 0;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
  };

  const p1 = fnv1a(`${splitGroupId}:0`, 0x811c9dc5).toString(16).padStart(8, '0');
  const p2 = fnv1a(`${splitGroupId}:1`, 0x9e3779b9).toString(16).padStart(8, '0');
  const p3 = fnv1a(`${splitGroupId}:2`, 0x85ebca6b).toString(16).padStart(8, '0');
  const p4 = fnv1a(`${splitGroupId}:3`, 0xc2b2ae35).toString(16).padStart(8, '0');
  const hex = `${p1}${p2}${p3}${p4}`;

  // Set version nibble to 4 and variant nibble to a (RFC 4122)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Parses legacy single-legged split note format:
 * "Split with Rahul (Your share: ₹373, Rahul owes: ₹54)"
 * or "Dinner · Split with Amit (Your share: ₹400, Amit owes: ₹400)"
 * or "Split with Bob (Bob owes: ₹1,000)"
 * or "Rahul owes: ₹54"
 */
function extractSplitFriendName(match: RegExpMatchArray): string {
  const raw = match[1] ?? match[2] ?? 'Friend';
  return raw.trim();
}

export function parseSplitNote(notes: string): { friendName: string; amount: number } | null {
  if (!notes) return null;

  const match = notes.match(
    /(?:Split with\s+([^(]+?)\s*\()?(?:Your share:\s*[^,]+,\s*)?(?:([\p{L}\p{M}\p{N} '._-]+?)\s+)?owes:\s*[^\d]*([\d,]+(?:\.\d+)?)/iu
  );
  if (!match) return null;

  const friendName = extractSplitFriendName(match);
  const amount = match[3] ? parseFloat(match[3].replace(/,/g, '')) : 0;
  return !isNaN(amount) && amount > 0 ? { friendName, amount } : null;
}

async function fetchWithUserFallback<T>(
  queryByUser: () => Promise<T[]>,
  queryAll: () => Promise<T[]>
): Promise<T[]> {
  const scoped = await queryByUser();
  return scoped.length > 0 ? scoped : queryAll();
}

function sortDuplicateBucket(bucket: FinanceTransaction[], canonicalId: string): FinanceTransaction[] {
  return [...bucket].sort((a, b) => {
    if (a.id === canonicalId && b.id !== canonicalId) return -1;
    if (b.id === canonicalId && a.id !== canonicalId) return 1;
    return (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id);
  });
}

function collectDuplicateLegsBySignature(activeRepaired: FinanceTransaction[]): FinanceTransaction[][] {
  const bySig = new Map<string, FinanceTransaction[]>();
  for (const t of activeRepaired) {
    const sig = `${t.amount}_${t.accountId}_${t.date}`;
    const bucket = bySig.get(sig) || [];
    bucket.push(t);
    bySig.set(sig, bucket);
  }
  return Array.from(bySig.values()).filter((bucket) => bucket.length > 1);
}

async function softDeleteLeg(params: { dup: FinanceTransaction; now: string }): Promise<void> {
  const { dup, now } = params;
  await db.financeTransactions.update(dup.id, {
    deletedAt: now,
    isDirty: true,
    generationCounter: (dup.generationCounter || 1) + 1,
    updatedAt: now,
  });
}

async function softDeleteDuplicateRepairedLegs(params: {
  splitGroupId: string;
  groupTxs: FinanceTransaction[];
  now: string;
}): Promise<void> {
  const { splitGroupId, groupTxs, now } = params;
  if (groupTxs.length <= 2) return;
  const activeRepaired = groupTxs.filter(
    (t) => !t.deletedAt && t.notes?.includes('(repaired)') && t.tags?.includes('friend-share')
  );
  if (activeRepaired.length <= 1) return;

  const canonicalId = deriveRepairedSplitLegId(splitGroupId);
  const duplicatesToDelete = collectDuplicateLegsBySignature(activeRepaired).flatMap((bucket) =>
    sortDuplicateBucket(bucket, canonicalId).slice(1)
  );
  for (const dup of duplicatesToDelete) {
    await softDeleteLeg({ dup, now });
  }
}

function isEligibleLegacySingleSplit(singleTx: FinanceTransaction): boolean {
  if (singleTx.deletedAt || singleTx.type !== 'expense') return false;
  if (singleTx.tags?.includes('multi-split') || singleTx.tags?.includes('friend-share')) return false;
  return !singleTx.notes?.includes('(repaired)');
}

function findMatchingEverydayDebt(singleTx: FinanceTransaction, userDebts: DebtRecord[]): DebtRecord | undefined {
  const tagSet = new Set((singleTx.tags || []).map((t) => t.toLowerCase()));
  return userDebts.find(
    (d) => d.bucketType === 'everyday_split' && d.startDate === singleTx.date && tagSet.has(d.personName.toLowerCase())
  );
}

function resolveFriendSplitDetails(
  singleTx: FinanceTransaction,
  userDebts: DebtRecord[]
): { friendName: string; friendAmount: number } | null {
  const parsed = singleTx.notes ? parseSplitNote(singleTx.notes) : null;
  if (parsed && parsed.amount > 0) {
    return { friendName: parsed.friendName, friendAmount: parsed.amount };
  }
  if (!singleTx.tags?.includes('split')) return null;

  const matchingDebt = findMatchingEverydayDebt(singleTx, userDebts);
  if (!matchingDebt || matchingDebt.principalAmount <= 0) return null;
  return { friendName: matchingDebt.personName, friendAmount: matchingDebt.principalAmount };
}

function buildRepairedFriendTx(params: {
  singleTx: FinanceTransaction;
  splitGroupId: string;
  friendName: string;
  friendAmount: number;
  debtCatId: string;
  now: string;
}): FinanceTransaction {
  const { singleTx, splitGroupId, friendName, friendAmount, debtCatId, now } = params;
  return {
    id: deriveRepairedSplitLegId(splitGroupId),
    userId: singleTx.userId,
    title: `${friendName}'s Share: ${singleTx.title.replace(/^Split with .*?:\s*/, '')}`,
    amount: friendAmount,
    type: 'expense',
    categoryId: debtCatId,
    subcategory: 'Friend Split',
    accountId: singleTx.accountId,
    date: singleTx.date,
    monthKey: singleTx.monthKey ?? singleTx.date.slice(0, 7),
    notes: `Friend split portion for ${friendName} (repaired) · ${singleTx.title}`,
    tags: Array.from(new Set([...(singleTx.tags ?? []), 'split', friendName.toLowerCase(), 'friend-share'])),
    isRecurring: false,
    recurrenceRule: undefined,
    linkedCommitmentId: null,
    commitmentContributionType: null,
    linkedDebtId: null,
    linkedDebtInstallmentId: null,
    linkedEmiId: null,
    linkedSipId: null,
    statementCycleKey: singleTx.statementCycleKey ?? null,
    paidStatementId: null,
    isCreditCardPayment: false,
    merchantName: singleTx.merchantName,
    rawMerchant: singleTx.rawMerchant,
    needsReview: false,
    splitGroupId,
    isDirty: true,
    generationCounter: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function groupTransactionsBySplitId(txs: FinanceTransaction[]): Map<string, FinanceTransaction[]> {
  const groups = new Map<string, FinanceTransaction[]>();
  for (const tx of txs) {
    if (!tx.splitGroupId) continue;
    const list = groups.get(tx.splitGroupId) || [];
    list.push(tx);
    groups.set(tx.splitGroupId, list);
  }
  return groups;
}

function isDebtCategory(c: { slug?: string; name: string }): boolean {
  if (c.slug === 'emis-debt-repayment') return true;
  const lower = c.name.toLowerCase();
  return lower.includes('debt') || lower.includes('emi');
}

async function loadSplitRepairDependencies(userId: string) {
  const userAccounts = await fetchWithUserFallback(
    () => db.financeAccounts.where('userId').equals(userId).filter((a) => !a.deletedAt).toArray(),
    () => db.financeAccounts.filter((a) => !a.deletedAt).toArray()
  );
  const userCategories = await fetchWithUserFallback(
    () => db.financeCategories.where('userId').equals(userId).filter((c) => !c.deletedAt).toArray(),
    () => db.financeCategories.filter((c) => !c.deletedAt).toArray()
  );
  const userDebts = await fetchWithUserFallback(
    () => db.debtRecords.where('userId').equals(userId).filter((d) => !d.deletedAt).toArray(),
    () => db.debtRecords.filter((d) => !d.deletedAt).toArray()
  );
  const debtCat = userCategories.find(isDebtCategory) ?? userCategories[0];

  return { userAccounts, userDebts, debtCatId: debtCat?.id };
}

async function processSingleSplitGroup(params: {
  splitGroupId: string;
  groupTxs: FinanceTransaction[];
  userAccounts: FinanceAccount[];
  userDebts: DebtRecord[];
  fallbackDebtCatId?: string;
  now: string;
}): Promise<{ repaired: boolean; cardAccountId?: string }> {
  const { splitGroupId, groupTxs, userAccounts, userDebts, fallbackDebtCatId, now } = params;
  await softDeleteDuplicateRepairedLegs({ splitGroupId, groupTxs, now });
  if (groupTxs.length !== 1) return { repaired: false };

  const singleTx = groupTxs[0];
  if (!isEligibleLegacySingleSplit(singleTx)) return { repaired: false };

  const details = resolveFriendSplitDetails(singleTx, userDebts);
  if (!details) return { repaired: false };

  const account = userAccounts.find((a) => a.id === singleTx.accountId) || (await db.financeAccounts.get(singleTx.accountId));
  const friendTx = buildRepairedFriendTx({
    singleTx,
    splitGroupId,
    friendName: details.friendName,
    friendAmount: details.friendAmount,
    debtCatId: fallbackDebtCatId || singleTx.categoryId,
    now,
  });

  await db.financeTransactions.put(friendTx);
  return {
    repaired: true,
    cardAccountId: account?.type === 'credit_card' ? account.id : undefined,
  };
}

async function syncAffectedCards(
  affectedCardIds: string[],
  syncCardStatementsFn?: (cardId: string) => Promise<void>
): Promise<void> {
  if (!syncCardStatementsFn) return;
  for (const cardId of affectedCardIds) {
    await syncCardStatementsFn(cardId);
  }
}

async function repairAllSplitGroups(params: {
  groups: Map<string, FinanceTransaction[]>;
  userAccounts: FinanceAccount[];
  userDebts: DebtRecord[];
  debtCatId?: string;
}) {
  const { groups, userAccounts, userDebts, debtCatId } = params;
  const affectedCardSet = new Set<string>();
  const now = new Date().toISOString();
  let repairedCount = 0;

  for (const [splitGroupId, groupTxs] of groups.entries()) {
    const outcome = await processSingleSplitGroup({
      splitGroupId,
      groupTxs,
      userAccounts,
      userDebts,
      fallbackDebtCatId: debtCatId,
      now,
    });
    if (outcome.repaired) repairedCount++;
    if (outcome.cardAccountId) affectedCardSet.add(outcome.cardAccountId);
  }
  return { repairedCount, affectedCardIds: Array.from(affectedCardSet) };
}

export async function repairLegacySplitTransactions(
  userId: string,
  syncCardStatementsFn?: (cardId: string) => Promise<void>
): Promise<SplitRepairResult> {
  if (!userId) return { repairedCount: 0, affectedCardIds: [] };

  const allSplitTxs = await fetchWithUserFallback(
    () => db.financeTransactions.where('userId').equals(userId).filter((t) => Boolean(t.splitGroupId)).toArray(),
    () => db.financeTransactions.filter((t) => Boolean(t.splitGroupId)).toArray()
  );
  if (allSplitTxs.length === 0) return { repairedCount: 0, affectedCardIds: [] };

  const groups = groupTransactionsBySplitId(allSplitTxs);
  const { userAccounts, userDebts, debtCatId } = await loadSplitRepairDependencies(userId);
  const { repairedCount, affectedCardIds } = await repairAllSplitGroups({
    groups,
    userAccounts,
    userDebts,
    debtCatId,
  });

  await syncAffectedCards(affectedCardIds, syncCardStatementsFn);
  return { repairedCount, affectedCardIds };
}
