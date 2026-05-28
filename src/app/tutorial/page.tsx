'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  CheckSquare, 
  ListTodo, 
  Target, 
  Workflow, 
  BarChart3, 
  Trophy, 
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
  Keyboard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

interface HelpCategory {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  color: string;
}

const HELP_CATEGORIES: HelpCategory[] = [
  { id: 'dashboard', title: 'Dashboard', subtitle: 'Overview & workspace', icon: LayoutDashboard, color: 'text-indigo-500 bg-indigo-500/10' },
  { id: 'habits', title: 'Habits System', subtitle: 'Streaks & freeze protections', icon: CheckSquare, color: 'text-emerald-500 bg-emerald-500/10' },
  { id: 'tasks', title: 'Task Manager', subtitle: 'Priority lists & deadlines', icon: ListTodo, color: 'text-sky-500 bg-sky-500/10' },
  { id: 'goals', title: 'Goals & Milestones', subtitle: '90-day focus targets', icon: Target, color: 'text-rose-500 bg-rose-500/10' },
  { id: 'routines', title: 'Routine Builder', subtitle: 'Morning & evening stacks', icon: Workflow, color: 'text-amber-500 bg-amber-500/10' },
  { id: 'analytics', title: 'Analytics', subtitle: 'Consistency charts & trends', icon: BarChart3, color: 'text-teal-500 bg-teal-500/10' },
  { id: 'gamification', title: 'Gamification', subtitle: 'XP, levels & rewards', icon: Trophy, color: 'text-purple-500 bg-purple-500/10' },
  { id: 'ai-features', title: 'AI Assistant', subtitle: 'Smart coach recommendations', icon: Sparkles, color: 'text-pink-500 bg-pink-500/10' },
  { id: 'settings', title: 'Settings', subtitle: 'Preferences & sound tags', icon: Settings, color: 'text-slate-500 bg-slate-500/10' },
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
    animate: { opacity: 1, x: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, x: -15, transition: { duration: 0.2 } }
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

  // Ensure active tab fallback if shortcuts category is active but screen size collapses
  useEffect(() => {
    if (activeTab === 'shortcuts' && !isDesktop) {
      setActiveTab('dashboard');
    }
  }, [isDesktop, activeTab]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/50 dark:bg-slate-950/20 py-8 px-4 md:px-6 lg:px-8">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-6xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full text-xs font-semibold border border-indigo-500/20">
              <BookOpen className="w-3.5 h-3.5" />
              Interactive Help Center
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              HabitFlow Academy 🎓
            </h1>
            <p className="text-muted-foreground text-sm max-w-xl leading-relaxed">
              Master the mechanics of habit loops, milestone targeting, priority planning, and gamification hacks to maximize your potential.
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
          {/* Navigation Sidebar (3 cols) */}
          <aside className="lg:col-span-4 space-y-3 bg-card/45 backdrop-blur-xl border border-white/10 p-4 rounded-3xl shadow-xl">
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
          <main className="lg:col-span-8 bg-card/30 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl min-h-[550px] flex flex-col">
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
                      <div className="flex items-center gap-2 text-indigo-500">
                        <LayoutDashboard className="w-6 h-6" />
                        <h2 className="text-xl font-bold tracking-tight">Dashboard Overview</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        The dashboard is your daily hub, providing a quick summary of active routines, active goal tracking, and daily focus items.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Card className="border-indigo-500/10 bg-indigo-500/5">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                            Daily Overview & Progress
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">
                          View your live daily momentum velocity, status level progression, and gamified XP tallies to check how consistent you are today.
                        </CardContent>
                      </Card>

                      <Card className="border-indigo-500/10 bg-indigo-500/5">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                            Quick Insights
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">
                          Read dynamic, personalized feedback and energy recommendations calculated directly by your local AI Coach.
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {/* 2. HABITS SYSTEM */}
                {activeTab === 'habits' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-emerald-500">
                        <CheckSquare className="w-6 h-6" />
                        <h2 className="text-xl font-bold tracking-tight">Habits Tracking & Streaks</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Track recurring practices, build streak multipliers, protect consistency from resetting, and log thoughts.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="p-4 border bg-muted/20 rounded-xl space-y-1.5">
                          <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                            <CheckSquare className="w-4 h-4 text-emerald-500" />
                            Creating & Tracking
                          </h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Build binary (Yes/No) or quantitative habits (e.g., gym time, water volume). Click completion cells in the daily grid to log progress.
                          </p>
                        </div>

                        <div className="p-4 border bg-muted/20 rounded-xl space-y-1.5">
                          <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                            <Flame className="w-4 h-4 text-orange-500" />
                            Maintaining Streaks
                          </h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Log completions on consecutive days to build up your **Streak Count**. High streaks award bonus XP, gems, and profile achievements.
                          </p>
                        </div>

                        <div className="p-4 border bg-muted/20 rounded-xl space-y-1.5 col-span-2">
                          <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                            <Snowflake className="w-4 h-4 text-sky-500" />
                            Streak Freeze Feature
                          </h4>
                          <div className="text-xs text-muted-foreground space-y-2 leading-relaxed">
                            <p>
                              <strong>How it works:</strong> You get **one free weekly freeze** per habit. For subsequent misses within the same week, the system consumes a **Streak Shield** purchased in Settings.
                            </p>
                            <p>
                              <strong>When to use:</strong> Use freezes when you are sick, travelling, or taking a planned rest day.
                            </p>
                            <p>
                              <strong>How it protects:</strong> Freezing marks the cell with a snowflake icon, skipping that day without resetting your hard-earned streak count to zero.
                            </p>
                          </div>
                        </div>

                        <div className="p-4 border bg-muted/20 rounded-xl space-y-1.5 col-span-2">
                          <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                            <Pencil className="w-4 h-4 text-amber-500" />
                            Qualitative Notes & Reflections
                          </h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Hover over any completed grid cell and click the small **Pencil icon** in the top-right corner. Use the popover to add a journal reflection or log exact numeric quantities. Saved notes display as a small colored dot indicator on the cell.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. TASK MANAGER */}
                {activeTab === 'tasks' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sky-500">
                        <ListTodo className="w-6 h-6" />
                        <h2 className="text-xl font-bold tracking-tight">Tasks & Priorities</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Manage one-off targets, due dates, priority labels, and Eisenhower quadrants to coordinate your tasks.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Card className="border-sky-500/10 bg-sky-500/5">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-xs uppercase font-bold text-sky-700 dark:text-sky-300">
                            Creating & Tracking
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">
                          Quickly add one-off items with target deadlines. Mark completed items directly to collect XP rewards and clear milestones.
                        </CardContent>
                      </Card>

                      <Card className="border-sky-500/10 bg-sky-500/5">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-xs uppercase font-bold text-sky-700 dark:text-sky-300">
                            Managing Priorities
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">
                          Sort items into High, Medium, or Low priority. High priority items appear first under your dashboard "Today's Focus" list.
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {/* 4. GOALS & MILESTONES */}
                {activeTab === 'goals' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-rose-500">
                        <Target className="w-6 h-6" />
                        <h2 className="text-xl font-bold tracking-tight">Goals & Milestones</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Format long-term aspirations into structured 90-Day Goals and break them down into progressive milestones.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 bg-muted/20 border rounded-2xl space-y-2">
                        <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Goal Tracking & Milestones</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Create specific outcomes and map them into actionable 3-5 sub-milestones.
                        </p>
                      </div>

                      <div className="p-4 bg-muted/20 border rounded-2xl space-y-2">
                        <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Progress Monitoring</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Checking off milestones increments progress bars directly, feeding discipline stats and showing overall completion velocity.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. ROUTINE BUILDER */}
                {activeTab === 'routines' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-amber-500">
                        <Workflow className="w-6 h-6" />
                        <h2 className="text-xl font-bold tracking-tight">Routines Stack</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Anchor habits to time-blocks (Morning/Evening) to build consecutive workflows.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex gap-4 p-4 border bg-muted/20 rounded-2xl items-start">
                        <span className="text-2xl mt-0.5">🌅</span>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-foreground">Morning & Evening Stacks</h4>
                           <p className="text-xs text-muted-foreground leading-relaxed">
                             Build a wakeup stack (e.g. stretch, drink water, read) or sleep wind-down routines. Stacking helps automate sequential workflows.
                           </p>
                        </div>
                      </div>

                      <div className="flex gap-4 p-4 border bg-muted/20 rounded-2xl items-start">
                        <span className="text-2xl mt-0.5">📅</span>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-foreground">Daily Consistency</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Executing routine stacks baseline your focus loops early, ensuring you do not skip basic core habits.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. ANALYTICS */}
                {activeTab === 'analytics' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-teal-500">
                        <BarChart3 className="w-6 h-6" />
                        <h2 className="text-xl font-bold tracking-tight">Productivity Analytics</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Data-driven insights to monitor historical progress and consistency velocities.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="p-4 bg-muted/20 border rounded-xl">
                        <span className="text-xs font-bold text-foreground block mb-1">Consistency Charts & Reports</span>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          View performance rates, weekly reviews, and heatmap grids to check complete log density patterns.
                        </p>
                      </div>
                      <div className="p-4 bg-muted/20 border rounded-xl">
                        <span className="text-xs font-bold text-foreground block mb-1">Productivity Insights</span>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Identify fatigue days, track correlation scores, and review dynamic recommendations to adjust logs.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 7. GAMIFICATION & LEADERBOARD */}
                {activeTab === 'gamification' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-purple-500">
                        <Trophy className="w-6 h-6" />
                        <h2 className="text-xl font-bold tracking-tight">Gamification & Rankings</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Complete challenges, earn experience points (XP), collect gems, and climb up the leaderboard ranks.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-2xl flex gap-3 items-center">
                        <Trophy className="w-8 h-8 text-purple-500 shrink-0" />
                        <div className="text-xs">
                          <span className="font-bold text-foreground block">Competitive Motivation & Rankings</span>
                          <p className="text-muted-foreground leading-relaxed">
                            Earn weekly XP to climb the ranks on peer league tables, fostering accountability and fun.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 8. AI ASSISTANT */}
                {activeTab === 'ai-features' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-pink-500">
                        <Sparkles className="w-6 h-6" />
                        <h2 className="text-xl font-bold tracking-tight">AI Assistant & Insights</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        HabitFlow integrates advanced Gemini AI features to analyze your log trends and assist in daily planning.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 bg-muted/20 border rounded-2xl flex gap-3 items-start">
                        <Sparkles className="w-5 h-5 text-indigo-500 fill-current shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-foreground">AI Coach Widget</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            The coach analyzes your completed habits and tasks database locally. It highlights your focal point and prints encouragement or suggestions on your dashboard.
                          </p>
                        </div>
                      </div>

                      <div className="p-4 bg-muted/20 border rounded-2xl flex gap-3 items-start">
                        <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-foreground">Smart Habit & Goal Scaffolding</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Need help writing a goal? The AI scaffold generator writes SMART goals, targets, and breaks down custom milestones automatically based on simple text prompts.
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
                        Configure preferences, manage data backups, adjust sensory triggers, and customize companion avatars.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 border rounded-2xl bg-muted/20 space-y-1.5">
                        <h4 className="text-sm font-bold text-foreground">Theme Customization</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Switch between Light, Dark, System default, or Auto themes. Custom themes synchronize gradient hues with morning, afternoon, and night timelines.
                        </p>
                      </div>

                      <div className="p-4 border rounded-2xl bg-muted/20 space-y-1.5">
                        <h4 className="text-sm font-bold text-foreground">JSON & CSV Data Vault</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Secure offline backups of your logs at any time. Export records to JSON or CSV formats, or restore backups instantly.
                        </p>
                      </div>

                      <div className="p-4 border rounded-2xl bg-muted/20 space-y-1.5">
                        <h4 className="text-sm font-bold text-foreground">Sensory Pops & Haptics</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Adjust chimes and vibrations triggered on checks. Disable sensory pops anytime for a purely quiet focus environment.
                        </p>
                      </div>
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
                              <span className="font-semibold text-foreground">Create New Habit</span>
                              <kbd className="px-2 py-1 rounded bg-muted border font-mono font-bold text-[10px] shadow-sm">N</kbd>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/40">
                              <span className="font-semibold text-foreground">Create New Goal</span>
                              <kbd className="px-2 py-1 rounded bg-muted border font-mono font-bold text-[10px] shadow-sm">C</kbd>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/40">
                              <span className="font-semibold text-foreground">Toggle Shortcuts Menu</span>
                              <kbd className="px-2 py-1 rounded bg-muted border font-mono font-bold text-[10px] shadow-sm">Shift+?</kbd>
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
                          <p className="mb-3 leading-relaxed">Press keys to instantly switch between layout tabs:</p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/40 text-[11px]">
                              <span>Dashboard</span>
                              <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-[9px]">D</kbd>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/40 text-[11px]">
                              <span>Habits</span>
                              <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-[9px]">H</kbd>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/40 text-[11px]">
                              <span>Goals</span>
                              <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-[9px]">G</kbd>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/40 text-[11px]">
                              <span>Analytics</span>
                              <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-[9px]">A</kbd>
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
