'use client';

import React from 'react';
import { Check, CheckCircle2, Trash2, Tag } from 'lucide-react';
import type { FinanceCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';

export function ActivityBulkActionBar(params: {
  totalCount: number;
  selectedIds: string[];
  bulkCategoryId: string;
  isBulkWorking: boolean;
  categories: FinanceCategory[];
  onToggleSelectAll: () => void;
  onBulkApprove: () => void;
  onBulkRecategorize: (catId: string) => void;
  onBulkDelete: () => void;
}) {
  const { totalCount, selectedIds, bulkCategoryId, isBulkWorking, categories, onToggleSelectAll, onBulkApprove, onBulkRecategorize, onBulkDelete } = params;
  if (totalCount === 0) return null;
  const allSelected = selectedIds.length > 0 && selectedIds.length === totalCount;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onToggleSelectAll} className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5">
          <span className={`w-4 h-4 rounded border flex items-center justify-center ${allSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-background'}`}>
            {allSelected && <Check className="w-3 h-3" />}
          </span>
          <span>{selectedIds.length > 0 ? `${selectedIds.length} selected` : `Select from ${totalCount} entries`}</span>
        </button>

        <span className="hidden lg:inline text-[11px] text-muted-foreground font-mono">
          Shortcuts: ↑↓ select · R approve · E edit · D delete · / search
        </span>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={isBulkWorking} onClick={onBulkApprove} className="h-8 px-2.5 rounded-lg text-xs font-semibold gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Approve</span>
          </Button>
          <div className="flex items-center gap-1">
            <Tag className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              aria-label="Bulk recategorize selected transactions"
              value={bulkCategoryId}
              onChange={(e) => onBulkRecategorize(e.target.value)}
              disabled={isBulkWorking}
              className="h-8 px-2 text-xs rounded-lg border border-input bg-background text-foreground"
            >
              <option value="">Move to Category...</option>
              {categories.filter((c) => !c.deletedAt).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <Button type="button" size="sm" variant="outline" disabled={isBulkWorking} onClick={onBulkDelete} className="h-8 px-2.5 rounded-lg text-xs font-semibold gap-1 text-rose-600 hover:bg-rose-500/10">
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </Button>
        </div>
      )}
    </div>
  );
}
