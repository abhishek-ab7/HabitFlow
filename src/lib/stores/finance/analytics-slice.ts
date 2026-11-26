import { buildCashFlowForecast } from '@/lib/finance/forecast';
import { detectSpendingAnomalies } from '@/lib/finance/anomalies';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import type { CommitmentLedgerSummary } from '@/lib/types';
import type { FinanceSliceCreator, FinanceStore } from './helpers';
import { buildTransactionsCsv } from './analytics/csv-export';
import { computeNetWorthHistory, computeNetWorthSummary } from './analytics/net-worth';
import { computeDailySpendingPace } from './analytics/spending-pace';
import { computeSixMonthTrends, computeYearlyTrends } from './analytics/spending-trends';
import { computeMonthlySummary } from './analytics/monthly-summary';
import {
  computeCommitmentLedger,
  computeDebtSummary,
  computeFriendLedgerGroups,
} from './analytics/debt-and-friends';
import { computeUpcomingObligations } from './analytics/obligations';
import { filterTransactions } from './analytics/tx-filter';

export type AnalyticsSlice = Pick<
  FinanceStore,
  | 'exportTransactionsCsv'
  | 'getNetWorthSummary'
  | 'getNetWorthHistory'
  | 'getDailySpendingPace'
  | 'getCommitmentLedger'
  | 'getAllCommitmentLedgers'
  | 'getMonthlySummary'
  | 'getFriendLedgerGroups'
  | 'getDebtSummary'
  | 'getDebtInstallments'
  | 'getUpcomingFinancialObligations'
  | 'getFilteredTransactions'
  | 'getSixMonthSpendingTrends'
  | 'getYearlySpendingTrends'
  | 'getCashFlowForecast'
  | 'getSpendingAnomalies'
>;

interface MemoEntry {
  refs: unknown[];
  argKey: string;
  value: unknown;
}

function isMemoValid(entry: MemoEntry | undefined, refs: unknown[], argKey: string): boolean {
  if (!entry) return false;
  if (entry.argKey !== argKey) return false;
  if (entry.refs.length !== refs.length) return false;
  return entry.refs.every((r, idx) => Object.is(r, refs[idx]));
}

export const createAnalyticsSlice: FinanceSliceCreator<AnalyticsSlice> = (_set, get) => {
  const memoCache = new Map<string, MemoEntry>();

  function memoize<T>(slotKey: string, refs: unknown[], argKey: string, compute: () => T): T {
    const entry = memoCache.get(slotKey);
    if (isMemoValid(entry, refs, argKey)) {
      return entry!.value as T;
    }
    const value = compute();
    memoCache.set(slotKey, { refs, argKey, value });
    return value;
  }

  return {
    exportTransactionsCsv: (monthKey) =>
      buildTransactionsCsv(get().getFilteredTransactions(monthKey), get()),

    getNetWorthSummary: () => {
      const s = get();
      return memoize('netWorthSummary', [s.accounts, s.sipPlans, s.debtRecords, s.emiTrackers], '', () =>
        computeNetWorthSummary(s)
      );
    },

    getNetWorthHistory: (months = 6) => computeNetWorthHistory(get(), months),

    getDailySpendingPace: (monthKey) => computeDailySpendingPace(get(), monthKey),

    getCommitmentLedger: (commitmentId, monthKey) =>
      computeCommitmentLedger(get(), commitmentId, monthKey),

    getAllCommitmentLedgers: (monthKey) => {
      const targetMonth = monthKey || get().selectedMonth;
      return get()
        .commitments.filter((c) => c.isActive && !c.deletedAt)
        .map((c) => get().getCommitmentLedger(c.id, targetMonth))
        .filter((l): l is CommitmentLedgerSummary => l !== null);
    },

    getMonthlySummary: (monthKey) => {
      const s = get();
      const targetMonth = monthKey || s.selectedMonth;
      return memoize(
        `monthlySummary:${targetMonth}`,
        [
          s.transactions,
          s.budgets,
          s.categories,
          s.commitments,
          s.emiTrackers,
          s.debtRecords,
          s.debtInstallments,
          s.recurringBills,
          s.sipPlans,
        ],
        `${targetMonth}|${getLocalIsoDate()}`,
        () => computeMonthlySummary(s, targetMonth)
      );
    },

    getFriendLedgerGroups: () => {
      const s = get();
      return memoize('friendLedgerGroups', [s.debtRecords], '', () =>
        computeFriendLedgerGroups(s.debtRecords)
      );
    },

    getDebtSummary: () => {
      const s = get();
      return memoize('debtSummary', [s.debtRecords], '', () => computeDebtSummary(s.debtRecords));
    },

    getDebtInstallments: (debtId) =>
      get()
        .debtInstallments.filter((i) => i.debtId === debtId && !i.deletedAt)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),

    getUpcomingFinancialObligations: (withinDays = 7) => {
      const s = get();
      return memoize(
        `upcomingObligations:${withinDays}`,
        [
          s.emiTrackers,
          s.transactions,
          s.commitments,
          s.debtRecords,
          s.debtInstallments,
          s.recurringBills,
          s.sipPlans,
          s.accounts,
          s.creditCardStatements,
        ],
        `${withinDays}|${getLocalIsoDate()}`,
        () => computeUpcomingObligations(s, withinDays)
      );
    },

    getFilteredTransactions: (monthKey) => {
      const { filters, transactions, selectedMonth } = get();
      const targetMonth =
        filters.dateFrom || filters.dateTo ? 'all' : monthKey || selectedMonth;
      return memoize(`filteredTx:${targetMonth}`, [transactions, filters], targetMonth, () =>
        filterTransactions(transactions, filters, targetMonth)
      );
    },

    getSixMonthSpendingTrends: (endMonthKey, categoryId = 'all') =>
      computeSixMonthTrends(get(), endMonthKey, categoryId),

    getYearlySpendingTrends: (endMonthKey, categoryId = 'all', yearCount = 5) =>
      computeYearlyTrends(get(), endMonthKey, categoryId, yearCount),

    getCashFlowForecast: (horizonDays = 30, includeDiscretionaryBurn = true) => {
      const s = get();
      return buildCashFlowForecast({
        accounts: s.accounts,
        transactions: s.transactions,
        budgets: s.budgets,
        recurringBills: s.recurringBills,
        emiTrackers: s.emiTrackers,
        sipPlans: s.sipPlans,
        commitments: s.commitments,
        creditCardStatements: s.creditCardStatements,
        horizonDays,
        includeDiscretionaryBurn,
      });
    },

    getSpendingAnomalies: (monthKey) => {
      const s = get();
      const targetMonth = monthKey || s.selectedMonth;
      return memoize(
        `spendingAnomalies:${targetMonth}`,
        [
          s.transactions,
          s.categories,
          s.accounts,
          s.debtRecords,
          s.recurringBills,
          s.creditCardStatements,
          s.emiTrackers,
          s.commitments,
          s.debtInstallments,
          s.sipPlans,
        ],
        `${targetMonth}|${getLocalIsoDate()}`,
        () =>
          detectSpendingAnomalies({
            selectedMonth: targetMonth,
            transactions: s.transactions,
            categories: s.categories,
            accounts: s.accounts,
            debtRecords: s.debtRecords,
            recurringBills: s.recurringBills,
            upcomingObligations7d: s.getUpcomingFinancialObligations(7),
          })
      );
    },
  };
};
