'use client';

import React from 'react';
import { formatHumanDate } from '@/lib/date-format';

interface TooltipPayloadEntry {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string;
}

interface AnalyticsChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  valueFormatter?: (value: number, name: string) => string;
}

function formatTooltipLabel(raw?: string): string {
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return formatHumanDate(raw.slice(0, 10));
  }
  return raw;
}

export function AnalyticsChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: AnalyticsChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      {label && (
        <div className="mb-1.5 font-medium text-foreground">{formatTooltipLabel(label)}</div>
      )}
      <div className="space-y-1">
        {payload.map((entry, idx) => {
          const name = String(entry.name ?? entry.dataKey ?? 'Value');
          const numeric = typeof entry.value === 'number' ? entry.value : Number(entry.value ?? 0);
          const display = valueFormatter
            ? valueFormatter(numeric, name)
            : Number.isFinite(numeric)
              ? numeric.toLocaleString('en-IN')
              : String(entry.value ?? '');

          return (
            <div key={`${name}-${idx}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="inline-block h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color || 'hsl(var(--primary))' }}
                />
                <span>{name}</span>
              </span>
              <span className="font-semibold text-foreground tabular-nums">{display}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
