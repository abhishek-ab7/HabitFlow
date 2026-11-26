'use client';

import React from 'react';
import { Check, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task } from '@/lib/types';

export function WeeklyReviewMitPicker(params: {
  selectedMitIds: string[];
  activeMitDate: string;
  todayIso: string;
  mitTargetMode: 'today' | 'next_monday';
  setMitTargetMode: React.Dispatch<React.SetStateAction<'today' | 'next_monday'>>;
  candidateTasks: Task[];
  onToggleMit: (taskId: string) => void;
}) {
  return (
    <div data-testid="sunday-truth-4" className="border border-primary/25 bg-primary/5 rounded-2xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
            <Target className="w-4 h-4" />
            4. Interactive Next Week&apos;s Top 3 Priorities ({params.selectedMitIds.length}/3)
          </div>
          <p className="text-[11px] text-muted-foreground">
            Select up to 3 must-do MITs for <span className="font-mono font-semibold text-foreground">{params.activeMitDate}</span>
          </p>
        </div>
        <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded-lg border border-border text-[11px]">
          <button
            type="button"
            onClick={() => params.setMitTargetMode('today')}
            className={cn('px-2 py-1 rounded-md font-medium', params.mitTargetMode === 'today' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
          >
            Today ({params.todayIso})
          </button>
          <button
            type="button"
            onClick={() => params.setMitTargetMode('next_monday')}
            className={cn('px-2 py-1 rounded-md font-medium', params.mitTargetMode === 'next_monday' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
          >
            Next Monday
          </button>
        </div>
      </div>

      {params.candidateTasks.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No pending tasks in queue. Add tasks under /tasks to lock your Top 3 MITs.</p>
      ) : (
        <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
          {params.candidateTasks.slice(0, 10).map((task) => {
            const rankIdx = params.selectedMitIds.indexOf(task.id);
            const isPicked = rankIdx !== -1;
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => params.onToggleMit(task.id)}
                data-testid={`sunday-mit-option-${task.id}`}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left text-xs transition-colors',
                  isPicked ? 'border-primary bg-primary/10 text-foreground font-semibold' : 'border-border bg-background/70 text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className={cn('w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0', isPicked ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                    {isPicked ? `#${rankIdx + 1}` : <Check className="w-3 h-3 opacity-30" />}
                  </span>
                  <span className="truncate">{task.title}</span>
                </span>
                <span className="text-[10px] font-mono uppercase shrink-0">{task.priority}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
