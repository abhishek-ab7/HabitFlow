'use client';

import { motion } from 'framer-motion';
import { Sparkles, CheckSquare } from 'lucide-react';

export function DashboardCenterLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[450px] w-full py-12 text-center">
      {/* Outer Glowing Ring with custom rotation */}
      <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
        {/* Outer Pulsing Glow */}
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl animate-pulse" />
        
        {/* Animated Gradient Ring */}
        <div className="absolute inset-0 rounded-full border-4 border-muted/20" />
        <div 
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary border-r-indigo-500 animate-spin" 
          style={{ animationDuration: '1s' }} 
        />

        {/* Central Logo Box */}
        <div className="absolute w-18 h-18 rounded-2xl bg-card border border-white/10 shadow-lg flex items-center justify-center animate-pulse">
          <CheckSquare className="w-9 h-9 text-primary" />
        </div>
      </div>

      {/* Loading Text */}
      <div className="space-y-3 max-w-xs">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
          <span>Loading HabitFlow</span>
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          >
            <Sparkles className="w-4 h-4 text-warning" />
          </motion.span>
        </h2>
        <p className="text-sm text-muted-foreground">
          Fetching your habits, goals, and daily progress...
        </p>
      </div>

      {/* Pulsing Progress Bar */}
      <div className="w-56 mt-6 bg-muted/40 h-1.5 rounded-full overflow-hidden border border-border/10 relative">
        <div className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full animate-infinite-loading w-[50%]" />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes infinite-loading {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }
        .animate-infinite-loading {
          animation: infinite-loading 1.4s ease-in-out infinite;
        }
      `}} />
    </div>
  );
}
