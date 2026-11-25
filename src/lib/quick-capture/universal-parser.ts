import { addDays, getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import {
  estimateHinglishFoodMacros,
  matchMealTemplate,
} from '@/lib/fitness/meal-estimator';
import type {
  MealTemplate,
  MealType,
  Priority,
  SupplementInventory,
  WorkoutExercise,
  WorkoutType,
} from '@/lib/types';

export interface UniversalAccountRef {
  id: string;
  name: string;
  type: string;
}

export interface UniversalCategoryRef {
  id: string;
  name: string;
  slug: string;
  type: string;
}

export interface UniversalParserContext {
  todayIso?: string;
  accounts?: UniversalAccountRef[];
  categories?: UniversalCategoryRef[];
  mealTemplates?: MealTemplate[];
  supplements?: SupplementInventory[];
}

export interface UniversalExpenseAction {
  id: string;
  kind: 'expense';
  enabled: boolean;
  title: string;
  amount: number;
  txType: 'expense' | 'income' | 'investment';
  accountId?: string;
  accountName: string;
  categoryId?: string;
  categorySlug: string;
  categoryName: string;
  date: string;
  isJunkFood: boolean;
  linkDietMealId?: string;
}

export interface UniversalMealAction {
  id: string;
  kind: 'meal';
  enabled: boolean;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealType: MealType;
  isJunk: boolean;
  templateId?: string | null;
  date: string;
  linkedExpenseActionId?: string;
}

export interface UniversalWorkoutAction {
  id: string;
  kind: 'workout';
  enabled: boolean;
  title: string;
  workoutType: WorkoutType;
  durationMinutes: number;
  estimatedCaloriesBurned: number;
  exercises: WorkoutExercise[];
  date: string;
}

export interface UniversalBioAction {
  id: string;
  kind: 'bio';
  enabled: boolean;
  date: string;
  stepsDelta?: number;
  stepsExact?: number;
  waterDeltaMl?: number;
  sleepHours?: number;
  energyLevel?: number;
  weightKg?: number;
  waistInches?: number;
}

export interface UniversalSupplementAction {
  id: string;
  kind: 'supplement';
  enabled: boolean;
  supplementId?: string;
  supplementName: string;
  servings: number;
  date: string;
}

export interface UniversalTaskAction {
  id: string;
  kind: 'task';
  enabled: boolean;
  title: string;
  priority: Priority;
  isUrgent?: boolean;
  domainTag?: 'health' | 'finance' | 'fitness' | 'general';
  dueDate?: string;
  dueTime?: string;
  estimateMinutes?: number;
}

export type UniversalCaptureAction =
  | UniversalExpenseAction
  | UniversalMealAction
  | UniversalWorkoutAction
  | UniversalBioAction
  | UniversalSupplementAction
  | UniversalTaskAction;

export interface UniversalParseResult {
  rawInput: string;
  actions: UniversalCaptureAction[];
  detectedDate: string;
  summary: string;
}

function makeId(prefix: string, idx: number): string {
  return `${prefix}_${idx}_${Math.random().toString(36).slice(2, 7)}`;
}

function resolveCaptureDate(text: string, todayIso: string): string {
  const lower = text.toLowerCase();
  const explicitIso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (explicitIso) return explicitIso[1];
  if (/\byesterday\b|\bkal\s+raat\b|\blast\s+night\b/.test(lower)) {
    return addDays(todayIso, -1);
  }
  if (/\btomorrow\b|\bkal\b/.test(lower) && /\b(task|remind|pay|call|book|meet|buy)\b/.test(lower)) {
    return addDays(todayIso, 1);
  }
  return todayIso;
}

const KNOWN_COMBO_REGEX =
  /\b(oats\s*\+\s*milk|chicken\s*\+\s*rice|dal\s*\+\s*chawal|dal\s*\+\s*rice|roti\s*\+\s*sabzi|bread\s*\+\s*butter|eggs?\s*\+\s*toast)\b/gi;

function splitCompoundSegments(raw: string, templates: MealTemplate[]): string[] {
  let working = raw.trim();
  const placeholders: Array<{ token: string; value: string }> = [];

  // Protect multi-word templates containing '+' (like "Oats + Milk", "Chicken + Rice")
  for (const tpl of templates) {
    if (!tpl.deletedAt && tpl.name.includes('+')) {
      const escaped = tpl.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
      const re = new RegExp(escaped, 'gi');
      working = working.replace(re, (m) => {
        const token = `__COMBO_${placeholders.length}__`;
        placeholders.push({ token, value: m });
        return token;
      });
    }
  }

  working = working.replace(KNOWN_COMBO_REGEX, (m) => {
    const token = `__COMBO_${placeholders.length}__`;
    placeholders.push({ token, value: m });
    return token;
  });

  const roughParts = working
    .split(/[\n,;]+|\s+\+\s+|\s+&\s+|\s+\band\b\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);

  return roughParts.map((part) => {
    let restored = part;
    for (const ph of placeholders) {
      restored = restored.replace(ph.token, ph.value);
    }
    return restored.trim();
  });
}

function resolveAccount(
  segmentLower: string,
  accounts: UniversalAccountRef[]
): { accountId?: string; accountName: string; matchedExplicitly: boolean } {
  // 1. Exact/partial name match against user's accounts (e.g., "Slice", "Axis")
  for (const acc of accounts) {
    const cleanName = acc.name.toLowerCase();
    const firstWord = cleanName.split(/\s+/)[0];
    if (cleanName && segmentLower.includes(cleanName)) {
      return { accountId: acc.id, accountName: acc.name, matchedExplicitly: true };
    }
    if (firstWord && firstWord.length >= 3 && new RegExp(`\\b${firstWord}\\b`, 'i').test(segmentLower)) {
      return { accountId: acc.id, accountName: acc.name, matchedExplicitly: true };
    }
  }

  // 2. Payment type keyword hints
  const hintMap: Array<{ pattern: RegExp; type: string; fallbackLabel: string }> = [
    { pattern: /\b(slice|axis|hdfc|icici|sbi|cc|credit\s*card|card)\b/i, type: 'credit_card', fallbackLabel: 'Credit Card' },
    { pattern: /\b(upi|gpay|phonepe|paytm|bhim)\b/i, type: 'upi', fallbackLabel: 'UPI' },
    { pattern: /\bcash\b/i, type: 'cash', fallbackLabel: 'Cash' },
    { pattern: /\b(bank|neft|imps|debit)\b/i, type: 'bank', fallbackLabel: 'Bank' },
    { pattern: /\bwallet\b/i, type: 'wallet', fallbackLabel: 'Wallet' },
  ];

  for (const h of hintMap) {
    if (h.pattern.test(segmentLower)) {
      const byType = accounts.find((a) => a.type === h.type);
      return {
        accountId: byType?.id,
        accountName: byType?.name || h.fallbackLabel,
        matchedExplicitly: true,
      };
    }
  }

  const defaultAcc =
    accounts.find((a) => a.type === 'upi') ||
    accounts.find((a) => a.type === 'bank') ||
    accounts[0];

  return {
    accountId: defaultAcc?.id,
    accountName: defaultAcc?.name || 'UPI',
    matchedExplicitly: false,
  };
}

function resolveExpenseCategory(
  lower: string,
  categories: UniversalCategoryRef[],
  isJunkFood: boolean,
  isFood: boolean
): { categoryId?: string; categorySlug: string; categoryName: string } {
  const findByPattern = (re: RegExp) =>
    categories.find((c) => re.test(`${c.name} ${c.slug}`));

  if (isJunkFood) {
    const junk = findByPattern(/junk/i) || findByPattern(/food|dining/i);
    return {
      categoryId: junk?.id,
      categorySlug: junk?.slug || 'junk-food',
      categoryName: junk?.name || 'Junk Food',
    };
  }

  if (/\b(whey|creatine|vitamin|vit\s*d|b12|magnesium|omega|fish\s*oil|supplement|medicine|doctor|pharmacy|gym)\b/i.test(lower)) {
    const suppCat =
      findByPattern(/supplement|health|medical/i) ||
      findByPattern(/fitness/i);
    return {
      categoryId: suppCat?.id,
      categorySlug: suppCat?.slug || 'health-supplements',
      categoryName: suppCat?.name || 'Health & Supplements',
    };
  }

  if (isFood || /\b(swiggy|zomato|restaurant|dinner|lunch|breakfast|thali|coffee|chai|cafe)\b/i.test(lower)) {
    const foodCat = findByPattern(/food|dining/i);
    return {
      categoryId: foodCat?.id,
      categorySlug: foodCat?.slug || 'food-dining',
      categoryName: foodCat?.name || 'Food & Dining',
    };
  }

  if (/\b(uber|ola|rapido|auto|metro|bus|train|petrol|diesel|fuel|cab)\b/i.test(lower)) {
    const transportCat = findByPattern(/transport|travel|commute/i);
    return {
      categoryId: transportCat?.id,
      categorySlug: transportCat?.slug || 'transport-travel',
      categoryName: transportCat?.name || 'Transport',
    };
  }

  if (/\b(zepto|blinkit|instamart|grocery|groceries|bigbasket|dmart|milk|sabzi|fruit)\b/i.test(lower)) {
    const groceryCat = findByPattern(/grocer/i);
    return {
      categoryId: groceryCat?.id,
      categorySlug: groceryCat?.slug || 'groceries-household',
      categoryName: groceryCat?.name || 'Groceries',
    };
  }

  if (/\b(bill|recharge|wifi|jio|airtel|electricity|rent|emi)\b/i.test(lower)) {
    const billsCat = findByPattern(/bill|utilit|housing|rent/i);
    return {
      categoryId: billsCat?.id,
      categorySlug: billsCat?.slug || 'bills-utilities',
      categoryName: billsCat?.name || 'Bills & Utilities',
    };
  }

  const fallback =
    categories.find((c) => c.type === 'expense' || c.type === 'both') ||
    categories[0];

  return {
    categoryId: fallback?.id,
    categorySlug: fallback?.slug || 'other-expense',
    categoryName: fallback?.name || 'General Expense',
  };
}

function extractBioFromSegment(segment: string): Partial<UniversalBioAction> | null {
  const lower = segment.toLowerCase();
  const patch: Partial<UniversalBioAction> = {};
  let matched = false;

  // Steps: "9000 steps", "+2000 steps", "9k steps"
  const stepsMatch = lower.match(/(\+)?\s*(\d+(?:\.\d+)?)\s*(k)?\s*steps?\b/i);
  if (stepsMatch) {
    const rawVal = parseFloat(stepsMatch[2]) * (stepsMatch[3] ? 1000 : 1);
    const val = Math.round(rawVal);
    if (stepsMatch[1] === '+') {
      patch.stepsDelta = val;
    } else {
      patch.stepsExact = val;
    }
    matched = true;
  }

  // Water: "+500ml water", "water 750ml", "paani 1.5l", "2 glasses water"
  const waterMlMatch =
    lower.match(/(\+)?\s*(\d+(?:\.\d+)?)\s*ml(?:\s*(?:water|paani|pani))?/i) ||
    lower.match(/(?:water|paani|pani)\s*(\+)?\s*(\d+(?:\.\d+)?)\s*ml/i);
  const waterLMatch =
    lower.match(/(?:water|paani|pani)\s*(\+)?\s*(\d+(?:\.\d+)?)\s*l(?:iters?|itres?)?\b/i) ||
    lower.match(/(\+)?\s*(\d+(?:\.\d+)?)\s*l(?:iters?|itres?)?\s*(?:water|paani|pani)\b/i);
  const glassMatch = lower.match(/(\d+)\s*glass(?:es)?\s*(?:of\s*)?(?:water|paani|pani)?/i);

  if (waterMlMatch) {
    const numStr = waterMlMatch[2];
    patch.waterDeltaMl = Math.round(parseFloat(numStr));
    matched = true;
  } else if (waterLMatch) {
    patch.waterDeltaMl = Math.round(parseFloat(waterLMatch[2]) * 1000);
    matched = true;
  } else if (glassMatch) {
    patch.waterDeltaMl = parseInt(glassMatch[1], 10) * 250;
    matched = true;
  }

  // Sleep: "7.5h sleep", "slept 7 hrs", "neend 6.5"
  const sleepMatch =
    lower.match(/\b(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)\s*(?:of\s*)?(?:sleep|neend)\b/i) ||
    lower.match(/\b(?:sleep|slept|neend)\s*(?:for\s*)?(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)?\b/i);
  if (sleepMatch) {
    const hrs = parseFloat(sleepMatch[1]);
    if (hrs > 0 && hrs <= 18) {
      patch.sleepHours = hrs;
      matched = true;
    }
  }

  // Energy 1-5: "energy 4", "energy 4/5", "josh 5", "tired", "exhausted", "fresh"
  const energyNumMatch = lower.match(/\b(?:energy|enrg|josh)\s*[:=-]?\s*([1-5])(?:\s*\/\s*5)?\b/i);
  if (energyNumMatch) {
    patch.energyLevel = parseInt(energyNumMatch[1], 10);
    matched = true;
  } else if (/\bexhausted\b|\bdrained\b|\bthaka\b/.test(lower)) {
    patch.energyLevel = 1;
    matched = true;
  } else if (/\btired\b|\blow\s*energy\b|\bsleepy\b/.test(lower)) {
    patch.energyLevel = 2;
    matched = true;
  } else if (/\benergized\b|\bhigh\s*energy\b|\bpumped\b/.test(lower)) {
    patch.energyLevel = 5;
    matched = true;
  } else if (/\bfresh\b/.test(lower)) {
    patch.energyLevel = 4;
    matched = true;
  }

  // Weight: "weight 74.2", "74.2 kg", "wazan 73.8"
  const weightMatch =
    lower.match(/\b(?:weight|wazan|wt)\s*[:=-]?\s*(\d{2,3}(?:\.\d{1,2})?)\s*(?:kg)?\b/i) ||
    lower.match(/\b(\d{2,3}(?:\.\d{1,2})?)\s*kg\b/i);
  if (weightMatch) {
    const kg = parseFloat(weightMatch[1]);
    if (kg >= 30 && kg <= 250) {
      patch.weightKg = kg;
      matched = true;
    }
  }

  // Waist: "waist 32.5", "kamar 33", "32.5 inches waist"
  const waistMatch =
    lower.match(/\b(?:waist|kamar)\s*[:=-]?\s*(\d{2}(?:\.\d{1,2})?)\s*(?:in|inch|inches|")?\b/i) ||
    lower.match(/\b(\d{2}(?:\.\d{1,2})?)\s*(?:in|inch|inches)\s*(?:waist|kamar)\b/i);
  if (waistMatch) {
    const inches = parseFloat(waistMatch[1]);
    if (inches >= 20 && inches <= 65) {
      patch.waistInches = inches;
      matched = true;
    }
  }

  return matched ? patch : null;
}

function extractWorkoutFromSegment(
  segment: string,
  date: string
): UniversalWorkoutAction | null {
  const lower = segment.toLowerCase();
  const hasWorkoutCue =
    /\b(workout|gym|push|pull|legs|upper|lower|full\s*body|cardio|hiit|mobility|yoga|stretch|strength|training|run|running|jog|cycling|swim|badminton|cricket|football)\b/i.test(
      lower
    );
  if (!hasWorkoutCue) return null;

  // Exclude non-workout phrases like "gym fees 800", "gym shoes", "pre workout 1500"
  if (/\b(fees?|membership|subscription|shoes|belt|bag|shake|pre[-\s]?workout\s+(?:₹|rs|\d{3,}))\b/i.test(lower)) {
    return null;
  }

  let workoutType: WorkoutType = 'strength';
  let title = 'Strength Workout';

  if (/\bpush\b/i.test(lower)) {
    workoutType = 'push';
    title = 'Push Workout';
  } else if (/\bpull\b/i.test(lower)) {
    workoutType = 'pull';
    title = 'Pull Workout';
  } else if (/\blegs?\b/i.test(lower)) {
    workoutType = 'legs';
    title = 'Leg Day Workout';
  } else if (/\bupper\b/i.test(lower)) {
    workoutType = 'upper';
    title = 'Upper Body Workout';
  } else if (/\blower\b/i.test(lower)) {
    workoutType = 'lower';
    title = 'Lower Body Workout';
  } else if (/\bfull\s*body\b/i.test(lower)) {
    workoutType = 'full_body';
    title = 'Full Body Workout';
  } else if (/\b(cardio|run|running|jog|cycling|treadmill|hiit)\b/i.test(lower)) {
    workoutType = 'cardio';
    title = 'Cardio Session';
  } else if (/\b(mobility|yoga|stretch)\b/i.test(lower)) {
    workoutType = 'mobility';
    title = 'Mobility & Stretch';
  } else if (/\b(badminton|cricket|football|swim|sports)\b/i.test(lower)) {
    workoutType = 'sports';
    title = 'Sports Session';
  }

  let durationMinutes = 45;
  const minMatch = lower.match(/\b(\d+)\s*(?:m|min|mins|minutes?)\b/i);
  const hrMatch = lower.match(/\b(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)\b/i);
  if (minMatch) {
    durationMinutes = Math.max(5, Math.min(300, parseInt(minMatch[1], 10)));
  } else if (hrMatch) {
    durationMinutes = Math.max(5, Math.min(300, Math.round(parseFloat(hrMatch[1]) * 60)));
  }

  const calRate = workoutType === 'cardio' || workoutType === 'sports' ? 8 : 6;
  return {
    id: makeId('workout', 0),
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

function extractAmountAndCleanSegment(
  segment: string,
  accounts: UniversalAccountRef[]
): {
  amount: number | null;
  accountInfo: { accountId?: string; accountName: string; matchedExplicitly: boolean };
  cleanedTitle: string;
} {
  const lower = segment.toLowerCase();
  const accountInfo = resolveAccount(lower, accounts);

  // Check currency-prefixed / suffixed amounts first
  const explicitCurrency =
    segment.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    segment.match(/\b([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr|rupees|bucks)\b/i);

  let amount: number | null = null;
  if (explicitCurrency) {
    amount = parseFloat(explicitCurrency[1].replace(/,/g, ''));
  } else {
    // Strip bio/food-count/time units so "4 eggs", "45m", "9000 steps", "74.2 kg" don't look like currency
    const stripped = segment
      .replace(/\b\d+(?:\.\d+)?\s*(?:steps?|ml|l|liters?|litres?|kg|kgs|cm|in|inch|inches|h|hr|hrs|hours?|m|min|mins|minutes?|cal|kcal|g|gm|gms|eggs?|anda|ande|rotis?|chapatis?|scoops?|cups?|bowls?|glasses?)\b/gi, ' ')
      .replace(/\b[1-5]\s*\/\s*5\b/g, ' ');

    const bareNumber = stripped.match(/\b(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\b/);
    if (bareNumber) {
      const candidate = parseFloat(bareNumber[1].replace(/,/g, ''));
      const hasExpenseContext =
        accountInfo.matchedExplicitly ||
        candidate >= 10 ||
        /\b(spent|paid|expense|bill|cost|price|bought|order|swiggy|zomato|momo|momos|chai|samosa|auto|uber|ola|petrol)\b/i.test(
          lower
        );
      if (hasExpenseContext && candidate > 0) {
        amount = candidate;
      }
    }
  }

  let cleanedTitle = segment
    .replace(/(?:₹|rs\.?|inr)\s*[\d,]+(?:\.\d{1,2})?/gi, ' ')
    .replace(/\b[\d,]+(?:\.\d{1,2})?\s*(?:rs\.?|inr|rupees|bucks)\b/gi, ' ');

  if (amount !== null) {
    const amtRegex = new RegExp(`\\b${String(amount).replace('.', '\\.')}\\b`, 'i');
    cleanedTitle = cleanedTitle.replace(amtRegex, ' ');
  }

  // Remove account hints from title
  cleanedTitle = cleanedTitle
    .replace(/\b(via|on|using|from|with|by)\b/gi, ' ')
    .replace(/\b(slice|axis|hdfc|icici|sbi|cc|credit\s*card|upi|gpay|phonepe|paytm|cash|wallet|bank)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (accountInfo.matchedExplicitly && accountInfo.accountName) {
    const firstWord = accountInfo.accountName.split(/\s+/)[0];
    if (firstWord && firstWord.length >= 3) {
      cleanedTitle = cleanedTitle
        .replace(new RegExp(`\\b${firstWord}\\b`, 'gi'), ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  const titleCased = cleanedTitle
    ? cleanedTitle.charAt(0).toUpperCase() + cleanedTitle.slice(1)
    : 'Expense';

  return { amount, accountInfo, cleanedTitle: titleCased };
}

const FOOD_CUES_REGEX =
  /\b(eggs?|anda|ande|oats|oatmeal|daliya|chicken|rice|murgh|dahi|curd|yogurt|whey|protein\s*shake|guava|amrud|amrood|chai|tea|coffee|paneer|roti|chapati|dal|sabzi|thali|khichdi|poha|upma|idli|dosa|milk|doodh|banana|kela|momos?|pizza|burger|samosa|kachori|vada\s*pav|pakora|chowmein|noodles|maggi|roll|shawarma|frankie|biryani|fries|chips|kurkure|ice\s*cream|pastry|cake|chocolate|cold\s*drink|coke|pepsi|sprite|milkshake|chole\s*bhature|pav\s*bhaji|chaat|pani\s*puri|golgappa|sandwich|toast|omelette|omlette|paratha|salad)\b/i;

const SUPPLEMENT_KEYWORDS = [
  { pattern: /\bcreatine\b/i, name: 'Creatine Monohydrate' },
  { pattern: /\bmagnesium\b/i, name: 'Magnesium' },
  { pattern: /\bvit(?:amin)?\s*d3?\b/i, name: 'Vitamin D3' },
  { pattern: /\b(?:vit(?:amin)?\s*)?b12\b/i, name: 'Vitamin B12' },
  { pattern: /\b(omega|fish\s*oil)\b/i, name: 'Omega-3 Fish Oil' },
  { pattern: /\bashwagandha\b/i, name: 'Ashwagandha' },
  { pattern: /\bzinc\b/i, name: 'Zinc' },
  { pattern: /\bmultivitamin\b/i, name: 'Multivitamin' },
];

export function parseUniversalCapture(
  rawInput: string,
  context: UniversalParserContext = {}
): UniversalParseResult {
  const input = (rawInput || '').trim();
  const todayIso = context.todayIso || getLocalIsoDate();
  const detectedDate = resolveCaptureDate(input, todayIso);
  const accounts = context.accounts || [];
  const categories = context.categories || [];
  const templates = context.mealTemplates || [];
  const supplements = (context.supplements || []).filter((s) => !s.deletedAt && s.isActive);

  if (!input) {
    return { rawInput: input, actions: [], detectedDate, summary: '' };
  }

  const actions: UniversalCaptureAction[] = [];
  const mergedBio: UniversalBioAction = {
    id: makeId('bio', 0),
    kind: 'bio',
    enabled: true,
    date: detectedDate,
  };
  let hasBio = false;

  const segments = splitCompoundSegments(input, templates);

  segments.forEach((seg, idx) => {
    const segLower = seg.toLowerCase();

    // 1. Check Bio metrics (steps, water, sleep, energy, weight, waist)
    const bioPatch = extractBioFromSegment(seg);
    if (bioPatch) {
      hasBio = true;
      if (bioPatch.stepsExact !== undefined) mergedBio.stepsExact = bioPatch.stepsExact;
      if (bioPatch.stepsDelta !== undefined) {
        mergedBio.stepsDelta = (mergedBio.stepsDelta || 0) + bioPatch.stepsDelta;
      }
      if (bioPatch.waterDeltaMl !== undefined) {
        mergedBio.waterDeltaMl = (mergedBio.waterDeltaMl || 0) + bioPatch.waterDeltaMl;
      }
      if (bioPatch.sleepHours !== undefined) mergedBio.sleepHours = bioPatch.sleepHours;
      if (bioPatch.energyLevel !== undefined) mergedBio.energyLevel = bioPatch.energyLevel;
      if (bioPatch.weightKg !== undefined) mergedBio.weightKg = bioPatch.weightKg;
      if (bioPatch.waistInches !== undefined) mergedBio.waistInches = bioPatch.waistInches;
    }

    // 2. Check Workout
    const workout = extractWorkoutFromSegment(seg, detectedDate);
    if (workout) {
      workout.id = makeId('workout', idx);
      actions.push(workout);
      return;
    }

    // 3. Check Expense + optional Food bridge
    const { amount, accountInfo, cleanedTitle } = extractAmountAndCleanSegment(seg, accounts);
    const matchedTpl = matchMealTemplate(seg, templates);
    const hasFoodCue = Boolean(matchedTpl) || FOOD_CUES_REGEX.test(segLower);
    const isBulkSupplementPurchase =
      amount !== null &&
      amount >= 200 &&
      /\b(whey|creatine|vitamin|vit\s*d|b12|magnesium|omega|fish\s*oil|supplement|multivitamin)\b/i.test(
        segLower
      );

    if (amount !== null && amount > 0) {
      const foodEstimate = hasFoodCue ? estimateHinglishFoodMacros(cleanedTitle || seg, { amountInr: amount }) : null;
      const isJunkFood = Boolean(foodEstimate?.isJunk);
      const cat = resolveExpenseCategory(segLower, categories, isJunkFood, hasFoodCue && !isBulkSupplementPurchase);

      const expenseId = makeId('exp', idx);
      const mealId = hasFoodCue && !isBulkSupplementPurchase ? makeId('meal', idx) : undefined;

      const isIncome = /\b(salary|received|credited|cashback|refund|income|bonus)\b/i.test(segLower);
      const isInvestment = /\b(sip|mutual\s*fund|nifty|invested|zerodha|groww)\b/i.test(segLower);
      const txType: UniversalExpenseAction['txType'] = isIncome
        ? 'income'
        : isInvestment
          ? 'investment'
          : 'expense';

      actions.push({
        id: expenseId,
        kind: 'expense',
        enabled: true,
        title: cleanedTitle,
        amount,
        txType,
        accountId: accountInfo.accountId,
        accountName: accountInfo.accountName,
        categoryId: cat.categoryId,
        categorySlug: cat.categorySlug,
        categoryName: cat.categoryName,
        date: detectedDate,
        isJunkFood,
        linkDietMealId: mealId,
      });

      if (mealId && txType === 'expense') {
        if (matchedTpl) {
          const mult = matchedTpl.multiplier;
          actions.push({
            id: mealId,
            kind: 'meal',
            enabled: true,
            name: mult === 1 ? matchedTpl.template.name : `${mult}x ${matchedTpl.template.name}`,
            calories: Math.round(matchedTpl.template.calories * mult),
            proteinG: Number((matchedTpl.template.proteinG * mult).toFixed(1)),
            carbsG: Number((matchedTpl.template.carbsG * mult).toFixed(1)),
            fatG: Number((matchedTpl.template.fatG * mult).toFixed(1)),
            mealType: matchedTpl.template.mealType || 'snack',
            isJunk: matchedTpl.template.isJunk,
            templateId: matchedTpl.template.id,
            date: detectedDate,
            linkedExpenseActionId: expenseId,
          });
        } else if (foodEstimate) {
          actions.push({
            id: mealId,
            kind: 'meal',
            enabled: true,
            name: foodEstimate.name,
            calories: foodEstimate.calories,
            proteinG: foodEstimate.proteinG,
            carbsG: foodEstimate.carbsG,
            fatG: foodEstimate.fatG,
            mealType: foodEstimate.mealType,
            isJunk: foodEstimate.isJunk,
            templateId: null,
            date: detectedDate,
            linkedExpenseActionId: expenseId,
          });
        }
      }
      return;
    }

    // 4. Check Supplement intake (non-purchase)
    let matchedSupplement = false;
    const invMatch = supplements.find((s) => {
      const sName = s.name.toLowerCase();
      return (
        segLower.includes(sName) ||
        (s.category === 'creatine' && /\bcreatine\b/i.test(segLower)) ||
        (s.category === 'mineral' && /\bmagnesium|zinc\b/i.test(segLower)) ||
        (s.category === 'vitamin' && /\bvit(?:amin)?\s*(?:d3?|b12)|multivitamin\b/i.test(segLower)) ||
        (s.category === 'omega' && /\bomega|fish\s*oil\b/i.test(segLower))
      );
    });

    if (invMatch && !/\bwhey\b/i.test(segLower)) {
      actions.push({
        id: makeId('supp', idx),
        kind: 'supplement',
        enabled: true,
        supplementId: invMatch.id,
        supplementName: invMatch.name,
        servings: invMatch.dailyDosage || 1,
        date: detectedDate,
      });
      matchedSupplement = true;
    } else {
      for (const kw of SUPPLEMENT_KEYWORDS) {
        if (kw.pattern.test(segLower)) {
          actions.push({
            id: makeId('supp', idx),
            kind: 'supplement',
            enabled: true,
            supplementName: kw.name,
            servings: 1,
            date: detectedDate,
          });
          matchedSupplement = true;
          break;
        }
      }
    }
    if (matchedSupplement) return;

    // 5. Standalone Food / Meal Staple
    if (matchedTpl) {
      const mult = matchedTpl.multiplier;
      actions.push({
        id: makeId('meal', idx),
        kind: 'meal',
        enabled: true,
        name: mult === 1 ? matchedTpl.template.name : `${mult}x ${matchedTpl.template.name}`,
        calories: Math.round(matchedTpl.template.calories * mult),
        proteinG: Number((matchedTpl.template.proteinG * mult).toFixed(1)),
        carbsG: Number((matchedTpl.template.carbsG * mult).toFixed(1)),
        fatG: Number((matchedTpl.template.fatG * mult).toFixed(1)),
        mealType: matchedTpl.template.mealType || 'snack',
        isJunk: matchedTpl.template.isJunk,
        templateId: matchedTpl.template.id,
        date: detectedDate,
      });
      return;
    }

    if (hasFoodCue) {
      const est = estimateHinglishFoodMacros(seg);
      actions.push({
        id: makeId('meal', idx),
        kind: 'meal',
        enabled: true,
        name: est.name,
        calories: est.calories,
        proteinG: est.proteinG,
        carbsG: est.carbsG,
        fatG: est.fatG,
        mealType: est.mealType,
        isJunk: est.isJunk,
        templateId: null,
        date: detectedDate,
      });
      return;
    }

    // 6. Explicit task cues if segment wasn't pure bio
    if (!bioPatch) {
      let priority: Priority = 'medium';
      let isUrgent = false;
      if (/!p1|\burgent\b|\basap\b/i.test(segLower)) {
        priority = 'high';
        isUrgent = true;
      } else if (/!p2|\bhigh\b|\bimportant\b/i.test(segLower)) {
        priority = 'high';
      } else if (/!p4|\blow\b/i.test(segLower)) {
        priority = 'low';
      }

      const domainTag: UniversalTaskAction['domainTag'] =
        /\b(doctor|dentist|lab|blood|checkup|clinic|medicine|health)\b/i.test(segLower)
          ? 'health'
          : /\b(pay|bill|emi|slice|axis|bank|tax|sip)\b/i.test(segLower)
            ? 'finance'
            : /\b(gym|workout|run)\b/i.test(segLower)
              ? 'fitness'
              : 'general';

      const cleanTaskTitle = seg
        .replace(/!p[1-4]\b/gi, '')
        .replace(/\b(today|tomorrow|yesterday)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleanTaskTitle.length >= 2) {
        actions.push({
          id: makeId('task', idx),
          kind: 'task',
          enabled: true,
          title: cleanTaskTitle.charAt(0).toUpperCase() + cleanTaskTitle.slice(1),
          priority,
          isUrgent,
          domainTag,
          dueDate: detectedDate,
        });
      }
    }
  });

  if (hasBio) {
    actions.push(mergedBio);
  }

  const summary =
    actions.length === 0
      ? 'No structured items detected'
      : actions
          .map((a) => {
            if (a.kind === 'expense') return `₹${a.amount} ${a.title}`;
            if (a.kind === 'meal') return `${a.name} (${a.calories} kcal)`;
            if (a.kind === 'workout') return `${a.title} ${a.durationMinutes}m`;
            if (a.kind === 'bio') return 'Bio check-in';
            if (a.kind === 'supplement') return a.supplementName;
            return `Task: ${a.title}`;
          })
          .join(' · ');

  return {
    rawInput: input,
    actions,
    detectedDate,
    summary,
  };
}
