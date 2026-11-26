import type { SupplementInventory } from '@/lib/types';

type MatchText = string;
type CompactText = string;
type TokenSet = Set<string>;

const GENERIC_SUPPLEMENT_STOPWORDS = new Set([
  'protein', 'powder', 'supplement', 'supplements', 'unflavoured', 'unflavored',
  'chocolate', 'vanilla', 'mango', 'cafe', 'raw', '100', '1kg', '2kg', '500g',
  '30g', '34g', '1', 'scoop', 'scoops', 'serving', 'servings', 'pack', 'jar', 'tub',
]);

const SUBTYPE_KEYWORDS = ['whey', 'isolate', 'soy', 'casein', 'pea', 'concentrate'];

const EXPENSE_SUPPLEMENT_KEYWORDS = [
  'creatine', 'monohydrate', 'omega', 'fish oil', 'vitamin', 'multivitamin',
  'magnesium', 'zinc', 'whey', 'isolate', 'casein', 'soy protein', 'pea protein',
  'electrolyte', 'pre-workout', 'preworkout', 'b12', 'd3',
];

export function compactAlphaNum(value: MatchText): CompactText {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function tokenizeAlphaNum(value: MatchText): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

export function normalizeExpenseSupplementText(value: MatchText): MatchText {
  return value.toLowerCase().replace(/\bvit\b/g, 'vitamin');
}

function isTokenMatched(token: MatchText, tokenSet: TokenSet, compactText: CompactText, minCompactLen: number): boolean {
  if (tokenSet.has(token)) return true;
  return token.length >= minCompactLen && compactText.includes(token);
}

function hasIncompatibleProteinType(mealText: MatchText, supFull: MatchText): boolean {
  const mealWhey = /\bwhey\b/i.test(mealText);
  const mealPlant = /\b(soy|pea|plant|vegan)\b/i.test(mealText);
  const supWhey = /\bwhey\b/i.test(supFull);
  const supPlant = /\b(soy|pea|plant|vegan)\b/i.test(supFull);
  if (mealWhey && !supWhey) return supPlant;
  if (mealPlant && !supPlant) return supWhey;
  return false;
}

function countProteinTokenHits(supFull: MatchText, mealTokens: TokenSet, mealCompact: CompactText): number {
  const supTokens = tokenizeAlphaNum(supFull).filter((t) => !GENERIC_SUPPLEMENT_STOPWORDS.has(t));
  return supTokens.filter((t) => isTokenMatched(t, mealTokens, mealCompact, 4)).length;
}

function countSubtypeHits(supFull: MatchText, mealTokens: TokenSet): number {
  return SUBTYPE_KEYWORDS.filter((kw) => mealTokens.has(kw) && new RegExp(`\\b${kw}\\b`, 'i').test(supFull)).length;
}

function scoreNameAndBrand(sup: SupplementInventory, mealCompact: CompactText, brandMatched: boolean) {
  let score = 0;
  const reasons: string[] = [];
  const supNameCompact = compactAlphaNum(sup.name ?? '');
  if (supNameCompact.length >= 5 && mealCompact.includes(supNameCompact)) {
    score += 100;
    reasons.push('exact_name');
  }
  if (brandMatched) {
    score += 55;
    reasons.push(`brand:${sup.brand}`);
  }
  return { score, reasons };
}

function scoreTokenAndSubtypeHits(
  supFull: MatchText,
  mealTokens: TokenSet,
  mealCompact: CompactText,
  reasons: string[]
): number {
  let bonus = 0;
  const tokenHits = countProteinTokenHits(supFull, mealTokens, mealCompact);
  if (tokenHits > 0) {
    bonus += Math.min(60, tokenHits * 25);
    reasons.push(`tokens:${tokenHits}`);
  }
  const subtypeHits = countSubtypeHits(supFull, mealTokens);
  if (subtypeHits > 0) {
    bonus += subtypeHits * 25;
    reasons.push(`subtype:${subtypeHits}`);
  }
  return bonus;
}

function applySingleProteinFallback(score: number, reasons: string[], singleActiveProtein: boolean, hasPowderHint: boolean): number {
  if (!singleActiveProtein || !hasPowderHint) return score;
  if (score >= 25 && score < 60) {
    reasons.push('single_active_protein');
    return 60;
  }
  return score;
}

export function scoreProteinCandidate(params: {
  sup: SupplementInventory;
  mealText: MatchText;
  mealCompact: CompactText;
  mealTokens: TokenSet;
  hasPowderHint: boolean;
  singleActiveProtein: boolean;
}): { score: number; reason: string } | null {
  const { sup, mealText, mealCompact, mealTokens, hasPowderHint, singleActiveProtein } = params;
  const supFull = `${sup.brand ?? ''} ${sup.name ?? ''}`.trim();
  if (hasIncompatibleProteinType(mealText, supFull)) return null;

  const supBrandCompact = compactAlphaNum(sup.brand ?? '');
  const brandMatched = supBrandCompact.length >= 3 && mealCompact.includes(supBrandCompact);
  if (!hasPowderHint && !brandMatched) return null;

  const base = scoreNameAndBrand(sup, mealCompact, brandMatched);
  const reasons = base.reasons;
  let score = base.score + scoreTokenAndSubtypeHits(supFull, mealTokens, mealCompact, reasons);
  score = applySingleProteinFallback(score, reasons, singleActiveProtein, hasPowderHint);
  return score >= 60 ? { score, reason: reasons.join(',') || 'matched' } : null;
}

function isSignificantExpenseToken(t: MatchText): boolean {
  if (GENERIC_SUPPLEMENT_STOPWORDS.has(t)) return false;
  if (t.length >= 3) return true;
  return t.length >= 2 && /[a-z]/.test(t) && /\d/.test(t);
}

function scoreNameMatch(supNameLower: MatchText, supNameCompact: CompactText, qLower: MatchText, qCompact: CompactText): number {
  if (supNameLower.length >= 4 && qLower.includes(supNameLower)) return 100;
  if (supNameLower.length >= 4 && supNameLower.includes(qLower)) return 100;
  if (supNameCompact.length >= 4 && qCompact.includes(supNameCompact)) return 95;
  return 0;
}

function scoreExpenseKeywordBonus(supFull: MatchText, supFullCompact: CompactText, qLower: MatchText, qCompact: CompactText): number {
  let bonus = 0;
  for (const kw of EXPENSE_SUPPLEMENT_KEYWORDS) {
    const kwCompact = compactAlphaNum(kw);
    const inQuery = qLower.includes(kw) || qCompact.includes(kwCompact);
    const inSup = supFull.includes(kw) || supFullCompact.includes(kwCompact);
    if (inQuery && inSup) bonus += 35;
  }
  return bonus;
}

export function scoreExpenseCandidate(params: {
  sup: SupplementInventory;
  qLower: MatchText;
  qCompact: CompactText;
  qTokens: TokenSet;
}): number {
  const { sup, qLower, qCompact, qTokens } = params;
  const supFull = normalizeExpenseSupplementText(`${sup.brand ?? ''} ${sup.name ?? ''}`.trim());
  const supFullCompact = compactAlphaNum(supFull);
  const supNameLower = normalizeExpenseSupplementText(sup.name.trim());
  const supBrandCompact = compactAlphaNum(sup.brand ?? '');

  let score = scoreNameMatch(supNameLower, compactAlphaNum(supNameLower), qLower, qCompact);
  if (supBrandCompact.length >= 3 && qCompact.includes(supBrandCompact)) score += 45;

  const sigTokens = tokenizeAlphaNum(supFull).filter(isSignificantExpenseToken);
  score += sigTokens.filter((tok) => isTokenMatched(tok, qTokens, qCompact, 4)).length * 30;
  score += scoreExpenseKeywordBonus(supFull, supFullCompact, qLower, qCompact);
  return score;
}
