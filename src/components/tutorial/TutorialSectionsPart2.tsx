'use client';

import Link from 'next/link';
import {
  BarChart3, Brain, CreditCard, Keyboard, Layers, Receipt, Settings, Sparkles, TrendingUp, Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CORE_SHORTCUT_KEYS, NAV_SHORTCUT_KEYS } from './tutorial-data';

function SectionCtaBar({ title, subtitle, href, ctaLabel }: { title: string; subtitle: string; href: string; ctaLabel: string }) {
  return (
    <div className="p-4 bg-muted/20 border border-border/60 rounded-2xl flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <h4 className="text-xs font-bold text-foreground">{title}</h4>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      <Button asChild size="sm" className="h-8 rounded-xl text-xs font-semibold shrink-0">
        <Link href={href}>{ctaLabel}</Link>
      </Button>
    </div>
  );
}

export function FinanceTutorialSection() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-emerald-600"><Wallet className="w-6 h-6" /><h2 className="text-xl font-bold tracking-tight">Personal Finance Hub</h2></div>
        <p className="text-sm text-muted-foreground leading-relaxed">Total command over personal wealth: Safe-to-Spend burn pace, multi-account net worth, credit card cycle reconciliation, and automated tracker ledgers.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-emerald-500/15 bg-emerald-500/5">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-xs uppercase font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Safe-to-Spend &amp; Daily Pace</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">Calculates your exact remaining discretionary budget divided across days left in the month. The pace curve plots cumulative spending against ideal budget burn to prevent overspending.</CardContent>
        </Card>
        <Card className="border-emerald-500/15 bg-emerald-500/5">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-xs uppercase font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> Credit Card Statement Cycles</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">Reconcile statements with bill generation dates and grace periods. Separate unbilled spends from total balances to maximize interest-free credit and avoid late fees.</CardContent>
        </Card>
        <div className="p-4 border bg-muted/20 rounded-xl space-y-1.5 col-span-full">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5"><Layers className="w-4 h-4 text-emerald-500" /> Trackers Hub: Bills, EMIs, SIPs &amp; Friends Debt</h4>
          <div className="grid sm:grid-cols-2 gap-3 text-xs text-muted-foreground pt-1">
            <div><strong className="text-foreground">Bills &amp; Subscriptions:</strong> Calendar view of recurring charges with audit warnings for zombie subscriptions.</div>
            <div><strong className="text-foreground">EMIs &amp; Loans:</strong> Amortization schedules, monthly obligations, and payoff countdowns.</div>
            <div><strong className="text-foreground">SIPs &amp; Investments:</strong> Monthly systematic investment plans tracked towards net worth milestones.</div>
            <div><strong className="text-foreground">Friends Debt Ledger:</strong> Simple &ldquo;Who owes who&rdquo; ledger for tracking shared expenses and settlements.</div>
          </div>
        </div>
        <div className="p-4 border bg-muted/20 rounded-xl space-y-1.5 col-span-full">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5"><Receipt className="w-4 h-4 text-sky-500" /> Privacy-First SMS Import &amp; Ask Finances AI</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">Import transaction SMS messages directly in your browser. All parsing occurs locally with zero data sent to external servers. Ask questions like &ldquo;How much did I spend on dining this month?&rdquo; via the Ask Finances AI Drawer.</p>
        </div>
      </div>
      <SectionCtaBar title="Master your wealth" subtitle="Check your Safe-to-Spend burn rate, reconcile accounts, and log transactions." href="/finance" ctaLabel="Open Finance Hub" />
    </div>
  );
}

export function AnalyticsTutorialSection() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-teal-500"><BarChart3 className="w-6 h-6" /><h2 className="text-xl font-bold tracking-tight">Productivity Analytics</h2></div>
        <p className="text-sm text-muted-foreground leading-relaxed">Data-driven insights to monitor historical progress, heatmap densities, and consistency velocities over time.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="p-4 bg-muted/20 border rounded-xl">
          <span className="text-xs font-bold text-foreground block mb-1">Consistency Charts &amp; Heatmaps</span>
          <p className="text-[11px] text-muted-foreground leading-relaxed">View completion percentages, 52-week activity heatmaps, and weekly review summaries to spot seasonal habits and productivity drops.</p>
        </div>
        <div className="p-4 bg-muted/20 border rounded-xl">
          <span className="text-xs font-bold text-foreground block mb-1">Fatigue &amp; Correlation Scores</span>
          <p className="text-[11px] text-muted-foreground leading-relaxed">Identify which days of the week experience the highest completion rates vs friction days to plan rest and deep work effectively.</p>
        </div>
      </div>
      <SectionCtaBar title="Explore consistency patterns" subtitle="Review long-term performance velocity across all habits." href="/analytics" ctaLabel="Open Analytics" />
    </div>
  );
}

export function AiTutorialSection() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-indigo-500"><Sparkles className="w-6 h-6" /><h2 className="text-xl font-bold tracking-tight">AI Assistant &amp; Companion</h2></div>
        <p className="text-sm text-muted-foreground leading-relaxed">HabitFlow integrates Gemini AI to analyze your logs locally, generate smart goals, and provide personalized coaching.</p>
      </div>
      <div className="space-y-4">
        <div className="p-4 bg-muted/20 border rounded-2xl flex gap-3 items-start">
          <Sparkles className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-foreground">AI Coach Widget</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">The coach analyzes your completed habits and tasks database. It highlights your focal point, encourages recovery on rest days, and offers tactical advice directly on the dashboard.</p>
          </div>
        </div>
        <div className="p-4 bg-muted/20 border rounded-2xl flex gap-3 items-start">
          <Brain className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-foreground">Smart Habit &amp; Goal Scaffolding</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">Need help formulating a goal or habit stack? The AI scaffold generator writes SMART goals, targets, and breaks down custom milestones automatically based on simple text prompts.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsTutorialSection() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-slate-500"><Settings className="w-6 h-6" /><h2 className="text-xl font-bold tracking-tight">Settings &amp; Customization</h2></div>
        <p className="text-sm text-muted-foreground leading-relaxed">Configure themes, manage data backups, adjust sensory feedback, replenish Streak Shields, and replay guided tours.</p>
      </div>
      <div className="space-y-4">
        <div className="p-4 border rounded-2xl bg-muted/20 space-y-1.5">
          <h4 className="text-sm font-bold text-foreground">Theme &amp; Accent Palettes</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">Switch between Light, Dark, or System mode and pick curated Accent Palettes (Mint, Cobalt, Forest, or Ink) with instant device sync.</p>
        </div>
        <div className="p-4 border rounded-2xl bg-muted/20 space-y-1.5">
          <h4 className="text-sm font-bold text-foreground">JSON &amp; CSV Data Vault</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">Secure offline backups of your logs at any time. Export records to JSON or CSV formats, or restore backups instantly.</p>
        </div>
        <div className="p-4 border rounded-2xl bg-muted/20 space-y-1.5">
          <h4 className="text-sm font-bold text-foreground">Guided Tour Management</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">Replay guided tours for any section (Dashboard, Habits, Tasks, Goals, Finance, or Fitness) or reset all tours at once.</p>
        </div>
      </div>
      <SectionCtaBar title="Manage your preferences" subtitle="Adjust notifications, sounds, modules, and tour settings." href="/settings" ctaLabel="Open Settings" />
    </div>
  );
}

export function ShortcutsTutorialSection() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-orange-500"><Keyboard className="w-6 h-6" /><h2 className="text-xl font-bold tracking-tight">Keyboard Shortcuts</h2></div>
        <p className="text-sm text-muted-foreground leading-relaxed">HabitFlow is designed for high-speed tracking. Complete logs, navigate between tabs, and search fields instantly without lifting your hands from the keyboard.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-orange-500/10 bg-orange-500/5 col-span-2">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-sm font-bold flex items-center gap-1.5 text-orange-700 dark:text-orange-300"><Keyboard className="w-4 h-4" /> Core Action Keys</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            <div className="grid gap-3 sm:grid-cols-3 mt-2">
              {CORE_SHORTCUT_KEYS.map((item) => (
                <div key={item.keyLabel} className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/40">
                  <span className="font-semibold text-foreground">{item.label}</span>
                  <kbd className="px-2 py-1 rounded bg-muted border font-mono font-bold text-[10px] shadow-xs">{item.keyLabel}</kbd>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-500/10 bg-orange-500/5 col-span-2">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-sm font-bold flex items-center gap-1.5 text-orange-700 dark:text-orange-300">Navigation Shortcuts</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            <p className="mb-3 leading-relaxed">Press keys 1 through 7 to switch between app sections:</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {NAV_SHORTCUT_KEYS.map((item) => (
                <div key={item.keyLabel} className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/40 text-[11px]">
                  <span>{item.label}</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-[9px]">{item.keyLabel}</kbd>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
