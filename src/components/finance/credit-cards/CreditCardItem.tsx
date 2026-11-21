'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatINR } from '@/lib/stores/finance/helpers';
import { useFinanceStore } from '@/lib/stores/finance-store';
import type { CreditCardStatement, FinanceAccount } from '@/lib/types';
import { daysBetween } from '@/lib/finance/credit-card-cycles';
import { PayCreditCardModal } from './PayCreditCardModal';
import { ReconcileStatementModal } from './ReconcileStatementModal';
import { StatementHistoryModal } from './StatementHistoryModal';
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

export function CreditCardItem({ card, onEdit, onSetDefault }: CreditCardItemProps) {
  const getCreditCardSummary = useFinanceStore((s) => s.getCreditCardSummary);
  const summary = getCreditCardSummary(card.id);

  const [isPayOpen, setIsPayOpen] = useState(false);
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [targetStatement, setTargetStatement] = useState<CreditCardStatement | null>(null);

  const limit = card.creditLimit || 100000;
  const billingDay = card.billingDay ?? card.statementDay ?? 1;
  const dueDay = card.dueDay ?? 20;

  if (!summary) return null;

  const billedDue = summary.billedStatement ? summary.billedStatement.remainingDue : 0;
  const unbilledSpend = summary.unbilledSpend ?? summary.unbilledCycle.amount;
  const totalUtilized = summary.totalUtilized ?? summary.totalOutstanding;
  const available = summary.availableLimit ?? summary.availableCredit;
  const utilPct = summary.utilizationPercent;

  // Segment widths for utilization bar
  const billedPct = Math.min(100, Math.round((billedDue / limit) * 100));
  const unbilledPct = Math.min(100 - billedPct, Math.round((unbilledSpend / limit) * 100));

  // Due date countdown
  const dueDateStr = summary.billedStatement?.dueDate;
  const today = new Date().toISOString().slice(0, 10);
  const daysToDue = dueDateStr ? daysBetween(today, dueDateStr) : null;

  const handleOpenPay = (stmt?: CreditCardStatement | null) => {
    setTargetStatement(stmt || summary.billedStatement || null);
    setIsPayOpen(true);
  };

  const handleOpenReconcile = (stmt?: CreditCardStatement | null) => {
    setTargetStatement(stmt || summary.billedStatement || null);
    setIsReconcileOpen(true);
  };

  return (
    <Card className="p-4 sm:p-5 rounded-2xl border border-border bg-card text-card-foreground shadow-sm hover:border-border/80 transition-all space-y-4">
      {/* 1. Header: Name, Card Meta, Actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
            style={{ backgroundColor: `${card.color || '#f43f5e'}18`, color: card.color || '#f43f5e' }}
          >
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base text-foreground">{card.name}</h3>
              {card.isDefault && (
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 gap-1 px-1.5 py-0">
                  <Star className="w-2.5 h-2.5 fill-primary" /> Default
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              Limit: {formatINR(limit)} • Bill Day: {billingDay}th • Due Day: {dueDay}th
            </p>
          </div>
        </div>

        {/* Top Right Limit Summary & Edit */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right hidden sm:block font-mono">
            <span className="text-xs font-semibold text-foreground block">
              Avail: {formatINR(available)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {utilPct}% limit used
            </span>
          </div>
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

      {/* 2. Dual-Segment Utilization Progress Bar */}
      <div className="space-y-1.5 bg-muted/40 p-2.5 rounded-xl border border-border/60">
        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden flex">
          {/* Segment 1: Billed statement due */}
          <div
            style={{ width: `${billedPct}%` }}
            className={`h-full transition-all ${
              daysToDue !== null && daysToDue <= 3
                ? 'bg-rose-500'
                : 'bg-amber-500'
            }`}
            title={`Billed statement due: ${formatINR(billedDue)} (${billedPct}%)`}
          />
          {/* Segment 2: Unbilled new cycle spends */}
          <div
            style={{ width: `${unbilledPct}%` }}
            className="h-full bg-primary/80 transition-all"
            title={`Unbilled cycle: ${formatINR(unbilledSpend)} (${unbilledPct}%)`}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground flex-wrap gap-1">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${daysToDue !== null && daysToDue <= 3 ? 'bg-rose-500' : 'bg-amber-500'}`} />
              <span>Billed Due: <strong className="text-foreground">{formatINR(billedDue)}</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary/80" />
              <span>Unbilled: <strong className="text-foreground">{formatINR(unbilledSpend)}</strong></span>
            </span>
          </div>
          <div>
            <span className={utilPct > 30 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-emerald-600 dark:text-emerald-400'}>
              Total Utilized: {formatINR(totalUtilized)} ({utilPct}%)
            </span>
          </div>
        </div>
      </div>

      {/* 3. Dual Ledger Boxes: Current Bill vs Next Cycle */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Box A: Current Statement Bill */}
        <div className="p-3.5 rounded-xl bg-background border border-border shadow-xs flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-500" /> Current Statement Due
              </span>
              {summary.billedStatement ? (
                billedDue <= 0 ? (
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] gap-1 px-1.5">
                    <CheckCircle2 className="w-3 h-3" /> Paid
                  </Badge>
                ) : daysToDue !== null && daysToDue < 0 ? (
                  <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[10px] gap-1 px-1.5">
                    <AlertCircle className="w-3 h-3" /> Overdue
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] gap-1 px-1.5">
                    <Clock className="w-3 h-3" /> {daysToDue === 0 ? 'Due Today' : `Due in ${daysToDue}d`}
                  </Badge>
                )
              ) : (
                <span className="text-[10px] text-muted-foreground">Unreconciled</span>
              )}
            </div>

            <div className="mt-2">
              <div className="text-xl font-bold font-mono text-foreground">
                {formatINR(billedDue)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {summary.billedStatement ? (
                  <>
                    Cycle: {summary.billedStatement.periodStart} → {summary.billedStatement.periodEnd}
                    <br />
                    Payment Due: <strong className="text-amber-600 dark:text-amber-400">{summary.billedStatement.dueDate}</strong>
                  </>
                ) : (
                  'No billed statement logged. Spends accumulate in unbilled cycle.'
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-border/60">
            {billedDue > 0 ? (
              <Button
                size="sm"
                onClick={() => handleOpenPay(summary.billedStatement)}
                className="flex-1 h-8 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg gap-1 shadow-xs"
              >
                Pay Bill
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenPay(summary.billedStatement)}
                className="flex-1 h-8 text-xs border-border text-foreground hover:bg-muted rounded-lg gap-1"
              >
                Pay Advance
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenReconcile(summary.billedStatement)}
              className="h-8 px-2.5 text-xs border-border text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
              title="Set or reconcile official statement amount"
            >
              <Sliders className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Box B: Unbilled Spends (Next Cycle) */}
        <div className="p-3.5 rounded-xl bg-background border border-border shadow-xs flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" /> Next Cycle (Unbilled)
              </span>
              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 px-1.5">
                Accumulating
              </Badge>
            </div>

            <div className="mt-2">
              <div className="text-xl font-bold font-mono text-foreground">
                {formatINR(unbilledSpend)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Cycle: {summary.unbilledCycle.periodStart} → {summary.unbilledCycle.periodEnd}
                <br />
                Generates: <strong className="text-foreground">{summary.unbilledCycle.periodEnd}</strong> • Due:{' '}
                <strong className="text-foreground">{summary.unbilledCycle.dueDate}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-border/60 text-[11px] text-muted-foreground">
            <span>Payable after statement generation</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsHistoryOpen(true)}
              className="h-7 px-2 text-xs text-primary hover:text-primary/90 hover:bg-primary/10 rounded-md"
            >
              Inspect Swipes
            </Button>
          </div>
        </div>
      </div>

      {/* 4. Footer: View Statements and Quick Actions */}
      <div className="flex items-center justify-between pt-1 border-t border-border/60 text-xs">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsHistoryOpen(true)}
          className="h-8 text-xs border-border bg-background text-foreground hover:bg-muted rounded-lg gap-1.5"
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
              className="h-8 px-2 text-xs text-muted-foreground hover:text-primary hover:bg-muted rounded-lg gap-1"
            >
              <Star className="w-3 h-3" />
              <span className="hidden sm:inline">Set Default</span>
            </Button>
          )}
        </div>
      </div>

      {/* Modals */}
      <PayCreditCardModal
        open={isPayOpen}
        onOpenChange={setIsPayOpen}
        card={card}
        statement={targetStatement}
        defaultAmount={targetStatement ? targetStatement.remainingDue : billedDue > 0 ? billedDue : undefined}
      />

      <ReconcileStatementModal
        open={isReconcileOpen}
        onOpenChange={setIsReconcileOpen}
        card={card}
        statement={targetStatement}
        defaultCycleKey={summary.billedStatement?.cycleKey || summary.unbilledCycle.cycleKey}
      />

      <StatementHistoryModal
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        card={card}
        onPay={handleOpenPay}
        onReconcile={handleOpenReconcile}
      />
    </Card>
  );
}
