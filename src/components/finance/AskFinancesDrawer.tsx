'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useFinanceStore } from '@/lib/stores/finance-store';
import { buildFinanceQAContext } from '@/lib/finance/anomalies';
import { Sparkles, X, Send, Loader2, Bot, User } from 'lucide-react';

interface AskFinancesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPrompt?: string | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: string;
}

const STARTER_PROMPTS = [
  'How much can I safely spend per day for the rest of this month?',
  'Where did most of my spending go this month?',
  'Do I have any cash-flow crunch or upcoming bills in the next 14 days?',
  'What is my current Net Worth breakdown and savings rate?',
];

export function AskFinancesDrawer({
  open,
  onOpenChange,
  initialPrompt,
}: AskFinancesDrawerProps) {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const categories = useFinanceStore((s) => s.categories);
  const transactions = useFinanceStore((s) => s.transactions);
  const accounts = useFinanceStore((s) => s.accounts);
  const recurringBills = useFinanceStore((s) => s.recurringBills);
  const emiTrackers = useFinanceStore((s) => s.emiTrackers);
  const debtRecords = useFinanceStore((s) => s.debtRecords);
  const sipPlans = useFinanceStore((s) => s.sipPlans);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);
  const getNetWorthSummary = useFinanceStore((s) => s.getNetWorthSummary);
  const getSpendingAnomalies = useFinanceStore((s) => s.getSpendingAnomalies);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setIsLoading(true);

    try {
      const summary = getMonthlySummary(selectedMonth);
      const netWorth = getNetWorthSummary();
      const anomalies = getSpendingAnomalies(selectedMonth);

      const context = buildFinanceQAContext({
        selectedMonth,
        summary,
        netWorth,
        transactions,
        categories,
        accounts,
        recurringBills,
        emiTrackers,
        sipPlans,
        debtRecords,
        anomalies,
      });

      const res = await fetch('/api/ai/finance-qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          history: nextHistory.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to get answer');
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            data?.answer ||
            'I could not compute an answer from your current financial snapshot.',
          source: data?.source,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            'Unable to reach the financial analyst right now. Please try again in a moment.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && initialPrompt && initialPrompt.trim()) {
      sendQuestion(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPrompt]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden max-w-full sm:max-w-[520px] w-full fixed bottom-0 top-auto left-1/2 -translate-x-1/2 translate-y-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 rounded-t-3xl sm:rounded-2xl h-[82vh] sm:h-[640px] flex flex-col border-border bg-background"
      >
        {/* Mobile Handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border bg-card flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold text-foreground truncate">
                Ask My Finances
              </DialogTitle>
              <p className="text-xs text-muted-foreground truncate">
                Private Q&amp;A grounded in your {selectedMonth} ledger &amp; cashflow
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close Ask My Finances"
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conversation Thread */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5"
        >
          {messages.length === 0 ? (
            <div className="space-y-4 py-4">
              <div className="rounded-2xl border border-border bg-card p-4 space-y-1.5">
                <p className="text-sm font-semibold text-foreground">
                  Ask anything about your money
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Only aggregated category totals, budgets, upcoming bills, and Net Worth summaries are shared to answer your question—never raw bank account numbers.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                  Suggested Questions
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendQuestion(prompt)}
                      className="text-left px-3.5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted/50 text-xs font-medium text-foreground transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${
                    msg.role === 'user' ? 'flex-row-reverse' : ''
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <User className="w-3.5 h-3.5" />
                    ) : (
                      <Bot className="w-3.5 h-3.5" />
                    )}
                  </span>

                  <div
                    className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'border border-border bg-card text-foreground rounded-tl-sm'
                    }`}
                  >
                    <div>{msg.content}</div>
                    {msg.role === 'assistant' && msg.source && (
                      <div className="mt-1.5 pt-1 border-t border-border/50 text-[10px] text-muted-foreground font-mono">
                        {msg.source === 'gemini'
                          ? 'Answered by Gemini'
                          : 'Answered by Local Ledger Analyzer (AI key not configured)'}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-start gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-muted text-foreground flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5" />
                  </span>
                  <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-3.5 py-2.5 text-xs text-muted-foreground inline-flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    <span>Analyzing your numbers...</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sticky Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendQuestion(input);
          }}
          className="px-4 py-3 border-t border-border bg-background flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g., How much did I spend on food vs last month?"
            aria-label="Ask a question about your finances"
            className="flex-1 h-11 px-3.5 rounded-xl border border-input bg-card text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            aria-label="Send question"
            className="h-11 w-11 p-0 rounded-xl shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
