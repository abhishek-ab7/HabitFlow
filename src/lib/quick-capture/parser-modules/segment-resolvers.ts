import { addDays } from '@/lib/finance/credit-card-cycles';
import { estimateHinglishFoodMacros, matchMealTemplate } from '@/lib/fitness/meal-estimator';
import type { MealTemplate, Priority, SupplementInventory } from '@/lib/types';
import type {
  UniversalMealAction,
  UniversalSupplementAction,
  UniversalTaskAction,
} from '../parser-types';

type IsoDate = string;
type SegmentText = string;
type ActionPrefix = string;
type ActionId = string;

export const FOOD_CUES_REGEX =
  /\b(eggs?|anda|ande|oats|oatmeal|daliya|chicken|rice|murgh|dahi|curd|yogurt|whey|protein\s*shake|guava|amrud|amrood|chai|tea|coffee|paneer|roti|chapati|dal|sabzi|thali|khichdi|poha|upma|idli|dosa|milk|doodh|banana|kela|momos?|pizza|burger|samosa|kachori|vada\s*pav|pakora|chowmein|noodles|maggi|roll|shawarma|frankie|biryani|fries|chips|kurkure|ice\s*cream|pastry|cake|chocolate|cold\s*drink|coke|pepsi|sprite|milkshake|chole\s*bhature|pav\s*bhaji|chaat|pani\s*puri|golgappa|sandwich|toast|omelette|omlette|paratha|salad)\b/i;

const KNOWN_COMBO_REGEX =
  /\b(oats\s*\+\s*milk|chicken\s*\+\s*rice|dal\s*\+\s*chawal|dal\s*\+\s*rice|roti\s*\+\s*sabzi|bread\s*\+\s*butter|eggs?\s*\+\s*toast)\b/gi;

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

export function makeId(prefix: ActionPrefix, idx: number): ActionId {
  return `${prefix}_${idx}_${Math.random().toString(36).slice(2, 7)}`;
}

export function resolveCaptureDate(text: SegmentText, todayIso: IsoDate): IsoDate {
  const lower = text.toLowerCase();
  const explicitIso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (explicitIso) return explicitIso[1];
  if (/\byesterday\b|\bkal\s+raat\b|\blast\s+night\b/.test(lower)) return addDays(todayIso, -1);
  if (/\btomorrow\b|\bkal\b/.test(lower) && /\b(task|remind|pay|call|book|meet|buy)\b/.test(lower)) {
    return addDays(todayIso, 1);
  }
  return todayIso;
}

function buildComboPlaceholderRegex(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
  return new RegExp(escaped, 'gi');
}

export function splitCompoundSegments(raw: string, templates: MealTemplate[]): string[] {
  let working = raw.trim();
  const placeholders: Array<{ token: string; value: string }> = [];
  const protect = (re: RegExp) => {
    working = working.replace(re, (m) => {
      const token = `__COMBO_${placeholders.length}__`;
      placeholders.push({ token, value: m });
      return token;
    });
  };

  for (const tpl of templates) {
    if (!tpl.deletedAt && tpl.name.includes('+')) protect(buildComboPlaceholderRegex(tpl.name));
  }
  protect(KNOWN_COMBO_REGEX);

  return working
    .split(/[\n,;]+|\s+\+\s+|\s+&\s+|\s+\band\b\s+/i)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((part) => placeholders.reduce((acc, ph) => acc.replace(ph.token, ph.value), part).trim());
}

export function buildMealFromTemplateMatch(
  matchedTpl: NonNullable<ReturnType<typeof matchMealTemplate>>,
  mealId: ActionId,
  date: IsoDate,
  linkedExpenseActionId?: ActionId
): UniversalMealAction {
  const mult = matchedTpl.multiplier;
  return {
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
    date,
    ...(linkedExpenseActionId ? { linkedExpenseActionId } : {}),
  };
}

export function buildMealFromFoodEstimate(
  est: ReturnType<typeof estimateHinglishFoodMacros>,
  mealId: ActionId,
  date: IsoDate,
  linkedExpenseActionId?: ActionId
): UniversalMealAction {
  return {
    id: mealId,
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
    date,
    ...(linkedExpenseActionId ? { linkedExpenseActionId } : {}),
  };
}

function matchesSupplementInventory(s: SupplementInventory, segLower: string): boolean {
  const sName = s.name.toLowerCase();
  if (segLower.includes(sName)) return true;
  if (s.category === 'creatine') return /\bcreatine\b/i.test(segLower);
  if (s.category === 'mineral') return /\bmagnesium|zinc\b/i.test(segLower);
  if (s.category === 'vitamin') return /\bvit(?:amin)?\s*(?:d3?|b12)|multivitamin\b/i.test(segLower);
  if (s.category === 'omega') return /\bomega|fish\s*oil\b/i.test(segLower);
  return false;
}

export function tryBuildSupplementAction(
  segLower: string,
  supplements: SupplementInventory[],
  idx: number,
  date: IsoDate
): UniversalSupplementAction | null {
  const invMatch = supplements.find((s) => matchesSupplementInventory(s, segLower));
  if (invMatch && !/\bwhey\b/i.test(segLower)) {
    return {
      id: makeId('supp', idx),
      kind: 'supplement',
      enabled: true,
      supplementId: invMatch.id,
      supplementName: invMatch.name,
      servings: invMatch.dailyDosage || 1,
      date,
    };
  }
  const kw = SUPPLEMENT_KEYWORDS.find((k) => k.pattern.test(segLower));
  if (!kw) return null;
  return { id: makeId('supp', idx), kind: 'supplement', enabled: true, supplementName: kw.name, servings: 1, date };
}

function resolveTaskPriority(segLower: string): { priority: Priority; isUrgent: boolean } {
  if (/!p1|\burgent\b|\basap\b/i.test(segLower)) return { priority: 'high', isUrgent: true };
  if (/!p2|\bhigh\b|\bimportant\b/i.test(segLower)) return { priority: 'high', isUrgent: false };
  if (/!p4|\blow\b/i.test(segLower)) return { priority: 'low', isUrgent: false };
  return { priority: 'medium', isUrgent: false };
}

function resolveTaskDomainTag(segLower: string): UniversalTaskAction['domainTag'] {
  if (/\b(doctor|dentist|lab|blood|checkup|clinic|medicine|health)\b/i.test(segLower)) return 'health';
  if (/\b(pay|bill|emi|slice|axis|bank|tax|sip)\b/i.test(segLower)) return 'finance';
  if (/\b(gym|workout|run)\b/i.test(segLower)) return 'fitness';
  return 'general';
}

export function tryBuildTaskAction(
  seg: SegmentText,
  segLower: SegmentText,
  idx: number,
  date: IsoDate
): UniversalTaskAction | null {
  const cleanTaskTitle = seg
    .replace(/!p[1-4]\b/gi, '')
    .replace(/\b(today|tomorrow|yesterday)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleanTaskTitle.length < 2) return null;

  const { priority, isUrgent } = resolveTaskPriority(segLower);
  return {
    id: makeId('task', idx),
    kind: 'task',
    enabled: true,
    title: cleanTaskTitle.charAt(0).toUpperCase() + cleanTaskTitle.slice(1),
    priority,
    isUrgent,
    domainTag: resolveTaskDomainTag(segLower),
    dueDate: date,
  };
}
