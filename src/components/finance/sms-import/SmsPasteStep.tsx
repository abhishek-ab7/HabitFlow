'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Copy,
  Sparkles,
  Upload,
} from 'lucide-react';
import type { useSmsImportController } from './useSmsImportController';

export function SmsAutomationGuide({
  show,
  onToggle,
  onCopyDeepLink,
}: {
  show: boolean;
  onToggle: () => void;
  onCopyDeepLink: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full min-h-[44px] px-3.5 py-2.5 flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>How to auto-capture mobile SMS &amp; notifications</span>
        {show ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {show && (
        <div className="px-3.5 pb-3.5 space-y-2.5 text-xs text-muted-foreground border-t border-border/50 pt-2.5">
          <p>
            <strong className="text-foreground">1. Android Share Menu:</strong> Install Habit Flow to your home screen, then share any bank SMS or notification directly to <em>Habit Flow</em> to pre-fill this importer.
          </p>
          <p>
            <strong className="text-foreground">2. Android MacroDroid / Tasker or iOS Shortcuts:</strong> Open this deep-link when a bank notification arrives:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-2.5 py-1.5 rounded-lg bg-background border border-border text-[11px] font-mono truncate">
              /finance?sms=&#123;notification_text&#125;
            </code>
            <Button type="button" size="sm" variant="outline" onClick={onCopyDeepLink} className="h-8 px-2.5 rounded-lg gap-1 text-xs shrink-0">
              <Copy className="w-3.5 h-3.5" />
              Copy
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SmsInputControls({ c }: { c: ReturnType<typeof useSmsImportController> }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <Button type="button" variant="outline" onClick={c.handleReadClipboard} className="h-11 rounded-xl gap-2 text-xs font-semibold">
          <ClipboardPaste className="w-4 h-4 text-primary" />
          Read Clipboard
        </Button>
        <Button type="button" variant="outline" onClick={() => c.fileInputRef.current?.click()} className="h-11 rounded-xl gap-2 text-xs font-semibold">
          <Upload className="w-4 h-4 text-primary" />
          Upload SMS Log
        </Button>
        <input ref={c.fileInputRef} type="file" accept=".txt,.csv,.json,text/plain,application/json" onChange={c.handleFileUpload} className="hidden" />
      </div>

      <div className="space-y-2">
        <label htmlFor="sms-raw-input" className="text-xs font-medium text-muted-foreground block">Paste one or multiple SMS / notifications</label>
        <textarea
          id="sms-raw-input"
          rows={4}
          value={c.rawText}
          onChange={(e) => c.setRawText(e.target.value)}
          placeholder="Paste bank debit/credit SMS or UPI notification text here..."
          className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">OTPs, failed alerts, and available balances are ignored automatically.</span>
          <Button type="button" size="sm" disabled={!c.rawText.trim() || c.isParsing} onClick={() => c.runParse(c.rawText)} className="h-9 px-3.5 rounded-xl gap-1.5 text-xs font-semibold shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
            {c.isParsing ? 'Scanning...' : 'Detect Expenses'}
          </Button>
        </div>
      </div>
    </>
  );
}
