'use client';

import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  ArrowRight,
  HeartHandshake,
  Users,
  Wallet,
  Tag,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import { parseExpenseDeterministically } from '@/lib/ai/prompts';
import type { ExpenseParseOutput } from '@/lib/ai/types';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const QUICK_EXAMPLES = [
  'Ordered ₹350 Vitamin D & Calcium for Mother via UPI',
  'Paid Rahul ₹400 towards ₹2,000 borrowed via GPay',
  'Bought Creatine Monohydrate ₹1,199 on Credit Card',
  'Paid Wi-Fi broadband bill ₹999 via UPI',
];

export function SmartExpenseBar({
  onOpenDetailedModal,
}: {
  onOpenDetailedModal?: (prefill?: Partial<ExpenseParseOutput>) => void;
}) {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiRefining, setIsAiRefining] = useState(false);

  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const commitments = useFinanceStore((s) => s.commitments);
  const debtRecords = useFinanceStore((s) => s.debtRecords);
  const addTransaction = useFinanceStore((s) => s.addTransaction);

  // Instant deterministic parse while typing
  const liveParsed = useMemo<ExpenseParseOutput | null>(() => {
    if (!input.trim()) return null;
    return parseExpenseDeterministically({
      rawText: input,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        subcategories: c.subcategories,
      })),
      commitments: commitments
        .filter((c) => c.isActive)
        .map((c) => ({
          id: c.id,
          title: c.title,
          recipientName: c.recipientName,
        })),
      debts: debtRecords
        .filter((d) => d.status === 'active')
        .map((d) => ({
          id: d.id,
          personName: d.personName,
          direction: d.direction,
          remainingAmount: d.remainingAmount,
        })),
    });
  }, [input, categories, commitments, debtRecords]);

  const handleQuickLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveParsed || liveParsed.amount <= 0) {
      toast.error('Please include an amount (e.g., "Ordered ₹450 lipstick for Mother")');
      return;
    }

    setIsSubmitting(true);
    try {
      const matchedCategory =
        categories.find((c) => c.slug === liveParsed.categorySlug) || categories[0];

      const matchedAccount =
        accounts.find((a) => a.type === liveParsed.paymentMethodType) ||
        accounts.find((a) => a.isDefault) ||
        accounts[0];

      if (!matchedCategory || !matchedAccount) {
        toast.error('Please wait for categories and accounts to initialize');
        return;
      }

      const todayStr = new Date().toISOString().split('T')[0];

      await addTransaction({
        title: liveParsed.title,
        amount: liveParsed.amount,
        type: liveParsed.type,
        categoryId: matchedCategory.id,
        subcategory: liveParsed.subcategory,
        accountId: matchedAccount.id,
        date: todayStr,
        notes: liveParsed.notes,
        tags: liveParsed.tags,
        linkedCommitmentId: liveParsed.matchedCommitmentId || null,
        commitmentContributionType: liveParsed.commitmentContributionType || null,
        linkedDebtId: liveParsed.matchedDebtId || null,
      });

      const offsetMsg = liveParsed.matchedCommitmentRecipient
        ? ` • Deducted ${formatINR(liveParsed.amount)} from ${liveParsed.matchedCommitmentRecipient}'s monthly commitment`
        : liveParsed.matchedDebtPerson
        ? ` • Applied ${formatINR(liveParsed.amount)} partial installment to ${liveParsed.matchedDebtPerson}`
        : '';

      toast.success(
        `Logged ${formatINR(liveParsed.amount)} in ${matchedCategory.name}${offsetMsg} (+10 XP)`
      );
      setInput('');
    } catch {
      toast.error('Failed to log transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAiRefineAndOpen = async () => {
    if (!input.trim()) {
      onOpenDetailedModal?.();
      return;
    }
    setIsAiRefining(true);
    try {
      const res = await fetch('/api/ai/parse-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: input,
          categories: categories.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            subcategories: c.subcategories,
          })),
          commitments: commitments.map((c) => ({
            id: c.id,
            title: c.title,
            recipientName: c.recipientName,
          })),
          debts: debtRecords.map((d) => ({
            id: d.id,
            personName: d.personName,
            direction: d.direction,
            remainingAmount: d.remainingAmount,
          })),
        }),
      });
      const json = await res.json();
      onOpenDetailedModal?.(json?.data || liveParsed || undefined);
    } catch {
      onOpenDetailedModal?.(liveParsed || undefined);
    } finally {
      setIsAiRefining(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card/90 backdrop-blur-md p-4 shadow-sm transition-all">
      <form onSubmit={handleQuickLog} className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Sparkles className="w-4 h-4 text-primary absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Smart Log: "Ordered ₹450 lipstick for Mother via UPI" or "Paid Rahul ₹500 towards ₹2000"...'
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-border bg-background/80 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              aria-label="Smart natural language expense input"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="submit"
              disabled={!liveParsed || liveParsed.amount <= 0 || isSubmitting}
              className="flex-1 sm:flex-initial gap-1.5 font-medium"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Quick Log</span>
                  {liveParsed && liveParsed.amount > 0 && (
                    <span className="font-mono tabular-nums text-xs opacity-90">
                      ({formatINR(liveParsed.amount)})
                    </span>
                  )}
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleAiRefineAndOpen}
              disabled={isAiRefining}
              className="text-xs shrink-0"
            >
              {isAiRefining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Detailed Form'}
            </Button>
          </div>
        </div>

        {/* Live Instant Parsed Preview Bar */}
        {liveParsed && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs animate-in fade-in duration-150">
            <span className="text-muted-foreground font-medium">Auto-detected:</span>

            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono tabular-nums font-semibold">
              {liveParsed.amount > 0 ? formatINR(liveParsed.amount) : 'Enter ₹ amount'}
            </span>

            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">
              <Tag className="w-3 h-3" />
              {liveParsed.categoryName}
              {liveParsed.subcategory ? ` • ${liveParsed.subcategory}` : ''}
            </span>

            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground uppercase">
              <Wallet className="w-3 h-3" />
              {liveParsed.paymentMethodType || 'UPI'}
            </span>

            {liveParsed.matchedCommitmentRecipient && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/30 font-medium">
                <HeartHandshake className="w-3.5 h-3.5" />
                Deducts from {liveParsed.matchedCommitmentRecipient}&apos;s Monthly Commitment (
                {liveParsed.commitmentContributionType === 'direct_payment'
                  ? 'Direct Transfer'
                  : 'Offset Purchase/Bill'}
                )
              </span>
            )}

            {liveParsed.matchedDebtPerson && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-medium">
                <Users className="w-3.5 h-3.5" />
                Partial Installment for {liveParsed.matchedDebtPerson}
              </span>
            )}
          </div>
        )}

        {/* Quick Sample Prompts when input is empty */}
        {!input && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] text-muted-foreground mr-1">Try:</span>
            {QUICK_EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setInput(example)}
                className="text-[11px] px-2 py-0.5 rounded-md border border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors truncate max-w-[260px]"
              >
                {example}
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}
