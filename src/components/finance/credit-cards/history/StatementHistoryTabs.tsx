'use client';

import { CreditCard } from 'lucide-react';
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatINR } from '@/lib/stores/finance/helpers';
import type { useFinanceStore } from '@/lib/stores/finance-store';
import type { CreditCardStatement } from '@/lib/types';
import { formatOrdinal } from '@/lib/finance/credit-card-cycles';
import type { InternalHistoryTab } from '@/lib/finance/statement-cycle-helpers';
import type { useStatementHistoryData } from './useStatementHistoryController';
import {
  ArchiveStatementsTabPanel,
  CurrentBillTabPanel,
  UnbilledCycleTabPanel,
} from './StatementTabPanels';

export function StatementHistoryTabs(props: {
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

export function StatementHistoryHeader({ cardName, billingDay, dueDay }: { cardName: string; billingDay: number; dueDay: number }) {
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
