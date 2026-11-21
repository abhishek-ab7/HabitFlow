'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatINR } from '@/lib/stores/finance/helpers';
import { useFinanceStore } from '@/lib/stores/finance-store';
import type { CreditCardStatement, FinanceAccount, FinanceTransaction } from '@/lib/types';
import {
  resolveTransactionCycle,
  daysBetween,
} from '@/lib/finance/credit-card-cycles';
import {
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRightLeft,
  ChevronRight,
  ChevronLeft,
  DollarSign,
  FileText,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';

interface StatementHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: FinanceAccount;
  onPay?: (statement?: CreditCardStatement | null) => void;
  onReconcile?: (statement?: CreditCardStatement | null) => void;
}

export function StatementHistoryModal({
  open,
  onOpenChange,
  card,
  onPay,
  onReconcile,
}: StatementHistoryModalProps) {
  const getCreditCardSummary = useFinanceStore((s) => s.getCreditCardSummary);
  const statements = useFinanceStore((s) => s.creditCardStatements);
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const moveTransactionToCycle = useFinanceStore((s) => s.moveTransactionToCycle);

  const [activeTab, setActiveTab] = useState<'current' | 'unbilled' | 'archive'>('current');
  const [isMoving, setIsMoving] = useState<string | null>(null);

  const summary = getCreditCardSummary(card.id);
  const billingDay = card.billingDay ?? card.statementDay ?? 1;
  const dueDay = card.dueDay ?? 20;

  if (!summary) return null;

  // Filter statements for this card, sorted descending
  const cardStatements = statements
    .filter((s) => s.accountId === card.id && !s.deletedAt)
    .sort((a, b) => b.cycleKey.localeCompare(a.cycleKey));

  // Transactions for this card
  const cardTxs = transactions
    .filter(
      (t) =>
        t.accountId === card.id &&
        !t.deletedAt &&
        !t.isCreditCardPayment &&
        t.type !== 'transfer'
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  // Map txs into their assigned cycles
  const currentBilledCycleKey = summary.billedStatement?.cycleKey;
  const unbilledCycleKey = summary.unbilledCycle.cycleKey;

  const billedTxs = currentBilledCycleKey
    ? cardTxs.filter(
        (t) => resolveTransactionCycle(t.date, billingDay, dueDay, t.statementCycleKey) === currentBilledCycleKey
      )
    : [];

  const unbilledTxs = cardTxs.filter(
    (t) => resolveTransactionCycle(t.date, billingDay, dueDay, t.statementCycleKey) === unbilledCycleKey
  );

  const handleShiftCycle = async (txId: string, targetCycleKey: string) => {
    setIsMoving(txId);
    try {
      await moveTransactionToCycle(txId, targetCycleKey);
      toast.success(`Transaction moved to cycle ${targetCycleKey}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to move transaction to cycle');
    } finally {
      setIsMoving(null);
    }
  };

  const getStatusBadge = (status: string, dueDate: string, remainingDue: number) => {
    if (remainingDue <= 0 || status === 'paid') {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] gap-1">
          <CheckCircle2 className="w-3 h-3" /> Paid
        </Badge>
      );
    }
    const today = new Date().toISOString().slice(0, 10);
    const diff = daysBetween(today, dueDate);
    if (diff < 0) {
      return (
        <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] gap-1">
          <AlertTriangle className="w-3 h-3" /> Overdue by {Math.abs(diff)}d
        </Badge>
      );
    }
    if (diff <= 5) {
      return (
        <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] gap-1">
          <Clock className="w-3 h-3" /> Due in {diff}d
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] gap-1">
        Billed
      </Badge>
    );
  };

  const renderTransactionItem = (
    tx: FinanceTransaction,
    currentCycle: string,
    alternateCycle: string,
    direction: 'next' | 'prev'
  ) => {
    const category = categories.find((c) => c.id === tx.categoryId);
    return (
      <div
        key={tx.id}
        className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-xs hover:border-zinc-700/80 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
            <Tag className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-zinc-200 font-medium truncate">
              {tx.title || tx.merchantName || category?.name || 'Card Swipe'}
            </div>
            <div className="text-zinc-500 text-[11px] flex items-center gap-1.5">
              <span>{tx.date}</span>
              {category && (
                <>
                  <span>•</span>
                  <span>{category.name}</span>
                </>
              )}
              {tx.statementCycleKey && (
                <span className="text-indigo-400 font-mono text-[10px]">
                  (Override: {tx.statementCycleKey})
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="font-semibold text-zinc-100">
            {tx.type === 'expense' ? '-' : '+'}{formatINR(tx.amount)}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={isMoving === tx.id}
            onClick={() => handleShiftCycle(tx.id, alternateCycle)}
            title={`Move transaction to cycle ${alternateCycle}`}
            className="h-7 px-2 text-[11px] text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800"
          >
            {direction === 'next' ? (
              <span className="flex items-center gap-0.5">
                Next Cycle <ChevronRight className="w-3 h-3" />
              </span>
            ) : (
              <span className="flex items-center gap-0.5">
                <ChevronLeft className="w-3 h-3" /> Prev Cycle
              </span>
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-zinc-950 border border-zinc-800 text-zinc-100 p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 border-b border-zinc-800/80 bg-zinc-900/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-zinc-100">
                  {card.name} Statements & Cycles
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-400">
                  Billing Day: {billingDay}th of month • Payment Due: {dueDay}th of month
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 pt-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="bg-zinc-900 border border-zinc-800 p-1 w-full grid grid-cols-3">
              <TabsTrigger
                value="current"
                className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-400"
              >
                Current Bill
                {summary.billedStatement && summary.billedStatement.remainingDue > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px]">
                    {formatINR(summary.billedStatement.remainingDue)}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="unbilled"
                className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-400"
              >
                Unbilled Cycle
                {(summary.unbilledSpend ?? summary.unbilledCycle.amount) > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-zinc-700/60 text-zinc-300 text-[10px]">
                    {formatINR(summary.unbilledSpend ?? summary.unbilledCycle.amount)}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="archive"
                className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-400"
              >
                Past Bills ({cardStatements.length})
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: CURRENT BILLED STATEMENT */}
            <TabsContent value="current" className="space-y-4 pt-3 focus-visible:outline-none">
              {summary.billedStatement ? (
                <div className="space-y-3">
                  {/* Summary Card */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] text-zinc-400">Statement Period</div>
                        <div className="text-xs font-semibold text-zinc-200">
                          {summary.billedStatement.periodStart} → {summary.billedStatement.periodEnd}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-zinc-400">Due Date</div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-amber-400">
                            {summary.billedStatement.dueDate}
                          </span>
                          {getStatusBadge(
                            summary.billedStatement.status,
                            summary.billedStatement.dueDate,
                            summary.billedStatement.remainingDue
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800/80 text-center">
                      <div className="bg-zinc-900/60 p-2 rounded-lg">
                        <div className="text-[10px] text-zinc-400">Total Billed</div>
                        <div className="text-sm font-bold text-zinc-100">
                          {formatINR(summary.billedStatement.totalDue)}
                        </div>
                      </div>
                      <div className="bg-zinc-900/60 p-2 rounded-lg">
                        <div className="text-[10px] text-zinc-400">Paid Amount</div>
                        <div className="text-sm font-bold text-emerald-400">
                          {formatINR(summary.billedStatement.paidAmount)}
                        </div>
                      </div>
                      <div className="bg-zinc-900/60 p-2 rounded-lg">
                        <div className="text-[10px] text-zinc-400">Remaining Due</div>
                        <div className="text-sm font-bold text-amber-400">
                          {formatINR(summary.billedStatement.remainingDue)}
                        </div>
                      </div>
                    </div>

                    {summary.billedStatement.manualAdjustment !== 0 && (
                      <div className="text-[11px] text-zinc-400 bg-zinc-900/40 px-2.5 py-1.5 rounded border border-zinc-800/50 flex justify-between">
                        <span>Includes manual reconciliation adjustment:</span>
                        <span className="font-semibold text-indigo-300">
                          {summary.billedStatement.manualAdjustment > 0 ? '+' : ''}
                          {formatINR(summary.billedStatement.manualAdjustment)}
                        </span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onReconcile?.(summary.billedStatement);
                          onOpenChange(false);
                        }}
                        className="h-8 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                      >
                        Adjust / Reconcile Bill
                      </Button>
                      {summary.billedStatement.remainingDue > 0 && (
                        <Button
                          size="sm"
                          onClick={() => {
                            onPay?.(summary.billedStatement);
                            onOpenChange(false);
                          }}
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                        >
                          Pay Bill ({formatINR(summary.billedStatement.remainingDue)})
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Transactions list */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                      <span>Transactions in this Bill ({billedTxs.length})</span>
                      <span className="text-[11px] text-zinc-500">
                        Shift border transactions to next cycle if settled late
                      </span>
                    </div>
                    <ScrollArea className="h-56 pr-2">
                      {billedTxs.length === 0 ? (
                        <div className="text-center py-8 text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-lg">
                          No individual transactions logged in this cycle.
                          {summary.billedStatement.manualAdjustment > 0 && (
                            <p className="text-[11px] text-zinc-400 mt-1">
                              Statement amount set via manual reconciliation.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {billedTxs.map((tx) =>
                            renderTransactionItem(
                              tx,
                              currentBilledCycleKey!,
                              unbilledCycleKey,
                              'next'
                            )
                          )}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 space-y-3 bg-zinc-900/30 rounded-xl border border-dashed border-zinc-800">
                  <FileText className="w-8 h-8 text-zinc-500 mx-auto" />
                  <div>
                    <div className="text-sm font-medium text-zinc-300">No Billed Statement Yet</div>
                    <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                      All spends currently fall into the unbilled cycle, or you can record an opening statement bill.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onReconcile?.(null);
                      onOpenChange(false);
                    }}
                    className="text-xs border-zinc-700 text-zinc-300"
                  >
                    Set Opening Bill
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: UNBILLED CYCLE */}
            <TabsContent value="unbilled" className="space-y-4 pt-3 focus-visible:outline-none">
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-zinc-400">Current Unbilled Cycle</div>
                      <div className="text-xs font-semibold text-zinc-200">
                        {summary.unbilledCycle.periodStart} → {summary.unbilledCycle.periodEnd}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-zinc-400">Statement Generates On</div>
                      <div className="text-xs font-semibold text-indigo-400">
                        {summary.unbilledCycle.periodEnd}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/80 text-center">
                    <div className="bg-zinc-900/60 p-2.5 rounded-lg">
                      <div className="text-[10px] text-zinc-400">Total Unbilled Spends</div>
                      <div className="text-base font-bold text-zinc-100">
                        {formatINR(summary.unbilledSpend ?? summary.unbilledCycle.amount)}
                      </div>
                    </div>
                    <div className="bg-zinc-900/60 p-2.5 rounded-lg">
                      <div className="text-[10px] text-zinc-400">Estimated Due Date</div>
                      <div className="text-base font-bold text-amber-400">
                        {summary.unbilledCycle.dueDate}
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Spends made during this period will not be payable until the statement generates on{' '}
                    <strong className="text-zinc-300">{summary.unbilledCycle.periodEnd}</strong>.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                    <span>Unbilled Swipes ({unbilledTxs.length})</span>
                    <span className="text-[11px] text-zinc-500">
                      Shift swipe to previous bill if charged before statement date
                    </span>
                  </div>
                  <ScrollArea className="h-56 pr-2">
                    {unbilledTxs.length === 0 ? (
                      <div className="text-center py-8 text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-lg">
                        No unbilled transactions recorded for this cycle yet.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {unbilledTxs.map((tx) =>
                          renderTransactionItem(
                            tx,
                            unbilledCycleKey,
                            currentBilledCycleKey || 'prev',
                            'prev'
                          )
                        )}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: STATEMENT ARCHIVE */}
            <TabsContent value="archive" className="space-y-2 pt-3 focus-visible:outline-none">
              <ScrollArea className="h-80 pr-2">
                {cardStatements.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-lg">
                    No past statements found for this card.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cardStatements.map((stmt) => (
                      <div
                        key={stmt.id}
                        className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-zinc-200">{stmt.cycleKey}</span>
                            {getStatusBadge(stmt.status, stmt.dueDate, stmt.remainingDue)}
                          </div>
                          <div className="text-zinc-400 text-[11px]">
                            {stmt.periodStart} to {stmt.periodEnd} • Due: {stmt.dueDate}
                          </div>
                          {stmt.notes && (
                            <div className="text-zinc-500 text-[10px] italic">Note: {stmt.notes}</div>
                          )}
                        </div>

                        <div className="text-right space-y-1 shrink-0">
                          <div className="text-zinc-200 font-semibold">
                            {formatINR(stmt.totalDue)}
                          </div>
                          {stmt.remainingDue > 0 ? (
                            <div className="text-amber-400 text-[11px] font-medium">
                              Due: {formatINR(stmt.remainingDue)}
                            </div>
                          ) : (
                            <div className="text-emerald-400 text-[11px]">
                              Paid {formatINR(stmt.paidAmount)}
                            </div>
                          )}
                          <div className="flex items-center justify-end gap-1.5 pt-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                onReconcile?.(stmt);
                                onOpenChange(false);
                              }}
                              className="h-6 px-1.5 text-[10px] text-zinc-400 hover:text-zinc-200"
                            >
                              Edit
                            </Button>
                            {stmt.remainingDue > 0 && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  onPay?.(stmt);
                                  onOpenChange(false);
                                }}
                                className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white"
                              >
                                Pay
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
