'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/auth-provider';

const AICoachWidget = dynamic(
  () => import('../AICoachWidget').then((m) => ({ default: m.AICoachWidget })),
  { ssr: false }
);

const AskFinancesDrawer = dynamic(
  () => import('@/components/finance/AskFinancesDrawer').then((m) => ({ default: m.AskFinancesDrawer })),
  { ssr: false }
);

export function AICoachFloating() {
  const pathname = usePathname() ?? '';
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [askOpen, setAskOpen] = useState(false);

  const isAppRoute = pathname !== '/' && pathname !== '/login' && !pathname.startsWith('/auth');
  if (!isAppRoute) return null;

  return (
    <>
      <div className="fixed bottom-[76px] right-4 md:bottom-6 md:right-6 z-50 flex flex-col items-end gap-2.5">
        {isExpanded ? (
          <div
            data-testid="ai-coach-floating-panel"
            className="relative w-[calc(100vw-2rem)] sm:w-[390px] max-h-[75vh] overflow-y-auto rounded-2xl shadow-2xl border border-border bg-card"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close AI Coach"
              onClick={() => setIsExpanded(false)}
              className="absolute top-2.5 right-2.5 z-10 h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
            <AICoachWidget
              onOpenAskFinances={() => {
                setIsExpanded(false);
                setAskOpen(true);
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            data-testid="ai-coach-floating-pill"
            aria-label="Open AI Coach"
            onClick={() => setIsExpanded(true)}
            className="inline-flex items-center gap-2 h-11 px-3.5 rounded-full border border-primary/35 shadow-lg bg-card md:bg-card/95 md:backdrop-blur-xl text-foreground hover:border-primary/60 hover:bg-primary/10 transition-colors"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold">AI Coach</span>
          </button>
        )}
      </div>

      {askOpen && (
        <AskFinancesDrawer
          open={askOpen}
          onOpenChange={setAskOpen}
          userId={user?.id ?? null}
        />
      )}
    </>
  );
}
