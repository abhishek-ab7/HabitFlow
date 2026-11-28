'use client';

import {
  ArrowDownLeft,
  ArrowLeftRight,
  Copy,
  Pencil,
  Plus,
  PlusCircle,
  Trash2,
  Wallet,
} from 'lucide-react';
import type { DebtInstallment, DebtRecord, FriendLedgerGroup } from '@/lib/types';
import { formatINR } from '@/lib/stores/finance-store';
import { formatDueDay, formatHumanDate } from '@/lib/date-format';
import { Button } from '@/components/ui/button';

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

function LoanScheduleMeta({ loan }: { loan: DebtRecord }) {
  if (loan.isEmi && loan.emiAmount) {
    return (
      <>
        <span>·</span>
        <span className="font-mono tabular-nums">
          {formatINR(loan.emiAmount)}/mo · {formatDueDay(loan.emiDueDay || 5)} · {loan.paidInstallments || 0}/{loan.totalInstallments || '∞'} EMIs
        </span>
      </>
    );
  }
  if (loan.plannedMonthlyInstallment) {
    return (
      <>
        <span>·</span>
        <span className="font-mono tabular-nums">
          {formatINR(loan.plannedMonthlyInstallment)}/mo · {formatDueDay(loan.dueDayOfMonth || 15)}
        </span>
      </>
    );
  }
  return null;
}

function LoanHeaderBadges({ loan }: { loan: DebtRecord }) {
  const isBorrowed = loan.direction === 'borrowed';
  const dirTone = isBorrowed ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  return (
    <div className="flex items-center gap-2">
      <span className="font-semibold text-xs sm:text-sm text-foreground">{loan.title}</span>
      <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md ${dirTone}`}>
        {isBorrowed ? 'I Borrowed' : 'I Lent'}
      </span>
      {loan.isEmi && <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">EMI Schedule</span>}
      {loan.status === 'settled' && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.2 rounded-md">Settled</span>}
    </div>
  );
}

function LoanActionToolbar(props: {
  loan: DebtRecord;
  installmentCount: number;
  isLoanOpen: boolean;
  onRecordPayment: (debt: DebtRecord) => void;
  onTopUp: (debt: DebtRecord) => void;
  onToggleBucket: (debt: DebtRecord) => void;
  onCopyReminder: (debt: DebtRecord) => void;
  onToggleLoanExpand: (loanId: string) => void;
  onEditDebt: (debt: DebtRecord) => void;
  onDeleteDebt: (debtId: string, title: string) => void;
}) {
  const { loan, installmentCount, isLoanOpen, onRecordPayment, onTopUp, onToggleBucket, onCopyReminder, onToggleLoanExpand, onEditDebt, onDeleteDebt } = props;
  return (
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
          {installmentCount} logs {isLoanOpen ? '▲' : '▼'}
        </button>
        <button type="button" aria-label="Edit loan" onClick={() => onEditDebt(loan)} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button type="button" aria-label="Delete loan" onClick={() => onDeleteDebt(loan.id, loan.title)} className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
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
  const { loan, isLoanOpen, installments } = props;
  const isBorrowed = loan.direction === 'borrowed';
  const pct = loan.principalAmount > 0 ? Math.min(100, Math.round((loan.totalRepaidAmount / loan.principalAmount) * 100)) : 100;
  const barTone = pct >= 100 ? 'bg-emerald-500' : isBorrowed ? 'bg-rose-500' : 'bg-emerald-500';
  const amountTone = isBorrowed ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div className="rounded-xl border border-border/80 bg-background p-3.5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <LoanHeaderBadges loan={loan} />
          <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1.5">
            <span>Started {formatHumanDate(loan.startDate)}</span>
            <LoanScheduleMeta loan={loan} />
          </div>
        </div>

        <div className="text-right font-mono tabular-nums">
          <div className="text-xs text-muted-foreground">Remaining / Principal</div>
          <div className="text-sm font-bold text-foreground">
            <span className={amountTone}>{formatINR(loan.remainingAmount)}</span>{' '}
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

      <LoanActionToolbar
        loan={loan}
        installmentCount={installments.length}
        isLoanOpen={isLoanOpen}
        onRecordPayment={props.onRecordPayment}
        onTopUp={props.onTopUp}
        onToggleBucket={props.onToggleBucket}
        onCopyReminder={props.onCopyReminder}
        onToggleLoanExpand={props.onToggleLoanExpand}
        onEditDebt={props.onEditDebt}
        onDeleteDebt={props.onDeleteDebt}
      />

      {isLoanOpen && (
        <div className="pt-2 border-t border-border/40 space-y-1.5">
          <LoanInstallmentsList loan={loan} installments={installments} onEditInstallment={props.onEditInstallment} onDeleteInstallment={props.onDeleteInstallment} />
        </div>
      )}
    </div>
  );
}

export function LongTermLoansSubsection(props: {
  group: FriendLedgerGroup;
  expandedLoanIds: Record<string, boolean>;
  getDebtInstallments: (debtId: string) => DebtInstallment[];
  onOpenNewLoan: (friendName: string) => void;
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
  const { group, expandedLoanIds, getDebtInstallments } = props;
  return (
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
  );
}
