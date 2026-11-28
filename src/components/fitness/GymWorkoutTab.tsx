'use client';

import { Check, Clock, Dumbbell, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useGymWorkoutController } from './gym/useGymWorkoutController';
import {
  ExerciseSearchPicker,
  RestTimerBar,
  WorkoutExerciseCard,
} from './gym/WorkoutExerciseCard';
import { WorkoutHistoryList } from './gym/WorkoutHistoryList';

interface GymWorkoutTabProps {
  selectedDate: string;
  userId: string;
}

export function GymWorkoutTab({ selectedDate, userId }: GymWorkoutTabProps) {
  const g = useGymWorkoutController({ selectedDate, userId });

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
          <RestTimerBar onStartRest={(secs) => g.handleStartRest({ seconds: secs, exerciseName: g.exercises[g.exercises.length - 1]?.name })} />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {g.splitPresets.map((preset) => (
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
