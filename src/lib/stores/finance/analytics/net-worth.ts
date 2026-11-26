import type { FinanceAccount, NetWorthSummary } from '@/lib/types';
import { getCurrentMonthKey, getPreviousMonthKey, type FinanceStore } from '../helpers';

const LIQUID_ACCOUNT_TYPES = new Set(['bank', 'upi', 'cash', 'wallet']);

function sumAccountBalances(
  accounts: FinanceAccount[],
  predicate: (a: FinanceAccount) => boolean,
  absValue = false
): number {
  return accounts
    .filter(predicate)
    .reduce((sum, a) => sum + (absValue ? Math.abs(a.balance) : Math.max(0, a.balance)), 0);
}

function computeEmiRemainingPrincipal(state: FinanceStore): number {
  return state.emiTrackers
    .filter((e) => e.status === 'active' && !e.deletedAt)
    .reduce((sum, e) => {
      const remainingMonths = Math.max(0, e.tenureMonths - e.paidMonths);
      const approxLeft =
        e.tenureMonths > 0
          ? Math.round((remainingMonths / e.tenureMonths) * e.principalAmount)
          : 0;
      return sum + approxLeft;
    }, 0);
}

export function computeNetWorthSummary(state: FinanceStore): NetWorthSummary {
  const accounts = state.accounts.filter(
    (a) => !a.archived && !a.deletedAt && a.includeInNetWorth !== false
  );
  const liquidAssets = sumAccountBalances(accounts, (a) => LIQUID_ACCOUNT_TYPES.has(a.type));
  const investmentAccountAssets = sumAccountBalances(accounts, (a) => a.type === 'investment');
  const sipCorpus = state.sipPlans
    .filter((s) => s.isActive && !s.deletedAt)
    .reduce((sum, s) => sum + Math.max(s.currentValue || 0, s.totalInvested || 0), 0);

  const debtSummary = state.getDebtSummary();
  const investmentAssets = investmentAccountAssets + sipCorpus;
  const friendReceivables = debtSummary.totalLentRemaining;
  const friendPayables = debtSummary.totalBorrowedRemaining;
  const creditCardLiabilities = sumAccountBalances(accounts, (a) => a.type === 'credit_card', true);
  const emiRemainingPrincipal = computeEmiRemainingPrincipal(state);

  const totalAssets = liquidAssets + investmentAssets + friendReceivables;
  const totalLiabilities = creditCardLiabilities + emiRemainingPrincipal + friendPayables;

  return {
    liquidAssets,
    investmentAssets,
    friendReceivables,
    totalAssets,
    creditCardLiabilities,
    emiRemainingPrincipal,
    friendPayables,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
  };
}

function buildMonthKeysWindow(currentMonth: string, months: number): string[] {
  const keys: string[] = [];
  let cursor = currentMonth;
  for (let i = 0; i < months; i++) {
    keys.unshift(cursor);
    cursor = getPreviousMonthKey(cursor);
  }
  return keys;
}

function buildNetDeltaByMonth(state: FinanceStore): Map<string, number> {
  const deltas = new Map<string, number>();
  for (const tx of state.transactions) {
    if (tx.deletedAt) continue;
    const sign = tx.type === 'income' ? 1 : tx.type === 'expense' ? -1 : 0;
    if (sign !== 0) {
      deltas.set(tx.monthKey, (deltas.get(tx.monthKey) || 0) + sign * tx.amount);
    }
  }
  return deltas;
}

function reconstructHistoryMap(
  monthKeys: string[],
  currentMonth: string,
  currentNW: NetWorthSummary,
  netDeltaByMonth: Map<string, number>
) {
  const map = new Map<string, { netWorth: number; totalAssets: number; totalLiabilities: number }>();
  map.set(currentMonth, {
    netWorth: currentNW.netWorth,
    totalAssets: currentNW.totalAssets,
    totalLiabilities: currentNW.totalLiabilities,
  });

  let runningNW = currentNW.netWorth;
  let runningAssets = currentNW.totalAssets;
  for (let i = monthKeys.length - 1; i > 0; i--) {
    const delta = netDeltaByMonth.get(monthKeys[i]) || 0;
    runningNW = Math.round(runningNW - delta);
    runningAssets = Math.max(0, Math.round(runningAssets - delta));
    map.set(monthKeys[i - 1], {
      netWorth: runningNW,
      totalAssets: runningAssets,
      totalLiabilities: currentNW.totalLiabilities,
    });
  }
  return map;
}

function formatMonthShortLabel(mKey: string): string {
  const [yStr, mStr] = mKey.split('-');
  const d = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'short' });
}

export function computeNetWorthHistory(state: FinanceStore, months = 6) {
  const currentMonth = getCurrentMonthKey();
  const currentNW = state.getNetWorthSummary();
  const savedMap = new Map(
    state.netWorthSnapshots.filter((s) => !s.deletedAt).map((s) => [s.monthKey, s])
  );
  const monthKeys = buildMonthKeysWindow(currentMonth, months);
  const reconstructed = reconstructHistoryMap(
    monthKeys,
    currentMonth,
    currentNW,
    buildNetDeltaByMonth(state)
  );

  return monthKeys.map((mKey) => {
    const snap = savedMap.get(mKey);
    const source = snap && mKey !== currentMonth ? snap : reconstructed.get(mKey) || currentNW;
    return {
      monthKey: mKey,
      label: formatMonthShortLabel(mKey),
      netWorth: Math.round(source.netWorth),
      totalAssets: Math.round(source.totalAssets),
      totalLiabilities: Math.round(source.totalLiabilities),
    };
  });
}
