'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useFinanceStore } from '@/lib/stores/finance-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useMoodStore } from '@/lib/stores/mood-store';
import { isFitnessModuleEnabled } from '@/lib/workspace-modules';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { buildFinanceQAContext } from '@/lib/finance/anomalies';
import { getIstIsoDate } from '@/lib/mcp/config';
import { Sparkles, X, Send, Loader2, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AskFinancesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPrompt?: string | null;
  userId?: string | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: string;
}

const STARTER_PROMPTS = [
  'How much did junk food cost me in ₹ and empty kcal this month?',
  'What is my gym ₹/workout ROI and whey ₹/25g protein value?',
  'Do low-sleep (<6.5h) or stressed days trigger more junk spending?',
  'How much can I safely spend per day for the rest of this month?',
  'Do I have any cash-flow crunch or upcoming bills in the next 14 days?',
];

function triggerStoreLoad(shouldLoad: boolean, loader?: () => unknown): void {
  if (!shouldLoad || !loader) return;
  Promise.resolve(loader()).catch(() => {});
}

function hydrateFitnessIfNeeded(isFitnessEnabled: boolean, userId?: string | null): void {
  if (!isFitnessEnabled) return;
  const fitState = useFitnessStore.getState?.();
  if (!fitState) return;
  const needsLoad = !fitState.hasLoaded || (userId && fitState.currentUserId !== userId);
  triggerStoreLoad(Boolean(needsLoad), () => fitState.loadFitnessData?.(userId || undefined, false));
}

function getRecentDateWindow(daysBack: number): { start: string; end: string } {
  const end = getIstIsoDate();
  const d = new Date(`${end}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - daysBack);
  return { start: d.toISOString().slice(0, 10), end };
}

function hydrateCrossDomainStores(isFitnessEnabled: boolean, userId?: string | null): void {
  hydrateFitnessIfNeeded(isFitnessEnabled, userId);

  const habitState = useHabitStore.getState();
  const moodState = useMoodStore.getState();
  const { start, end } = getRecentDateWindow(35);

  triggerStoreLoad(!habitState.habits.length, () => habitState.loadHabits());
  triggerStoreLoad(!habitState.completions.length, () => habitState.loadCompletions(start, end));
  triggerStoreLoad(!moodState.moodLogs.length, () => moodState.loadMoodLogs(start, end));
}

async function requestFinanceQAAnswer(params: {
  question: string;
  history: ChatMessage[];
  context: ReturnType<typeof buildFinanceQAContext>;
  signal: AbortSignal;
}): Promise<{ content: string; source?: string }> {
  const res = await fetch('/api/ai/finance-qa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: params.signal,
    body: JSON.stringify({
      question: params.question,
      history: params.history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      context: params.context,
    }),
  });
  if (!res.ok) throw new Error('Failed to get answer');
  const data = await res.json();
  return {
    content: data?.answer || 'I could not compute an answer from your current financial snapshot.',
    source: data?.source,
  };
}

function AskFinancesStarterView({
  isFitnessEnabled,
  onSelectPrompt,
}: {
  isFitnessEnabled: boolean;
  onSelectPrompt: (prompt: string) => void;
}) {
  const prompts = isFitnessEnabled ? STARTER_PROMPTS : STARTER_PROMPTS.slice(3);
  return (
    <div className="space-y-4 py-4">
      <div className="rounded-2xl border border-border bg-card p-4 space-y-1.5">
        <p className="text-sm font-semibold text-foreground">
          Ask anything across money, diet, supplements &amp; bio triggers
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Only aggregated totals, supplement/gym ROI metrics, sleep triggers, and Net Worth summaries are shared to answer your question—never raw bank account numbers.
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Suggested Questions
        </p>
        <div className="grid grid-cols-1 gap-2">
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSelectPrompt(prompt)}
              className="text-left px-3.5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted/50 text-xs font-medium text-foreground transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AskFinancesMessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </span>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${isUser ? 'bg-primary text-primary-foreground rounded-tr-sm whitespace-pre-wrap' : 'border border-border bg-card text-foreground rounded-tl-sm'}`}>
        {isUser ? (
          <div>{msg.content}</div>
        ) : (
          <div className="space-y-2 break-words">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="leading-relaxed last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 my-1.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 my-1.5">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
                code: ({ children }) => <span className="px-1.5 py-0.5 rounded-md bg-muted text-foreground font-medium text-[0.92em]">{children}</span>,
                h1: ({ children }) => <p className="font-bold text-foreground">{children}</p>,
                h2: ({ children }) => <p className="font-bold text-foreground">{children}</p>,
                h3: ({ children }) => <p className="font-semibold text-foreground">{children}</p>,
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        )}
        {!isUser && msg.source && (
          <div className="mt-2 pt-1.5 border-t border-border/50 text-[10px] text-muted-foreground font-mono">
            {msg.source === 'gemini' ? 'Answered by Gemini' : 'Answered by Local Ledger Analyzer (AI key not configured)'}
          </div>
        )}
      </div>
    </div>
  );
}

export function AskFinancesDrawer({ open, onOpenChange, initialPrompt, userId }: AskFinancesDrawerProps) {
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

  const fitnessProfile = useFitnessStore((s) => s.profile);
  const fitnessDailyLogs = useFitnessStore((s) => s.dailyLogs);
  const fitnessMealLogs = useFitnessStore((s) => s.mealLogs);
  const fitnessWorkoutSessions = useFitnessStore((s) => s.workoutSessions);
  const fitnessSupplements = useFitnessStore((s) => s.supplementInventory);
  const fitnessSupplementLogs = useFitnessStore((s) => s.supplementLogs);
  const habits = useHabitStore((s) => s.habits);
  const habitCompletions = useHabitStore((s) => s.completions);
  const moodLogs = useMoodStore((s) => s.moodLogs);
  const isFitnessEnabled = isFitnessModuleEnabled(useGamificationStore((s) => s.settings));

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) return;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, [open]);

  useEffect(() => () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  useEffect(() => {
    if (open) hydrateCrossDomainStores(isFitnessEnabled, userId);
  }, [open, userId, isFitnessEnabled]);

  const buildSnapshotContext = () =>
    buildFinanceQAContext({
      selectedMonth,
      summary: getMonthlySummary(selectedMonth),
      netWorth: getNetWorthSummary(),
      transactions,
      categories,
      accounts,
      recurringBills,
      emiTrackers,
      sipPlans,
      debtRecords,
      anomalies: getSpendingAnomalies(selectedMonth),
      fitness: isFitnessEnabled
        ? {
            todayDate: getIstIsoDate(),
            fitnessProfile,
            fitnessDailyLogs,
            mealLogs: fitnessMealLogs,
            workoutSessions: fitnessWorkoutSessions,
            supplementInventory: fitnessSupplements,
            supplementLogs: fitnessSupplementLogs,
            habits,
            habitCompletions,
            moodLogs,
          }
        : undefined,
    });

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setIsLoading(true);

    try {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const reply = await requestFinanceQAAnswer({
        question: trimmed,
        history: nextHistory,
        context: buildSnapshotContext(),
        signal: controller.signal,
      });
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', ...reply }]);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Unable to reach the financial analyst right now. Please try again in a moment.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && initialPrompt && initialPrompt.trim()) sendQuestion(initialPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPrompt]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden max-w-full sm:max-w-[520px] w-full fixed bottom-0 top-auto left-1/2 -translate-x-1/2 translate-y-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 rounded-t-3xl sm:rounded-2xl h-[82vh] sm:h-[640px] flex flex-col border-border bg-background"
      >
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="px-5 py-3.5 border-b border-border bg-card flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold text-foreground truncate">Ask Life OS</DialogTitle>
              <p className="text-xs text-muted-foreground truncate">
                Cross-domain Q&amp;A across {selectedMonth} ledger, diet, gym ROI &amp; bio triggers
              </p>
            </div>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Close Ask Life OS" className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5">
          {messages.length === 0 ? (
            <AskFinancesStarterView isFitnessEnabled={isFitnessEnabled} onSelectPrompt={sendQuestion} />
          ) : (
            <>
              {messages.map((msg) => <AskFinancesMessageBubble key={msg.id} msg={msg} />)}
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
          <Button type="submit" disabled={!input.trim() || isLoading} aria-label="Send question" className="h-11 w-11 p-0 rounded-xl shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
