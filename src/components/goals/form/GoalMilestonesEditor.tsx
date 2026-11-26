'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function GoalMilestonesEditor(params: {
  milestones: string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, value: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-medium mb-2 block">Milestones (optional)</label>
      <p className="text-xs text-muted-foreground mb-3">Break down your goal into smaller, achievable steps.</p>
      <div className="space-y-2">
        {params.milestones.map((milestone, index) => (
          <div key={index} className="flex gap-2">
            <Input value={milestone} onChange={(e) => params.onChange(index, e.target.value)} placeholder={`Milestone ${index + 1}`} />
            {params.milestones.length > 1 && (
              <Button type="button" variant="ghost" size="icon" onClick={() => params.onRemove(index)} className="flex-shrink-0">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={params.onAdd} className="w-full gap-1">
          <Plus className="h-4 w-4" /> Add Milestone
        </Button>
      </div>
    </div>
  );
}
