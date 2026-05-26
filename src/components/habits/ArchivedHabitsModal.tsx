'use client';

import { useState, useEffect } from 'react';
import { Archive, RotateCcw, Trash2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useHabitStore } from '@/lib/stores/habit-store';
import { format, parseISO } from 'date-fns';
import type { Habit } from '@/lib/types';

interface ArchivedHabitsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArchivedHabitsModal({ open, onOpenChange }: ArchivedHabitsModalProps) {
  const [archivedHabits, setArchivedHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(false);
  const { loadArchivedHabits, editHabit, removeHabit } = useHabitStore();

  const fetchArchived = async () => {
    setLoading(true);
    try {
      const list = await loadArchivedHabits();
      // Sort by last archived/created first
      setArchivedHabits(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch (error) {
      toast.error('Failed to load archived habits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchArchived();
    }
  }, [open]);

  const handleRestore = async (id: string, name: string) => {
    try {
      await editHabit(id, { archived: false });
      toast.success(`"${name}" restored successfully!`);
      // Update local modal list
      setArchivedHabits(prev => prev.filter(h => h.id !== id));
    } catch (error) {
      toast.error('Failed to restore habit');
    }
  };

  const handleDeletePermanently = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to permanently delete "${name}"? This will delete all completion history and cannot be undone.`)) {
      try {
        await removeHabit(id);
        toast.success(`"${name}" permanently deleted.`);
        setArchivedHabits(prev => prev.filter(h => h.id !== id));
      } catch (error) {
        toast.error('Failed to delete habit');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-amber-500" />
            <span>Archived Habits</span>
          </DialogTitle>
          <DialogDescription>
            View your archived habits. Restoring a habit will reactivate it on your dashboard with all history intact.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <span>Loading archived habits...</span>
            </div>
          ) : archivedHabits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border border-dashed rounded-xl p-6">
              <Archive className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="font-semibold">No archived habits</p>
              <p className="text-xs max-w-xs mt-1">
                Habits you archive in the future will appear here for restore or deletion.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {archivedHabits.map(habit => (
                <div
                  key={habit.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border/40 hover:bg-muted/65 hover:border-border/80 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-background border flex items-center justify-center text-lg">
                      {habit.icon || '✓'}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{habit.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span className="capitalize">{habit.category}</span>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Created {format(parseISO(habit.createdAt), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(habit.id, habit.name)}
                      className="h-8 gap-1 border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30"
                      title="Restore Habit"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Restore</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeletePermanently(habit.id, habit.name)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Delete Permanently"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
