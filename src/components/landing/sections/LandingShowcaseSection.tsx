'use client';

import React from 'react';
import { motion, AnimatePresence, type MotionValue } from 'framer-motion';
import { Check, Target, ListTodo, Clock, Sparkle, Calendar, LayoutDashboard } from 'lucide-react';
import type { FloatingFeedback, MockHabitItem, MockRoutineItem } from './useLandingDemoState';

const SIDEBAR_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Habits Tracker', icon: Calendar, active: false },
  { label: 'Pomodoro Timer', icon: Clock, active: false },
  { label: 'Eisenhower Matrix', icon: Target, active: false },
];

function MockSidebar() {
  return (
    <div className="w-full lg:w-56 shrink-0 flex lg:flex-col gap-4 justify-between lg:justify-start p-4 rounded-2xl border border-border bg-muted/40">
      <div className="flex items-center gap-2.5 pb-0 lg:pb-6 border-b border-transparent lg:border-border/50">
        <div className="h-7 w-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
          <svg viewBox="0 0 32 32" className="h-4.5 w-4.5" fill="none">
            <path d="M 16 4 A 12 12 0 1 1 15.99 4" stroke="#10b981" strokeWidth="4" />
          </svg>
        </div>
        <span className="font-black text-sm text-foreground">HabitFlow</span>
      </div>

      <div className="hidden lg:flex flex-col gap-1.5 mt-4 w-full text-left">
        {SIDEBAR_ITEMS.map((item, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
              item.active ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="flex lg:mt-auto items-center gap-3 p-1 rounded-xl">
        <div className="h-8.5 w-8.5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-black shadow-xs">JD</div>
        <div className="hidden lg:block text-left">
          <p className="text-xs font-bold text-foreground">John Doe</p>
          <p className="text-[10px] text-muted-foreground font-mono">Personal Workspace</p>
        </div>
      </div>
    </div>
  );
}

function MockHabitsAndRoutines(params: {
  mockHabits: MockHabitItem[];
  mockRoutines: MockRoutineItem[];
  onToggleHabit: (e: React.MouseEvent, id: string) => void;
  onToggleRoutine: (e: React.MouseEvent, id: string) => void;
}) {
  const { mockHabits, mockRoutines, onToggleHabit, onToggleRoutine } = params;
  return (
    <div className="md:col-span-8 flex flex-col gap-6">
      <div className="p-5 rounded-2xl border border-border bg-card flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className="text-left">
            <h4 className="text-sm font-extrabold text-foreground">Interactive Habits Loop</h4>
            <p className="text-[11px] text-muted-foreground">Click a habit to simulate checking it off</p>
          </div>
          <span className="text-[10px] bg-primary/10 text-primary font-bold px-2.5 py-0.5 rounded-md border border-primary/25">Daily Loop</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {mockHabits.map((habit) => (
            <div
              key={habit.id}
              onClick={(e) => onToggleHabit(e, habit.id)}
              className={`p-3.5 rounded-xl border flex flex-col justify-between items-start gap-3 cursor-pointer transition-all duration-200 relative overflow-hidden ${
                habit.done ? 'bg-primary/10 border-primary/40 shadow-xs' : 'surface-subtle hover:border-primary/30'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${habit.color} shrink-0`}><Sparkle className="h-4.5 w-4.5" /></div>
              <div className="text-left">
                <p className={`text-xs font-bold leading-tight ${habit.done ? 'text-primary' : 'text-foreground'}`}>{habit.name}</p>
                <p className="text-[9px] text-muted-foreground mt-1 font-mono">{habit.done ? 'Completed today ✓' : 'Pending completion'}</p>
              </div>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center absolute top-3 right-3 transition-colors ${habit.done ? 'bg-primary border-primary text-primary-foreground' : 'border-border text-transparent'}`}>
                <Check className="h-3 w-3 stroke-[3]" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-5 rounded-2xl border border-border bg-card flex flex-col gap-4">
        <div className="flex justify-between items-center text-left">
          <div>
            <h4 className="text-sm font-extrabold text-foreground">Routines Checklist</h4>
            <p className="text-[11px] text-muted-foreground">Complete items below to build routine multipliers</p>
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          {mockRoutines.map((routine) => (
            <div
              key={routine.id}
              onClick={(e) => onToggleRoutine(e, routine.id)}
              className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all duration-200 ${
                routine.done ? 'bg-info/10 border-info/30 line-through opacity-75' : 'surface-subtle hover:border-info/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <ListTodo className={`h-4.5 w-4.5 ${routine.done ? 'text-muted-foreground' : 'text-info'}`} />
                <span className={`text-xs font-semibold ${routine.done ? 'text-muted-foreground' : 'text-foreground'}`}>{routine.name}</span>
              </div>
              <div className={`w-5.5 h-5.5 rounded-full border-2 flex items-center justify-center transition-all ${routine.done ? 'bg-info border-info text-info-foreground' : 'border-border'}`}>
                <Check className="h-3 w-3 stroke-[3]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MockProductivityGraph({ range, onChangeRange }: { range: 'week' | 'month'; onChangeRange: (r: 'week' | 'month') => void }) {
  const areaD = range === 'week' ? 'M 0 35 Q 20 10 40 25 T 80 15 T 100 8 L 100 40 L 0 40 Z' : 'M 0 38 Q 25 35 50 15 T 75 10 T 100 2 L 100 40 L 0 40 Z';
  const lineD = range === 'week' ? 'M 0 35 Q 20 10 40 25 T 80 15 T 100 8' : 'M 0 38 Q 25 35 50 15 T 75 10 T 100 2';

  return (
    <div className="md:col-span-4 flex flex-col gap-6">
      <div className="p-5 rounded-2xl border border-border bg-card flex flex-col justify-between gap-4 h-full">
        <div className="flex justify-between items-center">
          <span className="text-xs font-extrabold text-foreground">Productivity Curve</span>
          <div className="flex bg-muted p-0.5 rounded-lg border border-border">
            {(['week', 'month'] as const).map((r) => (
              <button
                key={r}
                onClick={() => onChangeRange(r)}
                className={`text-[9px] font-bold px-2 py-1 rounded-md transition-colors cursor-pointer ${range === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {r === 'week' ? 'Wk' : 'Mo'}
              </button>
            ))}
          </div>
        </div>

        <div className="h-28 flex items-end justify-center relative mt-2">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40">
            <line x1="0" y1="10" x2="100" y2="10" stroke="currentColor" strokeOpacity="0.06" strokeWidth="0.5" />
            <line x1="0" y1="20" x2="100" y2="20" stroke="currentColor" strokeOpacity="0.06" strokeWidth="0.5" />
            <line x1="0" y1="30" x2="100" y2="30" stroke="currentColor" strokeOpacity="0.06" strokeWidth="0.5" />
            <motion.path key={range} initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.16 }} transition={{ duration: 1 }} d={areaD} fill="url(#mock-area-grad)" />
            <motion.path key={`line-${range}`} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: 'easeOut' }} d={lineD} fill="none" stroke="url(#mock-line-grad)" strokeWidth="2" strokeLinecap="round" />
            <defs>
              <linearGradient id="mock-area-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="transparent" /></linearGradient>
              <linearGradient id="mock-line-grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#10b981" /><stop offset="50%" stopColor="#14b8a6" /><stop offset="100%" stopColor="#0ea5e9" /></linearGradient>
            </defs>
          </svg>
        </div>

        <div className="flex justify-between items-center text-[10px] text-muted-foreground">
          <span>Average focus efficiency</span>
          <span className="text-primary font-bold font-mono tabular-nums">89.2%</span>
        </div>
      </div>
    </div>
  );
}

export function LandingShowcaseSection(params: {
  mockupRef: React.RefObject<HTMLDivElement | null>;
  rotateX: MotionValue<number>;
  translateY: MotionValue<number>;
  scale: MotionValue<number>;
  opacity: MotionValue<number>;
  mockHabits: MockHabitItem[];
  mockRoutines: MockRoutineItem[];
  mockGraphRange: 'week' | 'month';
  floatingFeedbacks: FloatingFeedback[];
  onToggleHabit: (e: React.MouseEvent, id: string) => void;
  onToggleRoutine: (e: React.MouseEvent, id: string) => void;
  onChangeRange: (r: 'week' | 'month') => void;
}) {
  const {
    mockupRef, rotateX, translateY, scale, opacity,
    mockHabits, mockRoutines, mockGraphRange, floatingFeedbacks,
    onToggleHabit, onToggleRoutine, onChangeRange,
  } = params;

  return (
    <section id="showcase" ref={mockupRef} className="w-full max-w-7xl px-6 md:px-12 py-16 scroll-mt-24 perspective-container relative">
      <div className="text-center mb-16 max-w-2xl mx-auto">
        <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight text-foreground">The Unified Flow Workspace</h2>
        <p className="text-base text-muted-foreground">Seamlessly integrates habits, tasks, finances, and a focus timer in one calm, architectural workspace.</p>
      </div>

      <motion.div
        style={{ rotateX, y: translateY, scale, opacity }}
        id="mock-dashboard-wrapper"
        className="surface-hero rounded-3xl shadow-2xl p-6 md:p-8 flex flex-col lg:flex-row gap-6 relative overflow-hidden min-h-[500px]"
      >
        <MockSidebar />
        <div className="flex-grow grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          <MockHabitsAndRoutines mockHabits={mockHabits} mockRoutines={mockRoutines} onToggleHabit={onToggleHabit} onToggleRoutine={onToggleRoutine} />
          <MockProductivityGraph range={mockGraphRange} onChangeRange={onChangeRange} />
        </div>

        <AnimatePresence>
          {floatingFeedbacks.filter((f) => f.source === 'mock').map((f) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 1, y: f.y, scale: 0.8 }}
              animate={{ opacity: 0, y: f.y - 50, scale: 1.15 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.95, ease: 'easeOut' }}
              style={{ left: `${f.x}px`, top: `${f.y}px` }}
              className="absolute text-[11px] font-extrabold text-primary pointer-events-none drop-shadow-md z-30 font-mono"
            >
              {f.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}
