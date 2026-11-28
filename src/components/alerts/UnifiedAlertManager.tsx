'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isFitnessModuleEnabled } from '@/lib/workspace-modules';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { computeUnified3DayAlerts, type UnifiedAdvanceAlert } from './alert-computation';
import { useUnifiedAlertStore } from './useUnifiedAlertStore';

export type { UnifiedAlertKind, UnifiedAdvanceAlert, UnifiedAlertScanInput } from './alert-computation';
export { computeUnified3DayAlerts } from './alert-computation';
export { useUnifiedAlertStore } from './useUnifiedAlertStore';
export { HeaderAlertsBell } from './HeaderAlertsBell';

function areAlertsEqual(prev: UnifiedAdvanceAlert[], next: UnifiedAdvanceAlert[]): boolean {
  if (prev.length !== next.length) return false;
  return prev.every((a, i) => a.id === next[i].id && a.daysUntil === next[i].daysUntil && a.severity === next[i].severity && a.amount === next[i].amount);
}

function maybeNotifyDailyToast(alerts: UnifiedAdvanceAlert[], todayIso: string) {
  if (alerts.length === 0 || typeof window === 'undefined') return;
  const key = `habitflow_unified_alert_toast_${todayIso}`;
  if (localStorage.getItem(key)) return;

  const top = alerts[0];
  const extraCount = alerts.length - 1;
  const summaryMsg = extraCount > 0 ? `${top.title} (+${extraCount} more alert${extraCount === 1 ? '' : 's'} in bell)` : top.title;
  toast.warning(summaryMsg, { description: top.subtitle, duration: 6000 });
  localStorage.setItem(key, '1');
}

function maybeFireBrowserNudge(alerts: UnifiedAdvanceAlert[], todayIso: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted' || !document.hidden) return;
  const highSignal = alerts.find(
    (a) => a.severity === 'critical' || a.kind === 'streak_recovery' || a.kind === 'envelope_80_pct'
  );
  if (!highSignal) return;
  const dedupeKey = `habitflow_push_nudge_${highSignal.id}_${todayIso}`;
  if (localStorage.getItem(dedupeKey)) return;
  try {
    new Notification(highSignal.title, { body: highSignal.subtitle, tag: highSignal.id });
    localStorage.setItem(dedupeKey, '1');
  } catch {
    // Non-blocking in browsers restricting Notification constructor
  }
}

async function fetchAlertScanInputs(userId: string, fitnessEnabled: boolean) {
  const [
    creditCardStatements,
    accounts,
    emiTrackers,
    commitments,
    recurringBills,
    transactions,
    tasks,
    supplementInventory,
    supplementLogs,
    categories,
    habits,
    habitCompletions,
  ] = await Promise.all([
    db.creditCardStatements.where('userId').equals(userId).filter((s) => !s.deletedAt).toArray(),
    db.financeAccounts.where('userId').equals(userId).filter((a) => !a.deletedAt && !a.archived).toArray(),
    db.emiTrackers.where('userId').equals(userId).filter((e) => !e.deletedAt).toArray(),
    db.monthlyCommitments.where('userId').equals(userId).filter((c) => !c.deletedAt).toArray(),
    db.financeRecurringBills.where('userId').equals(userId).filter((b) => !b.deletedAt).toArray(),
    db.financeTransactions.where('userId').equals(userId).filter((t) => !t.deletedAt).toArray(),
    db.tasks.where('userId').equals(userId).filter((t) => t.status !== 'done' && t.status !== 'archived').toArray(),
    fitnessEnabled ? db.supplementInventory.where('userId').equals(userId).filter((s) => !s.deletedAt).toArray() : Promise.resolve([]),
    fitnessEnabled ? db.supplementLogs.where('userId').equals(userId).filter((l) => !l.deletedAt).toArray() : Promise.resolve([]),
    db.financeCategories.where('userId').equals(userId).filter((c) => !c.deletedAt && !c.archived).toArray(),
    db.habits.where('userId').equals(userId).filter((h) => !h.archived).toArray(),
    db.completions.where('userId').equals(userId).toArray(),
  ]);
  return {
    creditCardStatements,
    accounts,
    emiTrackers,
    commitments,
    recurringBills,
    transactions,
    tasks,
    supplementInventory,
    supplementLogs,
    categories,
    habits,
    habitCompletions,
  };
}

async function runAlertScan(params: {
  fitnessEnabled: boolean;
  isActive: () => boolean;
  setAlerts: (alerts: UnifiedAdvanceAlert[]) => void;
}) {
  const { data: { session } } = await getSupabaseClient().auth.getSession();
  const userId = session?.user?.id;
  if (!userId || !params.isActive()) {
    if (params.isActive() && useUnifiedAlertStore.getState().alerts.length > 0) params.setAlerts([]);
    return;
  }

  const inputs = await fetchAlertScanInputs(userId, params.fitnessEnabled);
  if (!params.isActive()) return;

  const todayIso = getLocalIsoDate();
  const alerts = computeUnified3DayAlerts({ todayIso, ...inputs });
  if (!areAlertsEqual(useUnifiedAlertStore.getState().alerts, alerts)) params.setAlerts(alerts);
  maybeNotifyDailyToast(alerts, todayIso);
  maybeFireBrowserNudge(alerts, todayIso);
}

function scheduleIdleCallback(fn: () => void) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void, opts: { timeout: number }) => void }).requestIdleCallback(fn, { timeout: 2000 });
    return;
  }
  setTimeout(fn, 300);
}

export function UnifiedAlertManager() {
  const setAlerts = useUnifiedAlertStore((s) => s.setAlerts);
  const syncPermissionState = useUnifiedAlertStore((s) => s.syncPermissionState);
  const settings = useGamificationStore((s) => s.settings);
  const fitnessEnabled = isFitnessModuleEnabled(settings);
  const scanningRef = useRef(false);

  useEffect(() => {
    syncPermissionState();
  }, [syncPermissionState]);

  useEffect(() => {
    let active = true;
    const isActive = () => active;

    const scanDexieAlerts = async () => {
      if (!active || scanningRef.current) return;
      scanningRef.current = true;
      try {
        await runAlertScan({ fitnessEnabled, isActive, setAlerts });
      } catch (err) {
        console.warn('[UnifiedAlertManager] Local Dexie alert scan skipped:', err);
      } finally {
        scanningRef.current = false;
      }
    };

    const scheduleScan = () => scheduleIdleCallback(() => { if (active) void scanDexieAlerts(); });
    scheduleScan();
    window.addEventListener('habitflow-sync-complete', scheduleScan);
    return () => {
      active = false;
      window.removeEventListener('habitflow-sync-complete', scheduleScan);
    };
  }, [setAlerts, fitnessEnabled]);

  return null;
}
