'use client';

import { motion } from 'framer-motion';

interface SplashScreenProps {
  theme?: string;
}

export function SplashScreen({ theme }: SplashScreenProps) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-colors duration-300"
    >
      <div className="flex flex-col items-center gap-6">
        {/* Animated Logo */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: [0.85, 1.04, 1], opacity: 1 }}
          transition={{
            duration: 1.0,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 border border-primary/25 shadow-sm"
        >
          <svg viewBox="0 0 32 32" className="h-11 w-11 z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <motion.path
              d="M 16 4 A 12 12 0 1 1 15.99 4"
              stroke="url(#splash-logo-grad)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.3, ease: "easeInOut" }}
            />
            <motion.path
              d="M 12 16.5 L 15 19.5 L 21 12.5"
              stroke="url(#splash-logo-grad-2)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, delay: 0.65, ease: "easeInOut" }}
            />
            <defs>
              <linearGradient id="splash-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--primary)" />
                <stop offset="100%" stopColor="oklch(0.65 0.14 175)" />
              </linearGradient>
              <linearGradient id="splash-logo-grad-2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--primary)" />
                <stop offset="100%" stopColor="var(--info)" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>

        {/* Brand Name */}
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-1.5"
        >
          <span className="text-3xl font-bold tracking-tight text-foreground">
            Habit<span className="text-primary">Flow</span>
          </span>
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Discipline & Wealth OS
          </span>
        </motion.div>

        {/* Subtle loading indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85 }}
          className="mt-6 flex items-center justify-center gap-1.5"
        >
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
        </motion.div>
      </div>
    </div>
  );
}
