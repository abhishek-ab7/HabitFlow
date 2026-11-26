import { db } from '@/lib/db';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import type { FinanceNetWorthSnapshot, NetWorthSummary } from '@/lib/types';
import { getCurrentMonthKey, resolveCurrentUserId, type FinanceStore } from '../helpers';
import { updateTrackerEntity } from '../trackers/crud-factory';

function snapshotMatchesSummary(existing: FinanceNetWorthSnapshot, nw: NetWorthSummary): boolean {
  return (
    Math.abs(existing.netWorth - nw.netWorth) < 1 &&
    Math.abs(existing.totalAssets - nw.totalAssets) < 1 &&
    Math.abs(existing.totalLiabilities - nw.totalLiabilities) < 1
  );
}

function buildSnapshotPayload(nw: NetWorthSummary, todayStr: string, now: string) {
  return {
    snapshotDate: todayStr,
    liquidAssets: nw.liquidAssets,
    investmentAssets: nw.investmentAssets,
    friendReceivables: nw.friendReceivables,
    totalAssets: nw.totalAssets,
    creditCardLiabilities: nw.creditCardLiabilities,
    emiRemainingPrincipal: nw.emiRemainingPrincipal,
    friendPayables: nw.friendPayables,
    totalLiabilities: nw.totalLiabilities,
    netWorth: nw.netWorth,
    isDirty: true,
    updatedAt: now,
  };
}

export async function recordCurrentNetWorthSnapshotImpl(
  state: FinanceStore,
  setSnapshots: (snapshots: FinanceNetWorthSnapshot[]) => void,
  monthKey?: string
): Promise<void> {
  if (!db.financeNetWorthSnapshots) return;
  try {
    const userId = await resolveCurrentUserId(undefined, state.currentUserId);
    if (!userId) return;

    const targetMonth = monthKey || getCurrentMonthKey();
    const nw = state.getNetWorthSummary();
    const now = new Date().toISOString();
    const payload = buildSnapshotPayload(nw, getLocalIsoDate(), now);

    const existing = await db.financeNetWorthSnapshots
      .where('[userId+monthKey]')
      .equals([userId, targetMonth])
      .first();

    if (existing) {
      if (snapshotMatchesSummary(existing, nw)) return;
      await db.financeNetWorthSnapshots.update(existing.id, payload);
    } else {
      await db.financeNetWorthSnapshots.add({
        id: crypto.randomUUID(),
        userId,
        monthKey: targetMonth,
        generationCounter: 1,
        createdAt: now,
        ...payload,
      });
    }

    const snapshots = await db.financeNetWorthSnapshots
      .where('userId')
      .equals(userId)
      .filter((s) => !s.deletedAt)
      .sortBy('monthKey');
    setSnapshots(snapshots);
  } catch {
    // Non-blocking snapshot capture
  }
}

async function logBalanceAdjustmentTx(
  state: FinanceStore,
  account: { id: string; name: string; balance: number },
  variance: number,
  targetBalance: number
): Promise<void> {
  const fallbackCat =
    state.categories.find((c) => c.slug === 'investments-savings') || state.categories[0];
  await state.addTransaction({
    title: `Balance Adjustment — ${account.name}`,
    amount: Math.abs(variance),
    type: variance > 0 ? 'income' : 'expense',
    categoryId: fallbackCat?.id || 'uncategorized',
    accountId: account.id,
    date: getLocalIsoDate(),
    notes: `Reconciled ${account.name} from ₹${account.balance} to ₹${targetBalance}`,
    tags: ['reconciliation'],
    needsReview: false,
  });
}

export async function reconcileAccountBalanceImpl(
  getState: () => FinanceStore,
  accountId: string,
  actualBalance: number,
  logAdjustmentTransaction = true
): Promise<{ variance: number; adjusted: boolean }> {
  const state = getState();
  const account = state.accounts.find((a) => a.id === accountId);
  if (!account) return { variance: 0, adjusted: false };

  const targetBalance = Math.round(Number(actualBalance) * 100) / 100;
  const variance = Math.round((targetBalance - Number(account.balance || 0)) * 100) / 100;
  if (Math.abs(variance) < 0.01) return { variance: 0, adjusted: false };

  if (logAdjustmentTransaction) {
    await logBalanceAdjustmentTx(state, account, variance, targetBalance);
  } else {
    await updateTrackerEntity({
      getState,
      table: db.financeAccounts,
      existing: account,
      data: { balance: targetBalance },
      recordNetWorth: true,
    });
  }
  return { variance, adjusted: true };
}
