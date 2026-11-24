import { db } from '@/lib/db';
import type { FinanceTransaction } from '@/lib/types';

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
export function parseSplitNote(notes: string): { friendName: string; amount: number } | null {
  if (!notes) return null;

  // Regex pattern matching:
  // Optional "Split with <Name> ("
  // Optional "Your share: ₹..., "
  // Optional "<Name> " before "owes:"
  // "owes: ₹<amount>"
  const match = notes.match(
    /(?:Split with\s+([^(]+?)\s*\()?(?:Your share:\s*[^,]+,\s*)?(?:([\p{L}\p{M}\p{N} '._-]+?)\s+)?owes:\s*[^\d]*([\d,]+(?:\.\d+)?)/iu
  );

  if (!match) return null;

  const friendName = (match[1] || match[2] || 'Friend').trim();
  const rawAmount = match[3]?.replace(/,/g, '');
  const amount = rawAmount ? parseFloat(rawAmount) : 0;

  if (isNaN(amount) || amount <= 0) return null;

  return { friendName, amount };
}

/**
 * Idempotently scans for legacy single-legged split transactions in Dexie and creates the
 * missing friend-share leg on the same account/card under EMIs & Debt ('Friend Split').
 *
 * CRITICAL SAFETY:
 * Does NOT alter `financeAccounts.balance` because the legacy code already deducted
 * `friendPortion` from the balance. Adding the transaction record in Dexie restores
 * ledger integrity and unbilled credit card spend without double-deduction.
 *
 * ROBUSTNESS GUARANTEE:
 * Inspects all transactions (including soft-deleted records) for each splitGroupId.
 * If a split group already had multiple legs (or a leg was explicitly deleted by the user),
 * it is NEVER touched.
 */
export async function repairLegacySplitTransactions(
  userId: string,
  syncCardStatementsFn?: (cardId: string) => Promise<void>
): Promise<SplitRepairResult> {
  const result: SplitRepairResult = {
    repairedCount: 0,
    affectedCardIds: [],
  };

  if (!userId) return result;

  // 1. Fetch all transactions for user that belong to a split group (including soft-deleted)
  let allSplitTxs = await db.financeTransactions
    .where('userId')
    .equals(userId)
    .filter((t) => !!t.splitGroupId)
    .toArray();

  if (allSplitTxs.length === 0) {
    allSplitTxs = await db.financeTransactions
      .filter((t) => !!t.splitGroupId)
      .toArray();
  }

  if (allSplitTxs.length === 0) return result;

  // 2. Group by splitGroupId
  const groups = new Map<string, FinanceTransaction[]>();
  for (const tx of allSplitTxs) {
    if (!tx.splitGroupId) continue;
    const list = groups.get(tx.splitGroupId) || [];
    list.push(tx);
    groups.set(tx.splitGroupId, list);
  }

  // 3. Find user accounts, categories, and debts for lookups
  let userAccounts = await db.financeAccounts
    .where('userId')
    .equals(userId)
    .filter((a) => !a.deletedAt)
    .toArray();

  if (userAccounts.length === 0) {
    userAccounts = await db.financeAccounts.filter((a) => !a.deletedAt).toArray();
  }

  let userCategories = await db.financeCategories
    .where('userId')
    .equals(userId)
    .filter((c) => !c.deletedAt)
    .toArray();

  if (userCategories.length === 0) {
    userCategories = await db.financeCategories.filter((c) => !c.deletedAt).toArray();
  }

  let userDebts = await db.debtRecords
    .where('userId')
    .equals(userId)
    .filter((d) => !d.deletedAt)
    .toArray();

  if (userDebts.length === 0) {
    userDebts = await db.debtRecords.filter((d) => !d.deletedAt).toArray();
  }

  const debtCat =
    userCategories.find((c) => c.slug === 'emis-debt-repayment') ||
    userCategories.find((c) => c.name.toLowerCase().includes('debt') || c.name.toLowerCase().includes('emi')) ||
    userCategories[0];

  const affectedCardSet = new Set<string>();
  const now = new Date().toISOString();

  for (const [splitGroupId, groupTxs] of groups.entries()) {
    // If duplicate `(repaired)` friend-share legs exist from prior non-deterministic runs,
    // soft-delete redundant extras without altering account balances.
    if (groupTxs.length > 2) {
      const activeRepaired = groupTxs.filter(
        (t) => !t.deletedAt && t.notes?.includes('(repaired)') && t.tags?.includes('friend-share')
      );
      if (activeRepaired.length > 1) {
        const canonicalId = deriveRepairedSplitLegId(splitGroupId);
        const bySig = new Map<string, FinanceTransaction[]>();
        for (const t of activeRepaired) {
          const sig = `${t.amount}_${t.accountId}_${t.date}`;
          const bucket = bySig.get(sig) || [];
          bucket.push(t);
          bySig.set(sig, bucket);
        }
        for (const bucket of bySig.values()) {
          if (bucket.length <= 1) continue;
          bucket.sort((a, b) => {
            if (a.id === canonicalId && b.id !== canonicalId) return -1;
            if (b.id === canonicalId && a.id !== canonicalId) return 1;
            return (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id);
          });
          for (const dup of bucket.slice(1)) {
            await db.financeTransactions.update(dup.id, {
              deletedAt: now,
              isDirty: true,
              generationCounter: (dup.generationCounter || 1) + 1,
              updatedAt: now,
            });
          }
        }
      }
    }

    // A legacy split group ONLY ever had exactly 1 transaction created in history.
    // If there is more than 1 transaction (active or deleted), this was already a multi-legged
    // split or a repaired split, and must never be touched.
    if (groupTxs.length !== 1) continue;

    const singleTx = groupTxs[0];

    // If the single transaction itself is deleted, do not resurrect it
    if (singleTx.deletedAt) continue;

    // A legacy split transaction was always an active user expense leg.
    // If it's tagged 'friend-share' or 'multi-split', or already contains '(repaired)', skip.
    if (
      singleTx.type !== 'expense' ||
      singleTx.tags?.includes('multi-split') ||
      singleTx.tags?.includes('friend-share') ||
      singleTx.notes?.includes('(repaired)')
    ) {
      continue;
    }

    let friendName: string | null = null;
    let friendAmount: number | null = null;

    const parsed = singleTx.notes ? parseSplitNote(singleTx.notes) : null;
    if (parsed && parsed.amount > 0) {
      friendName = parsed.friendName;
      friendAmount = parsed.amount;
    } else if (singleTx.tags?.includes('split')) {
      // Fallback: look for everyday split debt matching date or friend tag
      const matchingDebt = userDebts.find(
        (d) =>
          d.bucketType === 'everyday_split' &&
          d.startDate === singleTx.date &&
          singleTx.tags?.some((t) => t.toLowerCase() === d.personName.toLowerCase())
      );
      if (matchingDebt && matchingDebt.principalAmount > 0) {
        friendName = matchingDebt.personName;
        friendAmount = matchingDebt.principalAmount;
      }
    }

    if (!friendName || !friendAmount || friendAmount <= 0) continue;

    // Check account
    const account =
      userAccounts.find((a) => a.id === singleTx.accountId) ||
      (await db.financeAccounts.get(singleTx.accountId));
    const debtCatId = debtCat ? debtCat.id : singleTx.categoryId;

    // Create the missing friend-share transaction with deterministic ID
    const friendTx: FinanceTransaction = {
      id: deriveRepairedSplitLegId(splitGroupId),
      userId: singleTx.userId,
      title: `${friendName}'s Share: ${singleTx.title.replace(/^Split with .*?:\s*/, '')}`,
      amount: friendAmount,
      type: 'expense',
      categoryId: debtCatId,
      subcategory: 'Friend Split',
      accountId: singleTx.accountId,
      date: singleTx.date,
      monthKey: singleTx.monthKey || singleTx.date.slice(0, 7),
      notes: `Friend split portion for ${friendName} (repaired) · ${singleTx.title}`,
      tags: Array.from(
        new Set([...(singleTx.tags || []), 'split', friendName.toLowerCase(), 'friend-share'])
      ),
      isRecurring: false,
      recurrenceRule: undefined,
      linkedCommitmentId: null,
      commitmentContributionType: null,
      linkedDebtId: null,
      linkedDebtInstallmentId: null,
      linkedEmiId: null,
      linkedSipId: null,
      statementCycleKey: singleTx.statementCycleKey || null,
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

    // IMPORTANT: Add transaction to Dexie WITHOUT altering financeAccounts.balance
    // because legacy code already deducted friendPortion from account.balance.
    await db.financeTransactions.put(friendTx);
    result.repairedCount++;

    if (account?.type === 'credit_card') {
      affectedCardSet.add(account.id);
    }
  }

  result.affectedCardIds = Array.from(affectedCardSet);

  if (syncCardStatementsFn && result.affectedCardIds.length > 0) {
    for (const cardId of result.affectedCardIds) {
      await syncCardStatementsFn(cardId);
    }
  }

  return result;
}
