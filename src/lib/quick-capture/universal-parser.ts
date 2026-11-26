import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { estimateHinglishFoodMacros, matchMealTemplate } from '@/lib/fitness/meal-estimator';
import type { MealTemplate, SupplementInventory } from '@/lib/types';
import type {
  UniversalAccountRef,
  UniversalBioAction,
  UniversalCaptureAction,
  UniversalCategoryRef,
  UniversalExpenseAction,
  UniversalParseResult,
  UniversalParserContext,
} from './parser-types';
import { extractBioFromSegment, extractWorkoutFromSegment } from './parser-modules/bio-workout-extractors';
import { extractAmountAndCleanSegment, resolveExpenseCategory } from './parser-modules/finance-extractors';
import {
  buildMealFromFoodEstimate,
  buildMealFromTemplateMatch,
  FOOD_CUES_REGEX,
  makeId,
  resolveCaptureDate,
  splitCompoundSegments,
  tryBuildSupplementAction,
  tryBuildTaskAction,
} from './parser-modules/segment-resolvers';

export * from './parser-types';

const BULK_SUPPLEMENT_REGEX =
  /\b(whey|creatine|vitamin|vit\s*d|b12|magnesium|omega|fish\s*oil|supplement|multivitamin)\b/i;

const EXACT_BIO_KEYS = ['stepsExact', 'sleepHours', 'energyLevel', 'weightKg', 'waistInches'] as const;

function mergeBioPatch(mergedBio: UniversalBioAction, patch: Partial<UniversalBioAction>) {
  for (const key of EXACT_BIO_KEYS) {
    if (patch[key] !== undefined) mergedBio[key] = patch[key];
  }
  if (patch.stepsDelta !== undefined) mergedBio.stepsDelta = (mergedBio.stepsDelta ?? 0) + patch.stepsDelta;
  if (patch.waterDeltaMl !== undefined) mergedBio.waterDeltaMl = (mergedBio.waterDeltaMl ?? 0) + patch.waterDeltaMl;
}

function classifyTxType(segLower: string): UniversalExpenseAction['txType'] {
  if (/\b(salary|received|credited|cashback|refund|income|bonus)\b/i.test(segLower)) return 'income';
  if (/\b(sip|mutual\s*fund|nifty|invested|zerodha|groww)\b/i.test(segLower)) return 'investment';
  return 'expense';
}

function buildExpenseAndLinkedMeal(params: {
  seg: string;
  segLower: string;
  idx: number;
  amount: number;
  cleanedTitle: string;
  accountInfo: { accountId?: string; accountName: string };
  categories: UniversalCategoryRef[];
  matchedTpl: ReturnType<typeof matchMealTemplate>;
  hasFoodCue: boolean;
  detectedDate: string;
}): UniversalCaptureAction[] {
  const { seg, segLower, idx, amount, cleanedTitle, accountInfo, categories, matchedTpl, hasFoodCue, detectedDate } = params;
  const isBulkSupp = amount >= 200 && BULK_SUPPLEMENT_REGEX.test(segLower);
  const foodEstimate = hasFoodCue ? estimateHinglishFoodMacros(cleanedTitle || seg, { amountInr: amount }) : null;
  const isJunkFood = Boolean(foodEstimate?.isJunk);
  const cat = resolveExpenseCategory(segLower, categories, isJunkFood, hasFoodCue && !isBulkSupp);
  const expenseId = makeId('exp', idx);
  const mealId = hasFoodCue && !isBulkSupp ? makeId('meal', idx) : undefined;
  const txType = classifyTxType(segLower);

  const out: UniversalCaptureAction[] = [
    {
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
    },
  ];

  if (mealId && txType === 'expense') {
    if (matchedTpl) out.push(buildMealFromTemplateMatch(matchedTpl, mealId, detectedDate, expenseId));
    else if (foodEstimate) out.push(buildMealFromFoodEstimate(foodEstimate, mealId, detectedDate, expenseId));
  }
  return out;
}

function resolveNonExpenseSegmentAction(params: {
  seg: string;
  segLower: string;
  idx: number;
  detectedDate: string;
  matchedTpl: ReturnType<typeof matchMealTemplate>;
  hasFoodCue: boolean;
  supplements: SupplementInventory[];
  hasBioPatch: boolean;
}): UniversalCaptureAction[] {
  const { seg, segLower, idx, detectedDate, matchedTpl, hasFoodCue, supplements, hasBioPatch } = params;
  const supp = tryBuildSupplementAction(segLower, supplements, idx, detectedDate);
  if (supp) return [supp];
  if (matchedTpl) return [buildMealFromTemplateMatch(matchedTpl, makeId('meal', idx), detectedDate)];
  if (hasFoodCue) return [buildMealFromFoodEstimate(estimateHinglishFoodMacros(seg), makeId('meal', idx), detectedDate)];
  if (hasBioPatch) return [];
  const task = tryBuildTaskAction(seg, segLower, idx, detectedDate);
  return task ? [task] : [];
}

function parseNonBioSegmentActions(params: {
  seg: string;
  idx: number;
  detectedDate: string;
  accounts: UniversalAccountRef[];
  categories: UniversalCategoryRef[];
  templates: MealTemplate[];
  supplements: SupplementInventory[];
  hasBioPatch: boolean;
}): UniversalCaptureAction[] {
  const { seg, idx, detectedDate, accounts, categories, templates, supplements, hasBioPatch } = params;
  const segLower = seg.toLowerCase();

  const workout = extractWorkoutFromSegment(seg, detectedDate);
  if (workout) return [{ ...workout, id: makeId('workout', idx) }];

  const { amount, accountInfo, cleanedTitle } = extractAmountAndCleanSegment(seg, accounts);
  const matchedTpl = matchMealTemplate(seg, templates);
  const hasFoodCue = Boolean(matchedTpl) || FOOD_CUES_REGEX.test(segLower);

  if (amount !== null && amount > 0) {
    return buildExpenseAndLinkedMeal({
      seg,
      segLower,
      idx,
      amount,
      cleanedTitle,
      accountInfo,
      categories,
      matchedTpl,
      hasFoodCue,
      detectedDate,
    });
  }

  return resolveNonExpenseSegmentAction({
    seg,
    segLower,
    idx,
    detectedDate,
    matchedTpl,
    hasFoodCue,
    supplements,
    hasBioPatch,
  });
}

function formatSummaryItem(a: UniversalCaptureAction): string {
  if (a.kind === 'expense') return `₹${a.amount} ${a.title}`;
  if (a.kind === 'meal') return `${a.name} (${a.calories} kcal)`;
  if (a.kind === 'workout') return `${a.title} ${a.durationMinutes}m`;
  if (a.kind === 'bio') return 'Bio check-in';
  if (a.kind === 'supplement') return a.supplementName;
  return `Task: ${a.title}`;
}

function collectActionsFromSegments(params: {
  segments: string[];
  detectedDate: string;
  accounts: UniversalAccountRef[];
  categories: UniversalCategoryRef[];
  templates: MealTemplate[];
  supplements: SupplementInventory[];
}): UniversalCaptureAction[] {
  const actions: UniversalCaptureAction[] = [];
  const mergedBio: UniversalBioAction = { id: makeId('bio', 0), kind: 'bio', enabled: true, date: params.detectedDate };
  let hasBio = false;

  params.segments.forEach((seg, idx) => {
    const bioPatch = extractBioFromSegment(seg);
    if (bioPatch) {
      hasBio = true;
      mergeBioPatch(mergedBio, bioPatch);
    }
    actions.push(
      ...parseNonBioSegmentActions({
        seg,
        idx,
        detectedDate: params.detectedDate,
        accounts: params.accounts,
        categories: params.categories,
        templates: params.templates,
        supplements: params.supplements,
        hasBioPatch: Boolean(bioPatch),
      })
    );
  });

  if (hasBio) actions.push(mergedBio);
  return actions;
}

export function parseUniversalCapture(
  rawInput: string,
  context: UniversalParserContext = {}
): UniversalParseResult {
  const input = (rawInput ?? '').trim();
  const detectedDate = resolveCaptureDate(input, context.todayIso ?? getLocalIsoDate());
  if (!input) return { rawInput: input, actions: [], detectedDate, summary: '' };

  const templates = context.mealTemplates ?? [];
  const actions = collectActionsFromSegments({
    segments: splitCompoundSegments(input, templates),
    detectedDate,
    accounts: context.accounts ?? [],
    categories: context.categories ?? [],
    templates,
    supplements: (context.supplements ?? []).filter((s) => !s.deletedAt && s.isActive),
  });

  const summary = actions.length === 0 ? 'No structured items detected' : actions.map(formatSummaryItem).join(' · ');
  return { rawInput: input, actions, detectedDate, summary };
}
