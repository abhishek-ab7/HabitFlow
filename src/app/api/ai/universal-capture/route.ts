import { NextRequest, NextResponse } from 'next/server';
import { Type } from '@google/genai';
import {
  DEFAULT_GEMINI_MODEL,
  resolveGeminiApiKeys,
  runWithGeminiFailover,
} from '@/lib/ai/gemini-server';
import { getIstIsoDate } from '@/lib/mcp/config';
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  parseUniversalCapture,
  type UniversalCaptureAction,
  type UniversalParserContext,
} from '@/lib/quick-capture/universal-parser';

const UNIVERSAL_CAPTURE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    expenses: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          amount: { type: Type.NUMBER },
          txType: { type: Type.STRING },
          accountNameHint: { type: Type.STRING },
          categorySlug: { type: Type.STRING },
          isJunkFood: { type: Type.BOOLEAN },
          date: { type: Type.STRING },
        },
        required: ['title', 'amount'],
      },
    },
    meals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          calories: { type: Type.NUMBER },
          proteinG: { type: Type.NUMBER },
          carbsG: { type: Type.NUMBER },
          fatG: { type: Type.NUMBER },
          mealType: { type: Type.STRING },
          isJunk: { type: Type.BOOLEAN },
          date: { type: Type.STRING },
        },
        required: ['name', 'calories', 'proteinG'],
      },
    },
    workouts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          workoutType: { type: Type.STRING },
          durationMinutes: { type: Type.NUMBER },
          date: { type: Type.STRING },
        },
        required: ['title', 'durationMinutes'],
      },
    },
    bio: {
      type: Type.OBJECT,
      properties: {
        stepsExact: { type: Type.NUMBER },
        stepsDelta: { type: Type.NUMBER },
        waterDeltaMl: { type: Type.NUMBER },
        sleepHours: { type: Type.NUMBER },
        energyLevel: { type: Type.NUMBER },
        weightKg: { type: Type.NUMBER },
        waistInches: { type: Type.NUMBER },
        date: { type: Type.STRING },
      },
    },
    tasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          priority: { type: Type.STRING },
          category: { type: Type.STRING },
          dueDate: { type: Type.STRING },
        },
        required: ['title'],
      },
    },
  },
};

interface CapturePromptParams {
  rawText: string;
  todayIso: string;
  context: UniversalParserContext;
}

function buildUniversalCapturePrompt({ rawText, todayIso, context }: CapturePromptParams): string {
  const accountList = (context.accounts || []).map((a) => `${a.name} (${a.type})`).join(', ');
  const categoryList = (context.categories || []).map((c) => `${c.name} [${c.slug}]`).join(', ');
  const stapleList = (context.mealTemplates || [])
    .slice(0, 12)
    .map((t) => `${t.name} (${t.calories} kcal, ${t.proteinG}g P)`)
    .join(', ');

  return `Parse this Hinglish/English daily life log into structured HabitFlow actions.
Today (IST): ${todayIso}
User text: "${rawText}"
Accounts: ${accountList || 'UPI, Slice CC, Axis CC, Cash'}
Categories: ${categoryList || 'Junk Food [junk-food], Food & Dining [food-dining], Health & Supplements [health-supplements]'}
Saved Meals: ${stapleList || '4 Boiled Eggs, Oats + Milk, Chicken + Rice, Whey Scoop'}

Rules:
1. Junk food expenses (e.g. "momo 60 slice", "pizza 300 axis") must generate BOTH an expense (category Junk Food) AND a meal log with realistic Indian portion calories & protein.
2. Separate compound meals (e.g. "4 eggs + oats + milk") cleanly; keep staple combos like "Oats + Milk" or "Chicken + Rice" together.
3. Extract workouts (title, workoutType, durationMinutes), steps, water (ml), sleep (hours), energy (1-5), weight (kg), waist (inches), supplement doses, and tasks.
4. Use YYYY-MM-DD dates anchored on IST ${todayIso}.`;
}

function resolveMatchedAccount(
  accs: NonNullable<UniversalParserContext['accounts']>,
  hintRaw: unknown
) {
  const hint = String(hintRaw || '').toLowerCase();
  if (!hint) return accs[0];
  return (
    accs.find((a) => a.name.toLowerCase().includes(hint)) ||
    accs.find((a) => a.type === hint) ||
    accs[0]
  );
}

function resolveMatchedCategory(params: {
  cats: NonNullable<UniversalParserContext['categories']>;
  slugRaw: unknown;
  isJunkFood: boolean;
}) {
  const { cats, slugRaw, isJunkFood } = params;
  const slug = String(slugRaw || '').toLowerCase();
  const bySlug = cats.find((c) => c.slug.toLowerCase() === slug);
  if (bySlug) return bySlug;
  if (isJunkFood) {
    const junkCat = cats.find((c) => c.slug.includes('junk') || c.name.toLowerCase().includes('junk'));
    if (junkCat) return junkCat;
  }
  return cats[0];
}

function normalizeExpenseTxType(txType: unknown): 'expense' | 'income' | 'investment' {
  if (txType === 'income' || txType === 'investment') return txType;
  return 'expense';
}

function nonNegInt(val: unknown): number {
  return Math.max(0, Math.round(Number(val) || 0));
}

function nonNegNum(val: unknown): number {
  return Math.max(0, Number(val) || 0);
}

function buildExpenseCategoryProps(params: {
  matchedCat: { id: string; slug: string; name: string } | undefined;
  rawSlug: unknown;
}) {
  const { matchedCat, rawSlug } = params;
  const fallbackSlug = String(rawSlug || '').toLowerCase() || 'other-expense';
  return {
    categoryId: matchedCat?.id,
    categorySlug: matchedCat?.slug ?? fallbackSlug,
    categoryName: matchedCat?.name ?? 'General',
  };
}

function mapSingleAiExpense(params: {
  exp: any;
  index: number;
  context: UniversalParserContext;
  todayIso: string;
}): UniversalCaptureAction | null {
  const { exp, index, context, todayIso } = params;
  const amount = Number(exp.amount) || 0;
  if (amount <= 0) return null;
  const matchedAcc = resolveMatchedAccount(context.accounts || [], exp.accountNameHint);
  const matchedCat = resolveMatchedCategory({
    cats: context.categories || [],
    slugRaw: exp.categorySlug,
    isJunkFood: Boolean(exp.isJunkFood),
  });

  return {
    id: `ai_exp_${index}`,
    kind: 'expense',
    enabled: true,
    title: String(exp.title || 'Expense'),
    amount,
    txType: normalizeExpenseTxType(exp.txType),
    accountId: matchedAcc?.id,
    accountName: matchedAcc?.name ?? exp.accountNameHint ?? 'UPI',
    ...buildExpenseCategoryProps({ matchedCat, rawSlug: exp.categorySlug }),
    date: exp.date ?? todayIso,
    isJunkFood: Boolean(exp.isJunkFood),
  };
}

function mapAiExpenses(params: {
  expenses: any[];
  context: UniversalParserContext;
  todayIso: string;
}): { actions: UniversalCaptureAction[]; expenseIds: string[] } {
  const actions: UniversalCaptureAction[] = [];
  const expenseIds: string[] = [];
  params.expenses.forEach((exp, index) => {
    const action = mapSingleAiExpense({ exp, index, context: params.context, todayIso: params.todayIso });
    if (!action) return;
    expenseIds.push(action.id);
    actions.push(action);
  });
  return { actions, expenseIds };
}

function mapSingleAiMeal(params: {
  meal: any;
  index: number;
  singleExpenseId: string | undefined;
  todayIso: string;
}): UniversalCaptureAction {
  const { meal, index, singleExpenseId, todayIso } = params;
  return {
    id: `ai_meal_${index}`,
    kind: 'meal',
    enabled: true,
    name: String(meal.name || 'Meal'),
    calories: nonNegInt(meal.calories),
    proteinG: nonNegNum(meal.proteinG),
    carbsG: nonNegNum(meal.carbsG),
    fatG: nonNegNum(meal.fatG),
    mealType: meal.mealType ?? 'snack',
    isJunk: Boolean(meal.isJunk),
    templateId: null,
    date: meal.date ?? todayIso,
    linkedExpenseActionId: meal.isJunk ? singleExpenseId : undefined,
  };
}

function mapAiMeals(params: {
  meals: any[];
  expenseIds: string[];
  todayIso: string;
}): UniversalCaptureAction[] {
  const singleExpenseId = params.expenseIds.length === 1 ? params.expenseIds[0] : undefined;
  return params.meals.map((meal, index) =>
    mapSingleAiMeal({ meal, index, singleExpenseId, todayIso: params.todayIso })
  );
}

function mapAiWorkouts(workouts: any[], todayIso: string): UniversalCaptureAction[] {
  return workouts.map((w, i) => {
    const dur = Math.max(5, Math.round(Number(w.durationMinutes) || 45));
    return {
      id: `ai_wo_${i}`,
      kind: 'workout',
      enabled: true,
      title: String(w.title || 'Workout'),
      workoutType: w.workoutType ?? 'strength',
      durationMinutes: dur,
      estimatedCaloriesBurned: dur * 6,
      exercises: [],
      date: w.date ?? todayIso,
    };
  });
}

const BIO_FIELD_MAPPERS: Array<[string, (v: unknown) => number]> = [
  ['stepsExact', (v) => Math.round(Number(v))],
  ['stepsDelta', (v) => Math.round(Number(v))],
  ['waterDeltaMl', (v) => Math.round(Number(v))],
  ['sleepHours', (v) => Number(v)],
  ['energyLevel', (v) => Math.min(5, Math.max(1, Math.round(Number(v))))],
  ['weightKg', (v) => Number(v)],
  ['waistInches', (v) => Number(v)],
];

function mapAiBio(bio: any, todayIso: string): UniversalCaptureAction | null {
  if (!bio) return null;
  const fields: Record<string, number> = {};
  for (const [key, transform] of BIO_FIELD_MAPPERS) {
    if (bio[key]) fields[key] = transform(bio[key]);
  }
  if (Object.keys(fields).length === 0) return null;

  return { id: 'ai_bio_0', kind: 'bio', enabled: true, date: bio.date ?? todayIso, ...fields };
}

function normalizeTaskPriority(rawPrio: string): 'high' | 'low' | 'medium' {
  if (rawPrio === 'urgent' || rawPrio === 'high') return 'high';
  return rawPrio === 'low' ? 'low' : 'medium';
}

function normalizeTaskDomain(rawCat: string): 'health' | 'finance' | 'fitness' | 'general' {
  if (rawCat === 'health' || rawCat === 'finance' || rawCat === 'fitness') return rawCat;
  return 'general';
}

function mapAiTasks(tasks: any[], todayIso: string): UniversalCaptureAction[] {
  return tasks
    .filter((t) => Boolean(t?.title))
    .map((t, i) => {
      const rawPrio = String(t.priority || '').toLowerCase();
      return {
        id: `ai_task_${i}`,
        kind: 'task',
        enabled: true,
        title: String(t.title),
        priority: normalizeTaskPriority(rawPrio),
        isUrgent: rawPrio === 'urgent',
        domainTag: normalizeTaskDomain(String(t.category || '').toLowerCase()),
        dueDate: t.dueDate ?? todayIso,
      };
    });
}

function mapAiResponseToActions(params: {
  aiResponse: any;
  context: UniversalParserContext;
  deterministicActions: UniversalCaptureAction[];
  todayIso: string;
}): UniversalCaptureAction[] {
  const { aiResponse, context, deterministicActions, todayIso } = params;
  const { actions: expenseActions, expenseIds } = Array.isArray(aiResponse.expenses)
    ? mapAiExpenses({ expenses: aiResponse.expenses, context, todayIso })
    : { actions: [], expenseIds: [] };

  const bioAction = mapAiBio(aiResponse.bio, todayIso);
  return [
    ...expenseActions,
    ...(Array.isArray(aiResponse.meals) ? mapAiMeals({ meals: aiResponse.meals, expenseIds, todayIso }) : []),
    ...(Array.isArray(aiResponse.workouts) ? mapAiWorkouts(aiResponse.workouts, todayIso) : []),
    ...(bioAction ? [bioAction] : []),
    ...(Array.isArray(aiResponse.tasks) ? mapAiTasks(aiResponse.tasks, todayIso) : []),
    ...deterministicActions.filter((a) => a.kind === 'supplement'),
  ];
}

function deterministicJsonResponse(deterministic: ReturnType<typeof parseUniversalCapture>) {
  return NextResponse.json({
    actions: deterministic.actions,
    detectedDate: deterministic.detectedDate,
    summary: deterministic.summary,
    source: 'deterministic',
  });
}

const asArray = <T,>(val: unknown): T[] => (Array.isArray(val) ? val : []);

function buildContextFromBody(body: any, todayIso: string): UniversalParserContext {
  return {
    todayIso,
    accounts: asArray(body?.accounts),
    categories: asArray(body?.categories),
    mealTemplates: asArray(body?.mealTemplates),
    supplements: asArray(body?.supplements),
  };
}

async function resolveCaptureResponse(params: {
  rawText: string;
  todayIso: string;
  context: UniversalParserContext;
  deterministic: ReturnType<typeof parseUniversalCapture>;
}) {
  const { rawText, todayIso, context, deterministic } = params;
  if (resolveGeminiApiKeys().length === 0) return deterministicJsonResponse(deterministic);
  try {
    const aiResponse = await runWithGeminiFailover(async (ai) => {
      const res = await ai.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: buildUniversalCapturePrompt({ rawText, todayIso, context }),
        config: { responseMimeType: 'application/json', responseSchema: UNIVERSAL_CAPTURE_SCHEMA },
      });
      return res.text ? JSON.parse(res.text) : null;
    });
    if (!aiResponse) return deterministicJsonResponse(deterministic);

    const actions = mapAiResponseToActions({
      aiResponse,
      context,
      deterministicActions: deterministic.actions,
      todayIso,
    });
    return NextResponse.json({
      actions: actions.length > 0 ? actions : deterministic.actions,
      detectedDate: todayIso,
      summary: deterministic.summary,
      source: actions.length > 0 ? 'gemini' : 'deterministic',
    });
  } catch {
    return deterministicJsonResponse(deterministic);
  }
}

async function authorizeUniversalCapture(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limitResult = await rateLimit(req, { limit: 25, windowMs: 60 * 1000 });
  if (!limitResult.success) return rateLimitResponse(limitResult.retryAfter);

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const authError = await authorizeUniversalCapture(req);
    if (authError) return authError;

    const body = await req.json();
    const rawText = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!rawText) return NextResponse.json({ error: 'Capture text is required' }, { status: 400 });

    const todayIso = getIstIsoDate();
    const context = buildContextFromBody(body, todayIso);
    const deterministic = parseUniversalCapture(rawText, context);
    return await resolveCaptureResponse({ rawText, todayIso, context, deterministic });
  } catch (err) {
    console.error('[UniversalCapture API] Error:', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
