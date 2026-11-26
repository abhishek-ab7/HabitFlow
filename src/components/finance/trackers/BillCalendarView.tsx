'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  HeartHandshake,
  Landmark,
  Pill,
  Repeat,
  Stethoscope,
  TrendingUp,
} from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import { isFitnessModuleEnabled } from '@/lib/workspace-modules';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { PayCreditCardModal } from '../credit-cards/PayCreditCardModal';
import { formatMonthYear } from '@/lib/date-format';
import type { CreditCardStatement, FinanceAccount } from '@/lib/types';
import {
  buildBillCalendarEventsMap,
  computeMonthEventTotals,
  EVENT_KIND_ACTION_LABEL,
  type CalendarEventItem,
  type CalendarEventKind,
} from './bill-calendar-events';
import { BillCalendarGrid } from './BillCalendarGrid';

const EVENT_ICON_MAP: Record<CalendarEventKind, React.ReactNode> = {
  emi: <Landmark className="w-4 h-4 text-primary" />,
  sip: <TrendingUp className="w-4 h-4 text-violet-500" />,
  commitment: <HeartHandshake className="w-4 h-4 text-rose-500" />,
  credit_card: <CreditCard className="w-4 h-4 text-rose-500" />,
  health_task: <Stethoscope className="w-4 h-4 text-sky-500" />,
  supplement_refill: <Pill className="w-4 h-4 text-teal-500" />,
  bill: <Repeat className="w-4 h-4 text-cyan-500" />,
};

function CalendarEventCard({
  ev,
  selectedMonth,
  onPayCard,
  onQuickPay,
}: {
  ev: CalendarEventItem;
  selectedMonth: string;
  onPayCard: (ev: CalendarEventItem) => void;
  onQuickPay: (ev: CalendarEventItem) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            {EVENT_ICON_MAP[ev.kind]}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground truncate">{ev.title}</p>
            <p className="text-[11px] text-muted-foreground truncate">{ev.subtitle}</p>
          </div>
        </div>
        <span className="text-xs font-bold font-mono tabular-nums text-foreground shrink-0">
          {ev.kind === 'health_task' ? 'Health' : formatINR(ev.amount)}
        </span>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-border/60">
        {ev.isPaid ? (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {ev.kind === 'health_task' ? 'Completed' : `Settled for ${formatMonthYear(selectedMonth)}`}
          </span>
        ) : ev.kind === 'credit_card' ? (
          <Button type="button" size="sm" onClick={() => onPayCard(ev)} className="h-8 px-3 text-xs rounded-lg gap-1 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
            <CreditCard className="w-3.5 h-3.5" />
            <span>Pay {formatINR(ev.amount)}</span>
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={() => onQuickPay(ev)} className="h-8 px-3 text-xs rounded-lg gap-1 w-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{EVENT_KIND_ACTION_LABEL[ev.kind]}</span>
          </Button>
        )}
      </div>
    </div>
  );
}

export function BillCalendarView() {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const transactions = useFinanceStore((s) => s.transactions);
  const accounts = useFinanceStore((s) => s.accounts);
  const recurringBills = useFinanceStore((s) => s.recurringBills);
  const emiTrackers = useFinanceStore((s) => s.emiTrackers);
  const sipPlans = useFinanceStore((s) => s.sipPlans);
  const creditCardStatements = useFinanceStore((s) => s.creditCardStatements);
  const getAllCommitmentLedgers = useFinanceStore((s) => s.getAllCommitmentLedgers);
  const payRecurringBill = useFinanceStore((s) => s.payRecurringBill);
  const payMonthlyEmi = useFinanceStore((s) => s.payMonthlyEmi);
  const payMonthlySip = useFinanceStore((s) => s.payMonthlySip);
  const settleCommitmentBalance = useFinanceStore((s) => s.settleCommitmentBalance);

  const { user } = useAuth();
  const settings = useGamificationStore((s) => s.settings);
  const isFitnessEnabled = isFitnessModuleEnabled(settings);
  const tasks = useTaskStore((s) => s.tasks);
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const toggleTaskComplete = useTaskStore((s) => s.toggleTaskComplete);
  const supplementInventory = useFitnessStore((s) => s.supplementInventory);
  const supplementLogs = useFitnessStore((s) => s.supplementLogs);
  const hasLoadedFitness = useFitnessStore((s) => s.hasLoaded);
  const loadFitnessData = useFitnessStore((s) => s.loadFitnessData);
  const restockSupplement = useFitnessStore((s) => s.restockSupplement);

  useEffect(() => {
    if (typeof loadTasks === 'function' && tasks.length === 0) void loadTasks();
    if (typeof loadFitnessData === 'function' && !hasLoadedFitness) void loadFitnessData(user?.id);
  }, [loadTasks, tasks.length, loadFitnessData, hasLoadedFitness, user?.id]);

  const [payingCardAccount, setPayingCardAccount] = useState<FinanceAccount | null>(null);
  const [payingCardStatement, setPayingCardStatement] = useState<CreditCardStatement | null>(null);

  const [yearNum, monthNum] = selectedMonth.split('-').map((n) => parseInt(n, 10));
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const firstDayOfWeek = new Date(yearNum, monthNum - 1, 1).getDay();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === yearNum && today.getMonth() + 1 === monthNum;
  const [selectedDay, setSelectedDay] = useState<number>(isCurrentMonth ? today.getDate() : 1);

  const commitmentLedgers = getAllCommitmentLedgers(selectedMonth);
  const eventsByDay = useMemo(
    () =>
      buildBillCalendarEventsMap({
        daysInMonth,
        selectedMonth,
        recurringBills,
        emiTrackers,
        sipPlans,
        commitmentLedgers,
        creditCardStatements,
        accounts,
        transactions,
        tasks,
        isFitnessEnabled,
        supplementInventory,
        supplementLogs,
      }),
    [
      recurringBills, emiTrackers, sipPlans, commitmentLedgers, creditCardStatements,
      accounts, transactions, tasks, isFitnessEnabled, supplementInventory, supplementLogs,
      selectedMonth, daysInMonth,
    ]
  );

  const monthTotals = useMemo(() => computeMonthEventTotals(eventsByDay), [eventsByDay]);
  const selectedDayEvents = eventsByDay.get(selectedDay) ?? [];

  const handleQuickPay = async (ev: CalendarEventItem) => {
    const actions: Partial<Record<CalendarEventKind, () => Promise<void>>> = {
      bill: async () => {
        if (await payRecurringBill(ev.sourceId)) toast.success(`Marked ${ev.title} paid`);
      },
      emi: async () => {
        if (await payMonthlyEmi(ev.sourceId)) toast.success(`Marked ${ev.title} EMI paid`);
      },
      sip: async () => {
        if (await payMonthlySip(ev.sourceId)) toast.success(`Logged ${ev.title} SIP investment`);
      },
      commitment: async () => {
        if (await settleCommitmentBalance(ev.sourceId, undefined, selectedMonth)) toast.success(`Settled ${ev.title}`);
      },
      health_task: async () => {
        await toggleTaskComplete(ev.sourceId);
        toast.success(`Updated health task: ${ev.title}`);
      },
      supplement_refill: async () => {
        await restockSupplement(ev.sourceId, {});
        toast.success(`Restocked ${ev.title.replace(/ Refill$/, '')}`);
      },
    };
    await actions[ev.kind]?.();
  };

  const handleOpenCardPay = (ev: CalendarEventItem) => {
    const card = accounts.find((a) => a.id === ev.sourceId);
    if (!card) return;
    const stmt = ev.statementId ? creditCardStatements.find((s) => s.id === ev.statementId) : null;
    setPayingCardAccount(card);
    setPayingCardStatement(stmt ?? null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <BillCalendarGrid
        selectedMonth={selectedMonth}
        monthTotals={monthTotals}
        firstDayOfWeek={firstDayOfWeek}
        daysInMonth={daysInMonth}
        isCurrentMonth={isCurrentMonth}
        todayDateNum={today.getDate()}
        selectedDay={selectedDay}
        eventsByDay={eventsByDay}
        onSelectDay={setSelectedDay}
      />

      <div className="lg:col-span-4 rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3.5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Day {selectedDay} Schedule</p>
          <p className="text-sm font-bold text-foreground mt-0.5">
            {selectedDayEvents.length === 0
              ? 'No scheduled dues on this day'
              : `${selectedDayEvents.length} ${selectedDayEvents.length === 1 ? 'obligation' : 'obligations'} · ${formatINR(selectedDayEvents.reduce((s, i) => s + i.amount, 0))}`}
          </p>
        </div>

        {selectedDayEvents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
            Select any marked date on the calendar to review bills, SIPs, EMIs, or commitments due on that day and mark them paid in 1 tap.
          </div>
        ) : (
          <div className="space-y-2.5">
            {selectedDayEvents.map((ev) => (
              <CalendarEventCard key={ev.id} ev={ev} selectedMonth={selectedMonth} onPayCard={handleOpenCardPay} onQuickPay={handleQuickPay} />
            ))}
          </div>
        )}
      </div>

      {payingCardAccount && (
        <PayCreditCardModal
          open={Boolean(payingCardAccount)}
          onOpenChange={(open) => {
            if (!open) {
              setPayingCardAccount(null);
              setPayingCardStatement(null);
            }
          }}
          card={payingCardAccount}
          statement={payingCardStatement}
          defaultAmount={payingCardStatement?.remainingDue || undefined}
        />
      )}
    </div>
  );
}
