'use client';

import type React from 'react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useFitnessStore } from '@/lib/stores/fitness';
import { usePomodoroStore } from '@/lib/stores/pomodoro-store';
import { useFeedback } from '@/hooks/use-feedback';
import { getProgressiveOverloadHint } from '@/lib/fitness/shared-analytics';
import {
  searchExerciseLibrary,
  type ExerciseLibraryEntry,
} from '@/lib/fitness/exercise-library';
import type { WorkoutExercise, WorkoutType } from '@/lib/types';
import {
  appendWorkoutSet,
  applyOverloadTargetToExercises,
  applyWorkoutSetUpdate,
  buildInitialExerciseSets,
  computeExercisesVolume,
  type OverloadTargetArgs,
  type RemoveSetArgs,
  removeWorkoutSet,
  SPLIT_PRESETS,
  type SplitPreset,
  type StartRestArgs,
  type UpdateSetArgs,
} from '@/lib/fitness/gym-workout-helpers';

export function useGymWorkoutController({
  selectedDate,
  userId,
}: {
  selectedDate: string;
  userId: string;
}) {
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

  const suggestions = useMemo(
    () => searchExerciseLibrary(exerciseQuery, workoutType).slice(0, 8),
    [exerciseQuery, workoutType]
  );
  const activeSessions = useMemo(
    () => workoutSessions.filter((w) => !w.deletedAt),
    [workoutSessions]
  );
  const totalVolumeKg = useMemo(() => computeExercisesVolume(exercises), [exercises]);

  const overloadHintsByExercise = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getProgressiveOverloadHint>>();
    for (const ex of exercises) {
      if (!map.has(ex.name)) map.set(ex.name, getProgressiveOverloadHint(workoutSessions, ex.name));
    }
    return map;
  }, [workoutSessions, exercises]);

  const handleSelectSplit = (preset: SplitPreset) => {
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
    const sets = buildInitialExerciseSets(entryOrName, hint);
    setExercises((prev) => [...prev, { name, sets }]);
    setExerciseQuery('');
    setShowSuggestions(false);
  };

  const handleUpdateSet = (args: UpdateSetArgs) => {
    setExercises((prev) => applyWorkoutSetUpdate(prev, args));
  };

  const handleAddSet = (exIdx: number) => {
    feedback.complete();
    setExercises((prev) => appendWorkoutSet(prev, exIdx));
  };

  const handleRemoveSet = (args: RemoveSetArgs) => {
    setExercises((prev) => removeWorkoutSet(prev, args));
  };

  const handleApplyOverloadTarget = (args: OverloadTargetArgs) => {
    setExercises((prev) => applyOverloadTargetToExercises(prev, args));
    toast.success(`Applied target ${args.weightKg} kg × ${args.reps} reps`);
  };

  const handleStartRest = ({ seconds, exerciseName }: StartRestArgs) => {
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
        {
          date: selectedDate,
          title: title.trim() || 'Workout',
          workoutType,
          durationMinutes: Math.max(5, Math.round(durationMinutes || 30)),
          exercises,
          rpe,
          notes: notes.trim() || null,
          source: 'manual',
        },
        userId
      );
      toast.success(`Saved ${saved.title} (${saved.durationMinutes}m)`, {
        description:
          exercises.length > 0
            ? `${exercises.length} exercises · ${Math.round(totalVolumeKg).toLocaleString()} kg volume`
            : 'Matching Exercise habit auto-ticked',
      });
      setExercises([]);
      setNotes('');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    splitPresets: SPLIT_PRESETS,
    selectedPresetId, title, setTitle, durationMinutes, setDurationMinutes,
    rpe, setRpe, notes, setNotes, exercises, exerciseQuery, setExerciseQuery,
    showSuggestions, setShowSuggestions, expandedSessionId, setExpandedSessionId,
    isSaving, suggestions, activeSessions, totalVolumeKg, overloadHintsByExercise,
    handleSelectSplit, handleAddExercise,
    handleRemoveExercise: (idx: number) => setExercises((p) => p.filter((_, i) => i !== idx)),
    handleUpdateSet, handleAddSet, handleRemoveSet, handleApplyOverloadTarget,
    handleStartRest, handleSaveWorkout,
    deleteWorkoutSession: (id: string) => {
      deleteWorkoutSession(id);
      toast.success('Workout removed');
    },
  };
}
