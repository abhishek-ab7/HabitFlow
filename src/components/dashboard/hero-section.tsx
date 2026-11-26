'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getTimeGreeting } from '@/lib/design-tokens';
import { getRandomQuote } from '@/lib/quotes';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

interface HeroSectionProps {
  userName?: string;
  currentStreak?: number;
  isHydrated?: boolean;
  onFocusClick?: () => void;
}

function HeroGreetingTitle({
  currentStreak,
  greeting,
  userName,
}: {
  currentStreak?: number;
  greeting: string;
  userName?: string;
}) {
  if (currentStreak !== undefined && currentStreak > 0) {
    return (
      <>
        Day {currentStreak} streak,{' '}
        <span className="text-primary">{userName || 'Champion'}</span>! 🔥
      </>
    );
  }
  return (
    <>
      {greeting}
      {userName && <span className="text-primary">, {userName}</span>}
    </>
  );
}

export function HeroSection({ userName, currentStreak, isHydrated = false, onFocusClick }: HeroSectionProps) {
  const [mounted, setMounted] = useState(isHydrated);
  const [timeData, setTimeData] = useState(() => {
    if (isHydrated) {
      const { greeting: baseGreeting, emoji } = getTimeGreeting();
      const { quote, author } = getRandomQuote();
      return { greeting: baseGreeting, emoji, quote, author };
    }
    return { greeting: 'Hello', emoji: '👋', quote: '', author: '' };
  });

  useEffect(() => {
    if (mounted) return;
    const { greeting: baseGreeting, emoji } = getTimeGreeting();
    const { quote, author } = getRandomQuote();
    setMounted(true);
    setTimeData({ greeting: baseGreeting, emoji, quote, author });
  }, [mounted]);

  if (!mounted) {
    return (
      <div className="relative overflow-hidden surface-hero mb-8 tour-hero-section p-8 md:p-10">
        <div className="relative z-10">
          <span className="text-3xl mb-2 block">👋</span>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Hello{userName && <span className="text-primary">, {userName}</span>}
          </h1>
          <p className="text-muted-foreground text-lg italic h-7" />
          <p className="text-sm text-muted-foreground/70 mt-1 h-5" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden surface-hero mb-8 tour-hero-section p-8 md:p-10">
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <motion.div className="flex-1" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <span className="text-3xl mb-2 block">{timeData.emoji}</span>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2 text-foreground">
            <HeroGreetingTitle currentStreak={currentStreak} greeting={timeData.greeting} userName={userName} />
          </h1>
          <p className="text-muted-foreground text-base md:text-lg italic max-w-xl">&ldquo;{timeData.quote}&rdquo;</p>
          <p className="text-sm text-muted-foreground/80 mt-1">— {timeData.author}</p>
        </motion.div>

        {onFocusClick && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }} className="shrink-0 self-start md:self-center">
            <Button variant="outline" size="sm" onClick={onFocusClick} className="gap-2 text-xs font-semibold rounded-xl h-9"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Focus Mode
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
