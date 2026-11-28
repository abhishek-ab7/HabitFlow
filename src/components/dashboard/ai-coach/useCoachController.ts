'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { useAuth } from '@/providers/auth-provider';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { useUserStore } from '@/lib/stores/user-store';
import { useFinanceStore } from '@/lib/stores/finance-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import { useMoodStore } from '@/lib/stores/mood-store';
import { getIstIsoDate } from '@/lib/mcp/config';
import type { CoachActionProposal, CoachSwarmOutput } from '@/lib/ai/graphs/coach-swarm-types';
import {
  buildCoachContextPayload,
  formatCoachErrorMessage,
  readCachedCoachAdvice,
  requestDailyCoachBriefing,
  resolveCoachUserName,
  writeCachedCoachAdvice,
} from './coach-context';

export function useTypewriter(text: string, speed = 15, active = true) {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    if (!active || !text) {
      setDisplayedText(text);
      return;
    }

    setDisplayedText('');
    let i = 0;
    const timer = setInterval(() => {
      const char = text.charAt(i);
      setDisplayedText((prev) => prev + char);
      i++;
      if (i >= text.length) {
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed, active]);

  return displayedText;
}

function useCoachStoreInputs() {
  return {
    habits: useHabitStore((s) => s.habits),
    habitCompletions: useHabitStore((s) => s.completions),
    tasks: useTaskStore((s) => s.tasks),
    settings: useGamificationStore((s) => s.settings),
    financeTransactions: useFinanceStore((s) => s.transactions),
    financeCategories: useFinanceStore((s) => s.categories),
    financeDebtRecords: useFinanceStore((s) => s.debtRecords),
    getSpendingAnomalies: useFinanceStore((s) => s.getSpendingAnomalies),
    fitnessProfile: useFitnessStore((s) => s.profile),
    fitnessDailyLogs: useFitnessStore((s) => s.dailyLogs),
    fitnessMealLogs: useFitnessStore((s) => s.mealLogs),
    fitnessWorkoutSessions: useFitnessStore((s) => s.workoutSessions),
    fitnessSupplements: useFitnessStore((s) => s.supplementInventory),
    fitnessSupplementLogs: useFitnessStore((s) => s.supplementLogs),
    moodLogs: useMoodStore((s) => s.moodLogs),
  };
}

export function useCoachBriefingController(onNavigate: (target: string) => void) {
  const { user } = useAuth();
  const [data, setData] = useState<CoachSwarmOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedProposalIds, setDismissedProposalIds] = useState<string[]>([]);
  const stores = useCoachStoreInputs();

  const { displayName, email, isLoading: isLoadingUser, loadUser } = useUserStore(
    useShallow((s) => ({
      displayName: s.displayName,
      email: s.email,
      isLoading: s.isLoading,
      loadUser: s.loadUser,
    }))
  );

  const isFinanceEnabled = !stores.settings?.habitOnlyMode && stores.settings?.showFinance !== false;
  const anomalies = useMemo(
    () => (isFinanceEnabled ? stores.getSpendingAnomalies().slice(0, 2) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isFinanceEnabled, stores.getSpendingAnomalies, stores.financeTransactions]
  );

  useEffect(() => {
    if (user) loadUser();
  }, [user, loadUser]);

  useEffect(() => {
    if (!user?.id || !email || isLoadingUser || data || loading) return;
    const cached = readCachedCoachAdvice(
      `ai_coach_advice_${user.id}`,
      getIstIsoDate(),
      resolveCoachUserName(displayName, user.email)
    );
    if (cached) setData(cached);
  }, [user?.id, user?.email, email, isLoadingUser, data, loading, displayName]);

  const fetchAdvice = async (force = false) => {
    if (!user || isLoadingUser) return;
    const today = getIstIsoDate();
    const cacheKey = `ai_coach_advice_${user.id}`;
    const cached = !force ? readCachedCoachAdvice(cacheKey, today) : null;
    if (cached) {
      setData(cached);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const userName = resolveCoachUserName(displayName, user.email);
      const context = buildCoachContextPayload({ today, ...stores });
      const result = await requestDailyCoachBriefing({ userName, context, forceRefresh: true });
      writeCachedCoachAdvice(cacheKey, today, userName, result);
      setData(result);
      setDismissedProposalIds([]);
    } catch (err: unknown) {
      setError(formatCoachErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const dismissProposal = useCallback((id: string) => {
    setDismissedProposalIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const acceptProposal = useCallback(
    async (proposal: CoachActionProposal) => {
      if (proposal.kind === 'create_task') {
        const title = proposal.payload.title?.trim() || proposal.label;
        try {
          await useTaskStore.getState().addTask({
            title,
            description: proposal.description,
            priority: proposal.payload.priority ?? 'medium',
            due_date: `${getIstIsoDate()}T23:59:59`,
          });
          toast.success(`Task added: ${title}`);
          dismissProposal(proposal.id);
        } catch {
          toast.error('Failed to add task. Please try again.');
        }
        return;
      }

      if (proposal.kind === 'navigate') {
        onNavigate(proposal.payload.target || 'finance');
      }
    },
    [dismissProposal, onNavigate]
  );

  const visibleProposals = useMemo(
    () => (data?.actionProposals ?? []).filter((p) => !dismissedProposalIds.includes(p.id)),
    [data?.actionProposals, dismissedProposalIds]
  );

  return {
    data,
    loading,
    error,
    isFinanceEnabled,
    anomalies,
    consultedSpecialists: data?.consultedSpecialists ?? [],
    visibleProposals,
    fetchAdvice,
    acceptProposal,
    dismissProposal,
  };
}
