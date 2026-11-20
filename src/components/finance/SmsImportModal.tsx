'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import {
  parseSmsOrNotificationBatch,
  type ParsedSmsExpense,
} from '@/lib/finance/sms-parser';
import {
  MessageSquareText,
  ClipboardPaste,
  Upload,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  Sparkles,
  AlertTriangle,
  Wand2,
} from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';
import { CategoryPickerSheet } from './CategoryPickerSheet';
import { toast } from 'sonner';

interface SmsImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialText?: string | null;
}

interface PendingRulePrompt {
  itemId: string;
  merchantPattern: string;
  cleanMerchantName: string;
  categoryId: string;
  categoryName: string;
}

export function SmsImportModal({
  open,
  onOpenChange,
  initialText,
}: SmsImportModalProps) {
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const categorizationRules = useFinanceStore((s) => s.categorizationRules);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const addCategorizationRule = useFinanceStore((s) => s.addCategorizationRule);
  const loadFinanceData = useFinanceStore((s) => s.loadFinanceData);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [rawText, setRawText] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedSmsExpense[]>([]);
  const [hasParsed, setHasParsed] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showAutomationGuide, setShowAutomationGuide] = useState(false);
  const [editingCategoryItemId, setEditingCategoryItemId] = useState<string | null>(null);
  const [sendToReviewInbox, setSendToReviewInbox] = useState(true);
  const [pendingRulePrompt, setPendingRulePrompt] = useState<PendingRulePrompt | null>(null);
  const [isSavingRule, setIsSavingRule] = useState(false);

  useEffect(() => {
    if (open && categories.length === 0) {
      loadFinanceData();
    }
  }, [open, categories.length, loadFinanceData]);

  const runParse = async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) {
      setParsedItems([]);
      setHasParsed(false);
      return;
    }

    setIsParsing(true);
    setPendingRulePrompt(null);
    try {
      let detected = parseSmsOrNotificationBatch(
        trimmed,
        categories,
        accounts,
        transactions,
        categorizationRules
      );

      // Server-side AI fallback when a single unstructured notification has no deterministic match
      if (detected.length === 0 && !trimmed.includes('\n')) {
        try {
          const res = await fetch('/api/ai/parse-expense', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rawText: trimmed,
              categories: categories.map((c) => ({
                id: c.id,
                name: c.name,
                slug: c.slug,
                subcategories: c.subcategories,
              })),
            }),
          });
          if (res.ok) {
            const json = await res.json();
            const aiData = json?.data;
            if (aiData && aiData.amount > 0) {
              const cat =
                categories.find((c) => c.slug === aiData.categorySlug) ||
                categories[0];
              const acc =
                accounts.find((a) => a.type === aiData.paymentMethodType) ||
                accounts.find((a) => a.isDefault) ||
                accounts[0];
              detected = [
                {
                  id: crypto.randomUUID(),
                  rawText: trimmed,
                  rawMerchant: aiData.merchantName || aiData.title,
                  title: aiData.merchantName || aiData.title || 'Parsed Expense',
                  amount: aiData.amount,
                  type: aiData.type === 'income' ? 'income' : 'expense',
                  categoryId: cat?.id || '',
                  categorySlug: cat?.slug || 'shopping-personal-care',
                  accountId: acc?.id || '',
                  paymentMethodType: aiData.paymentMethodType || 'upi',
                  date: aiData.date || new Date().toISOString().split('T')[0],
                  isDuplicate: false,
                  confidence: aiData.confidence || 80,
                  selected: true,
                  tags: Array.isArray(aiData.tags) ? aiData.tags : undefined,
                },
              ];
            }
          }
        } catch {
          // Ignore network fallback failure
        }
      }

      setParsedItems(detected);
      setHasParsed(true);
      if (detected.length === 0) {
        toast.info('No bank or UPI expense amounts detected in that text');
      }
    } finally {
      setIsParsing(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setEditingCategoryItemId(null);
      setPendingRulePrompt(null);
      return;
    }
    if (initialText && initialText.trim()) {
      setRawText(initialText);
      runParse(initialText);
    } else {
      setRawText('');
      setParsedItems([]);
      setHasParsed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialText]);

  const handleReadClipboard = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
      toast.error('Clipboard access is unavailable in this browser. Paste manually below.');
      return;
    }
    try {
      const clipText = await navigator.clipboard.readText();
      if (!clipText || !clipText.trim()) {
        toast.info('Clipboard is empty. Copy a bank SMS or notification first.');
        return;
      }
      setRawText(clipText);
      await runParse(clipText);
    } catch {
      toast.error('Clipboard permission denied. Paste the SMS text manually below.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const content = String(ev.target?.result || '');
      if (!content.trim()) {
        toast.error('Selected file is empty');
        return;
      }
      setRawText(content);
      await runParse(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const updateItem = (id: string, patch: Partial<ParsedSmsExpense>) => {
    setParsedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const handleCategorySelectedForItem = (categoryId: string) => {
    if (!editingCategoryItemId) return;
    const targetItem = parsedItems.find((i) => i.id === editingCategoryItemId);
    const cat = categories.find((c) => c.id === categoryId);
    updateItem(editingCategoryItemId, {
      categoryId,
      categorySlug: cat?.slug || targetItem?.categorySlug || '',
    });

    if (targetItem && cat) {
      const merchantSeed = (targetItem.rawMerchant || targetItem.title || '').trim();
      const lowerSeed = merchantSeed.toLowerCase();
      const isGeneric =
        merchantSeed.length < 3 ||
        lowerSeed === 'bank / upi expense' ||
        lowerSeed === 'bank / upi credit' ||
        lowerSeed === 'parsed expense';

      if (!isGeneric) {
        const alreadyRule = categorizationRules.some(
          (r) =>
            !r.deletedAt &&
            r.isActive &&
            r.matchPattern.toLowerCase() === lowerSeed &&
            r.categoryId === categoryId
        );
        if (!alreadyRule) {
          setPendingRulePrompt({
            itemId: targetItem.id,
            merchantPattern: merchantSeed,
            cleanMerchantName: targetItem.title.trim() || merchantSeed,
            categoryId,
            categoryName: cat.name,
          });
        }
      }
    }
  };

  const handleSaveSmartRule = async () => {
    if (!pendingRulePrompt) return;
    setIsSavingRule(true);
    try {
      const created = await addCategorizationRule({
        matchPattern: pendingRulePrompt.merchantPattern,
        cleanMerchantName: pendingRulePrompt.cleanMerchantName,
        categoryId: pendingRulePrompt.categoryId,
        isActive: true,
      });

      const patternLower = pendingRulePrompt.merchantPattern.toLowerCase();
      const targetCat = categories.find((c) => c.id === pendingRulePrompt.categoryId);
      setParsedItems((prev) =>
        prev.map((item) => {
          const hay = `${item.rawMerchant || ''} ${item.title} ${item.rawText}`.toLowerCase();
          if (hay.includes(patternLower)) {
            return {
              ...item,
              categoryId: pendingRulePrompt.categoryId,
              categorySlug: targetCat?.slug || item.categorySlug,
              matchedRuleId: created.id,
              matchedRulePattern: created.matchPattern,
            };
          }
          return item;
        })
      );

      toast.success(
        `Rule saved: "${pendingRulePrompt.merchantPattern}" → ${pendingRulePrompt.categoryName}`
      );
      setPendingRulePrompt(null);
    } finally {
      setIsSavingRule(false);
    }
  };

  const selectedItems = parsedItems.filter((item) => item.selected && item.amount > 0);

  const handleImportSelected = async () => {
    if (selectedItems.length === 0) {
      toast.error('Select at least one parsed expense to import');
      return;
    }

    const fallbackCat = categories[0]?.id || 'uncategorized';
    const fallbackAcc = accounts.find((a) => a.isDefault)?.id || accounts[0]?.id || 'default';

    setIsImporting(true);
    try {
      let reviewQueued = 0;
      for (const item of selectedItems) {
        const shouldReview = sendToReviewInbox && !item.matchedRuleId;
        if (shouldReview) reviewQueued += 1;

        const mergedTags = Array.from(
          new Set([
            'sms-import',
            ...(item.tags || []),
            ...(item.referenceId ? [`ref:${item.referenceId}`] : []),
          ])
        );

        await addTransaction({
          title: item.title.trim() || 'SMS Expense',
          merchantName: item.title.trim() || undefined,
          rawMerchant: item.rawMerchant || undefined,
          amount: Number(item.amount),
          type: item.type,
          categoryId: item.categoryId || fallbackCat,
          accountId: item.accountId || fallbackAcc,
          date: item.date,
          needsReview: shouldReview,
          notes: `Imported from SMS/Notification: ${item.rawText.slice(0, 160)}`,
          tags: mergedTags,
        });
      }
      toast.success(
        reviewQueued > 0
          ? `Imported ${selectedItems.length} entries (${reviewQueued} queued for Needs Review)`
          : `Imported ${selectedItems.length} verified ${
              selectedItems.length === 1 ? 'transaction' : 'transactions'
            }`
      );
      onOpenChange(false);
    } finally {
      setIsImporting(false);
    }
  };

  const handleCopyDeepLink = async () => {
    if (typeof window === 'undefined' || !navigator.clipboard?.writeText) return;
    const urlTemplate = `${window.location.origin}/finance?sms={notification_text}`;
    try {
      await navigator.clipboard.writeText(urlTemplate);
      toast.success('Copied deep-link URL template');
    } catch {
      toast.info(urlTemplate);
    }
  };

  const editingCategoryItem = parsedItems.find((i) => i.id === editingCategoryItemId);
  const activeRuleCount = categorizationRules.filter((r) => r.isActive && !r.deletedAt).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden max-w-full sm:max-w-[560px] w-full fixed bottom-0 top-auto left-1/2 -translate-x-1/2 translate-y-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col border-border bg-background"
      >
        {/* Drag Handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border bg-card/85 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <MessageSquareText className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold text-foreground truncate">
                Fetch from SMS &amp; Notifications
              </DialogTitle>
              <p className="text-xs text-muted-foreground truncate">
                UPI, bank &amp; card parser · {activeRuleCount} active smart {activeRuleCount === 1 ? 'rule' : 'rules'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto space-y-4 flex-1">
          {/* Quick Fetch Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={handleReadClipboard}
              className="h-11 rounded-xl gap-2 text-xs font-semibold"
            >
              <ClipboardPaste className="w-4 h-4 text-primary" />
              Read Clipboard
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="h-11 rounded-xl gap-2 text-xs font-semibold"
            >
              <Upload className="w-4 h-4 text-primary" />
              Upload SMS Log
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv,.json,text/plain,application/json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Paste Box */}
          <div className="space-y-2">
            <label
              htmlFor="sms-raw-input"
              className="text-xs font-medium text-muted-foreground block"
            >
              Paste one or multiple SMS / notifications
            </label>
            <textarea
              id="sms-raw-input"
              rows={4}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste bank debit/credit SMS or UPI notification text here..."
              className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                OTPs, failed alerts, and available balances are ignored automatically.
              </span>
              <Button
                type="button"
                size="sm"
                disabled={!rawText.trim() || isParsing}
                onClick={() => runParse(rawText)}
                className="h-9 px-3.5 rounded-xl gap-1.5 text-xs font-semibold shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isParsing ? 'Scanning...' : 'Detect Expenses'}
              </Button>
            </div>
          </div>

          {/* Inline "Always Apply Rule?" Prompt after recategorization */}
          {pendingRulePrompt && (
            <div className="rounded-xl border border-primary/40 bg-primary/5 px-3.5 py-2.5 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0 text-xs">
                <Wand2 className="w-4 h-4 text-primary shrink-0" />
                <span className="text-foreground truncate">
                  Always categorize <strong>{pendingRulePrompt.merchantPattern}</strong> as{' '}
                  <strong>{pendingRulePrompt.categoryName}</strong>?
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  disabled={isSavingRule}
                  onClick={handleSaveSmartRule}
                  className="h-8 px-2.5 rounded-lg text-xs font-semibold"
                >
                  {isSavingRule ? 'Saving...' : 'Apply Rule'}
                </Button>
                <button
                  type="button"
                  onClick={() => setPendingRulePrompt(null)}
                  aria-label="Dismiss rule prompt"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Parsed Transactions Review List */}
          {hasParsed && (
            <div className="space-y-2.5 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Detected ({parsedItems.length})
                </h3>
                {parsedItems.length > 0 && (
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={sendToReviewInbox}
                        onChange={(e) => setSendToReviewInbox(e.target.checked)}
                        className="rounded border-input"
                      />
                      <span>Flag unmatched for Review Inbox</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = parsedItems.every((i) => i.selected);
                        setParsedItems((prev) =>
                          prev.map((i) => ({ ...i, selected: !allSelected }))
                        );
                      }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {parsedItems.every((i) => i.selected) ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                )}
              </div>

              {parsedItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No valid debit or credit transactions found. Make sure the text includes an amount (e.g. ₹450 or Rs. 450).
                </div>
              ) : (
                <div className="space-y-2.5">
                  {parsedItems.map((item) => {
                    const cat = categories.find((c) => c.id === item.categoryId);
                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl border p-3.5 space-y-2.5 transition-colors ${
                          item.selected
                            ? 'border-primary/40 bg-card'
                            : 'border-border bg-muted/30 opacity-70'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              updateItem(item.id, { selected: !item.selected })
                            }
                            aria-label={
                              item.selected ? 'Deselect transaction' : 'Select transaction'
                            }
                            className={`mt-1 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                              item.selected
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'border-input bg-background'
                            }`}
                          >
                            {item.selected && <Check className="w-3.5 h-3.5" />}
                          </button>

                          <div className="flex-1 min-w-0 grid grid-cols-12 gap-2">
                            <div className="col-span-7">
                              <Input
                                value={item.title}
                                onChange={(e) =>
                                  updateItem(item.id, { title: e.target.value })
                                }
                                aria-label="Merchant or title"
                                className="h-9 text-xs sm:text-sm font-medium rounded-lg"
                              />
                            </div>
                            <div className="col-span-5">
                              <Input
                                type="number"
                                min="1"
                                step="any"
                                value={item.amount || ''}
                                onChange={(e) =>
                                  updateItem(item.id, {
                                    amount: Math.max(0, parseFloat(e.target.value) || 0),
                                  })
                                }
                                aria-label="Amount"
                                className="h-9 text-xs sm:text-sm font-mono tabular-nums font-bold text-right rounded-lg"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pl-7">
                          <button
                            type="button"
                            onClick={() => setEditingCategoryItemId(item.id)}
                            className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium flex items-center gap-1.5 transition-colors"
                          >
                            <CategoryIcon
                              name={cat?.icon}
                              className="w-3.5 h-3.5"
                              style={{ color: cat?.color }}
                            />
                            <span>{cat?.name || 'Category'}</span>
                            <ChevronDown className="w-3 h-3 text-muted-foreground" />
                          </button>

                          <select
                            value={item.accountId}
                            onChange={(e) =>
                              updateItem(item.id, { accountId: e.target.value })
                            }
                            aria-label="Account"
                            className="h-8 px-2 text-xs rounded-lg border border-border bg-background text-foreground"
                          >
                            {accounts
                              .filter((a) => !a.deletedAt)
                              .map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.name}
                                </option>
                              ))}
                          </select>

                          <button
                            type="button"
                            onClick={() =>
                              updateItem(item.id, {
                                type: item.type === 'expense' ? 'income' : 'expense',
                              })
                            }
                            className={`h-8 px-2.5 rounded-lg text-xs font-semibold capitalize ${
                              item.type === 'income'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-muted text-foreground'
                            }`}
                          >
                            {item.type}
                          </button>

                          <span className="text-[11px] font-mono tabular-nums text-muted-foreground ml-auto">
                            {item.date}
                          </span>
                        </div>

                        {/* Unboxed metadata row: smart rule match / review status / duplicate */}
                        {(item.matchedRulePattern || item.isDuplicate) && (
                          <div className="pl-7 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            {item.matchedRulePattern && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                                <Wand2 className="w-3 h-3 shrink-0" />
                                Rule matched: {item.matchedRulePattern} · Auto-verified
                              </span>
                            )}
                            {item.isDuplicate && (
                              <span className="text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                Possible duplicate of an existing entry
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Auto-Capture Setup Guide */}
          <div className="rounded-xl border border-border/70 bg-muted/20 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAutomationGuide((v) => !v)}
              className="w-full min-h-[44px] px-3.5 py-2.5 flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>How to auto-capture mobile SMS &amp; notifications</span>
              {showAutomationGuide ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            {showAutomationGuide && (
              <div className="px-3.5 pb-3.5 space-y-2.5 text-xs text-muted-foreground border-t border-border/50 pt-2.5">
                <p>
                  <strong className="text-foreground">1. Android Share Menu:</strong>{' '}
                  Install Habit Flow to your home screen, then share any bank SMS or notification directly to <em>Habit Flow</em> to pre-fill this importer.
                </p>
                <p>
                  <strong className="text-foreground">2. Android MacroDroid / Tasker or iOS Shortcuts:</strong>{' '}
                  Open this deep-link when a bank notification arrives:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-2.5 py-1.5 rounded-lg bg-background border border-border text-[11px] font-mono truncate">
                    /finance?sms=&#123;notification_text&#125;
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCopyDeepLink}
                    className="h-8 px-2.5 rounded-lg gap-1 text-xs shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="px-5 py-3.5 border-t border-border bg-background flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-muted-foreground font-mono tabular-nums">
            {selectedItems.length > 0
              ? `Total: ${formatINR(
                  selectedItems.reduce((sum, i) => sum + i.amount, 0)
                )}`
              : 'Ready to scan'}
          </div>
          <Button
            type="button"
            disabled={selectedItems.length === 0 || isImporting}
            onClick={handleImportSelected}
            className="h-11 px-5 rounded-xl text-sm font-semibold"
          >
            {isImporting
              ? 'Importing...'
              : `Import ${selectedItems.length || ''} ${
                  selectedItems.length === 1 ? 'Entry' : 'Entries'
                }`.trim()}
          </Button>
        </div>
      </DialogContent>

      <CategoryPickerSheet
        open={Boolean(editingCategoryItemId)}
        onOpenChange={(next) => {
          if (!next) setEditingCategoryItemId(null);
        }}
        selectedCategoryId={editingCategoryItem?.categoryId || ''}
        onSelectCategory={handleCategorySelectedForItem}
      />
    </Dialog>
  );
}
