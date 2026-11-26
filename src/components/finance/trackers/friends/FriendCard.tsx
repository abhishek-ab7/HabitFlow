'use client';

import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  ArrowDownLeft,
  Copy,
  Trash2,
  Pencil,
  PlusCircle,
  CheckCircle2,
  ArrowLeftRight,
  Receipt,
  Wallet,
  Share2,
  Plus,
} from 'lucide-react';
import type { DebtBucketType, DebtRecord, DebtInstallment, FriendLedgerGroup } from '@/lib/types';
import { formatINR } from '@/lib/stores/finance-store';
import { formatHumanDate, formatDueDay } from '@/lib/date-format';
import { Button } from '@/components/ui/button';
import { useFeedback } from '@/hooks/use-feedback';

interface FriendCardProps {
  group: FriendLedgerGroup;
  isExpanded: boolean;
  onToggleExpand: () => void;
  bucketFilter: 'all' | DebtBucketType;
  onOpenNewSplit: (friendName: string) => void;
  onOpenNewLoan: (friendName: string) => void;
  onOpenSettleTab: (group: FriendLedgerGroup) => void;
  onOpenOffset: (group: FriendLedgerGroup) => void;
  onOpenShare: (group: FriendLedgerGroup) => void;
  onEditDebt: (debt: DebtRecord) => void;
  onDeleteDebt: (debtId: string, title: string) => void;
  onRecordPayment: (debt: DebtRecord) => void;
  onTopUp: (debt: DebtRecord) => void;
  onCopyReminder: (debt: DebtRecord) => void;
  expandedLoanIds: Record<string, boolean>;
  onToggleLoanExpand: (loanId: string) => void;
  getDebtInstallments: (debtId: string) => DebtInstallment[];
  onEditInstallment: (debt: DebtRecord, inst: DebtInstallment) => void;
  onDeleteInstallment: (instId: string) => void;
  onToggleBucket: (debt: DebtRecord) => void;
}

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

function FriendCardHeader(props: {
  group: FriendLedgerGroup;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenShare: (group: FriendLedgerGroup) => void;
}) {
  const { group, isExpanded, onToggleExpand, onOpenShare } = props;
  const totalNet = group.everydayNet + group.longTermNetPosition;
  const netTone =
    totalNet > 0
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      : totalNet < 0
      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
      : 'bg-muted text-muted-foreground';

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
          <span className={`text-[11px] font-bold font-mono tabular-nums px-2 py-0.5 rounded-full ${netTone}`}>
            Net: {totalNet > 0 ? `+${formatINR(totalNet)}` : totalNet < 0 ? `-${formatINR(Math.abs(totalNet))}` : 'Even'}
          </span>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <span>{group.everydayRecords.length} {group.everydayRecords.length === 1 ? 'Everyday Split' : 'Everyday Splits'}</span>
          <span>·</span>
          <span>{group.longTermLoans.length} {group.longTermLoans.length === 1 ? 'Loan' : 'Loans'}</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 ml-auto sm:ml-0">
        <div className="text-right text-xs">
          <div className="font-mono tabular-nums">
            {group.everydayNet > 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Tab: +{formatINR(group.everydayNet)}</span>
            ) : group.everydayNet < 0 ? (
              <span className="text-rose-600 dark:text-rose-400 font-semibold">Tab: -{formatINR(Math.abs(group.everydayNet))}</span>
            ) : (
              <span className="text-muted-foreground">Tab: Settled</span>
            )}
          </div>
          <div className="font-mono tabular-nums text-[11px] text-muted-foreground">{formatLoanLoanLine(group)}</div>
        </div>

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

function EverydaySplitRow(props: {
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
}

function EverydayTabSubsection(props: {
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
  const tabSubtitle =
    group.everydayNet > 0
      ? `${group.friendName} owes you ${formatINR(group.everydayNet)} net on everyday splits`
      : group.everydayNet < 0
      ? `You owe ${group.friendName} ${formatINR(Math.abs(group.everydayNet))} net on everyday splits`
      : 'Everyday tab is fully settled';

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

function LoanInstallmentsList(props: {
  loan: DebtRecord;
  installments: DebtInstallment[];
  onEditInstallment: (debt: DebtRecord, inst: DebtInstallment) => void;
  onDeleteInstallment: (instId: string) => void;
}) {
  const { loan, installments, onEditInstallment, onDeleteInstallment } = props;
  if (installments.length === 0) {
    return <p className="text-[11px] text-muted-foreground text-center py-2">No repayments logged yet.</p>;
  }
  return (
    <>
      {installments.map((inst) => (
        <div key={inst.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/40 font-mono tabular-nums">
          <div>
            <span className="font-semibold text-foreground">{formatINR(inst.amount)}</span>
            <span className="text-[11px] text-muted-foreground ml-2 font-sans">
              {formatHumanDate(inst.date)} · {inst.paymentMethod.toUpperCase()}
            </span>
            {inst.note && <p className="text-[10px] text-muted-foreground font-sans truncate max-w-xs">{inst.note}</p>}
          </div>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Edit installment" onClick={() => onEditInstallment(loan, inst)} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted">
              <Pencil className="w-3 h-3" />
            </button>
            <button type="button" aria-label="Delete installment" onClick={() => onDeleteInstallment(inst.id)} className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

function LongTermLoanItem(props: {
  loan: DebtRecord;
  isLoanOpen: boolean;
  installments: DebtInstallment[];
  onToggleLoanExpand: (loanId: string) => void;
  onRecordPayment: (debt: DebtRecord) => void;
  onTopUp: (debt: DebtRecord) => void;
  onToggleBucket: (debt: DebtRecord) => void;
  onCopyReminder: (debt: DebtRecord) => void;
  onEditDebt: (debt: DebtRecord) => void;
  onDeleteDebt: (debtId: string, title: string) => void;
  onEditInstallment: (debt: DebtRecord, inst: DebtInstallment) => void;
  onDeleteInstallment: (instId: string) => void;
}) {
  const { loan, isLoanOpen, installments, onToggleLoanExpand, onRecordPayment, onTopUp, onToggleBucket, onCopyReminder, onEditDebt, onDeleteDebt, onEditInstallment, onDeleteInstallment } = props;
  const isBorrowed = loan.direction === 'borrowed';
  const pct = loan.principalAmount > 0 ? Math.min(100, Math.round((loan.totalRepaidAmount / loan.principalAmount) * 100)) : 100;
  const barTone = pct >= 100 ? 'bg-emerald-500' : isBorrowed ? 'bg-rose-500' : 'bg-emerald-500';

  return (
    <div className="rounded-xl border border-border/80 bg-background p-3.5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs sm:text-sm text-foreground">{loan.title}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md ${isBorrowed ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
              {isBorrowed ? 'I Borrowed' : 'I Lent'}
            </span>
            {loan.isEmi && <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">EMI Schedule</span>}
            {loan.status === 'settled' && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.2 rounded-md">Settled</span>}
          </div>
          <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1.5">
            <span>Started {formatHumanDate(loan.startDate)}</span>
            {loan.isEmi && loan.emiAmount ? (
              <>
                <span>·</span>
                <span className="font-mono tabular-nums">
                  {formatINR(loan.emiAmount)}/mo · {formatDueDay(loan.emiDueDay || 5)} · {loan.paidInstallments || 0}/{loan.totalInstallments || '∞'} EMIs
                </span>
              </>
            ) : loan.plannedMonthlyInstallment ? (
              <>
                <span>·</span>
                <span className="font-mono tabular-nums">
                  {formatINR(loan.plannedMonthlyInstallment)}/mo · {formatDueDay(loan.dueDayOfMonth || 15)}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="text-right font-mono tabular-nums">
          <div className="text-xs text-muted-foreground">Remaining / Principal</div>
          <div className="text-sm font-bold text-foreground">
            <span className={isBorrowed ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
              {formatINR(loan.remainingAmount)}
            </span>{' '}
            <span className="text-muted-foreground font-normal text-xs">/ {formatINR(loan.principalAmount)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-mono tabular-nums text-muted-foreground">
          <span>Repaid: {formatINR(loan.totalRepaidAmount)}</span>
          <span>{pct}% complete</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-300 ${barTone}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-border/40">
        <div className="flex flex-wrap items-center gap-1.5">
          {loan.status === 'active' && (
            <Button type="button" size="sm" variant="outline" onClick={() => onRecordPayment(loan)} className="h-8 px-2.5 text-xs rounded-lg gap-1 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary font-medium">
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Record Payment
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => onTopUp(loan)} className="h-8 px-2.5 text-xs rounded-lg gap-1">
            <PlusCircle className="w-3.5 h-3.5" />
            Top Up
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onToggleBucket(loan)} className="h-8 px-2 text-xs rounded-lg gap-1 text-muted-foreground hover:text-foreground" title="Move this item to Everyday Splits tab">
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Move to Tab</span>
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onCopyReminder(loan)} className="h-8 px-2 text-xs rounded-lg gap-1 text-muted-foreground">
            <Copy className="w-3.5 h-3.5" />
            UPI Msg
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <button type="button" aria-label="Toggle installment log" onClick={() => onToggleLoanExpand(loan.id)} className="px-2 py-1 text-[11px] font-medium rounded-lg text-muted-foreground hover:bg-muted">
            {installments.length} logs {isLoanOpen ? '▲' : '▼'}
          </button>
          <button type="button" aria-label="Edit loan" onClick={() => onEditDebt(loan)} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button type="button" aria-label="Delete loan" onClick={() => onDeleteDebt(loan.id, loan.title)} className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isLoanOpen && (
        <div className="pt-2 border-t border-border/40 space-y-1.5">
          <LoanInstallmentsList loan={loan} installments={installments} onEditInstallment={onEditInstallment} onDeleteInstallment={onDeleteInstallment} />
        </div>
      )}
    </div>
  );
}

export const FriendCard = React.memo(function FriendCard(props: FriendCardProps) {
  const { group, isExpanded, onToggleExpand, bucketFilter, expandedLoanIds, getDebtInstallments } = props;
  const feedback = useFeedback();
  const showEverydaySection = bucketFilter !== 'long_term_loan' && group.everydayRecords.length > 0;
  const showLoansSection = bucketFilter !== 'everyday_split' && group.longTermLoans.length > 0;

  return (
    <div className="cv-auto-lg rounded-2xl border border-border bg-card overflow-hidden shadow-xs transition-colors">
      <FriendCardHeader group={group} isExpanded={isExpanded} onToggleExpand={onToggleExpand} onOpenShare={props.onOpenShare} />
      {isExpanded && (
        <div className="border-t border-border/60 divide-y divide-border/60 bg-muted/10">
          {showEverydaySection && (
            <EverydayTabSubsection
              group={group}
              onOpenNewSplit={props.onOpenNewSplit}
              onOpenSettleTab={props.onOpenSettleTab}
              onOpenOffset={props.onOpenOffset}
              onToggleBucket={props.onToggleBucket}
              onEditDebt={props.onEditDebt}
              onDeleteDebt={props.onDeleteDebt}
              onTapFeedback={() => feedback.tap()}
            />
          )}
          {showLoansSection && (
            <div className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-blue-500" />
                  Long-Term Loans & EMIs
                </span>
                <Button type="button" size="sm" variant="outline" onClick={() => props.onOpenNewLoan(group.friendName)} className="h-8 px-2.5 text-xs rounded-lg gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  Add Loan
                </Button>
              </div>
              <div className="space-y-3 pt-1">
                {group.longTermLoans.map((loan) => {
                  const isLoanOpen = Boolean(expandedLoanIds[loan.id]);
                  return (
                    <LongTermLoanItem
                      key={loan.id}
                      loan={loan}
                      isLoanOpen={isLoanOpen}
                      installments={isLoanOpen ? getDebtInstallments(loan.id) : []}
                      onToggleLoanExpand={props.onToggleLoanExpand}
                      onRecordPayment={props.onRecordPayment}
                      onTopUp={props.onTopUp}
                      onToggleBucket={props.onToggleBucket}
                      onCopyReminder={props.onCopyReminder}
                      onEditDebt={props.onEditDebt}
                      onDeleteDebt={props.onDeleteDebt}
                      onEditInstallment={props.onEditInstallment}
                      onDeleteInstallment={props.onDeleteInstallment}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
