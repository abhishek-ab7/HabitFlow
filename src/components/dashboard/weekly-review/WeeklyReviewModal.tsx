'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Award, Smile, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MoodType, Task } from '@/lib/types';
import type { WeeklyReviewOutput } from '@/lib/ai/graphs/weekly-review';
import type { ReviewDayInfo } from './weekly-review-analytics';
import {
  Truth1FinanceCard,
  Truth2BodyCard,
  Truth3JunkCard,
  TruthHabitsMoodCard,
} from './WeeklyReviewTruthCards';
import { WeeklyReviewMitPicker } from './WeeklyReviewMitPicker';
import { WeeklyReviewProposalsCard } from './WeeklyReviewProposalsCard';

export function WeeklyReviewModal(params: {
  open: boolean;
  onClose: () => void;
  isFitnessEnabled: boolean;
  fourTruths: {
    truth1Finance: React.ComponentProps<typeof Truth1FinanceCard>['data'];
    truth2BodyWorkouts: React.ComponentProps<typeof Truth2BodyCard>['data'];
    truth3JunkTrigger: React.ComponentProps<typeof Truth3JunkCard>['data'];
  };
  last7Days: ReviewDayInfo[];
  weeklyCompletionRate: number;
  bestHabitName: string | null;
  bestHabitRate: number | null;
  getMoodForDate: (dateStr: string) => MoodType | undefined;
  selectedMitIds: string[];
  activeMitDate: string;
  todayIso: string;
  mitTargetMode: 'today' | 'next_monday';
  setMitTargetMode: React.Dispatch<React.SetStateAction<'today' | 'next_monday'>>;
  candidateTasks: Task[];
  onToggleMit: (taskId: string) => void;
  savingMits: boolean;
  onSaveMits: () => void;
  aiReview?: WeeklyReviewOutput | null;
  loadingAiReview?: boolean;
  checkedProposalIds?: string[];
  onToggleProposal?: (id: string) => void;
}) {
  return (
    <AnimatePresence>
      {params.open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          data-testid="sunday-reset-modal"
          className="fixed inset-0 z-50 bg-background/90 dark:bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="absolute top-4 right-4 z-55">
            <Button variant="ghost" size="icon" aria-label="Close Sunday Reset" onClick={params.onClose} className="rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary">
              <X className="w-5 h-5" />
            </Button>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.25 }}
            className="max-w-3xl w-full surface-hero p-5 md:p-7 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto"
          >
            <div className="space-y-5">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold border border-primary/20">
                  <Award className="w-3.5 h-3.5 text-primary" />
                  5-Minute Sunday Reset Ritual · The 4 Truths
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Weekly Truth Check &amp; Top 3 Priorities</h2>
                <p className="text-muted-foreground text-xs">Objective Life OS review across Cashflow, Body/Training, Junk Leaks, and Next-Week Focus.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <Truth1FinanceCard data={params.fourTruths.truth1Finance} />
                {params.isFitnessEnabled && <Truth2BodyCard data={params.fourTruths.truth2BodyWorkouts} />}
                <Truth3JunkCard data={params.fourTruths.truth3JunkTrigger} isFitnessEnabled={params.isFitnessEnabled} />
                <TruthHabitsMoodCard
                  last7Days={params.last7Days}
                  weeklyCompletionRate={params.weeklyCompletionRate}
                  bestHabitName={params.bestHabitName}
                  bestHabitRate={params.bestHabitRate}
                  getMoodForDate={params.getMoodForDate}
                />
              </div>

              {params.onToggleProposal && (
                <WeeklyReviewProposalsCard
                  aiReview={params.aiReview ?? null}
                  loading={Boolean(params.loadingAiReview)}
                  checkedIds={params.checkedProposalIds ?? []}
                  onToggleProposal={params.onToggleProposal}
                />
              )}

              <WeeklyReviewMitPicker
                selectedMitIds={params.selectedMitIds}
                activeMitDate={params.activeMitDate}
                todayIso={params.todayIso}
                mitTargetMode={params.mitTargetMode}
                setMitTargetMode={params.setMitTargetMode}
                candidateTasks={params.candidateTasks}
                onToggleMit={params.onToggleMit}
              />

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="ghost" onClick={params.onClose} className="rounded-xl text-xs">Close</Button>
                <Button type="button" disabled={params.savingMits} onClick={params.onSaveMits} data-testid="save-sunday-mits-btn" className="font-semibold px-5 py-2 rounded-xl text-xs gap-1.5">
                  <Smile className="w-3.5 h-3.5" />
                  {params.savingMits ? 'Saving MITs...' : 'Lock Top 3 MITs & Complete Reset'}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
