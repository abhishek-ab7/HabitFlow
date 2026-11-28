'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { BarChart3, ChevronRight, Play, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatINR } from '@/lib/stores/finance-store';
import { cn } from '@/lib/utils';
import { useWeeklyReviewController } from './weekly-review/useWeeklyReviewController';

const WeeklyReviewModal = dynamic(
  () => import('./weekly-review/WeeklyReviewModal').then((m) => ({ default: m.WeeklyReviewModal })),
  { ssr: false }
);

function WeeklyConsistencyStrip({
  last7Days,
  completions,
  activeHabitsCount,
  weeklyCompletionRate,
}: {
  last7Days: ReturnType<typeof useWeeklyReviewController>['last7Days'];
  completions: ReturnType<typeof useWeeklyReviewController>['completions'];
  activeHabitsCount: number;
  weeklyCompletionRate: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
        <span>Weekly Consistency</span>
        <span className="font-mono tabular-nums text-foreground">{weeklyCompletionRate}%</span>
      </div>
      <div className="flex gap-1.5 justify-between">
        {last7Days.map((day) => {
          const dayComps = completions.filter((c) => c.date === day.dateStr && c.completed && c.status !== 'frozen').length;
          const isDayComplete = activeHabitsCount > 0 && dayComps >= activeHabitsCount;
          return (
            <div key={day.dateStr} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={cn(
                  'w-full h-8 rounded-md border flex items-center justify-center text-[10px] font-mono font-bold transition-all',
                  isDayComplete ? 'bg-success/20 text-success border-success/30' : dayComps > 0 ? 'bg-primary/12 text-primary border-primary/25' : 'bg-muted/40 border-transparent text-muted-foreground/40'
                )}
              >
                {dayComps}
              </div>
              <span className="text-[9px] font-bold text-muted-foreground/70">{day.dayName}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WeeklyReviewWidget() {
  const vm = useWeeklyReviewController();
  const [modalMounted, setModalMounted] = useState(false);
  if (vm.showFullReview && !modalMounted) setModalMounted(true);
  const activeHabitsCount = vm.habits.filter((h) => !h.archived).length;

  return (
    <>
      <Card className="surface-card shadow-none overflow-hidden h-full flex flex-col justify-between tour-weekly-review-widget">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <BarChart3 className="w-4 h-4 text-primary" />
              5-Min Sunday Reset
            </CardTitle>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">4 Truths</span>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col justify-between space-y-4">
          <WeeklyConsistencyStrip
            last7Days={vm.last7Days}
            completions={vm.completions}
            activeHabitsCount={activeHabitsCount}
            weeklyCompletionRate={vm.stats.weeklyCompletionRate}
          />

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-xl border border-border/70 bg-background/60 px-2.5 py-2">
              <span className="text-muted-foreground block text-[10px]">Safe/Day</span>
              <span className="font-mono font-bold text-foreground">{formatINR(vm.fourTruths.truth1Finance.safeToSpendDaily)}</span>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/60 px-2.5 py-2">
              <span className="text-muted-foreground block text-[10px]">7d Workouts</span>
              <span className="font-mono font-bold text-foreground">{vm.fourTruths.truth2BodyWorkouts.workouts7dCount} sessions</span>
            </div>
          </div>

          {vm.isSunday ? (
            <div className="bg-accent/50 border border-primary/25 rounded-xl p-3.5 text-center space-y-2.5">
              <div className="text-xs font-bold text-primary uppercase tracking-wider flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Sunday Reset Ready
              </div>
              <p className="text-xs text-muted-foreground max-w-[240px] mx-auto leading-relaxed">
                Review the 4 Truths (Money, Body, Junk Triggers) &amp; lock next week&apos;s Top 3 MITs.
              </p>
              <Button size="sm" onClick={vm.handleOpenReview} data-testid="launch-sunday-reset-btn" className="w-full font-semibold text-xs py-2 rounded-xl">
                Launch Sunday Reset <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2 text-center">
              <p className="text-[11px] text-muted-foreground leading-relaxed">Sunday ritual unlocks weekly, or preview &amp; update MITs anytime.</p>
              <Button type="button" variant="outline" size="sm" onClick={vm.handleOpenReview} data-testid="preview-sunday-reset-btn" className="w-full font-semibold text-xs rounded-xl gap-1.5">
                <Play className="w-3 h-3 text-primary" /> Run / Preview Reset
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {modalMounted && (
        <WeeklyReviewModal
          open={vm.showFullReview}
          onClose={() => vm.setShowFullReview(false)}
          isFitnessEnabled={vm.isFitnessEnabled}
          fourTruths={vm.fourTruths}
          last7Days={vm.last7Days}
          weeklyCompletionRate={vm.stats.weeklyCompletionRate}
          bestHabitName={vm.stats.bestHabit?.habit.name ?? null}
          bestHabitRate={vm.stats.bestHabit?.rate ?? null}
          getMoodForDate={vm.getMoodForDate}
          selectedMitIds={vm.selectedMitIds}
          activeMitDate={vm.activeMitDate}
          todayIso={vm.todayIso}
          mitTargetMode={vm.mitTargetMode}
          setMitTargetMode={vm.setMitTargetMode}
          candidateTasks={vm.candidateTasks}
          onToggleMit={vm.toggleMitSelection}
          savingMits={vm.savingMits}
          onSaveMits={vm.handleSaveWeeklyMits}
        />
      )}
    </>
  );
}
