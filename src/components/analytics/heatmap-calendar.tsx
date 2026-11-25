'use client';

import React, { useMemo, useState } from 'react';
import { addDays, format, startOfWeek, subDays } from 'date-fns';
import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { parseIsoAsLocalNoon } from '@/lib/analytics/life-os-aggregator';
import { formatHumanDate } from '@/lib/date-format';
import { getIstIsoDate } from '@/lib/mcp/config';
import type { HeatmapData } from '@/lib/types';
import { cn } from '@/lib/utils';

interface HeatmapCalendarProps {
  data: HeatmapData[];
  weeks?: number;
}

const LEVEL_COLORS = [
  'bg-muted/80 dark:bg-muted/60 border border-border/50',
  'bg-emerald-500/25',
  'bg-emerald-500/50',
  'bg-emerald-500/75',
  'bg-emerald-500',
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function HeatmapCalendarInner({ data, weeks }: HeatmapCalendarProps) {
  const defaultWeeks = weeks && weeks <= 16 ? weeks : 12;
  const [showFullYear, setShowFullYear] = useState(false);
  const activeWeeks = showFullYear ? 52 : defaultWeeks;

  const todayIso = useMemo(() => getIstIsoDate(), []);

  const dataMap = useMemo(() => {
    const map = new Map<string, HeatmapData>();
    for (const d of data) {
      map.set(d.date, d);
    }
    return map;
  }, [data]);

  const weeksData = useMemo(() => {
    const todayNoon = parseIsoAsLocalNoon(todayIso);
    const startDate = startOfWeek(subDays(todayNoon, (activeWeeks - 1) * 7));
    const result: { date: Date; dateStr: string; data: HeatmapData | null }[][] = [];

    for (let w = 0; w < activeWeeks; w++) {
      const week: { date: Date; dateStr: string; data: HeatmapData | null }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(startDate, w * 7 + d);
        const dateStr = format(date, 'yyyy-MM-dd');
        week.push({
          date,
          dateStr,
          data: dataMap.get(dateStr) || null,
        });
      }
      result.push(week);
    }
    return result;
  }, [dataMap, activeWeeks, todayIso]);

  const monthLabels = useMemo(() => {
    const labels: { label: string; weekIndex: number }[] = [];
    let lastMonth = -1;
    weeksData.forEach((week, weekIndex) => {
      const firstDayOfWeek = week[0].date;
      const month = firstDayOfWeek.getMonth();
      if (month !== lastMonth) {
        labels.push({
          label: format(firstDayOfWeek, 'MMM'),
          weekIndex,
        });
        lastMonth = month;
      }
    });
    return labels;
  }, [weeksData]);

  const { totalCompletions, activeDays } = useMemo(() => {
    let completionsSum = 0;
    let activeCount = 0;
    for (const week of weeksData) {
      for (const day of week) {
        if (day.dateStr <= todayIso && day.data && day.data.count > 0) {
          completionsSum += day.data.count;
          activeCount += 1;
        }
      }
    }
    return { totalCompletions: completionsSum, activeDays: activeCount };
  }, [weeksData, todayIso]);

  return (
    <AnalyticsChartCard
      title="Activity Heatmap"
      subtitle={`${totalCompletions} check-in${totalCompletions === 1 ? '' : 's'} across ${activeDays} active day${activeDays === 1 ? '' : 's'}`}
      headerRight={
        <div
          role="group"
          aria-label="Heatmap window"
          className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-[11px]"
        >
          <button
            type="button"
            aria-pressed={!showFullYear}
            onClick={() => setShowFullYear(false)}
            className={cn(
              'rounded-md px-2 py-1 font-medium transition-colors tabular-nums',
              !showFullYear
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {defaultWeeks}W
          </button>
          <button
            type="button"
            aria-pressed={showFullYear}
            onClick={() => setShowFullYear(true)}
            className={cn(
              'rounded-md px-2 py-1 font-medium transition-colors',
              showFullYear
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Full Year
          </button>
        </div>
      }
      isEmpty={totalCompletions === 0 && !showFullYear}
      emptyTitle="No habit check-ins in this window"
      emptyDescription="Check off habits today to start lighting up your consistency grid."
      emptyActionLabel="Check In Today"
      emptyActionHref="/habits"
    >
      <TooltipProvider>
        <div className="overflow-x-auto pb-1 flex justify-start sm:justify-center">
          <div className="min-w-max">
            <div className="flex mb-1.5 pl-8">
              {monthLabels.map((month, i) => (
                <div
                  key={`${month.label}-${month.weekIndex}`}
                  className="text-[11px] text-muted-foreground"
                  style={{
                    marginLeft:
                      i === 0
                        ? 0
                        : `${Math.max(4, (month.weekIndex - monthLabels[i - 1].weekIndex) * 14 - 22)}px`,
                  }}
                >
                  {month.label}
                </div>
              ))}
            </div>

            <div className="flex">
              <div className="flex flex-col gap-[3px] mr-2 text-[10px] text-muted-foreground">
                {DAYS_OF_WEEK.map((day, i) => (
                  <div
                    key={day}
                    className="h-3 flex items-center"
                    style={{ visibility: i % 2 === 1 ? 'visible' : 'hidden' }}
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="flex gap-[3px]">
                {weeksData.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-[3px]">
                    {week.map((day) => {
                      const level = day.data?.level ?? 0;
                      const count = day.data?.count ?? 0;
                      const isFuture = day.dateStr > todayIso;
                      const isTodayCell = day.dateStr === todayIso;

                      return (
                        <Tooltip key={day.dateStr}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                'w-3 h-3 rounded-[3px] transition-colors',
                                isFuture ? 'bg-muted/25' : LEVEL_COLORS[level],
                                isTodayCell && 'ring-2 ring-primary'
                              )}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium text-xs">{formatHumanDate(day.dateStr)}</p>
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {isFuture
                                ? 'Upcoming'
                                : count === 0
                                  ? 'No check-ins'
                                  : `${count} habit${count === 1 ? '' : 's'} completed`}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-1.5 mt-3 text-[11px] text-muted-foreground">
              <span>Less</span>
              {LEVEL_COLORS.map((color, i) => (
                <div key={i} className={cn('w-3 h-3 rounded-[3px]', color)} />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </AnalyticsChartCard>
  );
}

export const HeatmapCalendar = React.memo(HeatmapCalendarInner);
