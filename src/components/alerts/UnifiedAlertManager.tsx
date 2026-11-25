'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { create } from 'zustand';
import { toast } from 'sonner';
import {
  Bell,
  BellRing,
  CreditCard,
  Landmark,
  HeartHandshake,
  Repeat,
  Stethoscope,
  Pill,
  Check,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { db } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isFitnessModuleEnabled } from '@/lib/workspace-modules';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { calculateSupplementStockAndRoi } from '@/lib/fitness/shared-analytics';
import { calculateCommitmentLedger } from '@/lib/finance/shared-analytics';
import {
  addDays,
  daysBetween,
  getLocalIsoDate,
  getValidDateInMonth,
  normalizeIsoDate,
  parseIsoDate,
} from '@/lib/finance/credit-card-cycles';
import type {
  CreditCardStatement,
  EmiTracker,
  FinanceAccount,
  FinanceRecurringBill,
  FinanceTransaction,
  MonthlyCommitment,
  SupplementInventory,
  SupplementLog,
  Task,
} from '@/lib/types';

export type UnifiedAlertKind =
  | 'credit_card'
  | 'emi'
  | 'commitment'
  | 'bill'
  | 'health_task'
  | 'supplement_low_stock';

export interface UnifiedAdvanceAlert {
  id: string;
  kind: UnifiedAlertKind;
  title: string;
  subtitle: string;
  dueDate: string;
  daysUntil: number;
  amount?: number;
  severity: 'critical' | 'warning' | 'info';
  href: string;
}

export interface UnifiedAlertScanInput {
  todayIso?: string;
  creditCardStatements?: CreditCardStatement[];
  accounts?: FinanceAccount[];
  emiTrackers?: EmiTracker[];
  commitments?: MonthlyCommitment[];
  recurringBills?: FinanceRecurringBill[];
  transactions?: FinanceTransaction[];
  tasks?: Task[];
  supplementInventory?: SupplementInventory[];
  supplementLogs?: SupplementLog[];
}

function isRecurringBillPaidForCycle(
  bill: FinanceRecurringBill,
  cycleMonthKey: string
): boolean {
  if (!bill.lastPaidMonthKey) return false;
  if (bill.lastPaidMonthKey === cycleMonthKey) return true;

  const [lastYearStr, lastMonthStr] = bill.lastPaidMonthKey.split('-');
  const [cycleYearStr, cycleMonthStr] = cycleMonthKey.split('-');
  const lastYear = Number(lastYearStr);
  const lastMonth = Number(lastMonthStr);
  const cycleYear = Number(cycleYearStr);
  const cycleMonth = Number(cycleMonthStr);
  if (
    !Number.isFinite(lastYear) ||
    !Number.isFinite(lastMonth) ||
    !Number.isFinite(cycleYear) ||
    !Number.isFinite(cycleMonth)
  ) {
    return false;
  }

  const monthsElapsed = (cycleYear - lastYear) * 12 + (cycleMonth - lastMonth);
  if (monthsElapsed < 0) return false;
  if (bill.cadence === 'quarterly') return monthsElapsed < 3;
  if (bill.cadence === 'yearly') return monthsElapsed < 12;
  return monthsElapsed === 0;
}

export function computeUnified3DayAlerts(
  input: UnifiedAlertScanInput
): UnifiedAdvanceAlert[] {
  const todayIso = normalizeIsoDate(input.todayIso || getLocalIsoDate()) || getLocalIsoDate();
  const { year, month } = parseIsoDate(todayIso);
  const currentMonthIndex = month - 1;
  const currentMonthKey = todayIso.slice(0, 7);

  const transactions = (input.transactions || []).filter((t) => !t.deletedAt);
  const alerts: UnifiedAdvanceAlert[] = [];

  const checkDayOfMonthCandidates = (dueDay: number): Array<{ dueDate: string; monthKey: string; daysUntil: number }> => {
    const thisMonthDate = getValidDateInMonth(year, currentMonthIndex, dueDay);
    const nextMonthDate = getValidDateInMonth(year, currentMonthIndex + 1, dueDay);
    const candidates: Array<{ dueDate: string; monthKey: string; daysUntil: number }> = [];

    const diffThis = daysBetween(todayIso, thisMonthDate);
    if (diffThis >= -7 && diffThis <= 3) {
      candidates.push({
        dueDate: thisMonthDate,
        monthKey: thisMonthDate.slice(0, 7),
        daysUntil: diffThis,
      });
    }

    const diffNext = daysBetween(todayIso, nextMonthDate);
    if (nextMonthDate !== thisMonthDate && diffNext >= 0 && diffNext <= 3) {
      candidates.push({
        dueDate: nextMonthDate,
        monthKey: nextMonthDate.slice(0, 7),
        daysUntil: diffNext,
      });
    }

    return candidates;
  };

  // 1. Credit Card Statements & Card Fallback Due Dates (<= 3 days or overdue)
  const accounts = (input.accounts || []).filter((a) => !a.deletedAt && !a.archived);
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const statements = (input.creditCardStatements || []).filter((s) => !s.deletedAt);
  const coveredCardIds = new Set<string>();

  for (const stmt of statements) {
    if (stmt.status === 'paid' || stmt.remainingDue <= 0 || !stmt.dueDate) continue;
    const dueIso = normalizeIsoDate(stmt.dueDate);
    const daysUntil = daysBetween(todayIso, dueIso);
    if (daysUntil > 3) continue;

    coveredCardIds.add(stmt.accountId);
    const cardName = accountById.get(stmt.accountId)?.name || 'Credit Card';
    alerts.push({
      id: `cc-stmt-${stmt.id}`,
      kind: 'credit_card',
      title: `${cardName} Bill ${daysUntil < 0 ? 'Overdue' : daysUntil === 0 ? 'Due Today' : `Due in ${daysUntil}d`}`,
      subtitle: `Statement ${stmt.cycleKey} · Due ${dueIso}`,
      dueDate: dueIso,
      daysUntil,
      amount: stmt.remainingDue,
      severity: daysUntil <= 0 ? 'critical' : 'warning',
      href: '/finance?tab=trackers',
    });
  }

  for (const card of accounts) {
    if (card.type !== 'credit_card' || !card.dueDay || coveredCardIds.has(card.id)) continue;
    const outstanding = card.balance < 0 ? Math.abs(card.balance) : card.balance;
    if (outstanding <= 0) continue;

    const candidates = checkDayOfMonthCandidates(card.dueDay);
    for (const c of candidates) {
      alerts.push({
        id: `cc-acc-${card.id}-${c.dueDate}`,
        kind: 'credit_card',
        title: `${card.name} Due ${c.daysUntil < 0 ? 'Overdue' : c.daysUntil === 0 ? 'Today' : `in ${c.daysUntil}d`}`,
        subtitle: `Card payment due ${c.dueDate}`,
        dueDate: c.dueDate,
        daysUntil: c.daysUntil,
        amount: outstanding,
        severity: c.daysUntil <= 0 ? 'critical' : 'warning',
        href: '/finance?tab=trackers',
      });
    }
  }

  // 2. Active EMIs due within 3 days (or recently overdue up to 7d)
  for (const emi of input.emiTrackers || []) {
    if (emi.status !== 'active' || emi.deletedAt || emi.paidMonths >= emi.tenureMonths) continue;
    const candidates = checkDayOfMonthCandidates(emi.billingDayOfMonth);
    for (const c of candidates) {
      const isPaidForCycle =
        emi.lastPaidMonthKey === c.monthKey ||
        transactions.some(
          (t) => t.linkedEmiId === emi.id && t.monthKey === c.monthKey
        );
      if (isPaidForCycle) continue;

      alerts.push({
        id: `emi-${emi.id}-${c.dueDate}`,
        kind: 'emi',
        title: `${emi.loanName} EMI ${c.daysUntil < 0 ? 'Overdue' : c.daysUntil === 0 ? 'Due Today' : `Due in ${c.daysUntil}d`}`,
        subtitle: `${emi.lenderName} · Month ${emi.paidMonths + 1}/${emi.tenureMonths}`,
        dueDate: c.dueDate,
        daysUntil: c.daysUntil,
        amount: emi.emiAmount,
        severity: c.daysUntil <= 0 ? 'critical' : 'warning',
        href: '/finance?tab=trackers',
      });
    }
  }

  // 3. Monthly Commitments / Rent due within 3 days
  for (const com of input.commitments || []) {
    if (!com.isActive || com.deletedAt) continue;
    const candidates = checkDayOfMonthCandidates(com.dueDayOfMonth);
    for (const c of candidates) {
      const ledger = calculateCommitmentLedger(com, c.monthKey, transactions);
      const remaining = Math.max(0, Number(ledger.remainingBalance || 0));
      if (remaining <= 0) continue;

      const isRent = com.category === 'rent' || /\brent\b/i.test(com.title);
      alerts.push({
        id: `commitment-${com.id}-${c.dueDate}`,
        kind: 'commitment',
        title: `${com.title} ${c.daysUntil < 0 ? 'Overdue' : c.daysUntil === 0 ? 'Due Today' : `Due in ${c.daysUntil}d`}`,
        subtitle: `${isRent ? 'Rent / Housing' : com.recipientName} · Due ${c.dueDate}`,
        dueDate: c.dueDate,
        daysUntil: c.daysUntil,
        amount: remaining,
        severity: c.daysUntil <= 0 ? 'critical' : 'warning',
        href: '/finance?tab=trackers',
      });
    }
  }

  // 4. Recurring Bills due within 3 days
  for (const bill of input.recurringBills || []) {
    if (!bill.isActive || bill.deletedAt) continue;
    const candidates = checkDayOfMonthCandidates(bill.dueDayOfMonth);
    for (const c of candidates) {
      if (isRecurringBillPaidForCycle(bill, c.monthKey)) continue;
      alerts.push({
        id: `bill-${bill.id}-${c.dueDate}`,
        kind: 'bill',
        title: `${bill.name} ${c.daysUntil < 0 ? 'Overdue' : c.daysUntil === 0 ? 'Due Today' : `Due in ${c.daysUntil}d`}`,
        subtitle: `Recurring ${bill.cadence} · Due ${c.dueDate}`,
        dueDate: c.dueDate,
        daysUntil: c.daysUntil,
        amount: bill.amount,
        severity: c.daysUntil <= 0 ? 'critical' : 'info',
        href: '/finance?tab=trackers',
      });
    }
  }

  // 5. Health-tagged Tasks due within 3 days or overdue
  for (const task of input.tasks || []) {
    if (task.status === 'done' || task.status === 'archived' || !task.due_date) continue;
    const isHealthTask = (task.tags || []).some(
      (tag) => tag.trim().toLowerCase() === 'health'
    );
    if (!isHealthTask) continue;

    const dueIso = normalizeIsoDate(task.due_date);
    if (dueIso.length !== 10) continue;
    const daysUntil = daysBetween(todayIso, dueIso);
    if (daysUntil > 3) continue;

    alerts.push({
      id: `health-task-${task.id}`,
      kind: 'health_task',
      title: `${task.title} (${daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'Due Today' : `in ${daysUntil}d`})`,
      subtitle: 'Health Task · Follow-up / Prescription',
      dueDate: dueIso,
      daysUntil,
      severity: daysUntil <= 0 ? 'critical' : 'warning',
      href: '/tasks',
    });
  }

  // 6. Supplement Low Stock (<= 5 days remaining)
  const supSummary = calculateSupplementStockAndRoi(
    input.supplementInventory || [],
    input.supplementLogs || [],
    todayIso
  );
  for (const item of supSummary.items) {
    if (item.daysRemaining === null || item.daysRemaining > 5) continue;
    const runoutDate = addDays(todayIso, Math.max(0, item.daysRemaining));
    alerts.push({
      id: `supplement-low-${item.supplement.id}`,
      kind: 'supplement_low_stock',
      title: `${item.supplement.name} Low Stock (${item.daysRemaining}d left)`,
      subtitle: `${item.derivedRemainingServings} ${item.supplement.unitLabel}s remaining · Restock before ${runoutDate}`,
      dueDate: runoutDate,
      daysUntil: item.daysRemaining,
      amount: item.supplement.costInr > 0 ? item.supplement.costInr : undefined,
      severity: item.daysRemaining <= 2 ? 'critical' : 'warning',
      href: '/fitness',
    });
  }

  // Dedupe & sort most urgent first
  const seenIds = new Set<string>();
  const deduped: UnifiedAdvanceAlert[] = [];
  for (const alert of alerts) {
    if (seenIds.has(alert.id)) continue;
    seenIds.add(alert.id);
    deduped.push(alert);
  }

  const sevOrder = { critical: 0, warning: 1, info: 2 };
  deduped.sort((a, b) => {
    if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
    return sevOrder[a.severity] - sevOrder[b.severity];
  });

  // Ignore any obsolete cycle reference if currentMonthKey unused
  void currentMonthKey;

  return deduped;
}

interface UnifiedAlertStoreState {
  alerts: UnifiedAdvanceAlert[];
  dismissedIds: string[];
  hasScanned: boolean;
  notificationPermission: NotificationPermission | 'unsupported';
  setAlerts: (alerts: UnifiedAdvanceAlert[]) => void;
  dismissAlert: (id: string) => void;
  syncPermissionState: () => void;
  requestBrowserPermission: () => Promise<NotificationPermission | 'unsupported'>;
}

export const useUnifiedAlertStore = create<UnifiedAlertStoreState>((set) => ({
  alerts: [],
  dismissedIds: [],
  hasScanned: false,
  notificationPermission:
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported',
  setAlerts: (alerts) => set({ alerts, hasScanned: true }),
  dismissAlert: (id) =>
    set((s) => ({
      dismissedIds: s.dismissedIds.includes(id) ? s.dismissedIds : [...s.dismissedIds, id],
    })),
  syncPermissionState: () => {
    const perm =
      typeof window !== 'undefined' && 'Notification' in window
        ? Notification.permission
        : 'unsupported';
    set({ notificationPermission: perm });
  },
  requestBrowserPermission: async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      set({ notificationPermission: 'unsupported' });
      return 'unsupported';
    }
    const result = await Notification.requestPermission();
    set({ notificationPermission: result });
    return result;
  },
}));

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

    const scanDexieAlerts = async () => {
      if (scanningRef.current) return;
      scanningRef.current = true;

      try {
        let userId: string | undefined;
        try {
          const supabase = getSupabaseClient();
          const {
            data: { session },
          } = await supabase.auth.getSession();
          userId = session?.user?.id;
        } catch {
          userId = undefined;
        }

        const filterByUser = <T extends { userId?: string }>(rows: T[]): T[] =>
          userId ? rows.filter((r) => !r.userId || r.userId === userId) : rows;

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
        ] = await Promise.all([
          db.creditCardStatements.toArray(),
          db.financeAccounts.toArray(),
          db.emiTrackers.toArray(),
          db.monthlyCommitments.toArray(),
          db.financeRecurringBills.toArray(),
          db.financeTransactions.toArray(),
          db.tasks.toArray(),
          db.supplementInventory.toArray(),
          db.supplementLogs.toArray(),
        ]);

        if (!active) return;

        const todayIso = getLocalIsoDate();
        const alerts = computeUnified3DayAlerts({
          todayIso,
          creditCardStatements: filterByUser(creditCardStatements),
          accounts: filterByUser(accounts),
          emiTrackers: filterByUser(emiTrackers),
          commitments: filterByUser(commitments),
          recurringBills: filterByUser(recurringBills),
          transactions: filterByUser(transactions),
          tasks: filterByUser(tasks),
          supplementInventory: fitnessEnabled ? filterByUser(supplementInventory) : [],
          supplementLogs: fitnessEnabled ? filterByUser(supplementLogs) : [],
        });

        setAlerts(alerts);

        if (alerts.length > 0 && typeof window !== 'undefined') {
          const toastStorageKey = `habitflow_unified_alert_toast_${todayIso}`;
          if (!localStorage.getItem(toastStorageKey)) {
            const top = alerts[0];
            const extraCount = alerts.length - 1;
            const summaryMsg =
              extraCount > 0
                ? `${top.title} (+${extraCount} more alert${extraCount === 1 ? '' : 's'} in bell)`
                : top.title;

            toast.warning(summaryMsg, {
              description: top.subtitle,
              duration: 6000,
            });

            localStorage.setItem(toastStorageKey, '1');
          }
        }
      } catch (err) {
        console.warn('[UnifiedAlertManager] Local Dexie alert scan skipped:', err);
      } finally {
        scanningRef.current = false;
      }
    };

    void scanDexieAlerts();

    const handleRefresh = () => {
      void scanDexieAlerts();
    };
    window.addEventListener('habitflow-sync-complete', handleRefresh);
    return () => {
      active = false;
      window.removeEventListener('habitflow-sync-complete', handleRefresh);
    };
  }, [setAlerts, fitnessEnabled]);

  return null;
}

function AlertKindIcon({ kind }: { kind: UnifiedAlertKind }) {
  switch (kind) {
    case 'credit_card':
      return <CreditCard className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
    case 'emi':
      return <Landmark className="w-3.5 h-3.5 text-primary shrink-0" />;
    case 'commitment':
      return <HeartHandshake className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
    case 'health_task':
      return <Stethoscope className="w-3.5 h-3.5 text-sky-500 shrink-0" />;
    case 'supplement_low_stock':
      return <Pill className="w-3.5 h-3.5 text-teal-500 shrink-0" />;
    default:
      return <Repeat className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
  }
}

export function HeaderAlertsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const alerts = useUnifiedAlertStore((s) => s.alerts);
  const dismissedIds = useUnifiedAlertStore((s) => s.dismissedIds);
  const dismissAlert = useUnifiedAlertStore((s) => s.dismissAlert);
  const notificationPermission = useUnifiedAlertStore((s) => s.notificationPermission);
  const requestBrowserPermission = useUnifiedAlertStore(
    (s) => s.requestBrowserPermission
  );

  const visibleAlerts = alerts.filter((a) => !dismissedIds.includes(a.id));

  const handleEnableNotifications = async () => {
    const result = await requestBrowserPermission();
    if (result === 'granted') {
      toast.success('Browser alerts enabled for 3-day bills, health & supplement reminders.');
    } else if (result === 'denied') {
      toast.error('Browser notifications blocked. Enable them in browser site settings.');
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-label={`Unified 3-day alerts (${visibleAlerts.length})`}
        data-testid="header-alerts-bell"
        className="relative inline-flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/70 transition-colors"
      >
        {visibleAlerts.length > 0 ? (
          <BellRing className="h-5 w-5 text-amber-500" />
        ) : (
          <Bell className="h-5 w-5" />
        )}
        {visibleAlerts.length > 0 && (
          <span
            data-testid="header-alerts-badge"
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center leading-none"
          >
            {visibleAlerts.length > 9 ? '9+' : visibleAlerts.length}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="header-alerts-popover"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-border bg-card shadow-xl z-50 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-foreground">
                3-Day Advance Alerts ({visibleAlerts.length})
              </p>
              <p className="text-[11px] text-muted-foreground">
                CC bills, EMIs, rent, health tasks &amp; supplement refills
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close alerts panel"
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-border/60">
            {visibleAlerts.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                <Check className="w-6 h-6 mx-auto mb-1.5 text-emerald-500" />
                No upcoming 3-day alerts or critical low-stock supplements.
              </div>
            ) : (
              visibleAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 flex items-start justify-between gap-2 hover:bg-muted/40 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      router.push(alert.href);
                    }}
                    className="flex items-start gap-2.5 text-left min-w-0 flex-1"
                  >
                    <span className="mt-0.5">
                      <AlertKindIcon kind={alert.kind} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {alert.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {alert.subtitle}
                      </p>
                      {alert.amount !== undefined && alert.amount > 0 && (
                        <p className="text-[11px] font-mono font-bold text-foreground mt-0.5">
                          ₹{Math.round(alert.amount).toLocaleString('en-IN')}
                        </p>
                      )}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        router.push(alert.href);
                      }}
                      aria-label={`Open ${alert.title}`}
                      className="p-1 rounded-md text-muted-foreground hover:text-primary"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissAlert(alert.id)}
                      aria-label={`Dismiss ${alert.title}`}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {notificationPermission === 'default' && (
            <div className="px-4 py-2.5 border-t border-border bg-muted/30 flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                Desktop alerts disabled
              </span>
              <button
                type="button"
                onClick={handleEnableNotifications}
                data-testid="enable-browser-notifications-btn"
                className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 transition-opacity"
              >
                Enable Browser Alerts
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
