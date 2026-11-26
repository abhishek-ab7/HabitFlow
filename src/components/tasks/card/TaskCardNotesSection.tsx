'use client';

import React from 'react';
import { Check, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

function NoteSaveStatus({ isSavingNote, justSavedNote, hasUnsavedNote }: { isSavingNote: boolean; justSavedNote: boolean; hasUnsavedNote: boolean }) {
  if (isSavingNote) return <span>Saving...</span>;
  if (justSavedNote) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
        <Check className="h-3 w-3" /> Saved
      </span>
    );
  }
  return <span>{hasUnsavedNote ? 'Unsaved changes' : 'Auto-saves on blur'}</span>;
}

export function TaskCardNotesSection(params: {
  taskTitle: string;
  compact?: boolean;
  isNotesOpen: boolean;
  setIsNotesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  noteDraft: string;
  setNoteDraft: React.Dispatch<React.SetStateAction<string>>;
  normalizedExistingNote: string;
  hasUnsavedNote: boolean;
  isSavingNote: boolean;
  justSavedNote: boolean;
  onSaveNote: () => void;
  onResetDraft: () => void;
}) {
  if (!params.isNotesOpen) {
    if (!params.normalizedExistingNote) return null;
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); params.setIsNotesOpen(true); }}
        className="w-full text-left flex items-start gap-1.5 rounded-lg bg-muted/40 hover:bg-muted/70 border border-border/50 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors"
      >
        <StickyNote className="h-3.5 w-3.5 mt-0.5 text-primary/80 shrink-0" />
        <span className="line-clamp-2 whitespace-pre-wrap break-words text-foreground/85">{params.normalizedExistingNote}</span>
      </button>
    );
  }

  return (
    <div className="space-y-1.5 pt-1" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <Textarea
        value={params.noteDraft}
        onChange={(e) => params.setNoteDraft(e.target.value)}
        onBlur={params.onSaveNote}
        onKeyDown={(e) => {
          const isMacOrWinEnter = e.metaKey || e.ctrlKey;
          if (isMacOrWinEnter && e.key === 'Enter') {
            e.preventDefault();
            params.onSaveNote();
          }
        }}
        placeholder="Write quick notes, context, or reminders..."
        aria-label={`Quick notes for ${params.taskTitle}`}
        rows={params.compact ? 2 : 3}
        className="min-h-[68px] text-xs sm:text-sm bg-muted/35 border-border/70 focus-visible:ring-1 focus-visible:ring-primary/40 rounded-xl resize-y"
      />
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <NoteSaveStatus isSavingNote={params.isSavingNote} justSavedNote={params.justSavedNote} hasUnsavedNote={params.hasUnsavedNote} />
        <div className="flex items-center gap-1.5">
          <Button type="button" size="sm" variant="ghost" onClick={params.onResetDraft} className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
            Close
          </Button>
          <Button type="button" size="sm" disabled={!params.hasUnsavedNote || params.isSavingNote} onClick={params.onSaveNote} className="h-7 px-2.5 text-xs rounded-lg">
            {params.isSavingNote ? 'Saving...' : 'Save Note'}
          </Button>
        </div>
      </div>
    </div>
  );
}
