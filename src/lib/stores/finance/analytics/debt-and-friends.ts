import type {
  CommitmentLedgerSummary,
  DebtRecord,
  DebtSummaryBreakdown,
  FriendLedgerGroup,
} from '@/lib/types';
import { getPreviousMonthKey, type FinanceStore } from '../helpers';

function sumActiveRemaining(
  records: DebtRecord[],
  direction: DebtRecord['direction']
): number {
  return records
    .filter((d) => d.direction === direction && d.status === 'active')
    .reduce((sum, d) => sum + d.remainingAmount, 0);
}

function groupDebtsByFriend(records: DebtRecord[]) {
  const groupMap = new Map<
    string,
    { friendKey: string; friendName: string; contactInfo?: string; records: DebtRecord[] }
  >();

  for (const record of records) {
    const trimmed = record.personName.trim();
    const key = trimmed.toLowerCase();
    if (!key) continue;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        friendKey: key,
        friendName: trimmed,
        contactInfo: record.contactInfo,
        records: [],
      });
    }
    const g = groupMap.get(key)!;
    g.records.push(record);
    if (trimmed !== key && g.friendName === g.friendName.toLowerCase()) {
      g.friendName = trimmed;
    }
    if (!g.contactInfo && record.contactInfo) {
      g.contactInfo = record.contactInfo;
    }
  }
  return groupMap;
}

function hasActiveLoanWithBalance(
  loans: DebtRecord[],
  direction: DebtRecord['direction']
): boolean {
  return loans.some(
    (d) => d.direction === direction && d.status === 'active' && d.remainingAmount > 0
  );
}

function hasAnyActiveEntry(records: DebtRecord[]): boolean {
  return records.some((d) => d.status === 'active');
}

function buildFriendGroup(item: {
  friendKey: string;
  friendName: string;
  contactInfo?: string;
  records: DebtRecord[];
}): FriendLedgerGroup {
  const everydayRecords = item.records.filter((d) => d.bucketType === 'everyday_split');
  const longTermLoans = item.records.filter((d) => d.bucketType !== 'everyday_split');

  const everydayBorrowedRemaining = sumActiveRemaining(everydayRecords, 'borrowed');
  const everydayLentRemaining = sumActiveRemaining(everydayRecords, 'lent');
  const everydayNet = everydayLentRemaining - everydayBorrowedRemaining;

  const longTermBorrowedRemaining = sumActiveRemaining(longTermLoans, 'borrowed');
  const longTermLentRemaining = sumActiveRemaining(longTermLoans, 'lent');
  const longTermNetPosition = longTermLentRemaining - longTermBorrowedRemaining;

  const canOffset =
    (everydayNet > 0 && hasActiveLoanWithBalance(longTermLoans, 'borrowed')) ||
    (everydayNet < 0 && hasActiveLoanWithBalance(longTermLoans, 'lent'));

  return {
    friendKey: item.friendKey,
    friendName: item.friendName,
    contactInfo: item.contactInfo,
    everydayRecords,
    everydayBorrowedRemaining,
    everydayLentRemaining,
    everydayNet,
    longTermLoans,
    longTermBorrowedRemaining,
    longTermLentRemaining,
    longTermNetPosition,
    canOffsetAgainstLoan: canOffset,
    hasActiveEntries: hasAnyActiveEntry(everydayRecords) || hasAnyActiveEntry(longTermLoans),
  };
}

export function computeFriendLedgerGroups(debtRecords: DebtRecord[]): FriendLedgerGroup[] {
  const active = debtRecords.filter((d) => !d.deletedAt && d.status !== 'archived');
  const groups = Array.from(groupDebtsByFriend(active).values()).map(buildFriendGroup);

  return groups.sort((a, b) => {
    if (a.hasActiveEntries !== b.hasActiveEntries) return a.hasActiveEntries ? -1 : 1;
    const totalA = Math.abs(a.everydayNet) + a.longTermBorrowedRemaining + a.longTermLentRemaining;
    const totalB = Math.abs(b.everydayNet) + b.longTermBorrowedRemaining + b.longTermLentRemaining;
    return totalB - totalA;
  });
}

export function computeDebtSummary(debtRecords: DebtRecord[]): DebtSummaryBreakdown {
  const activeBorrowed = debtRecords.filter(
    (d) => d.direction === 'borrowed' && d.status === 'active' && !d.deletedAt
  );
  const activeLent = debtRecords.filter(
    (d) => d.direction === 'lent' && d.status === 'active' && !d.deletedAt
  );

  const totalBorrowedRemaining = activeBorrowed.reduce((sum, d) => sum + d.remainingAmount, 0);
  const totalLentRemaining = activeLent.reduce((sum, d) => sum + d.remainingAmount, 0);
  const plannedInstallmentsThisMonth = activeBorrowed.reduce(
    (sum, d) => sum + Math.min(d.remainingAmount, d.plannedMonthlyInstallment || 0),
    0
  );

  const everydayBorrowedRemaining = sumActiveRemaining(
    activeBorrowed.filter((d) => d.bucketType === 'everyday_split'),
    'borrowed'
  );
  const everydayLentRemaining = sumActiveRemaining(
    activeLent.filter((d) => d.bucketType === 'everyday_split'),
    'lent'
  );
  const longTermBorrowedRemaining = sumActiveRemaining(
    activeBorrowed.filter((d) => d.bucketType !== 'everyday_split'),
    'borrowed'
  );
  const longTermLentRemaining = sumActiveRemaining(
    activeLent.filter((d) => d.bucketType !== 'everyday_split'),
    'lent'
  );

  return {
    totalBorrowedRemaining,
    totalLentRemaining,
    netPosition: totalLentRemaining - totalBorrowedRemaining,
    plannedInstallmentsThisMonth,
    activeBorrowedCount: activeBorrowed.length,
    activeLentCount: activeLent.length,
    everydayBorrowedRemaining,
    everydayLentRemaining,
    everydayNetPosition: everydayLentRemaining - everydayBorrowedRemaining,
    longTermBorrowedRemaining,
    longTermLentRemaining,
    longTermNetPosition: longTermLentRemaining - longTermBorrowedRemaining,
  };
}

function resolveCommitmentStatus(
  overpaidAmount: number,
  remainingBalance: number,
  totalFulfilled: number,
  effectiveTarget: number
): CommitmentLedgerSummary['status'] {
  if (overpaidAmount > 0) return 'overpaid';
  if (remainingBalance === 0 && totalFulfilled >= effectiveTarget) return 'settled';
  if (totalFulfilled > 0) return 'in_progress';
  return 'unpaid';
}

export function computeCommitmentLedger(
  state: FinanceStore,
  commitmentId: string,
  monthKey?: string
): CommitmentLedgerSummary | null {
  const targetMonth = monthKey || state.selectedMonth;
  const commitment = state.commitments.find((c) => c.id === commitmentId);
  if (!commitment) return null;

  let rolloverFromPreviousMonth = 0;
  if (commitment.autoRolloverOverpayment) {
    const prevMonth = getPreviousMonthKey(targetMonth);
    const prevFulfilled = state.transactions
      .filter((t) => t.linkedCommitmentId === commitmentId && t.monthKey === prevMonth)
      .reduce((sum, t) => sum + t.amount, 0);
    rolloverFromPreviousMonth = Math.max(0, prevFulfilled - commitment.monthlyTargetAmount);
  }

  const baseTargetAmount = commitment.monthlyTargetAmount;
  const effectiveTargetAmount = Math.max(0, baseTargetAmount - rolloverFromPreviousMonth);
  const monthTransactions = state.transactions.filter(
    (t) => t.linkedCommitmentId === commitmentId && t.monthKey === targetMonth
  );
  const directTransactions = monthTransactions.filter(
    (t) => t.commitmentContributionType === 'direct_payment'
  );
  const offsetTransactions = monthTransactions.filter(
    (t) => t.commitmentContributionType !== 'direct_payment'
  );

  const directPaidAmount = directTransactions.reduce((sum, t) => sum + t.amount, 0);
  const offsetExpensesAmount = offsetTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalFulfilledAmount = directPaidAmount + offsetExpensesAmount;
  const remainingBalance = Math.max(0, effectiveTargetAmount - totalFulfilledAmount);
  const overpaidAmount = Math.max(0, totalFulfilledAmount - effectiveTargetAmount);

  return {
    commitment,
    monthKey: targetMonth,
    baseTargetAmount,
    rolloverFromPreviousMonth,
    effectiveTargetAmount,
    directPaidAmount,
    offsetExpensesAmount,
    totalFulfilledAmount,
    remainingBalance,
    overpaidAmount,
    progressPercentage:
      effectiveTargetAmount > 0
        ? Math.min(100, Math.round((totalFulfilledAmount / effectiveTargetAmount) * 100))
        : 100,
    status: resolveCommitmentStatus(
      overpaidAmount,
      remainingBalance,
      totalFulfilledAmount,
      effectiveTargetAmount
    ),
    transactions: monthTransactions,
    directTransactions,
    offsetTransactions,
  };
}
