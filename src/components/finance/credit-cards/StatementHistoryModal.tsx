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

function getStatusBadgeMeta(status: string, dueDate: string, remainingDue: number) {
  if (remainingDue <= 0 || status === 'paid') {
    return { cls: 'bg-success/10 text-success border-success/20', label: 'Paid', kind: 'ok' as const };
  }
  const diff = daysBetween(getLocalIsoDate(), dueDate);
  if (diff < 0) {
    return { cls: 'bg-destructive/10 text-destructive border-destructive/20', label: `Overdue by ${Math.abs(diff)}d`, kind: 'alert' as const };
  }
  if (diff <= 3) {
    return { cls: 'bg-destructive/10 text-destructive border-destructive/20', label: diff === 0 ? 'Due Today' : `Due in ${diff}d`, kind: 'clock' as const };
  }
  if (diff <= 5) {
    return { cls: 'bg-warning/10 text-warning border-warning/20', label: `Due in ${diff}d`, kind: 'clock' as const };
  }
  return { cls: 'bg-warning/10 text-warning border-warning/20', label: 'Billed', kind: 'none' as const };
}

function StatementStatusBadge({ status, dueDate, remainingDue }: { status: string; dueDate: string; remainingDue: number }) {
  const meta = getStatusBadgeMeta(status, dueDate, remainingDue);
  return (
    <Badge variant="outline" className={`${meta.cls} text-[10px] gap-1 whitespace-nowrap shrink-0`}>
      {meta.kind === 'ok' && <CheckCircle2 className="w-3 h-3" />}
      {meta.kind === 'alert' && <AlertTriangle className="w-3 h-3" />}
      {meta.kind === 'clock' && <Clock className="w-3 h-3" />}
      {meta.label}
    </Badge>
  );
}

function formatSwipeDisplayTitle(tx: FinanceTransaction, categoryName?: string): string {
  return tx.title || tx.merchantName || categoryName || 'Card Swipe';
}

function CardTransactionRow(props: {
  tx: FinanceTransaction;
  categoryName?: string;
  alternateCycle: string;
  direction: 'next' | 'prev';
  isMoving: boolean;
  onShiftCycle: (txId: string, cycleKey: string) => void;
}) {
  const { tx, categoryName, alternateCycle, direction, isMoving, onShiftCycle } = props;
  const amountPrefix = tx.type === 'income' ? '+' : '-';
  return (
    <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/70 text-xs hover:border-border transition-colors">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
          <Tag className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <div className="text-foreground font-semibold truncate">{formatSwipeDisplayTitle(tx, categoryName)}</div>
          <div className="text-muted-foreground text-[11px] flex items-center gap-1.5 flex-wrap">
            <span className="whitespace-nowrap">{formatShortDate(tx.date)}</span>
            {categoryName && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{categoryName}</span>
              </>
            )}
            {tx.statementCycleKey && (
              <span className="text-primary text-[10px] font-medium whitespace-nowrap">(Override: {tx.statementCycleKey})</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="font-bold text-foreground tabular-nums">{amountPrefix}{formatINR(tx.amount)}</span>
        <Button
          size="sm"
          variant="ghost"
          disabled={isMoving}
          onClick={() => onShiftCycle(tx.id, alternateCycle)}
          title={`Move transaction to cycle ${alternateCycle}`}
          className="h-7 px-2 text-[11px] text-muted-foreground hover:text-primary hover:bg-muted whitespace-nowrap"
        >
          {direction === 'next' ? (
            <span className="flex items-center gap-0.5">Next Cycle <ChevronRight className="w-3 h-3" /></span>
          ) : (
            <span className="flex items-center gap-0.5"><ChevronLeft className="w-3 h-3" /> Prev Cycle</span>
          )}
        </Button>
      </div>
    </div>
  );
}

function StatementMetricsGrid({ billedStatement, dueTone }: { billedStatement: CreditCardStatement; dueTone: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/70 text-center">
      <div className="bg-background border border-border/70 p-2.5 rounded-lg">
        <div className="text-[10px] text-muted-foreground font-medium">Total Billed</div>
        <div className="text-sm font-bold text-foreground tabular-nums">{formatINR(billedStatement.totalDue)}</div>
      </div>
      <div className="bg-background border border-border/70 p-2.5 rounded-lg">
        <div className="text-[10px] text-muted-foreground font-medium">Paid Amount</div>
        <div className="text-sm font-bold text-success tabular-nums">{formatINR(billedStatement.paidAmount)}</div>
      </div>
      <div className="bg-background border border-border/70 p-2.5 rounded-lg">
        <div className="text-[10px] text-muted-foreground font-medium">Remaining Due</div>
        <div className={`text-sm font-bold tabular-nums ${dueTone}`}>{formatINR(billedStatement.remainingDue)}</div>
      </div>
    </div>
  );
}

function StatementPeriodHeader({ billedStatement, dueTone }: { billedStatement: CreditCardStatement; dueTone: string }) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div>
        <div className="text-[11px] text-muted-foreground">Statement Period</div>
        <div className="text-xs font-semibold text-foreground whitespace-nowrap">
          {formatShortDate(billedStatement.periodStart)} – {formatShortDate(billedStatement.periodEnd)}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[11px] text-muted-foreground">Due Date</div>
        <div className="flex items-center gap-1.5 justify-end">
          <span className={`text-xs font-bold whitespace-nowrap ${dueTone}`}>{formatShortDate(billedStatement.dueDate)}</span>
          <StatementStatusBadge status={billedStatement.status} dueDate={billedStatement.dueDate} remainingDue={billedStatement.remainingDue} />
        </div>
      </div>
    </div>
  );
}

function BilledStatementSummaryCard(props: {
  billedStatement: CreditCardStatement;
  dueTone: string;
  onReconcile: (stmt: CreditCardStatement | null) => void;
  onPay: (stmt: CreditCardStatement) => void;
}) {
  const { billedStatement, dueTone, onReconcile, onPay } = props;
  return (
    <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
      <StatementPeriodHeader billedStatement={billedStatement} dueTone={dueTone} />
      <StatementMetricsGrid billedStatement={billedStatement} dueTone={dueTone} />

      {billedStatement.manualAdjustment !== 0 && (
        <div className="text-[11px] text-muted-foreground bg-background px-3 py-2 rounded-lg border border-border/70 flex justify-between">
          <span>Includes manual reconciliation adjustment:</span>
          <span className="font-semibold text-primary tabular-nums">
            {billedStatement.manualAdjustment > 0 ? '+' : ''}{formatINR(billedStatement.manualAdjustment)}
          </span>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={() => onReconcile(billedStatement)} className="h-8 text-xs border-border text-foreground hover:bg-muted whitespace-nowrap">
          Adjust / Reconcile Bill
        </Button>
        {billedStatement.remainingDue > 0 && (
          <Button size="sm" onClick={() => onPay(billedStatement)} className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-xs whitespace-nowrap tabular-nums">
            Pay Bill ({formatINR(billedStatement.remainingDue)})
          </Button>
        )}
      </div>
    </div>
  );
}

function CurrentBillTabPanel(props: {
  billedStatement: CreditCardStatement | null;
  daysUntilDue: number | null;
  billedTxs: FinanceTransaction[];
  unbilledCycleKey: string;
  categoryNameById: Map<string, string>;
  isMovingId: string | null;
  onShiftCycle: (txId: string, cycleKey: string) => void;
  onReconcile: (stmt: CreditCardStatement | null) => void;
  onPay: (stmt: CreditCardStatement) => void;
}) {
  const { billedStatement, daysUntilDue, billedTxs, unbilledCycleKey, categoryNameById, isMovingId, onShiftCycle, onReconcile, onPay } = props;
  if (!billedStatement) {
    return (
      <div className="text-center py-10 space-y-3 bg-muted/20 rounded-xl border border-dashed border-border">
        <FileText className="w-8 h-8 text-muted-foreground mx-auto" />
        <div>
          <div className="text-sm font-semibold text-foreground">No Billed Statement Yet</div>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            All spends currently fall into the unbilled cycle, or you can record an opening statement bill.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => onReconcile(null)} className="text-xs border-border text-foreground hover:bg-muted">
          Set Opening Bill
        </Button>
      </div>
    );
  }

  const isUrgent = billedStatement.status === 'overdue' || (daysUntilDue !== null && daysUntilDue <= 3);
  const dueTone = isUrgent ? 'text-destructive' : 'text-warning';

  return (
    <div className="space-y-3">
      <BilledStatementSummaryCard billedStatement={billedStatement} dueTone={dueTone} onReconcile={onReconcile} onPay={onPay} />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span className="font-medium text-foreground">Transactions in this Bill ({billedTxs.length})</span>
          <span className="text-[11px]">Shift border transactions if settled late</span>
        </div>
        <ScrollArea className="h-56 pr-2">
          {billedTxs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs border border-dashed border-border rounded-xl">
              No individual transactions logged in this cycle.
              {billedStatement.manualAdjustment > 0 && (
                <p className="text-[11px] text-foreground font-medium mt-1">Statement amount set via manual reconciliation.</p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {billedTxs.map((tx) => (
                <CardTransactionRow
                  key={tx.id}
                  tx={tx}
                  categoryName={categoryNameById.get(tx.categoryId)}
                  alternateCycle={unbilledCycleKey}
                  direction="next"
                  isMoving={isMovingId === tx.id}
                  onShiftCycle={onShiftCycle}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

function UnbilledCycleTabPanel(props: {
  unbilledCycle: { periodStart: string; periodEnd: string; dueDate: string; amount: number };
  unbilledSpend?: number;
  unbilledTxs: FinanceTransaction[];
  currentBilledCycleKey?: string;
  categoryNameById: Map<string, string>;
  isMovingId: string | null;
  onShiftCycle: (txId: string, cycleKey: string) => void;
}) {
  const { unbilledCycle, unbilledSpend, unbilledTxs, currentBilledCycleKey, categoryNameById, isMovingId, onShiftCycle } = props;
  return (
    <div className="space-y-3">
      <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="text-[11px] text-muted-foreground">Current Unbilled Cycle</div>
            <div className="text-xs font-semibold text-foreground whitespace-nowrap">
              {formatShortDate(unbilledCycle.periodStart)} – {formatShortDate(unbilledCycle.periodEnd)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-muted-foreground">Statement Generates On</div>
            <div className="text-xs font-bold text-primary whitespace-nowrap">{formatShortDate(unbilledCycle.periodEnd)}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/70 text-center">
          <div className="bg-background border border-border/70 p-2.5 rounded-lg">
            <div className="text-[10px] text-muted-foreground font-medium">Total Unbilled Spends</div>
            <div className="text-base font-bold text-foreground tabular-nums">{formatINR(unbilledSpend ?? unbilledCycle.amount)}</div>
          </div>
          <div className="bg-background border border-border/70 p-2.5 rounded-lg">
            <div className="text-[10px] text-muted-foreground font-medium">Estimated Due Date</div>
            <div className="text-base font-bold text-warning whitespace-nowrap">{formatShortDate(unbilledCycle.dueDate)}</div>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Spends made during this period become payable after the statement generates on{' '}
          <strong className="text-foreground">{formatShortDate(unbilledCycle.periodEnd)}</strong>.
        </p>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span className="font-medium text-foreground">Unbilled Swipes ({unbilledTxs.length})</span>
          <span className="text-[11px]">Shift swipe to previous bill if charged before statement date</span>
        </div>
        <ScrollArea className="h-56 pr-2">
          {unbilledTxs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs border border-dashed border-border rounded-xl">
              No unbilled transactions recorded for this cycle yet.
            </div>
          ) : (
            <div className="space-y-1.5">
              {unbilledTxs.map((tx) => (
                <CardTransactionRow
                  key={tx.id}
                  tx={tx}
                  categoryName={categoryNameById.get(tx.categoryId)}
                  alternateCycle={currentBilledCycleKey || 'prev'}
                  direction="prev"
                  isMoving={isMovingId === tx.id}
                  onShiftCycle={onShiftCycle}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

function ArchiveStatementsTabPanel(props: {
  cardStatements: CreditCardStatement[];
  onReconcile: (stmt: CreditCardStatement) => void;
  onPay: (stmt: CreditCardStatement) => void;
}) {
  const { cardStatements, onReconcile, onPay } = props;
  return (
    <ScrollArea className="h-80 pr-2">
      {cardStatements.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-xs border border-dashed border-border rounded-xl">
          No past statements found for this card.
        </div>
      ) : (
        <div className="space-y-2">
          {cardStatements.map((stmt) => (
            <div key={stmt.id} className="cv-auto p-3.5 rounded-xl bg-background border border-border flex items-center justify-between gap-3 text-xs hover:border-border/80 transition-colors shadow-xs">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground tabular-nums">{stmt.cycleKey}</span>
                  <StatementStatusBadge status={stmt.status} dueDate={stmt.dueDate} remainingDue={stmt.remainingDue} />
                </div>
                <div className="text-muted-foreground text-[11px] whitespace-nowrap">
                  {formatShortDate(stmt.periodStart)} – {formatShortDate(stmt.periodEnd)}
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  Due {formatShortDate(stmt.dueDate)}
                </div>
                {stmt.notes && <div className="text-muted-foreground text-[10px] italic truncate">Note: {stmt.notes}</div>}
              </div>
              <div className="text-right space-y-1 shrink-0">
                <div className="text-foreground font-bold tabular-nums">{formatINR(stmt.totalDue)}</div>
                {stmt.remainingDue > 0 ? (
                  <div className={`text-[11px] font-semibold tabular-nums ${stmt.status === 'overdue' ? 'text-destructive' : 'text-warning'}`}>
                    Due: {formatINR(stmt.remainingDue)}
                  </div>
                ) : (
                  <div className="text-success text-[11px] font-medium tabular-nums">Paid {formatINR(stmt.paidAmount)}</div>
                )}
                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <Button size="sm" variant="ghost" onClick={() => onReconcile(stmt)} className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted">Edit</Button>
                  {stmt.remainingDue > 0 && (
                    <Button size="sm" onClick={() => onPay(stmt)} className="h-6 px-2 text-[10px] bg-primary text-primary-foreground hover:bg-primary/90 font-medium">Pay</Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );
}

function mergeStatementsWithLive(
  statements: CreditCardStatement[],
  cardId: string,
  summary: ReturnType<ReturnType<typeof useFinanceStore.getState>['getCreditCardSummary']>
): CreditCardStatement[] {
  const liveMap = new Map<string, CreditCardStatement>();
  if (summary) {
    for (const s of summary.overdueStatements) liveMap.set(s.cycleKey, s);
    if (summary.currentBilledStatement) liveMap.set(summary.currentBilledStatement.cycleKey, summary.currentBilledStatement);
  }
  return statements
    .filter((s) => s.accountId === cardId && !s.deletedAt)
    .map((s) => {
      const live = liveMap.get(s.cycleKey);
      return live ? { ...s, ...live, notes: s.notes ?? live.notes } : s;
    })
    .sort((a, b) => b.cycleKey.localeCompare(a.cycleKey));
}

function filterCycleTransactions(
  cardTxs: FinanceTransaction[],
  cycleKey: string | undefined,
  billingDay: number,
  dueDay: number
): FinanceTransaction[] {
  if (!cycleKey) return [];
  return cardTxs.filter(
    (t) => resolveTransactionCycle(t.date, billingDay, dueDay, t.statementCycleKey) === cycleKey
  );
}

function useStatementHistoryData(card: FinanceAccount) {
  const getCreditCardSummary = useFinanceStore((s) => s.getCreditCardSummary);
  const statements = useFinanceStore((s) => s.creditCardStatements);
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const moveTransactionToCycle = useFinanceStore((s) => s.moveTransactionToCycle);

  const summary = getCreditCardSummary(card.id);
  const billingDay = card.billingDay ?? card.statementDay ?? 1;
  const dueDay = card.dueDay ?? 20;
  const cardStatements = mergeStatementsWithLive(statements, card.id, summary);

  const cardTxs = transactions
    .filter((t) => t.accountId === card.id && !t.deletedAt && !t.isCreditCardPayment && t.type !== 'transfer')
    .sort((a, b) => b.date.localeCompare(a.date));

  const currentBilledCycleKey = summary?.billedStatement?.cycleKey;
  const unbilledCycleKey = summary?.unbilledCycle.cycleKey || '';

  return {
    summary,
    billingDay,
    dueDay,
    cardStatements,
    billedTxs: filterCycleTransactions(cardTxs, currentBilledCycleKey, billingDay, dueDay),
    unbilledTxs: filterCycleTransactions(cardTxs, unbilledCycleKey, billingDay, dueDay),
    currentBilledCycleKey,
    unbilledCycleKey,
    categoryNameById: new Map(categories.map((c) => [c.id, c.name])),
    moveTransactionToCycle,
  };
}

function StatementHistoryTabs(props: {
  activeTab: InternalHistoryTab;
  onTabChange: (tab: InternalHistoryTab) => void;
  summary: NonNullable<ReturnType<ReturnType<typeof useFinanceStore.getState>['getCreditCardSummary']>>;
  data: ReturnType<typeof useStatementHistoryData>;
  isMoving: string | null;
  onShiftCycle: (txId: string, cycleKey: string) => void;
  onReconcile: (stmt: CreditCardStatement | null) => void;
  onPay: (stmt: CreditCardStatement) => void;
}) {
  const { activeTab, onTabChange, summary, data, isMoving, onShiftCycle, onReconcile, onPay } = props;
  const hasUrgentDue =
    summary.overdueStatements.length > 0 || (summary.daysUntilDue !== null && summary.daysUntilDue <= 3);
  const unbilledAmount = summary.unbilledSpend ?? summary.unbilledCycle.amount;
  const billedRem = summary.billedStatement?.remainingDue ?? 0;

  return (
    <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as InternalHistoryTab)} className="w-full">
      <TabsList className="bg-muted p-1 w-full grid grid-cols-3 rounded-xl">
        <TabsTrigger value="current" className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground rounded-lg whitespace-nowrap">
          Current Bill
          {billedRem > 0 && (
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums ${hasUrgentDue ? 'bg-destructive/15 text-destructive' : 'bg-warning/15 text-warning'}`}>
              {formatINR(billedRem)}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="unbilled" className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground rounded-lg whitespace-nowrap">
          Unbilled Cycle
          {unbilledAmount > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold tabular-nums">
              {formatINR(unbilledAmount)}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="archive" className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground rounded-lg whitespace-nowrap tabular-nums">
          Past Bills ({data.cardStatements.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="current" className="space-y-4 pt-3 focus-visible:outline-none">
        <CurrentBillTabPanel
          billedStatement={summary.billedStatement ?? null}
          daysUntilDue={summary.daysUntilDue}
          billedTxs={data.billedTxs}
          unbilledCycleKey={data.unbilledCycleKey}
          categoryNameById={data.categoryNameById}
          isMovingId={isMoving}
          onShiftCycle={onShiftCycle}
          onReconcile={onReconcile}
          onPay={onPay}
        />
      </TabsContent>
      <TabsContent value="unbilled" className="space-y-4 pt-3 focus-visible:outline-none">
        <UnbilledCycleTabPanel
          unbilledCycle={summary.unbilledCycle}
          unbilledSpend={summary.unbilledSpend}
          unbilledTxs={data.unbilledTxs}
          currentBilledCycleKey={data.currentBilledCycleKey}
          categoryNameById={data.categoryNameById}
          isMovingId={isMoving}
          onShiftCycle={onShiftCycle}
        />
      </TabsContent>
      <TabsContent value="archive" className="space-y-2 pt-3 focus-visible:outline-none">
        <ArchiveStatementsTabPanel cardStatements={data.cardStatements} onReconcile={onReconcile} onPay={onPay} />
      </TabsContent>
    </Tabs>
  );
}

function StatementHistoryHeader({ cardName, billingDay, dueDay }: { cardName: string; billingDay: number; dueDay: number }) {
  return (
    <DialogHeader className="p-5 pb-3 border-b border-border bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground">{cardName} Statements &amp; Cycles</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Bill Day: {formatOrdinal(billingDay)} of month
              <span className="mx-1.5" aria-hidden="true">·</span>
              Payment Due: {formatOrdinal(dueDay)} of month
            </DialogDescription>
          </div>
        </div>
      </div>
    </DialogHeader>
  );
}

export function StatementHistoryModal({
  open,
  onOpenChange,
  card,
  initialTab = 'current',
  onPay,
  onReconcile,
}: StatementHistoryModalProps) {
  const [activeTab, setActiveTab] = useState<InternalHistoryTab>(() => normalizeInitialTab(initialTab));
  const [isMoving, setIsMoving] = useState<string | null>(null);
  const data = useStatementHistoryData(card);

  useEffect(() => {
    if (open) setActiveTab(normalizeInitialTab(initialTab));
  }, [open, initialTab]);

  if (!data.summary) return null;

  const handleShiftCycle = async (txId: string, targetCycleKey: string) => {
    setIsMoving(txId);
    try {
      await data.moveTransactionToCycle(txId, targetCycleKey);
      toast.success(`Transaction moved to cycle ${targetCycleKey}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to move transaction to cycle');
    } finally {
      setIsMoving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-card border border-border text-card-foreground p-0 overflow-hidden shadow-xl">
        <StatementHistoryHeader cardName={card.name} billingDay={data.billingDay} dueDay={data.dueDay} />
        <div className="p-5 pt-3">
          <StatementHistoryTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            summary={data.summary}
            data={data}
            isMoving={isMoving}
            onShiftCycle={handleShiftCycle}
            onReconcile={(stmt) => {
              onReconcile?.(stmt);
              onOpenChange(false);
            }}
            onPay={(stmt) => {
              onPay?.(stmt);
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
