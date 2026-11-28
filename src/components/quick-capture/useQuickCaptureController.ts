'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useTaskStore } from '@/lib/stores/task-store';
import { useFinanceStore } from '@/lib/stores/finance-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import { isFitnessModuleEnabled } from '@/lib/workspace-modules';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { parseUniversalCapture, type UniversalCaptureAction } from '@/lib/quick-capture/universal-parser';
import type { AmbiguityPrompt, DuplicateWarning, RecentTransactionRef } from '@/lib/ai/graphs/capture-state';
import { useFeedback } from '@/hooks/use-feedback';
import { executeQuickCaptureSubmit } from './capture-submit';
import { useQuickCaptureHydration, useQuickCaptureShortcuts } from './capture-hooks';
import { useVoiceCapture } from './capture-voice';

const FITNESS_ACTION_KINDS = new Set(['meal', 'workout', 'bio', 'supplement']);

function filterActionsByModule(actions: UniversalCaptureAction[], isFitnessEnabled: boolean): UniversalCaptureAction[] {
  return isFitnessEnabled ? actions : actions.filter((a) => !FITNESS_ACTION_KINDS.has(a.kind));
}

export function useQuickCaptureController(params: {
  defaultOpen: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  initialVoiceText?: string;
  initialVoiceSeq?: number;
}) {
  const [isOpen, setIsOpen] = useState(params.defaultOpen);
  const [inputText, setInputText] = useState('');
  const [actions, setActions] = useState<UniversalCaptureAction[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiEnhancedInput, setAiEnhancedInput] = useState<string | null>(null);
  const [ambiguities, setAmbiguities] = useState<AmbiguityPrompt[]>([]);
  const [duplicateWarnings, setDuplicateWarnings] = useState<DuplicateWarning[]>([]);
  const [sessionUserId, setSessionUserId] = useState<string>('local-demo-user');
  const feedback = useFeedback();

  const addTask = useTaskStore((s) => s.addTask);
  const accounts = useFinanceStore((s) => s.accounts);
  const categories = useFinanceStore((s) => s.categories);
  const transactions = useFinanceStore((s) => s.transactions);
  const loadFinanceData = useFinanceStore((s) => s.loadFinanceData);
  const addTransaction = useFinanceStore((s) => s.addTransaction);

  const mealTemplates = useFitnessStore((s) => s.mealTemplates);
  const supplements = useFitnessStore((s) => s.supplementInventory);
  const isFitnessEnabled = isFitnessModuleEnabled(useGamificationStore((s) => s.settings));
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

  useQuickCaptureHydration({
    isOpen, sessionUserId, setSessionUserId,
    accountsLength: accounts.length, categoriesLength: categories.length,
    fitnessLoaded, loadFinanceData, loadFitnessData,
  });
  useQuickCaptureShortcuts(setIsOpen);
  const voice = useVoiceCapture({ isOpen, inputText, setInputText, setAiEnhancedInput });

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => params.inputRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [isOpen, params.inputRef]);

  const parserContext = useMemo(() => ({
    todayIso: getLocalIsoDate(),
    accounts: accounts.filter((a) => !a.archived && !a.deletedAt).map((a) => ({ id: a.id, name: a.name, type: a.type })),
    categories: categories.filter((c) => !c.archived && !c.deletedAt).map((c) => ({ id: c.id, name: c.name, slug: c.slug, type: c.type })),
    mealTemplates: isFitnessEnabled ? mealTemplates : [],
    supplements: isFitnessEnabled ? supplements : [],
  }), [accounts, categories, isFitnessEnabled, mealTemplates, supplements]);

  const recentTransactions = useMemo<RecentTransactionRef[]>(() => {
    const cutoffMs = Date.now() - 48 * 60 * 60 * 1000;
    return (transactions || [])
      .filter((t) => !t.deletedAt && Date.parse(t.date) >= cutoffMs)
      .slice(0, 40)
      .map((t) => ({ id: t.id, title: t.title, amount: t.amount, date: t.date }));
  }, [transactions]);

  useEffect(() => {
    if (!inputText.trim()) {
      setActions([]);
      setAiEnhancedInput(null);
      setAmbiguities([]);
      setDuplicateWarnings([]);
      return;
    }
    if (aiEnhancedInput === inputText) return;
    setAmbiguities([]);
    setDuplicateWarnings([]);
    const parsed = parseUniversalCapture(inputText, parserContext);
    setActions(filterActionsByModule(parsed.actions, isFitnessEnabled));
  }, [inputText, parserContext, aiEnhancedInput, isFitnessEnabled]);

  const handleAiEnhance = async (textOverride?: string) => {
    const queryText = (typeof textOverride === 'string' ? textOverride : inputText).trim();
    if (!queryText || isAiParsing) return;
    setIsAiParsing(true);
    try {
      const res = await fetch('/api/ai/universal-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: queryText,
          accounts: parserContext.accounts,
          categories: parserContext.categories,
          mealTemplates: mealTemplates.slice(0, 16),
          supplements: supplements.slice(0, 16),
          recentTransactions,
        }),
      });
      if (!res.ok) return void toast.info('Using instant offline Hinglish parser');
      const data = await res.json();
      if (Array.isArray(data?.actions) && data.actions.length > 0) {
        setActions(filterActionsByModule(data.actions, isFitnessEnabled));
        setAiEnhancedInput(queryText);
        setAmbiguities(Array.isArray(data?.ambiguities) ? data.ambiguities : []);
        setDuplicateWarnings(Array.isArray(data?.duplicateWarnings) ? data.duplicateWarnings : []);
        if (data.status === 'AWAITING_HUMAN') {
          toast.info('Quick check needed before logging');
        } else {
          toast.success(data.source === 'gemini' ? 'Parsed with Gemini' : 'Parsed locally');
        }
      }
    } catch {
      toast.info('Offline mode — instant local parser ready');
    } finally {
      setIsAiParsing(false);
    }
  };

  useEffect(() => {
    const voiceText = params.initialVoiceText?.trim();
    if (!voiceText || !params.initialVoiceSeq) return;
    setIsOpen(true);
    setInputText(voiceText);
    setAiEnhancedInput(null);
    void handleAiEnhance(voiceText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.initialVoiceSeq]);

  const updateAction = <T extends UniversalCaptureAction>(id: string, updater: (prev: T) => T) => {
    setActions((prev) => prev.map((a) => (a.id === id ? updater(a as T) : a)));
  };

  const resolveAmbiguity = (
    ambiguityId: string,
    actionId: string,
    accountId: string,
    accountName: string
  ) => {
    setActions((prev) =>
      prev.map((a) =>
        a.id === actionId && a.kind === 'expense' ? { ...a, accountId, accountName } : a
      )
    );
    setAmbiguities((prev) => prev.filter((item) => item.id !== ambiguityId));
  };

  const resolveDuplicate = (warningId: string, actionId: string, decision: 'keep' | 'skip') => {
    if (decision === 'skip') {
      setActions((prev) => prev.map((a) => (a.id === actionId ? { ...a, enabled: false } : a)));
    }
    setDuplicateWarnings((prev) => prev.filter((item) => item.id !== warningId));
  };

  const hasPendingClarifications = ambiguities.length > 0 || duplicateWarnings.length > 0;

  const handleQuickWater = async (ml: number) => {
    feedback.complete();
    await incrementWater(ml, getLocalIsoDate(), sessionUserId);
    toast.success(`+${ml}ml water logged`);
  };

  const handleQuickSteps = async (delta: number) => {
    feedback.complete();
    await incrementSteps(delta, getLocalIsoDate(), sessionUserId);
    toast.success(`+${delta.toLocaleString()} steps logged`);
  };

  const handleQuickStaple = async (template: { id: string; name: string }) => {
    feedback.complete();
    const logged = await logFromTemplate(template.id, { date: getLocalIsoDate(), source: 'universal_capture' }, sessionUserId);
    if (logged) toast.success(`Logged ${template.name} (${logged.calories} kcal · ${logged.proteinG}g protein)`);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const activeActions = actions.filter((a) => a.enabled);
    if (activeActions.length === 0 || isSubmitting || hasPendingClarifications) {
      if (activeActions.length === 0 || hasPendingClarifications) feedback.warning();
      return;
    }

    feedback.success();
    setIsSubmitting(true);
    try {
      const logsSummary = await executeQuickCaptureSubmit({
        activeActions, uid: sessionUserId, accountsLength: accounts.length, categoriesLength: categories.length,
        supplements, loadFinanceData, addTransaction, upsertMealFromCapture, addWorkoutSession,
        incrementWater, incrementSteps, upsertDailyLog, takeSupplementDose, addTask,
      });
      toast.success(`Logged ${logsSummary.length} item${logsSummary.length > 1 ? 's' : ''}`, { description: logsSummary.join(' · ') });
      setInputText('');
      setActions([]);
      setAiEnhancedInput(null);
      setAmbiguities([]);
      setDuplicateWarnings([]);
      setIsOpen(false);
    } catch (err) {
      console.error('[UniversalCapture] Submit error:', err);
      toast.error('Failed to save capture');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isOpen, setIsOpen, inputText, setInputText, actions, setActions,
    isSubmitting, isAiParsing, ...voice, setAiEnhancedInput,
    accounts, pinnedTemplates, isFitnessEnabled,
    ambiguities, duplicateWarnings, hasPendingClarifications,
    enabledCount: actions.filter((a) => a.enabled).length,
    handleAiEnhance, updateAction, resolveAmbiguity, resolveDuplicate,
    handleQuickWater, handleQuickSteps, handleQuickStaple, handleSubmit,
  };
}
