import type {
  DebtRecord,
  EmiTracker,
  FinanceAccount,
  FinanceSipPlan,
  FriendLedgerGroup,
} from '@/lib/types';

export interface NetWorthInput {
  accounts: FinanceAccount[];
  sipPlans: FinanceSipPlan[];
  debtRecords: DebtRecord[];
  emiTrackers: EmiTracker[];
}

export interface NetWorthSummaryResult {
  liquidAssets: number;
  investmentAssets: number;
  friendReceivables: number;
  totalAssets: number;
  creditCardLiabilities: number;
  emiRemainingPrincipal: number;
  friendPayables: number;
  totalLiabilities: number;
  netWorth: number;
}

function sumRemainingAmount(records: DebtRecord[]): number {
  return records.reduce((sum, d) => sum + d.remainingAmount, 0);
}

export function calculateDebtSummary(debtRecords: DebtRecord[]) {
  const active = debtRecords.filter((d) => d.status === 'active' && !d.deletedAt);
  const activeBorrowed = active.filter((d) => d.direction === 'borrowed');
  const activeLent = active.filter((d) => d.direction === 'lent');

  const totalBorrowedRemaining = sumRemainingAmount(activeBorrowed);
  const totalLentRemaining = sumRemainingAmount(activeLent);
  const plannedInstallmentsThisMonth = activeBorrowed.reduce(
    (sum, d) => sum + Math.min(d.remainingAmount, d.plannedMonthlyInstallment ?? 0),
    0
  );

  const everydayBorrowedRemaining = sumRemainingAmount(activeBorrowed.filter((d) => d.bucketType === 'everyday_split'));
  const everydayLentRemaining = sumRemainingAmount(activeLent.filter((d) => d.bucketType === 'everyday_split'));
  const longTermBorrowedRemaining = totalBorrowedRemaining - everydayBorrowedRemaining;
  const longTermLentRemaining = totalLentRemaining - everydayLentRemaining;

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

function sumAccountBalancesByTypes(accounts: FinanceAccount[], types: Set<string>): number {
  return accounts.filter((a) => types.has(a.type)).reduce((sum, a) => sum + Math.max(0, a.balance), 0);
}

function computeApproxEmiPrincipalLeft(emiTrackers: EmiTracker[]): number {
  return emiTrackers
    .filter((e) => e.status === 'active' && !e.deletedAt)
    .reduce((sum, e) => {
      const remainingMonths = Math.max(0, e.tenureMonths - e.paidMonths);
      return sum + (e.tenureMonths > 0 ? Math.round((remainingMonths / e.tenureMonths) * e.principalAmount) : 0);
    }, 0);
}

const LIQUID_ACCOUNT_TYPES = new Set(['bank', 'upi', 'cash', 'wallet']);

export function calculateNetWorthSummary(input: NetWorthInput): NetWorthSummaryResult {
  const { accounts, sipPlans, debtRecords, emiTrackers } = input;
  const activeAccounts = accounts.filter(
    (a) => !a.archived && !a.deletedAt && a.includeInNetWorth !== false
  );

  const liquidAssets = sumAccountBalancesByTypes(activeAccounts, LIQUID_ACCOUNT_TYPES);
  const investmentAccountAssets = sumAccountBalancesByTypes(activeAccounts, new Set(['investment']));
  const sipCorpus = sipPlans
    .filter((s) => s.isActive && !s.deletedAt)
    .reduce((sum, s) => sum + Math.max(s.currentValue || 0, s.totalInvested || 0), 0);
  const investmentAssets = investmentAccountAssets + sipCorpus;

  const debtSummary = calculateDebtSummary(debtRecords);
  const friendReceivables = debtSummary.totalLentRemaining;
  const friendPayables = debtSummary.totalBorrowedRemaining;

  const creditCardLiabilities = activeAccounts
    .filter((a) => a.type === 'credit_card')
    .reduce((sum, a) => sum + Math.abs(a.balance), 0);
  const emiRemainingPrincipal = computeApproxEmiPrincipalLeft(emiTrackers);

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

interface RawFriendGroup {
  friendKey: string;
  friendName: string;
  contactInfo?: string;
  records: DebtRecord[];
}

function upsertFriendGroup(groupMap: Map<string, RawFriendGroup>, record: DebtRecord) {
  const trimmed = record.personName.trim();
  const key = trimmed.toLowerCase();
  if (!key) return;

  if (!groupMap.has(key)) {
    groupMap.set(key, { friendKey: key, friendName: trimmed, contactInfo: record.contactInfo, records: [] });
  }
  const g = groupMap.get(key)!;
  g.records.push(record);
  if (trimmed !== key && g.friendName === g.friendName.toLowerCase()) g.friendName = trimmed;
  if (!g.contactInfo && record.contactInfo) g.contactInfo = record.contactInfo;
}

function groupDebtRecordsByFriend(debtRecords: DebtRecord[]): RawFriendGroup[] {
  const groupMap = new Map<string, RawFriendGroup>();
  for (const record of debtRecords) {
    if (!record.deletedAt && record.status !== 'archived') upsertFriendGroup(groupMap, record);
  }
  return Array.from(groupMap.values());
}

function sumActiveRemaining(records: DebtRecord[], direction: 'borrowed' | 'lent'): number {
  return sumRemainingAmount(records.filter((d) => d.direction === direction && d.status === 'active' && !d.deletedAt));
}

function buildFriendLedgerGroup(item: RawFriendGroup): FriendLedgerGroup {
  const everydayRecords = item.records.filter((d) => d.bucketType === 'everyday_split');
  const longTermLoans = item.records.filter((d) => d.bucketType !== 'everyday_split');

  const everydayBorrowedRemaining = sumActiveRemaining(everydayRecords, 'borrowed');
  const everydayLentRemaining = sumActiveRemaining(everydayRecords, 'lent');
  const everydayNet = everydayLentRemaining - everydayBorrowedRemaining;

  const longTermBorrowedRemaining = sumActiveRemaining(longTermLoans, 'borrowed');
  const longTermLentRemaining = sumActiveRemaining(longTermLoans, 'lent');
  const longTermNetPosition = longTermLentRemaining - longTermBorrowedRemaining;

  const hasOpenLoan = (dir: 'borrowed' | 'lent') =>
    longTermLoans.some((d) => d.direction === dir && d.status === 'active' && d.remainingAmount > 0);
  const canOffsetAgainstLoan = (everydayNet > 0 && hasOpenLoan('borrowed')) || (everydayNet < 0 && hasOpenLoan('lent'));

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
    canOffsetAgainstLoan,
    hasActiveEntries: item.records.some((d) => d.status === 'active'),
  };
}

export function calculateFriendLedgerGroups(debtRecords: DebtRecord[]): FriendLedgerGroup[] {
  return groupDebtRecordsByFriend(debtRecords)
    .map(buildFriendLedgerGroup)
    .sort((a, b) => {
      if (a.hasActiveEntries !== b.hasActiveEntries) return a.hasActiveEntries ? -1 : 1;
      const totalA = Math.abs(a.everydayNet) + a.longTermBorrowedRemaining + a.longTermLentRemaining;
      const totalB = Math.abs(b.everydayNet) + b.longTermBorrowedRemaining + b.longTermLentRemaining;
      return totalB - totalA;
    });
}
