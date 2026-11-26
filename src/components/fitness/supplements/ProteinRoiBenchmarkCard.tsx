'use client';

import React from 'react';
import { Award, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface ProteinBenchmarkRow {
  id: string;
  name: string;
  servingLabel: string;
  proteinPerServingG: number;
  costPer25gProteinInr: number;
  isSupplement: boolean;
}

export function ProteinRoiBenchmarkCard({
  rows,
  maxBenchmarkCost,
}: {
  rows: ProteinBenchmarkRow[];
  maxBenchmarkCost: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" />
            ₹ per 25g Protein ROI Benchmark (Indian Whole Foods vs Supplements)
          </h3>
          <p className="text-xs text-muted-foreground">
            Compare your protein powder cost-efficiency against Boiled Eggs, Chicken Breast, Paneer &amp; Dahi
          </p>
        </div>
        <Badge variant="outline" className="text-[11px] gap-1">
          <Sparkles className="h-3 w-3 text-amber-500" /> Lower ₹/25g = Better ROI
        </Badge>
      </div>

      <div className="space-y-2.5">
        {rows.map((row) => {
          const widthPct = Math.max(12, Math.round((row.costPer25gProteinInr / maxBenchmarkCost) * 100));
          return (
            <div key={row.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-foreground truncate">{row.name}</span>
                  <span className="text-[11px] text-muted-foreground truncate">({row.servingLabel} · {row.proteinPerServingG}g P)</span>
                  {row.isSupplement && <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">Your Stack</Badge>}
                </div>
                <span className="font-mono font-bold text-foreground shrink-0">₹{row.costPer25gProteinInr.toFixed(0)} / 25g P</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className={cn('h-full rounded-full transition-all duration-300', row.isSupplement ? 'bg-primary' : 'bg-emerald-500/75')} style={{ width: `${widthPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
