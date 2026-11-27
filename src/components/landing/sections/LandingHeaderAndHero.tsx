'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Play, Sparkles, Sun, Moon, Flame, Calendar, Shield } from 'lucide-react';

export function LandingHeader(params: {
  isDark: boolean;
  onToggleTheme: () => void;
}) {
  const { isDark, onToggleTheme } = params;
  return (
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
            onClick={onToggleTheme}
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
  );
}

function HeroVisualPanels() {
  return (
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
            <p className="text-base font-bold text-foreground">Active Streak</p>
          </div>
          <span className="text-[10px] font-extrabold tracking-wider px-3 py-1 rounded-full uppercase border bg-primary/10 text-emerald-700 dark:text-emerald-400 border-primary/25 font-mono">DAY 12</span>
        </div>

        <div className="text-5xl font-black mb-4 tracking-tight flex items-baseline font-mono tabular-nums text-foreground">
          12<span className="text-sm font-sans font-semibold ml-1.5 text-muted-foreground">days in a row</span>
        </div>

        <div className="text-xs font-semibold mb-3 flex justify-between items-center text-muted-foreground">
          <span>Weekly Consistency</span>
          <span className="text-primary font-bold font-mono tabular-nums">4 / 7 days completed</span>
        </div>

        <div className="flex justify-between gap-2.5 mt-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-2.5 flex-1 bg-primary rounded-full" />)}
          {[5, 6, 7].map((i) => <div key={i} className="h-2.5 flex-1 rounded-full bg-muted" />)}
        </div>
      </motion.div>

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
            <div key={i} className={`aspect-square rounded ${i % 3 === 0 ? 'bg-primary shadow-xs' : 'bg-muted'}`} />
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -60, y: 50, rotate: -8 }}
        animate={{ opacity: 0.95, x: -50, y: 80, rotate: -6 }}
        transition={{ duration: 1, delay: 0.5 }}
        className="surface-card p-4 w-52 shadow-lg absolute z-10 hidden sm:block"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Shield className="h-4.5 w-4.5 text-info" />
            <span className="text-xs font-bold text-foreground">Safe-to-Spend</span>
          </div>
          <span className="text-[10px] text-primary font-extrabold font-mono tabular-nums">₹1,840/day</span>
        </div>
        <div className="w-full h-1.5 rounded-full overflow-hidden mt-2 bg-muted">
          <div className="w-[70%] h-full bg-primary rounded-full" />
        </div>
      </motion.div>
    </div>
  );
}

export function LandingHeroZone() {
  return (
    <section className="w-full max-w-7xl px-6 md:px-12 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative min-h-[80vh]">
      <div className="lg:col-span-7 flex flex-col text-center lg:text-left items-center lg:items-start z-10">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase mb-6 bg-primary/10 text-emerald-700 dark:text-emerald-400 border border-primary/25"
        >
          <Sparkles className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
          Precision Life &amp; Finance OS
        </div>

        <h1
          className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] mb-6 text-foreground"
        >
          Master habits.<br />
          Find your <span className="text-gradient">Flow.</span>
        </h1>

        <p
          className="text-lg md:text-xl mb-10 max-w-xl text-slate-600 dark:text-slate-300"
        >
          Build consistency, conquer deep work, and steer your personal finances in one calm, offline-first Life OS.
        </p>

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

      <HeroVisualPanels />
    </section>
  );
}

export function LandingAutoPlayBanner({ isDemoActive, onToggle }: { isDemoActive: boolean; onToggle: () => void }) {
  const dotCls = isDemoActive ? 'bg-primary-foreground' : 'bg-muted-foreground';
  return (
    <div className="w-full max-w-7xl px-6 md:px-12 pt-6 flex justify-center z-10">
      <button
        onClick={onToggle}
        className={`px-6 py-3 rounded-full text-xs font-black tracking-widest uppercase flex items-center gap-2.5 border transition-all duration-200 shadow-sm cursor-pointer ${
          isDemoActive ? 'bg-primary border-primary text-primary-foreground' : 'bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotCls}`} />
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotCls}`} />
        </span>
        {isDemoActive ? 'Auto-Play Active (Interact to Pause)' : '▶ Resume Live Demo Loop'}
      </button>
    </div>
  );
}

export function LandingFooter() {
  return (
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
  );
}
