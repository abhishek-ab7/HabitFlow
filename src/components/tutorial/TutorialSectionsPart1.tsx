'use client';

import Link from 'next/link';
import {
  Brain, Calendar, CheckSquare, Dumbbell, Flame, Layers, LayoutDashboard, ListTodo, Pencil, Pill, Scale, Snowflake, Target, Utensils, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

export function DashboardTutorialSection() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <LayoutDashboard className="w-6 h-6" />
          <h2 className="text-xl font-bold tracking-tight">Dashboard Overview</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The dashboard is your daily hub, providing a quick summary of active goal tracking, momentum velocity, and today&apos;s focal items.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-primary/15 bg-primary/5">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-primary"><Zap className="w-4 h-4" /> Daily Momentum Score</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">
            Your live momentum velocity combines completed routines and scheduled tasks into a single score. Keep it charged to sustain positive habits.
          </CardContent>
        </Card>
        <Card className="border-primary/15 bg-primary/5">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-primary"><Brain className="w-4 h-4" /> Local AI Coach Nudges</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">
            Tailored coaching tips calculated on device based on your current consistency patterns, flagging friction points before streaks break.
          </CardContent>
        </Card>
      </div>

      <SectionCtaBar title="Launch Guided Tour" subtitle="Walk through the dashboard step-by-step with interactive spotlights." href="/dashboard" ctaLabel="View Dashboard" />
    </div>
  );
}

export function HabitsTutorialSection() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-emerald-500">
          <CheckSquare className="w-6 h-6" />
          <h2 className="text-xl font-bold tracking-tight">Habits Tracking &amp; Consistency</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Track recurring practices, build streak multipliers, protect consistency from resetting, and reflect in daily qualitative notes.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="p-4 border bg-muted/20 rounded-xl space-y-1.5">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5"><CheckSquare className="w-4 h-4 text-emerald-500" /> Binary &amp; Numeric Habits</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Build simple Yes/No check-in habits or quantitative targets (e.g. 3L water, 30 min reading, 10k steps). Click or log values directly on the monthly matrix.
          </p>
        </div>
        <div className="p-4 border bg-muted/20 rounded-xl space-y-1.5">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5"><Flame className="w-4 h-4 text-orange-500" /> Maintaining Streaks &amp; Rest Days</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Consecutive completions build streak multipliers. For non-daily habits, scheduled rest days are automatically protected without penalizing your momentum.
          </p>
        </div>
        <div className="p-4 border bg-muted/20 rounded-xl space-y-2 col-span-full">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5"><Snowflake className="w-4 h-4 text-sky-500" /> Streak Freezes &amp; Streak Shields</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>How Freezes Work:</strong> Right-click any cell on desktop (or tap the dropdown on mobile) to freeze a habit when ill or traveling. You get <strong>one free weekly freeze</strong> per habit.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>Streak Shields:</strong> Extra freezes within the same week consume a <strong>Streak Shield</strong>. You can replenish shields in Settings or by completing milestones. A frozen day displays a snowflake and never resets your streak.
          </p>
        </div>
        <div className="p-4 border bg-muted/20 rounded-xl space-y-1.5 col-span-full">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5"><Pencil className="w-4 h-4 text-amber-500" /> Qualitative Notes &amp; Reflections</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Hover over any completed grid cell and click the small <strong>Pencil icon</strong> to write qualitative journal reflections or record context. A subtle dot indicator marks days with saved reflections.
          </p>
        </div>
      </div>

      <SectionCtaBar title="Ready to build consistency?" subtitle="Jump directly into the habits grid and configure your routines." href="/habits" ctaLabel="Open Habits" />
    </div>
  );
}

export function TasksTutorialSection() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sky-500">
          <ListTodo className="w-6 h-6" />
          <h2 className="text-xl font-bold tracking-tight">Task Manager &amp; Priorities</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Capture one-off items, parse deadlines using natural language, and triage tasks with the 4-quadrant Eisenhower Decision Matrix.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-sky-500/15 bg-sky-500/5">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-xs uppercase font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Natural Language Capture</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">
            Type naturally: &quot;Submit quarterly tax tomorrow 5pm !high&quot; or &quot;Pay gym fee Friday&quot;. Dates, times, and priority levels are automatically parsed into structured attributes.
          </CardContent>
        </Card>
        <Card className="border-sky-500/15 bg-sky-500/5">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-xs uppercase font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Eisenhower Matrix View</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">
            Switch to the 4-quadrant matrix to categorize items: <strong>Do First</strong> (Urgent &amp; Important), <strong>Schedule</strong> (Important, Not Urgent), <strong>Delegate</strong> (Urgent, Not Important), and <strong>Eliminate</strong>.
          </CardContent>
        </Card>
        <div className="p-4 border bg-muted/20 rounded-xl space-y-1.5 col-span-full">
          <h4 className="text-sm font-bold text-foreground">Priority Rules &amp; Dashboard Sync</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            High-priority tasks due today automatically surface in the Dashboard&apos;s <strong>Today&apos;s Focus</strong> widget, ensuring urgent items get resolved without getting lost in long backlogs.
          </p>
        </div>
      </div>

      <SectionCtaBar title="Clear your daily backlog" subtitle="Organize tasks and prioritize high-impact deliverables." href="/tasks" ctaLabel="Open Tasks" />
    </div>
  );
}

export function GoalsTutorialSection() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-rose-500"><Target className="w-6 h-6" /><h2 className="text-xl font-bold tracking-tight">90-Day Goals &amp; SMART Milestones</h2></div>
        <p className="text-sm text-muted-foreground leading-relaxed">Transform long-term aspirations into structured 90-Day execution sprints. Break goals into progressive milestones and audit them with AI.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="p-4 bg-muted/20 border rounded-xl space-y-1.5">
          <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> 90-Day Focus Horizons</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">Annual goals are often too far away to maintain urgency. 90-day quarters keep your momentum tight, measurable, and highly aligned with your quarterly milestones.</p>
        </div>
        <div className="p-4 bg-muted/20 border rounded-xl space-y-1.5">
          <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5"><Brain className="w-3.5 h-3.5" /> SMART Goal AI Analysis</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">Let Gemini AI analyze your goal title and deadlines. It evaluates Specificity, Measurability, Achievability, Relevance, and Time-bounds, recommending adjustments to guarantee results.</p>
        </div>
        <div className="p-4 bg-muted/20 border rounded-xl space-y-1.5 col-span-full">
          <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Sub-Milestone Progress Bars</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">Each goal holds 3 to 5 discrete sub-milestones. Checking off milestones directly advances the goal&apos;s progress meter, showing your velocity towards completion.</p>
        </div>
      </div>
      <SectionCtaBar title="Turn dreams into action" subtitle="Scaffold your next 90-day targets and outline milestones." href="/goals" ctaLabel="Open Goals" />
    </div>
  );
}

export function FitnessTutorialSection() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-amber-500"><Dumbbell className="w-6 h-6" /><h2 className="text-xl font-bold tracking-tight">Fitness &amp; Athletics Hub</h2></div>
        <p className="text-sm text-muted-foreground leading-relaxed">Your complete physical operating system: gym workout volume, progressive overload, fuel &amp; macro tracking, body composition trends, and supplements optimization.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-amber-500/15 bg-amber-500/5">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-xs uppercase font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5"><Dumbbell className="w-3.5 h-3.5" /> Gym Workouts &amp; PR Tracker</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">Log sets, reps, and weights for each exercise. HabitFlow calculates total workout volume and automatically flags new <strong>Personal Records (PRs)</strong> to drive progressive overload.</CardContent>
        </Card>
        <Card className="border-amber-500/15 bg-amber-500/5">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-xs uppercase font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5"><Utensils className="w-3.5 h-3.5" /> Fuel &amp; Macro Tracking</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">Track meals with dynamic caloric and macro targets (protein, carbs, fats). View your daily energy deficit/surplus calculated against your BMR and athletic activity level.</CardContent>
        </Card>
        <div className="p-4 border bg-muted/20 rounded-xl space-y-1.5">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5"><Scale className="w-4 h-4 text-amber-500" /> Body Composition Moving Averages</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">Log body weight, body fat %, and muscle metrics. The chart computes <strong>7-day and 30-day moving averages</strong> to filter out daily hydration noise and reveal your true trend line.</p>
        </div>
        <div className="p-4 border bg-muted/20 rounded-xl space-y-1.5">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5"><Pill className="w-4 h-4 text-emerald-500" /> Supplements Stack &amp; ROI</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">Organize your daily health stack with morning/night schedules, cost per serving, and adherence rates to eliminate wasteful spending on inactive supplements.</p>
        </div>
        <div className="p-4 border bg-muted/20 rounded-xl space-y-1.5 col-span-full">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5"><Flame className="w-4 h-4 text-orange-500" /> Routines &amp; Quit Triggers (Anti-Habits)</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">Break negative patterns like late-night snacking, alcohol, or excessive screen time. Track clean days, identify relapse triggers, and substitute constructive mobility routines.</p>
        </div>
      </div>
      <SectionCtaBar title="Level up your physical health" subtitle="Log your workouts, plan your fuel, and review body composition." href="/fitness" ctaLabel="Open Fitness Hub" />
    </div>
  );
}
