'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  Sparkles,
  Receipt,
  CheckSquare,
  Users,
  Calendar,
  Clock,
  ArrowRight,
  Loader2,
  X,
  Command,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import {
  detectIntent,
  parseExpenseNaturalLanguage,
  parseTaskNaturalLanguage,
  type QuickCaptureIntent,
} from '@/lib/quick-capture/parser';

export function QuickCaptureModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [rawText, setRawText] = useState('');
  const [manualMode, setManualMode] = useState<'auto' | 'expense' | 'task'>('auto');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Stores
  const accounts = useFinanceStore((s) => s.accounts);
  const categories = useFinanceStore((s) => s.categories);
  const loadFinanceData = useFinanceStore((s) => s.loadFinanceData);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const addDebtRecord = useFinanceStore((s) => s.addDebtRecord);
  const addTask = useTaskStore((s) => s.addTask);

  // Global shortcut: ⌘K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        // Prevent default browser search/address bar
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Shared event trigger to open Quick-Capture from any floating button or command bar
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-quick-capture', handleOpen);
    return () => window.removeEventListener('open-quick-capture', handleOpen);
  }, []);

  // Focus input and hydrate stores when opened
  useEffect(() => {
    if (isOpen) {
      if (accounts.length === 0 || categories.length === 0) {
        loadFinanceData();
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setRawText('');
      setManualMode('auto');
    }
  }, [isOpen, accounts.length, categories.length, loadFinanceData]);

  // Derived intent
  const detectedIntent: QuickCaptureIntent = useMemo(() => {
    if (manualMode !== 'auto') return manualMode;
    return detectIntent(rawText);
  }, [rawText, manualMode]);

  // Real-time parsed expense defaults
  const parsedExpense = useMemo(() => {
    return parseExpenseNaturalLanguage(rawText);
  }, [rawText]);

  // Real-time parsed task defaults
  const parsedTask = useMemo(() => {
    return parseTaskNaturalLanguage(rawText);
  }, [rawText]);

  // Editable Expense State
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategorySlug, setExpenseCategorySlug] = useState('');
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => getLocalIsoDate());
  const [isSplit, setIsSplit] = useState(false);
  const [splitFriend, setSplitFriend] = useState('');
  const [splitAmount, setSplitAmount] = useState('');

  // Editable Task State
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskDueTime, setTaskDueTime] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');

  // Track default account assignment without resetting manual/AI inputs
  useEffect(() => {
    if (!expenseAccountId && accounts.length > 0) {
      setExpenseAccountId(accounts.find((a) => a.isDefault)?.id || accounts[0]?.id || '');
    }
  }, [accounts, expenseAccountId]);

  // Sync parsed results into editable form fields as user types rawText or mode changes
  // Note: expenseAccountId is explicitly excluded from deps to prevent resetting manual/AI inputs
  useEffect(() => {
    if (detectedIntent === 'expense') {
      setExpenseTitle(parsedExpense.title);
      setExpenseAmount(parsedExpense.amount > 0 ? String(parsedExpense.amount) : '');
      setExpenseCategorySlug(parsedExpense.categorySlug);
      setExpenseDate(parsedExpense.date);
      setIsSplit(parsedExpense.isSplit);
      setSplitFriend(parsedExpense.splitWithFriend || '');
      setSplitAmount(parsedExpense.splitAmount ? String(parsedExpense.splitAmount) : '');
    } else {
      setTaskTitle(parsedTask.title);
      setTaskDueDate(parsedTask.dueDate || '');
      setTaskDueTime(parsedTask.dueTime || '');
      setTaskPriority(parsedTask.priority);
    }
  }, [rawText, detectedIntent, parsedExpense, parsedTask]);

  // AI Refine for Expense
  const handleAiRefine = async () => {
    if (!rawText.trim()) return;
    try {
      setIsAiLoading(true);
      const res = await fetch('/api/ai/parse-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText,
          categories: categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
        }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        const p = json.data;
        if (p.title) setExpenseTitle(p.title);
        if (p.amount) setExpenseAmount(String(p.amount));
        if (p.categorySlug) setExpenseCategorySlug(p.categorySlug);
        if (p.date) setExpenseDate(p.date);
        if (p.paymentMethodType) {
          const matchingAcc = accounts.find(
            (a) => a.type === p.paymentMethodType || (p.paymentMethodType === 'upi' && a.type === 'bank')
          );
          if (matchingAcc) {
            setExpenseAccountId(matchingAcc.id);
          }
        }
        toast.success(
          json.source === 'gemini'
            ? 'AI refined expense details'
            : 'Parsed expense details using smart heuristics'
        );
      } else {
        toast.error('Could not refine details; keeping current values');
      }
    } catch {
      toast.info('Kept local parsed values');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (detectedIntent === 'expense') {
      const amt = parseFloat(expenseAmount);
      if (isNaN(amt) || amt <= 0) {
        toast.error('Enter a valid amount');
        return;
      }

      const matchingCategory =
        categories.find((c) => c.slug === expenseCategorySlug || c.id === expenseCategorySlug) ||
        categories.find((c) => c.type === 'expense' || c.type === 'both') ||
        categories[0];

      const resolvedAccountId =
        expenseAccountId || accounts.find((a) => a.isDefault)?.id || accounts[0]?.id || '';

      try {
        setIsSubmitting(true);
        // 1. Add Transaction
        await addTransaction({
          title: expenseTitle.trim() || 'Expense',
          amount: amt,
          type: 'expense',
          categoryId: matchingCategory?.id || '',
          accountId: resolvedAccountId,
          date: expenseDate,
        });

        // 2. Add split friend everyday tab if toggled
        if (isSplit && splitFriend.trim()) {
          const sAmt = parseFloat(splitAmount) || Math.round((amt / 2) * 100) / 100;
          await addDebtRecord({
            personName: splitFriend.trim(),
            direction: 'lent',
            title: `Split: ${expenseTitle.trim() || 'Expense'}`,
            principalAmount: sAmt,
            startDate: expenseDate,
            bucketType: 'everyday_split',
            repaymentSchedule: 'flexible',
            color: '#10b981',
          });
          toast.success(
            `Logged ${formatINR(amt)} expense (Split ${formatINR(sAmt)} with ${splitFriend.trim()})`
          );
        } else {
          toast.success(`Logged ${formatINR(amt)} expense`);
        }

        setIsOpen(false);
      } catch {
        toast.error('Failed to log expense');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Task submission
      if (!taskTitle.trim()) {
        toast.error('Enter a task description');
        return;
      }

      try {
        setIsSubmitting(true);
        await addTask({
          title: taskTitle.trim(),
          due_date: taskDueDate || undefined,
          priority: taskPriority,
          metadata: taskDueTime ? { dueTime: taskDueTime } : undefined,
          description: taskDueTime ? `Due at ${taskDueTime}` : undefined,
        });
        toast.success(`Task created: "${taskTitle.trim()}"`);
        setIsOpen(false);
      } catch {
        toast.error('Failed to create task');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <>
      {/* Command Bar Dialog (Triggered via unified Pomodoro stack button or ⌘K/Ctrl+K) */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden rounded-2xl gap-0 border-border shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Quick Capture Command Bar</DialogTitle>
          </DialogHeader>

          {/* Top Natural Language Search Input */}
          <div className="p-4 sm:p-5 border-b border-border/80 bg-background/50 backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl text-xs">
                {(
                  [
                    { id: 'auto' as const, label: 'Auto-Detect', icon: undefined },
                    { id: 'expense' as const, label: 'Expense', icon: Receipt },
                    { id: 'task' as const, label: 'Task', icon: CheckSquare },
                  ]
                ).map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setManualMode(m.id)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
                        manualMode === m.id
                          ? 'bg-background text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {Icon && <Icon className="w-3.5 h-3.5" />}
                      {m.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">
                  ⌘K
                </kbd>
                <span>or Enter</span>
              </div>
            </div>

            <div className="relative">
              <Input
                ref={inputRef}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={
                  detectedIntent === 'expense'
                    ? "e.g., spent 180 on coffee with Rahul split"
                    : "e.g., call electricity board tomorrow at 6pm"
                }
                className="h-12 pl-4 pr-10 text-sm sm:text-base font-medium rounded-xl border-border bg-background focus-visible:ring-1 focus-visible:ring-primary"
              />
              {detectedIntent === 'expense' && rawText.length > 5 && (
                <button
                  type="button"
                  onClick={handleAiRefine}
                  disabled={isAiLoading}
                  title="Enhance with AI"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 ${isAiLoading ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
          </div>

          {/* Structured Preview & Quick Form */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 max-h-[60vh] overflow-y-auto">
            {detectedIntent === 'expense' ? (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-primary" />
                    Structured Expense Preview
                  </span>
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    {expenseAmount ? formatINR(parseFloat(expenseAmount) || 0) : '₹0'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Amount (₹)</Label>
                    <Input
                      type="number"
                      step="any"
                      min="1"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      placeholder="₹ 180"
                      required
                      className="rounded-xl font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Date</Label>
                    <Input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      required
                      className="rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Description / Title</Label>
                  <Input
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    placeholder="e.g. Coffee at Blue Tokai"
                    required
                    className="rounded-xl text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Category</Label>
                    <select
                      value={expenseCategorySlug}
                      onChange={(e) => setExpenseCategorySlug(e.target.value)}
                      className="w-full h-10 px-3 text-xs rounded-xl border border-input bg-background"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.slug || c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Account</Label>
                    <select
                      value={expenseAccountId}
                      onChange={(e) => setExpenseAccountId(e.target.value)}
                      className="w-full h-10 px-3 text-xs rounded-xl border border-input bg-background"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({formatINR(a.balance)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Split with Friend Toggle */}
                <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-2.5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground select-none">
                    <input
                      type="checkbox"
                      checked={isSplit}
                      onChange={(e) => setIsSplit(e.target.checked)}
                      className="rounded border-input text-primary focus:ring-primary"
                    />
                    Split with Friend (Auto-logs to Everyday Tab)
                  </label>

                  {isSplit && (
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Friend Name</Label>
                        <Input
                          value={splitFriend}
                          onChange={(e) => setSplitFriend(e.target.value)}
                          placeholder="e.g. Rahul"
                          required={isSplit}
                          className="h-8 text-xs rounded-lg"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Their Share (₹)</Label>
                        <Input
                          type="number"
                          step="any"
                          value={splitAmount}
                          onChange={(e) => setSplitAmount(e.target.value)}
                          placeholder="50% share"
                          className="h-8 text-xs font-mono rounded-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-primary" />
                    Structured Task Preview
                  </span>
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {taskPriority} priority
                  </span>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Task Title</Label>
                  <Input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="e.g. Call electrician for living room switch"
                    required
                    className="rounded-xl text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs">Due Date</Label>
                    <Input
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Due Time</Label>
                    <Input
                      type="time"
                      value={taskDueTime}
                      onChange={(e) => setTaskDueTime(e.target.value)}
                      className="rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Priority</Label>
                    <select
                      value={taskPriority}
                      onChange={(e) =>
                        setTaskPriority(e.target.value as 'low' | 'medium' | 'high')
                      }
                      className="w-full h-10 px-3 text-xs rounded-xl border border-input bg-background"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High / Urgent</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Bar */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="text-xs rounded-xl gap-1.5 min-w-[120px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <span>Confirm &amp; Save</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
