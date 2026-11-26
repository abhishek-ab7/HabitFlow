'use client';

import React, { useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Plus, Users, Receipt, Wallet } from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type {
  DebtBucketType,
  DebtDirection,
  DebtInstallment,
  DebtRecord,
  FriendLedgerGroup,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { FriendCard } from './friends/FriendCard';

const AddDebtModal = dynamic(
  () => import('./friends/AddDebtModal').then((m) => ({ default: m.AddDebtModal })),
  { ssr: false }
);
const SettleTabDialog = dynamic(
  () => import('./friends/SettleTabDialog').then((m) => ({ default: m.SettleTabDialog })),
  { ssr: false }
);
const OffsetLoanDialog = dynamic(
  () => import('./friends/OffsetLoanDialog').then((m) => ({ default: m.OffsetLoanDialog })),
  { ssr: false }
);
const InstallmentDialog = dynamic(
  () => import('./friends/InstallmentDialog').then((m) => ({ default: m.InstallmentDialog })),
  { ssr: false }
);
const TopUpDialog = dynamic(
  () => import('./friends/TopUpDialog').then((m) => ({ default: m.TopUpDialog })),
  { ssr: false }
);
const ShareSettlementDialog = dynamic(
  () => import('./friends/ShareSettlementDialog').then((m) => ({ default: m.ShareSettlementDialog })),
  { ssr: false }
);

function LedgerSummaryCard(props: {
  icon: React.ReactNode;
  title: string;
  net: number;
  zeroLabel: string;
  oweLabel: string;
  oweAmount: number;
  lentLabel: string;
  lentAmount: number;
}) {
  const { icon, title, net, zeroLabel, oweLabel, oweAmount, lentLabel, lentAmount } = props;
  const netTone =
    net > 0
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      : net < 0
      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
      : 'bg-muted text-muted-foreground';
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          {icon}
          {title}
        </span>
        <span className={`text-xs font-bold font-mono tabular-nums px-2 py-0.5 rounded-full ${netTone}`}>
          Net: {net > 0 ? `+${formatINR(net)}` : net < 0 ? `-${formatINR(Math.abs(net))}` : zeroLabel}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div>
          <span className="text-[11px] text-muted-foreground block">{oweLabel}</span>
          <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
            {formatINR(oweAmount)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[11px] text-muted-foreground block">{lentLabel}</span>
          <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatINR(lentAmount)}
          </span>
        </div>
      </div>
    </div>
  );
}

function LedgerFilterToolbar(props: {
  bucketFilter: 'all' | DebtBucketType;
  onBucketChange: (b: 'all' | DebtBucketType) => void;
  filterDir: 'all' | DebtDirection;
  onDirChange: (d: 'all' | DebtDirection) => void;
  onNewEntry: () => void;
}) {
  const { bucketFilter, onBucketChange, filterDir, onDirChange, onNewEntry } = props;
  const bucketOptions = [
    { id: 'all', label: 'All Buckets' },
    { id: 'everyday_split', label: 'Everyday Splits' },
    { id: 'long_term_loan', label: 'Long-Term Loans' },
  ] as const;
  const dirOptions = [
    { id: 'all', label: 'All' },
    { id: 'borrowed', label: 'I Owe' },
    { id: 'lent', label: 'Owes Me' },
  ] as const;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Filter ledger buckets" className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted">
          {bucketOptions.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onBucketChange(b.id)}
              className={`min-h-[34px] px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                bucketFilter === b.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div role="tablist" aria-label="Filter direction" className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted/60">
          {dirOptions.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onDirChange(d.id)}
              className={`min-h-[34px] px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                filterDir === d.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <Button type="button" size="sm" onClick={onNewEntry} className="min-h-[38px] px-3.5 gap-1.5 text-xs rounded-xl">
        <Plus className="w-4 h-4" />
        New Entry
      </Button>
    </div>
  );
}

function matchesFriendFilters(g: FriendLedgerGroup, bucketFilter: 'all' | DebtBucketType, filterDir: 'all' | DebtDirection): boolean {
  if (bucketFilter === 'everyday_split' && g.everydayRecords.length === 0) return false;
  if (bucketFilter === 'long_term_loan' && g.longTermLoans.length === 0) return false;
  if (filterDir === 'borrowed') return g.everydayNet < 0 || g.longTermBorrowedRemaining > 0;
  if (filterDir === 'lent') return g.everydayNet > 0 || g.longTermLentRemaining > 0;
  return true;
}

function FriendsDebtDialogs(props: {
  accounts: ReturnType<typeof useFinanceStore.getState>['accounts'];
  isNewOpen: boolean;
  onCloseNew: () => void;
  editingDebt: DebtRecord | null;
  newDefaultBucket: DebtBucketType;
  newPrefilledFriend: string;
  existingFriendNames: string[];
  onSaveDebt: (data: Parameters<ReturnType<typeof useFinanceStore.getState>['addDebtRecord']>[0]) => Promise<void>;
  settleFriend: FriendLedgerGroup | null;
  onCloseSettle: () => void;
  onConfirmSettle: ReturnType<typeof useFinanceStore.getState>['settleEverydayTab'];
  offsetFriend: FriendLedgerGroup | null;
  onCloseOffset: () => void;
  onConfirmOffset: ReturnType<typeof useFinanceStore.getState>['offsetSplitAgainstLoan'];
  installmentDebt: DebtRecord | null;
  editingInstallment: DebtInstallment | null;
  onCloseInstallment: () => void;
  onRecordInstallment: ReturnType<typeof useFinanceStore.getState>['recordDebtInstallment'];
  onUpdateInstallment: ReturnType<typeof useFinanceStore.getState>['updateDebtInstallment'];
  topUpTarget: DebtRecord | null;
  onCloseTopUp: () => void;
  onTopUp: ReturnType<typeof useFinanceStore.getState>['topUpDebt'];
  shareFriend: FriendLedgerGroup | null;
  onCloseShare: () => void;
  debtToDelete: { id: string; title: string } | null;
  onCloseDeleteDebt: () => void;
  onConfirmDeleteDebt: () => Promise<void>;
  installmentToDelete: string | null;
  onCloseDeleteInstallment: () => void;
  onConfirmDeleteInstallment: () => Promise<void>;
}) {
  return (
    <>
      {props.isNewOpen && (
        <AddDebtModal
          isOpen={props.isNewOpen}
          onClose={props.onCloseNew}
          editingDebt={props.editingDebt}
          defaultBucket={props.newDefaultBucket}
          prefilledFriend={props.newPrefilledFriend}
          existingFriendNames={props.existingFriendNames}
          onSave={props.onSaveDebt}
        />
      )}
      {Boolean(props.settleFriend) && (
        <SettleTabDialog group={props.settleFriend!} isOpen onClose={props.onCloseSettle} accounts={props.accounts} onConfirmSettle={props.onConfirmSettle} />
      )}
      {Boolean(props.offsetFriend) && (
        <OffsetLoanDialog group={props.offsetFriend!} isOpen onClose={props.onCloseOffset} onConfirmOffset={props.onConfirmOffset} />
      )}
      {(Boolean(props.installmentDebt) || Boolean(props.editingInstallment)) && (
        <InstallmentDialog
          debt={props.installmentDebt}
          editingInstallment={props.editingInstallment}
          isOpen
          onClose={props.onCloseInstallment}
          accounts={props.accounts}
          onRecordInstallment={props.onRecordInstallment}
          onUpdateInstallment={props.onUpdateInstallment}
        />
      )}
      {Boolean(props.topUpTarget) && (
        <TopUpDialog target={props.topUpTarget!} isOpen onClose={props.onCloseTopUp} onTopUp={props.onTopUp} />
      )}
      {Boolean(props.shareFriend) && (
        <ShareSettlementDialog group={props.shareFriend!} isOpen onClose={props.onCloseShare} />
      )}
      <ConfirmDialog
        open={Boolean(props.debtToDelete)}
        onOpenChange={(open) => !open && props.onCloseDeleteDebt()}
        title="Delete Debt Entry"
        description={`Are you sure you want to delete "${props.debtToDelete?.title || 'this debt'}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={props.onConfirmDeleteDebt}
      />
      <ConfirmDialog
        open={Boolean(props.installmentToDelete)}
        onOpenChange={(open) => !open && props.onCloseDeleteInstallment()}
        title="Delete Installment Log"
        description="Are you sure you want to delete this installment payment log? This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={props.onConfirmDeleteInstallment}
      />
    </>
  );
}

export function FriendsDebtSection() {
  const accounts = useFinanceStore((s) => s.accounts);
  const debtRecords = useFinanceStore((s) => s.debtRecords);
  const debtInstallments = useFinanceStore((s) => s.debtInstallments);
  const getDebtSummary = useFinanceStore((s) => s.getDebtSummary);
  const getFriendLedgerGroups = useFinanceStore((s) => s.getFriendLedgerGroups);
  const getDebtInstallments = useFinanceStore((s) => s.getDebtInstallments);
  const addDebtRecord = useFinanceStore((s) => s.addDebtRecord);
  const updateDebtRecord = useFinanceStore((s) => s.updateDebtRecord);
  const recordDebtInstallment = useFinanceStore((s) => s.recordDebtInstallment);
  const updateDebtInstallment = useFinanceStore((s) => s.updateDebtInstallment);
  const deleteDebtInstallment = useFinanceStore((s) => s.deleteDebtInstallment);
  const topUpDebt = useFinanceStore((s) => s.topUpDebt);
  const deleteDebtRecord = useFinanceStore((s) => s.deleteDebtRecord);
  const settleEverydayTab = useFinanceStore((s) => s.settleEverydayTab);
  const offsetSplitAgainstLoan = useFinanceStore((s) => s.offsetSplitAgainstLoan);

  const [bucketFilter, setBucketFilter] = useState<'all' | DebtBucketType>('all');
  const [filterDir, setFilterDir] = useState<'all' | DebtDirection>('all');
  const [expandedFriends, setExpandedFriends] = useState<Record<string, boolean>>({});
  const [expandedLoanIds, setExpandedLoanIds] = useState<Record<string, boolean>>({});
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<DebtRecord | null>(null);
  const [newDefaultBucket, setNewDefaultBucket] = useState<DebtBucketType>('everyday_split');
  const [newPrefilledFriend, setNewPrefilledFriend] = useState<string>('');
  const [settleFriend, setSettleFriend] = useState<FriendLedgerGroup | null>(null);
  const [offsetFriend, setOffsetFriend] = useState<FriendLedgerGroup | null>(null);
  const [installmentDebt, setInstallmentDebt] = useState<DebtRecord | null>(null);
  const [editingInstallment, setEditingInstallment] = useState<DebtInstallment | null>(null);
  const [topUpTarget, setTopUpTarget] = useState<DebtRecord | null>(null);
  const [shareFriend, setShareFriend] = useState<FriendLedgerGroup | null>(null);
  const [debtToDelete, setDebtToDelete] = useState<{ id: string; title: string } | null>(null);
  const [installmentToDelete, setInstallmentToDelete] = useState<string | null>(null);

  const summary = useMemo(() => getDebtSummary(), [getDebtSummary, debtRecords]);
  const allFriendGroups = useMemo(() => getFriendLedgerGroups(), [getFriendLedgerGroups, debtRecords, debtInstallments]);
  const existingFriendNames = useMemo(() => Array.from(new Set(allFriendGroups.map((g) => g.friendName))), [allFriendGroups]);
  const visibleGroups = useMemo(() => allFriendGroups.filter((g) => matchesFriendFilters(g, bucketFilter, filterDir)), [allFriendGroups, bucketFilter, filterDir]);

  const handleToggleBucket = async (debt: DebtRecord) => {
    const nextBucket: DebtBucketType = debt.bucketType === 'long_term_loan' ? 'everyday_split' : 'long_term_loan';
    await updateDebtRecord(debt.id, { bucketType: nextBucket });
    toast.success(nextBucket === 'everyday_split' ? `Moved "${debt.title}" to Everyday Tab` : `Moved "${debt.title}" to Long-Term Loans`);
  };

  const openNewEntryDialog = (defaultBucket: DebtBucketType = 'everyday_split', prefilledFriend?: string) => {
    setEditingDebt(null);
    setNewDefaultBucket(defaultBucket);
    setNewPrefilledFriend(prefilledFriend || '');
    setIsNewOpen(true);
  };

  const handleSaveDebt = async (data: Parameters<typeof addDebtRecord>[0]) => {
    if (editingDebt) {
      await updateDebtRecord(editingDebt.id, data);
      toast.success(`Updated entry for ${data.personName}`);
      return;
    }
    await addDebtRecord(data);
    toast.success(`Added ${data.bucketType === 'everyday_split' ? 'everyday split' : 'loan'} for ${data.personName}`);
  };

  const handleCopyReminder = async (debt: DebtRecord) => {
    const text =
      debt.direction === 'lent'
        ? `Hey ${debt.personName}, quick reminder on our ${debt.title} balance of ${formatINR(debt.remainingAmount)}. Feel free to UPI whenever convenient!`
        : `Hey ${debt.personName}, tracking my ${debt.title} balance — remaining ${formatINR(debt.remainingAmount)}. Will transfer the next installment soon.`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied UPI reminder message');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const handleConfirmDeleteDebt = async () => {
    if (!debtToDelete) return;
    await deleteDebtRecord(debtToDelete.id);
    toast.success('Deleted debt entry');
    setDebtToDelete(null);
  };

  const handleConfirmDeleteInstallment = async () => {
    if (!installmentToDelete) return;
    await deleteDebtInstallment(installmentToDelete);
    toast.success('Deleted installment log');
    setInstallmentToDelete(null);
  };

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <LedgerSummaryCard
          icon={<Receipt className="w-3.5 h-3.5 text-primary" />}
          title="Everyday Splits Tab"
          net={summary.everydayNetPosition}
          zeroLabel="Settled"
          oweLabel="I Owe (Tabs)"
          oweAmount={summary.everydayBorrowedRemaining}
          lentLabel="Owes Me (Tabs)"
          lentAmount={summary.everydayLentRemaining}
        />
        <LedgerSummaryCard
          icon={<Wallet className="w-3.5 h-3.5 text-blue-500" />}
          title="Long-Term Loans & EMIs"
          net={summary.longTermNetPosition}
          zeroLabel="Balanced"
          oweLabel="I Owe (Loans)"
          oweAmount={summary.longTermBorrowedRemaining}
          lentLabel="Owes Me (Loans)"
          lentAmount={summary.longTermLentRemaining}
        />
      </div>

      <LedgerFilterToolbar
        bucketFilter={bucketFilter}
        onBucketChange={setBucketFilter}
        filterDir={filterDir}
        onDirChange={setFilterDir}
        onNewEntry={() => openNewEntryDialog('everyday_split')}
      />

      {visibleGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-3">
          <Users className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            No friend balances match the selected filters. Track shared meals, trip splits, and personal loans with isolated accounting.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => openNewEntryDialog('everyday_split')} className="text-xs rounded-xl">
              Add Everyday Split
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => openNewEntryDialog('long_term_loan')} className="text-xs rounded-xl">
              Add Long-Term Loan
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          {visibleGroups.map((group) => (
            <FriendCard
              key={group.friendKey}
              group={group}
              isExpanded={Boolean(expandedFriends[group.friendKey])}
              onToggleExpand={() => setExpandedFriends((prev) => ({ ...prev, [group.friendKey]: !prev[group.friendKey] }))}
              bucketFilter={bucketFilter}
              onOpenNewSplit={(name) => openNewEntryDialog('everyday_split', name)}
              onOpenNewLoan={(name) => openNewEntryDialog('long_term_loan', name)}
              onOpenSettleTab={setSettleFriend}
              onOpenOffset={setOffsetFriend}
              onOpenShare={setShareFriend}
              onEditDebt={(debt) => {
                setEditingDebt(debt);
                setIsNewOpen(true);
              }}
              onDeleteDebt={(id, title) => setDebtToDelete({ id, title })}
              onRecordPayment={(debt) => {
                setInstallmentDebt(debt);
                setEditingInstallment(null);
              }}
              onTopUp={setTopUpTarget}
              onCopyReminder={handleCopyReminder}
              expandedLoanIds={expandedLoanIds}
              onToggleLoanExpand={(loanId) => setExpandedLoanIds((prev) => ({ ...prev, [loanId]: !prev[loanId] }))}
              getDebtInstallments={getDebtInstallments}
              onEditInstallment={(debt, inst) => {
                setInstallmentDebt(debt);
                setEditingInstallment(inst);
              }}
              onDeleteInstallment={setInstallmentToDelete}
              onToggleBucket={handleToggleBucket}
            />
          ))}
        </div>
      )}

      <FriendsDebtDialogs
        accounts={accounts}
        isNewOpen={isNewOpen}
        onCloseNew={() => {
          setIsNewOpen(false);
          setEditingDebt(null);
        }}
        editingDebt={editingDebt}
        newDefaultBucket={newDefaultBucket}
        newPrefilledFriend={newPrefilledFriend}
        existingFriendNames={existingFriendNames}
        onSaveDebt={handleSaveDebt}
        settleFriend={settleFriend}
        onCloseSettle={() => setSettleFriend(null)}
        onConfirmSettle={settleEverydayTab}
        offsetFriend={offsetFriend}
        onCloseOffset={() => setOffsetFriend(null)}
        onConfirmOffset={offsetSplitAgainstLoan}
        installmentDebt={installmentDebt}
        editingInstallment={editingInstallment}
        onCloseInstallment={() => {
          setInstallmentDebt(null);
          setEditingInstallment(null);
        }}
        onRecordInstallment={recordDebtInstallment}
        onUpdateInstallment={updateDebtInstallment}
        topUpTarget={topUpTarget}
        onCloseTopUp={() => setTopUpTarget(null)}
        onTopUp={topUpDebt}
        shareFriend={shareFriend}
        onCloseShare={() => setShareFriend(null)}
        debtToDelete={debtToDelete}
        onCloseDeleteDebt={() => setDebtToDelete(null)}
        onConfirmDeleteDebt={handleConfirmDeleteDebt}
        installmentToDelete={installmentToDelete}
        onCloseDeleteInstallment={() => setInstallmentToDelete(null)}
        onConfirmDeleteInstallment={handleConfirmDeleteInstallment}
      />
    </section>
  );
}
