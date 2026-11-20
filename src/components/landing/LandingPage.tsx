'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useInView } from 'framer-motion';
import { 
  Play, 
  Check, 
  Sparkles, 
  Sun, 
  Moon, 
  Plus, 
  Target, 
  Award, 
  ListTodo, 
  Flame, 
  Clock, 
  Activity, 
  Compass, 
  ArrowRight,
  TrendingUp,
  RotateCcw,
  Sparkle,
  Zap,
  Calendar,
  Shield,
  Lock,
  Info,
  LayoutDashboard
} from 'lucide-react';
import { useTheme } from '@/providers/theme-provider';
import confetti from 'canvas-confetti';

interface FloatingXP {
  id: string;
  x: number;
  y: number;
  text: string;
}

export function LandingPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Refs for scroll elements
  const pageRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);
  const focusHubRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const simulatorRef = useRef<HTMLDivElement>(null);
  const isSimulatorInView = useInView(simulatorRef, { once: true, amount: 0.15 });

  // Mockup 3D Tilt and Parallax
  const { scrollYProgress: mockupScrollY } = useScroll({
    target: mockupRef,
    offset: ["start end", "end start"]
  });
  const mockupSpringY = useSpring(mockupScrollY, { stiffness: 100, damping: 25 });
  const mockupRotateX = useTransform(mockupSpringY, [0, 0.45], [18, 0]);
  const mockupTranslateY = useTransform(mockupSpringY, [0, 0.5], [60, 0]);
  const mockupScale = useTransform(mockupSpringY, [0, 0.45], [0.88, 1]);
  const mockupOpacity = useTransform(mockupSpringY, [0, 0.4], [0.4, 1]);

  // Focus Hub Pomodoro Scroll Link
  const { scrollYProgress: focusScrollY } = useScroll({
    target: focusHubRef,
    offset: ["start end", "end start"]
  });
  const focusSpringY = useSpring(focusScrollY, { stiffness: 80, damping: 20 });
  const pomodoroScrollOffset = useTransform(focusSpringY, [0.1, 0.6], [276.4, 0]);

  // Component states
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [completedHabits, setCompletedHabits] = useState<Record<string, boolean>>({});
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});
  const [floatingXPs, setFloatingXPs] = useState<FloatingXP[]>([]);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [activeTab, setActiveTab] = useState<'habits' | 'tasks' | 'milestones'>('habits');
  const [hoveredMilestone, setHoveredMilestone] = useState<string | null>(null);

  // Companion state
  const [companionDialogue, setCompanionDialogue] = useState<string>('Click me to level up! 🌱');

  // Pomodoro mock timer
  const [pomodoroSeconds, setPomodoroSeconds] = useState(1500); // 25:00
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Stats tab data
  const totalXP = xp + (level > 1 ? 100 : 0);

  // Mock Dashboard Interactive State
  const [mockHabits, setMockHabits] = useState([
    { id: 'h1', name: 'Drink 3L Water', done: false, color: 'text-blue-500 bg-blue-500/10' },
    { id: 'h2', name: 'Morning Journal', done: false, color: 'text-amber-500 bg-amber-500/10' },
    { id: 'h3', name: 'Pushups Session', done: false, color: 'text-red-500 bg-red-500/10' },
  ]);
  const [mockRoutines, setMockRoutines] = useState([
    { id: 'r1', name: 'Refactor Auth Hooks', done: false },
    { id: 'r2', name: 'Review Team PRs', done: false },
  ]);
  const [mockGraphRange, setMockGraphRange] = useState<'week' | 'month'>('week');

  // Auto-Play Demo States
  const [isDemoActive, setIsDemoActive] = useState(true);
  const [demoStep, setDemoStep] = useState(0);

  const handleManualInteraction = useCallback(() => {
    setIsDemoActive(false);
  }, []);

  const habits = [
    { id: 'meditation', name: 'Morning Meditation', desc: 'Focus · 10 mins', icon: '🧘' },
    { id: 'read', name: 'Read 30 mins', desc: 'Growth · 30 mins', icon: '📚' },
    { id: 'steps', name: '10k Steps', desc: 'Fitness · Daily', icon: '🏃‍♂️' },
  ];

  const tasks = [
    { id: 'task1', name: 'Complete UI layout design', desc: 'Productivity · High' },
    { id: 'task2', name: 'Refactor client sync engine', desc: 'Code · Medium' },
    { id: 'task3', name: 'Prepare release documentation', desc: 'Work · Low' },
  ];

  // Deterministic Level & XP progression system based purely on simulator habits & tasks completion counts
  useEffect(() => {
    const habitsDone = Object.values(completedHabits).filter(Boolean).length;
    const tasksDone = Object.values(completedTasks).filter(Boolean).length;

    if (habitsDone < 3) {
      setLevel(1);
      setXp(Math.round((habitsDone / 3) * 100));
    } else if (habitsDone === 3 && tasksDone < 3) {
      if (level === 1) {
        // Trigger Level 2 Sapling Celebration!
        setLevel(2);
        setXp(0);
        setCompanionDialogue('Wow, I evolved to a Sapling! 🌿');
        setShowLevelUp(true);
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
      } else {
        setLevel(2);
        setXp(Math.round((tasksDone / 3) * 100));
      }
    } else if (habitsDone === 3 && tasksDone === 3) {
      if (level === 2) {
        // Trigger Level 3 Flow Tree Celebration!
        setLevel(3);
        setXp(100);
        setCompanionDialogue('I am a mighty Flow Tree now! 🌳');
        setShowLevelUp(true);
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
      } else if (level === 1) {
        setLevel(3);
        setXp(100);
      }
    }
  }, [completedHabits, completedTasks, level]);

  // Pomodoro timer logic
  useEffect(() => {
    let timer: any;
    if (isTimerRunning && pomodoroSeconds > 0) {
      timer = setInterval(() => {
        setPomodoroSeconds((prev) => prev - 1);
      }, 1000);
    } else if (pomodoroSeconds === 0) {
      setIsTimerRunning(false);
      setPomodoroSeconds(1500);
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 }
      });
      setCompanionDialogue('Time is up! Great focus session! ⏱️');
    }
    return () => clearInterval(timer);
  }, [isTimerRunning, pomodoroSeconds]);

  const triggerXpParticle = (clientX: number, clientY: number, label: string, offsetElementId: string, isRelative = false) => {
    const listElement = document.getElementById(offsetElementId);
    const listRect = listElement?.getBoundingClientRect();
    
    if (listRect) {
      const x = isRelative ? clientX : clientX - listRect.left;
      const y = isRelative ? clientY : clientY - listRect.top;
      const newFloatingXP: FloatingXP = {
        id: Math.random().toString(),
        x,
        y,
        text: label,
      };
      setFloatingXPs((prev) => [...prev, newFloatingXP]);

      setTimeout(() => {
        setFloatingXPs((prev) => prev.filter((item) => item.id !== newFloatingXP.id));
      }, 950);
    }
  };

  const handleCompleteHabit = (e: React.MouseEvent<HTMLDivElement> | null, habitId: string) => {
    if (completedHabits[habitId]) return;
    if (e) handleManualInteraction();
    setCompletedHabits((prev) => ({ ...prev, [habitId]: true }));
    
    if (e) {
      triggerXpParticle(e.clientX, e.clientY, '+35 XP', 'simulator-content-box');
      confetti({
        particleCount: 30,
        angle: 60,
        spread: 55,
        origin: { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight }
      });
    } else {
      const relativeY = habitId === 'meditation' ? 60 : habitId === 'read' ? 120 : 180;
      triggerXpParticle(320, relativeY, '+35 XP', 'simulator-content-box', true);
      confetti({
        particleCount: 20,
        angle: 60,
        spread: 45,
        origin: { x: 0.45, y: 0.7 }
      });
    }
  };

  const handleCompleteTask = (e: React.MouseEvent<HTMLDivElement> | null, taskId: string) => {
    if (completedTasks[taskId]) return;
    if (e) handleManualInteraction();
    setCompletedTasks((prev) => ({ ...prev, [taskId]: true }));
    
    if (e) {
      triggerXpParticle(e.clientX, e.clientY, '+15 XP', 'simulator-content-box');
      confetti({
        particleCount: 20,
        angle: 120,
        spread: 45,
        origin: { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight }
      });
    } else {
      const relativeY = taskId === 'task1' ? 60 : taskId === 'task2' ? 120 : 180;
      triggerXpParticle(320, relativeY, '+15 XP', 'simulator-content-box', true);
      confetti({
        particleCount: 15,
        angle: 120,
        spread: 45,
        origin: { x: 0.45, y: 0.7 }
      });
    }
  };

  const handleToggleTimer = () => {
    if (!isTimerRunning) handleManualInteraction();
    setIsTimerRunning(!isTimerRunning);
  };

  const formatTime = (sec: number) => {
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleCompanionClick = (e: React.MouseEvent | null) => {
    if (e) handleManualInteraction();
    const dialoguePool = [
      'Consistency overrides motivation! ⚡',
      'Focusing is a habit, keep going! 🚀',
      'Grow with me daily! 🌱',
      'You are doing amazing! 🎯',
      'Stay hydrated and take breaks! 💧',
      'One step at a time! ✨'
    ];
    const randomIndex = Math.floor(Math.random() * dialoguePool.length);
    setCompanionDialogue(dialoguePool[randomIndex]);

    if (e) {
      triggerXpParticle(e.clientX, e.clientY, '+5 XP', 'companion-widget-box');
      confetti({
        particleCount: 15,
        spread: 40,
        origin: { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight }
      });
    } else {
      triggerXpParticle(72, 100, '+5 XP', 'companion-widget-box', true);
      confetti({
        particleCount: 10,
        spread: 30,
        origin: { x: 0.25, y: 0.6 }
      });
    }
  };

  const handleToggleMockHabit = (e: React.MouseEvent | null, habitId: string) => {
    if (e) handleManualInteraction();
    setMockHabits((prev) =>
      prev.map((h) => {
        if (h.id === habitId) {
          if (!h.done) {
            if (e) {
              triggerXpParticle(e.clientX, e.clientY, '+20 XP', 'mock-dashboard-wrapper');
              confetti({ particleCount: 15, spread: 30, origin: { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight } });
            } else {
              const relativeX = habitId === 'h1' ? 120 : habitId === 'h2' ? 240 : 360;
              triggerXpParticle(relativeX, 145, '+20 XP', 'mock-dashboard-wrapper', true);
              confetti({ particleCount: 10, spread: 25, origin: { x: 0.7, y: 0.45 } });
            }
          }
          return { ...h, done: !h.done };
        }
        return h;
      })
    );
  };

  const handleToggleMockRoutine = (e: React.MouseEvent | null, routineId: string) => {
    if (e) handleManualInteraction();
    setMockRoutines((prev) =>
      prev.map((r) => {
        if (r.id === routineId) {
          if (!r.done) {
            if (e) {
              triggerXpParticle(e.clientX, e.clientY, '+10 XP', 'mock-dashboard-wrapper');
            } else {
              const relativeY = routineId === 'r1' ? 275 : 325;
              triggerXpParticle(350, relativeY, '+10 XP', 'mock-dashboard-wrapper', true);
            }
          }
          return { ...r, done: !r.done };
        }
        return r;
      })
    );
  };

  useEffect(() => {
    if (showLevelUp) {
      const timer = setTimeout(() => setShowLevelUp(false), 2800);
      return () => clearTimeout(timer);
    }
  }, [showLevelUp]);

  // Autoplay loop timer (triggers every 0.9s) - only starts when scrolled into view
  useEffect(() => {
    if (!isDemoActive || !isSimulatorInView) return;

    const interval = setInterval(() => {
      setDemoStep((prev) => (prev + 1) % 15);
    }, 900);

    return () => clearInterval(interval);
  }, [isDemoActive, isSimulatorInView]);

  // Autoplay script steps mapping
  useEffect(() => {
    if (!isDemoActive || !isSimulatorInView) return;

    switch (demoStep) {
      case 0:
        // Reset state
        setMockHabits([
          { id: 'h1', name: 'Drink 3L Water', done: false, color: 'text-blue-500 bg-blue-500/10' },
          { id: 'h2', name: 'Morning Journal', done: false, color: 'text-amber-500 bg-amber-500/10' },
          { id: 'h3', name: 'Pushups Session', done: false, color: 'text-red-500 bg-red-500/10' },
        ]);
        setMockRoutines([
          { id: 'r1', name: 'Refactor Auth Hooks', done: false },
          { id: 'r2', name: 'Review Team PRs', done: false },
        ]);
        setMockGraphRange('week');
        setCompletedHabits({});
        setCompletedTasks({});
        setActiveTab('habits');
        setLevel(1);
        setXp(0);
        setCompanionDialogue('Watch me evolve as habits complete! 🌿');
        break;

      case 1:
        // Complete mock habit 1
        handleToggleMockHabit(null, 'h1');
        break;

      case 2:
        // Complete mock habit 2
        handleToggleMockHabit(null, 'h2');
        break;

      case 3:
        // Complete mock habit 3
        handleToggleMockHabit(null, 'h3');
        break;

      case 4:
        // Click companion
        handleCompanionClick(null);
        break;

      case 5:
        // Complete simulator habit 1: meditation
        handleCompleteHabit(null, 'meditation');
        break;

      case 6:
        // Complete simulator habit 2: read
        handleCompleteHabit(null, 'read');
        break;

      case 7:
        // Complete simulator habit 3: steps -> This will trigger LEVEL 2 EVOLUTION!
        handleCompleteHabit(null, 'steps');
        break;

      case 8:
        // Switch simulator tab to tasks
        setActiveTab('tasks');
        break;

      case 9:
        // Complete simulator task 1
        handleCompleteTask(null, 'task1');
        break;

      case 10:
        // Complete simulator task 2
        handleCompleteTask(null, 'task2');
        break;

      case 11:
        // Complete simulator task 3 -> This will trigger LEVEL 3 EVOLUTION!
        handleCompleteTask(null, 'task3');
        break;

      case 12:
        // Complete mock routine
        handleToggleMockRoutine(null, 'r1');
        break;

      case 13:
        // Toggle graph range
        setMockGraphRange('month');
        break;

      case 14:
        // Switch to milestones tab to showcase unlocked
        setActiveTab('milestones');
        break;
    }
  }, [demoStep, isDemoActive, isSimulatorInView]);

  return (
    <div 
      ref={pageRef}
      className="landing-mesh min-h-screen relative overflow-x-hidden flex flex-col font-sans text-foreground transition-colors duration-300"
    >
      <style jsx global>{`
        .perspective-container {
          perspective: 1000px;
        }

        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Navigation Header */}
      <header className="fixed top-0 w-full surface-chrome border-b z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-6 md:px-12 py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/25 shadow-xs">
              <svg viewBox="0 0 32 32" className="h-6 w-6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 16 4 A 12 12 0 1 1 15.99 4" stroke="url(#header-logo-grad)" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M 12 16.5 L 15 19.5 L 21 12.5" stroke="url(#header-logo-grad-2)" strokeWidth="3.5" strokeLinecap="round" />
                <defs>
                  <linearGradient id="header-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#14b8a6" />
                  </linearGradient>
                  <linearGradient id="header-logo-grad-2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#14b8a6" />
                    <stop offset="100%" stopColor="#0ea5e9" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="text-xl md:text-2xl font-black tracking-tight text-foreground">
              Habit<span className="text-primary">Flow</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#showcase" className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors duration-200">Showcase</a>
            <a href="#simulator" className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors duration-200">Simulator</a>
            <a href="#focus-hub" className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors duration-200">Focus Hub</a>
            <a href="#features" className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors duration-200">Deep Work</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted transition-all duration-200 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Toggle theme"
            >
              {isDark ? <Sun className="h-5 w-5 text-warning" /> : <Moon className="h-5 w-5 text-foreground" />}
            </button>

            <Link href="/login">
              <motion.button 
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all px-6 py-2.5 rounded-xl font-bold text-sm cursor-pointer"
              >
                Sign In
              </motion.button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow pt-24 flex flex-col items-center">
        
        {/* 1. Hero Zone */}
        <section className="w-full max-w-7xl px-6 md:px-12 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative min-h-[80vh]">
          
          {/* Hero Left Content Area */}
          <div className="lg:col-span-7 flex flex-col text-center lg:text-left items-center lg:items-start z-10">
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase mb-6 bg-primary/10 text-primary border border-primary/25"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              Precision Life &amp; Finance OS
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] mb-6 text-foreground"
            >
              Master habits.<br />
              Find your <span className="text-gradient">Flow.</span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-lg md:text-xl mb-10 max-w-xl text-muted-foreground"
            >
              Build consistency, conquer deep work, and steer your personal finances in one calm, offline-first Life OS.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex flex-wrap gap-4 justify-center lg:justify-start w-full"
            >
              <Link href="/login?mode=signup">
                <motion.button 
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 rounded-xl font-bold text-base cursor-pointer shadow-sm transition-all duration-200"
                >
                  Get Started for Free
                </motion.button>
              </Link>
              <a href="#showcase">
                <motion.button 
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className="bg-card hover:bg-muted border border-border text-foreground transition-all duration-200 px-8 py-4 rounded-xl font-bold text-base flex items-center gap-2 cursor-pointer"
                >
                  <Play className="h-5 w-5 fill-current text-primary" />
                  View Interactive Demo
                </motion.button>
              </a>
            </motion.div>
          </div>

          {/* Hero Right Layered Panels Area */}
          <div className="lg:col-span-5 relative w-full h-[400px] flex items-center justify-center lg:justify-end mt-12 lg:mt-0">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
              animate={{ opacity: 1, scale: 1, rotate: -2 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="surface-hero rounded-2xl p-8 w-full max-w-sm shadow-xl absolute z-20 hover:scale-[1.02] transition-transform duration-300"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-orange-500/10 rounded-lg">
                    <Flame className="h-5 w-5 text-orange-500" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">Active Streak</h3>
                </div>
                <span className="text-[10px] font-extrabold tracking-wider px-3 py-1 rounded-full uppercase border bg-primary/10 text-primary border-primary/25 font-mono">DAY 12</span>
              </div>
              
              <div className="text-5xl font-black mb-4 tracking-tight flex items-baseline font-mono tabular-nums text-foreground">
                12<span className="text-sm font-sans font-semibold ml-1.5 text-muted-foreground">days in a row</span>
              </div>

              <div className="text-xs font-semibold mb-3 flex justify-between items-center text-muted-foreground">
                <span>Weekly Consistency</span>
                <span className="text-primary font-bold font-mono tabular-nums">4 / 7 days completed</span>
              </div>

              <div className="flex justify-between gap-2.5 mt-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-2.5 flex-1 bg-primary rounded-full" />
                ))}
                {[5, 6, 7].map((i) => (
                  <div key={i} className="h-2.5 flex-1 rounded-full bg-muted" />
                ))}
              </div>
            </motion.div>

            {/* Decorative calendar bubble peeking from behind */}
            <motion.div
              initial={{ opacity: 0, x: 40, y: -40, rotate: 6 }}
              animate={{ opacity: 0.95, x: 20, y: -80, rotate: 8 }}
              transition={{ duration: 1, delay: 0.4 }}
              className="surface-card p-4 w-48 shadow-lg absolute z-10 hidden sm:block"
            >
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4.5 w-4.5 text-primary" />
                <span className="text-xs font-bold text-foreground">Habit Grid</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: 15 }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`aspect-square rounded ${
                      i % 3 === 0 
                        ? 'bg-primary shadow-xs' 
                        : 'bg-muted'
                    }`} 
                  />
                ))}
              </div>
            </motion.div>

            {/* Mini Stat tag under the streak card */}
            <motion.div
              initial={{ opacity: 0, x: -60, y: 50, rotate: -8 }}
              animate={{ opacity: 0.95, x: -50, y: 80, rotate: -6 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="surface-card p-4 w-48 shadow-lg absolute z-10 hidden sm:block"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Award className="h-4.5 w-4.5 text-warning" />
                  <span className="text-xs font-bold text-foreground font-mono">Level 12</span>
                </div>
                <span className="text-[10px] text-invest font-extrabold font-mono">+230 XP</span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden mt-2 bg-muted">
                <div className="w-[70%] h-full bg-invest rounded-full" />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Global Auto-Play Live Demo Banner */}
        <div className="w-full max-w-7xl px-6 md:px-12 pt-6 flex justify-center z-10">
          <button 
            onClick={() => {
              setIsDemoActive(!isDemoActive);
              if (!isDemoActive) setDemoStep(0);
            }}
            className={`px-6 py-3 rounded-full text-xs font-black tracking-widest uppercase flex items-center gap-2.5 border transition-all duration-200 shadow-sm cursor-pointer ${
              isDemoActive 
                ? 'bg-primary border-primary text-primary-foreground' 
                : 'bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isDemoActive ? 'bg-primary-foreground' : 'bg-muted-foreground'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isDemoActive ? 'bg-primary-foreground' : 'bg-muted-foreground'}`}></span>
            </span>
            {isDemoActive ? 'Auto-Play Active (Interact to Pause)' : '▶ Resume Live Demo Loop'}
          </button>
        </div>

        {/* 2. Interactive 3D Mockup Section (App Dashboard Showcase) */}
        <section id="showcase" ref={mockupRef} className="w-full max-w-7xl px-6 md:px-12 py-16 scroll-mt-24 perspective-container relative">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight text-foreground">
              The Unified Flow Workspace
            </h2>
            <p className="text-base text-muted-foreground">
              Seamlessly integrates habits, tasks, finances, and a focus timer in one calm, architectural workspace.
            </p>
          </div>

          <motion.div 
            style={{ 
              rotateX: mockupRotateX,
              y: mockupTranslateY,
              scale: mockupScale,
              opacity: mockupOpacity
            }}
            id="mock-dashboard-wrapper"
            className="surface-hero rounded-3xl shadow-2xl p-6 md:p-8 flex flex-col lg:flex-row gap-6 relative overflow-hidden min-h-[500px]"
          >
            {/* Mock Sidebar (Left) */}
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
                {[
                  { label: 'Dashboard', icon: LayoutDashboard, active: true },
                  { label: 'Habits Tracker', icon: Calendar, active: false },
                  { label: 'Pomodoro Timer', icon: Clock, active: false },
                  { label: 'Eisenhower Matrix', icon: Target, active: false }
                ].map((item, idx) => (
                  <div 
                    key={idx} 
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                      item.active 
                        ? 'bg-primary text-primary-foreground shadow-xs' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>

              <div className="flex lg:mt-auto items-center gap-3 p-1 rounded-xl">
                <div className="h-8.5 w-8.5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-black shadow-xs">
                  JD
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-bold text-foreground">John Doe</p>
                  <p className="text-[10px] text-muted-foreground font-mono">Level 12 Sapling</p>
                </div>
              </div>
            </div>

            {/* Mock Dashboard Grid Workspace (Middle/Right) */}
            <div className="flex-grow grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              
              {/* Main Content Area: Habits Loop + Tasks List */}
              <div className="md:col-span-8 flex flex-col gap-6">
                
                {/* Mock Habits Widget */}
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
                        onClick={(e) => handleToggleMockHabit(e, habit.id)}
                        className={`p-3.5 rounded-xl border flex flex-col justify-between items-start gap-3 cursor-pointer transition-all duration-200 relative overflow-hidden ${
                          habit.done 
                            ? 'bg-primary/10 border-primary/40 shadow-xs' 
                            : 'surface-subtle hover:border-primary/30'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg ${habit.color} shrink-0`}>
                          <Sparkle className="h-4.5 w-4.5" />
                        </div>
                        <div className="text-left">
                          <p className={`text-xs font-bold leading-tight ${
                            habit.done ? 'text-primary' : 'text-foreground'
                          }`}>{habit.name}</p>
                          <p className="text-[9px] text-muted-foreground mt-1 font-mono">{habit.done ? 'Completed! +20XP' : 'Pending completion'}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center absolute top-3 right-3 transition-colors ${
                          habit.done ? 'bg-primary border-primary text-primary-foreground' : 'border-border text-transparent'
                        }`}>
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mock Routine Tasks Widget */}
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
                        onClick={(e) => handleToggleMockRoutine(e, routine.id)}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all duration-200 ${
                          routine.done 
                            ? 'bg-info/10 border-info/30 line-through opacity-75' 
                            : 'surface-subtle hover:border-info/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <ListTodo className={`h-4.5 w-4.5 ${routine.done ? 'text-muted-foreground' : 'text-info'}`} />
                          <span className={`text-xs font-semibold ${
                            routine.done ? 'text-muted-foreground' : 'text-foreground'
                          }`}>{routine.name}</span>
                        </div>
                        <div className={`w-5.5 h-5.5 rounded-full border-2 flex items-center justify-center transition-all ${
                          routine.done ? 'bg-info border-info text-info-foreground' : 'border-border'
                        }`}>
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sidebar/Details Widgets Area (Right Column) */}
              <div className="md:col-span-4 flex flex-col gap-6">
                
                {/* Mock Live Productivity Stats Graph */}
                <div className="p-5 rounded-2xl border border-border bg-card flex flex-col justify-between gap-4 h-full">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-extrabold text-foreground">Productivity Curve</span>
                    
                    {/* Inline Tab Toggle */}
                    <div className="flex bg-muted p-0.5 rounded-lg border border-border">
                      <button 
                        onClick={() => { handleManualInteraction(); setMockGraphRange('week'); }}
                        className={`text-[9px] font-bold px-2 py-1 rounded-md transition-colors cursor-pointer ${
                          mockGraphRange === 'week' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >Wk</button>
                      <button 
                        onClick={() => { handleManualInteraction(); setMockGraphRange('month'); }}
                        className={`text-[9px] font-bold px-2 py-1 rounded-md transition-colors cursor-pointer ${
                          mockGraphRange === 'month' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >Mo</button>
                    </div>
                  </div>

                  {/* SVG productivity graph with animatable drawing line */}
                  <div className="h-28 flex items-end justify-center relative mt-2">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40">
                      <line x1="0" y1="10" x2="100" y2="10" stroke="currentColor" strokeOpacity="0.06" strokeWidth="0.5" />
                      <line x1="0" y1="20" x2="100" y2="20" stroke="currentColor" strokeOpacity="0.06" strokeWidth="0.5" />
                      <line x1="0" y1="30" x2="100" y2="30" stroke="currentColor" strokeOpacity="0.06" strokeWidth="0.5" />
                      
                      <motion.path 
                        key={mockGraphRange}
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 0.16 }}
                        transition={{ duration: 1 }}
                        d={mockGraphRange === 'week' 
                          ? "M 0 35 Q 20 10 40 25 T 80 15 T 100 8 L 100 40 L 0 40 Z" 
                          : "M 0 38 Q 25 35 50 15 T 75 10 T 100 2 L 100 40 L 0 40 Z"
                        } 
                        fill="url(#mock-area-grad)" 
                      />

                      <motion.path 
                        key={`line-${mockGraphRange}`}
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                        d={mockGraphRange === 'week' 
                          ? "M 0 35 Q 20 10 40 25 T 80 15 T 100 8" 
                          : "M 0 38 Q 25 35 50 15 T 75 10 T 100 2"
                        }
                        fill="none" 
                        stroke="url(#mock-line-grad)" 
                        strokeWidth="2" 
                        strokeLinecap="round"
                      />

                      <defs>
                        <linearGradient id="mock-area-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="transparent" />
                        </linearGradient>
                        <linearGradient id="mock-line-grad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="50%" stopColor="#14b8a6" />
                          <stop offset="100%" stopColor="#0ea5e9" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                    <span>Average focus efficiency</span>
                    <span className="text-primary font-bold font-mono tabular-nums">89.2%</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Simulated floating interactive particles */}
            <AnimatePresence>
              {floatingXPs.filter(f => f.text.includes('XP') && !f.text.includes('+35') && !f.text.includes('+15')).map((f) => (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 1, y: f.y, scale: 0.8 }}
                  animate={{ opacity: 0, y: f.y - 50, scale: 1.25 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.95, ease: 'easeOut' }}
                  style={{ left: `${f.x}px`, top: `${f.y}px` }}
                  className="absolute text-[11px] font-extrabold text-invest pointer-events-none drop-shadow-md z-30 font-mono"
                >
                  {f.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </section>

        {/* 3. Interactive Companion Simulator Section */}
        <section id="simulator" ref={simulatorRef} className="w-full max-w-5xl px-6 md:px-12 py-20 scroll-mt-24 relative">
          
          <div className="text-center mb-16 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase mb-3 bg-primary/10 text-primary border border-primary/20">
              Interactive Simulator
            </div>
            <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight text-foreground">
              Grow Your Companion
            </h2>
            <p className="text-base text-muted-foreground">
              Check off tasks, complete habits, and watch your companion evolve with real-time stats and level up notifications.
            </p>
          </div>

          <div className="surface-hero rounded-3xl p-6 md:p-8 flex flex-col md:flex-row gap-8 items-stretch relative shadow-xl">
            
            {/* Companion Widget Column (Left) */}
            <div 
              id="companion-widget-box"
              className="w-full md:w-1/3 flex flex-col items-center p-6 rounded-2xl border border-border bg-muted/35 justify-between relative overflow-hidden"
            >
              <div className="w-full text-center">
                <span className="text-[9px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  Interactive Widget
                </span>
              </div>

              {/* Dialogue Box */}
              <div className="mt-4 px-3 py-2 rounded-xl text-[11px] font-semibold text-center leading-normal border border-border bg-card text-foreground shadow-xs relative min-h-[3.5rem] flex items-center justify-center w-full">
                {companionDialogue}
                <div className="absolute bottom-[-6px] left-1/2 transform -translate-x-1/2 w-3.5 h-3.5 rotate-45 border-r border-b border-border bg-card" />
              </div>

              {/* Companion representation with custom spring scale */}
              <div className="relative w-36 h-36 flex items-center justify-center my-4">
                <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl animate-pulse" />
                <AnimatePresence mode="wait">
                  <motion.span 
                    key={level}
                    initial={{ scale: 0.2, rotate: -35 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 11 }}
                    className="text-7xl select-none cursor-pointer drop-shadow-md"
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleCompanionClick(null)}
                  >
                    {level === 1 ? '🌱' : level === 2 ? '🌿' : '🌳'}
                  </motion.span>
                </AnimatePresence>
              </div>

              <div className="text-center w-full">
                <h3 className="text-base font-black mb-0.5 text-foreground">Companion Stage</h3>
                <p className="text-[10px] font-extrabold tracking-widest text-primary uppercase font-mono">
                  {level === 1 ? 'LEVEL 1: SEEDLING' : level === 2 ? 'LEVEL 2: SAPLING' : 'LEVEL 3: FLOW TREE'}
                </p>
              </div>

              {/* Progress HUD bar */}
              <div className="w-full mt-6">
                <div className="flex justify-between text-[10px] font-bold tracking-wider mb-2">
                  <span className="text-invest">XP PROGRESS</span>
                  <span className="text-muted-foreground font-mono tabular-nums">{xp} / 100</span>
                </div>
                <div className="w-full h-3.5 rounded-full overflow-hidden p-0.5 bg-muted border border-border">
                  <motion.div 
                    className="h-full bg-invest rounded-full" 
                    animate={{ width: `${xp}%` }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Particle indicator tracker */}
              <AnimatePresence>
                {floatingXPs.filter(f => f.text.includes('+5 XP')).map((f) => (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 1, y: f.y, scale: 0.8 }}
                    animate={{ opacity: 0, y: f.y - 40, scale: 1.2 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                    style={{ left: `${f.x}px`, top: `${f.y}px` }}
                    className="absolute text-xs font-black text-warning pointer-events-none drop-shadow-md z-30 font-mono"
                  >
                    {f.text}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Dashboard Content Container (Right Column) */}
            <div className="w-full md:w-2/3 flex flex-col gap-4 relative" id="simulator-content-box">
              
              {/* Tab Selector */}
              <div className="flex gap-1.5 p-1 rounded-xl border border-border bg-muted/50">
                <button 
                  onClick={() => { handleManualInteraction(); setActiveTab('habits'); }} 
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeTab === 'habits' 
                      ? 'bg-primary text-primary-foreground shadow-xs' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Habits Loop
                </button>
                <button 
                  onClick={() => { handleManualInteraction(); setActiveTab('tasks'); }} 
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeTab === 'tasks' 
                      ? 'bg-primary text-primary-foreground shadow-xs' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Tasks Matrix
                </button>
                <button 
                  onClick={() => { handleManualInteraction(); setActiveTab('milestones'); }} 
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeTab === 'milestones' 
                      ? 'bg-primary text-primary-foreground shadow-xs' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Milestones
                </button>
              </div>

              {/* Tab Contents */}
              <div className="flex-grow flex flex-col gap-3 min-h-[250px] justify-center">
                
                {activeTab === 'habits' && (
                  <div className="space-y-3">
                    {habits.map((habit) => {
                      const isCompleted = completedHabits[habit.id];
                      return (
                        <motion.div
                          key={habit.id}
                          whileHover={!isCompleted ? { y: -2 } : {}}
                          onClick={(e) => handleCompleteHabit(e, habit.id)}
                          className={`p-4 rounded-xl flex items-center justify-between cursor-pointer transition-all duration-200 border ${
                            isCompleted 
                              ? 'bg-primary/10 border-primary/40 shadow-xs' 
                              : 'surface-subtle hover:border-primary/30'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl border border-border bg-card">
                              {habit.icon}
                            </div>
                            <div className="text-left">
                              <h4 className="font-bold text-sm text-foreground">{habit.name}</h4>
                              <p className="text-xs text-muted-foreground">{habit.desc}</p>
                            </div>
                          </div>
                          
                          <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                            isCompleted 
                              ? 'bg-primary border-primary text-primary-foreground' 
                              : 'text-transparent border-border'
                          }`}>
                            <Check className="h-3.5 w-3.5 stroke-[3.5]" />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {activeTab === 'tasks' && (
                  <div className="space-y-3">
                    {tasks.map((task) => {
                      const isCompleted = completedTasks[task.id];
                      return (
                        <motion.div
                          key={task.id}
                          whileHover={!isCompleted ? { y: -2 } : {}}
                          onClick={(e) => handleCompleteTask(e, task.id)}
                          className={`p-4 rounded-xl flex items-center justify-between cursor-pointer transition-all duration-200 border ${
                            isCompleted 
                              ? 'bg-info/10 border-info/35 opacity-75 line-through' 
                              : 'surface-subtle hover:border-info/30'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center border border-border bg-card">
                              <ListTodo className="h-5 w-5 text-info" />
                            </div>
                            <div className="text-left">
                              <h4 className={`font-bold text-sm ${
                                isCompleted ? 'text-muted-foreground' : 'text-foreground'
                              }`}>{task.name}</h4>
                              <p className="text-xs text-muted-foreground">{task.desc}</p>
                            </div>
                          </div>
                          
                          <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                            isCompleted 
                              ? 'bg-info border-info text-info-foreground' 
                              : 'text-transparent border-border'
                          }`}>
                            <Check className="h-3.5 w-3.5 stroke-[3.5]" />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {activeTab === 'milestones' && (
                  <div className="space-y-3 text-left">
                    {/* Badge 1 */}
                    <div className={`p-4 rounded-xl flex items-center justify-between border ${
                      Object.keys(completedHabits).length > 0 || Object.keys(completedTasks).length > 0
                        ? 'bg-primary/10 border-primary/30' 
                        : 'surface-subtle opacity-60'
                    }`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl border ${
                          Object.keys(completedHabits).length > 0 || Object.keys(completedTasks).length > 0
                            ? 'bg-primary/15 border-primary/35 text-primary' 
                            : 'bg-muted border-border text-muted-foreground'
                        }`}>
                          <Award className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-foreground">First Step</h4>
                          <p className="text-xs text-primary">Complete any habit or task</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold uppercase text-foreground">{
                        Object.keys(completedHabits).length > 0 || Object.keys(completedTasks).length > 0 ? 'Unlocked 🔓' : 'Locked 🔒'
                      }</span>
                    </div>

                    {/* Badge 2 */}
                    <div className={`p-4 rounded-xl flex items-center justify-between border ${
                      level >= 2
                        ? 'bg-warning/10 border-warning/30' 
                        : 'surface-subtle opacity-60'
                    }`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl border ${
                          level >= 2
                            ? 'bg-warning/20 border-warning/40 text-warning' 
                            : 'bg-muted border-border text-muted-foreground'
                        }`}>
                          <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-foreground">Evolution</h4>
                          <p className="text-xs text-warning">Evolve companion to Level 2</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold uppercase text-foreground">{level >= 2 ? 'Unlocked 🔓' : 'Locked 🔒'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Floating +XP particles for list completions */}
              <AnimatePresence>
                {floatingXPs.filter(f => f.text.includes('+35') || f.text.includes('+15')).map((f) => (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 1, y: f.y, scale: 0.8 }}
                    animate={{ opacity: 0, y: f.y - 45, scale: 1.25 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                    style={{ left: `${f.x}px`, top: `${f.y}px` }}
                    className="absolute text-sm font-extrabold text-warning pointer-events-none drop-shadow-md z-30 font-mono"
                  >
                    {f.text}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            
            {/* Level up popup overlay */}
            <AnimatePresence>
              {showLevelUp && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 rounded-3xl backdrop-blur-md pointer-events-none"
                >
                  <div className="text-center p-6">
                    <motion.div
                      animate={{ y: [0, -12, 0] }}
                      transition={{ repeat: Infinity, duration: 1.8 }}
                    >
                      <h2 className="text-4xl md:text-5xl font-black text-gradient flex items-center gap-2 justify-center drop-shadow-lg">
                        <Sparkles className="h-8 w-8 text-warning" />
                        LEVEL UP!
                        <Sparkles className="h-8 w-8 text-warning" />
                      </h2>
                    </motion.div>
                    <p className="text-foreground text-lg font-bold mt-4">Your companion evolved to Level {level}!</p>
                    <div className="mt-6 inline-flex bg-invest/15 border border-invest/30 px-4 py-1.5 rounded-full text-xs font-semibold text-invest font-mono">
                      XP Gained: {totalXP} XP Total
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* 4. Focus Hub Preview Section (Scroll-linked Progress Circle) */}
        <section id="focus-hub" ref={focusHubRef} className="w-full max-w-6xl px-6 md:px-12 py-24 scroll-mt-24">
          <div className="text-center mb-16 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase mb-3 bg-primary/10 text-primary border border-primary/20">
              Premium Feature Preview
            </div>
            <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight text-foreground">
              Deep Work Focus Hub
            </h2>
            <p className="text-base text-muted-foreground">
              Access integrated focus tools inside the app. Try the Pomodoro Focus module below, synced to scroll kinetics.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Interactive Pomodoro Preview */}
            <div className="surface-hero p-8 flex flex-col items-center justify-center relative shadow-md">
              <h3 className="text-lg font-bold mb-8 flex items-center gap-2 text-foreground">
                <Clock className="h-5 w-5 text-primary" />
                Pomodoro Focus Timer
              </h3>

              <div className="relative w-44 h-44 flex items-center justify-center mb-8">
                <svg className="absolute transform -rotate-90" width="100%" height="100%" viewBox="0 0 100 100">
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="44" 
                    fill="none" 
                    stroke="currentColor"
                    strokeOpacity="0.1"
                    strokeWidth="6" 
                  />
                  <motion.circle 
                    cx="50" 
                    cy="50" 
                    r="44" 
                    fill="none" 
                    stroke="url(#pomodoro-glow-grad)" 
                    strokeWidth="6" 
                    strokeLinecap="round"
                    style={{ 
                      strokeDasharray: 276.4,
                      strokeDashoffset: isTimerRunning 
                        ? (pomodoroSeconds / 1500) * 276.4 
                        : pomodoroScrollOffset 
                    }}
                  />
                  <defs>
                    <linearGradient id="pomodoro-glow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#14b8a6" />
                    </linearGradient>
                  </defs>
                </svg>

                <div className="flex flex-col items-center justify-center z-10">
                  <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono tabular-nums">
                    {formatTime(pomodoroSeconds)}
                  </span>
                  <span className="text-[9px] font-extrabold text-primary uppercase tracking-wider mt-1">Focus Session</span>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={handleToggleTimer}
                  className="bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground font-bold px-6 py-2.5 rounded-xl text-sm transition-all duration-200 shadow-xs cursor-pointer"
                >
                  {isTimerRunning ? 'Pause Session' : 'Start Focus'}
                </button>
                <button 
                  onClick={() => { setIsTimerRunning(false); setPomodoroSeconds(1500); }}
                  className="border border-border bg-card hover:bg-muted text-foreground font-bold px-6 py-2.5 rounded-xl text-sm transition-all duration-200 cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Description & Features List */}
            <div className="space-y-8 text-left lg:pl-6">
              <h3 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
                Focus Tools Integrated Together
              </h3>
              <p className="text-base text-muted-foreground">
                Tackle daily tasks, build routines, and track goals while boosting efficiency with dedicated workspace modules.
              </p>

              <div className="space-y-4">
                {[
                  { title: "Smart Pomodoro", desc: "Start custom focus sessions directly linked to habits.", icon: Clock },
                  { title: "Weekly Insights & Stats", desc: "Gain in-depth insights into productivity curves.", icon: TrendingUp },
                  { title: "Goal Milestones", desc: "Set radial milestones and track progress over 90 days.", icon: Target }
                ].map((item, idx) => (
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

        {/* 5. Designed for Deep Work Section (Feature Gallery) */}
        <section id="features" ref={featuresRef} className="w-full max-w-7xl px-6 md:px-12 py-24 scroll-mt-24">
          <h2 className="text-3xl md:text-5xl font-black text-center mb-16 tracking-tight text-foreground">
            Designed for Deep Work
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Card 1: Eisenhower Matrix */}
            <div className="surface-card p-8 hover:-translate-y-1 hover:border-primary/30 transition-all duration-300 flex flex-col h-full relative overflow-hidden">
              <div className="text-[9px] font-extrabold tracking-wider text-primary bg-primary/10 w-fit px-3 py-1.5 rounded-lg uppercase mb-4 border border-primary/20">
                Prioritize
              </div>
              <h3 className="text-xl font-bold mb-3 text-left text-foreground">Eisenhower Matrix</h3>
              <p className="text-sm mb-8 flex-grow text-left text-muted-foreground">
                Sort tasks by urgency and importance in a sleek, distraction-free grid.
              </p>
              
              <div className="grid grid-cols-2 gap-2.5 mt-auto">
                <motion.div 
                  whileHover={{ scale: 1.03, y: -2 }}
                  className="aspect-square bg-destructive/10 border border-destructive/20 hover:border-destructive/50 rounded-xl flex flex-col items-center justify-center text-xs font-bold text-destructive p-2 cursor-pointer transition-all duration-200"
                >
                  <span>DO</span>
                  <span className="text-[9px] font-normal opacity-80 mt-1">Urgent &amp; Imp.</span>
                </motion.div>
                <motion.div 
                  whileHover={{ scale: 1.03, y: -2 }}
                  className="aspect-square bg-primary/10 border border-primary/20 hover:border-primary/50 rounded-xl flex flex-col items-center justify-center text-xs font-bold text-primary p-2 cursor-pointer transition-all duration-200"
                >
                  <span>DECIDE</span>
                  <span className="text-[9px] font-normal opacity-80 mt-1">Not Urg. &amp; Imp.</span>
                </motion.div>
                <motion.div 
                  whileHover={{ scale: 1.03, y: -2 }}
                  className="aspect-square bg-info/10 border border-info/20 hover:border-info/50 rounded-xl flex flex-col items-center justify-center text-xs font-bold text-info p-2 cursor-pointer transition-all duration-200"
                >
                  <span>DELEGATE</span>
                  <span className="text-[9px] font-normal opacity-80 mt-1">Urgent &amp; Not Imp.</span>
                </motion.div>
                <motion.div 
                  whileHover={{ scale: 1.03, y: -2 }}
                  className="aspect-square surface-subtle border rounded-xl flex flex-col items-center justify-center text-xs font-bold text-muted-foreground p-2 cursor-pointer transition-all duration-200"
                >
                  <span>DELETE</span>
                  <span className="text-[9px] font-normal opacity-75 mt-1">Not Urg. &amp; Not Imp.</span>
                </motion.div>
              </div>
            </div>

            {/* Card 2: 90-Day Focus Goals */}
            <div className="surface-card p-8 hover:-translate-y-1 hover:border-primary/30 transition-all duration-300 flex flex-col h-full relative overflow-hidden">
              <div className="text-[9px] font-extrabold tracking-wider text-info bg-info/10 w-fit px-3 py-1.5 rounded-lg uppercase mb-4 border border-info/20">
                Track
              </div>
              <h3 className="text-xl font-bold mb-3 text-left text-foreground">90-Day Focus Goals</h3>
              <p className="text-sm mb-8 flex-grow text-left text-muted-foreground">
                Visualize long-term progress with radial rings and interactive milestones.
              </p>
              
              <div className="flex justify-center mt-auto relative h-[160px] items-center">
                <svg className="transform -rotate-90" height="150" viewBox="0 0 160 160" width="150">
                  <circle cx="80" cy="80" fill="none" r="70" stroke="currentColor" strokeOpacity="0.08" strokeWidth="12" />
                  <circle cx="80" cy="80" fill="none" r="50" stroke="currentColor" strokeOpacity="0.08" strokeWidth="12" />
                  
                  <motion.circle 
                    cx="80" 
                    cy="80" 
                    fill="none" 
                    r="70" 
                    stroke="url(#radial-accent-outer)" 
                    strokeWidth="12" 
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 0.75 }}
                    viewport={{ once: false, margin: "-50px" }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />

                  <motion.circle 
                    cx="80" 
                    cy="80" 
                    fill="none" 
                    r="50" 
                    stroke="url(#radial-accent-inner)" 
                    strokeWidth="12" 
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 0.52 }}
                    viewport={{ once: false, margin: "-50px" }}
                    transition={{ duration: 1.5, delay: 0.15, ease: "easeOut" }}
                  />

                  <defs>
                    <linearGradient id="radial-accent-outer" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#14b8a6" />
                    </linearGradient>
                    <linearGradient id="radial-accent-inner" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0ea5e9" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>

                  <motion.circle
                    cx="150"
                    cy="80"
                    r="6"
                    className="fill-warning stroke-2 stroke-card cursor-pointer"
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    whileHover={{ scale: 1.4 }}
                    transition={{ delay: 1 }}
                    onMouseEnter={() => setHoveredMilestone("Day 30 Achieved: Seedling Evolved")}
                    onMouseLeave={() => setHoveredMilestone(null)}
                  />

                  <motion.circle
                    cx="80"
                    cy="150"
                    r="6"
                    className="fill-warning stroke-2 stroke-card cursor-pointer"
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    whileHover={{ scale: 1.4 }}
                    transition={{ delay: 1.2 }}
                    onMouseEnter={() => setHoveredMilestone("Day 60 Achieved: Flow Master Status")}
                    onMouseLeave={() => setHoveredMilestone(null)}
                  />
                </svg>

                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                  <span className="text-2xl font-black text-foreground font-mono tabular-nums">75%</span>
                </div>

                <AnimatePresence>
                  {hoveredMilestone && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-3.5 py-1.5 rounded-lg border border-border shadow-lg z-10 text-center whitespace-nowrap"
                    >
                      {hoveredMilestone}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Card 3: Discipline Radar */}
            <div className="surface-card p-8 hover:-translate-y-1 hover:border-primary/30 transition-all duration-300 flex flex-col h-full relative overflow-hidden">
              <div className="text-[9px] font-extrabold tracking-wider text-warning bg-warning/10 w-fit px-3 py-1.5 rounded-lg uppercase mb-4 border border-warning/20">
                Analyze
              </div>
              <h3 className="text-xl font-bold mb-3 text-left text-foreground">Discipline Radar</h3>
              <p className="text-sm mb-8 flex-grow text-left text-muted-foreground">
                Identify strengths and weak categories across different habit streams instantly.
              </p>
              
              <div className="flex justify-center mt-auto h-[160px] items-center">
                <svg className="group-hover:scale-105 transition-transform duration-500" height="150" viewBox="0 0 160 160" width="150">
                  <polygon fill="none" points="80,10 140.6,45 140.6,115 80,150 19.4,115 19.4,45" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
                  <polygon fill="none" points="80,33.3 120.4,56.6 120.4,103.3 80,126.6 39.6,103.3 39.6,56.6" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
                  <line stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" x1="80" x2="80" y1="80" y2="10" />
                  <line stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" x1="80" x2="140.6" y1="80" y2="45" />
                  
                  <motion.polygon 
                    fill={isDark ? "rgba(16, 185, 129, 0.22)" : "rgba(16, 185, 129, 0.14)"}
                    stroke="#10b981"
                    strokeWidth="2"
                    points="80,30 110,60 130,100 80,130 40,90 50,50"
                    animate={{ 
                      points: [
                        "80,30 110,60 130,100 80,130 40,90 50,50",
                        "80,26 114,56 126,104 80,134 36,92 46,46",
                        "80,30 110,60 130,100 80,130 40,90 50,50"
                      ]
                    }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 4.8, 
                      ease: "easeInOut" 
                    }}
                  />
                </svg>
              </div>
            </div>

          </div>
        </section>

        {/* 6. Immersive CTA Box */}
        <section className="w-full max-w-5xl px-6 md:px-12 py-24">
          <div className="surface-hero rounded-3xl p-10 md:p-16 text-center relative overflow-hidden shadow-xl">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            
            <h2 className="text-3xl md:text-5xl font-black mb-6 relative z-10 leading-tight tracking-tight text-foreground">
              Start building your sanctuary.
            </h2>
            <p className="text-base max-w-2xl mx-auto mb-10 relative z-10 text-muted-foreground">
              Seamlessly synced across your devices with local IndexedDB offline storage and secure Supabase database. No friction, just focus.
            </p>
            
            <Link href="/login?mode=signup">
              <motion.button 
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-10 py-5 rounded-xl font-bold text-lg relative z-10 cursor-pointer shadow-sm transition-colors"
              >
                Claim Your Free Workspace
              </motion.button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border bg-card/60 text-muted-foreground flex flex-col md:flex-row justify-between items-center px-6 md:px-12 py-12 z-10 relative transition-colors duration-300">
        <div className="flex items-center gap-2 mb-6 md:mb-0">
          <div className="h-6 w-6 rounded bg-primary/15 border border-primary/30 flex items-center justify-center">
            <svg viewBox="0 0 32 32" className="h-4.5 w-4.5" fill="none">
              <path d="M 16 4 A 12 12 0 1 1 15.99 4" stroke="#10b981" strokeWidth="3" />
            </svg>
          </div>
          <span className="font-black text-lg text-foreground">Habit<span className="text-primary">Flow</span></span>
        </div>

        <div className="flex gap-6 mb-6 md:mb-0 text-sm">
          <a className="hover:text-primary transition-colors" href="#">Privacy Policy</a>
          <a className="hover:text-primary transition-colors" href="#">Terms of Service</a>
          <a className="hover:text-primary transition-colors" href="#">Support</a>
        </div>
        <div className="text-xs">© 2026 HabitFlow. All rights reserved.</div>
      </footer>
    </div>
  );
}
