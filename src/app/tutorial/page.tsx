'use client';

import { useState } from 'react';
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
  BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  { id: 'habits', title: 'Habits System', subtitle: 'Tracking & streak mechanics', icon: CheckSquare, color: 'text-emerald-500 bg-emerald-500/10' },
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
              {HELP_CATEGORIES.map((cat) => {
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
                        The dashboard serves as your primary control panel. It consolidates active habits, priority tasks, long-term goals, and AI-powered coach check-ins in one clean unified viewport.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Card className="border-indigo-500/10 bg-indigo-500/5">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                            <Zap className="w-4 h-4 fill-current" />
                            Daily Momentum
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">
                          Your **Momentum Score (0-100)** displays your productivity velocity. It combines your habits (60% weight) and tasks (40% weight) scheduled for today. Complete them all for a perfect multiplier!
                        </CardContent>
                      </Card>

                      <Card className="border-indigo-500/10 bg-indigo-500/5">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                            <Compass className="w-4 h-4" />
                            Focus Mode
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">
                          Toggle **Focus Mode** to dim distractions and run a focused workspace. It outlines your current high-priority checklist and counts down focus sessions smoothly.
                        </CardContent>
                      </Card>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase text-foreground tracking-wider">Your Daily Workflow:</h4>
                      <ol className="space-y-3 text-xs text-muted-foreground">
                        <li className="flex gap-2">
                          <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center font-bold text-[10px] text-foreground shrink-0 mt-0.5">1</span>
                          <p className="leading-relaxed">**Log Mood Check-In**: Start your day with a quick mood selection to baseline your emotional logs.</p>
                        </li>
                        <li className="flex gap-2">
                          <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center font-bold text-[10px] text-foreground shrink-0 mt-0.5">2</span>
                          <p className="leading-relaxed">**Execute Habits**: Mark completed habits on the checklist to accumulate XP and build streak counts.</p>
                        </li>
                        <li className="flex gap-2">
                          <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center font-bold text-[10px] text-foreground shrink-0 mt-0.5">3</span>
                          <p className="leading-relaxed">**Complete Today's Focus**: Execute priority tasks from your daily task planner to clear deadlines.</p>
                        </li>
                      </ol>
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
                        Consistent repetition is what triggers behavioral change. HabitFlow includes advanced options for quantitative logs, streaks, freezes, and reminders.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex gap-4 p-4 border bg-muted/20 rounded-2xl items-start">
                        <Flame className="w-6 h-6 text-orange-500 animate-pulse shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-foreground">The Streak Engine</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Completing a habit consecutively builds your **Streak Count**. Stacking streaks earns custom reward badges and companion levels.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4 p-4 border bg-muted/20 rounded-2xl items-start">
                        <Shield className="w-6 h-6 text-blue-500 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-foreground">Streak Freeze Protection</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Life happens. Spend earned **Gems** in settings to secure **Streak Shields**. If you miss a scheduled habit, a shield is consumed to freeze your streak and prevent reset!
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4 p-4 border bg-muted/20 rounded-2xl items-start">
                        <Info className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-foreground">Quantitative & Qualitative Habits</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            You can track binary habits (e.g. read yes/no) or quantitative parameters (e.g. log 3000ml water, log 45min gym). Add custom notes to record thoughts during logging.
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
                        <h2 className="text-xl font-bold tracking-tight">Tasks & Focus Checklists</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Organize one-off items, milestones, and work targets. The task manager supports due dates, priority labels, and Eisenhower classification.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Card className="border-sky-500/10 bg-sky-500/5">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-xs uppercase font-bold text-sky-700 dark:text-sky-300">
                            Eisenhower Matrix
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">
                          Sort tasks into **4 quadrants**: Urgent/Important, Important/Not Urgent, Urgent/Not Important, and Not Urgent/Not Important to delegate correctly.
                        </CardContent>
                      </Card>

                      <Card className="border-sky-500/10 bg-sky-500/5">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-xs uppercase font-bold text-sky-700 dark:text-sky-300">
                            Priorities & Deadlines
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">
                          Set task priorities to **High, Medium, or Low**. High priority tasks display first on your dashboard "Today's Focus" list to secure quick execution.
                        </CardContent>
                      </Card>
                    </div>

                    <div className="p-4 border border-dashed rounded-2xl bg-muted/10">
                      <h4 className="text-xs font-bold text-foreground mb-2">Pro Task Hacks:</h4>
                      <ul className="list-disc pl-4 space-y-1.5 text-xs text-muted-foreground">
                        <li>Tasks completed on time reward you with **Gems** and **XP**.</li>
                        <li>Overdue tasks show up highlighted in red on your dashboard.</li>
                        <li>Keep your daily tasks count below 5 to prevent decision paralysis.</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* 4. GOALS & MILESTONES */}
                {activeTab === 'goals' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-rose-500">
                        <Target className="w-6 h-6" />
                        <h2 className="text-xl font-bold tracking-tight">Goals & Actionable Milestones</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        A goal without milestones is just a wish. HabitFlow structures your life vision into **90-Day Focus Goals** and sub-milestones.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 bg-muted/20 border rounded-2xl space-y-2">
                        <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">SMART Goal Framework</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Create Specific, Measurable, Actionable, Relevant, and Time-bound targets. The goals creator formats your description and guides deadline alignment.
                        </p>
                      </div>

                      <div className="p-4 bg-muted/20 border rounded-2xl space-y-2">
                        <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Sub-Milestone Checklists</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Break goals into 3-5 key checkpoints. Checking off milestones increments the goal progress bar on the dashboard and feeds into your gamified discipline stats.
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
                        <h2 className="text-xl font-bold tracking-tight">Morning & Evening Routines</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Habit stacking (anchoring new habits to existing actions) simplifies routine execution. The Routine Builder lets you bundle habits into morning or evening blocks.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex gap-4 p-4 border bg-muted/20 rounded-2xl items-start">
                        <span className="text-2xl mt-0.5">🌅</span>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-foreground">Morning Stack</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Define your wakeup stack (e.g. stretch, drink water, read). Running the Morning Stack overlay guides you through them consecutively.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4 p-4 border bg-muted/20 rounded-2xl items-start">
                        <span className="text-2xl mt-0.5">🌃</span>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-foreground">Evening Wind-Down</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Structure your sleep hygiene stack (e.g. journal, plan tasks, stretch) to sign off cleanly and recharge.
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
                        <h2 className="text-xl font-bold tracking-tight">Performance Charts & Trends</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Data-driven discipline leads to insights. The Analytics page displays visual charts, weekly review summaries, and monthly reports.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3 text-center">
                      <div className="p-4 bg-muted/20 border rounded-2xl">
                        <span className="text-xl block mb-1">📅</span>
                        <span className="text-xs font-bold text-foreground block">Heatmap Calendar</span>
                        <span className="text-[10px] text-muted-foreground">View density patterns</span>
                      </div>
                      <div className="p-4 bg-muted/20 border rounded-2xl">
                        <span className="text-xl block mb-1">📈</span>
                        <span className="text-xs font-bold text-foreground block">Consistency rates</span>
                        <span className="text-[10px] text-muted-foreground">Track percentage over time</span>
                      </div>
                      <div className="p-4 bg-muted/20 border rounded-2xl">
                        <span className="text-xl block mb-1">🧠</span>
                        <span className="text-xs font-bold text-foreground block">Predictive Trends</span>
                        <span className="text-[10px] text-muted-foreground">Identify fatigue days</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 7. GAMIFICATION */}
                {activeTab === 'gamification' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-purple-500">
                        <Trophy className="w-6 h-6" />
                        <h2 className="text-xl font-bold tracking-tight">XP, Levels & Leaderboard Rewards</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Treat your life like a role-playing game. Earn experience points (XP), collect gems, shield your achievements, and climb up the leaderboard ranks.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase text-foreground tracking-wider">XP reward structure:</h4>
                      <div className="grid gap-3 sm:grid-cols-2 text-xs">
                        <div className="p-3 border rounded-xl bg-card">
                          <span className="font-bold text-primary block">+10 XP</span>
                          <span className="text-muted-foreground">Completing a daily habit</span>
                        </div>
                        <div className="p-3 border rounded-xl bg-card">
                          <span className="font-bold text-primary block">+15 XP</span>
                          <span className="text-muted-foreground">Completing a high-priority task</span>
                        </div>
                        <div className="p-3 border rounded-xl bg-card">
                          <span className="font-bold text-primary block">+50 XP</span>
                          <span className="text-muted-foreground">Reaching a goal milestone</span>
                        </div>
                        <div className="p-3 border rounded-xl bg-card">
                          <span className="font-bold text-primary block">+100 XP</span>
                          <span className="text-muted-foreground">Completing a 90-day focus goal</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-4 flex gap-3 items-center">
                      <Trophy className="w-8 h-8 text-purple-500 shrink-0" />
                      <div className="text-xs">
                        <span className="font-bold text-foreground block">Global Leaderboard Rankings</span>
                        <p className="text-muted-foreground leading-relaxed">
                          Climb the league tables by collecting XP. Compare consistency scores weekly with peers to foster accountability and competitive fun.
                        </p>
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

                {/* Next Step footer inside categories */}
                <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-6">
                  <div className="text-xs text-muted-foreground">
                    Section {HELP_CATEGORIES.findIndex(c => c.id === activeTab) + 1} of {HELP_CATEGORIES.length}
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      const idx = HELP_CATEGORIES.findIndex(c => c.id === activeTab);
                      if (idx < HELP_CATEGORIES.length - 1) {
                        handleTabChange(HELP_CATEGORIES[idx + 1].id);
                      } else {
                        handleTabChange(HELP_CATEGORIES[0].id);
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
