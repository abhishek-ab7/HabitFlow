import type { SupplementInventory, SupplementLog } from '@/lib/types';

export interface ProteinMealMatchResult {
  supplement: SupplementInventory;
  servings: number;
  matchReason: string;
}

const GENERIC_SUPPLEMENT_STOPWORDS = new Set([
  'protein',
  'powder',
  'supplement',
  'supplements',
  'unflavoured',
  'unflavored',
  'chocolate',
  'vanilla',
  'mango',
  'cafe',
  'raw',
  '100',
  '1kg',
  '2kg',
  '500g',
  '30g',
  '34g',
  '1',
  'scoop',
  'scoops',
  'serving',
  'servings',
  'pack',
  'jar',
  'tub',
]);

const PROTEIN_POWDER_HINT_REGEX =
  /\b(whey|casein|isolate|concentrate|hydrolysate|protein\s*powder|protein\s*shake|protein\s*scoop|soy\s*protein|pea\s*protein|plant\s*protein|mass\s*gainer|scoop)\b/i;

const EXPENSE_SUPPLEMENT_KEYWORDS = [
  'creatine',
  'monohydrate',
  'omega',
  'fish oil',
  'vitamin',
  'multivitamin',
  'magnesium',
  'zinc',
  'whey',
  'isolate',
  'casein',
  'soy protein',
  'pea protein',
  'electrolyte',
  'pre-workout',
  'preworkout',
  'b12',
  'd3',
];

function compactAlphaNum(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function tokenizeAlphaNum(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

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
  return logs.some(
    (l) =>
      !l.deletedAt &&
      (!supplementId || l.supplementId === supplementId) &&
      String(l.notes || '').includes(tag)
  );
}

/**
 * Extracts scoop / serving count from `quantityMultiplier` or explicit scoop text.
 */
export function extractProteinServingsFromMeal(meal: {
  name: string;
  quantityMultiplier?: number | null;
  notes?: string | null;
}): number {
  if (
    typeof meal.quantityMultiplier === 'number' &&
    Number.isFinite(meal.quantityMultiplier) &&
    meal.quantityMultiplier > 0 &&
    meal.quantityMultiplier !== 1
  ) {
    return Math.max(0.25, Math.round(meal.quantityMultiplier * 100) / 100);
  }

  const combined = `${meal.name || ''} ${meal.notes || ''}`.trim();
  const explicitMatch =
    combined.match(/\b(\d+(?:\.\d+)?)\s*(?:x\s*)?(?:scoops?|servings?|sachets?)\b/i) ||
    combined.match(/^(\d+(?:\.\d+)?)\s*x\b/i);

  if (explicitMatch) {
    const parsed = parseFloat(explicitMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.max(0.25, Math.min(20, Math.round(parsed * 100) / 100));
    }
  }

  return 1;
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
  if (!meal || meal.isJunk || !meal.name?.trim()) return null;

  const activeProteins = inventory.filter(
    (s) => !s.deletedAt && s.isActive && s.category === 'protein'
  );
  if (activeProteins.length === 0) return null;

  const mealText = meal.name.trim();
  const mealCompact = compactAlphaNum(mealText);
  const mealTokens = new Set(tokenizeAlphaNum(mealText));
  const hasPowderHint = PROTEIN_POWDER_HINT_REGEX.test(mealText);

  const mealMentionsWhey = /\bwhey\b/i.test(mealText);
  const mealMentionsPlant = /\b(soy|pea|plant|vegan)\b/i.test(mealText);

  let best: { supplement: SupplementInventory; score: number; reason: string } | null = null;

  for (const sup of activeProteins) {
    const supFull = `${sup.brand || ''} ${sup.name || ''}`.trim();
    const supNameCompact = compactAlphaNum(sup.name || '');
    const supBrandCompact = compactAlphaNum(sup.brand || '');

    const supMentionsWhey = /\bwhey\b/i.test(supFull);
    const supMentionsPlant = /\b(soy|pea|plant|vegan)\b/i.test(supFull);

    // Avoid cross-matching Whey meals to Soy/Pea supplements or vice versa
    if (mealMentionsWhey && supMentionsPlant && !supMentionsWhey) continue;
    if (mealMentionsPlant && supMentionsWhey && !supMentionsPlant) continue;

    const brandMatched =
      supBrandCompact.length >= 3 && mealCompact.includes(supBrandCompact);

    // Whole foods ("6 Boiled Eggs", "2 Guavas", "Milk Tea", "Oats + Milk") have neither
    // a protein powder indicator nor a matching supplement brand.
    if (!hasPowderHint && !brandMatched) {
      continue;
    }

    let score = 0;
    const reasons: string[] = [];

    if (supNameCompact.length >= 5 && mealCompact.includes(supNameCompact)) {
      score += 100;
      reasons.push('exact_name');
    }

    if (brandMatched) {
      score += 55;
      reasons.push(`brand:${sup.brand}`);
    }

    const supTokens = tokenizeAlphaNum(supFull).filter(
      (t) => !GENERIC_SUPPLEMENT_STOPWORDS.has(t)
    );
    let tokenHits = 0;
    for (const token of supTokens) {
      if (mealTokens.has(token) || (token.length >= 4 && mealCompact.includes(token))) {
        tokenHits++;
      }
    }
    if (tokenHits > 0) {
      score += Math.min(60, tokenHits * 25);
      reasons.push(`tokens:${tokenHits}`);
    }

    // Protein sub-type keywords ("whey", "isolate", "soy", "casein", "pea")
    const subtypeKeywords = ['whey', 'isolate', 'soy', 'casein', 'pea', 'concentrate'];
    let subtypeHits = 0;
    for (const kw of subtypeKeywords) {
      if (mealTokens.has(kw) && new RegExp(`\\b${kw}\\b`, 'i').test(supFull)) {
        subtypeHits++;
      }
    }
    if (subtypeHits > 0) {
      score += subtypeHits * 25;
      reasons.push(`subtype:${subtypeHits}`);
    }

    // If user has a single active protein supplement (e.g. "Whey Isolate") and logs a generic
    // "Whey Scoop" without typing a brand, still link cleanly if type agrees.
    if (activeProteins.length === 1 && hasPowderHint && score >= 25 && score < 60) {
      score = 60;
      reasons.push('single_active_protein');
    }

    if (score >= 60 && (!best || score > best.score)) {
      best = {
        supplement: sup,
        score,
        reason: reasons.join(','),
      };
    }
  }

  if (!best) return null;

  return {
    supplement: best.supplement,
    servings: extractProteinServingsFromMeal(meal),
    matchReason: best.reason || 'matched',
  };
}

function normalizeExpenseSupplementText(value: string): string {
  return value.toLowerCase().replace(/\bvit\b/g, 'vitamin');
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
  const rawText = `${expense.title || ''} ${expense.merchantName || ''} ${expense.notes || ''}`.trim();
  if (!rawText) return null;

  const active = inventory.filter((s) => !s.deletedAt && s.isActive);
  if (active.length === 0) return null;

  const qLower = normalizeExpenseSupplementText(rawText);
  const qCompact = compactAlphaNum(qLower);
  const qTokens = new Set(tokenizeAlphaNum(qLower));

  let best: { item: SupplementInventory; score: number } | null = null;

  for (const sup of active) {
    const supFull = normalizeExpenseSupplementText(
      `${sup.brand || ''} ${sup.name || ''}`.trim()
    );
    const supNameLower = normalizeExpenseSupplementText(sup.name.trim());
    const supNameCompact = compactAlphaNum(supNameLower);
    const supBrandCompact = compactAlphaNum(sup.brand || '');

    let score = 0;

    if (
      supNameLower.length >= 4 &&
      (qLower.includes(supNameLower) || supNameLower.includes(qLower))
    ) {
      score += 100;
    } else if (supNameCompact.length >= 4 && qCompact.includes(supNameCompact)) {
      score += 95;
    }

    if (supBrandCompact.length >= 3 && qCompact.includes(supBrandCompact)) {
      score += 45;
    }

    const sigTokens = tokenizeAlphaNum(supFull).filter(
      (t) =>
        (t.length >= 3 || (t.length >= 2 && /[a-z]/.test(t) && /\d/.test(t))) &&
        !GENERIC_SUPPLEMENT_STOPWORDS.has(t)
    );
    for (const tok of sigTokens) {
      if (qTokens.has(tok) || (tok.length >= 4 && qCompact.includes(tok))) {
        score += 30;
      }
    }

    for (const kw of EXPENSE_SUPPLEMENT_KEYWORDS) {
      const kwCompact = compactAlphaNum(kw);
      if (
        (qLower.includes(kw) || qCompact.includes(kwCompact)) &&
        (supFull.includes(kw) || compactAlphaNum(supFull).includes(kwCompact))
      ) {
        score += 35;
      }
    }

    if (score >= 50 && (!best || score > best.score)) {
      best = { item: sup, score };
    }
  }

  return best ? best.item : null;
}
