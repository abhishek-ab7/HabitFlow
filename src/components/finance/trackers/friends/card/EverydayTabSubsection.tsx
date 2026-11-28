'use client';

import React from 'react';
import { ArrowLeftRight, CheckCircle2, Pencil, Plus, Receipt, Trash2 } from 'lucide-react';
import type { DebtRecord, FriendLedgerGroup } from '@/lib/types';
import { formatINR } from '@/lib/stores/finance-store';
import { formatHumanDate } from '@/lib/date-format';
import { getEverydayTabSubtitle } from '@/lib/finance/friend-card-helpers';
import { Button } from '@/components/ui/button';

const EverydaySplitRow = React.memo(function EverydaySplitRow(props: {
  split: DebtRecord;
  onToggleBucket: (debt: DebtRecord) => void;
  onEditDebt: (debt: DebtRecord) => void;
  onDeleteDebt: (debtId: string, title: string) => void;
}) {
  const { split, onToggleBucket, onEditDebt, onDeleteDebt } = props;
  const isLent = split.direction === 'lent';
  const isSettled = split.status === 'settled';
  return (
    <div className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${isSettled ? 'bg-muted/30 border-border/40 opacity-70' : 'bg-background border-border/70'}`}>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{split.title}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md ${isLent ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
            {isLent ? 'They owe you' : 'You owe'}
          </span>
          {isSettled && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.2 rounded-md">Settled</span>}
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
          <span>{formatHumanDate(split.startDate)}</span>
          {split.notes && (
            <>
              <span>·</span>
              <span className="truncate max-w-[200px]">{split.notes}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="text-right font-mono tabular-nums">
          <span className={`font-bold ${isLent ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {formatINR(split.remainingAmount)}
          </span>
          {split.totalRepaidAmount > 0 && !isSettled && (
            <span className="block text-[10px] text-muted-foreground">Repaid: {formatINR(split.totalRepaidAmount)}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" title="Move to Long-Term Loans" aria-label="Move to Long-Term Loans" onClick={() => onToggleBucket(split)} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted">
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>
          <button type="button" aria-label="Edit split" onClick={() => onEditDebt(split)} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button type="button" aria-label="Delete split" onClick={() => onDeleteDebt(split.id, split.title)} className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});

export function EverydayTabSubsection(props: {
  group: FriendLedgerGroup;
  onOpenNewSplit: (friendName: string) => void;
  onOpenSettleTab: (group: FriendLedgerGroup) => void;
  onOpenOffset: (group: FriendLedgerGroup) => void;
  onToggleBucket: (debt: DebtRecord) => void;
  onEditDebt: (debt: DebtRecord) => void;
  onDeleteDebt: (debtId: string, title: string) => void;
  onTapFeedback: () => void;
}) {
  const { group, onOpenNewSplit, onOpenSettleTab, onOpenOffset, onToggleBucket, onEditDebt, onDeleteDebt, onTapFeedback } = props;
  const tabSubtitle = getEverydayTabSubtitle(group.friendName, group.everydayNet);

  return (
    <div className="p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-primary" />
            Everyday Running Tab
          </span>
          <p className="text-[11px] text-muted-foreground">{tabSubtitle}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button type="button" size="sm" variant="outline" onClick={() => onOpenNewSplit(group.friendName)} className="h-8 px-2.5 text-xs rounded-lg gap-1">
            <Plus className="w-3.5 h-3.5" />
            Add Split
          </Button>
          {group.everydayRecords.some((r) => r.status === 'active') && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                onTapFeedback();
                onOpenSettleTab(group);
              }}
              className="h-8 px-2.5 text-xs rounded-lg gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Settle Tab
            </Button>
          )}
          {group.canOffsetAgainstLoan && (
            <Button type="button" size="sm" variant="outline" onClick={() => onOpenOffset(group)} className="h-8 px-2.5 text-xs rounded-lg gap-1 text-primary border-primary/30 hover:bg-primary/5">
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Offset vs Loan
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-1.5 pt-1">
        {group.everydayRecords.map((split) => (
          <EverydaySplitRow key={split.id} split={split} onToggleBucket={onToggleBucket} onEditDebt={onEditDebt} onDeleteDebt={onDeleteDebt} />
        ))}
      </div>
    </div>
  );
}
