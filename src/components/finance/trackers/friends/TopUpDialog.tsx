'use client';

import React, { useState, useEffect } from 'react';
import type { DebtRecord } from '@/lib/types';
import { formatINR } from '@/lib/stores/finance-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface TopUpDialogProps {
  target: DebtRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onTopUp: (debtId: string, amount: number, note?: string) => Promise<void>;
}

export function TopUpDialog({
  target,
  isOpen,
  onClose,
  onTopUp,
}: TopUpDialogProps) {
  const [topUpAmt, setTopUpAmt] = useState('');
  const [topUpNote, setTopUpNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTopUpAmt('');
      setTopUpNote('');
    }
  }, [isOpen]);

  if (!target) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(topUpAmt);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid top-up amount');
      return;
    }

    try {
      setIsSubmitting(true);
      await onTopUp(target.id, amt, topUpNote.trim() || undefined);
      toast.success(`Added ${formatINR(amt)} to ${target.personName}'s loan`);
      onClose();
    } catch {
      toast.error('Failed to top up loan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Top Up Loan Balance</DialogTitle>
          <DialogDescription>
            Increase the loan balance for {target.title} ({target.personName}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="topup-amount-modal" className="text-xs">
              Additional Amount (₹)
            </Label>
            <Input
              id="topup-amount-modal"
              type="number"
              step="any"
              min="1"
              value={topUpAmt}
              onChange={(e) => setTopUpAmt(e.target.value)}
              required
              className="rounded-xl font-mono text-xs"
              placeholder="₹ 5,000"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="topup-note-modal" className="text-xs">
              Reason / Note
            </Label>
            <Input
              id="topup-note-modal"
              value={topUpNote}
              onChange={(e) => setTopUpNote(e.target.value)}
              placeholder="e.g., Added extra amount for medical bill"
              className="rounded-xl text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl text-xs">
              {isSubmitting ? 'Adding...' : 'Add Top-Up'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
