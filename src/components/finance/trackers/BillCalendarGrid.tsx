'use client';

import React from 'react';
import { CalendarDays } from 'lucide-react';
import { formatINR } from '@/lib/stores/finance-store';
import { formatMonthYear } from '@/lib/date-format';
import { EVENT_KIND_DOT_CLASS, type CalendarEventItem } from './bill-calendar-events';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const LEGEND_ITEMS = [
  { color: 'bg-amber-500', label: 'Bills' },
  { color: 'bg-rose-500', label: 'EMI/Card' },
  { color: 'bg-violet-500', label: 'SIP' },
  { color: 'bg-sky-500', label: 'Health Task' },
  { color: 'bg-teal-500', label: 'Supplement Refill' },
  { color: 'bg-emerald-500', label: 'Paid' },
];

function getDayCellClasses(isSelected: boolean, isToday: boolean, hasItems: boolean): string {
  const base = 'h-14 sm:h-16 p-1.5 rounded-xl border text-left flex flex-col justify-between transition-all';
  if (isSelected) return `${base} border-primary bg-primary/10 ring-1 ring-primary/40`;
  if (isToday) return `${base} border-foreground/40 bg-card`;
  if (hasItems) return `${base} border-border bg-card hover:bg-muted/40`;
  return `${base} border-border/50 bg-background/40 hover:bg-muted/30`;
}

function formatDayChipAmount(dayTotal: number): string {
  if (dayTotal >= 1000) return `₹${(dayTotal / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `₹${Math.round(dayTotal)}`;
}

export function BillCalendarGrid(params: {
  selectedMonth: string;
  monthTotals: { totalDue: number; totalPaid: number; count: number };
  firstDayOfWeek: number;
  daysInMonth: number;
  isCurrentMonth: boolean;
  todayDateNum: number;
  selectedDay: number;
  eventsByDay: Map<number, CalendarEventItem[]>;
  onSelectDay: (day: number) => void;
}) {
  const blanks = Array.from({ length: params.firstDayOfWeek }, (_, i) => i);
  const daysArray = Array.from({ length: params.daysInMonth }, (_, i) => i + 1);

  return (
    <div className="lg:col-span-8 rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <CalendarDays className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-foreground">
              Bill &amp; Cash-Outflow Calendar · {formatMonthYear(params.selectedMonth)}
            </h2>
            <p className="text-xs text-muted-foreground font-mono tabular-nums">
              {params.monthTotals.count} scheduled · Pending{' '}
              <strong className="text-foreground">{formatINR(params.monthTotals.totalDue)}</strong> · Paid{' '}
              {formatINR(params.monthTotals.totalPaid)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-muted-foreground">
          {LEGEND_ITEMS.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${item.color}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="py-1">{wd}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {blanks.map((b) => (
          <div key={`blank-${b}`} className="h-14 sm:h-16 rounded-xl bg-muted/20" />
        ))}
        {daysArray.map((day) => {
          const items = params.eventsByDay.get(day) ?? [];
          const dayTotal = items.reduce((s, i) => s + i.amount, 0);
          const hasPending = items.some((i) => !i.isPaid);
          const isToday = params.isCurrentMonth && params.todayDateNum === day;
          return (
            <button
              key={day}
              type="button"
              onClick={() => params.onSelectDay(day)}
              className={getDayCellClasses(params.selectedDay === day, isToday, items.length > 0)}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-mono tabular-nums font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                  {day}
                </span>
                {items.length > 0 && (
                  <div className="flex items-center gap-0.5">
                    {items.slice(0, 3).map((ev) => (
                      <span
                        key={ev.id}
                        className={`w-1.5 h-1.5 rounded-full ${ev.isPaid ? 'bg-emerald-500' : EVENT_KIND_DOT_CLASS[ev.kind]}`}
                      />
                    ))}
                  </div>
                )}
              </div>
              {dayTotal > 0 && (
                <span className={`text-[10px] font-mono tabular-nums font-semibold truncate ${hasPending ? 'text-foreground' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {formatDayChipAmount(dayTotal)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
