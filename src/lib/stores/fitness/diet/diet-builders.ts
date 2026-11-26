import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { STARTER_INDIAN_STAPLES } from '@/lib/fitness/meal-estimator';
import type {
  MealLog,
  MealLogFormData,
  MealTemplate,
  MealTemplateFormData,
} from '@/lib/types';

export function roundMacro(val: number | undefined): number {
  return Math.max(0, Number((Number(val) || 0).toFixed(1)));
}

function scaleOptionalMacro(val: number | null | undefined, mult: number): number | null {
  return val != null ? Number((val * mult).toFixed(1)) : null;
}

export function buildTemplateMealInput(
  template: MealTemplate,
  options?: { date?: string; mealType?: MealLog['mealType']; multiplier?: number; source?: MealLog['source'] }
): MealLogFormData {
  const opt = options ?? {};
  const mult = Math.max(0.25, Number(opt.multiplier || 1));

  return {
    date: opt.date || getLocalIsoDate(),
    mealType: opt.mealType || template.mealType || 'snack',
    name: mult === 1 ? template.name : `${mult}x ${template.name}`,
    calories: Math.round(template.calories * mult),
    proteinG: Number((template.proteinG * mult).toFixed(1)),
    carbsG: Number((template.carbsG * mult).toFixed(1)),
    fatG: Number((template.fatG * mult).toFixed(1)),
    fiberG: scaleOptionalMacro(template.fiberG, mult),
    quantityMultiplier: mult,
    isJunk: template.isJunk,
    templateId: template.id,
    source: opt.source || 'staple',
  };
}

export function buildNewMealTemplate(params: {
  data: MealTemplateFormData;
  userId: string;
  maxOrder: number;
  now: string;
}): MealTemplate {
  const { data, userId, maxOrder, now } = params;
  return {
    id: crypto.randomUUID(),
    userId,
    name: data.name.trim(),
    hindiAliases: Array.isArray(data.hindiAliases) ? data.hindiAliases : [],
    calories: Math.max(0, Math.round(Number(data.calories) || 0)),
    proteinG: roundMacro(data.proteinG),
    carbsG: roundMacro(data.carbsG),
    fatG: roundMacro(data.fatG),
    fiberG: data.fiberG ?? null,
    servingLabel: data.servingLabel || '1 serving',
    mealType: data.mealType ?? null,
    isJunk: Boolean(data.isJunk),
    isPinned: data.isPinned !== false,
    order: data.order ?? maxOrder + 1,
    deletedAt: null,
    generationCounter: 1,
    isDirty: true,
    createdAt: now,
    updatedAt: now,
  };
}

function buildStarterTemplateUuid(userId: string, name: string): string {
  const input = `habitflow:starter_staple:${userId}:${name.trim().toLowerCase()}`;
  const seeds = [0x811c9dc5, 0x9e3779b1, 0x85ebca77, 0xc2b2ae3d];
  const hexParts: string[] = [];
  for (let s = 0; s < seeds.length; s++) {
    let hash = seeds[s] >>> 0;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    hexParts.push(hash.toString(16).padStart(8, '0'));
  }
  const raw = hexParts.join('');
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-8${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}

export function buildStarterTemplates(userId: string, now: string): MealTemplate[] {
  return STARTER_INDIAN_STAPLES.map((item, idx) => ({
    id: buildStarterTemplateUuid(userId, item.name),
    userId,
    name: item.name,
    hindiAliases: item.hindiAliases,
    calories: item.calories,
    proteinG: item.proteinG,
    carbsG: item.carbsG,
    fatG: item.fatG,
    fiberG: item.fiberG ?? null,
    servingLabel: item.servingLabel,
    mealType: item.mealType ?? null,
    isJunk: item.isJunk,
    isPinned: item.isPinned,
    order: item.order ?? idx,
    deletedAt: null,
    generationCounter: 1,
    isDirty: true,
    createdAt: now,
    updatedAt: now,
  }));
}
