'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles, Award, ListTodo } from 'lucide-react';
import { SIMULATOR_HABITS, SIMULATOR_TASKS, type FloatingFeedback } from './useLandingDemoState';

function SimulatorCompanionCard(params: {
  companionDialogue: string;
  flowStage: 1 | 2 | 3;
  momentum: number;
  floatingFeedbacks: FloatingFeedback[];
  onCompanionClick: () => void;
}) {
  const { companionDialogue, flowStage, momentum, floatingFeedbacks, onCompanionClick } = params;
  const stageIcon = flowStage === 1 ? '🌱' : flowStage === 2 ? '🌿' : '🌳';
  const stageLabel = flowStage === 1 ? 'BUILDING MOMENTUM' : flowStage === 2 ? 'HABITS LOCKED IN' : 'FULL DAY COMPLETE';

  return (
    <div id="companion-widget-box" className="w-full md:w-1/3 flex flex-col items-center p-6 rounded-2xl border border-border bg-muted/35 justify-between relative overflow-hidden">
      <div className="w-full text-center">
        <span className="text-[9px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">Interactive Widget</span>
      </div>

      <div className="mt-4 px-3 py-2 rounded-xl text-[11px] font-semibold text-center leading-normal border border-border bg-card text-foreground shadow-xs relative min-h-[3.5rem] flex items-center justify-center w-full">
        {companionDialogue}
        <div className="absolute bottom-[-6px] left-1/2 transform -translate-x-1/2 w-3.5 h-3.5 rotate-45 border-r border-b border-border bg-card" />
      </div>

      <div className="relative w-36 h-36 flex items-center justify-center my-4">
        <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl animate-pulse" />
        <AnimatePresence mode="wait">
          <motion.span
            key={flowStage}
            initial={{ scale: 0.2, rotate: -35 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 11 }}
            className="text-7xl select-none cursor-pointer drop-shadow-md"
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={onCompanionClick}
          >
            {stageIcon}
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="text-center w-full">
        <h3 className="text-base font-black mb-0.5 text-foreground">Daily Flow State</h3>
        <p className="text-[10px] font-extrabold tracking-widest text-primary uppercase font-mono">{stageLabel}</p>
      </div>

      <div className="w-full mt-6">
        <div className="flex justify-between text-[10px] font-bold tracking-wider mb-2">
          <span className="text-primary">DAILY COMPLETION</span>
          <span className="text-muted-foreground font-mono tabular-nums">{momentum}%</span>
        </div>
        <div className="w-full h-3.5 rounded-full overflow-hidden p-0.5 bg-muted border border-border">
          <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${momentum}%` }} transition={{ duration: 0.45, ease: 'easeOut' }} />
        </div>
      </div>

      <AnimatePresence>
        {floatingFeedbacks.filter((f) => f.source === 'widget').map((f) => (
          <motion.div
            key={f.id}
            initial={{ opacity: 1, y: f.y, scale: 0.8 }}
            animate={{ opacity: 0, y: f.y - 40, scale: 1.15 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            style={{ left: `${f.x}px`, top: `${f.y}px` }}
            className="absolute text-xs font-black text-primary pointer-events-none drop-shadow-md z-30 font-mono"
          >
            {f.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function SimulatorMilestonesTab({ hasAnyAction, flowStage }: { hasAnyAction: boolean; flowStage: 1 | 2 | 3 }) {
  return (
    <div className="space-y-3 text-left">
      <div className={`p-4 rounded-xl flex items-center justify-between border ${hasAnyAction ? 'bg-primary/10 border-primary/30' : 'surface-subtle opacity-60'}`}>
        <div className="flex items-center gap-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl border ${hasAnyAction ? 'bg-primary/15 border-primary/35 text-primary' : 'bg-muted border-border text-muted-foreground'}`}>
            <Award className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-foreground">First Step</h4>
            <p className="text-xs text-primary">Complete any habit or task</p>
          </div>
        </div>
        <span className="text-xs font-bold uppercase text-foreground">{hasAnyAction ? 'Unlocked 🔓' : 'Locked 🔒'}</span>
      </div>

      <div className={`p-4 rounded-xl flex items-center justify-between border ${flowStage >= 2 ? 'bg-warning/10 border-warning/30' : 'surface-subtle opacity-60'}`}>
        <div className="flex items-center gap-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl border ${flowStage >= 2 ? 'bg-warning/20 border-warning/40 text-warning' : 'bg-muted border-border text-muted-foreground'}`}>
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-foreground">Habits Locked In</h4>
            <p className="text-xs text-warning">Complete all 3 daily habits</p>
          </div>
        </div>
        <span className="text-xs font-bold uppercase text-foreground">{flowStage >= 2 ? 'Unlocked 🔓' : 'Locked 🔒'}</span>
      </div>
    </div>
  );
}

function SimulatorHabitsList(params: {
  completedHabits: Record<string, boolean>;
  onCompleteHabit: (e: React.MouseEvent<HTMLDivElement>, id: string) => void;
}) {
  const { completedHabits, onCompleteHabit } = params;
  return (
    <div className="space-y-3">
      {SIMULATOR_HABITS.map((habit) => {
        const done = completedHabits[habit.id];
        return (
          <motion.div
            key={habit.id}
            whileHover={!done ? { y: -2 } : {}}
            onClick={(e) => onCompleteHabit(e, habit.id)}
            className={`p-4 rounded-xl flex items-center justify-between cursor-pointer transition-all duration-200 border ${done ? 'bg-primary/10 border-primary/40 shadow-xs' : 'surface-subtle hover:border-primary/30'}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl border border-border bg-card">{habit.icon}</div>
              <div className="text-left">
                <h4 className="font-bold text-sm text-foreground">{habit.name}</h4>
                <p className="text-xs text-muted-foreground">{habit.desc}</p>
              </div>
            </div>
            <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${done ? 'bg-primary border-primary text-primary-foreground' : 'text-transparent border-border'}`}>
              <Check className="h-3.5 w-3.5 stroke-[3.5]" />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function SimulatorTasksList(params: {
  completedTasks: Record<string, boolean>;
  onCompleteTask: (e: React.MouseEvent<HTMLDivElement>, id: string) => void;
}) {
  const { completedTasks, onCompleteTask } = params;
  return (
    <div className="space-y-3">
      {SIMULATOR_TASKS.map((task) => {
        const done = completedTasks[task.id];
        return (
          <motion.div
            key={task.id}
            whileHover={!done ? { y: -2 } : {}}
            onClick={(e) => onCompleteTask(e, task.id)}
            className={`p-4 rounded-xl flex items-center justify-between cursor-pointer transition-all duration-200 border ${done ? 'bg-info/10 border-info/35 opacity-75 line-through' : 'surface-subtle hover:border-info/30'}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center border border-border bg-card"><ListTodo className="h-5 w-5 text-info" /></div>
              <div className="text-left">
                <h4 className={`font-bold text-sm ${done ? 'text-muted-foreground' : 'text-foreground'}`}>{task.name}</h4>
                <p className="text-xs text-muted-foreground">{task.desc}</p>
              </div>
            </div>
            <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${done ? 'bg-info border-info text-info-foreground' : 'text-transparent border-border'}`}>
              <Check className="h-3.5 w-3.5 stroke-[3.5]" />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function SimulatorCelebrationOverlay(params: {
  showFlowComplete: boolean;
  flowStage: 1 | 2 | 3;
  completedTotal: number;
  momentum: number;
}) {
  const { showFlowComplete, flowStage, completedTotal, momentum } = params;
  return (
    <AnimatePresence>
      {showFlowComplete && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 rounded-3xl backdrop-blur-md pointer-events-none"
        >
          <div className="text-center p-6">
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 1.8 }}>
              <h2 className="text-4xl md:text-5xl font-black text-gradient flex items-center gap-2 justify-center drop-shadow-lg">
                <Sparkles className="h-8 w-8 text-primary" />
                {flowStage === 3 ? 'FULL DAY FLOW!' : 'HABITS COMPLETE!'}
                <Sparkles className="h-8 w-8 text-primary" />
              </h2>
            </motion.div>
            <p className="text-foreground text-lg font-bold mt-4">
              {flowStage === 3 ? 'All daily habits and tasks checked off.' : 'You locked in every habit on your daily checklist.'}
            </p>
            <div className="mt-6 inline-flex bg-primary/15 border border-primary/30 px-4 py-1.5 rounded-full text-xs font-semibold text-primary font-mono">
              {completedTotal} / 6 Daily Actions Completed ({momentum}%)
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function LandingSimulatorSection(params: {
  simulatorRef: React.RefObject<HTMLDivElement | null>;
  companionDialogue: string;
  flowStage: 1 | 2 | 3;
  momentum: number;
  activeTab: 'habits' | 'tasks' | 'milestones';
  completedHabits: Record<string, boolean>;
  completedTasks: Record<string, boolean>;
  completedTotal: number;
  showFlowComplete: boolean;
  floatingFeedbacks: FloatingFeedback[];
  onCompanionClick: () => void;
  onSelectTab: (tab: 'habits' | 'tasks' | 'milestones') => void;
  onCompleteHabit: (e: React.MouseEvent<HTMLDivElement>, id: string) => void;
  onCompleteTask: (e: React.MouseEvent<HTMLDivElement>, id: string) => void;
}) {
  const {
    simulatorRef, companionDialogue, flowStage, momentum, activeTab,
    completedHabits, completedTasks, completedTotal, showFlowComplete,
    floatingFeedbacks, onCompanionClick, onSelectTab, onCompleteHabit, onCompleteTask,
  } = params;
  const hasAnyAction = Object.keys(completedHabits).length > 0 || Object.keys(completedTasks).length > 0;

  return (
    <section id="simulator" ref={simulatorRef} className="w-full max-w-5xl px-6 md:px-12 py-20 scroll-mt-24 relative">
      <div className="text-center mb-16 max-w-xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase mb-3 bg-primary/10 text-primary border border-primary/20">Interactive Simulator</div>
        <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight text-foreground">Build Daily Momentum</h2>
        <p className="text-base text-muted-foreground">Check off tasks, complete habits, and watch your daily consistency rate climb in real time.</p>
      </div>

      <div className="surface-hero rounded-3xl p-6 md:p-8 flex flex-col md:flex-row gap-8 items-stretch relative shadow-xl">
        <SimulatorCompanionCard
          companionDialogue={companionDialogue}
          flowStage={flowStage}
          momentum={momentum}
          floatingFeedbacks={floatingFeedbacks}
          onCompanionClick={onCompanionClick}
        />

        <div className="w-full md:w-2/3 flex flex-col gap-4 relative" id="simulator-content-box">
          <div className="flex gap-1.5 p-1 rounded-xl border border-border bg-muted/50">
            {([
              { id: 'habits', label: 'Habits Loop' },
              { id: 'tasks', label: 'Tasks Matrix' },
              { id: 'milestones', label: 'Milestones' },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                  activeTab === tab.id ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-grow flex flex-col gap-3 min-h-[250px] justify-center">
            {activeTab === 'habits' && <SimulatorHabitsList completedHabits={completedHabits} onCompleteHabit={onCompleteHabit} />}
            {activeTab === 'tasks' && <SimulatorTasksList completedTasks={completedTasks} onCompleteTask={onCompleteTask} />}
            {activeTab === 'milestones' && <SimulatorMilestonesTab hasAnyAction={hasAnyAction} flowStage={flowStage} />}
          </div>

          <AnimatePresence>
            {floatingFeedbacks.filter((f) => f.source === 'simulator').map((f) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 1, y: f.y, scale: 0.8 }}
                animate={{ opacity: 0, y: f.y - 45, scale: 1.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
                style={{ left: `${f.x}px`, top: `${f.y}px` }}
                className="absolute text-sm font-extrabold text-primary pointer-events-none drop-shadow-md z-30 font-mono"
              >
                {f.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <SimulatorCelebrationOverlay showFlowComplete={showFlowComplete} flowStage={flowStage} completedTotal={completedTotal} momentum={momentum} />
      </div>
    </section>
  );
}
