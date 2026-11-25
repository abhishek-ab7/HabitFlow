import type { MealTemplate, MealTemplateFormData, MealType } from '@/lib/types';

export const STARTER_INDIAN_STAPLES: MealTemplateFormData[] = [
  {
    name: '4 Boiled Eggs',
    hindiAliases: ['4 eggs', 'boiled eggs', 'anda', 'ande', 'eggs'],
    calories: 280,
    proteinG: 24,
    carbsG: 2,
    fatG: 20,
    fiberG: 0,
    servingLabel: '4 whole eggs',
    mealType: 'breakfast',
    isJunk: false,
    isPinned: true,
    order: 0,
  },
  {
    name: 'Oats + Milk',
    hindiAliases: ['oats', 'oats milk', 'oatmeal', 'daliya'],
    calories: 340,
    proteinG: 14,
    carbsG: 50,
    fatG: 8,
    fiberG: 6,
    servingLabel: '50g oats + 250ml milk',
    mealType: 'breakfast',
    isJunk: false,
    isPinned: true,
    order: 1,
  },
  {
    name: 'Chicken + Rice',
    hindiAliases: ['chicken rice', 'chicken and rice', 'murgh chawal', 'chicken breast'],
    calories: 520,
    proteinG: 42,
    carbsG: 58,
    fatG: 11,
    fiberG: 2,
    servingLabel: '180g chicken + 150g cooked rice',
    mealType: 'lunch',
    isJunk: false,
    isPinned: true,
    order: 2,
  },
  {
    name: 'Dahi Bowl',
    hindiAliases: ['dahi', 'curd', 'yogurt', 'dahi bowl'],
    calories: 160,
    proteinG: 9,
    carbsG: 12,
    fatG: 8,
    fiberG: 0,
    servingLabel: '200g bowl',
    mealType: 'snack',
    isJunk: false,
    isPinned: true,
    order: 3,
  },
  {
    name: 'Whey Scoop',
    hindiAliases: ['whey', 'whey protein', 'protein shake', 'scoop'],
    calories: 120,
    proteinG: 24,
    carbsG: 3,
    fatG: 1.5,
    fiberG: 0,
    servingLabel: '1 scoop (30g)',
    mealType: 'post_workout',
    isJunk: false,
    isPinned: true,
    order: 4,
  },
  {
    name: 'Guava',
    hindiAliases: ['amrud', 'amrood', 'peru', 'guava'],
    calories: 70,
    proteinG: 2.5,
    carbsG: 14,
    fatG: 1,
    fiberG: 5,
    servingLabel: '1 medium fruit',
    mealType: 'snack',
    isJunk: false,
    isPinned: true,
    order: 5,
  },
  {
    name: 'Chai',
    hindiAliases: ['tea', 'chai', 'milk tea', 'masala chai'],
    calories: 90,
    proteinG: 3,
    carbsG: 12,
    fatG: 3,
    fiberG: 0,
    servingLabel: '1 cup',
    mealType: 'snack',
    isJunk: false,
    isPinned: true,
    order: 6,
  },
  {
    name: 'Paneer Bhurji',
    hindiAliases: ['paneer', 'paneer bhurji', 'cottage cheese'],
    calories: 320,
    proteinG: 18,
    carbsG: 6,
    fatG: 24,
    fiberG: 1,
    servingLabel: '100g paneer',
    mealType: 'dinner',
    isJunk: false,
    isPinned: true,
    order: 7,
  },
];

export interface EstimatedFoodMacros {
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  isJunk: boolean;
  mealType: MealType;
  confidence: number;
}

interface FoodCatalogRule {
  pattern: RegExp;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  isJunk: boolean;
  mealType: MealType;
}

const HINGLISH_FOOD_CATALOG: FoodCatalogRule[] = [
  { pattern: /\bmomos?\b|\bdim\s*sum\b/i, name: 'Momos', calories: 350, proteinG: 10, carbsG: 45, fatG: 14, isJunk: true, mealType: 'snack' },
  { pattern: /\bpizza\b|\bdominos\b|\bpizza\s*hut\b/i, name: 'Pizza', calories: 550, proteinG: 20, carbsG: 60, fatG: 24, isJunk: true, mealType: 'dinner' },
  { pattern: /\bburger\b|\bmcd\b|\bmcdonalds\b|\bburger\s*king\b|\bkfc\b/i, name: 'Burger', calories: 480, proteinG: 18, carbsG: 48, fatG: 24, isJunk: true, mealType: 'snack' },
  { pattern: /\bsamosa\b|\bkachori\b|\bvada\s*pav\b|\bpakora\b|\bpakoda\b/i, name: 'Fried Street Snack', calories: 280, proteinG: 6, carbsG: 34, fatG: 14, isJunk: true, mealType: 'snack' },
  { pattern: /\bchowmein\b|\bnoodles\b|\bmaggi\b|\bhakka\b/i, name: 'Noodles / Maggi', calories: 380, proteinG: 9, carbsG: 54, fatG: 14, isJunk: true, mealType: 'snack' },
  { pattern: /\broll\b|\bkathi\b|\bshawarma\b|\bfrankie\b|\bwrap\b/i, name: 'Roll / Shawarma', calories: 420, proteinG: 18, carbsG: 42, fatG: 18, isJunk: true, mealType: 'snack' },
  { pattern: /\bbiryani\b/i, name: 'Biryani', calories: 600, proteinG: 26, carbsG: 70, fatG: 22, isJunk: true, mealType: 'lunch' },
  { pattern: /\bfries\b|\bfrench\s*fries\b|\bchips\b|\blays\b|\bkurkure\b|\bnamkeen\b/i, name: 'Chips / Fries', calories: 260, proteinG: 3, carbsG: 30, fatG: 14, isJunk: true, mealType: 'snack' },
  { pattern: /\bice\s*cream\b|\bpastry\b|\bcake\b|\bchocolate\b|\bgulab\s*jamun\b|\bjalebi\b|\bmithai\b|\bdessert\b|\bbrownie\b|\bwaffle\b|\bdonut\b/i, name: 'Dessert / Sweet', calories: 320, proteinG: 5, carbsG: 46, fatG: 13, isJunk: true, mealType: 'snack' },
  { pattern: /\bcold\s*drink\b|\bcoke\b|\bpepsi\b|\bsprite\b|\bmilkshake\b|\bthick\s*shake\b|\bboba\b/i, name: 'Sugary Drink / Shake', calories: 240, proteinG: 3, carbsG: 48, fatG: 4, isJunk: true, mealType: 'snack' },
  { pattern: /\bchole\s*bhature\b|\bpav\s*bhaji\b|\bpuri\b|\bparatha\b/i, name: 'Heavy Indian Meal', calories: 520, proteinG: 13, carbsG: 64, fatG: 23, isJunk: true, mealType: 'lunch' },
  { pattern: /\bchaat\b|\bpani\s*puri\b|\bgolgappa\b|\bbhel\b|\btikki\b/i, name: 'Chaat / Street Food', calories: 270, proteinG: 6, carbsG: 40, fatG: 10, isJunk: true, mealType: 'snack' },
  { pattern: /\bchicken\s*(?:and|\+)?\s*rice\b|\bmurgh\s*chawal\b/i, name: 'Chicken + Rice', calories: 520, proteinG: 42, carbsG: 58, fatG: 11, isJunk: false, mealType: 'lunch' },
  { pattern: /\bpaneer\s*bhurji\b|\bpaneer\b/i, name: 'Paneer Bhurji', calories: 320, proteinG: 18, carbsG: 6, fatG: 24, isJunk: false, mealType: 'dinner' },
  { pattern: /\bwhey\b|\bprotein\s*shake\b/i, name: 'Whey Scoop', calories: 120, proteinG: 24, carbsG: 3, fatG: 1.5, isJunk: false, mealType: 'post_workout' },
  { pattern: /\boats\b|\boatmeal\b/i, name: 'Oats + Milk', calories: 340, proteinG: 14, carbsG: 50, fatG: 8, isJunk: false, mealType: 'breakfast' },
  { pattern: /\beggs?\b|\banda\b|\bande\b|\bomel?ette?\b/i, name: 'Eggs', calories: 70, proteinG: 6, carbsG: 0.5, fatG: 5, isJunk: false, mealType: 'breakfast' },
  { pattern: /\bdahi\b|\bcurd\b|\byogurt\b/i, name: 'Dahi Bowl', calories: 160, proteinG: 9, carbsG: 12, fatG: 8, isJunk: false, mealType: 'snack' },
  { pattern: /\bguava\b|\bamrud\b|\bamrood\b|\bperu\b/i, name: 'Guava', calories: 70, proteinG: 2.5, carbsG: 14, fatG: 1, isJunk: false, mealType: 'snack' },
  { pattern: /\bchai\b|\btea\b/i, name: 'Chai', calories: 90, proteinG: 3, carbsG: 12, fatG: 3, isJunk: false, mealType: 'snack' },
  { pattern: /\bcold\s*coffee\b/i, name: 'Cold Coffee', calories: 200, proteinG: 6, carbsG: 28, fatG: 7, isJunk: false, mealType: 'snack' },
  { pattern: /\bcoffee\b|\bamericano\b|\bespresso\b|\bcappuccino\b|\blatte\b/i, name: 'Coffee', calories: 80, proteinG: 3, carbsG: 9, fatG: 3, isJunk: false, mealType: 'snack' },
  { pattern: /\broti\b|\bchapati\b|\bdal\b|\bsabzi\b|\bthali\b|\bkhichdi\b/i, name: 'Home Dal Roti / Thali', calories: 450, proteinG: 16, carbsG: 68, fatG: 12, isJunk: false, mealType: 'lunch' },
  { pattern: /\bpoha\b|\bupma\b|\bidli\b|\bdosa\b/i, name: 'South / Breakfast Tiffin', calories: 300, proteinG: 8, carbsG: 48, fatG: 8, isJunk: false, mealType: 'breakfast' },
  { pattern: /\bmilk\b|\bdoodh\b/i, name: 'Milk', calories: 150, proteinG: 8, carbsG: 12, fatG: 8, isJunk: false, mealType: 'snack' },
  { pattern: /\bbanana\b|\bkela\b/i, name: 'Banana', calories: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4, isJunk: false, mealType: 'pre_workout' },
  { pattern: /\bchicken\b/i, name: 'Chicken Portion', calories: 280, proteinG: 36, carbsG: 2, fatG: 12, isJunk: false, mealType: 'lunch' },
];

/**
 * Matches a fragment like "4 boiled eggs" or "oats" against user's saved templates.
 */
export function matchMealTemplate(
  rawFragment: string,
  templates: MealTemplate[]
): { template: MealTemplate; multiplier: number } | null {
  const clean = rawFragment.trim().toLowerCase();
  if (!clean) return null;

  const active = templates.filter((t) => !t.deletedAt);
  // Exact or alias match first
  for (const tpl of active) {
    const tName = tpl.name.toLowerCase();
    if (clean === tName || clean.includes(tName)) {
      return { template: tpl, multiplier: 1 };
    }
    for (const alias of tpl.hindiAliases || []) {
      const a = alias.toLowerCase().trim();
      if (!a) continue;
      if (clean === a || clean.includes(a)) {
        // Check if user specified e.g. "2 scoops whey" or "2x oats"
        const multMatch = clean.match(/\b(\d+(?:\.\d+)?)\s*(?:x|scoops?|cups?|bowls?|servings?)?\b/i);
        let multiplier = 1;
        if (multMatch && !tName.includes(multMatch[1]) && !a.includes(multMatch[1])) {
          const parsedMult = parseFloat(multMatch[1]);
          if (parsedMult > 0 && parsedMult <= 10) multiplier = parsedMult;
        }
        return { template: tpl, multiplier };
      }
    }
  }

  return null;
}

/**
 * Estimates calories and macros for Hinglish food / junk food descriptions offline.
 * Used both by the Junk Food Finance -> Diet auto-bridge and Universal Capture fallback.
 */
export function estimateHinglishFoodMacros(
  rawText: string,
  options?: { amountInr?: number; forceJunk?: boolean }
): EstimatedFoodMacros {
  const clean = (rawText || '').trim();
  const lower = clean.toLowerCase();

  for (const rule of HINGLISH_FOOD_CATALOG) {
    if (rule.pattern.test(lower)) {
      // Special scaling for eggs ("4 eggs", "6 eggs", "2 anda") when matched generically
      if (rule.name === 'Eggs') {
        const countMatch = lower.match(/\b(\d+)\s*(?:boiled\s*)?(?:eggs?|anda|ande)\b/i);
        const count = countMatch ? Math.max(1, Math.min(12, parseInt(countMatch[1], 10))) : 2;
        return {
          name: clean || `${count} Eggs`,
          calories: Math.round(rule.calories * count),
          proteinG: Math.round(rule.proteinG * count * 10) / 10,
          carbsG: Math.round(rule.carbsG * count * 10) / 10,
          fatG: Math.round(rule.fatG * count * 10) / 10,
          isJunk: options?.forceJunk ?? rule.isJunk,
          mealType: rule.mealType,
          confidence: 88,
        };
      }

      return {
        name: clean || rule.name,
        calories: rule.calories,
        proteinG: rule.proteinG,
        carbsG: rule.carbsG,
        fatG: rule.fatG,
        isJunk: options?.forceJunk ?? rule.isJunk,
        mealType: rule.mealType,
        confidence: 85,
      };
    }
  }

  // Fallback heuristic when unrecognized food/junk expense is logged
  const amt = Number(options?.amountInr || 0);
  const calories = amt >= 350 ? 550 : amt >= 180 ? 420 : 350;
  const proteinG = amt >= 350 ? 14 : 9;
  const carbsG = Math.round((calories * 0.52) / 4);
  const fatG = Math.round((calories * 0.36) / 9);

  return {
    name: clean || 'Junk Food Meal',
    calories,
    proteinG,
    carbsG,
    fatG,
    isJunk: options?.forceJunk ?? true,
    mealType: 'snack',
    confidence: 55,
  };
}
