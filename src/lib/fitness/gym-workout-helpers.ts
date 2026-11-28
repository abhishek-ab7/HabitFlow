import type { getProgressiveOverloadHint } from '@/lib/fitness/shared-analytics';
import type { ExerciseLibraryEntry } from '@/lib/fitness/exercise-library';
import type { WorkoutExercise, WorkoutSession, WorkoutType } from '@/lib/types';

export interface SplitPreset {
  id: string;
  label: string;
  workoutType: WorkoutType;
  defaultTitle: string;
  defaultMins: number;
}

export const SPLIT_PRESETS: SplitPreset[] = [
  { id: 'push', label: 'Push', workoutType: 'push', defaultTitle: 'Push Workout', defaultMins: 50 },
  { id: 'pull', label: 'Pull', workoutType: 'pull', defaultTitle: 'Pull Workout', defaultMins: 50 },
  { id: 'legs', label: 'Legs', workoutType: 'legs', defaultTitle: 'Leg Day', defaultMins: 55 },
  { id: 'upper', label: 'Upper', workoutType: 'upper', defaultTitle: 'Upper Body', defaultMins: 50 },
  { id: 'lower', label: 'Lower', workoutType: 'lower', defaultTitle: 'Lower Body', defaultMins: 50 },
  { id: 'full_body', label: 'Full Body', workoutType: 'full_body', defaultTitle: 'Full Body Workout', defaultMins: 55 },
  { id: 'walk', label: 'Walk', workoutType: 'cardio', defaultTitle: 'Brisk Walk / Cardio', defaultMins: 30 },
  { id: 'custom', label: 'Custom', workoutType: 'strength', defaultTitle: 'Custom Workout', defaultMins: 45 },
];

export interface OverloadTargetArgs {
  exIdx: number;
  weightKg: number;
  reps: number;
}

export interface UpdateSetArgs {
  exIdx: number;
  setIdx: number;
  patch: Partial<{ weightKg: number; reps: number; isWarmup: boolean }>;
}

export interface RemoveSetArgs {
  exIdx: number;
  setIdx: number;
}

export interface StartRestArgs {
  seconds: 60 | 90 | 120;
  exerciseName?: string;
}

export function computeExercisesVolume(exercises: WorkoutExercise[]): number {
  return exercises.reduce(
    (sum, ex) =>
      sum +
      (ex.sets || []).reduce(
        (sSum, st) => (st.isWarmup ? sSum : sSum + Math.max(0, st.weightKg || 0) * Math.max(0, st.reps || 0)),
        0
      ),
    0
  );
}

export function computeSessionVolume(session: WorkoutSession): number {
  return computeExercisesVolume(session.exercises || []);
}

export function buildSessionSubtitle(session: WorkoutSession, vol: number): string {
  const parts = [`${session.date} · ${session.durationMinutes}m`];
  if (session.exercises.length > 0) parts.push(`${session.exercises.length} exercises`);
  if (vol > 0) parts.push(`${Math.round(vol).toLocaleString()} kg vol`);
  if (session.rpe) parts.push(`RPE ${session.rpe}`);
  return parts.join(' · ');
}

export function buildInitialExerciseSets(
  entryOrName: ExerciseLibraryEntry | string,
  hint: ReturnType<typeof getProgressiveOverloadHint>
) {
  const isCustom = typeof entryOrName === 'string';
  const defaultWeight = hint?.lastTopWeightKg ?? (isCustom ? 20 : entryOrName.defaultWeightKg);
  const defaultReps = hint?.recommendedReps ?? (isCustom ? 10 : entryOrName.defaultReps);
  const setsCount = hint?.lastSetsCount ?? (isCustom ? 3 : entryOrName.defaultSets);
  return Array.from({ length: Math.max(1, Math.min(5, setsCount)) }, () => ({
    weightKg: defaultWeight,
    reps: defaultReps,
    isWarmup: false,
  }));
}

function mapExerciseAt(
  exercises: WorkoutExercise[],
  exIdx: number,
  transform: (ex: WorkoutExercise) => WorkoutExercise
): WorkoutExercise[] {
  return exercises.map((ex, i) => (i === exIdx ? transform(ex) : ex));
}

export function applyWorkoutSetUpdate(
  exercises: WorkoutExercise[],
  { exIdx, setIdx, patch }: UpdateSetArgs
): WorkoutExercise[] {
  return mapExerciseAt(exercises, exIdx, (ex) => ({
    ...ex,
    sets: ex.sets.map((st, j) => (j === setIdx ? { ...st, ...patch } : st)),
  }));
}

export function appendWorkoutSet(exercises: WorkoutExercise[], exIdx: number): WorkoutExercise[] {
  return mapExerciseAt(exercises, exIdx, (ex) => ({
    ...ex,
    sets: [...ex.sets, { ...(ex.sets[ex.sets.length - 1] || { weightKg: 20, reps: 10, isWarmup: false }) }],
  }));
}

export function removeWorkoutSet(
  exercises: WorkoutExercise[],
  { exIdx, setIdx }: RemoveSetArgs
): WorkoutExercise[] {
  return mapExerciseAt(exercises, exIdx, (ex) =>
    ex.sets.length > 1 ? { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) } : ex
  );
}

export function applyOverloadTargetToExercises(
  exercises: WorkoutExercise[],
  { exIdx, weightKg, reps }: OverloadTargetArgs
): WorkoutExercise[] {
  return mapExerciseAt(exercises, exIdx, (ex) => ({
    ...ex,
    sets: ex.sets.map((st) => (st.isWarmup ? st : { ...st, weightKg, reps })),
  }));
}
