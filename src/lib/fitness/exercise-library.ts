import type { WorkoutType } from '@/lib/types';

export interface ExerciseLibraryEntry {
  name: string;
  split: WorkoutType;
  muscleGroup: string;
  defaultSets: number;
  defaultReps: number;
  defaultWeightKg: number;
  aliases?: string[];
}

export const STARTER_INDIAN_GYM_LIBRARY: ExerciseLibraryEntry[] = [
  // PUSH (Chest, Shoulders, Triceps)
  { name: 'Flat Barbell Bench Press', split: 'push', muscleGroup: 'Chest', defaultSets: 3, defaultReps: 8, defaultWeightKg: 40, aliases: ['bench press', 'flat bench'] },
  { name: 'Incline Dumbbell Press', split: 'push', muscleGroup: 'Upper Chest', defaultSets: 3, defaultReps: 10, defaultWeightKg: 15, aliases: ['incline db press', 'incline press'] },
  { name: 'Flat Dumbbell Press', split: 'push', muscleGroup: 'Chest', defaultSets: 3, defaultReps: 10, defaultWeightKg: 17.5, aliases: ['db bench'] },
  { name: 'Pec Deck Machine Fly', split: 'push', muscleGroup: 'Chest', defaultSets: 3, defaultReps: 12, defaultWeightKg: 35, aliases: ['chest fly', 'butterfly'] },
  { name: 'Overhead Barbell Press', split: 'push', muscleGroup: 'Shoulders', defaultSets: 3, defaultReps: 8, defaultWeightKg: 30, aliases: ['ohp', 'shoulder press', 'military press'] },
  { name: 'Seated Dumbbell Shoulder Press', split: 'push', muscleGroup: 'Shoulders', defaultSets: 3, defaultReps: 10, defaultWeightKg: 12.5, aliases: ['db shoulder press'] },
  { name: 'Dumbbell Lateral Raises', split: 'push', muscleGroup: 'Side Delts', defaultSets: 3, defaultReps: 15, defaultWeightKg: 7.5, aliases: ['lateral raise', 'side raise'] },
  { name: 'Tricep Rope Pushdown', split: 'push', muscleGroup: 'Triceps', defaultSets: 3, defaultReps: 12, defaultWeightKg: 20, aliases: ['rope pushdown', 'tricep pushdown'] },
  { name: 'Overhead Cable Tricep Extension', split: 'push', muscleGroup: 'Triceps', defaultSets: 3, defaultReps: 12, defaultWeightKg: 15, aliases: ['overhead tricep'] },
  { name: 'Parallel Bar Dips', split: 'push', muscleGroup: 'Chest / Triceps', defaultSets: 3, defaultReps: 10, defaultWeightKg: 0, aliases: ['dips', 'chest dips'] },
  { name: 'Push-Ups', split: 'push', muscleGroup: 'Chest', defaultSets: 3, defaultReps: 15, defaultWeightKg: 0, aliases: ['pushups', 'push ups'] },

  // PULL (Back, Rear Delts, Biceps)
  { name: 'Lat Pulldown', split: 'pull', muscleGroup: 'Lats', defaultSets: 3, defaultReps: 10, defaultWeightKg: 45, aliases: ['pulldown', 'wide grip lat pulldown'] },
  { name: 'Pull-Ups', split: 'pull', muscleGroup: 'Lats', defaultSets: 3, defaultReps: 8, defaultWeightKg: 0, aliases: ['pullups', 'chin ups'] },
  { name: 'Barbell Bent-Over Row', split: 'pull', muscleGroup: 'Mid Back', defaultSets: 3, defaultReps: 8, defaultWeightKg: 40, aliases: ['barbell row', 'bent over row'] },
  { name: 'Single-Arm Dumbbell Row', split: 'pull', muscleGroup: 'Lats', defaultSets: 3, defaultReps: 10, defaultWeightKg: 17.5, aliases: ['db row', 'one arm row'] },
  { name: 'Seated Cable Row', split: 'pull', muscleGroup: 'Mid Back', defaultSets: 3, defaultReps: 10, defaultWeightKg: 40, aliases: ['cable row', 'seated row'] },
  { name: 'Face Pulls', split: 'pull', muscleGroup: 'Rear Delts', defaultSets: 3, defaultReps: 15, defaultWeightKg: 15, aliases: ['cable face pull'] },
  { name: 'Barbell Bicep Curl', split: 'pull', muscleGroup: 'Biceps', defaultSets: 3, defaultReps: 10, defaultWeightKg: 20, aliases: ['bicep curl', 'ez bar curl'] },
  { name: 'Incline Dumbbell Curl', split: 'pull', muscleGroup: 'Biceps', defaultSets: 3, defaultReps: 12, defaultWeightKg: 10, aliases: ['incline curl'] },
  { name: 'Dumbbell Hammer Curl', split: 'pull', muscleGroup: 'Biceps / Forearms', defaultSets: 3, defaultReps: 12, defaultWeightKg: 12.5, aliases: ['hammer curl'] },

  // LEGS (Quads, Hamstrings, Glutes, Calves)
  { name: 'Barbell Back Squat', split: 'legs', muscleGroup: 'Quads / Glutes', defaultSets: 3, defaultReps: 8, defaultWeightKg: 60, aliases: ['squat', 'squats', 'back squat'] },
  { name: 'Leg Press', split: 'legs', muscleGroup: 'Quads', defaultSets: 3, defaultReps: 12, defaultWeightKg: 100, aliases: ['45 degree leg press'] },
  { name: 'Romanian Deadlift (RDL)', split: 'legs', muscleGroup: 'Hamstrings / Glutes', defaultSets: 3, defaultReps: 10, defaultWeightKg: 50, aliases: ['rdl', 'romanian deadlift'] },
  { name: 'Walking Dumbbell Lunges', split: 'legs', muscleGroup: 'Quads / Glutes', defaultSets: 3, defaultReps: 12, defaultWeightKg: 12.5, aliases: ['lunges', 'bulgarian split squat'] },
  { name: 'Seated / Lying Leg Curl', split: 'legs', muscleGroup: 'Hamstrings', defaultSets: 3, defaultReps: 12, defaultWeightKg: 35, aliases: ['leg curl', 'hamstring curl'] },
  { name: 'Leg Extension', split: 'legs', muscleGroup: 'Quads', defaultSets: 3, defaultReps: 12, defaultWeightKg: 40, aliases: ['quad extension'] },
  { name: 'Standing Calf Raises', split: 'legs', muscleGroup: 'Calves', defaultSets: 4, defaultReps: 15, defaultWeightKg: 40, aliases: ['calf raise', 'calf raises'] },

  // COMPOUND / FULL BODY / UPPER / LOWER
  { name: 'Conventional Deadlift', split: 'lower', muscleGroup: 'Posterior Chain', defaultSets: 3, defaultReps: 5, defaultWeightKg: 80, aliases: ['deadlift'] },
  { name: 'Goblet Squat', split: 'full_body', muscleGroup: 'Legs', defaultSets: 3, defaultReps: 12, defaultWeightKg: 17.5, aliases: ['db squat'] },
  { name: 'Kettlebell / Dumbbell Farmer Walk', split: 'full_body', muscleGroup: 'Core / Grip', defaultSets: 3, defaultReps: 30, defaultWeightKg: 20, aliases: ['farmers walk'] },
  { name: 'Hanging Leg Raises', split: 'full_body', muscleGroup: 'Core', defaultSets: 3, defaultReps: 12, defaultWeightKg: 0, aliases: ['leg raises', 'abs'] },
  { name: 'Cable Crunches', split: 'full_body', muscleGroup: 'Core', defaultSets: 3, defaultReps: 15, defaultWeightKg: 25, aliases: ['abs crunch'] },
  { name: 'Plank', split: 'full_body', muscleGroup: 'Core', defaultSets: 3, defaultReps: 60, defaultWeightKg: 0, aliases: ['core plank'] },

  // CARDIO / WALK
  { name: 'Incline Treadmill Walk', split: 'cardio', muscleGroup: 'Cardio / NEAT', defaultSets: 1, defaultReps: 20, defaultWeightKg: 0, aliases: ['treadmill', 'incline walk'] },
  { name: 'Brisk Outdoor Walk', split: 'cardio', muscleGroup: 'Cardio / NEAT', defaultSets: 1, defaultReps: 30, defaultWeightKg: 0, aliases: ['walk', 'morning walk'] },
  { name: 'Stationary Cycling', split: 'cardio', muscleGroup: 'Cardio', defaultSets: 1, defaultReps: 20, defaultWeightKg: 0, aliases: ['cycling', 'spin bike'] },
];

const SPLIT_GROUPS: Partial<Record<WorkoutType, WorkoutType[]>> = {
  upper: ['push', 'pull', 'upper'],
  lower: ['legs', 'lower'],
};

function entryMatchesSplit(entry: ExerciseLibraryEntry, preferredSplit?: WorkoutType): boolean {
  if (!preferredSplit) return true;
  if (preferredSplit === 'strength' || preferredSplit === 'full_body') return true;
  const allowed = SPLIT_GROUPS[preferredSplit];
  return allowed ? allowed.includes(entry.split) : entry.split === preferredSplit;
}

function matchesExerciseQuery(entry: ExerciseLibraryEntry, q: string): boolean {
  if (entry.name.toLowerCase().includes(q)) return true;
  if (entry.muscleGroup.toLowerCase().includes(q)) return true;
  return (entry.aliases || []).some((a) => a.toLowerCase().includes(q));
}

export function searchExerciseLibrary(
  query: string,
  preferredSplit?: WorkoutType
): ExerciseLibraryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    const splitMatched = STARTER_INDIAN_GYM_LIBRARY.filter((e) => entryMatchesSplit(e, preferredSplit));
    return splitMatched.length > 0 ? splitMatched : STARTER_INDIAN_GYM_LIBRARY;
  }

  return STARTER_INDIAN_GYM_LIBRARY.filter((entry) => matchesExerciseQuery(entry, q)).sort((a, b) => {
    const aSplit = entryMatchesSplit(a, preferredSplit) ? 0 : 1;
    const bSplit = entryMatchesSplit(b, preferredSplit) ? 0 : 1;
    return aSplit !== bSplit ? aSplit - bSplit : a.name.localeCompare(b.name);
  });
}
