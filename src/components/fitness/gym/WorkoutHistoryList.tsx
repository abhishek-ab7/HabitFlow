'use client';

import { ChevronDown, ChevronUp, Dumbbell, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { buildSessionSubtitle, computeSessionVolume } from '@/lib/fitness/gym-workout-helpers';
import type { WorkoutSession } from '@/lib/types';

function WorkoutSessionRow({
  session,
  isExpanded,
  onToggleExpand,
  onDelete,
}: {
  session: WorkoutSession;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const vol = computeSessionVolume(session);
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => onToggleExpand(session.id)} className="flex-1 text-left flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground truncate">{session.title}</p>
              <Badge variant="outline" className="text-[10px] capitalize">{session.workoutType.replace('_', ' ')}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{buildSessionSubtitle(session, vol)}</p>
          </div>
          {session.exercises.length > 0 &&
            (isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />)}
        </button>
        <Button type="button" size="sm" variant="ghost" className="text-destructive shrink-0" onClick={() => onDelete(session.id)} aria-label={`Delete ${session.title}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {isExpanded && session.exercises.length > 0 && (
        <div className="mt-2.5 rounded-xl bg-muted/30 p-3 space-y-2 text-xs">
          {session.exercises.map((ex, i) => (
            <div key={`${ex.name}-${i}`} className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-foreground">{ex.name}</span>
              <span className="font-mono text-muted-foreground">
                {ex.sets.map((st) => (st.weightKg > 0 ? `${st.weightKg}kg×${st.reps}${st.isWarmup ? '(W)' : ''}` : `${st.reps} reps`)).join(' · ')}
              </span>
            </div>
          ))}
          {session.notes && <p className="text-muted-foreground pt-1 border-t border-border/50">Notes: {session.notes}</p>}
        </div>
      )}
    </div>
  );
}

export function WorkoutHistoryList({
  activeSessions,
  expandedSessionId,
  onToggleExpand,
  onDelete,
}: {
  activeSessions: WorkoutSession[];
  expandedSessionId: string | null;
  onToggleExpand: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Recent Workout History ({activeSessions.length})</h3>
        <p className="text-xs text-muted-foreground">Tap a session to inspect exercises &amp; working sets</p>
      </div>

      {activeSessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 py-10 px-4 text-center">
          <Dumbbell className="h-7 w-7 text-muted-foreground mx-auto mb-2 opacity-60" />
          <p className="text-sm font-medium text-foreground">No workouts logged yet</p>
          <p className="text-xs text-muted-foreground mt-1">Pick a split preset above or use 10s Capture: &quot;push workout 45m&quot;</p>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {activeSessions.slice(0, 20).map((session) => (
            <WorkoutSessionRow
              key={session.id}
              session={session}
              isExpanded={expandedSessionId === session.id}
              onToggleExpand={onToggleExpand}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
