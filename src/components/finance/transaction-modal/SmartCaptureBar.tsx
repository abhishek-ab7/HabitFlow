'use client';

import React from 'react';
import { Sparkles, Mic, MicOff, Camera, Check, Loader2, Send } from 'lucide-react';
import { formatINR } from '@/lib/stores/finance-store';
import type { FinanceCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import type { ScannedDraftItem } from './tx-modal-types';

function ScannedBatchChecklist(params: {
  scannedBatch: ScannedDraftItem[];
  setScannedBatch: React.Dispatch<React.SetStateAction<ScannedDraftItem[]>>;
  activeCategories: FinanceCategory[];
  isSavingBatch: boolean;
  onSaveBatch: () => void;
}) {
  const { scannedBatch, setScannedBatch, activeCategories, isSavingBatch, onSaveBatch } = params;
  if (scannedBatch.length === 0) return null;
  const selectedCount = scannedBatch.filter((i) => i.selected).length;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">Scanned {scannedBatch.length} receipts · Review batch</span>
        <button type="button" onClick={() => setScannedBatch([])} className="text-[11px] text-muted-foreground hover:text-foreground">
          Discard
        </button>
      </div>
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {scannedBatch.map((item) => {
          const cat = activeCategories.find((c) => c.id === item.categoryId);
          return (
            <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-background border border-border px-2.5 py-1.5 text-xs">
              <button
                type="button"
                onClick={() => setScannedBatch((prev) => prev.map((x) => (x.id === item.id ? { ...x, selected: !x.selected } : x)))}
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  item.selected ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-background'
                }`}
              >
                {item.selected && <Check className="w-3 h-3" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground truncate">{item.merchantName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{cat?.name || 'General'} · {item.date}</p>
              </div>
              <span className="font-mono tabular-nums font-bold text-foreground shrink-0">{formatINR(item.amount)}</span>
            </div>
          );
        })}
      </div>
      <Button type="button" size="sm" disabled={isSavingBatch} onClick={onSaveBatch} className="w-full h-9 rounded-lg text-xs font-semibold">
        {isSavingBatch ? 'Saving batch...' : `Save ${selectedCount} to Review Inbox`}
      </Button>
    </div>
  );
}

export function SmartCaptureBar(params: {
  nlpInput: string;
  setNlpInput: React.Dispatch<React.SetStateAction<string>>;
  isNlpParsing: boolean;
  onRunNlpParse: (text: string) => void;
  isListeningVoice: boolean;
  onToggleVoice: () => void;
  isScanningReceipts: boolean;
  receiptInputRef: React.RefObject<HTMLInputElement | null>;
  onReceiptFilesSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  scannedBatch: ScannedDraftItem[];
  setScannedBatch: React.Dispatch<React.SetStateAction<ScannedDraftItem[]>>;
  activeCategories: FinanceCategory[];
  isSavingBatch: boolean;
  onSaveScannedBatch: () => void;
}) {
  const {
    nlpInput, setNlpInput, isNlpParsing, onRunNlpParse,
    isListeningVoice, onToggleVoice, isScanningReceipts, receiptInputRef,
    onReceiptFilesSelected, scannedBatch, setScannedBatch, activeCategories,
    isSavingBatch, onSaveScannedBatch,
  } = params;

  return (
    <div className="rounded-xl border border-border bg-card p-2 space-y-2">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Sparkles className="w-3.5 h-3.5 text-primary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={nlpInput}
            onChange={(e) => setNlpInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onRunNlpParse(nlpInput);
              }
            }}
            placeholder='Smart fill: "380 Swiggy lunch UPI"'
            aria-label="Smart natural language expense capture"
            className="w-full h-9 pl-8 pr-2 rounded-lg bg-muted/40 border border-transparent focus:border-primary/50 focus:bg-background text-xs text-foreground placeholder:text-muted-foreground outline-none transition-colors"
          />
        </div>

        {nlpInput.trim().length > 0 && (
          <button
            type="button"
            disabled={isNlpParsing}
            onClick={() => onRunNlpParse(nlpInput)}
            aria-label="Parse natural language expense"
            className="h-9 px-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1 shrink-0"
          >
            {isNlpParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        )}

        <button
          type="button"
          onClick={onToggleVoice}
          aria-label={isListeningVoice ? 'Stop voice input' : 'Voice to expense'}
          title="Voice to Expense"
          className={`h-9 w-9 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
            isListeningVoice
              ? 'border-rose-500 bg-rose-500/15 text-rose-600 dark:text-rose-400'
              : 'border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          {isListeningVoice ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <button
          type="button"
          disabled={isScanningReceipts}
          onClick={() => receiptInputRef.current?.click()}
          aria-label="Scan receipt or UPI screenshot"
          title="Scan 1–5 Receipts or UPI Screenshots"
          className="h-9 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground flex items-center gap-1 shrink-0 transition-colors"
        >
          {isScanningReceipts ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <Camera className="w-3.5 h-3.5 text-primary" />}
          <span className="hidden sm:inline">Scan</span>
        </button>
        <input ref={receiptInputRef} type="file" accept="image/*" multiple onChange={onReceiptFilesSelected} className="hidden" />
      </div>

      <ScannedBatchChecklist
        scannedBatch={scannedBatch}
        setScannedBatch={setScannedBatch}
        activeCategories={activeCategories}
        isSavingBatch={isSavingBatch}
        onSaveBatch={onSaveScannedBatch}
      />
    </div>
  );
}
