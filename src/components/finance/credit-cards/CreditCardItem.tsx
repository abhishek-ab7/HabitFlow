'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatINR } from '@/lib/stores/finance/helpers';
import { useFinanceStore } from '@/lib/stores/finance-store';
import type { CreditCardStatement, FinanceAccount } from '@/lib/types';
import { formatOrdinal, formatShortDate } from '@/lib/finance/credit-card-cycles';
import type { StatementHistoryTab } from './StatementHistoryModal';

const PayCreditCardModal = dynamic(
  () => import('./PayCreditCardModal').then((m) => ({ default: m.PayCreditCardModal })),
  { ssr: false }
);
const ReconcileStatementModal = dynamic(
  () => import('./ReconcileStatementModal').then((m) => ({ default: m.ReconcileStatementModal })),
  { ssr: false }
);
const StatementHistoryModal = dynamic(
  () => import('./StatementHistoryModal').then((m) => ({ default: m.StatementHistoryModal })),
  { ssr: false }
);
import {
  CreditCard,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Edit2,
  History,
  Star,
  Sliders,
} from 'lucide-react';

interface CreditCardItemProps {
  card: FinanceAccount;
  onEdit: (card: FinanceAccount) => void;
  onSetDefault?: (cardId: string) => void;
}

export const CreditCardItem = React.memo(function CreditCardItem({ card, onEdit, onSetDefault }: CreditCardItemProps) {
  const getCreditCardSummary = useFinanceStore((s) => s.getCreditCardSummary);
  const summary = getCreditCardSummary(card.id);

  const [isPayOpen, setIsPayOpen] = useState(false);
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyInitialTab, setHistoryInitialTab] = useState<StatementHistoryTab>('current');
  const [targetStatement, setTargetStatement] = useState<CreditCardStatement | null>(null);

  const limit = card.creditLimit ?? 0;
  const billingDay = card.billingDay ?? card.statementDay ?? 1;
  const dueDay = card.dueDay ?? 20;

  if (!summary) return null;

  const billedDue = summary.billedDueTotal;
  const unbilledSpend = summary.unbilledSpend ?? summary.unbilledCycle.amount;
  const totalUtilized = summary.totalUtilized ?? summary.totalOutstanding;
  const available = summary.availableLimit ?? summary.availableCredit;
  const utilPct = summary.utilizationPercent;
  const daysToDue = summary.daysUntilDue;

  // Segment widths for utilization bar (only meaningful when limit > 0)
  const rawBilledPct = limit > 0 && billedDue > 0 ? Math.min(100, Math.round((billedDue / limit) * 100)) : 0;
  const rawUnbilledPct = limit > 0 && unbilledSpend > 0 ? Math.min(100, Math.round((unbilledSpend / limit) * 100)) : 0;
  // Reserve room when both billed and unbilled are active so neither sliver is clipped by overflow-hidden
  const billedPct =
    billedDue > 0 && unbilledSpend > 0
      ? Math.min(96, Math.max(2, rawBilledPct))
      : rawBilledPct;
  const unbilledPct =
    unbilledSpend > 0
      ? Math.min(100 - billedPct, Math.max(billedDue > 0 ? 2 : 0, rawUnbilledPct))
      : 0;

  const isOverdue = summary.overdueStatements.length > 0 || (billedDue > 0 && daysToDue !== null && daysToDue < 0);
  const isUrgentOrOverdue = billedDue > 0 && (isOverdue || (daysToDue !== null && daysToDue <= 3));
  const boxASurfaceClass =
    billedDue <= 0
      ? 'border-success/25 bg-success/[0.05]'
      : isUrgentOrOverdue
      ? 'border-destructive/30 bg-destructive/[0.05]'
      : 'border-warning/30 bg-warning/[0.05]';

  const currentStmt = summary.currentBilledStatement ?? summary.billedStatement ?? null;
  const hasMultipleOverdue =
    summary.overdueStatements.length > 1 ||
    (summary.overdueStatements.length > 0 &&
      currentStmt !== null &&
      billedDue > currentStmt.remainingDue);

  const handleOpenPay = (stmt?: CreditCardStatement | null) => {
    setTargetStatement(stmt ?? currentStmt);
    setIsPayOpen(true);
  };

  const handleOpenReconcile = (stmt?: CreditCardStatement | null) => {
    setTargetStatement(stmt ?? currentStmt);
    setIsReconcileOpen(true);
  };

  const handleOpenHistory = (tab: StatementHistoryTab) => {
    setHistoryInitialTab(tab);
    setIsHistoryOpen(true);
  };

  return (
    <Card className="p-4 rounded-2xl border border-border bg-card text-card-foreground shadow-sm hover:border-border/80 transition-all space-y-3.5">
      {/* 1. Header: Name, Card Meta, Actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs">
            <CreditCard className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base text-foreground truncate">{card.name}</h3>
              {card.isDefault && (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-primary/10 text-primary border-primary/20 gap-1 px-1.5 py-0 whitespace-nowrap shrink-0"
                >
                  <Star className="w-2.5 h-2.5 fill-primary" /> Default
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {limit > 0 && (
                <>
                  Limit: <span className="tabular-nums font-medium text-foreground/80">{formatINR(limit)}</span>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                </>
              )}
              Bill Day: {formatOrdinal(billingDay)}
              <span className="mx-1.5" aria-hidden="true">·</span>
              Due Day: {formatOrdinal(dueDay)}
            </p>
            {limit > 0 && (
              <p className="text-[11px] text-muted-foreground sm:hidden mt-0.5 tabular-nums">
                Avail: <strong className="text-foreground">{formatINR(available)}</strong>
                <span className="mx-1.5" aria-hidden="true">·</span>
                {utilPct}% used
              </p>
            )}
          </div>
        </div>

        {/* Top Right Limit Summary & Edit */}
        <div className="flex items-center gap-2 shrink-0">
          {limit > 0 && (
            <div className="text-right hidden sm:block tabular-nums">
              <span className="text-xs font-semibold text-foreground block">
                Avail: {formatINR(available)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {utilPct}% limit used
              </span>
            </div>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEdit(card)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
            title="Edit Card Configuration"
          >
            <Edit2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 2. Dual-Segment Utilization Progress Bar (only when creditLimit > 0) */}
      {limit > 0 && (
        <div className="space-y-1.5 bg-muted/40 p-2.5 rounded-xl border border-border/60">
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden flex">
            {billedDue > 0 && (
              <div
                style={{ width: `${billedPct}%` }}
                className={`h-full min-w-[4px] shrink-0 transition-all ${
                  isUrgentOrOverdue ? 'bg-destructive' : 'bg-warning'
                }`}
                title={`Billed statement due: ${formatINR(billedDue)} (${rawBilledPct}%)`}
              />
            )}
            {unbilledSpend > 0 && (
              <div
                style={{ width: `${unbilledPct}%` }}
                className="h-full min-w-[4px] shrink-0 bg-primary transition-all"
                title={`Unbilled cycle: ${formatINR(unbilledSpend)} (${rawUnbilledPct}%)`}
              />
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground flex-wrap gap-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${isUrgentOrOverdue ? 'bg-destructive' : 'bg-warning'}`} />
                <span>
                  Billed Due: <strong className="text-foreground tabular-nums">{formatINR(billedDue)}</strong>
                  {summary.overdueStatements.length > 0 && (
                    <span className="ml-1 text-[10px] font-semibold text-destructive whitespace-nowrap">
                      ({summary.overdueStatements.length} overdue)
                    </span>
                  )}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0 bg-primary" />
                <span>
                  Unbilled: <strong className="text-foreground tabular-nums">{formatINR(unbilledSpend)}</strong>
                </span>
              </span>
            </div>
            <div>
              <span
                className={`tabular-nums ${
                  utilPct > 70
                    ? 'text-destructive font-medium'
                    : utilPct > 30
                    ? 'text-warning font-medium'
                    : 'text-success font-medium'
                }`}
              >
                Total Utilized: {formatINR(totalUtilized)} ({utilPct}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Dual Ledger Boxes: Statement Due vs Unbilled Cycle */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Box A: Statement Due */}
        <div className={`p-3 rounded-xl border shadow-xs flex flex-col justify-between space-y-2.5 ${boxASurfaceClass}`}>
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 whitespace-nowrap">
                <Calendar
                  className={`w-3.5 h-3.5 shrink-0 ${
                    billedDue <= 0
                      ? 'text-success'
                      : isUrgentOrOverdue
                      ? 'text-destructive'
                      : 'text-warning'
                  }`}
                />
                Statement Due
              </span>
              {summary.billedStatement ? (
                billedDue <= 0 ? (
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px] gap-1 px-1.5 whitespace-nowrap shrink-0">
                    <CheckCircle2 className="w-3 h-3" /> Paid
                  </Badge>
                ) : daysToDue !== null && daysToDue < 0 ? (
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] gap-1 px-1.5 whitespace-nowrap shrink-0">
                    <AlertCircle className="w-3 h-3" /> Overdue {Math.abs(daysToDue)}d
                  </Badge>
                ) : daysToDue !== null && daysToDue <= 3 ? (
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] gap-1 px-1.5 whitespace-nowrap shrink-0">
                    <Clock className="w-3 h-3" /> {daysToDue === 0 ? 'Due Today' : `Due in ${daysToDue}d`}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px] gap-1 px-1.5 whitespace-nowrap shrink-0">
                    <Clock className="w-3 h-3" /> {daysToDue === null ? 'Billed' : `Due in ${daysToDue}d`}
                  </Badge>
                )
              ) : (
                <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px] gap-1 px-1.5 whitespace-nowrap shrink-0">
                  <CheckCircle2 className="w-3 h-3" /> Settled
                </Badge>
              )}
            </div>

            <div className="mt-1.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                <div className="text-xl font-bold text-foreground tabular-nums">
                  {formatINR(billedDue)}
                </div>
                {hasMultipleOverdue && (
                  <span className="text-[10px] font-medium text-destructive whitespace-nowrap">
                    Includes {summary.overdueStatements.length} overdue
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                {summary.billedStatement ? (
                  <>
                    <span className="whitespace-nowrap">
                      {formatShortDate(summary.billedStatement.periodStart)} – {formatShortDate(summary.billedStatement.periodEnd)}
                    </span>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <strong className={isUrgentOrOverdue ? 'text-destructive whitespace-nowrap' : 'text-warning whitespace-nowrap'}>
                      Due {formatShortDate(summary.billedStatement.dueDate)}
                    </strong>
                  </>
                ) : (
                  'No unpaid billed statement. Spends accumulate in unbilled.'
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border/60">
            {billedDue > 0 ? (
              <Button
                size="sm"
                onClick={() => handleOpenPay(summary.billedStatement)}
                className="flex-1 h-8 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg gap-1 shadow-xs whitespace-nowrap"
              >
                Pay Bill
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenPay(summary.billedStatement)}
                className="flex-1 h-8 text-xs border-border text-foreground hover:bg-muted rounded-lg gap-1 whitespace-nowrap"
              >
                Pay Advance
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenReconcile(summary.billedStatement)}
              className="h-8 px-2.5 text-xs border-border text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg shrink-0"
              title="Set or reconcile official statement amount"
            >
              <Sliders className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Box B: Unbilled Cycle */}
        <div className="p-3 rounded-xl bg-primary/[0.04] border border-primary/20 shadow-xs flex flex-col justify-between space-y-2.5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 whitespace-nowrap">
                <Clock className="w-3.5 h-3.5 shrink-0 text-primary" />
                Unbilled Cycle
              </span>
              <Badge
                variant="outline"
                className="text-[10px] bg-primary/10 text-primary border-primary/20 px-1.5 whitespace-nowrap shrink-0"
              >
                Accumulating
              </Badge>
            </div>

            <div className="mt-1.5">
              <div className="text-xl font-bold text-foreground tabular-nums">
                {formatINR(unbilledSpend)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                <span className="whitespace-nowrap">
                  {formatShortDate(summary.unbilledCycle.periodStart)} – {formatShortDate(summary.unbilledCycle.periodEnd)}
                </span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span className="whitespace-nowrap">
                  Due <strong className="text-foreground">{formatShortDate(summary.unbilledCycle.dueDate)}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
            <span className="whitespace-nowrap truncate">
              Generates {formatShortDate(summary.unbilledCycle.periodEnd)}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleOpenHistory('unbilled')}
              className="h-7 px-2 text-xs text-primary hover:text-primary/90 hover:bg-primary/10 rounded-md whitespace-nowrap shrink-0"
            >
              Inspect Swipes
            </Button>
          </div>
        </div>
      </div>

      {/* 4. Compact Footer: View Statements & Set Default */}
      <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleOpenHistory('current')}
          className="h-8 text-xs border-border bg-background text-foreground hover:bg-muted rounded-lg gap-1.5 whitespace-nowrap"
        >
          <History className="w-3.5 h-3.5 text-primary" />
          <span>View Statements & Swipes</span>
        </Button>

        <div className="flex items-center gap-2">
          {!card.isDefault && onSetDefault && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onSetDefault(card.id)}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-primary hover:bg-muted rounded-lg gap-1 whitespace-nowrap"
            >
              <Star className="w-3 h-3" />
              <span className="hidden sm:inline">Set Default</span>
            </Button>
          )}
        </div>
      </div>

      {/* Modals (lazy-mounted only when open) */}
      {isPayOpen && (
        <PayCreditCardModal
          open={isPayOpen}
          onOpenChange={setIsPayOpen}
          card={card}
          statement={targetStatement}
          defaultAmount={targetStatement ? targetStatement.remainingDue : billedDue > 0 ? billedDue : undefined}
        />
      )}

      {isReconcileOpen && (
        <ReconcileStatementModal
          open={isReconcileOpen}
          onOpenChange={setIsReconcileOpen}
          card={card}
          statement={targetStatement}
          defaultCycleKey={summary.billedStatement?.cycleKey || summary.unbilledCycle.cycleKey}
        />
      )}

      {isHistoryOpen && (
        <StatementHistoryModal
          open={isHistoryOpen}
          onOpenChange={setIsHistoryOpen}
          card={card}
          initialTab={historyInitialTab}
          onPay={handleOpenPay}
          onReconcile={handleOpenReconcile}
        />
      )}
    </Card>
  );
});
