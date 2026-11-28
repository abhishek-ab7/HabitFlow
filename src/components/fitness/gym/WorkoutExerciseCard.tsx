'use client';

import { Plus, Search, Sparkles, Timer, Trash2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePomodoroStore } from '@/lib/stores/pomodoro-store';
import type { getProgressiveOverloadHint } from '@/lib/fitness/shared-analytics';
import type { ExerciseLibraryEntry } from '@/lib/fitness/exercise-library';
import type {
  OverloadTargetArgs,
  RemoveSetArgs,
  StartRestArgs,
  UpdateSetArgs,
} from '@/lib/fitness/gym-workout-helpers';
import { cn } from '@/lib/utils';
import type { WorkoutExercise } from '@/lib/types';

function WorkoutSetRow({
  st,
  exIdx,
  setIdx,
  canRemove,
  onUpdateSet,
  onRemoveSet,
}: {
  st: { weightKg: number; reps: number; isWarmup?: boolean };
  exIdx: number;
  setIdx: number;
  canRemove: boolean;
  onUpdateSet: (args: UpdateSetArgs) => void;
  onRemoveSet: (args: RemoveSetArgs) => void;
}) {
  return (
    <div className="grid grid-cols-12 gap-2 items-center">
      <button
        type="button"
        onClick={() => onUpdateSet({ exIdx, setIdx, patch: { isWarmup: !st.isWarmup } })}
        title="Toggle warmup set"
        className={cn(
          'col-span-2 h-8 rounded-lg text-xs font-mono font-bold border transition-colors',
          st.isWarmup ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400' : 'bg-muted/40 border-border text-foreground'
        )}
      >
        {st.isWarmup ? 'W' : `#${setIdx + 1}`}
      </button>
      <Input
        type="number"
        step="0.5"
        min={0}
        aria-label={`Set ${setIdx + 1} weight kg`}
        value={st.weightKg}
        onChange={(e) => onUpdateSet({ exIdx, setIdx, patch: { weightKg: Math.max(0, Number(e.target.value) || 0) } })}
        className="col-span-4 h-8 text-xs font-mono tabular-nums"
      />
      <Input
        type="number"
        min={0}
        aria-label={`Set ${setIdx + 1} reps`}
        value={st.reps}
        onChange={(e) => onUpdateSet({ exIdx, setIdx, patch: { reps: Math.max(0, Number(e.target.value) || 0) } })}
        className="col-span-4 h-8 text-xs font-mono tabular-nums"
      />
      <div className="col-span-2 flex justify-end">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={!canRemove}
          onClick={() => onRemoveSet({ exIdx, setIdx })}
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          aria-label="Remove set"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function WorkoutExerciseCard(props: {
  ex: WorkoutExercise;
  exIdx: number;
  hint?: ReturnType<typeof getProgressiveOverloadHint>;
  onApplyOverload: (args: OverloadTargetArgs) => void;
  onStartRest: (args: StartRestArgs) => void;
  onRemoveExercise: (exIdx: number) => void;
  onUpdateSet: (args: UpdateSetArgs) => void;
  onAddSet: (exIdx: number) => void;
  onRemoveSet: (args: RemoveSetArgs) => void;
}) {
  const { ex, exIdx, hint, onApplyOverload, onStartRest, onRemoveExercise, onUpdateSet, onAddSet, onRemoveSet } = props;
  return (
    <div className="rounded-xl border border-border bg-background p-3.5 space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">{ex.name}</span>
            <Badge variant="outline" className="text-[10px]">{ex.sets.length} sets</Badge>
          </div>
          {hint && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1.5">
              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium">{hint.suggestionText}</span>
              <button
                type="button"
                onClick={() => onApplyOverload({ exIdx, weightKg: hint.recommendedWeightKg, reps: hint.recommendedReps })}
                className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-semibold hover:bg-emerald-700"
              >
                <Sparkles className="h-2.5 w-2.5" /> Apply Target
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {([60, 90, 120] as const).map((secs) => (
            <button
              key={secs}
              type="button"
              onClick={() => onStartRest({ seconds: secs, exerciseName: ex.name })}
              className="px-2 py-1 rounded-lg border border-border bg-muted/40 hover:border-cyan-500 text-[11px] font-mono font-semibold text-foreground"
              title={`Start ${secs}s rest timer`}
            >
              {secs}s
            </button>
          ))}
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onRemoveExercise(exIdx)} aria-label={`Remove ${ex.name}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
          <span className="col-span-2">Set</span>
          <span className="col-span-4">Weight (kg)</span>
          <span className="col-span-4">Reps</span>
          <span className="col-span-2 text-right">Act</span>
        </div>
        {ex.sets.map((st, setIdx) => (
          <WorkoutSetRow
            key={setIdx}
            st={st}
            exIdx={exIdx}
            setIdx={setIdx}
            canRemove={ex.sets.length > 1}
            onUpdateSet={onUpdateSet}
            onRemoveSet={onRemoveSet}
          />
        ))}
      </div>

      <Button type="button" size="sm" variant="ghost" onClick={() => onAddSet(exIdx)} className="h-7 text-xs gap-1 text-primary">
        <Plus className="h-3 w-3" /> Add Set
      </Button>
    </div>
  );
}

export function RestTimerBar({ onStartRest }: { onStartRest: (secs: 60 | 90 | 120) => void }) {
  const timerRunning = usePomodoroStore((s) => s.isRunning);
  const timerMode = usePomodoroStore((s) => s.mode);
  const timerLeft = usePomodoroStore((s) => s.timeLeft);

  return (
    <div className="flex items-center gap-1.5 bg-muted/40 border border-border rounded-xl px-2.5 py-1.5">
      <Timer className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
      <span className="text-[11px] font-medium text-muted-foreground mr-1">
        {timerRunning && timerMode === 'gym_rest' ? `${Math.floor(timerLeft / 60)}:${String(timerLeft % 60).padStart(2, '0')}` : 'Rest:'}
      </span>
      {([60, 90, 120] as const).map((secs) => (
        <button
          key={secs}
          type="button"
          onClick={() => onStartRest(secs)}
          className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-background border border-border hover:border-cyan-500/60 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
        >
          {secs}s
        </button>
      ))}
    </div>
  );
}

export function ExerciseSearchPicker({
  query,
  showSuggestions,
  suggestions,
  onQueryChange,
  onFocus,
  onAddExercise,
}: {
  query: string;
  showSuggestions: boolean;
  suggestions: ExerciseLibraryEntry[];
  onQueryChange: (q: string) => void;
  onFocus: () => void;
  onAddExercise: (entry: string | ExerciseLibraryEntry) => void;
}) {
  return (
    <div className="space-y-2 pt-2 border-t border-border/60">
      <label className="text-xs font-semibold text-foreground block">Add Exercises (Indian Gym Library + Autocomplete)</label>
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={query}
            onFocus={onFocus}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                e.preventDefault();
                onAddExercise(query);
              }
            }}
            placeholder="Search exercise (e.g. Incline Dumbbell Press, Squat, Lat Pulldown)..."
            className="pl-8"
          />
        </div>
        <Button type="button" variant="secondary" disabled={!query.trim()} onClick={() => onAddExercise(query)} className="shrink-0 gap-1">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.slice(0, showSuggestions ? 8 : 5).map((entry) => (
          <button
            key={entry.name}
            type="button"
            onClick={() => onAddExercise(entry)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs text-foreground transition-colors"
          >
            <Plus className="h-3 w-3 text-emerald-500" />
            <span>{entry.name}</span>
            <span className="text-[10px] text-muted-foreground">({entry.muscleGroup})</span>
          </button>
        ))}
      </div>
    </div>
  );
}
