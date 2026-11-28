'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CoachActionProposal } from '@/lib/ai/graphs/coach-swarm-types';

interface CoachActionCardProps {
  proposals: CoachActionProposal[];
  onAccept: (proposal: CoachActionProposal) => Promise<void> | void;
  onDismiss: (id: string) => void;
}

export function CoachActionCard({ proposals, onAccept, onDismiss }: CoachActionCardProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (proposals.length === 0) return null;

  const handleAccept = async (proposal: CoachActionProposal) => {
    setPendingId(proposal.id);
    try {
      await onAccept(proposal);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-2" data-testid="coach-action-proposals">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Suggested Actions
      </p>
      {proposals.map((proposal) => {
        const isBusy = pendingId === proposal.id;
        return (
          <div
            key={proposal.id}
            className="rounded-xl border border-border bg-background/80 p-3 flex items-start justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">{proposal.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{proposal.description}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                size="sm"
                onClick={() => handleAccept(proposal)}
                disabled={isBusy}
                className="h-7 px-2.5 text-[11px] rounded-lg gap-1"
              >
                <Check className="w-3 h-3" />
                Accept
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onDismiss(proposal.id)}
                disabled={isBusy}
                className="h-7 px-2 text-[11px] rounded-lg text-muted-foreground hover:text-foreground gap-0.5"
              >
                <X className="w-3 h-3" />
                Dismiss
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
