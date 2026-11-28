'use client';

import { ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import type { FriendLedgerGroup } from '@/lib/types';
import { formatINR } from '@/lib/stores/finance-store';
import { getNetBadgeInfo } from '@/lib/finance/friend-card-helpers';
import { Button } from '@/components/ui/button';

function formatLoanLoanLine(group: FriendLedgerGroup) {
  if (group.longTermBorrowedRemaining > 0 && group.longTermLentRemaining > 0) {
    return <span>Loans: -{formatINR(group.longTermBorrowedRemaining)} / +{formatINR(group.longTermLentRemaining)}</span>;
  }
  if (group.longTermBorrowedRemaining > 0) {
    return <span className="text-rose-600/90 dark:text-rose-400/90">Loan: -{formatINR(group.longTermBorrowedRemaining)}</span>;
  }
  if (group.longTermLentRemaining > 0) {
    return <span className="text-emerald-600/90 dark:text-emerald-400/90">Loan: +{formatINR(group.longTermLentRemaining)}</span>;
  }
  return <span>No Loans</span>;
}

function FriendNetSummary({ group }: { group: FriendLedgerGroup }) {
  const tabLabel =
    group.everydayNet > 0
      ? { text: `Tab: +${formatINR(group.everydayNet)}`, cls: 'text-emerald-600 dark:text-emerald-400 font-semibold' }
      : group.everydayNet < 0
      ? { text: `Tab: -${formatINR(Math.abs(group.everydayNet))}`, cls: 'text-rose-600 dark:text-rose-400 font-semibold' }
      : { text: 'Tab: Settled', cls: 'text-muted-foreground' };

  return (
    <div className="text-right text-xs">
      <div className="font-mono tabular-nums">
        <span className={tabLabel.cls}>{tabLabel.text}</span>
      </div>
      <div className="font-mono tabular-nums text-[11px] text-muted-foreground">{formatLoanLoanLine(group)}</div>
    </div>
  );
}
export function FriendCardHeader(props: {
  group: FriendLedgerGroup;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenShare: (group: FriendLedgerGroup) => void;
}) {
  const { group, isExpanded, onToggleExpand, onOpenShare } = props;
  const badge = getNetBadgeInfo(group.everydayNet + group.longTermNetPosition);
  const splitWord = group.everydayRecords.length === 1 ? 'Everyday Split' : 'Everyday Splits';
  const loanWord = group.longTermLoans.length === 1 ? 'Loan' : 'Loans';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggleExpand}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleExpand();
        }
      }}
      className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-muted/20 transition-colors select-none"
    >
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-foreground">{group.friendName}</span>
          <span className={`text-[11px] font-bold font-mono tabular-nums px-2 py-0.5 rounded-full ${badge.tone}`}>
            Net: {badge.text}
          </span>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <span>{group.everydayRecords.length} {splitWord}</span>
          <span>·</span>
          <span>{group.longTermLoans.length} {loanWord}</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 ml-auto sm:ml-0">
        <FriendNetSummary group={group} />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onOpenShare(group);
          }}
          className="h-8 px-2.5 text-xs rounded-lg gap-1 border-primary/20 text-primary hover:bg-primary/5"
          title="Share settlement summary via WhatsApp or copy text"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Share</span>
        </Button>

        <button type="button" aria-label="Toggle details" className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
