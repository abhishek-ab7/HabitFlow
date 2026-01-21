'use client';

import { useMemo } from 'react';
import { format, startOfWeek, addDays, subDays, isToday, isSameMonth } from 'date-fns';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { HeatmapData } from '@/lib/types';

interface HeatmapCalendarProps {
  data: HeatmapData[];
  weeks?: number;
}

const LEVEL_COLORS = [
  'bg-muted',
  'bg-success/20',
  'bg-success/40',
  'bg-success/70',
  'bg-success',
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function HeatmapCalendar({ data, weeks = 20 }: HeatmapCalendarProps) {
  // Create a map for quick lookup
  const dataMap = useMemo(() => {
    const map = new Map<string, HeatmapData>();
    data.forEach(d => map.set(d.date, d));
    return map;
  }, [data]);

  // Generate weeks data
  const weeksData = useMemo(() => {
    const today = new Date();
    const result: { date: Date; data: HeatmapData | null }[][] = [];
    
    // Start from the beginning of the week, `weeks` weeks ago
    const startDate = startOfWeek(subDays(today, (weeks - 1) * 7));
    
    for (let w = 0; w < weeks; w++) {
      const week: { date: Date; data: HeatmapData | null }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(startDate, w * 7 + d);
        const dateStr = format(date, 'yyyy-MM-dd');
        week.push({
          date,
          data: dataMap.get(dateStr) || null,
        });
      }
      result.push(week);
    }
    
    return result;
  }, [dataMap, weeks]);

  // Calculate month labels
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

  // Total completions
  const totalCompletions = useMemo(() => {
    return data.reduce((sum, d) => sum + d.count, 0);
  }, [data]);

  const activeDays = useMemo(() => {
    return data.filter(d => d.count > 0).length;
  }, [data]);

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Activity Heatmap</CardTitle>
        <CardDescription>
          {totalCompletions} completions across {activeDays} active days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="overflow-x-auto pb-2">
            <div className="min-w-max">
              {/* Month labels */}
              <div className="flex mb-1 pl-8">
                {monthLabels.map((month, i) => (
                  <div
                    key={i}
                    className="text-xs text-muted-foreground"
                    style={{
                      marginLeft: i === 0 ? 0 : `${(month.weekIndex - (i > 0 ? monthLabels[i - 1].weekIndex : 0)) * 14 - 20}px`,
                      width: i === monthLabels.length - 1 ? 'auto' : undefined,
                    }}
                  >
                    {month.label}
                  </div>
                ))}
              </div>

              <div className="flex">
                {/* Day labels */}
                <div className="flex flex-col gap-[2px] mr-2 text-xs text-muted-foreground">
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

                {/* Heatmap grid */}
                <div className="flex gap-[2px]">
                  {weeksData.map((week, weekIndex) => (
                    <div key={weekIndex} className="flex flex-col gap-[2px]">
                      {week.map((day, dayIndex) => {
                        const dateStr = format(day.date, 'yyyy-MM-dd');
                        const level = day.data?.level ?? 0;
                        const count = day.data?.count ?? 0;
                        const isFuture = day.date > new Date();
                        const todayDate = isToday(day.date);

                        return (
                          <Tooltip key={dateStr}>
                            <TooltipTrigger asChild>
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{
                                  delay: weekIndex * 0.01 + dayIndex * 0.005,
                                  duration: 0.2,
                                }}
                                className={cn(
                                  "w-3 h-3 rounded-sm cursor-pointer transition-all hover:ring-2 hover:ring-primary/50",
                                  isFuture ? "bg-muted/30" : LEVEL_COLORS[level],
                                  todayDate && "ring-2 ring-primary"
                                )}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">
                                {format(day.date, 'EEEE, MMMM d, yyyy')}
                              </p>
                              <p className="text-muted-foreground">
                                {isFuture 
                                  ? 'Future date' 
                                  : count === 0 
                                    ? 'No completions' 
                                    : `${count} habit${count !== 1 ? 's' : ''} completed`}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-end gap-2 mt-4 text-xs text-muted-foreground">
                <span>Less</span>
                {LEVEL_COLORS.map((color, i) => (
                  <div
                    key={i}
                    className={cn("w-3 h-3 rounded-sm", color)}
                  />
                ))}
                <span>More</span>
              </div>
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
