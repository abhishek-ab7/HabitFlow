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
import { Plus_Jakarta_Sans } from 'next/font/google';
import { useTheme } from '@/providers/theme-provider';
import confetti from 'canvas-confetti';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
});

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

  // Global Page Scroll Hooks for Parallax Backgrounds
  const { scrollYProgress } = useScroll({
    target: pageRef,
    offset: ["start start", "end end"]
  });

  const scrollSpring = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  // Transforms for background parallax glowing blobs
  const blob1Y = useTransform(scrollSpring, [0, 1], [0, 300]);
  const blob2Y = useTransform(scrollSpring, [0, 1], [0, -400]);
  const blob3Y = useTransform(scrollSpring, [0, 1], [0, 200]);

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
      className={`landing-root ${plusJakartaSans.className} min-h-screen relative overflow-x-hidden flex flex-col font-sans transition-colors duration-500 ${
        isDark ? 'text-[#ebdfe9] bg-[#09050d]' : 'text-slate-800 bg-[#f9f7fd]'
      }`}
    >
      
      {/* Premium Glassmorphic & Liquid Mesh System */}
      <style jsx global>{`
        .landing-root {
          background-color: ${isDark ? '#09050d' : '#f9f7fd'};
          background-image: 
            linear-gradient(${isDark ? 'rgba(168, 85, 247, 0.015)' : 'rgba(147, 51, 234, 0.02)'} 1px, transparent 1px),
            linear-gradient(90deg, ${isDark ? 'rgba(168, 85, 247, 0.015)' : 'rgba(147, 51, 234, 0.02)'} 1px, transparent 1px);
          background-size: 50px 50px;
          background-attachment: fixed;
        }

        .liquid-blur-1 {
          background: radial-gradient(circle, ${isDark ? 'rgba(168, 85, 247, 0.16)' : 'rgba(251, 146, 60, 0.12)'} 0%, transparent 70%);
        }

        .liquid-blur-2 {
          background: radial-gradient(circle, ${isDark ? 'rgba(79, 70, 229, 0.14)' : 'rgba(244, 63, 94, 0.1)'} 0%, transparent 75%);
        }

        .liquid-blur-3 {
          background: radial-gradient(circle, ${isDark ? 'rgba(236, 72, 153, 0.12)' : 'rgba(99, 102, 241, 0.08)'} 0%, transparent 60%);
        }

        .glass-panel-acrylic {
          background: ${isDark ? 'rgba(20, 14, 28, 0.45)' : 'rgba(255, 255, 255, 0.75)'};
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(147, 51, 234, 0.08)'};
          box-shadow: 0 10px 40px -10px ${isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(147, 51, 234, 0.05)'};
        }

        .glass-panel-acrylic-heavy {
          background: ${isDark ? 'rgba(22, 16, 32, 0.7)' : 'rgba(255, 255, 255, 0.9)'};
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(147, 51, 234, 0.12)'};
        }

        .text-neon-gradient {
          background: linear-gradient(135deg, ${isDark ? '#f4d5ff' : '#6b21a8'}, ${isDark ? '#a855f7' : '#ec4899'}, ${isDark ? '#818cf8' : '#3b82f6'});
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

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

      {/* Floating Animated Liquid Background Blobs */}
      <motion.div style={{ y: blob1Y }} className="absolute top-[10%] right-[-10%] w-[500px] h-[500px] liquid-blur-1 pointer-events-none -z-10" />
      <motion.div style={{ y: blob2Y }} className="absolute top-[40%] left-[-15%] w-[600px] h-[600px] liquid-blur-2 pointer-events-none -z-10" />
      <motion.div style={{ y: blob3Y }} className="absolute bottom-[10%] right-[-5%] w-[450px] h-[450px] liquid-blur-3 pointer-events-none -z-10" />

      {/* Premium Navigation Header */}
      <header className="fixed top-0 w-full glass-panel-acrylic border-b z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-6 md:px-12 py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 shadow-md">
              <svg viewBox="0 0 32 32" className="h-6 w-6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 16 4 A 12 12 0 1 1 15.99 4" stroke="url(#header-logo-grad)" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M 12 16.5 L 15 19.5 L 21 12.5" stroke="url(#header-logo-grad-2)" strokeWidth="3.5" strokeLinecap="round" />
                <defs>
                  <linearGradient id="header-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                  <linearGradient id="header-logo-grad-2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className={`text-xl md:text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              HabitFlow
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#showcase" className={`text-sm font-semibold transition-colors duration-200 ${isDark ? 'text-[#d1c2d2] hover:text-white' : 'text-slate-600 hover:text-purple-600'}`}>Showcase</a>
            <a href="#simulator" className={`text-sm font-semibold transition-colors duration-200 ${isDark ? 'text-[#d1c2d2] hover:text-white' : 'text-slate-600 hover:text-purple-600'}`}>Simulator</a>
            <a href="#focus-hub" className={`text-sm font-semibold transition-colors duration-200 ${isDark ? 'text-[#d1c2d2] hover:text-white' : 'text-slate-600 hover:text-purple-600'}`}>Focus Hub</a>
            <a href="#features" className={`text-sm font-semibold transition-colors duration-200 ${isDark ? 'text-[#d1c2d2] hover:text-white' : 'text-slate-600 hover:text-purple-600'}`}>Deep Work</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`p-2.5 rounded-xl border transition-all duration-300 ${
                isDark 
                  ? 'border-white/10 hover:bg-white/5 text-amber-400 hover:text-amber-300' 
                  : 'border-slate-200 hover:bg-slate-100 text-indigo-600 hover:text-indigo-800'
              }`}
              title="Toggle theme"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <Link href="/login">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-lg hover:shadow-purple-500/25 transition-all px-6 py-2.5 rounded-xl text-white font-bold text-sm cursor-pointer"
              >
                Sign In
              </motion.button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow pt-24 flex flex-col items-center">
        
        {/* 1. Hero Zone (Extreme Asymmetric & Depth Layers) */}
        <section className="w-full max-w-7xl px-6 md:px-12 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative min-h-[80vh]">
          
          {/* Hero Left Content Area */}
          <div className="lg:col-span-7 flex flex-col text-center lg:text-left items-center lg:items-start z-10">
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase mb-6 shadow-sm ${
                isDark ? 'bg-purple-950/40 text-purple-300 border border-purple-800/30' : 'bg-purple-100/80 text-purple-800 border border-purple-200'
              }`}
            >
              <Sparkles className="h-4.5 w-4.5 text-purple-500 animate-pulse" />
              Revolutionize Your Routine
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className={`text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              Master habits.<br />
              Find your <span className="text-neon-gradient">Flow.</span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className={`text-lg md:text-xl mb-10 max-w-xl ${isDark ? 'text-[#c6b4c8]' : 'text-slate-600'}`}
            >
              Build consistency, conquer focus goals, and level up your life with a beautifully synced, gamified habit tracker.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex flex-wrap gap-4 justify-center lg:justify-start w-full"
            >
              <Link href="/login?mode=signup">
                <motion.button 
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-xl hover:shadow-purple-500/25 px-8 py-4 rounded-2xl text-white font-bold text-base cursor-pointer shadow-lg transition-shadow duration-300"
                >
                  Get Started for Free
                </motion.button>
              </Link>
              <a href="#showcase">
                <motion.button 
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  className={`bg-transparent border transition-all duration-300 px-8 py-4 rounded-2xl font-bold text-base flex items-center gap-2 cursor-pointer ${
                    isDark 
                      ? 'border-purple-500/30 text-purple-300 hover:bg-purple-500/10' 
                      : 'border-purple-600/30 text-purple-700 hover:bg-purple-50'
                  }`}
                >
                  <Play className="h-5 w-5 fill-current" />
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
              className={`glass-panel-acrylic-heavy rounded-[2rem] p-8 w-full max-w-sm shadow-xl absolute z-20 hover:scale-[1.03] transition-transform duration-300 ${
                isDark ? 'shadow-purple-950/20' : 'shadow-purple-100'
              }`}
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-orange-500/10 rounded-lg">
                    <Flame className="h-5 w-5 text-orange-500" />
                  </div>
                  <h3 className={`text-base font-bold ${isDark ? 'text-purple-100' : 'text-slate-900'}`}>Active Streak</h3>
                </div>
                <span className={`text-[10px] font-extrabold tracking-wider px-3 py-1 rounded-full uppercase border ${
                  isDark ? 'bg-purple-950/40 text-purple-300 border-purple-800/30' : 'bg-purple-50 text-purple-700 border-purple-100'
                }`}>DAY 12</span>
              </div>
              
              <div className={`text-5xl font-black mb-4 tracking-tight flex items-baseline ${isDark ? 'text-white' : 'text-slate-900'}`}>
                12<span className={`text-sm font-semibold ml-1.5 ${isDark ? 'text-[#c6b4c8]' : 'text-slate-500'}`}>days in a row</span>
              </div>

              <div className="text-xs font-semibold mb-3 flex justify-between items-center text-slate-400">
                <span>Weekly Consistency</span>
                <span className="text-purple-500 font-bold">4 / 7 days completed</span>
              </div>

              <div className="flex justify-between gap-2.5 mt-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-2.5 flex-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" />
                ))}
                {[5, 6, 7].map((i) => (
                  <div key={i} className={`h-2.5 flex-1 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                ))}
              </div>
            </motion.div>

            {/* Decorative calendar bubble peeking from behind */}
            <motion.div
              initial={{ opacity: 0, x: 40, y: -40, rotate: 6 }}
              animate={{ opacity: 0.85, x: 20, y: -80, rotate: 8 }}
              transition={{ duration: 1, delay: 0.4 }}
              className={`glass-panel-acrylic rounded-2xl p-4 w-48 shadow-lg absolute z-10 hidden sm:block ${
                isDark ? 'border-white/5 bg-slate-950/30' : 'border-slate-100 bg-white/70'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4.5 w-4.5 text-purple-500" />
                <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Habit Grid</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: 15 }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`aspect-square rounded ${
                      i % 3 === 0 
                        ? 'bg-gradient-to-br from-purple-500 to-indigo-500 shadow-sm shadow-purple-500/20' 
                        : (isDark ? 'bg-slate-800' : 'bg-slate-200')
                    }`} 
                  />
                ))}
              </div>
            </motion.div>

            {/* Mini Stat tag under the streak card */}
            <motion.div
              initial={{ opacity: 0, x: -60, y: 50, rotate: -8 }}
              animate={{ opacity: 0.9, x: -50, y: 80, rotate: -6 }}
              transition={{ duration: 1, delay: 0.5 }}
              className={`glass-panel-acrylic rounded-2xl p-4 w-48 shadow-lg absolute z-10 hidden sm:block ${
                isDark ? 'border-white/5 bg-slate-950/30' : 'border-slate-100 bg-white/70'
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Award className="h-4.5 w-4.5 text-amber-500" />
                  <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Level 12</span>
                </div>
                <span className="text-[10px] text-amber-400 font-extrabold">+230 XP</span>
              </div>
              <div className={`w-full h-1.5 rounded-full overflow-hidden mt-2 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                <div className="w-[70%] h-full bg-amber-400 rounded-full" />
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
            className={`px-6 py-3 rounded-full text-xs font-black tracking-widest uppercase flex items-center gap-2.5 border transition-all duration-300 shadow-lg cursor-pointer ${
              isDemoActive 
                ? 'bg-purple-600 border-purple-500 text-white shadow-purple-500/25' 
                : 'bg-white/10 border-white/10 text-slate-400 hover:bg-white/20 hover:text-white dark:bg-slate-900/60 dark:hover:bg-slate-900'
            }`}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isDemoActive ? 'bg-green-400' : 'bg-slate-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isDemoActive ? 'bg-green-500' : 'bg-slate-500'}`}></span>
            </span>
            {isDemoActive ? 'Auto-Play Active (Interact to Pause)' : '▶ Resume Live Demo Loop'}
          </button>
        </div>

        {/* 2. Interactive 3D Mockup Section (App Dashboard Showcase) */}
        <section id="showcase" ref={mockupRef} className="w-full max-w-7xl px-6 md:px-12 py-16 scroll-mt-24 perspective-container relative">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className={`text-3xl md:text-5xl font-black mb-4 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              The Unified Flow Workspace
            </h2>
            <p className={`text-base ${isDark ? 'text-[#c6b4c8]' : 'text-slate-600'}`}>
              Seamlessly integrates habits, tasks, stats, and a focus timer in one unified, aesthetic, and responsive workspace.
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
            className={`glass-panel-acrylic-heavy rounded-[2.5rem] shadow-2xl p-6 md:p-8 flex flex-col lg:flex-row gap-6 relative border overflow-hidden min-h-[500px] ${
              isDark ? 'border-white/10 shadow-purple-950/20' : 'border-purple-200/50 shadow-slate-200'
            }`}
          >
            {/* Mock Sidebar (Left) */}
            <div className={`w-full lg:w-56 shrink-0 flex lg:flex-col gap-4 justify-between lg:justify-start p-4 rounded-2xl border ${
              isDark ? 'bg-purple-950/20 border-white/5' : 'bg-slate-50 border-slate-100'
            }`}>
              <div className="flex items-center gap-2.5 pb-0 lg:pb-6 border-b border-transparent lg:border-border/30">
                <div className="h-7 w-7 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
                  <svg viewBox="0 0 32 32" className="h-4.5 w-4.5" fill="none">
                    <path d="M 16 4 A 12 12 0 1 1 15.99 4" stroke="#a855f7" strokeWidth="4" />
                  </svg>
                </div>
                <span className={`font-black text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>HabitFlow</span>
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
                        ? 'bg-purple-600 text-white shadow-sm' 
                        : (isDark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-purple-600 hover:bg-purple-50')
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>

              <div className="flex lg:mt-auto items-center gap-3 p-1 rounded-xl">
                <div className="h-8.5 w-8.5 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white text-xs font-black shadow-sm">
                  JD
                </div>
                <div className="hidden lg:block text-left">
                  <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>John Doe</p>
                  <p className="text-[10px] text-slate-400">Level 12 Sapling</p>
                </div>
              </div>
            </div>

            {/* Mock Dashboard Grid Workspace (Middle/Right) */}
            <div className="flex-grow grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              
              {/* Main Content Area: Habits Loop + Tasks List */}
              <div className="md:col-span-8 flex flex-col gap-6">
                
                {/* Mock Habits Widget */}
                <div className={`p-5 rounded-2xl border flex flex-col gap-4 ${
                  isDark ? 'bg-slate-950/20 border-white/5' : 'bg-white border-slate-100 shadow-sm'
                }`}>
                  <div className="flex justify-between items-center">
                    <div className="text-left">
                      <h4 className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Interactive Habits Loop</h4>
                      <p className="text-[11px] text-slate-400">Click a habit to simulate checking it off</p>
                    </div>
                    <span className="text-[10px] bg-purple-500/10 text-purple-400 font-bold px-2 py-0.5 rounded-full border border-purple-500/20">Daily Loop</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {mockHabits.map((habit) => (
                      <div
                        key={habit.id}
                        onClick={(e) => handleToggleMockHabit(e, habit.id)}
                        className={`p-3.5 rounded-xl border flex flex-col justify-between items-start gap-3 cursor-pointer transition-all duration-300 relative overflow-hidden ${
                          habit.done 
                            ? 'bg-purple-500/10 border-purple-500/40 shadow-sm opacity-80' 
                            : `border-transparent ${isDark ? 'bg-white/[0.02] hover:bg-white/[0.04] hover:border-purple-500/30' : 'bg-slate-100/50 hover:bg-slate-100 hover:border-purple-500/30'}`
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg ${habit.color} shrink-0`}>
                          <Sparkle className="h-4.5 w-4.5" />
                        </div>
                        <div className="text-left">
                          <p className={`text-xs font-bold leading-tight ${
                            habit.done ? (isDark ? 'text-purple-300' : 'text-purple-900') : (isDark ? 'text-slate-200' : 'text-slate-700')
                          }`}>{habit.name}</p>
                          <p className="text-[9px] text-slate-400 mt-1">{habit.done ? 'Completed! +20XP' : 'Pending completion'}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center absolute top-3 right-3 transition-colors ${
                          habit.done ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-500 text-transparent'
                        }`}>
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mock Routine Tasks Widget */}
                <div className={`p-5 rounded-2xl border flex flex-col gap-4 ${
                  isDark ? 'bg-slate-950/20 border-white/5' : 'bg-white border-slate-100 shadow-sm'
                }`}>
                  <div className="flex justify-between items-center text-left">
                    <div>
                      <h4 className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Routines Checklist</h4>
                      <p className="text-[11px] text-slate-400">Complete items below to build routine multipliers</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {mockRoutines.map((routine) => (
                      <div
                        key={routine.id}
                        onClick={(e) => handleToggleMockRoutine(e, routine.id)}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all duration-300 ${
                          routine.done 
                            ? 'bg-indigo-500/10 border-indigo-500/40 line-through opacity-70' 
                            : `border-transparent ${isDark ? 'bg-white/[0.01] hover:border-indigo-500/30' : 'bg-slate-100/40 hover:border-indigo-500/30'}`
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <ListTodo className={`h-4.5 w-4.5 ${routine.done ? 'text-slate-500' : 'text-indigo-500'}`} />
                          <span className={`text-xs font-semibold ${
                            routine.done ? (isDark ? 'text-slate-500' : 'text-slate-400') : (isDark ? 'text-slate-200' : 'text-slate-700')
                          }`}>{routine.name}</span>
                        </div>
                        <div className={`w-5.5 h-5.5 rounded-full border-2 flex items-center justify-center transition-all ${
                          routine.done ? 'bg-indigo-500 border-indigo-500 text-white' : (isDark ? 'border-slate-700' : 'border-slate-300')
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
                <div className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 h-full ${
                  isDark ? 'bg-slate-950/20 border-white/5' : 'bg-white border-slate-100 shadow-sm'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className={`text-xs font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Productivity Curve</span>
                    
                    {/* Inline Tab Toggle */}
                    <div className="flex bg-slate-100 dark:bg-slate-900/60 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <button 
                        onClick={() => { handleManualInteraction(); setMockGraphRange('week'); }}
                        className={`text-[9px] font-bold px-2 py-1 rounded-md transition-colors cursor-pointer ${
                          mockGraphRange === 'week' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >Wk</button>
                      <button 
                        onClick={() => { handleManualInteraction(); setMockGraphRange('month'); }}
                        className={`text-[9px] font-bold px-2 py-1 rounded-md transition-colors cursor-pointer ${
                          mockGraphRange === 'month' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >Mo</button>
                    </div>
                  </div>

                  {/* SVG productivity graph with animatable drawing line */}
                  <div className="h-28 flex items-end justify-center relative mt-2">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40">
                      <line x1="0" y1="10" x2="100" y2="10" stroke={isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"} strokeWidth="0.5" />
                      <line x1="0" y1="20" x2="100" y2="20" stroke={isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"} strokeWidth="0.5" />
                      <line x1="0" y1="30" x2="100" y2="30" stroke={isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"} strokeWidth="0.5" />
                      
                      <motion.path 
                        key={mockGraphRange}
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 0.15 }}
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
                          <stop offset="0%" stopColor="#a855f7" />
                          <stop offset="100%" stopColor="transparent" />
                        </linearGradient>
                        <linearGradient id="mock-line-grad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#a855f7" />
                          <stop offset="50%" stopColor="#6366f1" />
                          <stop offset="100%" stopColor="#ec4899" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>Average focus efficiency</span>
                    <span className="text-purple-400 font-bold">89.2%</span>
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
                  className="absolute text-[11px] font-extrabold text-purple-400 pointer-events-none drop-shadow-md z-30"
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
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase mb-3 ${
              isDark ? 'bg-purple-950/40 text-purple-300' : 'bg-purple-100 text-purple-800'
            }`}>
              Interactive Simulator
            </div>
            <h2 className={`text-3xl md:text-5xl font-black mb-4 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Grow Your Companion
            </h2>
            <p className={`text-base ${isDark ? 'text-[#c6b4c8]' : 'text-slate-600'}`}>
              Check off tasks, complete habits, and watch your companion evolve with real-time stats and level up notifications.
            </p>
          </div>

          <div className="glass-panel-acrylic-heavy rounded-[2.5rem] p-6 md:p-8 flex flex-col md:flex-row gap-8 items-stretch relative shadow-2xl">
            
            {/* Companion Widget Column (Left) */}
            <div 
              id="companion-widget-box"
              className={`w-full md:w-1/3 flex flex-col items-center p-6 rounded-[1.75rem] border justify-between relative overflow-hidden ${
                isDark ? 'bg-purple-950/10 border-white/5' : 'bg-white border-slate-100 shadow-md'
              }`}
            >
              <div className="w-full text-center">
                <span className={`text-[9px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-lg ${
                  isDark ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20' : 'bg-purple-100 text-purple-700'
                }`}>
                  Interactive Widget
                </span>
              </div>

              {/* Dialogue Box */}
              <div className={`mt-4 px-3 py-2 rounded-xl text-[11px] font-semibold text-center leading-normal border shadow-sm relative min-h-[3.5rem] flex items-center justify-center w-full ${
                isDark ? 'bg-slate-950/40 border-white/10 text-purple-200' : 'bg-purple-50 border-purple-100 text-purple-900'
              }`}>
                {companionDialogue}
                <div className={`absolute bottom-[-6px] left-1/2 transform -translate-x-1/2 w-3.5 h-3.5 rotate-45 border-r border-b ${
                  isDark ? 'bg-slate-900 border-white/10' : 'bg-purple-50 border-purple-100'
                }`} />
              </div>

              {/* Companion representation with custom spring scale */}
              <div className="relative w-36 h-36 flex items-center justify-center my-4">
                <div className="absolute inset-0 bg-purple-500/10 rounded-full blur-[24px] animate-pulse" />
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
                <h3 className={`text-base font-black mb-0.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>Companion Stage</h3>
                <p className="text-[10px] font-extrabold tracking-widest text-purple-500 uppercase">
                  {level === 1 ? 'LEVEL 1: SEEDLING' : level === 2 ? 'LEVEL 2: SAPLING' : 'LEVEL 3: FLOW TREE'}
                </p>
              </div>

              {/* Progress HUD bar */}
              <div className="w-full mt-6">
                <div className="flex justify-between text-[10px] font-bold tracking-wider mb-2">
                  <span className="text-purple-500">XP PROGRESS</span>
                  <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{xp} / 100</span>
                </div>
                <div className={`w-full h-3.5 rounded-full overflow-hidden p-0.5 ${isDark ? 'bg-slate-900 border border-white/5' : 'bg-slate-100'}`}>
                  <motion.div 
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full" 
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
                    className="absolute text-xs font-black text-amber-400 pointer-events-none drop-shadow-md z-30"
                  >
                    {f.text}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Dashboard Content Container (Right Column) */}
            <div className="w-full md:w-2/3 flex flex-col gap-4 relative" id="simulator-content-box">
              
              {/* Tab Selector */}
              <div className={`flex gap-1.5 p-1 rounded-xl border ${
                isDark ? 'bg-slate-950/40 border-white/5' : 'bg-slate-100 border-slate-200'
              }`}>
                <button 
                  onClick={() => { handleManualInteraction(); setActiveTab('habits'); }} 
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer ${
                    activeTab === 'habits' 
                      ? 'bg-purple-600 text-white shadow-md' 
                      : `${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`
                  }`}
                >
                  Habits Loop
                </button>
                <button 
                  onClick={() => { handleManualInteraction(); setActiveTab('tasks'); }} 
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer ${
                    activeTab === 'tasks' 
                      ? 'bg-purple-600 text-white shadow-md' 
                      : `${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`
                  }`}
                >
                  Tasks Matrix
                </button>
                <button 
                  onClick={() => { handleManualInteraction(); setActiveTab('milestones'); }} 
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer ${
                    activeTab === 'milestones' 
                      ? 'bg-purple-600 text-white shadow-md' 
                      : `${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`
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
                          className={`p-4 rounded-xl flex items-center justify-between cursor-pointer transition-all duration-300 border ${
                            isCompleted 
                              ? 'bg-purple-500/10 border-purple-500/40 opacity-75 shadow-sm' 
                              : `border-transparent ${isDark ? 'bg-white/[0.02] hover:border-purple-500/30' : 'bg-slate-900/[0.02] hover:border-purple-500/30'}`
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl border ${
                              isDark ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'
                            }`}>
                              {habit.icon}
                            </div>
                            <div className="text-left">
                              <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>{habit.name}</h4>
                              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{habit.desc}</p>
                            </div>
                          </div>
                          
                          <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                            isCompleted 
                              ? 'bg-purple-600 border-purple-600 text-white' 
                              : `text-transparent ${isDark ? 'border-slate-700' : 'border-slate-300'}`
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
                          className={`p-4 rounded-xl flex items-center justify-between cursor-pointer transition-all duration-300 border ${
                            isCompleted 
                              ? 'bg-indigo-500/10 border-indigo-500/40 opacity-75 line-through' 
                              : `border-transparent ${isDark ? 'bg-white/[0.02] hover:border-indigo-500/30' : 'bg-slate-900/[0.02] hover:border-indigo-500/30'}`
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${
                              isDark ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'
                            }`}>
                              <ListTodo className="h-5 w-5 text-indigo-500" />
                            </div>
                            <div className="text-left">
                              <h4 className={`font-bold text-sm ${
                                isCompleted 
                                  ? (isDark ? 'text-slate-500' : 'text-slate-400') 
                                  : (isDark ? 'text-white' : 'text-slate-800')
                              }`}>{task.name}</h4>
                              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{task.desc}</p>
                            </div>
                          </div>
                          
                          <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                            isCompleted 
                              ? 'bg-indigo-500 border-indigo-500 text-white' 
                              : `text-transparent ${isDark ? 'border-slate-700' : 'border-slate-300'}`
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
                        ? 'bg-purple-500/10 border-purple-500/30' 
                        : `opacity-60 border-transparent ${isDark ? 'bg-white/[0.02]' : 'bg-slate-900/[0.02]'}`
                    }`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl border ${
                          Object.keys(completedHabits).length > 0 || Object.keys(completedTasks).length > 0
                            ? 'bg-purple-500/20 border-purple-500/40 text-purple-400' 
                            : 'bg-slate-800/40 border-slate-700 text-slate-500'
                        }`}>
                          <Award className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>First Step</h4>
                          <p className="text-xs text-purple-400">Complete any habit or task</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold uppercase">{
                        Object.keys(completedHabits).length > 0 || Object.keys(completedTasks).length > 0 ? 'Unlocked 🔓' : 'Locked 🔒'
                      }</span>
                    </div>

                    {/* Badge 2 */}
                    <div className={`p-4 rounded-xl flex items-center justify-between border ${
                      level >= 2
                        ? 'bg-amber-500/10 border-amber-500/30' 
                        : `opacity-60 border-transparent ${isDark ? 'bg-white/[0.02]' : 'bg-slate-900/[0.02]'}`
                    }`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl border ${
                          level >= 2
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' 
                            : 'bg-slate-800/40 border-slate-700 text-slate-500'
                        }`}>
                          <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>Evolution</h4>
                          <p className="text-xs text-amber-400">Evolve companion to Level 2</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold uppercase">{level >= 2 ? 'Unlocked 🔓' : 'Locked 🔒'}</span>
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
                    className="absolute text-sm font-extrabold text-amber-400 pointer-events-none drop-shadow-md z-30"
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
                  className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/80 rounded-[2.5rem] backdrop-blur-md pointer-events-none"
                >
                  <div className="text-center p-6">
                    <motion.div
                      animate={{ y: [0, -12, 0] }}
                      transition={{ repeat: Infinity, duration: 1.8 }}
                    >
                      <h2 className="text-4xl md:text-5xl font-black text-neon-gradient flex items-center gap-2 justify-center drop-shadow-lg">
                        <Sparkles className="h-8 w-8 text-amber-400 animate-spin-slow" />
                        LEVEL UP!
                        <Sparkles className="h-8 w-8 text-amber-400 animate-spin-slow" />
                      </h2>
                    </motion.div>
                    <p className="text-white text-lg font-bold mt-4 drop-shadow-md">Your companion evolved to Level {level}!</p>
                    <div className="mt-6 inline-flex bg-white/10 px-4 py-1.5 rounded-full text-xs font-semibold text-purple-200">
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
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase mb-3 ${
              isDark ? 'bg-purple-950/40 text-purple-300' : 'bg-purple-100 text-purple-800'
            }`}>
              Premium Feature Preview
            </div>
            <h2 className={`text-3xl md:text-5xl font-black mb-4 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Deep Work Focus Hub
            </h2>
            <p className={`text-base ${isDark ? 'text-[#c6b4c8]' : 'text-slate-600'}`}>
              Access integrated focus tools inside the app. Try the Pomodoro Focus module below, synced to scroll kinetics.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Interactive Pomodoro Preview */}
            <div className={`glass-panel-acrylic-heavy rounded-[2.25rem] p-8 flex flex-col items-center justify-center relative border transition-all duration-300 shadow-xl ${
              isDark ? 'border-white/5' : 'bg-white border-slate-100'
            }`}>
              <h3 className={`text-lg font-bold mb-8 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <Clock className="h-5 w-5 text-purple-500 animate-pulse" />
                Pomodoro Focus Timer
              </h3>

              <div className="relative w-44 h-44 flex items-center justify-center mb-8">
                <svg className="absolute transform -rotate-90" width="100%" height="100%" viewBox="0 0 100 100">
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="44" 
                    fill="none" 
                    stroke={isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(147, 51, 234, 0.05)"} 
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
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                </svg>

                <div className="flex flex-col items-center justify-center z-10">
                  <span className={`text-3xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {formatTime(pomodoroSeconds)}
                  </span>
                  <span className="text-[9px] font-extrabold text-purple-500 uppercase tracking-wider mt-1">Focus Session</span>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={handleToggleTimer}
                  className="bg-purple-600 hover:bg-purple-750 active:scale-95 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all duration-300 shadow-md shadow-purple-500/10 cursor-pointer"
                >
                  {isTimerRunning ? 'Pause Session' : 'Start Focus'}
                </button>
                <button 
                  onClick={() => { setIsTimerRunning(false); setPomodoroSeconds(1500); }}
                  className={`border font-bold px-6 py-2.5 rounded-xl text-sm transition-all duration-300 cursor-pointer ${
                    isDark ? 'border-white/10 hover:bg-white/5 text-slate-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Description & Features List */}
            <div className="space-y-8 text-left lg:pl-6">
              <h3 className={`text-2xl md:text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Focus Tools Integrated Together
              </h3>
              <p className={`text-base ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Tackle daily tasks, build routines, and track goals while boosting efficiency with dedicated workspace modules.
              </p>

              <div className="space-y-4">
                {[
                  { title: "Smart Pomodoro", desc: "Start custom focus sessions directly linked to habits.", icon: Clock },
                  { title: "Weekly Insights & Stats", desc: "Gain in-depth insights into productivity curves.", icon: TrendingUp },
                  { title: "Goal Milestones", desc: "Set radial milestones and track progress over 90 days.", icon: Target }
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                      <item.icon className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>{item.title}</h4>
                      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 5. Designed for Deep Work Section (Feature Gallery) */}
        <section id="features" ref={featuresRef} className="w-full max-w-7xl px-6 md:px-12 py-24 scroll-mt-24">
          <h2 className={`text-3xl md:text-5xl font-black text-center mb-16 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Designed for Deep Work
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Card 1: Eisenhower Matrix */}
            <div className={`glass-panel-acrylic p-8 rounded-[2rem] hover:-translate-y-1.5 transition-all duration-500 flex flex-col h-full relative overflow-hidden border shadow-sm ${
              isDark ? 'hover:border-purple-500/20 shadow-purple-950/5' : 'bg-white hover:border-purple-500/30'
            }`}>
              <div className="text-[9px] font-extrabold tracking-wider text-purple-500 bg-purple-500/10 w-fit px-3 py-1.5 rounded-lg uppercase mb-4 border border-purple-500/20">
                Prioritize
              </div>
              <h3 className={`text-xl font-bold mb-3 text-left ${isDark ? 'text-white' : 'text-slate-900'}`}>Eisenhower Matrix</h3>
              <p className={`text-sm mb-8 flex-grow text-left ${isDark ? 'text-[#c6b4c8]' : 'text-slate-600'}`}>
                Sort tasks by urgency and importance in a sleek, distraction-free grid.
              </p>
              
              <div className="grid grid-cols-2 gap-2.5 mt-auto">
                <motion.div 
                  whileHover={{ scale: 1.04, y: -2 }}
                  className="aspect-square bg-red-500/10 border border-red-500/20 hover:border-red-500/50 rounded-xl flex flex-col items-center justify-center text-xs font-bold text-red-400 p-2 cursor-pointer transition-all duration-300 hover:shadow-lg"
                >
                  <span>DO</span>
                  <span className="text-[9px] font-normal text-red-400/80 mt-1">Urgent & Imp.</span>
                </motion.div>
                <motion.div 
                  whileHover={{ scale: 1.04, y: -2 }}
                  className="aspect-square bg-purple-500/10 border border-purple-500/20 hover:border-purple-500/50 rounded-xl flex flex-col items-center justify-center text-xs font-bold text-[#edb1ff] p-2 cursor-pointer transition-all duration-300 hover:shadow-lg"
                >
                  <span>DECIDE</span>
                  <span className="text-[9px] font-normal text-[#edb1ff]/80 mt-1">Not Urg. & Imp.</span>
                </motion.div>
                <motion.div 
                  whileHover={{ scale: 1.04, y: -2 }}
                  className="aspect-square bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/50 rounded-xl flex flex-col items-center justify-center text-xs font-bold text-blue-400 p-2 cursor-pointer transition-all duration-300 hover:shadow-lg"
                >
                  <span>DELEGATE</span>
                  <span className="text-[9px] font-normal text-blue-400/80 mt-1">Urgent & Not Imp.</span>
                </motion.div>
                <motion.div 
                  whileHover={{ scale: 1.04, y: -2 }}
                  className={`aspect-square border rounded-xl flex flex-col items-center justify-center text-xs font-bold p-2 cursor-pointer transition-all duration-300 ${
                    isDark 
                      ? 'bg-white/5 border-white/10 hover:border-white/30 text-slate-300 hover:shadow-md' 
                      : 'bg-slate-100 border-slate-200 hover:border-slate-450 text-slate-600 hover:shadow-md'
                  }`}
                >
                  <span>DELETE</span>
                  <span className="text-[9px] font-normal text-slate-500 mt-1">Not Urg. & Not Imp.</span>
                </motion.div>
              </div>
            </div>

            {/* Card 2: 90-Day Focus Goals */}
            <div className={`glass-panel-acrylic p-8 rounded-[2rem] hover:-translate-y-1.5 transition-all duration-500 flex flex-col h-full relative overflow-hidden border shadow-sm ${
              isDark ? 'hover:border-purple-500/20 shadow-purple-950/5' : 'bg-white hover:border-purple-500/30'
            }`}>
              <div className="text-[9px] font-extrabold tracking-wider text-pink-500 bg-pink-500/10 w-fit px-3 py-1.5 rounded-lg uppercase mb-4 border border-pink-500/20">
                Track
              </div>
              <h3 className={`text-xl font-bold mb-3 text-left ${isDark ? 'text-white' : 'text-slate-900'}`}>90-Day Focus Goals</h3>
              <p className={`text-sm mb-8 flex-grow text-left ${isDark ? 'text-[#c6b4c8]' : 'text-slate-600'}`}>
                Visualize long-term progress with radial rings and interactive milestones.
              </p>
              
              <div className="flex justify-center mt-auto relative h-[160px] items-center">
                <svg className="transform -rotate-90" height="150" viewBox="0 0 160 160" width="150">
                  <circle cx="80" cy="80" fill="none" r="70" stroke={isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(147, 51, 234, 0.05)"} strokeWidth="12" />
                  <circle cx="80" cy="80" fill="none" r="50" stroke={isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(147, 51, 234, 0.05)"} strokeWidth="12" />
                  
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
                      <stop offset="0%" stopColor="#ec4899" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                    <linearGradient id="radial-accent-inner" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>

                  <motion.circle
                    cx="150"
                    cy="80"
                    r="6"
                    className="fill-amber-400 stroke-2 cursor-pointer"
                    style={{ stroke: isDark ? "#09050d" : "#f9f7fd" }}
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
                    className="fill-amber-400 stroke-2 cursor-pointer"
                    style={{ stroke: isDark ? "#09050d" : "#f9f7fd" }}
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    whileHover={{ scale: 1.4 }}
                    transition={{ delay: 1.2 }}
                    onMouseEnter={() => setHoveredMilestone("Day 60 Achieved: Flow Master Status")}
                    onMouseLeave={() => setHoveredMilestone(null)}
                  />
                </svg>

                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                  <span className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>75%</span>
                </div>

                <AnimatePresence>
                  {hoveredMilestone && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-[10px] px-3.5 py-1.5 rounded-lg border border-white/10 shadow-lg z-10 text-center whitespace-nowrap"
                    >
                      {hoveredMilestone}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Card 3: Discipline Radar */}
            <div className={`glass-panel-acrylic p-8 rounded-[2rem] hover:-translate-y-1.5 transition-all duration-500 flex flex-col h-full relative overflow-hidden border shadow-sm ${
              isDark ? 'hover:border-purple-500/20 shadow-purple-950/5' : 'bg-white hover:border-purple-500/30'
            }`}>
              <div className="text-[9px] font-extrabold tracking-wider text-amber-500 bg-amber-500/10 w-fit px-3 py-1.5 rounded-lg uppercase mb-4 border border-amber-500/20">
                Analyze
              </div>
              <h3 className={`text-xl font-bold mb-3 text-left ${isDark ? 'text-white' : 'text-slate-900'}`}>Discipline Radar</h3>
              <p className={`text-sm mb-8 flex-grow text-left ${isDark ? 'text-[#c6b4c8]' : 'text-slate-600'}`}>
                Identify strengths and weak categories across different habit streams instantly.
              </p>
              
              <div className="flex justify-center mt-auto h-[160px] items-center">
                <svg className="group-hover:scale-105 transition-transform duration-500" height="150" viewBox="0 0 160 160" width="150">
                  <polygon fill="none" points="80,10 140.6,45 140.6,115 80,150 19.4,115 19.4,45" stroke="rgba(154, 140, 155, 0.15)" strokeWidth="1" />
                  <polygon fill="none" points="80,33.3 120.4,56.6 120.4,103.3 80,126.6 39.6,103.3 39.6,56.6" stroke="rgba(154, 140, 155, 0.15)" strokeWidth="1" />
                  <line stroke="rgba(154, 140, 155, 0.15)" strokeWidth="1" x1="80" x2="80" y1="80" y2="10" />
                  <line stroke="rgba(154, 140, 155, 0.15)" strokeWidth="1" x1="80" x2="140.6" y1="80" y2="45" />
                  
                  <motion.polygon 
                    fill={isDark ? "rgba(168, 85, 247, 0.22)" : "rgba(147, 51, 234, 0.14)"}
                    stroke={isDark ? "#d8b4fe" : "#8b5cf6"}
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
          <div className={`glass-panel-acrylic-heavy border rounded-[2.5rem] p-10 md:p-16 text-center relative overflow-hidden shadow-2xl transition-all duration-300 ${
            isDark ? 'border-purple-500/20 shadow-purple-950/20' : 'border-purple-100 shadow-purple-50'
          }`}>
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none" />
            
            <h2 className={`text-3xl md:text-5xl font-black mb-6 relative z-10 leading-tight tracking-tight ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              Start building your sanctuary.
            </h2>
            <p className={`text-base max-w-2xl mx-auto mb-10 relative z-10 ${
              isDark ? 'text-[#c6b4c8]' : 'text-slate-600'
            }`}>
              Seamlessly synced across your devices with local IndexedDB offline storage and secure Supabase database. No friction, just focus.
            </p>
            
            <Link href="/login?mode=signup">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-xl hover:shadow-purple-500/30 px-10 py-5 rounded-2xl text-white font-bold text-lg relative z-10 cursor-pointer shadow-lg"
              >
                Claim Your Free Workspace
              </motion.button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={`w-full border-t flex flex-col md:flex-row justify-between items-center px-6 md:px-12 py-12 z-10 relative transition-colors duration-500 ${
        isDark ? 'bg-[#050308] border-white/5 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
      }`}>
        <div className="flex items-center gap-2 mb-6 md:mb-0">
          <div className="h-6 w-6 rounded bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
            <svg viewBox="0 0 32 32" className="h-4.5 w-4.5" fill="none">
              <path d="M 16 4 A 12 12 0 1 1 15.99 4" stroke="#a855f7" strokeWidth="3" />
            </svg>
          </div>
          <span className={`font-black text-lg ${isDark ? 'text-purple-300' : 'text-slate-800'}`}>HabitFlow</span>
        </div>

        <div className="flex gap-6 mb-6 md:mb-0 text-sm">
          <a className="hover:text-purple-500 transition-colors" href="#">Privacy Policy</a>
          <a className="hover:text-purple-500 transition-colors" href="#">Terms of Service</a>
          <a className="hover:text-purple-500 transition-colors" href="#">Support</a>
        </div>
        <div className="text-xs">© 2026 HabitFlow. All rights reserved.</div>
      </footer>
    </div>
  );
}
