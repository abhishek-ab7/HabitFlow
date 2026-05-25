'use client';

import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { TimeRange } from '@/lib/types';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'quarter', label: 'Last 90 days' },
  { value: 'year', label: 'Last 365 days' },
];

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  const selectedLabel = TIME_RANGES.find(r => r.value === value)?.label || 'Select range';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Calendar className="h-4 w-4" />
          {selectedLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {TIME_RANGES.map(range => (
          <DropdownMenuCheckboxItem
            key={range.value}
            checked={value === range.value}
            onCheckedChange={() => onChange(range.value)}
          >
            {range.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Tab-style variant for inline selection
export function TimeRangeTabs({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex rounded-lg bg-muted p-1">
      {TIME_RANGES.map(range => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          className={cn(
            "relative px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
            value === range.value
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {value === range.value && (
            <motion.div
              layoutId="activeTimeRange"
              className="absolute inset-0 bg-background rounded-md shadow-sm"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative z-10">{range.value.charAt(0).toUpperCase() + range.value.slice(1)}</span>
        </button>
      ))}
    </div>
  );
}
