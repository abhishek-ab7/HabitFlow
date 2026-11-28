'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { CreditCardStatement, FinanceAccount } from '@/lib/types';
import type { StatementHistoryTab } from '@/lib/finance/statement-cycle-helpers';
import { useStatementHistoryController } from './history/useStatementHistoryController';
import {
  StatementHistoryHeader,
  StatementHistoryTabs,
} from './history/StatementHistoryTabs';

export type { StatementHistoryTab };

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
  const c = useStatementHistoryController({ open, card, initialTab });
  if (!c.data.summary) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-card border border-border text-card-foreground p-0 overflow-hidden shadow-xl">
        <StatementHistoryHeader cardName={card.name} billingDay={c.data.billingDay} dueDay={c.data.dueDay} />
        <div className="p-5 pt-3">
          <StatementHistoryTabs
            activeTab={c.activeTab}
            onTabChange={c.setActiveTab}
            summary={c.data.summary}
            data={c.data}
            isMoving={c.isMoving}
            onShiftCycle={c.handleShiftCycle}
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
