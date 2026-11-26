'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Habit } from '@/lib/types';

export function HabitGridDialogs(params: {
  showLogModal: boolean;
  setShowLogModal: React.Dispatch<React.SetStateAction<boolean>>;
  selectedHabitForLog: Habit | null;
  logDate: string;
  setLogDate: React.Dispatch<React.SetStateAction<string>>;
  logValue: number;
  setLogValue: React.Dispatch<React.SetStateAction<number>>;
  logNote: string;
  setLogNote: React.Dispatch<React.SetStateAction<string>>;
  onSaveLogModal: () => void;
  showNoShieldsDialog: boolean;
  setShowNoShieldsDialog: React.Dispatch<React.SetStateAction<boolean>>;
  onGoToSettings: () => void;
}) {
  return (
    <>
      <Dialog open={params.showLogModal} onOpenChange={params.setShowLogModal}>
        <DialogContent className="w-full max-w-sm rounded-2xl p-6 bg-background border shadow-xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-bold text-foreground">Log Progress</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update notes or quantitative values for {params.selectedHabitForLog?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Date</Label>
              <Input type="date" value={params.logDate} onChange={(e) => params.setLogDate(e.target.value)} className="h-10 rounded-xl" />
            </div>

            {params.selectedHabitForLog?.isQuantitative && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Progress ({params.selectedHabitForLog.unit || 'units'})
                </Label>
                <div className="flex items-center gap-2">
                  <Button type="button" size="icon" variant="outline" className="h-9 w-9 rounded-lg" onClick={() => params.setLogValue((prev) => Math.max(0, prev - 1))}>-</Button>
                  <Input type="number" min={0} value={params.logValue} onChange={(e) => params.setLogValue(Math.max(0, parseInt(e.target.value, 10) || 0))} className="h-9 text-center rounded-lg" />
                  <Button type="button" size="icon" variant="outline" className="h-9 w-9 rounded-lg" onClick={() => params.setLogValue((prev) => prev + 1)}>+</Button>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-1">/ {params.selectedHabitForLog.targetValue}</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Journal Entry</Label>
              <Textarea value={params.logNote} onChange={(e) => params.setLogNote(e.target.value)} placeholder="Reflect on your progress..." className="min-h-[80px] text-xs resize-none rounded-xl" />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => params.setShowLogModal(false)} className="flex-1 rounded-xl">Cancel</Button>
            <Button type="button" onClick={params.onSaveLogModal} className="flex-1 rounded-xl">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={params.showNoShieldsDialog} onOpenChange={params.setShowNoShieldsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>No Streak Shields Remaining</DialogTitle>
            <DialogDescription>
              You&apos;ve used this week&apos;s free freeze and have 0 Streak Shields left. Refill your personal Streak Shields in Settings to protect missed days.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => params.setShowNoShieldsDialog(false)} className="flex-1 rounded-xl">Cancel</Button>
            <Button type="button" onClick={params.onGoToSettings} className="flex-1 rounded-xl">Refill in Settings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
