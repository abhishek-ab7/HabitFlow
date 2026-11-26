'use client';

import React from 'react';
import { GOAL_TEMPLATES } from '@/lib/goal-templates';

export function GoalTemplatesTab({ onSelectTemplate }: { onSelectTemplate: (template: (typeof GOAL_TEMPLATES)[number]) => void }) {
  return (
    <div className="py-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {GOAL_TEMPLATES.map((tmpl, idx) => (
          <div
            key={idx}
            onClick={() => onSelectTemplate(tmpl)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectTemplate(tmpl);
              }
            }}
            className="p-4 rounded-xl bg-muted/30 border border-border/40 hover:bg-muted/70 hover:border-border/80 transition-all cursor-pointer flex flex-col justify-between text-left group outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold capitalize px-2 py-0.5 rounded bg-primary/10 text-primary">
                  {tmpl.areaOfLife.replace('_', ' ')}
                </span>
                <span className="text-[10px] text-muted-foreground">{tmpl.durationDays} days</span>
              </div>
              <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">{tmpl.title}</h4>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tmpl.description}</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-border/20 flex flex-wrap gap-1">
              {tmpl.milestones.slice(0, 2).map((m, mIdx) => (
                <span key={mIdx} className="text-[10px] bg-background border rounded px-1.5 py-0.5 text-muted-foreground truncate max-w-[120px]">{m}</span>
              ))}
              {tmpl.milestones.length > 2 && (
                <span className="text-[10px] text-muted-foreground px-1 py-0.5 font-medium">+{tmpl.milestones.length - 2} more</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
