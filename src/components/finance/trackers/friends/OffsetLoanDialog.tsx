'use client';

import React, { useState, useEffect } from 'react';
import type { FriendLedgerGroup } from '@/lib/types';
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

interface OffsetLoanDialogProps {
  group: FriendLedgerGroup | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmOffset: (friendKey: string, loanId: string, amount: number) => Promise<boolean>;
}

export function OffsetLoanDialog({
  group,
  isOpen,
  onClose,
  onConfirmOffset,
}: OffsetLoanDialogProps) {
  const [offsetTargetLoanId, setOffsetTargetLoanId] = useState('');
  const [offsetAmount, setOffsetAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && group) {
      const opposingLoans = group.longTermLoans.filter((l) => {
        if (group.everydayNet > 0) {
          return l.direction === 'borrowed' && l.status === 'active' && l.remainingAmount > 0;
        } else {
          return l.direction === 'lent' && l.status === 'active' && l.remainingAmount > 0;
        }
      });

      const defaultLoan = opposingLoans[0];
      setOffsetTargetLoanId(defaultLoan?.id || '');
      if (defaultLoan) {
        const maxOffset = Math.min(Math.abs(group.everydayNet), defaultLoan.remainingAmount);
        setOffsetAmount(String(maxOffset));
      } else {
        setOffsetAmount('');
      }
    }
  }, [isOpen, group]);

  if (!group) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offsetTargetLoanId) return;
    const amt = parseFloat(offsetAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid offset amount');
      return;
    }

    try {
      setIsSubmitting(true);
      const success = await onConfirmOffset(group.friendKey, offsetTargetLoanId, amt);
      if (success) {
        toast.success(`Offset ${formatINR(amt)} against loan successfully`);
        onClose();
      } else {
        toast.error('Could not complete offset. Check available balance.');
      }
    } catch {
      toast.error('Error applying offset');
    } finally {
      setIsSubmitting(false);
    }
  };

  const eligibleLoans = group.longTermLoans.filter((l) => {
    if (group.everydayNet > 0) {
      return l.direction === 'borrowed' && l.status === 'active' && l.remainingAmount > 0;
    } else {
      return l.direction === 'lent' && l.status === 'active' && l.remainingAmount > 0;
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Offset Tab against Long-Term Loan</DialogTitle>
          <DialogDescription>
            Apply Everyday Tab balance directly against an active Long-Term Loan with {group.friendName}. Cash will not leave your bank account twice.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="p-3 rounded-xl bg-muted/60 text-xs space-y-1">
            <div className="font-semibold text-foreground">
              Current Everyday Net:{' '}
              <span className="font-mono tabular-nums">
                {group.everydayNet > 0
                  ? `+${formatINR(group.everydayNet)} (${group.friendName} owes you)`
                  : `-${formatINR(Math.abs(group.everydayNet))} (You owe ${group.friendName})`}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Zero bank cash is moved. This marks a loan payment with method &quot;offset&quot; and settles the corresponding everyday split items.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="offset-loan-target-sel" className="text-xs">
              Target Long-Term Loan
            </Label>
            <select
              id="offset-loan-target-sel"
              value={offsetTargetLoanId}
              onChange={(e) => {
                setOffsetTargetLoanId(e.target.value);
                const l = group.longTermLoans.find((x) => x.id === e.target.value);
                if (l) {
                  setOffsetAmount(
                    String(Math.min(Math.abs(group.everydayNet), l.remainingAmount))
                  );
                }
              }}
              className="w-full h-10 px-3 text-xs rounded-xl border border-input bg-background"
              required
            >
              {eligibleLoans.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title} (Remaining: {formatINR(l.remainingAmount)})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="offset-amount-in" className="text-xs">
              Offset Amount (₹)
            </Label>
            <Input
              id="offset-amount-in"
              type="number"
              step="any"
              min="1"
              value={offsetAmount}
              onChange={(e) => setOffsetAmount(e.target.value)}
              className="rounded-xl font-mono text-xs"
              required
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
              {isSubmitting ? 'Applying...' : 'Apply Offset'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
