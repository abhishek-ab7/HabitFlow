import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import type { FinancialObligationItem } from '@/lib/types';
import { getCurrentMonthKey, type FinanceStore } from '../helpers';
import {
  toCommitmentObligation,
  toCreditCardObligation,
  toDebtObligation,
  toEmiObligation,
  toScheduledItemObligation,
  type ObligationWindow,
} from './obligations-mappers';

function compact<T>(items: Array<T | null>): T[] {
  return items.filter((item): item is T => item !== null);
}

export function computeUpcomingObligations(
  state: FinanceStore,
  withinDays = 7
): FinancialObligationItem[] {
  const now = new Date();
  const win: ObligationWindow = {
    currentDay: now.getDate(),
    currentMonthKey: getCurrentMonthKey(now),
    withinDays,
    todayStr: getLocalIsoDate(now),
  };

  return [
    ...compact(state.emiTrackers.map((e) => toEmiObligation(e, state, win))),
    ...compact(
      state.getAllCommitmentLedgers(win.currentMonthKey).map((l) => toCommitmentObligation(l, win))
    ),
    ...compact(state.debtRecords.map((d) => toDebtObligation(d, state, win))),
    ...compact(
      state.recurringBills.map((b) =>
        toScheduledItemObligation({
          id: b.id,
          type: 'bill',
          title: b.name,
          subtitle: `Recurring ${b.cadence} bill`,
          amount: b.amount,
          dayOfMonth: b.dueDayOfMonth,
          isActive: b.isActive,
          deletedAt: b.deletedAt,
          lastPaidMonthKey: b.lastPaidMonthKey,
          win,
        })
      )
    ),
    ...compact(
      state.sipPlans.map((s) =>
        toScheduledItemObligation({
          id: s.id,
          type: 'sip',
          title: `SIP: ${s.name}`,
          subtitle: `${s.platform || 'Investment'} · Monthly SIP`,
          amount: s.monthlyAmount,
          dayOfMonth: s.sipDayOfMonth,
          isActive: s.isActive,
          deletedAt: s.deletedAt,
          lastPaidMonthKey: s.lastInvestedMonthKey,
          win,
        })
      )
    ),
    ...compact(state.accounts.map((a) => toCreditCardObligation(a, state, win))),
  ].sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}
