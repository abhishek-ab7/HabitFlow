'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowUpRight, Bell, BellRing, Check, CreditCard, HeartHandshake, Landmark, Pill, Repeat, Stethoscope, X,
} from 'lucide-react';
import type { UnifiedAdvanceAlert, UnifiedAlertKind } from './alert-computation';
import { useUnifiedAlertStore } from './useUnifiedAlertStore';

function AlertKindIcon({ kind }: { kind: UnifiedAlertKind }) {
  switch (kind) {
    case 'credit_card': return <CreditCard className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
    case 'emi': return <Landmark className="w-3.5 h-3.5 text-primary shrink-0" />;
    case 'commitment': return <HeartHandshake className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
    case 'health_task': return <Stethoscope className="w-3.5 h-3.5 text-sky-500 shrink-0" />;
    case 'supplement_low_stock': return <Pill className="w-3.5 h-3.5 text-teal-500 shrink-0" />;
    default: return <Repeat className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
  }
}

function AlertRow(params: {
  alert: UnifiedAdvanceAlert;
  onNavigate: (href: string) => void;
  onDismiss: (id: string) => void;
}) {
  const { alert, onNavigate, onDismiss } = params;
  return (
    <div className="p-3 flex items-start justify-between gap-2 hover:bg-muted/40 transition-colors">
      <button type="button" onClick={() => onNavigate(alert.href)} className="flex items-start gap-2.5 text-left min-w-0 flex-1">
        <span className="mt-0.5"><AlertKindIcon kind={alert.kind} /></span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{alert.title}</p>
          <p className="text-[11px] text-muted-foreground truncate">{alert.subtitle}</p>
          {alert.amount !== undefined && alert.amount > 0 && (
            <p className="text-[11px] font-mono font-bold text-foreground mt-0.5">₹{Math.round(alert.amount).toLocaleString('en-IN')}</p>
          )}
        </div>
      </button>
      <div className="flex items-center gap-1 shrink-0">
        <button type="button" onClick={() => onNavigate(alert.href)} aria-label={`Open ${alert.title}`} className="p-1 rounded-md text-muted-foreground hover:text-primary">
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => onDismiss(alert.id)} aria-label={`Dismiss ${alert.title}`} className="p-1 rounded-md text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function AlertsPopoverPanel(params: {
  visibleAlerts: UnifiedAdvanceAlert[];
  notificationPermission: NotificationPermission | 'unsupported';
  onClose: () => void;
  onNavigate: (href: string) => void;
  onDismiss: (id: string) => void;
  onEnableNotifications: () => void;
}) {
  const { visibleAlerts, notificationPermission, onClose, onNavigate, onDismiss, onEnableNotifications } = params;
  return (
    <>
      <div className="fixed inset-0 z-40 sm:hidden" onClick={onClose} aria-hidden="true" />
      <div data-testid="header-alerts-popover" className="fixed inset-x-3 top-16 sm:inset-x-auto sm:top-auto sm:absolute sm:right-0 sm:mt-2 sm:w-96 max-w-[calc(100vw-24px)] rounded-2xl border border-border bg-card shadow-xl z-50 overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-foreground">3-Day Advance Alerts ({visibleAlerts.length})</p>
            <p className="text-[11px] text-muted-foreground">CC bills, EMIs, rent, health tasks &amp; supplement refills</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close alerts panel" className="p-1 rounded-lg text-muted-foreground hover:text-foreground">
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
              <AlertRow key={alert.id} alert={alert} onNavigate={onNavigate} onDismiss={onDismiss} />
            ))
          )}
        </div>

        {notificationPermission === 'default' && (
          <div className="px-4 py-2.5 border-t border-border bg-muted/30 flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">Desktop alerts disabled</span>
            <button type="button" onClick={onEnableNotifications} data-testid="enable-browser-notifications-btn" className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 transition-opacity">
              Enable Browser Alerts
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export function HeaderAlertsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const alerts = useUnifiedAlertStore((s) => s.alerts);
  const dismissedIds = useUnifiedAlertStore((s) => s.dismissedIds);
  const dismissAlert = useUnifiedAlertStore((s) => s.dismissAlert);
  const notificationPermission = useUnifiedAlertStore((s) => s.notificationPermission);
  const requestBrowserPermission = useUnifiedAlertStore((s) => s.requestBrowserPermission);

  const visibleAlerts = alerts.filter((a) => !dismissedIds.includes(a.id));

  const handleEnableNotifications = async () => {
    const result = await requestBrowserPermission();
    if (result === 'granted') toast.success('Browser alerts enabled for 3-day bills, health & supplement reminders.');
    else if (result === 'denied') toast.error('Browser notifications blocked. Enable them in browser site settings.');
  };

  const handleNavigate = (href: string) => {
    setOpen(false);
    router.push(href);
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
        {visibleAlerts.length > 0 ? <BellRing className="h-5 w-5 text-amber-500" /> : <Bell className="h-5 w-5" />}
        {visibleAlerts.length > 0 && (
          <span data-testid="header-alerts-badge" className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {visibleAlerts.length > 9 ? '9+' : visibleAlerts.length}
          </span>
        )}
      </button>

      {open && (
        <AlertsPopoverPanel
          visibleAlerts={visibleAlerts}
          notificationPermission={notificationPermission}
          onClose={() => setOpen(false)}
          onNavigate={handleNavigate}
          onDismiss={dismissAlert}
          onEnableNotifications={handleEnableNotifications}
        />
      )}
    </div>
  );
}
