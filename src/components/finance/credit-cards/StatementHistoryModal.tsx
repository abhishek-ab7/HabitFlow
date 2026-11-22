'use client';

import React, { useState, useEffect } from 'react';
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
  getLocalIsoDate,
  formatOrdinal,
  formatShortDate,
} from '@/lib/finance/credit-card-cycles';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  ChevronLeft,
  FileText,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';

export type StatementHistoryTab = 'current' | 'unbilled' | 'archive' | 'billed' | 'history';
type InternalHistoryTab = 'current' | 'unbilled' | 'archive';

function normalizeInitialTab(tab?: StatementHistoryTab): InternalHistoryTab {
  if (tab === 'unbilled') return 'unbilled';
  if (tab === 'archive' || tab === 'history') return 'archive';
  return 'current';
}

interface StatementHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: FinanceAccount;
  initialTab?: StatementHistoryTab;
  onPay?: (statement?: CreditCardStatement | null) => void;
  onReconcile?: (statement?: CreditCardStatement | null) => void;
}

export function StatementHistoryModal({
  open,
  onOpenChange,
  card,
  initialTab = 'current',
  onPay,
  onReconcile,
}: StatementHistoryModalProps) {
  const getCreditCardSummary = useFinanceStore((s) => s.getCreditCardSummary);
  const statements = useFinanceStore((s) => s.creditCardStatements);
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const moveTransactionToCycle = useFinanceStore((s) => s.moveTransactionToCycle);

  const [activeTab, setActiveTab] = useState<InternalHistoryTab>(() => normalizeInitialTab(initialTab));
  const [isMoving, setIsMoving] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setActiveTab(normalizeInitialTab(initialTab));
    }
  }, [open, initialTab]);

  const summary = getCreditCardSummary(card.id);
  const billingDay = card.billingDay ?? card.statementDay ?? 1;
  const dueDay = card.dueDay ?? 20;

  if (!summary) return null;

  // Build lookup of live unpaid statements from summary so archive matches Box A
  const liveStatementMap = new Map<string, CreditCardStatement>();
  for (const s of summary.overdueStatements) {
    liveStatementMap.set(s.cycleKey, s);
  }
  if (summary.currentBilledStatement) {
    liveStatementMap.set(summary.currentBilledStatement.cycleKey, summary.currentBilledStatement);
  }

  // Filter statements for this card, sorted descending, merged with live summary state
  const cardStatements = statements
    .filter((s) => s.accountId === card.id && !s.deletedAt)
    .map((s) => {
      const live = liveStatementMap.get(s.cycleKey);
      return live ? { ...s, ...live, notes: s.notes ?? live.notes } : s;
    })
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
        <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px] gap-1 whitespace-nowrap shrink-0">
          <CheckCircle2 className="w-3 h-3" /> Paid
        </Badge>
      );
    }
    const today = getLocalIsoDate();
    const diff = daysBetween(today, dueDate);
    if (diff < 0) {
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] gap-1 whitespace-nowrap shrink-0">
          <AlertTriangle className="w-3 h-3" /> Overdue by {Math.abs(diff)}d
        </Badge>
      );
    }
    if (diff <= 3) {
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] gap-1 whitespace-nowrap shrink-0">
          <Clock className="w-3 h-3" /> {diff === 0 ? 'Due Today' : `Due in ${diff}d`}
        </Badge>
      );
    }
    if (diff <= 5) {
      return (
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px] gap-1 whitespace-nowrap shrink-0">
          <Clock className="w-3 h-3" /> Due in {diff}d
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px] gap-1 whitespace-nowrap shrink-0">
        Billed
      </Badge>
    );
  };

  const renderTransactionItem = (
    tx: FinanceTransaction,
    _currentCycle: string,
    alternateCycle: string,
    direction: 'next' | 'prev'
  ) => {
    const category = categories.find((c) => c.id === tx.categoryId);
    return (
      <div
        key={tx.id}
        className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/70 text-xs hover:border-border transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
            <Tag className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-foreground font-semibold truncate">
              {tx.title || tx.merchantName || category?.name || 'Card Swipe'}
            </div>
            <div className="text-muted-foreground text-[11px] flex items-center gap-1.5 flex-wrap">
              <span className="whitespace-nowrap">{formatShortDate(tx.date)}</span>
              {category && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{category.name}</span>
                </>
              )}
              {tx.statementCycleKey && (
                <span className="text-primary text-[10px] font-medium whitespace-nowrap">
                  (Override: {tx.statementCycleKey})
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className="font-bold text-foreground tabular-nums">
            {tx.type === 'income' ? '+' : '-'}{formatINR(tx.amount)}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={isMoving === tx.id}
            onClick={() => handleShiftCycle(tx.id, alternateCycle)}
            title={`Move transaction to cycle ${alternateCycle}`}
            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-primary hover:bg-muted whitespace-nowrap"
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
      <DialogContent className="sm:max-w-2xl bg-card border border-border text-card-foreground p-0 overflow-hidden shadow-xl">
        <DialogHeader className="p-5 pb-3 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                  {card.name} Statements &amp; Cycles
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Bill Day: {formatOrdinal(billingDay)} of month
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  Payment Due: {formatOrdinal(dueDay)} of month
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 pt-3">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as InternalHistoryTab)} className="w-full">
            <TabsList className="bg-muted p-1 w-full grid grid-cols-3 rounded-xl">
              <TabsTrigger
                value="current"
                className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground rounded-lg whitespace-nowrap"
              >
                Current Bill
                {summary.billedStatement && summary.billedStatement.remainingDue > 0 && (
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums ${
                      summary.overdueStatements.length > 0 ||
                      (summary.daysUntilDue !== null && summary.daysUntilDue <= 3)
                        ? 'bg-destructive/15 text-destructive'
                        : 'bg-warning/15 text-warning'
                    }`}
                  >
                    {formatINR(summary.billedStatement.remainingDue)}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="unbilled"
                className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground rounded-lg whitespace-nowrap"
              >
                Unbilled Cycle
                {(summary.unbilledSpend ?? summary.unbilledCycle.amount) > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold tabular-nums">
                    {formatINR(summary.unbilledSpend ?? summary.unbilledCycle.amount)}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="archive"
                className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground rounded-lg whitespace-nowrap tabular-nums"
              >
                Past Bills ({cardStatements.length})
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: CURRENT BILLED STATEMENT */}
            <TabsContent value="current" className="space-y-4 pt-3 focus-visible:outline-none">
              {summary.billedStatement ? (
                <div className="space-y-3">
                  {/* Summary Card */}
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <div className="text-[11px] text-muted-foreground">Statement Period</div>
                        <div className="text-xs font-semibold text-foreground whitespace-nowrap">
                          {formatShortDate(summary.billedStatement.periodStart)} – {formatShortDate(summary.billedStatement.periodEnd)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-muted-foreground">Due Date</div>
                        <div className="flex items-center gap-1.5 justify-end">
                          <span
                            className={`text-xs font-bold whitespace-nowrap ${
                              summary.billedStatement.status === 'overdue' ||
                              (summary.daysUntilDue !== null && summary.daysUntilDue <= 3)
                                ? 'text-destructive'
                                : 'text-warning'
                            }`}
                          >
                            {formatShortDate(summary.billedStatement.dueDate)}
                          </span>
                          {getStatusBadge(
                            summary.billedStatement.status,
                            summary.billedStatement.dueDate,
                            summary.billedStatement.remainingDue
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/70 text-center">
                      <div className="bg-background border border-border/70 p-2.5 rounded-lg">
                        <div className="text-[10px] text-muted-foreground font-medium">Total Billed</div>
                        <div className="text-sm font-bold text-foreground tabular-nums">
                          {formatINR(summary.billedStatement.totalDue)}
                        </div>
                      </div>
                      <div className="bg-background border border-border/70 p-2.5 rounded-lg">
                        <div className="text-[10px] text-muted-foreground font-medium">Paid Amount</div>
                        <div className="text-sm font-bold text-success tabular-nums">
                          {formatINR(summary.billedStatement.paidAmount)}
                        </div>
                      </div>
                      <div className="bg-background border border-border/70 p-2.5 rounded-lg">
                        <div className="text-[10px] text-muted-foreground font-medium">Remaining Due</div>
                        <div
                          className={`text-sm font-bold tabular-nums ${
                            summary.billedStatement.status === 'overdue' ||
                            (summary.daysUntilDue !== null && summary.daysUntilDue <= 3)
                              ? 'text-destructive'
                              : 'text-warning'
                          }`}
                        >
                          {formatINR(summary.billedStatement.remainingDue)}
                        </div>
                      </div>
                    </div>

                    {summary.billedStatement.manualAdjustment !== 0 && (
                      <div className="text-[11px] text-muted-foreground bg-background px-3 py-2 rounded-lg border border-border/70 flex justify-between">
                        <span>Includes manual reconciliation adjustment:</span>
                        <span className="font-semibold text-primary tabular-nums">
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
                        className="h-8 text-xs border-border text-foreground hover:bg-muted whitespace-nowrap"
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
                          className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-xs whitespace-nowrap tabular-nums"
                        >
                          Pay Bill ({formatINR(summary.billedStatement.remainingDue)})
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Transactions list */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                      <span className="font-medium text-foreground">Transactions in this Bill ({billedTxs.length})</span>
                      <span className="text-[11px]">
                        Shift border transactions if settled late
                      </span>
                    </div>
                    <ScrollArea className="h-56 pr-2">
                      {billedTxs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-xs border border-dashed border-border rounded-xl">
                          No individual transactions logged in this cycle.
                          {summary.billedStatement.manualAdjustment > 0 && (
                            <p className="text-[11px] text-foreground font-medium mt-1">
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
                <div className="text-center py-10 space-y-3 bg-muted/20 rounded-xl border border-dashed border-border">
                  <FileText className="w-8 h-8 text-muted-foreground mx-auto" />
                  <div>
                    <div className="text-sm font-semibold text-foreground">No Billed Statement Yet</div>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
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
                    className="text-xs border-border text-foreground hover:bg-muted"
                  >
                    Set Opening Bill
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: UNBILLED CYCLE */}
            <TabsContent value="unbilled" className="space-y-4 pt-3 focus-visible:outline-none">
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <div className="text-[11px] text-muted-foreground">Current Unbilled Cycle</div>
                      <div className="text-xs font-semibold text-foreground whitespace-nowrap">
                        {formatShortDate(summary.unbilledCycle.periodStart)} – {formatShortDate(summary.unbilledCycle.periodEnd)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-muted-foreground">Statement Generates On</div>
                      <div className="text-xs font-bold text-primary whitespace-nowrap">
                        {formatShortDate(summary.unbilledCycle.periodEnd)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/70 text-center">
                    <div className="bg-background border border-border/70 p-2.5 rounded-lg">
                      <div className="text-[10px] text-muted-foreground font-medium">Total Unbilled Spends</div>
                      <div className="text-base font-bold text-foreground tabular-nums">
                        {formatINR(summary.unbilledSpend ?? summary.unbilledCycle.amount)}
                      </div>
                    </div>
                    <div className="bg-background border border-border/70 p-2.5 rounded-lg">
                      <div className="text-[10px] text-muted-foreground font-medium">Estimated Due Date</div>
                      <div className="text-base font-bold text-warning whitespace-nowrap">
                        {formatShortDate(summary.unbilledCycle.dueDate)}
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Spends made during this period become payable after the statement generates on{' '}
                    <strong className="text-foreground">{formatShortDate(summary.unbilledCycle.periodEnd)}</strong>.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                    <span className="font-medium text-foreground">Unbilled Swipes ({unbilledTxs.length})</span>
                    <span className="text-[11px]">
                      Shift swipe to previous bill if charged before statement date
                    </span>
                  </div>
                  <ScrollArea className="h-56 pr-2">
                    {unbilledTxs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-xs border border-dashed border-border rounded-xl">
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
                  <div className="text-center py-12 text-muted-foreground text-xs border border-dashed border-border rounded-xl">
                    No past statements found for this card.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cardStatements.map((stmt) => (
                      <div
                        key={stmt.id}
                        className="p-3.5 rounded-xl bg-background border border-border flex items-center justify-between gap-3 text-xs hover:border-border/80 transition-colors shadow-xs"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-foreground tabular-nums">{stmt.cycleKey}</span>
                            {getStatusBadge(stmt.status, stmt.dueDate, stmt.remainingDue)}
                          </div>
                          <div className="text-muted-foreground text-[11px] whitespace-nowrap">
                            {formatShortDate(stmt.periodStart)} – {formatShortDate(stmt.periodEnd)}
                            <span className="mx-1.5" aria-hidden="true">·</span>
                            Due {formatShortDate(stmt.dueDate)}
                          </div>
                          {stmt.notes && (
                            <div className="text-muted-foreground text-[10px] italic truncate">Note: {stmt.notes}</div>
                          )}
                        </div>

                        <div className="text-right space-y-1 shrink-0">
                          <div className="text-foreground font-bold tabular-nums">
                            {formatINR(stmt.totalDue)}
                          </div>
                          {stmt.remainingDue > 0 ? (
                            <div
                              className={`text-[11px] font-semibold tabular-nums ${
                                stmt.status === 'overdue' ? 'text-destructive' : 'text-warning'
                              }`}
                            >
                              Due: {formatINR(stmt.remainingDue)}
                            </div>
                          ) : (
                            <div className="text-success text-[11px] font-medium tabular-nums">
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
                              className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted"
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
                                className="h-6 px-2 text-[10px] bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
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
