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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limitResult = await rateLimit(req, { limit: 25, windowMs: 60 * 1000 });
    if (!limitResult.success) {
      return rateLimitResponse(limitResult.retryAfter);
    }

    const body = await req.json();
    const rawText = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!rawText) {
      return NextResponse.json({ error: 'Capture text is required' }, { status: 400 });
    }

    const todayIso = getIstIsoDate();
    const context: UniversalParserContext = {
      todayIso,
      accounts: Array.isArray(body?.accounts) ? body.accounts : [],
      categories: Array.isArray(body?.categories) ? body.categories : [],
      mealTemplates: Array.isArray(body?.mealTemplates) ? body.mealTemplates : [],
      supplements: Array.isArray(body?.supplements) ? body.supplements : [],
    };

    const deterministic = parseUniversalCapture(rawText, context);
    const apiKeys = resolveGeminiApiKeys();

    if (apiKeys.length === 0) {
      return NextResponse.json({
        actions: deterministic.actions,
        detectedDate: deterministic.detectedDate,
        summary: deterministic.summary,
        source: 'deterministic',
      });
    }

    try {
      const accountList = (context.accounts || [])
        .map((a) => `${a.name} (${a.type})`)
        .join(', ');
      const categoryList = (context.categories || [])
        .map((c) => `${c.name} [${c.slug}]`)
        .join(', ');
      const stapleList = (context.mealTemplates || [])
        .slice(0, 12)
        .map((t) => `${t.name} (${t.calories} kcal, ${t.proteinG}g P)`)
        .join(', ');

      const prompt = `Parse this Hinglish/English daily life log into structured HabitFlow actions.
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

      const aiResponse = await runWithGeminiFailover(async (ai) => {
        const res = await ai.models.generateContent({
          model: DEFAULT_GEMINI_MODEL,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
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
            },
          },
        });
        return res.text ? JSON.parse(res.text) : null;
      });

      if (!aiResponse) {
        return NextResponse.json({
          actions: deterministic.actions,
          detectedDate: deterministic.detectedDate,
          summary: deterministic.summary,
          source: 'deterministic',
        });
      }

      const actions: UniversalCaptureAction[] = [];
      const accs = context.accounts || [];
      const cats = context.categories || [];
      const expenseIdsByIndex: string[] = [];

      if (Array.isArray(aiResponse.expenses)) {
        aiResponse.expenses.forEach((exp: any, i: number) => {
          const amount = Number(exp.amount || 0);
          if (amount <= 0) return;
          const hint = String(exp.accountNameHint || '').toLowerCase();
          const matchedAcc =
            accs.find((a) => hint && a.name.toLowerCase().includes(hint)) ||
            accs.find((a) => hint && a.type === hint) ||
            accs[0];
          const slug = String(exp.categorySlug || '').toLowerCase();
          const matchedCat =
            cats.find((c) => c.slug.toLowerCase() === slug) ||
            (exp.isJunkFood ? cats.find((c) => c.slug.includes('junk') || c.name.toLowerCase().includes('junk')) : undefined) ||
            cats[0];
          const expId = `ai_exp_${i}`;
          expenseIdsByIndex.push(expId);

          actions.push({
            id: expId,
            kind: 'expense',
            enabled: true,
            title: String(exp.title || 'Expense'),
            amount,
            txType:
              exp.txType === 'income' || exp.txType === 'investment' ? exp.txType : 'expense',
            accountId: matchedAcc?.id,
            accountName: matchedAcc?.name || exp.accountNameHint || 'UPI',
            categoryId: matchedCat?.id,
            categorySlug: matchedCat?.slug || slug || 'other-expense',
            categoryName: matchedCat?.name || 'General',
            date: exp.date || todayIso,
            isJunkFood: Boolean(exp.isJunkFood),
          });
        });
      }

      if (Array.isArray(aiResponse.meals)) {
        aiResponse.meals.forEach((meal: any, i: number) => {
          const linkedExp = meal.isJunk && expenseIdsByIndex.length === 1 ? expenseIdsByIndex[0] : undefined;
          actions.push({
            id: `ai_meal_${i}`,
            kind: 'meal',
            enabled: true,
            name: String(meal.name || 'Meal'),
            calories: Math.max(0, Math.round(Number(meal.calories || 0))),
            proteinG: Math.max(0, Number(meal.proteinG || 0)),
            carbsG: Math.max(0, Number(meal.carbsG || 0)),
            fatG: Math.max(0, Number(meal.fatG || 0)),
            mealType: meal.mealType || 'snack',
            isJunk: Boolean(meal.isJunk),
            templateId: null,
            date: meal.date || todayIso,
            linkedExpenseActionId: linkedExp,
          });
        });
      }

      if (Array.isArray(aiResponse.workouts)) {
        aiResponse.workouts.forEach((w: any, i: number) => {
          const dur = Math.max(5, Math.round(Number(w.durationMinutes || 45)));
          actions.push({
            id: `ai_wo_${i}`,
            kind: 'workout',
            enabled: true,
            title: String(w.title || 'Workout'),
            workoutType: w.workoutType || 'strength',
            durationMinutes: dur,
            estimatedCaloriesBurned: dur * 6,
            exercises: [],
            date: w.date || todayIso,
          });
        });
      }

      const bio = aiResponse.bio;
      if (
        bio &&
        (bio.stepsExact ||
          bio.stepsDelta ||
          bio.waterDeltaMl ||
          bio.sleepHours ||
          bio.energyLevel ||
          bio.weightKg ||
          bio.waistInches)
      ) {
        actions.push({
          id: 'ai_bio_0',
          kind: 'bio',
          enabled: true,
          date: bio.date || todayIso,
          ...(bio.stepsExact ? { stepsExact: Math.round(Number(bio.stepsExact)) } : {}),
          ...(bio.stepsDelta ? { stepsDelta: Math.round(Number(bio.stepsDelta)) } : {}),
          ...(bio.waterDeltaMl ? { waterDeltaMl: Math.round(Number(bio.waterDeltaMl)) } : {}),
          ...(bio.sleepHours ? { sleepHours: Number(bio.sleepHours) } : {}),
          ...(bio.energyLevel ? { energyLevel: Math.min(5, Math.max(1, Math.round(Number(bio.energyLevel)))) } : {}),
          ...(bio.weightKg ? { weightKg: Number(bio.weightKg) } : {}),
          ...(bio.waistInches ? { waistInches: Number(bio.waistInches) } : {}),
        });
      }

      if (Array.isArray(aiResponse.tasks)) {
        aiResponse.tasks.forEach((t: any, i: number) => {
          if (!t?.title) return;
          const rawPrio = String(t.priority || '').toLowerCase();
          const rawCat = String(t.category || '').toLowerCase();
          const domainTag =
            rawCat === 'health' || rawCat === 'finance' || rawCat === 'fitness'
              ? rawCat
              : 'general';
          actions.push({
            id: `ai_task_${i}`,
            kind: 'task',
            enabled: true,
            title: String(t.title),
            priority:
              rawPrio === 'urgent' || rawPrio === 'high'
                ? 'high'
                : rawPrio === 'low'
                  ? 'low'
                  : 'medium',
            isUrgent: rawPrio === 'urgent',
            domainTag,
            dueDate: t.dueDate || todayIso,
          });
        });
      }

      // Preserve supplement detections from deterministic parser
      for (const a of deterministic.actions) {
        if (a.kind === 'supplement') {
          actions.push(a);
        }
      }

      const finalActions = actions.length > 0 ? actions : deterministic.actions;
      return NextResponse.json({
        actions: finalActions,
        detectedDate: todayIso,
        summary: deterministic.summary,
        source: actions.length > 0 ? 'gemini' : 'deterministic',
      });
    } catch {
      return NextResponse.json({
        actions: deterministic.actions,
        detectedDate: deterministic.detectedDate,
        summary: deterministic.summary,
        source: 'deterministic',
      });
    }
  } catch (err) {
    console.error('[UniversalCapture API] Error:', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
