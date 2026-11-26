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
import { useFeedback } from '@/hooks/use-feedback';
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

function computeUtilizationSegments(limit: number, billedDue: number, unbilledSpend: number) {
  const rawBilledPct = billedDue > 0 ? Math.min(100, Math.round((billedDue / limit) * 100)) : 0;
  const rawUnbilledPct = unbilledSpend > 0 ? Math.min(100, Math.round((unbilledSpend / limit) * 100)) : 0;
  const billedPct = billedDue > 0 && unbilledSpend > 0 ? Math.min(96, Math.max(2, rawBilledPct)) : rawBilledPct;
  const unbilledPct = unbilledSpend > 0 ? Math.min(100 - billedPct, Math.max(billedDue > 0 ? 2 : 0, rawUnbilledPct)) : 0;
  return { rawBilledPct, rawUnbilledPct, billedPct, unbilledPct };
}

function UtilizationBarTrack(props: {
  billedDue: number;
  unbilledSpend: number;
  billedPct: number;
  unbilledPct: number;
  rawBilledPct: number;
  rawUnbilledPct: number;
  isUrgentOrOverdue: boolean;
}) {
  const { billedDue, unbilledSpend, billedPct, unbilledPct, rawBilledPct, rawUnbilledPct, isUrgentOrOverdue } = props;
  return (
    <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden flex">
      {billedDue > 0 && (
        <div
          style={{ width: `${billedPct}%` }}
          className={`h-full min-w-[4px] shrink-0 transition-all ${isUrgentOrOverdue ? 'bg-destructive' : 'bg-warning'}`}
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
  );
}

function UtilizationProgressBar(props: {
  limit: number;
  billedDue: number;
  unbilledSpend: number;
  totalUtilized: number;
  utilPct: number;
  overdueCount: number;
  isUrgentOrOverdue: boolean;
}) {
  const { limit, billedDue, unbilledSpend, totalUtilized, utilPct, overdueCount, isUrgentOrOverdue } = props;
  if (limit <= 0) return null;

  const { rawBilledPct, rawUnbilledPct, billedPct, unbilledPct } = computeUtilizationSegments(limit, billedDue, unbilledSpend);
  const utilTone = utilPct > 70 ? 'text-destructive font-medium' : utilPct > 30 ? 'text-warning font-medium' : 'text-success font-medium';

  return (
    <div className="space-y-1.5 bg-muted/40 p-2.5 rounded-xl border border-border/60">
      <UtilizationBarTrack
        billedDue={billedDue}
        unbilledSpend={unbilledSpend}
        billedPct={billedPct}
        unbilledPct={unbilledPct}
        rawBilledPct={rawBilledPct}
        rawUnbilledPct={rawUnbilledPct}
        isUrgentOrOverdue={isUrgentOrOverdue}
      />
      <div className="flex items-center justify-between text-[11px] text-muted-foreground flex-wrap gap-1.5">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isUrgentOrOverdue ? 'bg-destructive' : 'bg-warning'}`} />
            <span>
              Billed Due: <strong className="text-foreground tabular-nums">{formatINR(billedDue)}</strong>
              {overdueCount > 0 && <span className="ml-1 text-[10px] font-semibold text-destructive whitespace-nowrap">({overdueCount} overdue)</span>}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0 bg-primary" />
            <span>Unbilled: <strong className="text-foreground tabular-nums">{formatINR(unbilledSpend)}</strong></span>
          </span>
        </div>
        <div>
          <span className={`tabular-nums ${utilTone}`}>Total Utilized: {formatINR(totalUtilized)} ({utilPct}%)</span>
        </div>
      </div>
    </div>
  );
}

function getStatementBadgeConfig(hasStatement: boolean, billedDue: number, daysToDue: number | null) {
  if (!hasStatement) {
    return { cls: 'bg-success/10 text-success border-success/20', label: 'Settled', isOk: true, isAlert: false };
  }
  if (billedDue <= 0) {
    return { cls: 'bg-success/10 text-success border-success/20', label: 'Paid', isOk: true, isAlert: false };
  }
  if (daysToDue !== null && daysToDue < 0) {
    return { cls: 'bg-destructive/10 text-destructive border-destructive/20', label: `Overdue ${Math.abs(daysToDue)}d`, isOk: false, isAlert: true };
  }
  if (daysToDue !== null && daysToDue <= 3) {
    return { cls: 'bg-destructive/10 text-destructive border-destructive/20', label: daysToDue === 0 ? 'Due Today' : `Due in ${daysToDue}d`, isOk: false, isAlert: false };
  }
  return { cls: 'bg-warning/10 text-warning border-warning/20', label: daysToDue === null ? 'Billed' : `Due in ${daysToDue}d`, isOk: false, isAlert: false };
}

function StatementDueBadge({ hasStatement, billedDue, daysToDue }: { hasStatement: boolean; billedDue: number; daysToDue: number | null }) {
  const cfg = getStatementBadgeConfig(hasStatement, billedDue, daysToDue);
  return (
    <Badge variant="outline" className={`${cfg.cls} text-[10px] gap-1 px-1.5 whitespace-nowrap shrink-0`}>
      {cfg.isOk ? <CheckCircle2 className="w-3 h-3" /> : cfg.isAlert ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
      {cfg.label}
    </Badge>
  );
}

function getStatementBoxTheme(billedDue: number, isUrgentOrOverdue: boolean) {
  if (billedDue <= 0) return { surface: 'border-success/25 bg-success/[0.05]', icon: 'text-success' };
  if (isUrgentOrOverdue) return { surface: 'border-destructive/30 bg-destructive/[0.05]', icon: 'text-destructive' };
  return { surface: 'border-warning/30 bg-warning/[0.05]', icon: 'text-warning' };
}

function StatementPeriodSummary({ billedStatement, isUrgentOrOverdue }: { billedStatement: CreditCardStatement | null; isUrgentOrOverdue: boolean }) {
  if (!billedStatement) {
    return <>No unpaid billed statement. Spends accumulate in unbilled.</>;
  }
  return (
    <>
      <span className="whitespace-nowrap">{formatShortDate(billedStatement.periodStart)} – {formatShortDate(billedStatement.periodEnd)}</span>
      <span className="mx-1.5" aria-hidden="true">·</span>
      <strong className={isUrgentOrOverdue ? 'text-destructive whitespace-nowrap' : 'text-warning whitespace-nowrap'}>
        Due {formatShortDate(billedStatement.dueDate)}
      </strong>
    </>
  );
}

function StatementDueBox(props: {
  billedStatement: CreditCardStatement | null;
  billedDue: number;
  daysToDue: number | null;
  isUrgentOrOverdue: boolean;
  overdueCount: number;
  hasMultipleOverdue: boolean;
  onPay: () => void;
  onReconcile: () => void;
}) {
  const { billedStatement, billedDue, daysToDue, isUrgentOrOverdue, overdueCount, hasMultipleOverdue, onPay, onReconcile } = props;
  const theme = getStatementBoxTheme(billedDue, isUrgentOrOverdue);

  return (
    <div className={`p-3 rounded-xl border shadow-xs flex flex-col justify-between space-y-2.5 ${theme.surface}`}>
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 whitespace-nowrap">
            <Calendar className={`w-3.5 h-3.5 shrink-0 ${theme.icon}`} />
            Statement Due
          </span>
          <StatementDueBadge hasStatement={Boolean(billedStatement)} billedDue={billedDue} daysToDue={daysToDue} />
        </div>
        <div className="mt-1.5">
          <div className="flex items-baseline gap-2 flex-wrap">
            <div className="text-xl font-bold text-foreground tabular-nums">{formatINR(billedDue)}</div>
            {hasMultipleOverdue && (
              <span className="text-[10px] font-medium text-destructive whitespace-nowrap">Includes {overdueCount} overdue</span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
            <StatementPeriodSummary billedStatement={billedStatement} isUrgentOrOverdue={isUrgentOrOverdue} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-border/60">
        <Button
          size="sm"
          variant={billedDue > 0 ? 'default' : 'outline'}
          onClick={onPay}
          className={`flex-1 h-8 text-xs rounded-lg gap-1 whitespace-nowrap ${
            billedDue > 0 ? 'font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs' : 'border-border text-foreground hover:bg-muted'
          }`}
        >
          {billedDue > 0 ? 'Pay Bill' : 'Pay Advance'}
        </Button>
        <Button size="sm" variant="outline" onClick={onReconcile} className="h-8 px-2.5 text-xs border-border text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg shrink-0" title="Set or reconcile official statement amount">
          <Sliders className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function UnbilledCycleBox(props: {
  unbilledSpend: number;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  onInspectSwipes: () => void;
}) {
  return (
    <div className="p-3 rounded-xl bg-primary/[0.04] border border-primary/20 shadow-xs flex flex-col justify-between space-y-2.5">
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 whitespace-nowrap">
            <Clock className="w-3.5 h-3.5 shrink-0 text-primary" />
            Unbilled Cycle
          </span>
          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 px-1.5 whitespace-nowrap shrink-0">
            Accumulating
          </Badge>
        </div>
        <div className="mt-1.5">
          <div className="text-xl font-bold text-foreground tabular-nums">{formatINR(props.unbilledSpend)}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
            <span className="whitespace-nowrap">{formatShortDate(props.periodStart)} – {formatShortDate(props.periodEnd)}</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className="whitespace-nowrap">Due <strong className="text-foreground">{formatShortDate(props.dueDate)}</strong></span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
        <span className="whitespace-nowrap truncate">Generates {formatShortDate(props.periodEnd)}</span>
        <Button size="sm" variant="ghost" onClick={props.onInspectSwipes} className="h-7 px-2 text-xs text-primary hover:text-primary/90 hover:bg-primary/10 rounded-md whitespace-nowrap shrink-0">
          Inspect Swipes
        </Button>
      </div>
    </div>
  );
}

function CreditCardModals(props: {
  card: FinanceAccount;
  targetStatement: CreditCardStatement | null;
  billedDue: number;
  defaultCycleKey: string;
  isPayOpen: boolean;
  setIsPayOpen: (open: boolean) => void;
  isReconcileOpen: boolean;
  setIsReconcileOpen: (open: boolean) => void;
  isHistoryOpen: boolean;
  setIsHistoryOpen: (open: boolean) => void;
  historyInitialTab: StatementHistoryTab;
  onPayFromHistory: (stmt?: CreditCardStatement | null) => void;
  onReconcileFromHistory: (stmt?: CreditCardStatement | null) => void;
}) {
  return (
    <>
      {props.isPayOpen && (
        <PayCreditCardModal
          open={props.isPayOpen}
          onOpenChange={props.setIsPayOpen}
          card={props.card}
          statement={props.targetStatement}
          defaultAmount={props.targetStatement ? props.targetStatement.remainingDue : props.billedDue > 0 ? props.billedDue : undefined}
        />
      )}
      {props.isReconcileOpen && (
        <ReconcileStatementModal
          open={props.isReconcileOpen}
          onOpenChange={props.setIsReconcileOpen}
          card={props.card}
          statement={props.targetStatement}
          defaultCycleKey={props.defaultCycleKey}
        />
      )}
      {props.isHistoryOpen && (
        <StatementHistoryModal
          open={props.isHistoryOpen}
          onOpenChange={props.setIsHistoryOpen}
          card={props.card}
          initialTab={props.historyInitialTab}
          onPay={props.onPayFromHistory}
          onReconcile={props.onReconcileFromHistory}
        />
      )}
    </>
  );
}
function CardBillingSummaryLine({ limit, billingDay, dueDay }: { limit: number; billingDay: number; dueDay: number }) {
  return (
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
  );
}

function CreditCardHeader(props: {
  card: FinanceAccount;
  limit: number;
  billingDay: number;
  dueDay: number;
  available: number;
  utilPct: number;
  onEdit: (card: FinanceAccount) => void;
}) {
  const { card, limit, billingDay, dueDay, available, utilPct, onEdit } = props;
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs">
          <CreditCard className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-base text-foreground truncate">{card.name}</h3>
            {card.isDefault && (
              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 gap-1 px-1.5 py-0 whitespace-nowrap shrink-0">
                <Star className="w-2.5 h-2.5 fill-primary" /> Default
              </Badge>
            )}
          </div>
          <CardBillingSummaryLine limit={limit} billingDay={billingDay} dueDay={dueDay} />
          {limit > 0 && (
            <p className="text-[11px] text-muted-foreground sm:hidden mt-0.5 tabular-nums">
              Avail: <strong className="text-foreground">{formatINR(available)}</strong>
              <span className="mx-1.5" aria-hidden="true">·</span>
              {utilPct}% used
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {limit > 0 && (
          <div className="text-right hidden sm:block tabular-nums">
            <span className="text-xs font-semibold text-foreground block">Avail: {formatINR(available)}</span>
            <span className="text-[11px] text-muted-foreground">{utilPct}% limit used</span>
          </div>
        )}
        <Button size="sm" variant="ghost" onClick={() => onEdit(card)} className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg" title="Edit Card Configuration">
          <Edit2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function computeHasMultipleOverdue(
  summary: NonNullable<ReturnType<ReturnType<typeof useFinanceStore.getState>['getCreditCardSummary']>>,
  billedDue: number,
  currentStmt: CreditCardStatement | null
): boolean {
  if (summary.overdueStatements.length > 1) return true;
  return summary.overdueStatements.length > 0 && currentStmt !== null && billedDue > currentStmt.remainingDue;
}

function deriveCardMetrics(card: FinanceAccount, summary: ReturnType<ReturnType<typeof useFinanceStore.getState>['getCreditCardSummary']>) {
  if (!summary) return null;
  const billedDue = summary.billedDueTotal;
  const daysToDue = summary.daysUntilDue;
  const isOverdue = summary.overdueStatements.length > 0 || (billedDue > 0 && daysToDue !== null && daysToDue < 0);
  const currentStmt = summary.currentBilledStatement ?? summary.billedStatement ?? null;
  return {
    summary,
    limit: card.creditLimit ?? 0,
    billingDay: card.billingDay ?? card.statementDay ?? 1,
    dueDay: card.dueDay ?? 20,
    billedDue,
    unbilledSpend: summary.unbilledSpend ?? summary.unbilledCycle.amount,
    totalUtilized: summary.totalUtilized ?? summary.totalOutstanding,
    available: summary.availableLimit ?? summary.availableCredit,
    utilPct: summary.utilizationPercent,
    daysToDue,
    isUrgentOrOverdue: billedDue > 0 && (isOverdue || (daysToDue !== null && daysToDue <= 3)),
    currentStmt,
    hasMultipleOverdue: computeHasMultipleOverdue(summary, billedDue, currentStmt),
  };
}

function CreditCardFooterActions(props: {
  isDefault: boolean;
  cardId: string;
  onOpenHistory: () => void;
  onSetDefault?: (cardId: string) => void;
}) {
  return (
    <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
      <Button size="sm" variant="outline" onClick={props.onOpenHistory} className="h-8 text-xs border-border bg-background text-foreground hover:bg-muted rounded-lg gap-1.5 whitespace-nowrap">
        <History className="w-3.5 h-3.5 text-primary" />
        <span>View Statements &amp; Swipes</span>
      </Button>
      <div className="flex items-center gap-2">
        {!props.isDefault && props.onSetDefault && (
          <Button size="sm" variant="ghost" onClick={() => props.onSetDefault?.(props.cardId)} className="h-8 px-2 text-xs text-muted-foreground hover:text-primary hover:bg-muted rounded-lg gap-1 whitespace-nowrap">
            <Star className="w-3 h-3" />
            <span className="hidden sm:inline">Set Default</span>
          </Button>
        )}
      </div>
    </div>
  );
}

export const CreditCardItem = React.memo(function CreditCardItem({ card, onEdit, onSetDefault }: CreditCardItemProps) {
  const feedback = useFeedback();
  const getCreditCardSummary = useFinanceStore((s) => s.getCreditCardSummary);
  const metrics = deriveCardMetrics(card, getCreditCardSummary(card.id));

  const [isPayOpen, setIsPayOpen] = useState(false);
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyInitialTab, setHistoryInitialTab] = useState<StatementHistoryTab>('current');
  const [targetStatement, setTargetStatement] = useState<CreditCardStatement | null>(null);

  if (!metrics) return null;
  const { summary, limit, billingDay, dueDay, billedDue, unbilledSpend, totalUtilized, available, utilPct, daysToDue, isUrgentOrOverdue, currentStmt, hasMultipleOverdue } = metrics;

  const handleOpenPay = (stmt?: CreditCardStatement | null) => {
    feedback.tap();
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
      <CreditCardHeader card={card} limit={limit} billingDay={billingDay} dueDay={dueDay} available={available} utilPct={utilPct} onEdit={onEdit} />

      <UtilizationProgressBar
        limit={limit}
        billedDue={billedDue}
        unbilledSpend={unbilledSpend}
        totalUtilized={totalUtilized}
        utilPct={utilPct}
        overdueCount={summary.overdueStatements.length}
        isUrgentOrOverdue={isUrgentOrOverdue}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <StatementDueBox
          billedStatement={summary.billedStatement ?? null}
          billedDue={billedDue}
          daysToDue={daysToDue}
          isUrgentOrOverdue={isUrgentOrOverdue}
          overdueCount={summary.overdueStatements.length}
          hasMultipleOverdue={hasMultipleOverdue}
          onPay={() => handleOpenPay(summary.billedStatement)}
          onReconcile={() => handleOpenReconcile(summary.billedStatement)}
        />

        <UnbilledCycleBox
          unbilledSpend={unbilledSpend}
          periodStart={summary.unbilledCycle.periodStart}
          periodEnd={summary.unbilledCycle.periodEnd}
          dueDate={summary.unbilledCycle.dueDate}
          onInspectSwipes={() => handleOpenHistory('unbilled')}
        />
      </div>

      <CreditCardFooterActions
        isDefault={Boolean(card.isDefault)}
        cardId={card.id}
        onOpenHistory={() => handleOpenHistory('current')}
        onSetDefault={onSetDefault}
      />

      <CreditCardModals
        card={card}
        targetStatement={targetStatement}
        billedDue={billedDue}
        defaultCycleKey={summary.billedStatement?.cycleKey || summary.unbilledCycle.cycleKey}
        isPayOpen={isPayOpen}
        setIsPayOpen={setIsPayOpen}
        isReconcileOpen={isReconcileOpen}
        setIsReconcileOpen={setIsReconcileOpen}
        isHistoryOpen={isHistoryOpen}
        setIsHistoryOpen={setIsHistoryOpen}
        historyInitialTab={historyInitialTab}
        onPayFromHistory={handleOpenPay}
        onReconcileFromHistory={handleOpenReconcile}
      />
    </Card>
  );
});
