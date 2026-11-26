'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, BookOpen, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HELP_CATEGORIES, SHORTCUT_CATEGORY, type HelpCategory } from '@/components/tutorial/tutorial-data';
import {
  DashboardTutorialSection,
  FitnessTutorialSection,
  GoalsTutorialSection,
  HabitsTutorialSection,
  TasksTutorialSection,
} from '@/components/tutorial/TutorialSectionsPart1';
import {
  AiTutorialSection,
  AnalyticsTutorialSection,
  FinanceTutorialSection,
  SettingsTutorialSection,
  ShortcutsTutorialSection,
} from '@/components/tutorial/TutorialSectionsPart2';

const TAB_VARIANTS = {
  initial: { opacity: 0, x: 15 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.25 } },
  exit: { opacity: 0, x: -15, transition: { duration: 0.15 } },
};

function playTutorialClickSound() {
  try {
    const raw = localStorage.getItem('feedback_settings');
    if (raw && !JSON.parse(raw).sound) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
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
  } catch {
    // Audio unavailable
  }
}

function TutorialSidebar({
  categories,
  activeTab,
  onSelectTab,
}: {
  categories: HelpCategory[];
  activeTab: string;
  onSelectTab: (id: string) => void;
}) {
  return (
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
              onClick={() => onSelectTab(cat.id)}
              className={cn(
                'w-full flex items-center gap-3.5 p-3 rounded-2xl text-left border transition-all duration-200 outline-none group',
                isActive ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.01]' : 'bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
              )}
            >
              <div className={cn('p-2 rounded-xl shrink-0 transition-colors', isActive ? 'bg-white/20 text-white' : cat.color)}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-xs leading-none mb-1 group-hover:text-foreground group-data-[state=active]:text-white">{cat.title}</p>
                <p className={cn('text-[10px] truncate leading-none', isActive ? 'text-white/80' : 'text-muted-foreground/80')}>{cat.subtitle}</p>
              </div>
              <ChevronRight className={cn('w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5', isActive ? 'text-white' : 'text-muted-foreground/45')} />
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

const SECTION_BY_TAB: Record<string, React.ComponentType> = {
  dashboard: DashboardTutorialSection,
  habits: HabitsTutorialSection,
  tasks: TasksTutorialSection,
  goals: GoalsTutorialSection,
  fitness: FitnessTutorialSection,
  finance: FinanceTutorialSection,
  analytics: AnalyticsTutorialSection,
  'ai-features': AiTutorialSection,
  settings: SettingsTutorialSection,
};

function TutorialActiveSection({ activeTab, isDesktop }: { activeTab: string; isDesktop: boolean }) {
  if (activeTab === 'shortcuts' && isDesktop) return <ShortcutsTutorialSection />;
  const Section = SECTION_BY_TAB[activeTab] ?? DashboardTutorialSection;
  return <Section />;
}

export default function TutorialPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const syncDesktop = () => setIsDesktop(window.innerWidth >= 768);
    syncDesktop();
    window.addEventListener('resize', syncDesktop);
    return () => window.removeEventListener('resize', syncDesktop);
  }, []);

  useEffect(() => {
    if (activeTab === 'shortcuts' && !isDesktop) setActiveTab('dashboard');
  }, [isDesktop, activeTab]);

  const categories = isDesktop ? [...HELP_CATEGORIES, SHORTCUT_CATEGORY] : HELP_CATEGORIES;
  const handleTabChange = (id: string) => {
    playTutorialClickSound();
    setActiveTab(id);
  };
  const handleNextSection = () => {
    const idx = categories.findIndex((c) => c.id === activeTab);
    const nextIdx = idx < categories.length - 1 ? idx + 1 : 0;
    handleTabChange(categories[nextIdx].id);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background py-8 px-4 md:px-6 lg:px-8">
      <div className="max-w-[1600px] mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold border border-primary/20">
              <BookOpen className="w-3.5 h-3.5" /> Interactive Life OS Academy
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">HabitFlow Academy 🎓</h1>
            <p className="text-muted-foreground text-sm max-w-xl leading-relaxed">
              Master the mechanics of habit loops, priority planning, milestone roadmaps, physical training, and personal wealth management.
            </p>
          </div>
          <Button asChild className="rounded-xl shadow-lg shadow-primary/20">
            <Link href="/dashboard" className="gap-1.5 font-semibold text-xs uppercase tracking-wider h-11 px-5">
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <TutorialSidebar categories={categories} activeTab={activeTab} onSelectTab={handleTabChange} />
          <main className="lg:col-span-8 surface-hero p-6 md:p-8 shadow-xs min-h-[580px] flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial="initial" animate="animate" exit="exit" variants={TAB_VARIANTS} className="space-y-6 flex-1 flex flex-col justify-between">
                <TutorialActiveSection activeTab={activeTab} isDesktop={isDesktop} />
                <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-6">
                  <div className="text-xs text-muted-foreground">
                    Section {categories.findIndex((c) => c.id === activeTab) + 1} of {categories.length}
                  </div>
                  <Button variant="outline" onClick={handleNextSection} className="rounded-xl h-9 text-xs font-semibold px-4 gap-1 hover:bg-muted">
                    Next Section <ChevronRight className="w-3.5 h-3.5" />
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
