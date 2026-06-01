'use client';

import { motion } from 'framer-motion';

interface SplashScreenProps {
  theme?: string;
}

export function SplashScreen({ theme }: SplashScreenProps) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-colors duration-500"
    >
      <div className="flex flex-col items-center gap-6">
        {/* Animated Premium Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [0.8, 1.1, 1], opacity: 1 }}
          transition={{
            duration: 1.2,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 shadow-2xl dark:border-purple-500/30"
        >
          {/* Outer glowing ring */}
          <div className="absolute inset-0 rounded-3xl bg-purple-500/10 blur-xl animate-pulse" />
          
          <svg viewBox="0 0 32 32" className="h-14 w-14 z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <motion.path
              d="M 16 4 A 12 12 0 1 1 15.99 4"
              stroke="url(#splash-logo-grad)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            />
            <motion.path
              d="M 12 16.5 L 15 19.5 L 21 12.5"
              stroke="url(#splash-logo-grad-2)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.0, delay: 0.8, ease: "easeInOut" }}
            />
            <defs>
              <linearGradient id="splash-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
              <linearGradient id="splash-logo-grad-2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>

        {/* Brand Name */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-2"
        >
          <span className="text-3xl font-black tracking-tight text-foreground bg-clip-text">
            HabitFlow
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
            Build Better Habits
          </span>
        </motion.div>

        {/* Subtle loading indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
          className="mt-8 flex items-center justify-center gap-1.5"
        >
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce" />
        </motion.div>
      </div>
    </div>
  );
}
