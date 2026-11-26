import type { WorkoutType } from '@/lib/types';
import type { UniversalBioAction, UniversalWorkoutAction } from '../parser-types';

type SegmentText = string;
type LowerSegmentText = string;
type IsoDate = string;

function parseStepsPatch(lower: LowerSegmentText, patch: Partial<UniversalBioAction>): boolean {
  const stepsMatch = lower.match(/(\+)?\s*(\d+(?:\.\d+)?)\s*(k)?\s*steps?\b/i);
  if (!stepsMatch) return false;
  const val = Math.round(parseFloat(stepsMatch[2]) * (stepsMatch[3] ? 1000 : 1));
  if (stepsMatch[1] === '+') {
    patch.stepsDelta = val;
  } else {
    patch.stepsExact = val;
  }
  return true;
}

function parseWaterLitresOrGlasses(lower: LowerSegmentText, patch: Partial<UniversalBioAction>): boolean {
  const waterLMatch =
    lower.match(/(?:water|paani|pani)\s*(\+)?\s*(\d+(?:\.\d+)?)\s*l(?:iters?|itres?)?\b/i) ||
    lower.match(/(\+)?\s*(\d+(?:\.\d+)?)\s*l(?:iters?|itres?)?\s*(?:water|paani|pani)\b/i);
  if (waterLMatch) {
    patch.waterDeltaMl = Math.round(parseFloat(waterLMatch[2]) * 1000);
    return true;
  }
  const glassMatch = lower.match(/(\d+)\s*glass(?:es)?\s*(?:of\s*)?(?:water|paani|pani)?/i);
  if (!glassMatch) return false;
  patch.waterDeltaMl = parseInt(glassMatch[1], 10) * 250;
  return true;
}

function parseWaterPatch(lower: LowerSegmentText, patch: Partial<UniversalBioAction>): boolean {
  const waterMlMatch =
    lower.match(/(\+)?\s*(\d+(?:\.\d+)?)\s*ml(?:\s*(?:water|paani|pani))?/i) ||
    lower.match(/(?:water|paani|pani)\s*(\+)?\s*(\d+(?:\.\d+)?)\s*ml/i);
  if (waterMlMatch) {
    patch.waterDeltaMl = Math.round(parseFloat(waterMlMatch[2]));
    return true;
  }
  return parseWaterLitresOrGlasses(lower, patch);
}

function parseSleepPatch(lower: string, patch: Partial<UniversalBioAction>): boolean {
  const sleepMatch =
    lower.match(/\b(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)\s*(?:of\s*)?(?:sleep|neend)\b/i) ||
    lower.match(/\b(?:sleep|slept|neend)\s*(?:for\s*)?(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)?\b/i);
  if (!sleepMatch) return false;
  const hrs = parseFloat(sleepMatch[1]);
  if (hrs <= 0 || hrs > 18) return false;
  patch.sleepHours = hrs;
  return true;
}

const ENERGY_CUES: Array<{ pattern: RegExp; level: number }> = [
  { pattern: /\bexhausted\b|\bdrained\b|\bthaka\b/, level: 1 },
  { pattern: /\btired\b|\blow\s*energy\b|\bsleepy\b/, level: 2 },
  { pattern: /\benergized\b|\bhigh\s*energy\b|\bpumped\b/, level: 5 },
  { pattern: /\bfresh\b/, level: 4 },
];

function parseEnergyPatch(lower: string, patch: Partial<UniversalBioAction>): boolean {
  const energyNumMatch = lower.match(/\b(?:energy|enrg|josh)\s*[:=-]?\s*([1-5])(?:\s*\/\s*5)?\b/i);
  if (energyNumMatch) {
    patch.energyLevel = parseInt(energyNumMatch[1], 10);
    return true;
  }
  const cue = ENERGY_CUES.find((c) => c.pattern.test(lower));
  if (!cue) return false;
  patch.energyLevel = cue.level;
  return true;
}

function parseBoundedNumber(
  lower: string,
  patterns: RegExp[],
  min: number,
  max: number
): number | null {
  for (const re of patterns) {
    const m = lower.match(re);
    if (!m) continue;
    const val = parseFloat(m[1]);
    if (val >= min && val <= max) return val;
  }
  return null;
}

const WEIGHT_PATTERNS = [
  /\b(?:weight|wazan|wt)\s*[:=-]?\s*(\d{2,3}(?:\.\d{1,2})?)\s*(?:kg)?\b/i,
  /\b(\d{2,3}(?:\.\d{1,2})?)\s*kg\b/i,
];

const WAIST_PATTERNS = [
  /\b(?:waist|kamar)\s*[:=-]?\s*(\d{2}(?:\.\d{1,2})?)\s*(?:in|inch|inches|")?\b/i,
  /\b(\d{2}(?:\.\d{1,2})?)\s*(?:in|inch|inches)\s*(?:waist|kamar)\b/i,
];

function parseWeightPatch(lower: string, patch: Partial<UniversalBioAction>): boolean {
  const kg = parseBoundedNumber(lower, WEIGHT_PATTERNS, 30, 250);
  if (kg === null) return false;
  patch.weightKg = kg;
  return true;
}

function parseWaistPatch(lower: string, patch: Partial<UniversalBioAction>): boolean {
  const inches = parseBoundedNumber(lower, WAIST_PATTERNS, 20, 65);
  if (inches === null) return false;
  patch.waistInches = inches;
  return true;
}

export function extractBioFromSegment(segment: SegmentText): Partial<UniversalBioAction> | null {
  const lower = segment.toLowerCase();
  const patch: Partial<UniversalBioAction> = {};
  const extractors = [
    parseStepsPatch,
    parseWaterPatch,
    parseSleepPatch,
    parseEnergyPatch,
    parseWeightPatch,
    parseWaistPatch,
  ];
  let matched = false;
  for (const fn of extractors) {
    if (fn(lower, patch)) matched = true;
  }
  return matched ? patch : null;
}

const WORKOUT_CUE_REGEX =
  /\b(workout|gym|push|pull|legs|upper|lower|full\s*body|cardio|hiit|mobility|yoga|stretch|strength|training|run|running|jog|cycling|swim|badminton|cricket|football)\b/i;
const WORKOUT_EXCLUDE_REGEX =
  /\b(fees?|membership|subscription|shoes|belt|bag|shake|pre[-\s]?workout\s+(?:₹|rs|\d{3,}))\b/i;

const WORKOUT_TYPE_RULES: Array<{ pattern: RegExp; workoutType: WorkoutType; title: string }> = [
  { pattern: /\bpush\b/i, workoutType: 'push', title: 'Push Workout' },
  { pattern: /\bpull\b/i, workoutType: 'pull', title: 'Pull Workout' },
  { pattern: /\blegs?\b/i, workoutType: 'legs', title: 'Leg Day Workout' },
  { pattern: /\bupper\b/i, workoutType: 'upper', title: 'Upper Body Workout' },
  { pattern: /\blower\b/i, workoutType: 'lower', title: 'Lower Body Workout' },
  { pattern: /\bfull\s*body\b/i, workoutType: 'full_body', title: 'Full Body Workout' },
  { pattern: /\b(cardio|run|running|jog|cycling|treadmill|hiit)\b/i, workoutType: 'cardio', title: 'Cardio Session' },
  { pattern: /\b(mobility|yoga|stretch)\b/i, workoutType: 'mobility', title: 'Mobility & Stretch' },
  { pattern: /\b(badminton|cricket|football|swim|sports)\b/i, workoutType: 'sports', title: 'Sports Session' },
];

function resolveWorkoutDuration(lower: string): number {
  const minMatch = lower.match(/\b(\d+)\s*(?:m|min|mins|minutes?)\b/i);
  if (minMatch) return Math.max(5, Math.min(300, parseInt(minMatch[1], 10)));
  const hrMatch = lower.match(/\b(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)\b/i);
  if (hrMatch) return Math.max(5, Math.min(300, Math.round(parseFloat(hrMatch[1]) * 60)));
  return 45;
}

export function extractWorkoutFromSegment(segment: SegmentText, date: IsoDate): UniversalWorkoutAction | null {
  const lower = segment.toLowerCase();
  if (!WORKOUT_CUE_REGEX.test(lower) || WORKOUT_EXCLUDE_REGEX.test(lower)) return null;

  const matchedRule = WORKOUT_TYPE_RULES.find((r) => r.pattern.test(lower));
  const workoutType: WorkoutType = matchedRule?.workoutType ?? 'strength';
  const title = matchedRule?.title ?? 'Strength Workout';
  const durationMinutes = resolveWorkoutDuration(lower);
  const calRate = workoutType === 'cardio' || workoutType === 'sports' ? 8 : 6;

  return {
    id: 'workout_0',
    kind: 'workout',
    enabled: true,
    title,
    workoutType,
    durationMinutes,
    estimatedCaloriesBurned: Math.round(durationMinutes * calRate),
    exercises: [],
    date,
  };
}
