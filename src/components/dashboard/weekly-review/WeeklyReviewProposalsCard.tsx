'use client';

import React from 'react';
import { CheckSquare, Loader2, Sparkles, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WeeklyReviewOutput, WeeklyReviewProposal } from '@/lib/ai/graphs/weekly-review';

const DOMAIN_BADGE: Record<WeeklyReviewProposal['domain'], { label: string; cls: string }> = {
  habit: { label: 'Habit Fix', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  finance: { label: 'Finance Fix', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  task: { label: 'MIT Focus', cls: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300' },
};

interface WeeklyReviewProposalsCardProps {
  aiReview: WeeklyReviewOutput | null;
  loading: boolean;
  checkedIds: string[];
  onToggleProposal: (id: string) => void;
}

export function WeeklyReviewProposalsCard({
  aiReview,
  loading,
  checkedIds,
  onToggleProposal,
}: WeeklyReviewProposalsCardProps) {
  if (loading && !aiReview) {
    return (
      <div
        data-testid="sunday-ai-loading"
        className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-2.5 text-xs text-muted-foreground"
      >
        <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
        <span>Analyzing cross-domain bottleneck &amp; generating 3 reversible fixes...</span>
      </div>
    );
  }

  if (!aiReview) return null;

  return (
    <div
      data-testid="sunday-ai-proposals"
      className="rounded-2xl border border-primary/25 bg-primary/5 p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Root-Cause Diagnosis</span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-background/80 border border-border text-muted-foreground">
          {aiReview.source === 'gemini' ? 'AI Graph' : 'Offline Digest'}
        </span>
      </div>

      <div className="rounded-xl bg-background/80 border border-border p-3 space-y-1">
        <p className="text-xs sm:text-sm font-bold text-foreground">{aiReview.rootCause.headline}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{aiReview.rootCause.explanation}</p>
      </div>

      {aiReview.proposals.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground">
            Select fixes to apply when you lock your Sunday Reset:
          </p>
          {aiReview.proposals.map((proposal) => {
            const isChecked = checkedIds.includes(proposal.id);
            const badge = DOMAIN_BADGE[proposal.domain];
            return (
              <button
                key={proposal.id}
                type="button"
                data-testid={`sunday-proposal-${proposal.id}`}
                onClick={() => onToggleProposal(proposal.id)}
                className={cn(
                  'w-full text-left rounded-xl border p-2.5 flex items-start gap-2.5 transition-colors',
                  isChecked
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-border bg-background/60 opacity-75 hover:opacity-100'
                )}
              >
                {isChecked ? (
                  <CheckSquare className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold', badge.cls)}>
                      {badge.label}
                    </span>
                    <span className="text-xs font-semibold text-foreground">{proposal.title}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{proposal.rationale}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
