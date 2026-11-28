import type { CreditCardStatement, FinanceTransaction } from '@/lib/types';
import {
  resolveTransactionCycle,
  daysBetween,
  getLocalIsoDate,
} from '@/lib/finance/credit-card-cycles';

export type StatementHistoryTab = 'current' | 'unbilled' | 'archive' | 'billed' | 'history';
export type InternalHistoryTab = 'current' | 'unbilled' | 'archive';

export function normalizeInitialTab(tab?: StatementHistoryTab): InternalHistoryTab {
  if (tab === 'unbilled') return 'unbilled';
  if (tab === 'archive' || tab === 'history') return 'archive';
  return 'current';
}
export function getStatusBadgeMeta(status: string, dueDate: string, remainingDue: number) {
  if (remainingDue <= 0 || status === 'paid') {
    return { cls: 'bg-success/10 text-success border-success/20', label: 'Paid', kind: 'ok' as const };
  }
  const diff = daysBetween(getLocalIsoDate(), dueDate);
  if (diff < 0) {
    return { cls: 'bg-destructive/10 text-destructive border-destructive/20', label: `Overdue by ${Math.abs(diff)}d`, kind: 'alert' as const };
  }
  if (diff <= 3) {
    return { cls: 'bg-destructive/10 text-destructive border-destructive/20', label: diff === 0 ? 'Due Today' : `Due in ${diff}d`, kind: 'clock' as const };
  }
  if (diff <= 5) {
    return { cls: 'bg-warning/10 text-warning border-warning/20', label: `Due in ${diff}d`, kind: 'clock' as const };
  }
  return { cls: 'bg-warning/10 text-warning border-warning/20', label: 'Billed', kind: 'none' as const };
}
export function formatSwipeDisplayTitle(tx: FinanceTransaction, categoryName?: string): string {
  return tx.title || tx.merchantName || categoryName || 'Card Swipe';
}

export interface StatementLiveSummarySnapshot {
  overdueStatements: CreditCardStatement[];
  currentBilledStatement?: CreditCardStatement | null;
}

export function mergeStatementsWithLive(
  statements: CreditCardStatement[],
  cardId: string,
  summary: StatementLiveSummarySnapshot | null | undefined
): CreditCardStatement[] {
  const liveMap = new Map<string, CreditCardStatement>();
  if (summary) {
    for (const s of summary.overdueStatements) liveMap.set(s.cycleKey, s);
    if (summary.currentBilledStatement) liveMap.set(summary.currentBilledStatement.cycleKey, summary.currentBilledStatement);
  }
  return statements
    .filter((s) => s.accountId === cardId && !s.deletedAt)
    .map((s) => {
      const live = liveMap.get(s.cycleKey);
      return live ? { ...s, ...live, notes: s.notes ?? live.notes } : s;
    })
    .sort((a, b) => b.cycleKey.localeCompare(a.cycleKey));
}

export function filterCycleTransactions(
  cardTxs: FinanceTransaction[],
  cycleKey: string | undefined,
  billingDay: number,
  dueDay: number
): FinanceTransaction[] {
  if (!cycleKey) return [];
  return cardTxs.filter(
    (t) => resolveTransactionCycle(t.date, billingDay, dueDay, t.statementCycleKey) === cycleKey
  );
}
