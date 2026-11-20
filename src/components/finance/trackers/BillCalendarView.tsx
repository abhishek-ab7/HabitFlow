'use client';

import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Repeat,
  Landmark,
  TrendingUp,
  HeartHandshake,
  CreditCard,
} from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface CalendarEventItem {
  id: string;
  sourceId: string;
  day: number;
  kind: 'bill' | 'emi' | 'sip' | 'commitment' | 'credit_card';
  title: string;
  subtitle: string;
  amount: number;
  isPaid: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function BillCalendarView() {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const transactions = useFinanceStore((s) => s.transactions);
  const accounts = useFinanceStore((s) => s.accounts);
  const recurringBills = useFinanceStore((s) => s.recurringBills);
  const emiTrackers = useFinanceStore((s) => s.emiTrackers);
  const sipPlans = useFinanceStore((s) => s.sipPlans);
  const getAllCommitmentLedgers = useFinanceStore((s) => s.getAllCommitmentLedgers);

  const payRecurringBill = useFinanceStore((s) => s.payRecurringBill);
  const payMonthlyEmi = useFinanceStore((s) => s.payMonthlyEmi);
  const payMonthlySip = useFinanceStore((s) => s.payMonthlySip);
  const settleCommitmentBalance = useFinanceStore((s) => s.settleCommitmentBalance);

  const [yearNum, monthNum] = selectedMonth.split('-').map((n) => parseInt(n, 10));
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const firstDayOfWeek = new Date(yearNum, monthNum - 1, 1).getDay();

  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === yearNum && today.getMonth() + 1 === monthNum;
  const [selectedDay, setSelectedDay] = useState<number>(
    isCurrentMonth ? today.getDate() : 1
  );

  const commitmentLedgers = getAllCommitmentLedgers(selectedMonth);

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEventItem[]>();
    const pushEvent = (dayRaw: number, ev: CalendarEventItem) => {
      const clamped = Math.min(daysInMonth, Math.max(1, dayRaw || 1));
      const list = map.get(clamped) || [];
      list.push({ ...ev, day: clamped });
      map.set(clamped, list);
    };

    for (const bill of recurringBills) {
      if (!bill.isActive || bill.deletedAt) continue;
      pushEvent(bill.dueDayOfMonth, {
        id: `bill-${bill.id}`,
        sourceId: bill.id,
        day: bill.dueDayOfMonth,
        kind: 'bill',
        title: bill.name,
        subtitle: `Recurring · ${bill.cadence}`,
        amount: bill.amount,
        isPaid: bill.lastPaidMonthKey === selectedMonth,
      });
    }

    for (const emi of emiTrackers) {
      if (emi.status !== 'active' || emi.deletedAt) continue;
      const isPaid =
        emi.lastPaidMonthKey === selectedMonth ||
        transactions.some(
          (t) =>
            !t.deletedAt &&
            t.linkedEmiId === emi.id &&
            t.monthKey === selectedMonth
        );
      pushEvent(emi.billingDayOfMonth, {
        id: `emi-${emi.id}`,
        sourceId: emi.id,
        day: emi.billingDayOfMonth,
        kind: 'emi',
        title: emi.loanName,
        subtitle: `EMI · ${emi.lenderName}`,
        amount: emi.emiAmount,
        isPaid,
      });
    }

    for (const sip of sipPlans) {
      if (!sip.isActive || sip.deletedAt) continue;
      const isPaid =
        sip.lastInvestedMonthKey === selectedMonth ||
        transactions.some(
          (t) =>
            !t.deletedAt &&
            t.linkedSipId === sip.id &&
            t.monthKey === selectedMonth
        );
      pushEvent(sip.sipDayOfMonth, {
        id: `sip-${sip.id}`,
        sourceId: sip.id,
        day: sip.sipDayOfMonth,
        kind: 'sip',
        title: sip.name,
        subtitle: `SIP · ${sip.platform || 'Investment'}`,
        amount: sip.monthlyAmount,
        isPaid,
      });
    }

    for (const ledger of commitmentLedgers) {
      pushEvent(ledger.commitment.dueDayOfMonth, {
        id: `comm-${ledger.commitment.id}`,
        sourceId: ledger.commitment.id,
        day: ledger.commitment.dueDayOfMonth,
        kind: 'commitment',
        title: ledger.commitment.title,
        subtitle: `Commitment · ${ledger.commitment.recipientName}`,
        amount:
          ledger.remainingBalance > 0
            ? ledger.remainingBalance
            : ledger.effectiveTargetAmount,
        isPaid: ledger.remainingBalance <= 0,
      });
    }

    for (const acc of accounts) {
      if (acc.type !== 'credit_card' || acc.deletedAt || acc.archived || !acc.dueDay) {
        continue;
      }
      const dueAmt = acc.balance < 0 ? Math.abs(acc.balance) : acc.balance;
      if (dueAmt <= 0) continue;
      pushEvent(acc.dueDay, {
        id: `card-${acc.id}`,
        sourceId: acc.id,
        day: acc.dueDay,
        kind: 'credit_card',
        title: `${acc.name} Due`,
        subtitle: 'Credit Card Bill',
        amount: dueAmt,
        isPaid: false,
      });
    }

    return map;
  }, [
    recurringBills,
    emiTrackers,
    sipPlans,
    commitmentLedgers,
    accounts,
    transactions,
    selectedMonth,
    daysInMonth,
  ]);

  const monthTotals = useMemo(() => {
    let totalDue = 0;
    let totalPaid = 0;
    let count = 0;
    for (const list of eventsByDay.values()) {
      for (const ev of list) {
        count += 1;
        if (ev.isPaid) totalPaid += ev.amount;
        else totalDue += ev.amount;
      }
    }
    return { totalDue, totalPaid, count };
  }, [eventsByDay]);

  const selectedDayEvents = eventsByDay.get(selectedDay) || [];

  const handleQuickPay = async (ev: CalendarEventItem) => {
    if (ev.kind === 'bill') {
      const tx = await payRecurringBill(ev.sourceId);
      if (tx) toast.success(`Marked ${ev.title} paid`);
    } else if (ev.kind === 'emi') {
      const tx = await payMonthlyEmi(ev.sourceId);
      if (tx) toast.success(`Marked ${ev.title} EMI paid`);
    } else if (ev.kind === 'sip') {
      const tx = await payMonthlySip(ev.sourceId);
      if (tx) toast.success(`Logged ${ev.title} SIP investment`);
    } else if (ev.kind === 'commitment') {
      const tx = await settleCommitmentBalance(ev.sourceId, undefined, selectedMonth);
      if (tx) toast.success(`Settled ${ev.title}`);
    }
  };

  const renderIcon = (kind: CalendarEventItem['kind']) => {
    if (kind === 'emi') return <Landmark className="w-4 h-4 text-primary" />;
    if (kind === 'sip') return <TrendingUp className="w-4 h-4 text-violet-500" />;
    if (kind === 'commitment') return <HeartHandshake className="w-4 h-4 text-rose-500" />;
    if (kind === 'credit_card') return <CreditCard className="w-4 h-4 text-rose-500" />;
    return <Repeat className="w-4 h-4 text-cyan-500" />;
  };

  const dotColor = (kind: CalendarEventItem['kind'], isPaid: boolean) => {
    if (isPaid) return 'bg-emerald-500';
    if (kind === 'emi' || kind === 'credit_card') return 'bg-rose-500';
    if (kind === 'sip') return 'bg-violet-500';
    if (kind === 'commitment') return 'bg-rose-500';
    return 'bg-amber-500';
  };

  const blanks = Array.from({ length: firstDayOfWeek }, (_, i) => i);
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* 7-Column Interactive Bill Calendar Grid */}
      <div className="lg:col-span-8 rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <CalendarDays className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Bill &amp; Cash-Outflow Calendar ({selectedMonth})
              </h2>
              <p className="text-xs text-muted-foreground font-mono tabular-nums">
                {monthTotals.count} scheduled · Pending{' '}
                <strong className="text-foreground">
                  {formatINR(monthTotals.totalDue)}
                </strong>{' '}
                · Paid {formatINR(monthTotals.totalPaid)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Bills
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              EMI/Card
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-violet-500" />
              SIP
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Paid
            </span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="py-1">
              {wd}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {blanks.map((b) => (
            <div key={`blank-${b}`} className="h-14 sm:h-16 rounded-xl bg-muted/20" />
          ))}

          {daysArray.map((day) => {
            const items = eventsByDay.get(day) || [];
            const dayTotal = items.reduce((s, i) => s + i.amount, 0);
            const hasPending = items.some((i) => !i.isPaid);
            const isSelected = selectedDay === day;
            const isToday = isCurrentMonth && today.getDate() === day;

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`h-14 sm:h-16 p-1.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
                    : isToday
                    ? 'border-foreground/40 bg-card'
                    : items.length > 0
                    ? 'border-border bg-card hover:bg-muted/40'
                    : 'border-border/50 bg-background/40 hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-mono tabular-nums font-semibold ${
                      isToday ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {day}
                  </span>
                  {items.length > 0 && (
                    <div className="flex items-center gap-0.5">
                      {items.slice(0, 3).map((ev) => (
                        <span
                          key={ev.id}
                          className={`w-1.5 h-1.5 rounded-full ${dotColor(
                            ev.kind,
                            ev.isPaid
                          )}`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {dayTotal > 0 && (
                  <span
                    className={`text-[10px] font-mono tabular-nums font-semibold truncate ${
                      hasPending
                        ? 'text-foreground'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    ₹{dayTotal >= 1000 ? `${(dayTotal / 1000).toFixed(1).replace(/\.0$/, '')}k` : Math.round(dayTotal)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Action Tray */}
      <div className="lg:col-span-4 rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3.5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Day {selectedDay} Schedule
          </p>
          <p className="text-sm font-bold text-foreground mt-0.5">
            {selectedDayEvents.length === 0
              ? 'No scheduled dues on this day'
              : `${selectedDayEvents.length} ${
                  selectedDayEvents.length === 1 ? 'obligation' : 'obligations'
                } · ${formatINR(
                  selectedDayEvents.reduce((s, i) => s + i.amount, 0)
                )}`}
          </p>
        </div>

        {selectedDayEvents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
            Select any marked date on the calendar to review bills, SIPs, EMIs, or commitments due on that day and mark them paid in 1 tap.
          </div>
        ) : (
          <div className="space-y-2.5">
            {selectedDayEvents.map((ev) => (
              <div
                key={ev.id}
                className="rounded-xl border border-border bg-background p-3 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {renderIcon(ev.kind)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">
                        {ev.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {ev.subtitle}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-bold font-mono tabular-nums text-foreground shrink-0">
                    {formatINR(ev.amount)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border/60">
                  {ev.isPaid ? (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Settled for {selectedMonth}
                    </span>
                  ) : ev.kind === 'credit_card' ? (
                    <span className="text-[11px] text-muted-foreground">
                      Pay card in Accounts tab
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleQuickPay(ev)}
                      className="h-8 px-3 text-xs rounded-lg gap-1 w-full"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {ev.kind === 'sip'
                          ? 'Log SIP Investment'
                          : ev.kind === 'commitment'
                          ? 'Settle Balance'
                          : 'Mark Paid'}
                      </span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
