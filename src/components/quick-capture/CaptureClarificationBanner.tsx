'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AmbiguityPrompt, DuplicateWarning } from '@/lib/ai/graphs/capture-state';

interface CaptureClarificationBannerProps {
  ambiguities: AmbiguityPrompt[];
  duplicateWarnings: DuplicateWarning[];
  onResolveAmbiguity: (
    ambiguityId: string,
    actionId: string,
    accountId: string,
    accountName: string
  ) => void;
  onResolveDuplicate: (warningId: string, actionId: string, decision: 'keep' | 'skip') => void;
}

export function CaptureClarificationBanner({
  ambiguities,
  duplicateWarnings,
  onResolveAmbiguity,
  onResolveDuplicate,
}: CaptureClarificationBannerProps) {
  if (ambiguities.length === 0 && duplicateWarnings.length === 0) return null;

  return (
    <div
      data-testid="capture-clarification-banner"
      className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2.5"
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>Quick clarification needed before logging</span>
      </div>

      {ambiguities.map((amb) => (
        <div
          key={amb.id}
          data-testid={`ambiguity-${amb.id}`}
          className="space-y-1.5 rounded-lg bg-background/70 p-2.5 border border-amber-500/20"
        >
          <p className="text-xs font-medium text-foreground">{amb.question}</p>
          <div className="flex flex-wrap gap-1.5">
            {amb.options.map((opt) => (
              <Button
                key={opt.value}
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs border-amber-500/40 hover:bg-amber-500/20"
                onClick={() => onResolveAmbiguity(amb.id, amb.actionId, opt.value, opt.label)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      ))}

      {duplicateWarnings.map((dup) => (
        <div
          key={dup.id}
          data-testid={`duplicate-${dup.id}`}
          className="space-y-1.5 rounded-lg bg-background/70 p-2.5 border border-amber-500/20"
        >
          <div className="flex items-start gap-1.5 text-xs text-foreground">
            <Copy className="h-3.5 w-3.5 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{dup.reason}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs gap-1"
              onClick={() => onResolveDuplicate(dup.id, dup.actionId, 'keep')}
            >
              <CheckCircle2 className="h-3 w-3" />
              Keep anyway
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 px-2.5 text-xs"
              onClick={() => onResolveDuplicate(dup.id, dup.actionId, 'skip')}
            >
              Skip duplicate
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
