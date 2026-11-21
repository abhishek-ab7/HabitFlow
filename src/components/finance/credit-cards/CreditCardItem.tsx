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
  ArrowUpRight,
  ShieldCheck,
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
    <Card className="p-4 sm:p-5 rounded-xl border border-zinc-800 bg-zinc-950/90 text-zinc-100 shadow-md hover:border-zinc-700/80 transition-all space-y-4">
      {/* 1. Header: Name, Card Meta, Actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner"
            style={{ backgroundColor: `${card.color || '#f43f5e'}18`, color: card.color || '#f43f5e' }}
          >
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base text-zinc-100">{card.name}</h3>
              {card.isDefault && (
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30 gap-1 px-1.5 py-0">
                  <Star className="w-2.5 h-2.5 fill-amber-400" /> Default
                </Badge>
              )}
            </div>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">
              Limit: {formatINR(limit)} • Bill Day: {billingDay}th • Due Day: {dueDay}th
            </p>
          </div>
        </div>

        {/* Top Right Limit Summary & Edit */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right hidden sm:block font-mono">
            <span className="text-xs font-semibold text-zinc-200 block">
              Avail: {formatINR(available)}
            </span>
            <span className="text-[11px] text-zinc-400">
              {utilPct}% limit used
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEdit(card)}
            className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg"
            title="Edit Card Configuration"
          >
            <Edit2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 2. Dual-Segment Utilization Progress Bar */}
      <div className="space-y-1.5 bg-zinc-900/40 p-2.5 rounded-lg border border-zinc-800/60">
        <div className="h-2.5 w-full rounded-full bg-zinc-800/90 overflow-hidden flex">
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
            className="h-full bg-indigo-500 transition-all opacity-85"
            title={`Unbilled cycle: ${formatINR(unbilledSpend)} (${unbilledPct}%)`}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 flex-wrap gap-1">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${daysToDue !== null && daysToDue <= 3 ? 'bg-rose-500' : 'bg-amber-500'}`} />
              <span>Billed Due: <strong className="text-zinc-200">{formatINR(billedDue)}</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span>Unbilled: <strong className="text-zinc-200">{formatINR(unbilledSpend)}</strong></span>
            </span>
          </div>
          <div>
            <span className={utilPct > 30 ? 'text-amber-400 font-medium' : 'text-emerald-400'}>
              Total Utilized: {formatINR(totalUtilized)} ({utilPct}%)
            </span>
          </div>
        </div>
      </div>

      {/* 3. Dual Ledger Boxes: Current Bill vs Next Cycle */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Box A: Current Statement Bill */}
        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" /> Current Statement Due
              </span>
              {summary.billedStatement ? (
                billedDue <= 0 ? (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] gap-1 px-1.5">
                    <CheckCircle2 className="w-3 h-3" /> Paid
                  </Badge>
                ) : daysToDue !== null && daysToDue < 0 ? (
                  <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px] gap-1 px-1.5">
                    <AlertCircle className="w-3 h-3" /> Overdue
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] gap-1 px-1.5">
                    <Clock className="w-3 h-3" /> {daysToDue === 0 ? 'Due Today' : `Due in ${daysToDue}d`}
                  </Badge>
                )
              ) : (
                <span className="text-[10px] text-zinc-500">Unreconciled</span>
              )}
            </div>

            <div className="mt-2">
              <div className="text-xl font-bold font-mono text-zinc-100">
                {formatINR(billedDue)}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                {summary.billedStatement ? (
                  <>
                    Cycle: {summary.billedStatement.periodStart} → {summary.billedStatement.periodEnd}
                    <br />
                    Payment Due: <strong className="text-amber-400">{summary.billedStatement.dueDate}</strong>
                  </>
                ) : (
                  'No billed statement logged. Spends accumulate in unbilled cycle.'
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/70">
            {billedDue > 0 ? (
              <Button
                size="sm"
                onClick={() => handleOpenPay(summary.billedStatement)}
                className="flex-1 h-8 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg gap-1"
              >
                Pay Bill
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenPay(summary.billedStatement)}
                className="flex-1 h-8 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-lg gap-1"
              >
                Pay Advance
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenReconcile(summary.billedStatement)}
              className="h-8 px-2.5 text-xs border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg"
              title="Set or reconcile official statement amount"
            >
              <Sliders className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Box B: Unbilled Spends (Next Cycle) */}
        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" /> Next Cycle (Unbilled)
              </span>
              <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-400 border-indigo-500/30 px-1.5">
                Accumulating
              </Badge>
            </div>

            <div className="mt-2">
              <div className="text-xl font-bold font-mono text-zinc-100">
                {formatINR(unbilledSpend)}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                Cycle: {summary.unbilledCycle.periodStart} → {summary.unbilledCycle.periodEnd}
                <br />
                Generates: <strong className="text-indigo-400">{summary.unbilledCycle.periodEnd}</strong> • Due:{' '}
                <strong className="text-zinc-300">{summary.unbilledCycle.dueDate}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-zinc-800/70 text-[11px] text-zinc-500">
            <span>Payable after statement generation</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsHistoryOpen(true)}
              className="h-7 px-2 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-md"
            >
              Inspect Swipes
            </Button>
          </div>
        </div>
      </div>

      {/* 4. Footer: View Statements and Quick Actions */}
      <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 text-xs">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsHistoryOpen(true)}
          className="h-8 text-xs border-zinc-700/80 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800 rounded-lg gap-1.5"
        >
          <History className="w-3.5 h-3.5 text-indigo-400" />
          <span>View Statements & Swipes</span>
        </Button>

        <div className="flex items-center gap-2">
          {!card.isDefault && onSetDefault && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onSetDefault(card.id)}
              className="h-8 px-2 text-xs text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded-lg gap-1"
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
