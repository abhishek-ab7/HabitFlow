'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  CheckSquare, 
  ListTodo, 
  Target, 
  BarChart3, 
  Sparkles, 
  Settings, 
  Flame, 
  Shield, 
  HelpCircle, 
  Compass, 
  ChevronRight, 
  Info, 
  Zap, 
  ArrowRight,
  BookOpen,
  Snowflake,
  Pencil,
  Keyboard,
  Wallet,
  Dumbbell,
  Receipt,
  CreditCard,
  Scale,
  Utensils,
  Pill,
  HeartHandshake,
  TrendingUp,
  Brain,
  Layers,
  Calendar,
  DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

interface HelpCategory {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  color: string;
}

const HELP_CATEGORIES: HelpCategory[] = [
  { id: 'dashboard', title: 'Dashboard', subtitle: 'Overview & workspace', icon: LayoutDashboard, color: 'text-primary bg-primary/10' },
  { id: 'habits', title: 'Habits System', subtitle: 'Streaks & freeze protections', icon: CheckSquare, color: 'text-emerald-500 bg-emerald-500/10' },
  { id: 'tasks', title: 'Task Manager', subtitle: 'Priorities & Eisenhower matrix', icon: ListTodo, color: 'text-sky-500 bg-sky-500/10' },
  { id: 'goals', title: 'Goals & Milestones', subtitle: '90-day targets & SMART AI', icon: Target, color: 'text-rose-500 bg-rose-500/10' },
  { id: 'fitness', title: 'Fitness Hub', subtitle: 'Workouts, macros & body trends', icon: Dumbbell, color: 'text-amber-500 bg-amber-500/10' },
  { id: 'finance', title: 'Finance Hub', subtitle: 'Burn pace, accounts & debt', icon: Wallet, color: 'text-emerald-600 bg-emerald-600/10' },
  { id: 'analytics', title: 'Analytics', subtitle: 'Consistency charts & trends', icon: BarChart3, color: 'text-teal-500 bg-teal-500/10' },
  { id: 'ai-features', title: 'AI Assistant', subtitle: 'Smart coach recommendations', icon: Sparkles, color: 'text-indigo-500 bg-indigo-500/10' },
  { id: 'settings', title: 'Settings', subtitle: 'Preferences & data backups', icon: Settings, color: 'text-slate-500 bg-slate-500/10' },
];

export default function TutorialPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(window.innerWidth >= 768);
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const tabVariants = {
    initial: { opacity: 0, x: 15 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.25 } },
    exit: { opacity: 0, x: -15, transition: { duration: 0.15 } }
  };

  const playClickSound = () => {
    try {
      const feedbackSettings = localStorage.getItem('feedback_settings');
      const enabled = feedbackSettings ? JSON.parse(feedbackSettings).sound : true;
      if (!enabled) return;

      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(550, ctx.currentTime);
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {}
  };

  const handleTabChange = (id: string) => {
    playClickSound();
    setActiveTab(id);
  };

  // Build categories dynamically (shortcuts ONLY on desktop)
  const categories = [...HELP_CATEGORIES];
  if (isDesktop) {
    categories.push({
      id: 'shortcuts',
      title: 'Keyboard Shortcuts',
      subtitle: 'Speed workflows',
      icon: Keyboard,
      color: 'text-orange-500 bg-orange-500/10'
    });
  }

  useEffect(() => {
    if (activeTab === 'shortcuts' && !isDesktop) {
      setActiveTab('dashboard');
    }
  }, [isDesktop, activeTab]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background py-8 px-4 md:px-6 lg:px-8">
      <div className="max-w-[1600px] mx-auto space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold border border-primary/20">
              <BookOpen className="w-3.5 h-3.5" />
              Interactive Life OS Academy
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              HabitFlow Academy 🎓
            </h1>
            <p className="text-muted-foreground text-sm max-w-xl leading-relaxed">
              Master the mechanics of habit loops, priority planning, milestone roadmaps, physical training, and personal wealth management.
            </p>
          </div>
          <Button asChild className="rounded-xl shadow-lg shadow-primary/20">
            <Link href="/dashboard" className="gap-1.5 font-semibold text-xs uppercase tracking-wider h-11 px-5">
              Go to Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>

        {/* Outer Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Navigation Sidebar (4 cols) */}
          <aside className="lg:col-span-4 space-y-3 surface-card p-4 shadow-xs">
            <div className="px-3 pb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground/60 border-b border-border/40 mb-2">
              Help Categories
            </div>
            <nav className="space-y-1.5">
              {categories.map((cat) => {
                const isActive = activeTab === cat.id;
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleTabChange(cat.id)}
                    className={cn(
                      "w-full flex items-center gap-3.5 p-3 rounded-2xl text-left border transition-all duration-200 outline-none group",
                      isActive
                        ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.01]"
                        : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-xl shrink-0 transition-colors",
                      isActive ? "bg-white/20 text-white" : cat.color
                    )}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs leading-none mb-1 group-hover:text-foreground group-data-[state=active]:text-white">
                        {cat.title}
                      </p>
                      <p className={cn(
                        "text-[10px] truncate leading-none",
                        isActive ? "text-white/80" : "text-muted-foreground/80"
                      )}>
                        {cat.subtitle}
                      </p>
                    </div>
                    <ChevronRight className={cn(
                      "w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5",
                      isActive ? "text-white" : "text-muted-foreground/45"
                    )} />
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Tutorial Content Board (8 cols) */}
          <main className="lg:col-span-8 surface-hero p-6 md:p-8 shadow-xs min-h-[580px] flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial="initial"
                animate="animate"
                exit="exit"
                variants={tabVariants}
                className="space-y-6 flex-1 flex flex-col justify-between"
              >
                {/* 1. DASHBOARD OVERVIEW */}
                {activeTab === 'dashboard' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-primary">
                        <LayoutDashboard className="w-6 h-6" />
                        <h2 className="text-xl font-bold tracking-tight">Dashboard Overview</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        The dashboard is your daily hub, providing a quick summary of active goal tracking, momentum velocity, and today\'s focal items.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Card className="border-primary/15 bg-primary/5">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-primary">
                            <Zap className="w-4 h-4" />
                            Daily Momentum Score
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">
                          Your live momentum velocity combines completed routines and scheduled tasks into a single score. Keep it charged to sustain positive habits.
                        </CardContent>
                      </Card>

                      <Card className="border-primary/15 bg-primary/5">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-primary">
                            <Brain className="w-4 h-4" />
                            Local AI Coach Nudges
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">
                          Tailored coaching tips calculated on device based on your current consistency patterns, flagging friction points before streaks break.
                        </CardContent>
                      </Card>
                    </div>

                    <div className="p-4 bg-muted/20 border border-border/60 rounded-2xl flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-foreground">Launch Guided Tour</h4>
                        <p className="text-[11px] text-muted-foreground">Walk through the dashboard step-by-step with interactive spotlights.</p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="h-8 rounded-xl text-xs font-semibold shrink-0">
                        <Link href="/dashboard">View Dashboard</Link>
                      </Button>
                    </div>
                  </div>
                )}

                {/* 2. HABITS SYSTEM */}
                {activeTab === 'habits' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-emerald-500">
                        <CheckSquare className="w-6 h-6" />
                        <h2 className="text-xl font-bold tracking-tight">Habits Tracking & Consistency</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Track recurring practices, build streak multipliers, protect consistency from resetting, and reflect in daily qualitative notes.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="p-4 border bg-muted/20 rounded-xl space-y-1.5">
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          <CheckSquare className="w-4 h-4 text-emerald-500" />
                          Binary & Numeric Habits
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Build simple Yes/No check-in habits or quantitative targets (e.g. 3L water, 30 min reading, 10k steps). Click or log values directly on the monthly matrix.
                        </p>
                      </div>

                      <div className="p-4 border bg-muted/20 rounded-xl space-y-1.5">
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          <Flame className="w-4 h-4 text-orange-500" />
                          Maintaining Streaks & Rest Days
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Consecutive completions build streak multipliers. For non-daily habits, scheduled rest days are automatically protected without penalizing your momentum.
                        </p>
                      </div>

                      <div className="p-4 border bg-muted/20 rounded-xl space-y-2 col-span-full">
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          <Snowflake className="w-4 h-4 text-sky-500" />
                          Streak Freezes & Streak Shields
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          <strong>How Freezes Work:</strong> Right-click any cell on desktop (or tap the dropdown on mobile) to freeze a habit when ill or traveling. You get <strong>one free weekly freeze</strong> per habit.
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          <strong>Streak Shields:</strong> Extra freezes within the same week consume a <strong>Streak Shield</strong>. You can replenish shields in Settings or by completing milestones. A frozen day displays a snowflake and never resets your streak.
                        </p>
                      </div>

                      <div className="p-4 border bg-muted/20 rounded-xl space-y-1.5 col-span-full">
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          <Pencil className="w-4 h-4 text-amber-500" />
                          Qualitative Notes & Reflections
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Hover over any completed grid cell and click the small <strong>Pencil icon</strong> to write qualitative journal reflections or record context. A subtle dot indicator marks days with saved reflections.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-muted/20 border border-border/60 rounded-2xl flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-foreground">Ready to build consistency?</h4>
                        <p className="text-[11px] text-muted-foreground">Jump directly into the habits grid and configure your routines.</p>
                      </div>
                      <Button asChild size="sm" className="h-8 rounded-xl text-xs font-semibold shrink-0">
                        <Link href="/habits">Open Habits</Link>
                      </Button>
                    </div>
                  </div>
                )}

                {/* 3. TASK MANAGER */}
                {activeTab === 'tasks' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sky-500">
                        <ListTodo className="w-6 h-6" />
                        <h2 className="text-xl font-bold tracking-tight">Task Manager & Priorities</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Capture one-off items, parse deadlines using natural language, and triage tasks with the 4-quadrant Eisenhower Decision Matrix.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Card className="border-sky-500/15 bg-sky-500/5">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-xs uppercase font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5" />
                            Natural Language Capture
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">
                          Type naturally: &quot;Submit quarterly tax tomorrow 5pm !high&quot; or &quot;Pay gym fee Friday&quot;. Dates, times, and priority levels are automatically parsed into structured attributes.
                        </CardContent>
                      </Card>

                      <Card className="border-sky-500/15 bg-sky-500/5">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-xs uppercase font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5" />
                            Eisenhower Matrix View
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">
                          Switch to the 4-quadrant matrix to categorize items: <strong>Do First</strong> (Urgent &amp; Important), <strong>Schedule</strong> (Important, Not Urgent), <strong>Delegate</strong> (Urgent, Not Important), and <strong>Eliminate</strong>.
                        </CardContent>
                      </Card>

                      <div className="p-4 border bg-muted/20 rounded-xl space-y-1.5 col-span-full">
                        <h4 className="text-sm font-bold text-foreground">Priority Rules & Dashboard Sync</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          High-priority tasks due today automatically surface in the Dashboard&apos;s <strong>Today&apos;s Focus</strong> widget, ensuring urgent items get resolved without getting lost in long backlogs.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-muted/20 border border-border/60 rounded-2xl flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-foreground">Clear your daily backlog</h4>
                        <p className="text-[11px] text-muted-foreground">Organize tasks and prioritize high-impact deliverables.</p>
                      </div>
                      <Button asChild size="sm" className="h-8 rounded-xl text-xs font-semibold shrink-0">
                        <Link href="/tasks">Open Tasks</Link>
                      </Button>
                    </div>
                  </div>
                )}

                {/* 4. GOALS & MILESTONES */}
                {activeTab === 'goals' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-rose-500">
                        <Target className="w-6 h-6" />
                        <h2 className="text-xl font-bold tracking-tight">90-Day Goals & SMART Milestones</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Transform long-term aspirations into structured 90-Day execution sprints. Break goals into progressive milestones and audit them with AI.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="p-4 bg-muted/20 border rounded-xl space-y-1.5">
                        <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          90-Day Focus Horizons
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Annual goals are often too far away to maintain urgency. 90-day quarters keep your momentum tight, measurable, and highly aligned with your quarterly milestones.
                        </p>
                      </div>

                      <div className="p-4 bg-muted/20 border rounded-xl space-y-1.5">
                        <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Brain className="w-3.5 h-3.5" />
                          SMART Goal AI Analysis
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Let Gemini AI analyze your goal title and deadlines. It evaluates Specificity, Measurability, Achievability, Relevance, and Time-bounds, recommending adjustments to guarantee results.
                        </p>
                      </div>

                      <div className="p-4 bg-muted/20 border rounded-xl space-y-1.5 col-span-full">
                        <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                          Sub-Milestone Progress Bars
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Each goal holds 3 to 5 discrete sub-milestones. Checking off milestones directly advances the goal&apos;s progress meter, showing your velocity towards completion.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-muted/20 border border-border/60 rounded-2xl flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-foreground">Turn dreams into action</h4>
                        <p className="text-[11px] text-muted-foreground">Scaffold your next 90-day targets and outline milestones.</p>
                      </div>
                      <Button asChild size="sm" className="h-8 rounded-xl text-xs font-semibold shrink-0">
                        <Link href="/goals">Open Goals</Link>
                      </Button>
                    </div>
                  </div>
                )}

                {/* 5. FITNESS HUB (NEW) */}
                {activeTab === 'fitness' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-amber-500">
                        <Dumbbell className="w-6 h-6" />
                        <h2 className="text-xl font-bold tracking-tight">Fitness & Athletics Hub</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Your complete physical operating system: gym workout volume, progressive overload, fuel &amp; macro tracking, body composition trends, and supplements optimization.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Card className="border-amber-500/15 bg-amber-500/5">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-xs uppercase font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                            <Dumbbell className="w-3.5 h-3.5" />
                            Gym Workouts & PR Tracker
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">
                          Log sets, reps, and weights for each exercise. HabitFlow calculates total workout volume and automatically flags new <strong>Personal Records (PRs)</strong> to drive progressive overload.
                        </CardContent>
                      </Card>

                      <Card className="border-amber-500/15 bg-amber-500/5">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-xs uppercase font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                            <Utensils className="w-3.5 h-3.5" />
                            Fuel & Macro Tracking
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">
                          Track meals with dynamic caloric and macro targets (protein, carbs, fats). View your daily energy deficit/surplus calculated against your BMR and athletic activity level.
                        </CardContent>
                      </Card>

                      <div className="p-4 border bg-muted/20 rounded-xl space-y-1.5">
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          <Scale className="w-4 h-4 text-amber-500" />
                          Body Composition Moving Averages
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Log body weight, body fat %, and muscle metrics. The chart computes <strong>7-day and 30-day moving averages</strong> to filter out daily hydration noise and reveal your true trend line.
                        </p>
                      </div>

                      <div className="p-4 border bg-muted/20 rounded-xl space-y-1.5">
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          <Pill className="w-4 h-4 text-emerald-500" />
                          Supplements Stack & ROI
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Organize your daily health stack with morning/night schedules, cost per serving, and adherence rates to eliminate wasteful spending on inactive supplements.
                        </p>
                      </div>

                      <div className="p-4 border bg-muted/20 rounded-xl space-y-1.5 col-span-full">
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          <Flame className="w-4 h-4 text-orange-500" />
                          Routines & Quit Triggers (Anti-Habits)
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Break negative patterns like late-night snacking, alcohol, or excessive screen time. Track clean days, identify relapse triggers, and substitute constructive mobility routines.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-muted/20 border border-border/60 rounded-2xl flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-foreground">Level up your physical health</h4>
                        <p className="text-[11px] text-muted-foreground">Log your workouts, plan your fuel, and review body composition.</p>
                      </div>
                      <Button asChild size="sm" className="h-8 rounded-xl text-xs font-semibold shrink-0">
                        <Link href="/fitness">Open Fitness Hub</Link>
                      </Button>
                    </div>
                  </div>
                )}

                {/* 6. FINANCE HUB (NEW) */}
                {activeTab === 'finance' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-emerald-600">
                        <Wallet className="w-6 h-6" />
                        <h2 className="text-xl font-bold tracking-tight">Personal Finance Hub</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Total command over personal wealth: Safe-to-Spend burn pace, multi-account net worth, credit card cycle reconciliation, and automated tracker ledgers.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Card className="border-emerald-500/15 bg-emerald-500/5">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-xs uppercase font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5" />
                            Safe-to-Spend & Daily Pace
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">
                          Calculates your exact remaining discretionary budget divided across days left in the month. The pace curve plots cumulative spending against ideal budget burn to prevent overspending.
                        </CardContent>
                      </Card>

                      <Card className="border-emerald-500/15 bg-emerald-500/5">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-xs uppercase font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5" />
                            Credit Card Statement Cycles
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">
                          Reconcile statements with bill generation dates and grace periods. Separate unbilled spends from total balances to maximize interest-free credit and avoid late fees.
                        </CardContent>
                      </Card>

                      <div className="p-4 border bg-muted/20 rounded-xl space-y-1.5 col-span-full">
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-emerald-500" />
                          Trackers Hub: Bills, EMIs, SIPs & Friends Debt
                        </h4>
                        <div className="grid sm:grid-cols-2 gap-3 text-xs text-muted-foreground pt-1">
                          <div>
                            <strong className="text-foreground">Bills &amp; Subscriptions:</strong> Calendar view of recurring charges with audit warnings for zombie subscriptions.
                          </div>
                          <div>
                            <strong className="text-foreground">EMIs &amp; Loans:</strong> Amortization schedules, monthly obligations, and payoff countdowns.
                          </div>
                          <div>
                            <strong className="text-foreground">SIPs &amp; Investments:</strong> Monthly systematic investment plans tracked towards net worth milestones.
                          </div>
                          <div>
                            <strong className="text-foreground">Friends Debt Ledger:</strong> Simple &ldquo;Who owes who&rdquo; ledger for tracking shared expenses and settlements.
                          </div>
                        </div>
                      </div>

                      <div className="p-4 border bg-muted/20 rounded-xl space-y-1.5 col-span-full">
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          <Receipt className="w-4 h-4 text-sky-500" />
                          Privacy-First SMS Import & Ask Finances AI
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Import transaction SMS messages directly in your browser. All parsing occurs locally with zero data sent to external servers. Ask questions like &ldquo;How much did I spend on dining this month?&rdquo; via the Ask Finances AI Drawer.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-muted/20 border border-border/60 rounded-2xl flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-foreground">Master your wealth</h4>
                        <p className="text-[11px] text-muted-foreground">Check your Safe-to-Spend burn rate, reconcile accounts, and log transactions.</p>
                      </div>
                      <Button asChild size="sm" className="h-8 rounded-xl text-xs font-semibold shrink-0">
                        <Link href="/finance">Open Finance Hub</Link>
                      </Button>
                    </div>
                  </div>
                )}

                {/* 7. ANALYTICS */}
                {activeTab === 'analytics' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-teal-500">
                        <BarChart3 className="w-6 h-6" />
                        <h2 className="text-xl font-bold tracking-tight">Productivity Analytics</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Data-driven insights to monitor historical progress, heatmap densities, and consistency velocities over time.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="p-4 bg-muted/20 border rounded-xl">
                        <span className="text-xs font-bold text-foreground block mb-1">Consistency Charts &amp; Heatmaps</span>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          View completion percentages, 52-week activity heatmaps, and weekly review summaries to spot seasonal habits and productivity drops.
                        </p>
                      </div>
                      <div className="p-4 bg-muted/20 border rounded-xl">
                        <span className="text-xs font-bold text-foreground block mb-1">Fatigue &amp; Correlation Scores</span>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Identify which days of the week experience the highest completion rates vs friction days to plan rest and deep work effectively.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-muted/20 border border-border/60 rounded-2xl flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-foreground">Explore consistency patterns</h4>
                        <p className="text-[11px] text-muted-foreground">Review long-term performance velocity across all habits.</p>
                      </div>
                      <Button asChild size="sm" className="h-8 rounded-xl text-xs font-semibold shrink-0">
                        <Link href="/analytics">Open Analytics</Link>
                      </Button>
                    </div>
                  </div>
                )}

                {/* 8. AI ASSISTANT */}
                {activeTab === 'ai-features' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-indigo-500">
                        <Sparkles className="w-6 h-6" />
                        <h2 className="text-xl font-bold tracking-tight">AI Assistant & Companion</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        HabitFlow integrates Gemini AI to analyze your logs locally, generate smart goals, and provide personalized coaching.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 bg-muted/20 border rounded-2xl flex gap-3 items-start">
                        <Sparkles className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-foreground">AI Coach Widget</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            The coach analyzes your completed habits and tasks database. It highlights your focal point, encourages recovery on rest days, and offers tactical advice directly on the dashboard.
                          </p>
                        </div>
                      </div>

                      <div className="p-4 bg-muted/20 border rounded-2xl flex gap-3 items-start">
                        <Brain className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-foreground">Smart Habit & Goal Scaffolding</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Need help formulating a goal or habit stack? The AI scaffold generator writes SMART goals, targets, and breaks down custom milestones automatically based on simple text prompts.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 9. SETTINGS */}
                {activeTab === 'settings' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Settings className="w-6 h-6" />
                        <h2 className="text-xl font-bold tracking-tight">Settings & Customization</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Configure themes, manage data backups, adjust sensory feedback, replenish Streak Shields, and replay guided tours.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 border rounded-2xl bg-muted/20 space-y-1.5">
                        <h4 className="text-sm font-bold text-foreground">Theme & Accent Palettes</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Switch between Light, Dark, or System mode and pick curated Accent Palettes (Mint, Cobalt, Forest, or Ink) with instant device sync.
                        </p>
                      </div>

                      <div className="p-4 border rounded-2xl bg-muted/20 space-y-1.5">
                        <h4 className="text-sm font-bold text-foreground">JSON & CSV Data Vault</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Secure offline backups of your logs at any time. Export records to JSON or CSV formats, or restore backups instantly.
                        </p>
                      </div>

                      <div className="p-4 border rounded-2xl bg-muted/20 space-y-1.5">
                        <h4 className="text-sm font-bold text-foreground">Guided Tour Management</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Replay guided tours for any section (Dashboard, Habits, Tasks, Goals, Finance, or Fitness) or reset all tours at once.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-muted/20 border border-border/60 rounded-2xl flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-foreground">Manage your preferences</h4>
                        <p className="text-[11px] text-muted-foreground">Adjust notifications, sounds, modules, and tour settings.</p>
                      </div>
                      <Button asChild size="sm" className="h-8 rounded-xl text-xs font-semibold shrink-0">
                        <Link href="/settings">Open Settings</Link>
                      </Button>
                    </div>
                  </div>
                )}

                {/* 10. KEYBOARD SHORTCUTS (DESKTOP ONLY) */}
                {activeTab === 'shortcuts' && isDesktop && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-orange-500">
                        <Keyboard className="w-6 h-6" />
                        <h2 className="text-xl font-bold tracking-tight">Keyboard Shortcuts</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        HabitFlow is designed for high-speed tracking. Complete logs, navigate between tabs, and search fields instantly without lifting your hands from the keyboard.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Card className="border-orange-500/10 bg-orange-500/5 col-span-2">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-orange-700 dark:text-orange-300">
                            <Keyboard className="w-4 h-4" />
                            Core Action Keys
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                          <div className="grid gap-3 sm:grid-cols-3 mt-2">
                            <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/40">
                              <span className="font-semibold text-foreground">Quick Add Task</span>
                              <kbd className="px-2 py-1 rounded bg-muted border font-mono font-bold text-[10px] shadow-xs">N</kbd>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/40">
                              <span className="font-semibold text-foreground">Command Menu</span>
                              <kbd className="px-2 py-1 rounded bg-muted border font-mono font-bold text-[10px] shadow-xs">Ctrl+K</kbd>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/40">
                              <span className="font-semibold text-foreground">Toggle Shortcuts Menu</span>
                              <kbd className="px-2 py-1 rounded bg-muted border font-mono font-bold text-[10px] shadow-xs">?</kbd>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-orange-500/10 bg-orange-500/5 col-span-2">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-orange-700 dark:text-orange-300">
                            Navigation Shortcuts
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                          <p className="mb-3 leading-relaxed">Press keys 1 through 7 to switch between app sections:</p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/40 text-[11px]">
                              <span>Dashboard</span>
                              <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-[9px]">1</kbd>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/40 text-[11px]">
                              <span>Tasks</span>
                              <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-[9px]">2</kbd>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/40 text-[11px]">
                              <span>Habits</span>
                              <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-[9px]">3</kbd>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/40 text-[11px]">
                              <span>Fitness</span>
                              <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-[9px]">4</kbd>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/40 text-[11px]">
                              <span>Goals</span>
                              <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-[9px]">5</kbd>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/40 text-[11px]">
                              <span>Finance</span>
                              <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-[9px]">6</kbd>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/40 text-[11px]">
                              <span>Analytics</span>
                              <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-[9px]">7</kbd>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Next Step footer inside categories */}
                <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-6">
                  <div className="text-xs text-muted-foreground">
                    Section {categories.findIndex(c => c.id === activeTab) + 1} of {categories.length}
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      const idx = categories.findIndex(c => c.id === activeTab);
                      if (idx < categories.length - 1) {
                        handleTabChange(categories[idx + 1].id);
                      } else {
                        handleTabChange(categories[0].id);
                      }
                    }}
                    className="rounded-xl h-9 text-xs font-semibold px-4 gap-1 hover:bg-muted"
                  >
                    Next Section
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
