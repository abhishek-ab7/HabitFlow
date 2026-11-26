'use client';

import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Dumbbell,
  Flame,
  Plus,
  Search,
  Sparkles,
  Timer,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useFitnessStore } from '@/lib/stores/fitness';
import { usePomodoroStore } from '@/lib/stores/pomodoro-store';
import { useFeedback } from '@/hooks/use-feedback';
import { getProgressiveOverloadHint } from '@/lib/fitness/shared-analytics';
import {
  searchExerciseLibrary,
  type ExerciseLibraryEntry,
} from '@/lib/fitness/exercise-library';
import { cn } from '@/lib/utils';
import type { WorkoutExercise, WorkoutSession, WorkoutType } from '@/lib/types';

interface GymWorkoutTabProps {
  selectedDate: string;
  userId: string;
}

const SPLIT_PRESETS: Array<{
  id: string;
  label: string;
  workoutType: WorkoutType;
  defaultTitle: string;
  defaultMins: number;
}> = [
  { id: 'push', label: 'Push', workoutType: 'push', defaultTitle: 'Push Workout', defaultMins: 50 },
  { id: 'pull', label: 'Pull', workoutType: 'pull', defaultTitle: 'Pull Workout', defaultMins: 50 },
  { id: 'legs', label: 'Legs', workoutType: 'legs', defaultTitle: 'Leg Day', defaultMins: 55 },
  { id: 'upper', label: 'Upper', workoutType: 'upper', defaultTitle: 'Upper Body', defaultMins: 50 },
  { id: 'lower', label: 'Lower', workoutType: 'lower', defaultTitle: 'Lower Body', defaultMins: 50 },
  { id: 'full_body', label: 'Full Body', workoutType: 'full_body', defaultTitle: 'Full Body Workout', defaultMins: 55 },
  { id: 'walk', label: 'Walk', workoutType: 'cardio', defaultTitle: 'Brisk Walk / Cardio', defaultMins: 30 },
  { id: 'custom', label: 'Custom', workoutType: 'strength', defaultTitle: 'Custom Workout', defaultMins: 45 },
];

function computeSessionVolume(session: WorkoutSession): number {
  return (session.exercises || []).reduce(
    (sum, ex) =>
      sum +
      (ex.sets || []).reduce(
        (sSum, st) => (st.isWarmup ? sSum : sSum + (st.weightKg || 0) * (st.reps || 0)),
        0
      ),
    0
  );
}

function WorkoutExerciseCard(props: {
  ex: WorkoutExercise;
  exIdx: number;
  hint?: ReturnType<typeof getProgressiveOverloadHint>;
  onApplyOverload: (exIdx: number, weightKg: number, reps: number) => void;
  onStartRest: (seconds: 60 | 90 | 120, exerciseName: string) => void;
  onRemoveExercise: (exIdx: number) => void;
  onUpdateSet: (exIdx: number, setIdx: number, patch: Partial<{ weightKg: number; reps: number; isWarmup: boolean }>) => void;
  onAddSet: (exIdx: number) => void;
  onRemoveSet: (exIdx: number, setIdx: number) => void;
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
                onClick={() => onApplyOverload(exIdx, hint.recommendedWeightKg, hint.recommendedReps)}
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
              onClick={() => onStartRest(secs, ex.name)}
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
          <div key={setIdx} className="grid grid-cols-12 gap-2 items-center">
            <button
              type="button"
              onClick={() => onUpdateSet(exIdx, setIdx, { isWarmup: !st.isWarmup })}
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
              onChange={(e) => onUpdateSet(exIdx, setIdx, { weightKg: Math.max(0, Number(e.target.value) || 0) })}
              className="col-span-4 h-8 text-xs font-mono tabular-nums"
            />
            <Input
              type="number"
              min={0}
              aria-label={`Set ${setIdx + 1} reps`}
              value={st.reps}
              onChange={(e) => onUpdateSet(exIdx, setIdx, { reps: Math.max(0, Number(e.target.value) || 0) })}
              className="col-span-4 h-8 text-xs font-mono tabular-nums"
            />
            <div className="col-span-2 flex justify-end">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={ex.sets.length <= 1}
                onClick={() => onRemoveSet(exIdx, setIdx)}
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                aria-label="Remove set"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button type="button" size="sm" variant="ghost" onClick={() => onAddSet(exIdx)} className="h-7 text-xs gap-1 text-primary">
        <Plus className="h-3 w-3" /> Add Set
      </Button>
    </div>
  );
}

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
            <p className="text-xs text-muted-foreground">
              {session.date} · {session.durationMinutes}m
              {session.exercises.length > 0 ? ` · ${session.exercises.length} exercises` : ''}
              {vol > 0 ? ` · ${Math.round(vol).toLocaleString()} kg vol` : ''}
              {session.rpe ? ` · RPE ${session.rpe}` : ''}
            </p>
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

function WorkoutHistoryList({
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

function useGymWorkoutState(selectedDate: string, userId: string) {
  const workoutSessions = useFitnessStore((s) => s.workoutSessions);
  const addWorkoutSession = useFitnessStore((s) => s.addWorkoutSession);
  const deleteWorkoutSession = useFitnessStore((s) => s.deleteWorkoutSession);
  const startGymRestTimer = usePomodoroStore((s) => s.startGymRestTimer);

  const [selectedPresetId, setSelectedPresetId] = useState<string>('push');
  const [workoutType, setWorkoutType] = useState<WorkoutType>('push');
  const [title, setTitle] = useState<string>('Push Workout');
  const [durationMinutes, setDurationMinutes] = useState<number>(50);
  const [rpe, setRpe] = useState<number>(8);
  const [notes, setNotes] = useState<string>('');
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [exerciseQuery, setExerciseQuery] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const feedback = useFeedback();

  const suggestions = useMemo(() => searchExerciseLibrary(exerciseQuery, workoutType).slice(0, 8), [exerciseQuery, workoutType]);
  const activeSessions = useMemo(() => workoutSessions.filter((w) => !w.deletedAt), [workoutSessions]);
  const totalVolumeKg = useMemo(
    () => exercises.reduce((sum, ex) => sum + ex.sets.reduce((s, st) => (st.isWarmup ? s : s + Math.max(0, st.weightKg) * Math.max(0, st.reps)), 0), 0),
    [exercises]
  );

  const overloadHintsByExercise = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getProgressiveOverloadHint>>();
    for (const ex of exercises) {
      if (!map.has(ex.name)) map.set(ex.name, getProgressiveOverloadHint(workoutSessions, ex.name));
    }
    return map;
  }, [workoutSessions, exercises]);

  const handleSelectSplit = (preset: (typeof SPLIT_PRESETS)[number]) => {
    feedback.tap();
    setSelectedPresetId(preset.id);
    setWorkoutType(preset.workoutType);
    setTitle(preset.defaultTitle);
    setDurationMinutes(preset.defaultMins);
  };

  const handleAddExercise = (entryOrName: ExerciseLibraryEntry | string) => {
    const name = typeof entryOrName === 'string' ? entryOrName.trim() : entryOrName.name;
    if (!name) return;
    const hint = getProgressiveOverloadHint(workoutSessions, name);
    const defaultWeight = hint?.lastTopWeightKg ?? (typeof entryOrName === 'string' ? 20 : entryOrName.defaultWeightKg);
    const defaultReps = hint?.recommendedReps ?? (typeof entryOrName === 'string' ? 10 : entryOrName.defaultReps);
    const setsCount = hint?.lastSetsCount ?? (typeof entryOrName === 'string' ? 3 : entryOrName.defaultSets);
    setExercises((prev) => [
      ...prev,
      { name, sets: Array.from({ length: Math.max(1, Math.min(5, setsCount)) }, () => ({ weightKg: defaultWeight, reps: defaultReps, isWarmup: false })) },
    ]);
    setExerciseQuery('');
    setShowSuggestions(false);
  };

  const handleUpdateSet = (exIdx: number, setIdx: number, patch: Partial<{ weightKg: number; reps: number; isWarmup: boolean }>) => {
    setExercises((prev) =>
      prev.map((ex, i) => (i === exIdx ? { ...ex, sets: ex.sets.map((st, j) => (j === setIdx ? { ...st, ...patch } : st)) } : ex))
    );
  };

  const handleAddSet = (exIdx: number) => {
    feedback.complete();
    setExercises((prev) =>
      prev.map((ex, i) => (i === exIdx ? { ...ex, sets: [...ex.sets, { ...(ex.sets[ex.sets.length - 1] || { weightKg: 20, reps: 10, isWarmup: false }) }] } : ex))
    );
  };

  const handleRemoveSet = (exIdx: number, setIdx: number) => {
    setExercises((prev) =>
      prev.map((ex, i) => (i === exIdx && ex.sets.length > 1 ? { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) } : ex))
    );
  };

  const handleApplyOverloadTarget = (exIdx: number, weightKg: number, reps: number) => {
    setExercises((prev) =>
      prev.map((ex, i) => (i === exIdx ? { ...ex, sets: ex.sets.map((st) => (st.isWarmup ? st : { ...st, weightKg, reps })) } : ex))
    );
    toast.success(`Applied target ${weightKg} kg × ${reps} reps`);
  };

  const handleStartRest = (seconds: 60 | 90 | 120, exerciseName?: string) => {
    feedback.toggle(true);
    startGymRestTimer(seconds, exerciseName);
    toast.success(`Rest timer started: ${seconds}s`);
  };

  const handleSaveWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    feedback.milestone();
    setIsSaving(true);
    try {
      const saved = await addWorkoutSession(
        { date: selectedDate, title: title.trim() || 'Workout', workoutType, durationMinutes: Math.max(5, Math.round(durationMinutes || 30)), exercises, rpe, notes: notes.trim() || null, source: 'manual' },
        userId
      );
      toast.success(`Saved ${saved.title} (${saved.durationMinutes}m)`, {
        description: exercises.length > 0 ? `${exercises.length} exercises · ${Math.round(totalVolumeKg).toLocaleString()} kg volume` : 'Matching Exercise habit auto-ticked',
      });
      setExercises([]);
      setNotes('');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    selectedPresetId, title, setTitle, durationMinutes, setDurationMinutes, rpe, setRpe, notes, setNotes,
    exercises, exerciseQuery, setExerciseQuery, showSuggestions, setShowSuggestions, expandedSessionId, setExpandedSessionId,
    isSaving, suggestions, activeSessions, totalVolumeKg, overloadHintsByExercise,
    handleSelectSplit, handleAddExercise, handleRemoveExercise: (idx: number) => setExercises((p) => p.filter((_, i) => i !== idx)),
    handleUpdateSet, handleAddSet, handleRemoveSet, handleApplyOverloadTarget, handleStartRest, handleSaveWorkout,
    deleteWorkoutSession: (id: string) => { deleteWorkoutSession(id); toast.success('Workout removed'); },
  };
}

function RestTimerBar({ onStartRest }: { onStartRest: (secs: 60 | 90 | 120) => void }) {
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

function ExerciseSearchPicker({
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

export function GymWorkoutTab({ selectedDate, userId }: GymWorkoutTabProps) {
  const g = useGymWorkoutState(selectedDate, userId);

  return (
    <div className="space-y-5">
      <form onSubmit={g.handleSaveWorkout} className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-emerald-500" />
              Log Gym / Training Session ({selectedDate})
            </h3>
            <p className="text-xs text-muted-foreground">Split presets, progressive overload targets &amp; mobile rest timer</p>
          </div>
          <RestTimerBar onStartRest={(secs) => g.handleStartRest(secs, g.exercises[g.exercises.length - 1]?.name)} />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SPLIT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => g.handleSelectSplit(preset)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                g.selectedPresetId === preset.id ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Session Title</label>
            <Input value={g.title} onChange={(e) => g.setTitle(e.target.value)} placeholder="e.g. Push Day — Chest & Shoulders" required />
          </div>
          <div className="sm:col-span-3 space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Duration (min)</label>
            <Input type="number" min={5} max={300} value={g.durationMinutes} onChange={(e) => g.setDurationMinutes(Number(e.target.value) || 30)} />
          </div>
          <div className="sm:col-span-3 space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Flame className="h-3 w-3 text-amber-500" /> Effort (RPE 1-10)</label>
            <Input type="number" min={1} max={10} value={g.rpe} onChange={(e) => g.setRpe(Math.min(10, Math.max(1, Number(e.target.value) || 7)))} />
          </div>
        </div>

        <ExerciseSearchPicker
          query={g.exerciseQuery}
          showSuggestions={g.showSuggestions}
          suggestions={g.suggestions}
          onFocus={() => g.setShowSuggestions(true)}
          onQueryChange={(q) => {
            g.setExerciseQuery(q);
            g.setShowSuggestions(true);
          }}
          onAddExercise={g.handleAddExercise}
        />

        {g.exercises.length > 0 && (
          <div className="space-y-3">
            {g.exercises.map((ex, exIdx) => (
              <WorkoutExerciseCard
                key={`${ex.name}-${exIdx}`}
                ex={ex}
                exIdx={exIdx}
                hint={g.overloadHintsByExercise.get(ex.name)}
                onApplyOverload={g.handleApplyOverloadTarget}
                onStartRest={g.handleStartRest}
                onRemoveExercise={g.handleRemoveExercise}
                onUpdateSet={g.handleUpdateSet}
                onAddSet={g.handleAddSet}
                onRemoveSet={g.handleRemoveSet}
              />
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60">
          <div className="flex-1 min-w-[200px]">
            <Input value={g.notes} onChange={(e) => g.setNotes(e.target.value)} placeholder="Optional session notes (pump, PRs, joints)..." className="h-9 text-xs" />
          </div>
          <div className="flex items-center gap-3">
            {g.totalVolumeKg > 0 && (
              <span className="text-xs font-mono text-muted-foreground">
                Vol: <strong className="text-foreground">{Math.round(g.totalVolumeKg).toLocaleString()} kg</strong>
              </span>
            )}
            <Button type="submit" disabled={g.isSaving} className="gap-1.5">
              <Check className="h-4 w-4" />
              {g.isSaving ? 'Saving...' : 'Save Workout'}
            </Button>
          </div>
        </div>
      </form>

      <WorkoutHistoryList
        activeSessions={g.activeSessions}
        expandedSessionId={g.expandedSessionId}
        onToggleExpand={(id) => g.setExpandedSessionId(g.expandedSessionId === id ? null : id)}
        onDelete={g.deleteWorkoutSession}
      />
    </div>
  );
}
