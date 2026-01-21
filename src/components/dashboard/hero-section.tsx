'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getTimeGreeting, getTimeGradient } from '@/lib/design-tokens';
import { getRandomQuote } from '@/lib/quotes';
import { FadeIn } from '@/components/motion';

interface HeroSectionProps {
  userName?: string;
}

export function HeroSection({ userName }: HeroSectionProps) {
  // Use state to avoid hydration mismatch with time-based values
  const [mounted, setMounted] = useState(false);
  const [timeData, setTimeData] = useState({
    greeting: 'Hello',
    emoji: '👋',
    gradientClass: 'from-slate-100 via-blue-50 to-indigo-100',
    quote: '',
    author: '',
  });

  useEffect(() => {
    setMounted(true);
    const { greeting, emoji } = getTimeGreeting();
    const gradientClass = getTimeGradient();
    const { quote, author } = getRandomQuote();
    setTimeData({ greeting, emoji, gradientClass, quote, author });
  }, []);

  // Render placeholder during SSR to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="relative overflow-hidden rounded-2xl mb-8">
        <div className="bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-indigo-950/50 dark:to-slate-900 p-8 md:p-10">
          <div className="relative z-10">
            <span className="text-3xl mb-2 block">👋</span>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
              Hello{userName && <span className="text-primary">, {userName}</span>}
            </h1>
            <p className="text-muted-foreground text-lg italic h-7" />
            <p className="text-sm text-muted-foreground/70 mt-1 h-5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <FadeIn className="relative overflow-hidden rounded-2xl mb-8">
      <div className={`bg-gradient-to-br ${timeData.gradientClass} dark:from-slate-900 dark:via-indigo-950/50 dark:to-slate-900 p-8 md:p-10`}>
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute -bottom-32 -left-32 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"
            animate={{
              scale: [1.1, 1, 1.1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <span className="text-3xl mb-2 block">{timeData.emoji}</span>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
              {timeData.greeting}
              {userName && <span className="text-primary">, {userName}</span>}
            </h1>
            <p className="text-muted-foreground text-lg italic">
              "{timeData.quote}"
            </p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              — {timeData.author}
            </p>
          </motion.div>
        </div>
      </div>
    </FadeIn>
  );
}
