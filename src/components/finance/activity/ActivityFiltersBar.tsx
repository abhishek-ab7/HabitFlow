'use client';

import React from 'react';
import {
  Search,
  Download,
  Upload,
  MessageSquareText,
  X,
  AlertCircle,
  Calendar,
  FileBarChart2,
  SlidersHorizontal,
} from 'lucide-react';
import type { FinanceAccount, FinanceCategory, FinanceFilterState, FinanceTransactionType } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const TYPE_OPTIONS: Array<{ id: 'all' | FinanceTransactionType; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'expense', label: 'Expense' },
  { id: 'income', label: 'Income' },
  { id: 'investment', label: 'SIP/Invest' },
  { id: 'transfer', label: 'Transfer' },
];

const RANGE_PRESETS = [
  { id: 'month', label: 'Selected Mo' },
  { id: '30d', label: 'Last 30d' },
  { id: '90d', label: 'Last 90d' },
] as const;

function ActivityAdvancedFiltersPanel(params: {
  filters: FinanceFilterState;
  activeRangePreset: 'month' | '30d' | '90d' | 'custom';
  onApplyDatePreset: (preset: 'month' | '30d' | '90d') => void;
  setFilters: (patch: Partial<FinanceFilterState>) => void;
}) {
  const { filters, activeRangePreset, onApplyDatePreset, setFilters } = params;
  return (
    <div className="pt-2.5 border-t border-border/60 grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
      <div className="lg:col-span-4 space-y-1">
        <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Quick Range
        </span>
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-muted">
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onApplyDatePreset(p.id)}
              className={`h-8 text-xs font-semibold rounded-lg transition-colors ${
                activeRangePreset === p.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-4 grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label htmlFor="filter-date-from" className="text-[11px] font-medium text-muted-foreground block">From Date</label>
          <Input
            id="filter-date-from"
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => setFilters({ dateFrom: e.target.value || undefined })}
            className="h-9 text-xs font-mono rounded-xl"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="filter-date-to" className="text-[11px] font-medium text-muted-foreground block">To Date</label>
          <Input
            id="filter-date-to"
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => setFilters({ dateTo: e.target.value || undefined })}
            className="h-9 text-xs font-mono rounded-xl"
          />
        </div>
      </div>

      <div className="lg:col-span-4 grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label htmlFor="filter-min-amt" className="text-[11px] font-medium text-muted-foreground block">Min ₹</label>
          <Input
            id="filter-min-amt"
            type="number"
            min="0"
            placeholder="0"
            value={filters.minAmount ?? ''}
            onChange={(e) => setFilters({ minAmount: e.target.value === '' ? undefined : Number(e.target.value) })}
            className="h-9 text-xs font-mono tabular-nums rounded-xl"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="filter-max-amt" className="text-[11px] font-medium text-muted-foreground block">Max ₹</label>
          <Input
            id="filter-max-amt"
            type="number"
            min="0"
            placeholder="Any"
            value={filters.maxAmount ?? ''}
            onChange={(e) => setFilters({ maxAmount: e.target.value === '' ? undefined : Number(e.target.value) })}
            className="h-9 text-xs font-mono tabular-nums rounded-xl"
          />
        </div>
      </div>
    </div>
  );
}

function ActivitySearchAndTypeRow(params: {
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  filters: FinanceFilterState;
  setFilters: (patch: Partial<FinanceFilterState>) => void;
}) {
  const { searchInputRef, filters, setFilters } = params;
  return (
    <div className="flex flex-col md:flex-row gap-2.5">
      <div className="relative flex-1">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
        <Input
          ref={searchInputRef}
          value={filters.searchQuery}
          onChange={(e) => setFilters({ searchQuery: e.target.value })}
          placeholder="Search merchant, title, notes, or #tag... (press /)"
          className="pl-10 h-10 rounded-xl text-xs sm:text-sm"
        />
      </div>

      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted overflow-x-auto no-swipe shrink-0">
        {TYPE_OPTIONS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilters({ type: t.id })}
            className={`min-h-[32px] px-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              filters.type === t.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ActivityToolbarActions(params: {
  csvFileInputRef: React.RefObject<HTMLInputElement | null>;
  onOpenReport: () => void;
  onOpenSmsImport: () => void;
  onCsvFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportCsv: () => void;
}) {
  const { csvFileInputRef, onOpenReport, onOpenSmsImport, onCsvFileSelected, onExportCsv } = params;
  return (
    <div className="flex items-center gap-2 ml-auto flex-wrap">
      <Button type="button" variant="outline" size="sm" onClick={onOpenReport} className="h-9 px-3 rounded-xl gap-1.5 text-xs font-semibold">
        <FileBarChart2 className="w-3.5 h-3.5 text-primary" />
        <span>Report</span>
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onOpenSmsImport} className="h-9 px-3 rounded-xl gap-1.5 text-xs font-semibold">
        <MessageSquareText className="w-3.5 h-3.5 text-primary" />
        <span className="hidden sm:inline">SMS</span>
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => csvFileInputRef.current?.click()} className="h-9 px-3 rounded-xl gap-1.5 text-xs font-semibold">
        <Upload className="w-3.5 h-3.5 text-primary" />
        <span className="hidden sm:inline">CSV</span>
      </Button>
      <input ref={csvFileInputRef} type="file" accept=".csv,text/csv" onChange={onCsvFileSelected} className="hidden" />
      <Button type="button" variant="outline" size="sm" onClick={onExportCsv} className="h-9 px-3 rounded-xl gap-1.5 text-xs font-semibold">
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Export</span>
      </Button>
    </div>
  );
}

export function ActivityFiltersBar(params: {
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  csvFileInputRef: React.RefObject<HTMLInputElement | null>;
  filters: FinanceFilterState;
  setFilters: (patch: Partial<FinanceFilterState>) => void;
  resetFilters: () => void;
  hasActiveFilters: boolean;
  showAdvancedFilters: boolean;
  setShowAdvancedFilters: React.Dispatch<React.SetStateAction<boolean>>;
  activeRangePreset: 'month' | '30d' | '90d' | 'custom';
  onApplyDatePreset: (preset: 'month' | '30d' | '90d') => void;
  categories: FinanceCategory[];
  accounts: FinanceAccount[];
  onOpenReport: () => void;
  onOpenSmsImport: () => void;
  onCsvFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportCsv: () => void;
}) {
  const {
    searchInputRef, csvFileInputRef, filters, setFilters, resetFilters, hasActiveFilters,
    showAdvancedFilters, setShowAdvancedFilters, activeRangePreset, onApplyDatePreset,
    categories, accounts, onOpenReport, onOpenSmsImport, onCsvFileSelected, onExportCsv,
  } = params;
  const hasAdvancedValues = Boolean(
    showAdvancedFilters || filters.dateFrom || filters.dateTo || typeof filters.minAmount === 'number' || typeof filters.maxAmount === 'number'
  );

  return (
    <div className="sticky top-[56px] md:top-[64px] z-20 rounded-2xl border border-border bg-card/98 shadow-xs p-3.5 sm:p-4 space-y-3">
      <ActivitySearchAndTypeRow searchInputRef={searchInputRef} filters={filters} setFilters={setFilters} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by category"
            value={filters.categoryId}
            onChange={(e) => setFilters({ categoryId: e.target.value })}
            className="h-9 px-2.5 text-xs font-medium rounded-xl border border-input bg-background text-foreground"
          >
            <option value="all">All Categories</option>
            {categories.filter((c) => !c.deletedAt).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            aria-label="Filter by account"
            value={filters.accountId}
            onChange={(e) => setFilters({ accountId: e.target.value })}
            className="h-9 px-2.5 text-xs font-medium rounded-xl border border-input bg-background text-foreground"
          >
            <option value="all">All Accounts</option>
            {accounts.filter((a) => !a.deletedAt).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setFilters({ needsReview: filters.needsReview === 'only_review' ? 'all' : 'only_review' })}
            className={`h-9 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              filters.needsReview === 'only_review'
                ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Needs Review</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAdvancedFilters((v) => !v)}
            className={`h-9 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              hasAdvancedValues ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Date &amp; ₹ Range</span>
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="h-9 px-2.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        <ActivityToolbarActions
          csvFileInputRef={csvFileInputRef}
          onOpenReport={onOpenReport}
          onOpenSmsImport={onOpenSmsImport}
          onCsvFileSelected={onCsvFileSelected}
          onExportCsv={onExportCsv}
        />
      </div>

      {showAdvancedFilters && (
        <ActivityAdvancedFiltersPanel
          filters={filters}
          activeRangePreset={activeRangePreset}
          onApplyDatePreset={onApplyDatePreset}
          setFilters={setFilters}
        />
      )}
    </div>
  );
}
