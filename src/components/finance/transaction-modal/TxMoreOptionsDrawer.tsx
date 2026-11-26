'use client';

import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { CommitmentContributionType, DebtRecord, FinanceTransactionType, MonthlyCommitment } from '@/lib/types';
import { Input } from '@/components/ui/input';

function TxCommitmentLinkField(params: {
  activeCommitments: MonthlyCommitment[];
  linkedCommitmentId: string;
  setLinkedCommitmentId: React.Dispatch<React.SetStateAction<string>>;
  commitmentContributionType: CommitmentContributionType;
  setCommitmentContributionType: React.Dispatch<React.SetStateAction<CommitmentContributionType>>;
}) {
  const { activeCommitments, linkedCommitmentId, setLinkedCommitmentId, commitmentContributionType, setCommitmentContributionType } = params;
  return (
    <div className="space-y-1.5">
      <label htmlFor="tx-commitment" className="text-xs font-medium text-muted-foreground block">Deduct from Monthly Commitment</label>
      <select
        id="tx-commitment"
        value={linkedCommitmentId}
        onChange={(e) => setLinkedCommitmentId(e.target.value)}
        className="w-full h-10 px-3 text-sm rounded-xl border border-input bg-background"
      >
        <option value="none">None</option>
        {activeCommitments.map((c) => (
          <option key={c.id} value={c.id}>{c.title} ({c.recipientName})</option>
        ))}
      </select>

      {linkedCommitmentId !== 'none' && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => setCommitmentContributionType('offset_expense')}
            className={`min-h-[38px] px-2 text-xs font-medium rounded-lg border ${
              commitmentContributionType === 'offset_expense' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border'
            }`}
          >
            Offset Purchase
          </button>
          <button
            type="button"
            onClick={() => setCommitmentContributionType('direct_payment')}
            className={`min-h-[38px] px-2 text-xs font-medium rounded-lg border ${
              commitmentContributionType === 'direct_payment' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border'
            }`}
          >
            Direct Transfer
          </button>
        </div>
      )}
    </div>
  );
}

function TxDateAndNotesRow(params: {
  date: string;
  setDate: React.Dispatch<React.SetStateAction<string>>;
  notes: string;
  setNotes: React.Dispatch<React.SetStateAction<string>>;
}) {
  const { date, setDate, notes, setNotes } = params;
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <div className="space-y-1">
        <label htmlFor="tx-date" className="text-xs font-medium text-muted-foreground block">Date</label>
        <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 text-xs font-mono" />
      </div>
      <div className="space-y-1">
        <label htmlFor="tx-notes" className="text-xs font-medium text-muted-foreground block">Notes</label>
        <Input id="tx-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional memo" className="h-10 text-xs" />
      </div>
    </div>
  );
}

function TxDebtLinkField(params: {
  activeDebts: DebtRecord[];
  linkedDebtId: string;
  setLinkedDebtId: React.Dispatch<React.SetStateAction<string>>;
}) {
  const { activeDebts, linkedDebtId, setLinkedDebtId } = params;
  return (
    <div className="space-y-1">
      <label htmlFor="tx-debt" className="text-xs font-medium text-muted-foreground block">Link to Friend Debt</label>
      <select
        id="tx-debt"
        value={linkedDebtId}
        onChange={(e) => setLinkedDebtId(e.target.value)}
        className="w-full h-10 px-3 text-sm rounded-xl border border-input bg-background"
      >
        <option value="none">None</option>
        {activeDebts.map((d) => (
          <option key={d.id} value={d.id}>
            {d.personName} - {d.title} [{d.bucketType === 'everyday_split' ? 'Everyday' : 'Loan'}] ({d.direction === 'borrowed' ? 'I owe' : 'Owes me'})
          </option>
        ))}
      </select>
    </div>
  );
}

export function TxMoreOptionsDrawer(params: {
  showMoreOptions: boolean;
  setShowMoreOptions: React.Dispatch<React.SetStateAction<boolean>>;
  date: string;
  setDate: React.Dispatch<React.SetStateAction<string>>;
  notes: string;
  setNotes: React.Dispatch<React.SetStateAction<string>>;
  type: FinanceTransactionType;
  activeCommitments: MonthlyCommitment[];
  linkedCommitmentId: string;
  setLinkedCommitmentId: React.Dispatch<React.SetStateAction<string>>;
  commitmentContributionType: CommitmentContributionType;
  setCommitmentContributionType: React.Dispatch<React.SetStateAction<CommitmentContributionType>>;
  activeDebts: DebtRecord[];
  linkedDebtId: string;
  setLinkedDebtId: React.Dispatch<React.SetStateAction<string>>;
}) {
  const {
    showMoreOptions, setShowMoreOptions, date, setDate, notes, setNotes, type,
    activeCommitments, linkedCommitmentId, setLinkedCommitmentId,
    commitmentContributionType, setCommitmentContributionType, activeDebts,
    linkedDebtId, setLinkedDebtId,
  } = params;
  const hasConfigured = linkedCommitmentId !== 'none' || linkedDebtId !== 'none' || Boolean(notes.trim());

  return (
    <div>
      <button
        type="button"
        onClick={() => setShowMoreOptions((v) => !v)}
        className="w-full min-h-[40px] px-3 rounded-xl border border-border/70 bg-muted/30 flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{hasConfigured ? 'Date, Notes & Links · Configured' : 'Date, Notes, Commitment or Friend Link'}</span>
        {showMoreOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {showMoreOptions && (
        <div className="mt-2 p-3 rounded-xl border border-border bg-muted/20 space-y-3">
          <TxDateAndNotesRow date={date} setDate={setDate} notes={notes} setNotes={setNotes} />

          {type === 'expense' && activeCommitments.length > 0 && (
            <TxCommitmentLinkField
              activeCommitments={activeCommitments}
              linkedCommitmentId={linkedCommitmentId}
              setLinkedCommitmentId={setLinkedCommitmentId}
              commitmentContributionType={commitmentContributionType}
              setCommitmentContributionType={setCommitmentContributionType}
            />
          )}

          {activeDebts.length > 0 && (
            <TxDebtLinkField activeDebts={activeDebts} linkedDebtId={linkedDebtId} setLinkedDebtId={setLinkedDebtId} />
          )}
        </div>
      )}
    </div>
  );
}
