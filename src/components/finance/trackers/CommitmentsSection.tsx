'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import type { CommitmentLedgerSummary } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useFeedback } from '@/hooks/use-feedback';
import { toast } from 'sonner';
import {
  LinkExpenseCommitmentDialog,
  NewCommitmentDialog,
  ReimburseCommitmentDialog,
} from './CommitmentDialogs';
import { CommitmentLedgerCard } from './CommitmentLedgerCard';

interface CommitmentsSectionProps {
  onLogOffsetExpense: (commitmentId: string) => void;
}

function parseCommitmentInput(params: {
  title: string;
  recipient: string;
  target: string;
  dueDay: string;
  rollover: boolean;
  familyCatId?: string;
}) {
  const { title, recipient, target, dueDay, rollover, familyCatId } = params;
  const amt = parseFloat(target);
  if (!title.trim() || !recipient.trim()) return null;
  if (Number.isNaN(amt) || amt <= 0) return null;
  return {
    title: title.trim(),
    recipientName: recipient.trim(),
    relationship: recipient.trim(),
    monthlyTargetAmount: amt,
    dueDayOfMonth: Math.min(31, Math.max(1, parseInt(dueDay, 10) || 10)),
    category: 'family_support' as const,
    defaultCategoryId: familyCatId,
    autoRolloverOverpayment: rollover,
    icon: 'HeartHandshake',
    color: '#ec4899',
    isActive: true,
  };
}

function buildReimbursementTx(params: {
  comm: CommitmentLedgerSummary;
  amount: number;
  accountId: string;
  date: string;
  note: string;
  fallbackCatId?: string;
}) {
  const { comm, amount, accountId, date, note, fallbackCatId } = params;
  return {
    title: `Reimbursement from ${comm.commitment.recipientName}`,
    merchantName: comm.commitment.recipientName,
    amount,
    type: 'income' as const,
    categoryId: comm.commitment.defaultCategoryId || fallbackCatId || 'uncategorized',
    subcategory: 'Commitment Reimbursement',
    accountId,
    date: date || getLocalIsoDate(),
    notes: note.trim() || `Money received back for ${comm.commitment.title}`,
    tags: ['commitment-reimbursement', comm.commitment.recipientName.toLowerCase()],
    linkedCommitmentId: comm.commitment.id,
    commitmentContributionType: 'direct_payment' as const,
  };
}

function CommitmentsHeader({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-base font-bold text-foreground">Monthly Commitments</h2>
        <p className="text-xs text-muted-foreground">Fixed monthly allowances with automatic bill &amp; order offsets</p>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onAdd} className="min-h-[40px] px-3.5 gap-1.5 text-xs rounded-xl whitespace-nowrap">
        <Plus className="w-4 h-4" />
        Add
      </Button>
    </div>
  );
}

function CommitmentsEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-6 text-center space-y-2.5">
      <p className="text-xs text-muted-foreground">
        No monthly commitments added yet (e.g., Mother&apos;s monthly allowance or shared household pool).
      </p>
      <Button type="button" size="sm" variant="secondary" onClick={onAdd} className="min-h-[40px] px-4 text-xs rounded-xl">
        Add Monthly Commitment
      </Button>
    </div>
  );
}

export function CommitmentsSection({ onLogOffsetExpense }: CommitmentsSectionProps) {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const getAllCommitmentLedgers = useFinanceStore((s) => s.getAllCommitmentLedgers);
  const settleCommitmentBalance = useFinanceStore((s) => s.settleCommitmentBalance);
  const attachTransactionToCommitment = useFinanceStore((s) => s.attachTransactionToCommitment);
  const addCommitment = useFinanceStore((s) => s.addCommitment);
  const updateCommitment = useFinanceStore((s) => s.updateCommitment);
  const deleteCommitment = useFinanceStore((s) => s.deleteCommitment);
  const addTransaction = useFinanceStore((s) => s.addTransaction);

  const commitmentLedgers = getAllCommitmentLedgers(selectedMonth);
  const liquidAccounts = accounts.filter((a) => !a.deletedAt && !a.archived && a.type !== 'credit_card');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const feedback = useFeedback();

  const [isNewCommOpen, setIsNewCommOpen] = useState(false);
  const [commTitle, setCommTitle] = useState('');
  const [commRecipient, setCommRecipient] = useState('');
  const [commTarget, setCommTarget] = useState('3000');
  const [commDueDay, setCommDueDay] = useState('10');
  const [commRollover, setCommRollover] = useState(true);

  const [attachCommitmentId, setAttachCommitmentId] = useState<string | null>(null);
  const [selectedTxToAttach, setSelectedTxToAttach] = useState('');

  const [reimburseComm, setReimburseComm] = useState<CommitmentLedgerSummary | null>(null);
  const [reimburseAmount, setReimburseAmount] = useState('');
  const [reimburseAccountId, setReimburseAccountId] = useState('');
  const [reimburseDate, setReimburseDate] = useState(getLocalIsoDate());
  const [reimburseNote, setReimburseNote] = useState('');

  const unlinkedMonthExpenses = transactions.filter(
    (t) => !t.deletedAt && t.monthKey === selectedMonth && t.type === 'expense' && !t.linkedCommitmentId
  );

  const handleSettleCommitment = async (e: React.MouseEvent, ledger: CommitmentLedgerSummary) => {
    e.stopPropagation();
    feedback.coin();
    const tx = await settleCommitmentBalance(ledger.commitment.id, undefined, selectedMonth);
    if (tx) toast.success(`Settled ${formatINR(ledger.remainingBalance)} for ${ledger.commitment.recipientName}`);
  };

  const handleCreateCommitment = async (e: React.FormEvent) => {
    e.preventDefault();
    const familyCat = categories.find((c) => c.slug === 'family-commitments');
    const payload = parseCommitmentInput({
      title: commTitle,
      recipient: commRecipient,
      target: commTarget,
      dueDay: commDueDay,
      rollover: commRollover,
      familyCatId: familyCat?.id,
    });
    if (!payload) {
      toast.error('Please enter title, recipient, and monthly target');
      return;
    }
    await addCommitment(payload);
    toast.success(`Added ${payload.title}`);
    setIsNewCommOpen(false);
    setCommTitle('');
    setCommRecipient('');
  };

  const handleAttachExisting = async () => {
    if (!attachCommitmentId || !selectedTxToAttach) return;
    await attachTransactionToCommitment(selectedTxToAttach, attachCommitmentId, 'offset_expense');
    toast.success('Linked expense as offset deduction');
    setAttachCommitmentId(null);
    setSelectedTxToAttach('');
  };

  const openReimburseDialog = (ledger: CommitmentLedgerSummary) => {
    setReimburseComm(ledger);
    setReimburseAmount(ledger.overpaidAmount > 0 ? String(ledger.overpaidAmount) : '');
    const defaultLiquid =
      liquidAccounts.find((a) => a.isDefault) || liquidAccounts.find((a) => a.type === 'upi') || liquidAccounts[0];
    setReimburseAccountId(defaultLiquid?.id || '');
    setReimburseDate(getLocalIsoDate());
    setReimburseNote('');
  };

  const handleRecordReimbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reimburseComm) return;
    const amt = parseFloat(reimburseAmount);
    const invalidAmt = Number.isNaN(amt) || amt <= 0;
    if (invalidAmt || !reimburseAccountId) {
      toast.error('Enter a valid amount and deposit account');
      return;
    }
    const familyCat = categories.find((c) => c.slug === 'family-commitments') || categories[0];
    await addTransaction(
      buildReimbursementTx({
        comm: reimburseComm,
        amount: amt,
        accountId: reimburseAccountId,
        date: reimburseDate,
        note: reimburseNote,
        fallbackCatId: familyCat?.id,
      })
    );
    toast.success(`Recorded ${formatINR(amt)} received back from ${reimburseComm.commitment.recipientName}`);
    setReimburseComm(null);
  };

  const toggleRollover = async (ledger: CommitmentLedgerSummary) => {
    const nextVal = !ledger.commitment.autoRolloverOverpayment;
    await updateCommitment(ledger.commitment.id, { autoRolloverOverpayment: nextVal });
    toast.success(
      nextVal ? 'Overpayment rollover enabled for next month' : 'Overpayment rollover disabled — months reset fresh'
    );
  };

  return (
    <section className="space-y-3">
      <CommitmentsHeader onAdd={() => setIsNewCommOpen(true)} />

      {commitmentLedgers.length === 0 ? (
        <CommitmentsEmptyState onAdd={() => setIsNewCommOpen(true)} />
      ) : (
        <div className="space-y-3">
          {commitmentLedgers.map((ledger) => (
            <CommitmentLedgerCard
              key={ledger.commitment.id}
              ledger={ledger}
              isOpen={!!expandedIds[ledger.commitment.id]}
              onToggleExpand={() => setExpandedIds((prev) => ({ ...prev, [ledger.commitment.id]: !prev[ledger.commitment.id] }))}
              onSettle={(e) => handleSettleCommitment(e, ledger)}
              onUnlinkTx={(txId) => attachTransactionToCommitment(txId, null)}
              onLogOffset={() => onLogOffsetExpense(ledger.commitment.id)}
              onOpenReimburse={() => openReimburseDialog(ledger)}
              onOpenLinkExpense={() => setAttachCommitmentId(ledger.commitment.id)}
              onToggleRollover={() => toggleRollover(ledger)}
              onDelete={async () => {
                await deleteCommitment(ledger.commitment.id);
                toast.success('Deleted commitment');
              }}
            />
          ))}
        </div>
      )}

      <NewCommitmentDialog
        open={isNewCommOpen}
        onOpenChange={setIsNewCommOpen}
        form={{ title: commTitle, setTitle: setCommTitle, recipient: commRecipient, setRecipient: setCommRecipient, target: commTarget, setTarget: setCommTarget, dueDay: commDueDay, setDueDay: setCommDueDay, rollover: commRollover, setRollover: setCommRollover }}
        onSubmit={handleCreateCommitment}
      />
      <ReimburseCommitmentDialog
        reimburseComm={reimburseComm}
        onClose={() => setReimburseComm(null)}
        liquidAccounts={liquidAccounts}
        form={{ amount: reimburseAmount, setAmount: setReimburseAmount, accountId: reimburseAccountId, setAccountId: setReimburseAccountId, date: reimburseDate, setDate: setReimburseDate, note: reimburseNote, setNote: setReimburseNote }}
        onSubmit={handleRecordReimbursement}
      />
      <LinkExpenseCommitmentDialog
        open={!!attachCommitmentId}
        onClose={() => setAttachCommitmentId(null)}
        selectedMonth={selectedMonth}
        unlinkedMonthExpenses={unlinkedMonthExpenses}
        selectedTxId={selectedTxToAttach}
        setSelectedTxId={setSelectedTxToAttach}
        onAttach={handleAttachExisting}
      />
    </section>
  );
}
