'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  Droplets,
  Dumbbell,
  Footprints,
  Loader2,
  Mic,
  MicOff,
  Moon,
  Pill,
  Sparkles,
  Utensils,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useTaskStore } from '@/lib/stores/task-store';
import { useFinanceStore } from '@/lib/stores/finance-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import { isFitnessModuleEnabled } from '@/lib/workspace-modules';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import {
  parseUniversalCapture,
  type UniversalCaptureAction,
  type UniversalExpenseAction,
  type UniversalMealAction,
} from '@/lib/quick-capture/universal-parser';
import { cn } from '@/lib/utils';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const EXAMPLE_PROMPTS = [
  'momo 60 slice',
  '4 eggs + oats + milk',
  'push workout 45m + 9000 steps',
  '7.5h sleep, energy 4, 74.2 kg',
];

export function QuickCaptureModal({ defaultOpen = false }: { defaultOpen?: boolean } = {}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [inputText, setInputText] = useState('');
  const [actions, setActions] = useState<UniversalCaptureAction[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [hasMicSupport, setHasMicSupport] = useState(false);
  const [aiEnhancedInput, setAiEnhancedInput] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string>('local-demo-user');

  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const addTask = useTaskStore((s) => s.addTask);

  const accounts = useFinanceStore((s) => s.accounts);
  const categories = useFinanceStore((s) => s.categories);
  const loadFinanceData = useFinanceStore((s) => s.loadFinanceData);
  const addTransaction = useFinanceStore((s) => s.addTransaction);

  const mealTemplates = useFitnessStore((s) => s.mealTemplates);
  const supplements = useFitnessStore((s) => s.supplementInventory);
  const isFitnessEnabled = isFitnessModuleEnabled(
    useGamificationStore((s) => s.settings)
  );
  const fitnessLoaded = useFitnessStore((s) => s.hasLoaded);
  const loadFitnessData = useFitnessStore((s) => s.loadFitnessData);
  const logFromTemplate = useFitnessStore((s) => s.logFromTemplate);
  const upsertMealFromCapture = useFitnessStore((s) => s.upsertMealFromCapture);
  const addWorkoutSession = useFitnessStore((s) => s.addWorkoutSession);
  const upsertDailyLog = useFitnessStore((s) => s.upsertDailyLog);
  const incrementWater = useFitnessStore((s) => s.incrementWater);
  const incrementSteps = useFitnessStore((s) => s.incrementSteps);
  const takeSupplementDose = useFitnessStore((s) => s.takeSupplementDose);

  const pinnedTemplates = useMemo(
    () => mealTemplates.filter((t) => !t.deletedAt && t.isPinned).slice(0, 6),
    [mealTemplates]
  );

  // Detect Web Speech API support on client
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    setHasMicSupport(Boolean(win.SpeechRecognition || win.webkitSpeechRecognition));
  }, []);

  // Resolve active user session & hydrate Finance + Fitness stores when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const hydrate = async () => {
      let uid = useFitnessStore.getState().currentUserId || sessionUserId || 'local-demo-user';
      try {
        const {
          data: { session },
        } = await getSupabaseClient().auth.getSession();
        if (session?.user?.id) {
          uid = session.user.id;
        }
      } catch {
        // Offline / demo session
      }
      if (!active) return;
      setSessionUserId(uid);

      if (accounts.length === 0 || categories.length === 0) {
        loadFinanceData(uid).catch(() => undefined);
      }
      if (!fitnessLoaded) {
        loadFitnessData(uid).catch(() => undefined);
      }
    };
    hydrate();
    return () => {
      active = false;
    };
  }, [isOpen, sessionUserId, accounts.length, categories.length, fitnessLoaded, loadFinanceData, loadFitnessData]);

  // Listen to global open triggers (MobileNav [+], Cmd+K, Q, ?capture=1)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (
        e.key.toLowerCase() === 'q' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    const handleCustomOpen = () => setIsOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-quick-capture', handleCustomOpen);

    // PWA shortcut ?capture=1 support without requiring Next useSearchParams Suspense
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('capture') === '1') {
        setIsOpen(true);
      }
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-quick-capture', handleCustomOpen);
    };
  }, []);

  // Stop voice recording when modal closes
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    } else {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }
  }, [isOpen]);

  const parserContext = useMemo(
    () => ({
      todayIso: getLocalIsoDate(),
      accounts: accounts.filter((a) => !a.archived && !a.deletedAt).map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
      })),
      categories: categories.filter((c) => !c.archived && !c.deletedAt).map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        type: c.type,
      })),
      mealTemplates: isFitnessEnabled ? mealTemplates : [],
      supplements: isFitnessEnabled ? supplements : [],
    }),
    [accounts, categories, isFitnessEnabled, mealTemplates, supplements]
  );

  // Instant deterministic parse while typing (overridden only when AI enhance just produced actions for this exact text)
  useEffect(() => {
    if (!inputText.trim()) {
      setActions([]);
      setAiEnhancedInput(null);
      return;
    }
    if (aiEnhancedInput === inputText) return;
    const parsed = parseUniversalCapture(inputText, parserContext);
    const filtered = isFitnessEnabled
      ? parsed.actions
      : parsed.actions.filter(
          (a) =>
            a.kind !== 'meal' &&
            a.kind !== 'workout' &&
            a.kind !== 'bio' &&
            a.kind !== 'supplement'
        );
    setActions(filtered);
  }, [inputText, parserContext, aiEnhancedInput, isFitnessEnabled]);

  const toggleVoiceInput = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechCtor) {
      toast.error('Voice capture is not supported in this browser');
      return;
    }

    try {
      const recognition = new SpeechCtor();
      recognition.lang = 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = true;
      const baseText = inputText.trim();

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0]?.transcript || '';
        }
        const combined = baseText ? `${baseText} + ${transcript.trim()}` : transcript.trim();
        setAiEnhancedInput(null);
        setInputText(combined);
      };

      recognition.onerror = () => {
        setIsListening(false);
        toast.error('Microphone error — check permission or type manually');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      toast.error('Could not start voice capture');
    }
  }, [isListening, inputText]);

  const handleAiEnhance = async () => {
    if (!inputText.trim() || isAiParsing) return;
    setIsAiParsing(true);
    try {
      const res = await fetch('/api/ai/universal-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          accounts: parserContext.accounts,
          categories: parserContext.categories,
          mealTemplates: mealTemplates.slice(0, 16),
          supplements: supplements.slice(0, 16),
        }),
      });
      if (!res.ok) {
        toast.info('Using instant offline Hinglish parser');
        return;
      }
      const data = await res.json();
      if (Array.isArray(data?.actions) && data.actions.length > 0) {
        const nextActions = isFitnessEnabled
          ? data.actions
          : data.actions.filter(
              (a: UniversalCaptureAction) =>
                a.kind !== 'meal' &&
                a.kind !== 'workout' &&
                a.kind !== 'bio' &&
                a.kind !== 'supplement'
            );
        setActions(nextActions);
        setAiEnhancedInput(inputText);
        toast.success(data.source === 'gemini' ? 'Parsed with Gemini' : 'Parsed locally');
      }
    } catch {
      toast.info('Offline mode — instant local parser ready');
    } finally {
      setIsAiParsing(false);
    }
  };

  const updateAction = <T extends UniversalCaptureAction>(
    id: string,
    updater: (prev: T) => T
  ) => {
    setActions((prev) =>
      prev.map((a) => (a.id === id ? updater(a as T) : a))
    );
  };

  const handleQuickWater = async (ml: number) => {
    await incrementWater(ml, getLocalIsoDate(), sessionUserId);
    toast.success(`+${ml}ml water logged`);
  };

  const handleQuickSteps = async (delta: number) => {
    await incrementSteps(delta, getLocalIsoDate(), sessionUserId);
    toast.success(`+${delta.toLocaleString()} steps logged`);
  };

  const handleQuickStaple = async (templateId: string, name: string) => {
    const logged = await logFromTemplate(
      templateId,
      { date: getLocalIsoDate(), source: 'universal_capture' },
      sessionUserId
    );
    if (logged) {
      toast.success(`Logged ${name} (${logged.calories} kcal · ${logged.proteinG}g protein)`);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const activeActions = actions.filter((a) => a.enabled);
    if (activeActions.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    const uid = sessionUserId;
    const createdTxIdsByActionId = new Map<string, string>();
    const logsSummary: string[] = [];

    try {
      // Ensure finance accounts/categories are loaded before adding an expense
      const hasExpense = activeActions.some((a) => a.kind === 'expense');
      if (hasExpense && (!accounts.length || !categories.length)) {
        await loadFinanceData(uid);
      }

      const freshAccounts = useFinanceStore.getState().accounts.filter((a) => !a.archived && !a.deletedAt);
      const freshCategories = useFinanceStore.getState().categories.filter((c) => !c.archived && !c.deletedAt);

      // 1. Expenses first so linked meals receive linkedTransactionId (preventing duplicates)
      for (const action of activeActions) {
        if (action.kind !== 'expense') continue;
        const accountId = action.accountId || freshAccounts[0]?.id;
        const categoryId =
          action.categoryId ||
          (action.isJunkFood
            ? freshCategories.find((c) => c.slug.includes('junk') || /junk\s*food/i.test(c.name))?.id
            : undefined) ||
          freshCategories[0]?.id;

        if (!accountId || !categoryId) {
          toast.error('Create a Finance account & category first before logging expenses');
          continue;
        }

        const tx = await addTransaction({
          title: action.title,
          amount: action.amount,
          type: action.txType,
          categoryId,
          accountId,
          date: action.date,
          tags: ['universal-capture'],
        });
        createdTxIdsByActionId.set(action.id, tx.id);
        logsSummary.push(`₹${tx.amount} ${tx.title}`);
      }

      // 2. Meals (updates/creates cleanly by linkedTransactionId so zero duplicate meals occur)
      for (const action of activeActions) {
        if (action.kind !== 'meal') continue;
        const linkedTxId = action.linkedExpenseActionId
          ? createdTxIdsByActionId.get(action.linkedExpenseActionId) || null
          : null;

        await upsertMealFromCapture({
          userId: uid,
          date: action.date,
          name: action.name,
          calories: action.calories,
          proteinG: action.proteinG,
          carbsG: action.carbsG,
          fatG: action.fatG,
          mealType: action.mealType,
          isJunk: action.isJunk,
          linkedTransactionId: linkedTxId,
          templateId: action.templateId || null,
        });
        logsSummary.push(`${action.name} (${action.calories} kcal)`);
      }

      // 3. Workouts
      for (const action of activeActions) {
        if (action.kind !== 'workout') continue;
        await addWorkoutSession(
          {
            date: action.date,
            title: action.title,
            workoutType: action.workoutType,
            durationMinutes: action.durationMinutes,
            estimatedCaloriesBurned: action.estimatedCaloriesBurned,
            exercises: action.exercises,
            source: 'universal_capture',
          },
          uid
        );
        logsSummary.push(`${action.title} (${action.durationMinutes}m)`);
      }

      // 4. Bio check-in (steps, water, sleep, energy, weight, waist)
      for (const action of activeActions) {
        if (action.kind !== 'bio') continue;
        if (action.waterDeltaMl) {
          await incrementWater(action.waterDeltaMl, action.date, uid);
        }
        if (action.stepsDelta) {
          await incrementSteps(action.stepsDelta, action.date, uid);
        }
        const patch: Record<string, number> = {};
        if (action.stepsExact !== undefined) patch.steps = action.stepsExact;
        if (action.sleepHours !== undefined) patch.sleepHours = action.sleepHours;
        if (action.energyLevel !== undefined) patch.energyLevel = action.energyLevel;
        if (action.weightKg !== undefined) patch.weightKg = action.weightKg;
        if (action.waistInches !== undefined) patch.waistInches = action.waistInches;
        if (Object.keys(patch).length > 0) {
          await upsertDailyLog(action.date, patch, uid);
        }
        logsSummary.push('Bio check-in');
      }

      // 5. Supplements
      for (const action of activeActions) {
        if (action.kind !== 'supplement') continue;
        const target =
          (action.supplementId
            ? supplements.find((s) => s.id === action.supplementId && !s.deletedAt)
            : undefined) ||
          supplements.find(
            (s) =>
              !s.deletedAt &&
              s.name.toLowerCase().includes(action.supplementName.toLowerCase())
          );

        if (target) {
          await takeSupplementDose(target.id, action.servings, action.date, null, uid);
          logsSummary.push(target.name);
        } else {
          toast.info(`Add "${action.supplementName}" in Fitness → Supplements to track stock`);
        }
      }

      // 6. Tasks
      for (const action of activeActions) {
        if (action.kind !== 'task') continue;
        await addTask({
          title: action.title,
          priority: action.priority,
          isUrgent: action.isUrgent,
          due_date: action.dueDate,
          estimatedTime: action.estimateMinutes,
          tags: action.domainTag ? [action.domainTag] : [],
          metadata: {
            ...(action.dueTime ? { dueTime: action.dueTime } : {}),
            ...(action.domainTag ? { domain: action.domainTag } : {}),
          },
        });
        logsSummary.push(`Task: ${action.title}`);
      }

      toast.success(`Logged ${logsSummary.length} item${logsSummary.length > 1 ? 's' : ''}`, {
        description: logsSummary.join(' · '),
      });

      setInputText('');
      setActions([]);
      setAiEnhancedInput(null);
      setIsOpen(false);
    } catch (err) {
      console.error('[UniversalCapture] Submit error:', err);
      toast.error('Failed to save capture');
    } finally {
      setIsSubmitting(false);
    }
  };

  const enabledCount = actions.filter((a) => a.enabled).length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto p-0 border-border/80 bg-card shadow-2xl rounded-2xl">
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-border/60">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Zap className="h-4 w-4 text-primary" />
              10-Second Universal Capture
            </DialogTitle>
            <div className="flex items-center gap-1.5 mr-6">
              <Badge variant="outline" className="text-[10px] font-normal">
                Hinglish + Compound
              </Badge>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border border-border text-muted-foreground">
                ⌘K
              </kbd>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          {/* Natural Language Input + Voice Mic + AI Enhance */}
          <div className="relative flex items-center gap-1.5 rounded-xl border border-input bg-background px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-primary/30">
            <Input
              ref={inputRef}
              value={inputText}
              onChange={(e) => {
                setAiEnhancedInput(null);
                setInputText(e.target.value);
              }}
              placeholder='Try: "momo 60 slice", "4 eggs + oats + milk", "push workout 45m + 9000 steps"'
              className="border-0 bg-transparent px-1 py-1 text-sm sm:text-base shadow-none focus-visible:ring-0"
              autoComplete="off"
            />
            {inputText && (
              <button
                type="button"
                onClick={() => {
                  setInputText('');
                  setActions([]);
                }}
                aria-label="Clear capture text"
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {hasMicSupport && (
              <Button
                type="button"
                size="icon"
                variant={isListening ? 'destructive' : 'ghost'}
                onClick={toggleVoiceInput}
                title="Speak in Hinglish / English (en-IN)"
                className={cn('h-8 w-8 shrink-0 rounded-lg', isListening && 'animate-pulse')}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!inputText.trim() || isAiParsing}
              onClick={handleAiEnhance}
              title="Refine compound log with Gemini"
              className="h-8 px-2.5 text-xs shrink-0 gap-1"
            >
              {isAiParsing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              )}
              <span className="hidden sm:inline">AI</span>
            </Button>
          </div>

          {/* Sample prompt pills when empty */}
          {!inputText.trim() && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap gap-1.5">
                {(isFitnessEnabled ? EXAMPLE_PROMPTS : [EXAMPLE_PROMPTS[0]]).map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setInputText(sample)}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {sample}
                  </button>
                ))}
              </div>

              {/* 1-Tap Water, Steps & Pinned Staples */}
              {isFitnessEnabled && (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    1-Tap Instant Log
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickWater(250)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[11px] font-medium hover:bg-sky-500/20"
                    >
                      <Droplets className="h-3 w-3" /> +250ml
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickWater(500)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[11px] font-medium hover:bg-sky-500/20"
                    >
                      <Droplets className="h-3 w-3" /> +500ml
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickSteps(2000)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium hover:bg-emerald-500/20"
                    >
                      <Footprints className="h-3 w-3" /> +2k steps
                    </button>
                  </div>
                </div>

                {pinnedTemplates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {pinnedTemplates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => handleQuickStaple(tpl.id, tpl.name)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/70 bg-background hover:border-primary/50 text-xs transition-colors"
                      >
                        <Utensils className="h-3 w-3 text-primary" />
                        <span className="font-medium">{tpl.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {tpl.calories}k · {tpl.proteinG}g
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              )}
            </div>
          )}

          {/* Editable Compound Action Preview Cards */}
          {actions.length > 0 && (
            <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Detected Actions ({enabledCount}/{actions.length}) — tap fields to adjust
              </p>

              {actions.map((action) => (
                <div
                  key={action.id}
                  className={cn(
                    'rounded-xl border p-2.5 transition-all',
                    action.enabled
                      ? 'border-border bg-muted/25'
                      : 'border-border/40 bg-muted/10 opacity-50'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={action.enabled}
                        onChange={(e) =>
                          updateAction(action.id, (prev) => ({
                            ...prev,
                            enabled: e.target.checked,
                          }))
                        }
                        className="rounded border-border accent-primary h-4 w-4 shrink-0"
                      />

                      {action.kind === 'expense' && (
                        <div className="flex flex-wrap items-center gap-1.5 flex-1">
                          <Wallet className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                          <span className="text-xs font-semibold">Expense</span>
                          <Input
                            value={action.title}
                            onChange={(e) =>
                              updateAction<UniversalExpenseAction>(action.id, (p) => ({
                                ...p,
                                title: e.target.value,
                              }))
                            }
                            className="h-7 w-28 text-xs px-2"
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">₹</span>
                            <Input
                              type="number"
                              value={action.amount}
                              onChange={(e) =>
                                updateAction<UniversalExpenseAction>(action.id, (p) => ({
                                  ...p,
                                  amount: Math.max(0, Number(e.target.value) || 0),
                                }))
                              }
                              className="h-7 w-20 text-xs px-2"
                            />
                          </div>
                          {accounts.length > 0 && (
                            <select
                              value={action.accountId || ''}
                              onChange={(e) =>
                                updateAction<UniversalExpenseAction>(action.id, (p) => ({
                                  ...p,
                                  accountId: e.target.value,
                                  accountName:
                                    accounts.find((a) => a.id === e.target.value)?.name ||
                                    p.accountName,
                                }))
                              }
                              className="h-7 rounded-md border border-input bg-background px-1.5 text-xs"
                            >
                              {accounts
                                .filter((a) => !a.archived && !a.deletedAt)
                                .map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.name}
                                  </option>
                                ))}
                            </select>
                          )}
                          <Badge
                            variant={action.isJunkFood ? 'destructive' : 'secondary'}
                            className="text-[10px]"
                          >
                            {action.categoryName}
                          </Badge>
                        </div>
                      )}

                      {action.kind === 'meal' && (
                        <div className="flex flex-wrap items-center gap-1.5 flex-1">
                          <Utensils className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span className="text-xs font-semibold">Meal</span>
                          <Input
                            value={action.name}
                            onChange={(e) =>
                              updateAction<UniversalMealAction>(action.id, (p) => ({
                                ...p,
                                name: e.target.value,
                              }))
                            }
                            className="h-7 w-32 text-xs px-2"
                          />
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              value={action.calories}
                              onChange={(e) =>
                                updateAction<UniversalMealAction>(action.id, (p) => ({
                                  ...p,
                                  calories: Math.max(0, Number(e.target.value) || 0),
                                }))
                              }
                              className="h-7 w-16 text-xs px-1.5"
                            />
                            <span className="text-[11px] text-muted-foreground">kcal</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              value={action.proteinG}
                              onChange={(e) =>
                                updateAction<UniversalMealAction>(action.id, (p) => ({
                                  ...p,
                                  proteinG: Math.max(0, Number(e.target.value) || 0),
                                }))
                              }
                              className="h-7 w-14 text-xs px-1.5"
                            />
                            <span className="text-[11px] text-muted-foreground">g P</span>
                          </div>
                          {action.isJunk && (
                            <Badge variant="destructive" className="text-[10px]">
                              Junk
                            </Badge>
                          )}
                        </div>
                      )}

                      {action.kind === 'workout' && (
                        <div className="flex flex-wrap items-center gap-1.5 flex-1">
                          <Dumbbell className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span className="text-xs font-semibold">{action.title}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {action.durationMinutes} min · {action.workoutType}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            (~{action.estimatedCaloriesBurned} kcal)
                          </span>
                        </div>
                      )}

                      {action.kind === 'bio' && (
                        <div className="flex flex-wrap items-center gap-1.5 flex-1">
                          <Moon className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                          <span className="text-xs font-semibold">Bio &amp; Activity</span>
                          {action.stepsExact !== undefined && (
                            <Badge variant="secondary" className="text-[10px]">
                              {action.stepsExact.toLocaleString()} steps
                            </Badge>
                          )}
                          {action.stepsDelta !== undefined && (
                            <Badge variant="secondary" className="text-[10px]">
                              +{action.stepsDelta.toLocaleString()} steps
                            </Badge>
                          )}
                          {action.waterDeltaMl !== undefined && (
                            <Badge variant="secondary" className="text-[10px]">
                              +{action.waterDeltaMl}ml water
                            </Badge>
                          )}
                          {action.sleepHours !== undefined && (
                            <Badge variant="secondary" className="text-[10px]">
                              {action.sleepHours}h sleep
                            </Badge>
                          )}
                          {action.energyLevel !== undefined && (
                            <Badge variant="secondary" className="text-[10px]">
                              Energy {action.energyLevel}/5
                            </Badge>
                          )}
                          {action.weightKg !== undefined && (
                            <Badge variant="secondary" className="text-[10px]">
                              {action.weightKg} kg
                            </Badge>
                          )}
                          {action.waistInches !== undefined && (
                            <Badge variant="secondary" className="text-[10px]">
                              Waist {action.waistInches}&quot;
                            </Badge>
                          )}
                        </div>
                      )}

                      {action.kind === 'supplement' && (
                        <div className="flex flex-wrap items-center gap-1.5 flex-1">
                          <Pill className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                          <span className="text-xs font-semibold">
                            {action.supplementName}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {action.servings} serving
                          </Badge>
                        </div>
                      )}

                      {action.kind === 'task' && (
                        <div className="flex flex-wrap items-center gap-1.5 flex-1">
                          <CheckSquare className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <span className="text-xs font-semibold">Task: {action.title}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {action.priority} · {action.dueDate}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer Submit */}
          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <span className="text-[11px] text-muted-foreground">
              {isListening ? 'Listening (en-IN)… speak naturally' : 'Offline-first · Auto-syncs across devices'}
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={enabledCount === 0 || isSubmitting}
                className="gap-1.5"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Log {enabledCount > 1 ? `All (${enabledCount})` : enabledCount === 1 ? 'Item' : ''}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
