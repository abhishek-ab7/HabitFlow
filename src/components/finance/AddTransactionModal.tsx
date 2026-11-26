'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { FinanceTransaction } from '@/lib/types';
import { Trash2 } from 'lucide-react';
import { CategoryPickerSheet } from './CategoryPickerSheet';
import { SmartCaptureBar } from './transaction-modal/SmartCaptureBar';
import { TxAccountSelector, TxTagsPicker } from './transaction-modal/TxAccountAndTagsSection';
import { TxFitnessBridgePanel } from './transaction-modal/TxFitnessBridgePanel';
import { TxSplitAndRecurringSection } from './transaction-modal/TxSplitAndRecurringSection';
import { TxMoreOptionsDrawer } from './transaction-modal/TxMoreOptionsDrawer';
import { TxHeroAmountInput, TxMerchantAndCategoryRow, TxModalHeader, TxTransferFields } from './transaction-modal/TxModalCoreFields';
import { useAddTransactionForm } from './transaction-modal/useAddTransactionForm';

const SmsImportModal = dynamic(() => import('./SmsImportModal').then((m) => ({ default: m.SmsImportModal })), { ssr: false });

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTransaction?: FinanceTransaction | null;
  defaultCommitmentId?: string | null;
  defaultDebtId?: string | null;
  onOpenSmsImport?: () => void;
}

function resolveSubmitLabel(vm: ReturnType<typeof useAddTransactionForm>, isEditing: boolean): string {
  if (vm.isSaving) return 'Saving...';
  if (isEditing) return 'Update Entry';
  if (vm.isCategorySplitEnabled) return `Save ${vm.splitRows.length}-Way Category Split`;
  if (vm.isSplitEnabled && vm.splitFriendName.trim()) return 'Save & Split with Friend';
  if (vm.isRecurringEnabled) return 'Save Entry & Recurring Bill';
  return 'Save Entry';
}

function AddTransactionPrimarySection({ vm, isEditing }: { vm: ReturnType<typeof useAddTransactionForm>; isEditing: boolean }) {
  return (
    <>
      {!isEditing && (
        <SmartCaptureBar
          nlpInput={vm.nlpInput} setNlpInput={vm.setNlpInput} isNlpParsing={vm.isNlpParsing} onRunNlpParse={vm.runNlpParse}
          isListeningVoice={vm.isListeningVoice} onToggleVoice={vm.handleToggleVoice} isScanningReceipts={vm.isScanningReceipts}
          receiptInputRef={vm.receiptInputRef} onReceiptFilesSelected={vm.handleReceiptFilesSelected}
          scannedBatch={vm.scannedBatch} setScannedBatch={vm.setScannedBatch} activeCategories={vm.activeCategories}
          isSavingBatch={vm.isSavingBatch} onSaveScannedBatch={vm.handleSaveScannedBatch}
        />
      )}

      <TxHeroAmountInput amountInputRef={vm.amountInputRef} amountStr={vm.amountStr} setAmountStr={vm.setAmountStr} type={vm.type} />

      {vm.type !== 'transfer' ? (
        <div className="space-y-2">
          <TxMerchantAndCategoryRow
            type={vm.type} title={vm.title} onTitleChange={vm.handleTitleChange}
            isCategorySplitEnabled={vm.isCategorySplitEnabled} selectedCategory={vm.selectedCategory}
            onOpenCategorySheet={() => vm.setIsCategorySheetOpen(true)}
          />
          <TxFitnessBridgePanel
            bridgeKind={vm.bridgeKind} dietPreview={vm.dietPreview} alsoLogToDiet={vm.alsoLogToDiet} setAlsoLogToDiet={vm.setAlsoLogToDiet}
            dietCaloriesOverride={vm.dietCaloriesOverride} setDietCaloriesOverride={vm.setDietCaloriesOverride}
            dietProteinOverride={vm.dietProteinOverride} setDietProteinOverride={vm.setDietProteinOverride}
            restockSupplementEnabled={vm.restockSupplementEnabled} setRestockSupplementEnabled={vm.setRestockSupplementEnabled}
            selectedSupplementId={vm.selectedSupplementId} onSelectSupplement={vm.selectSupplement}
            activeSupplements={vm.activeSupplements} title={vm.title} restockServingsStr={vm.restockServingsStr} setRestockServingsStr={vm.setRestockServingsStr}
          />
        </div>
      ) : (
        <TxTransferFields activeAccounts={vm.activeAccounts} toAccountId={vm.toAccountId} setToAccountId={vm.setToAccountId} title={vm.title} setTitle={vm.setTitle} />
      )}
    </>
  );
}

function AddTransactionFormBody({ vm, isEditing }: { vm: ReturnType<typeof useAddTransactionForm>; isEditing: boolean }) {
  return (
    <div className="px-4 py-3 space-y-3.5">
      <AddTransactionPrimarySection vm={vm} isEditing={isEditing} />

      <TxAccountSelector
        type={vm.type} accountId={vm.accountId} setAccountId={vm.setAccountId} activeAccounts={vm.activeAccounts} date={vm.date}
        onSetDefaultAccount={vm.setDefaultAccount}
      />

      <TxTagsPicker
        tags={vm.tags} tagInput={vm.tagInput} setTagInput={vm.setTagInput} suggestedTags={vm.suggestedTags}
        onAddTag={vm.addTagChip} onRemoveTag={(tag) => vm.setTags((prev) => prev.filter((t) => t !== tag))}
      />

      {!isEditing && vm.type === 'expense' && (
        <TxSplitAndRecurringSection
          isCategorySplitEnabled={vm.isCategorySplitEnabled} onToggleCategorySplit={vm.toggleCategorySplit}
          isSplitEnabled={vm.isSplitEnabled}
          onToggleFriendSplit={() => {
            const next = !vm.isSplitEnabled;
            vm.setIsSplitEnabled(next);
            if (next) {
              vm.setIsCategorySplitEnabled(false);
              vm.setSplitRows([]);
              if (vm.numericAmount > 0 && !vm.splitFriendShareStr) vm.setSplitFriendShareStr(String(Math.round(vm.numericAmount / 2)));
            }
          }}
          isRecurringEnabled={vm.isRecurringEnabled} setIsRecurringEnabled={vm.setIsRecurringEnabled}
          splitRows={vm.splitRows} setSplitRows={vm.setSplitRows} splitRemaining={vm.splitRemaining} activeCategories={vm.activeCategories}
          splitFriendName={vm.splitFriendName} setSplitFriendName={vm.setSplitFriendName}
          splitFriendShareStr={vm.splitFriendShareStr} setSplitFriendShareStr={vm.setSplitFriendShareStr}
          activeDebts={vm.activeDebts} numericAmount={vm.numericAmount} categoryName={vm.selectedCategory?.name || 'Category'}
          selectedAccount={vm.activeAccounts.find((a) => a.id === vm.accountId)}
          recurringCadence={vm.recurringCadence} setRecurringCadence={vm.setRecurringCadence}
          recurringDueDay={vm.recurringDueDay} setRecurringDueDay={vm.setRecurringDueDay}
        />
      )}

      <TxMoreOptionsDrawer
        showMoreOptions={vm.showMoreOptions} setShowMoreOptions={vm.setShowMoreOptions}
        date={vm.date} setDate={vm.setDate} notes={vm.notes} setNotes={vm.setNotes} type={vm.type}
        activeCommitments={vm.activeCommitments} linkedCommitmentId={vm.linkedCommitmentId} setLinkedCommitmentId={vm.setLinkedCommitmentId}
        commitmentContributionType={vm.commitmentContributionType} setCommitmentContributionType={vm.setCommitmentContributionType}
        activeDebts={vm.activeDebts} linkedDebtId={vm.linkedDebtId} setLinkedDebtId={vm.setLinkedDebtId}
      />
    </div>
  );
}

export function AddTransactionModal({
  open,
  onOpenChange,
  editingTransaction,
  defaultCommitmentId,
  defaultDebtId,
  onOpenSmsImport,
}: AddTransactionModalProps) {
  const vm = useAddTransactionForm({ open, onOpenChange, editingTransaction, defaultCommitmentId, defaultDebtId });
  const isEditing = Boolean(editingTransaction);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden max-w-full sm:max-w-[470px] w-full fixed bottom-0 top-auto left-1/2 -translate-x-1/2 translate-y-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col border-border bg-background"
      >
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        <TxModalHeader
          isEditing={isEditing}
          type={vm.type}
          onSelectType={(nextType) => {
            vm.setType(nextType);
            if (nextType !== 'expense') {
              vm.setIsCategorySplitEnabled(false);
              vm.setIsSplitEnabled(false);
              vm.setIsRecurringEnabled(false);
            }
          }}
          onOpenSms={() => {
            if (onOpenSmsImport) onOpenSmsImport();
            else {
              onOpenChange(false);
              vm.setIsLocalSmsOpen(true);
            }
          }}
          onClose={() => onOpenChange(false)}
        />

        <form onSubmit={vm.handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
          <AddTransactionFormBody vm={vm} isEditing={isEditing} />
          <div className="px-4 py-3 border-t border-border bg-background flex items-center gap-2 shrink-0">
            {isEditing && (
              <Button
                type="button" variant="outline" onClick={vm.handleDelete} aria-label="Delete transaction"
                className="h-11 w-11 shrink-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            )}
            <Button type="submit" disabled={vm.isSaving} className="w-full h-11 rounded-xl text-sm font-semibold">
              {resolveSubmitLabel(vm, isEditing)}
            </Button>
          </div>
        </form>
      </DialogContent>

      <CategoryPickerSheet
        open={vm.isCategorySheetOpen}
        onOpenChange={vm.setIsCategorySheetOpen}
        selectedCategoryId={vm.categoryId || vm.selectedCategory?.id || ''}
        onSelectCategory={vm.selectCategory}
      />

      {!onOpenSmsImport && vm.isLocalSmsOpen && <SmsImportModal open={vm.isLocalSmsOpen} onOpenChange={vm.setIsLocalSmsOpen} />}
    </Dialog>
  );
}
