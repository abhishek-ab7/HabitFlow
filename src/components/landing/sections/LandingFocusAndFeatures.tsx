'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, type MotionValue } from 'framer-motion';
import { Target, Clock, TrendingUp } from 'lucide-react';

function formatPomodoroTime(sec: number) {
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

const FOCUS_FEATURES = [
  { title: 'Smart Pomodoro', desc: 'Start custom focus sessions directly linked to habits.', icon: Clock },
  { title: 'Weekly Insights & Stats', desc: 'Gain in-depth insights into productivity curves.', icon: TrendingUp },
  { title: 'Goal Milestones', desc: 'Set radial milestones and track progress over 90 days.', icon: Target },
];

export function LandingFocusHubSection(params: {
  focusHubRef: React.RefObject<HTMLDivElement | null>;
  pomodoroSeconds: number;
  isTimerRunning: boolean;
  pomodoroScrollOffset: MotionValue<number>;
  onToggleTimer: () => void;
  onResetTimer: () => void;
}) {
  const { focusHubRef, pomodoroSeconds, isTimerRunning, pomodoroScrollOffset, onToggleTimer, onResetTimer } = params;

  return (
    <section id="focus-hub" ref={focusHubRef} className="w-full max-w-6xl px-6 md:px-12 py-24 scroll-mt-24">
      <div className="text-center mb-16 max-w-xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase mb-3 bg-primary/10 text-primary border border-primary/20">
          Premium Feature Preview
        </div>
        <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight text-foreground">Deep Work Focus Hub</h2>
        <p className="text-base text-muted-foreground">Access integrated focus tools inside the app. Try the Pomodoro Focus module below, synced to scroll kinetics.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="surface-hero p-8 flex flex-col items-center justify-center relative shadow-md">
          <h3 className="text-lg font-bold mb-8 flex items-center gap-2 text-foreground">
            <Clock className="h-5 w-5 text-primary" />
            Pomodoro Focus Timer
          </h3>

          <div className="relative w-44 h-44 flex items-center justify-center mb-8">
            <svg className="absolute transform -rotate-90" width="100%" height="100%" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="6" />
              <motion.circle
                cx="50" cy="50" r="44" fill="none" stroke="url(#pomodoro-glow-grad)" strokeWidth="6" strokeLinecap="round"
                style={{ strokeDasharray: 276.4, strokeDashoffset: isTimerRunning ? (pomodoroSeconds / 1500) * 276.4 : pomodoroScrollOffset }}
              />
              <defs>
                <linearGradient id="pomodoro-glow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#14b8a6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="flex flex-col items-center justify-center z-10">
              <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono tabular-nums">{formatPomodoroTime(pomodoroSeconds)}</span>
              <span className="text-[9px] font-extrabold text-primary uppercase tracking-wider mt-1">Focus Session</span>
            </div>
          </div>

          <div className="flex gap-4">
            <button onClick={onToggleTimer} className="bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground font-bold px-6 py-2.5 rounded-xl text-sm transition-all duration-200 shadow-xs cursor-pointer">
              {isTimerRunning ? 'Pause Session' : 'Start Focus'}
            </button>
            <button onClick={onResetTimer} className="border border-border bg-card hover:bg-muted text-foreground font-bold px-6 py-2.5 rounded-xl text-sm transition-all duration-200 cursor-pointer">
              Reset
            </button>
          </div>
        </div>

        <div className="space-y-8 text-left lg:pl-6">
          <h3 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">Focus Tools Integrated Together</h3>
          <p className="text-base text-muted-foreground">Tackle daily tasks, build routines, and track goals while boosting efficiency with dedicated workspace modules.</p>
          <div className="space-y-4">
            {FOCUS_FEATURES.map((item, idx) => (
              <div key={idx} className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">{item.title}</h4>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const EISENHOWER_QUADS = [
  { code: 'DO', desc: 'Urgent & Imp.', cls: 'bg-destructive/10 border border-destructive/20 hover:border-destructive/50 text-destructive' },
  { code: 'DECIDE', desc: 'Not Urg. & Imp.', cls: 'bg-primary/10 border border-primary/20 hover:border-primary/50 text-primary' },
  { code: 'DELEGATE', desc: 'Urgent & Not Imp.', cls: 'bg-info/10 border border-info/20 hover:border-info/50 text-info' },
  { code: 'DELETE', desc: 'Not Urg. & Not Imp.', cls: 'surface-subtle border text-muted-foreground' },
];

function RadialGoalsCard() {
  const [hoveredMilestone, setHoveredMilestone] = useState<string | null>(null);
  return (
    <div className="surface-card p-8 hover:-translate-y-1 hover:border-primary/30 transition-all duration-300 flex flex-col h-full relative overflow-hidden">
      <div className="text-[9px] font-extrabold tracking-wider text-info bg-info/10 w-fit px-3 py-1.5 rounded-lg uppercase mb-4 border border-info/20">Track</div>
      <h3 className="text-xl font-bold mb-3 text-left text-foreground">90-Day Focus Goals</h3>
      <p className="text-sm mb-8 flex-grow text-left text-muted-foreground">Visualize long-term progress with radial rings and interactive milestones.</p>

      <div className="flex justify-center mt-auto relative h-[160px] items-center">
        <svg className="transform -rotate-90" height="150" viewBox="0 0 160 160" width="150">
          <circle cx="80" cy="80" fill="none" r="70" stroke="currentColor" strokeOpacity="0.08" strokeWidth="12" />
          <circle cx="80" cy="80" fill="none" r="50" stroke="currentColor" strokeOpacity="0.08" strokeWidth="12" />
          <motion.circle cx="80" cy="80" fill="none" r="70" stroke="url(#radial-accent-outer)" strokeWidth="12" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 0.75 }} viewport={{ once: false, margin: '-50px' }} transition={{ duration: 1.5, ease: 'easeOut' }} />
          <motion.circle cx="80" cy="80" fill="none" r="50" stroke="url(#radial-accent-inner)" strokeWidth="12" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 0.52 }} viewport={{ once: false, margin: '-50px' }} transition={{ duration: 1.5, delay: 0.15, ease: 'easeOut' }} />
          <defs>
            <linearGradient id="radial-accent-outer" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#14b8a6" /></linearGradient>
            <linearGradient id="radial-accent-inner" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#0ea5e9" /><stop offset="100%" stopColor="#3b82f6" /></linearGradient>
          </defs>
          <motion.circle cx="150" cy="80" r="6" className="fill-warning stroke-2 stroke-card cursor-pointer" initial={{ scale: 0 }} whileInView={{ scale: 1 }} whileHover={{ scale: 1.4 }} transition={{ delay: 1 }} onMouseEnter={() => setHoveredMilestone('Day 30 Achieved: Consistent Rhythm')} onMouseLeave={() => setHoveredMilestone(null)} />
          <motion.circle cx="80" cy="150" r="6" className="fill-warning stroke-2 stroke-card cursor-pointer" initial={{ scale: 0 }} whileInView={{ scale: 1 }} whileHover={{ scale: 1.4 }} transition={{ delay: 1.2 }} onMouseEnter={() => setHoveredMilestone('Day 60 Achieved: Deep Focus Habit')} onMouseLeave={() => setHoveredMilestone(null)} />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
          <span className="text-2xl font-black text-foreground font-mono tabular-nums">75%</span>
        </div>

        <AnimatePresence>
          {hoveredMilestone && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-3.5 py-1.5 rounded-lg border border-border shadow-lg z-10 text-center whitespace-nowrap">
              {hoveredMilestone}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function LandingDeepWorkFeatures({ featuresRef, isDark }: { featuresRef: React.RefObject<HTMLDivElement | null>; isDark: boolean }) {
  return (
    <section id="features" ref={featuresRef} className="w-full max-w-7xl px-6 md:px-12 py-24 scroll-mt-24">
      <h2 className="text-3xl md:text-5xl font-black text-center mb-16 tracking-tight text-foreground">Designed for Deep Work</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="surface-card p-8 hover:-translate-y-1 hover:border-primary/30 transition-all duration-300 flex flex-col h-full relative overflow-hidden">
          <div className="text-[9px] font-extrabold tracking-wider text-primary bg-primary/10 w-fit px-3 py-1.5 rounded-lg uppercase mb-4 border border-primary/20">Prioritize</div>
          <h3 className="text-xl font-bold mb-3 text-left text-foreground">Eisenhower Matrix</h3>
          <p className="text-sm mb-8 flex-grow text-left text-muted-foreground">Sort tasks by urgency and importance in a sleek, distraction-free grid.</p>
          <div className="grid grid-cols-2 gap-2.5 mt-auto">
            {EISENHOWER_QUADS.map((q) => (
              <motion.div key={q.code} whileHover={{ scale: 1.03, y: -2 }} className={`aspect-square ${q.cls} rounded-xl flex flex-col items-center justify-center text-xs font-bold p-2 cursor-pointer transition-all duration-200`}>
                <span>{q.code}</span>
                <span className="text-[9px] font-normal opacity-80 mt-1">{q.desc}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <RadialGoalsCard />

        <div className="surface-card p-8 hover:-translate-y-1 hover:border-primary/30 transition-all duration-300 flex flex-col h-full relative overflow-hidden">
          <div className="text-[9px] font-extrabold tracking-wider text-warning bg-warning/10 w-fit px-3 py-1.5 rounded-lg uppercase mb-4 border border-warning/20">Analyze</div>
          <h3 className="text-xl font-bold mb-3 text-left text-foreground">Category Balance</h3>
          <p className="text-sm mb-8 flex-grow text-left text-muted-foreground">Identify strengths and weak categories across different habit streams instantly.</p>
          <div className="flex justify-center mt-auto h-[160px] items-center">
            <svg className="group-hover:scale-105 transition-transform duration-500" height="150" viewBox="0 0 160 160" width="150">
              <polygon fill="none" points="80,10 140.6,45 140.6,115 80,150 19.4,115 19.4,45" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
              <polygon fill="none" points="80,33.3 120.4,56.6 120.4,103.3 80,126.6 39.6,103.3 39.6,56.6" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
              <line stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" x1="80" x2="80" y1="80" y2="10" />
              <line stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" x1="80" x2="140.6" y1="80" y2="45" />
              <motion.polygon
                fill={isDark ? 'rgba(16, 185, 129, 0.22)' : 'rgba(16, 185, 129, 0.14)'}
                stroke="#10b981" strokeWidth="2" points="80,30 110,60 130,100 80,130 40,90 50,50"
                animate={{ points: ['80,30 110,60 130,100 80,130 40,90 50,50', '80,26 114,56 126,104 80,134 36,92 46,46', '80,30 110,60 130,100 80,130 40,90 50,50'] }}
                transition={{ repeat: Infinity, duration: 4.8, ease: 'easeInOut' }}
              />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingCtaSection() {
  return (
    <section className="w-full max-w-5xl px-6 md:px-12 py-24">
      <div className="surface-hero rounded-3xl p-10 md:p-16 text-center relative overflow-hidden shadow-xl">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <h2 className="text-3xl md:text-5xl font-black mb-6 relative z-10 leading-tight tracking-tight text-foreground">Start building your sanctuary.</h2>
        <p className="text-base max-w-2xl mx-auto mb-10 relative z-10 text-muted-foreground">
          Seamlessly synced across your devices with local IndexedDB offline storage and secure Supabase database. No friction, just focus.
        </p>
        <Link href="/login?mode=signup">
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="bg-primary hover:bg-primary/90 text-primary-foreground px-10 py-5 rounded-xl font-bold text-lg relative z-10 cursor-pointer shadow-sm transition-colors">
            Claim Your Free Workspace
          </motion.button>
        </Link>
      </div>
    </section>
  );
}
