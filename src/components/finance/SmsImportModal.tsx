'use client';

import React from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatINR } from '@/lib/stores/finance-store';
import { MessageSquareText, X } from 'lucide-react';
import { CategoryPickerSheet } from './CategoryPickerSheet';
import { useSmsImportController } from './sms-import/useSmsImportController';
import { SmsAutomationGuide, SmsInputControls } from './sms-import/SmsPasteStep';
import { SmsDetectedResultsSection } from './sms-import/SmsReviewList';

interface SmsImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialText?: string | null;
}

function SmsImportHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="px-5 py-3.5 border-b border-border bg-card flex items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <MessageSquareText className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <DialogTitle className="text-base font-bold text-foreground truncate">Fetch from SMS &amp; Notifications</DialogTitle>
          <p className="text-xs text-muted-foreground truncate">UPI, bank &amp; card notification parser</p>
        </div>
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

function SmsImportFooter({ c }: { c: ReturnType<typeof useSmsImportController> }) {
  const count = c.selectedItems.length;
  const totalAmount = c.selectedItems.reduce((sum, i) => sum + i.amount, 0);
  const buttonLabel = c.isImporting ? 'Importing...' : `Import ${count || ''} ${count === 1 ? 'Entry' : 'Entries'}`.trim();

  return (
    <div className="px-5 py-3.5 border-t border-border bg-background flex items-center justify-between gap-3 shrink-0">
      <div className="text-xs text-muted-foreground font-mono tabular-nums">
        {count > 0 ? `Total: ${formatINR(totalAmount)}` : 'Ready to scan'}
      </div>
      <Button type="button" disabled={count === 0 || c.isImporting} onClick={c.handleImportSelected} className="h-11 px-5 rounded-xl text-sm font-semibold">
        {buttonLabel}
      </Button>
    </div>
  );
}

export function SmsImportModal({ open, onOpenChange, initialText }: SmsImportModalProps) {
  const c = useSmsImportController({ open, onOpenChange, initialText });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden max-w-full sm:max-w-[560px] w-full fixed bottom-0 top-auto left-1/2 -translate-x-1/2 translate-y-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col border-border bg-background"
      >
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>
        <SmsImportHeader onClose={() => onOpenChange(false)} />

        <div className="px-5 py-4 overflow-y-auto space-y-4 flex-1">
          <SmsInputControls c={c} />
          {c.hasParsed && <SmsDetectedResultsSection c={c} />}
          <SmsAutomationGuide
            show={c.showAutomationGuide}
            onToggle={() => c.setShowAutomationGuide((v) => !v)}
            onCopyDeepLink={c.handleCopyDeepLink}
          />
        </div>

        <SmsImportFooter c={c} />

        <CategoryPickerSheet
          open={Boolean(c.editingCategoryItemId)}
          onOpenChange={(isOpen) => {
            if (!isOpen) c.setEditingCategoryItemId(null);
          }}
          selectedCategoryId={c.editingCategoryItem?.categoryId || ''}
          onSelectCategory={c.handleCategorySelectedForItem}
        />
      </DialogContent>
    </Dialog>
  );
}
