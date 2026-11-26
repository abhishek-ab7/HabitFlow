'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  CalendarDays,
  HeartHandshake,
  Repeat,
  TrendingUp,
  Users,
  Landmark,
  CalendarClock,
  CheckCircle2,
} from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type { FinancialObligationItem } from '@/lib/types';
import { useFeedback } from '@/hooks/use-feedback';
import { toast } from 'sonner';

const SubTabFallback = () => (
  <div className="h-56 rounded-2xl border border-border bg-card animate-pulse" />
);

const BillCalendarView = dynamic(
  () => import('./trackers/BillCalendarView').then((m) => ({ default: m.BillCalendarView })),
  { ssr: false, loading: SubTabFallback }
);
const CommitmentsSection = dynamic(
  () => import('./trackers/CommitmentsSection').then((m) => ({ default: m.CommitmentsSection })),
  { ssr: false, loading: SubTabFallback }
);
const BillsSubsSection = dynamic(
  () => import('./trackers/BillsSubsSection').then((m) => ({ default: m.BillsSubsSection })),
  { ssr: false, loading: SubTabFallback }
);
const SipsSection = dynamic(
  () => import('./trackers/SipsSection').then((m) => ({ default: m.SipsSection })),
  { ssr: false, loading: SubTabFallback }
);
const FriendsDebtSection = dynamic(
  () => import('./trackers/FriendsDebtSection').then((m) => ({ default: m.FriendsDebtSection })),
  { ssr: false, loading: SubTabFallback }
);
const EmisPayoffSection = dynamic(
  () => import('./trackers/EmisPayoffSection').then((m) => ({ default: m.EmisPayoffSection })),
  { ssr: false, loading: SubTabFallback }
);

interface TrackersTabProps {
  onLogOffsetExpense: (commitmentId: string) => void;
}

type TrackerSubTab =
  | 'calendar'
  | 'commitments'
  | 'bills'
  | 'sips'
  | 'friends'
  | 'emis';

const OBLIGATION_CTA_LABELS: Record<FinancialObligationItem['type'], string> = {
  sip: 'Log SIP',
  commitment: 'Settle',
  credit_card: 'Pay Card',
  debt: 'Record Pay',
  bill: 'Mark Paid',
  emi: 'Mark Paid',
};

const TRACKER_SUB_TABS = [
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'commitments', label: 'Commitments', icon: HeartHandshake },
  { id: 'bills', label: 'Bills & Subs', icon: Repeat },
  { id: 'sips', label: 'SIPs', icon: TrendingUp },
  { id: 'friends', label: 'Friends', icon: Users },
  { id: 'emis', label: 'EMIs & Payoff', icon: Landmark },
] as const;

function UpcomingObligationCard({
  item,
  onPay,
}: {
  item: FinancialObligationItem;
  onPay: (item: FinancialObligationItem) => void;
}) {
  const dueTone = item.isOverdue
    ? 'text-rose-600 dark:text-rose-400'
    : item.daysUntilDue <= 3
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-muted-foreground';
  const dueLabel = item.isOverdue
    ? `${Math.abs(item.daysUntilDue)}d overdue`
    : item.daysUntilDue === 0
    ? 'Due today'
    : `In ${item.daysUntilDue}d`;
  const isSecondary = item.type === 'credit_card' || item.type === 'debt';

  return (
    <div className="min-w-[215px] max-w-[240px] shrink-0 rounded-xl border border-border bg-background p-3 flex flex-col justify-between gap-2">
      <div className="space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[11px] font-mono font-semibold ${dueTone}`}>{dueLabel}</span>
          <span className="text-xs font-bold font-mono tabular-nums text-foreground">{formatINR(item.amount)}</span>
        </div>
        <p className="text-xs font-bold text-foreground truncate">{item.title}</p>
        <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
      </div>
      <button
        type="button"
        onClick={() => onPay(item)}
        className={`min-h-[34px] w-full rounded-lg text-xs font-semibold transition-colors ${
          isSecondary ? 'border border-border bg-card hover:bg-muted text-foreground' : 'bg-primary/10 hover:bg-primary/20 text-primary'
        }`}
      >
        {OBLIGATION_CTA_LABELS[item.type]}
      </button>
    </div>
  );
}

function UpcomingObligationsStrip({
  upcoming30d,
  totalUpcoming,
  onPay,
}: {
  upcoming30d: FinancialObligationItem[];
  totalUpcoming: number;
  onPay: (item: FinancialObligationItem) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-bold text-foreground">Upcoming Obligations (Next 30d)</h2>
        </div>
        <span className="text-xs font-mono tabular-nums text-muted-foreground">
          {upcoming30d.length} pending · <strong className="text-foreground">{formatINR(totalUpcoming)}</strong>
        </span>
      </div>
      {upcoming30d.length === 0 ? (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" />
          All bills, SIPs, EMIs, and commitments for this cycle are settled!
        </p>
      ) : (
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {upcoming30d.slice(0, 8).map((item) => (
            <UpcomingObligationCard key={item.id} item={item} onPay={onPay} />
          ))}
        </div>
      )}
    </div>
  );
}

function TrackerSubTabBar({
  subTab,
  onSelect,
}: {
  subTab: TrackerSubTab;
  onSelect: (tab: TrackerSubTab) => void;
}) {
  return (
    <div role="tablist" aria-label="Bills and debt sections" className="flex items-center gap-1 p-1 rounded-2xl bg-muted overflow-x-auto">
      {TRACKER_SUB_TABS.map((tab) => {
        const Icon = tab.icon;
        const active = subTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(tab.id)}
            className={`min-h-[40px] px-3.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap inline-flex items-center gap-1.5 shrink-0 ${
              active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function TrackerSubTabContent({ subTab, onLogOffsetExpense }: { subTab: TrackerSubTab; onLogOffsetExpense: (id: string) => void }) {
  const views: Record<TrackerSubTab, React.ReactNode> = {
    calendar: <BillCalendarView />,
    commitments: <CommitmentsSection onLogOffsetExpense={onLogOffsetExpense} />,
    bills: <BillsSubsSection />,
    sips: <SipsSection />,
    friends: <FriendsDebtSection />,
    emis: <EmisPayoffSection />,
  };
  return <div>{views[subTab]}</div>;
}

export function TrackersTab({ onLogOffsetExpense }: TrackersTabProps) {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const getUpcomingFinancialObligations = useFinanceStore((s) => s.getUpcomingFinancialObligations);
  const payRecurringBill = useFinanceStore((s) => s.payRecurringBill);
  const payMonthlyEmi = useFinanceStore((s) => s.payMonthlyEmi);
  const payMonthlySip = useFinanceStore((s) => s.payMonthlySip);
  const settleCommitmentBalance = useFinanceStore((s) => s.settleCommitmentBalance);

  const [subTab, setSubTab] = useState<TrackerSubTab>('calendar');
  const feedback = useFeedback();

  const upcoming30d = useMemo(() => getUpcomingFinancialObligations(31), [getUpcomingFinancialObligations, selectedMonth]);
  const totalUpcoming = useMemo(() => upcoming30d.reduce((s, item) => s + item.amount, 0), [upcoming30d]);

  const handleQuickPayObligation = async (item: FinancialObligationItem) => {
    const isDirectPay = item.type !== 'credit_card' && item.type !== 'debt';
    if (isDirectPay) feedback.coin();
    else feedback.tap();

    const payHandlers: Partial<Record<FinancialObligationItem['type'], () => Promise<void>>> = {
      bill: async () => { if (await payRecurringBill(item.sourceId)) toast.success(`Paid ${item.title}`); },
      emi: async () => { if (await payMonthlyEmi(item.sourceId)) toast.success(`Paid ${item.title}`); },
      sip: async () => { if (await payMonthlySip(item.sourceId)) toast.success(`Invested ${item.title}`); },
      commitment: async () => { if (await settleCommitmentBalance(item.sourceId, undefined, selectedMonth)) toast.success(`Settled ${item.title}`); },
    };

    const handler = payHandlers[item.type];
    if (handler) {
      await handler();
      return;
    }
    setSubTab(item.type === 'debt' ? 'friends' : 'calendar');
  };

  return (
    <div className="space-y-5">
      <UpcomingObligationsStrip upcoming30d={upcoming30d} totalUpcoming={totalUpcoming} onPay={handleQuickPayObligation} />
      <TrackerSubTabBar
        subTab={subTab}
        onSelect={(tab) => {
          feedback.tap();
          setSubTab(tab);
        }}
      />
      <TrackerSubTabContent subTab={subTab} onLogOffsetExpense={onLogOffsetExpense} />
    </div>
  );
}
