import type { SupplementInventory, SupplementLog } from '@/lib/types';
import {
  compactAlphaNum,
  normalizeExpenseSupplementText,
  scoreExpenseCandidate,
  scoreProteinCandidate,
  tokenizeAlphaNum,
} from './supplement-match-helpers';

export interface ProteinMealMatchResult {
  supplement: SupplementInventory;
  servings: number;
  matchReason: string;
}

const PROTEIN_POWDER_HINT_REGEX =
  /\b(whey|casein|isolate|concentrate|hydrolysate|protein\s*powder|protein\s*shake|protein\s*scoop|soy\s*protein|pea\s*protein|plant\s*protein|mass\s*gainer|scoop)\b/i;

/**
 * Deterministic tag embedded in `supplement_logs.notes` so a meal log
 * never deducts supplement inventory more than once.
 */
export function buildAutoMealSupplementNoteTag(mealId: string): string {
  return `[auto-meal:${mealId}]`;
}

/**
 * Checks whether an active supplement log has already been recorded for `mealId`.
 */
export function hasAutoMealSupplementLog(
  logs: Pick<SupplementLog, 'supplementId' | 'notes' | 'deletedAt'>[],
  mealId: string,
  supplementId?: string
): boolean {
  const tag = buildAutoMealSupplementNoteTag(mealId);
  return logs.some((l) => !l.deletedAt && (!supplementId || l.supplementId === supplementId) && String(l.notes ?? '').includes(tag));
}

function hasCustomMultiplier(qm: number | null | undefined): qm is number {
  if (typeof qm !== 'number' || !Number.isFinite(qm)) return false;
  return qm > 0 && qm !== 1;
}

const roundServings = (val: number): number => Math.round(val * 100) / 100;

function parseExplicitServings(combined: string): number | null {
  const explicitMatch =
    combined.match(/\b(\d+(?:\.\d+)?)\s*(?:x\s*)?(?:scoops?|servings?|sachets?)\b/i) ??
    combined.match(/^(\d+(?:\.\d+)?)\s*x\b/i);
  if (!explicitMatch) return null;
  const parsed = parseFloat(explicitMatch[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.max(0.25, Math.min(20, roundServings(parsed)));
}

/**
 * Extracts scoop / serving count from `quantityMultiplier` or explicit scoop text.
 */
export function extractProteinServingsFromMeal(meal: {
  name: string;
  quantityMultiplier?: number | null;
  notes?: string | null;
}): number {
  if (hasCustomMultiplier(meal.quantityMultiplier)) {
    return Math.max(0.25, roundServings(meal.quantityMultiplier));
  }
  const combined = `${meal.name ?? ''} ${meal.notes ?? ''}`.trim();
  return parseExplicitServings(combined) ?? 1;
}

function pickBestProteinMatch(mealName: string, activeProteins: SupplementInventory[]) {
  const mealText = mealName.trim();
  const mealCompact = compactAlphaNum(mealText);
  const mealTokens = new Set(tokenizeAlphaNum(mealText));
  const hasPowderHint = PROTEIN_POWDER_HINT_REGEX.test(mealText);

  let best: { supplement: SupplementInventory; score: number; reason: string } | null = null;
  for (const sup of activeProteins) {
    const candidate = scoreProteinCandidate({
      sup,
      mealText,
      mealCompact,
      mealTokens,
      hasPowderHint,
      singleActiveProtein: activeProteins.length === 1,
    });
    if (!candidate) continue;
    if (!best || candidate.score > best.score) {
      best = { supplement: sup, score: candidate.score, reason: candidate.reason };
    }
  }
  return best;
}

function isEligibleProteinMeal(meal: { name: string; isJunk?: boolean } | null | undefined): boolean {
  if (!meal || meal.isJunk) return false;
  return Boolean(meal.name?.trim());
}

/**
 * Matches a newly logged non-junk protein shake/scoop meal against active `protein`
 * supplements in `supplement_inventory`. Strictly ignores whole foods such as eggs,
 * milk, tea, oats, guavas, paneer, or chicken.
 */
export function matchProteinMealToSupplement(
  meal: {
    name: string;
    isJunk?: boolean;
    quantityMultiplier?: number | null;
    notes?: string | null;
  },
  inventory: SupplementInventory[]
): ProteinMealMatchResult | null {
  if (!isEligibleProteinMeal(meal)) return null;

  const activeProteins = inventory.filter((s) => !s.deletedAt && s.isActive && s.category === 'protein');
  if (activeProteins.length === 0) return null;

  const best = pickBestProteinMatch(meal.name, activeProteins);
  if (!best) return null;
  return {
    supplement: best.supplement,
    servings: extractProteinServingsFromMeal(meal),
    matchReason: best.reason,
  };
}

function pickBestExpenseMatch(rawText: string, active: SupplementInventory[]): SupplementInventory | null {
  const qLower = normalizeExpenseSupplementText(rawText);
  const qCompact = compactAlphaNum(qLower);
  const qTokens = new Set(tokenizeAlphaNum(qLower));

  let best: { item: SupplementInventory; score: number } | null = null;
  for (const sup of active) {
    const score = scoreExpenseCandidate({ sup, qLower, qCompact, qTokens });
    if (score < 50) continue;
    if (!best || score > best.score) best = { item: sup, score };
  }
  return best ? best.item : null;
}

/**
 * Matches a Finance expense in `Health & Supplements` against active supplement
 * inventory items using normalized brand/name tokens and supplement keywords.
 */
export function matchExpenseToSupplement(
  expense: {
    title: string;
    merchantName?: string | null;
    notes?: string | null;
  },
  inventory: SupplementInventory[]
): SupplementInventory | null {
  const rawText = `${expense.title ?? ''} ${expense.merchantName ?? ''} ${expense.notes ?? ''}`.trim();
  if (!rawText) return null;

  const active = inventory.filter((s) => !s.deletedAt && s.isActive);
  if (active.length === 0) return null;

  return pickBestExpenseMatch(rawText, active);
}
