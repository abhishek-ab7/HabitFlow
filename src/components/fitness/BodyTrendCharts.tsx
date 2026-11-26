'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Ruler, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { calculate7DayRollingWeight, calculateWeeklyWaistTrend } from '@/lib/fitness/shared-analytics';
import { useFeedback } from '@/hooks/use-feedback';
import type { FitnessDailyLog, FitnessProfile } from '@/lib/types';

interface BodyTrendChartsProps {
  selectedDate: string;
  dailyLogs: FitnessDailyLog[];
  profile: FitnessProfile | null;
  onSaveBodyMetrics: (patch: {
    weightKg?: number | null;
    waistInches?: number | null;
  }) => Promise<void>;
}

function parseBodyCheckInInputs(weightInput: string, waistInput: string) {
  const w = weightInput.trim() ? Number(weightInput) : undefined;
  const waist = waistInput.trim() ? Number(waistInput) : undefined;
  const hasWeight = w !== undefined && Number.isFinite(w);
  const hasWaist = waist !== undefined && Number.isFinite(waist);
  if (!hasWeight && !hasWaist) return null;
  return {
    ...(hasWeight ? { weightKg: Number(w!.toFixed(2)) } : {}),
    ...(hasWaist ? { waistInches: Number(waist!.toFixed(2)) } : {}),
  };
}

function TrendChartCardShell({
  title,
  subtitle,
  isEmpty,
  emptyIcon,
  emptyTitle,
  emptyHint,
  children,
}: {
  title: string;
  subtitle: string;
  isEmpty: boolean;
  emptyIcon: React.ReactNode;
  emptyTitle: string;
  emptyHint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {isEmpty ? (
        <div className="h-[220px] flex flex-col items-center justify-center text-center rounded-xl bg-muted/20 border border-dashed border-border px-4">
          {emptyIcon}
          <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
          <p className="text-xs text-muted-foreground mt-1">{emptyHint}</p>
        </div>
      ) : (
        <div className="h-[230px] w-full">
          <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function RollingWeightChartCard({
  rollingWeight,
  targetWeightKg,
}: {
  rollingWeight: ReturnType<typeof calculate7DayRollingWeight>;
  targetWeightKg?: number | null;
}) {
  return (
    <TrendChartCardShell
      title="7-Day Rolling Average Weight"
      subtitle="Faded line = daily scale · Bold line = 7-day rolling trend"
      isEmpty={rollingWeight.points.length < 2}
      emptyIcon={<Scale className="h-7 w-7 text-muted-foreground mb-2 opacity-60" />}
      emptyTitle="Log at least 2 weigh-ins to plot your rolling trend"
      emptyHint="Tip: Weigh yourself every morning after bathroom & before water"
    >
      <LineChart data={rollingWeight.points} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
        <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fontSize: 11 }} />
        <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value: unknown, name: unknown) => [`${value} kg`, name === 'rolling7DayAvg' ? '7d Avg' : 'Scale']} />
        {targetWeightKg != null && <ReferenceLine y={targetWeightKg} stroke="#f59e0b" strokeDasharray="4 4" />}
        <Line type="monotone" dataKey="weightKg" stroke="#94a3b8" strokeOpacity={0.55} strokeWidth={1.5} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="rolling7DayAvg" stroke="#10b981" strokeWidth={2.5} dot={false} />
      </LineChart>
    </TrendChartCardShell>
  );
}

function WaistTrendChartCard({
  waistTrend,
  targetWaistInches,
}: {
  waistTrend: ReturnType<typeof calculateWeeklyWaistTrend>;
  targetWaistInches?: number | null;
}) {
  return (
    <TrendChartCardShell
      title="Weekly Waist Size Trend"
      subtitle="Best real-world indicator of fat loss vs water retention"
      isEmpty={waistTrend.points.length < 2}
      emptyIcon={<Ruler className="h-7 w-7 text-muted-foreground mb-2 opacity-60" />}
      emptyTitle="Log waist measurements weekly (Sunday morning)"
      emptyHint="2+ weeks of waist readings unlock your abdominal fat-loss trend"
    >
      <LineChart data={waistTrend.points} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
        <XAxis dataKey="weekKey" tick={{ fontSize: 11 }} />
        <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value: unknown) => [`${value}"`, 'Waist']} />
        {targetWaistInches != null && <ReferenceLine y={targetWaistInches} stroke="#10b981" strokeDasharray="4 4" />}
        <Line type="monotone" dataKey="waistInches" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} />
      </LineChart>
    </TrendChartCardShell>
  );
}

function BodySummaryTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? 'rounded-xl bg-emerald-500/10 p-2.5' : 'rounded-xl bg-muted/40 p-2.5'}>
      <p className={highlight ? 'text-[11px] text-emerald-700 dark:text-emerald-300' : 'text-[11px] text-muted-foreground'}>
        {label}
      </p>
      <p className={highlight ? 'text-base font-bold text-emerald-700 dark:text-emerald-300' : 'text-base font-bold text-foreground'}>
        {value}
      </p>
    </div>
  );
}

function formatKgLabel(val: number | null | undefined, fallback: string): string {
  return val != null ? `${val} kg` : fallback;
}

function BodyCheckInSummaryGrid({
  rollingWeight,
  waistTrend,
  targetWeightKg,
}: {
  rollingWeight: ReturnType<typeof calculate7DayRollingWeight>;
  waistTrend: ReturnType<typeof calculateWeeklyWaistTrend>;
  targetWeightKg?: number | null;
}) {
  const deltaText =
    waistTrend.totalDeltaInches !== null
      ? `(${waistTrend.totalDeltaInches > 0 ? '+' : ''}${waistTrend.totalDeltaInches}")`
      : null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-border/60">
      <BodySummaryTile label="Latest Scale" value={formatKgLabel(rollingWeight.latestWeightKg, '—')} />
      <BodySummaryTile label="7-Day Rolling Avg" value={formatKgLabel(rollingWeight.latestRollingAvgKg, '—')} highlight />
      <BodySummaryTile label="Target Weight" value={formatKgLabel(targetWeightKg, 'Not set')} />
      <BodySummaryTile
        label="Latest Waist"
        value={
          <>
            {waistTrend.latestWaistInches != null ? `${waistTrend.latestWaistInches}"` : '—'}
            {deltaText && <span className="ml-1.5 text-xs font-medium text-emerald-500">{deltaText}</span>}
          </>
        }
      />
    </div>
  );
}

function WeeklyDeltaBadge({ deltaKg }: { deltaKg: number | null }) {
  if (deltaKg === null) return null;
  const isDownOrFlat = deltaKg <= 0;
  return (
    <Badge
      variant="secondary"
      className={isDownOrFlat ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0'}
    >
      {isDownOrFlat ? <TrendingDown className="h-3 w-3 mr-1" /> : <TrendingUp className="h-3 w-3 mr-1" />}
      {deltaKg > 0 ? '+' : ''}
      {deltaKg} kg / 7d
    </Badge>
  );
}

function BodyCheckInFormCard({
  selectedDate,
  rollingWeight,
  waistTrend,
  targetWeightKg,
  weightInput,
  waistInput,
  saving,
  onWeightChange,
  onWaistChange,
  onSubmit,
}: {
  selectedDate: string;
  rollingWeight: ReturnType<typeof calculate7DayRollingWeight>;
  waistTrend: ReturnType<typeof calculateWeeklyWaistTrend>;
  targetWeightKg?: number | null;
  weightInput: string;
  waistInput: string;
  saving: boolean;
  onWeightChange: (v: string) => void;
  onWaistChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Scale className="h-4 w-4 text-emerald-500" />
            Morning Weigh-In &amp; Weekly Waist ({selectedDate})
          </h3>
          <p className="text-xs text-muted-foreground">Daily scale noise smooths out with your 7-day rolling average</p>
        </div>
        <WeeklyDeltaBadge deltaKg={rollingWeight.weeklyDeltaKg} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5" /> Weight (kg)
          </label>
          <Input type="number" step="0.1" min="25" max="300" placeholder="e.g. 74.2" value={weightInput} onChange={(e) => onWeightChange(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Ruler className="h-3.5 w-3.5" /> Waist (inches)
          </label>
          <Input type="number" step="0.1" min="20" max="70" placeholder="e.g. 32.5" value={waistInput} onChange={(e) => onWaistChange(e.target.value)} />
        </div>
        <Button type="submit" disabled={saving} className="w-full sm:w-auto">
          {saving ? 'Saving...' : 'Save Body Check-In'}
        </Button>
      </div>

      <BodyCheckInSummaryGrid
        rollingWeight={rollingWeight}
        waistTrend={waistTrend}
        targetWeightKg={targetWeightKg}
      />
    </form>
  );
}

function useBodyCheckInForm({
  selectedDate,
  selectedLog,
  latestWeightKg,
  latestWaistInches,
  profileWeightKg,
  onSaveBodyMetrics,
}: {
  selectedDate: string;
  selectedLog?: FitnessDailyLog;
  latestWeightKg: number | null;
  latestWaistInches: number | null;
  profileWeightKg?: number | null;
  onSaveBodyMetrics: BodyTrendChartsProps['onSaveBodyMetrics'];
}) {
  const [weightInput, setWeightInput] = useState<string>('');
  const [waistInput, setWaistInput] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const feedback = useFeedback();

  useEffect(() => {
    const w = selectedLog?.weightKg ?? latestWeightKg ?? profileWeightKg;
    const waist = selectedLog?.waistInches ?? latestWaistInches;
    setWeightInput(w != null ? String(w) : '');
    setWaistInput(waist != null ? String(waist) : '');
  }, [selectedDate, selectedLog?.weightKg, selectedLog?.waistInches, latestWeightKg, latestWaistInches, profileWeightKg]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = parseBodyCheckInInputs(weightInput, waistInput);
    if (!payload) {
      feedback.error();
      toast.error('Enter a valid weight (kg) or waist measurement (inches)');
      return;
    }
    feedback.complete();
    setSaving(true);
    try {
      await onSaveBodyMetrics(payload);
      toast.success(`Saved body check-in for ${selectedDate}`);
    } finally {
      setSaving(false);
    }
  };

  return { weightInput, setWeightInput, waistInput, setWaistInput, saving, handleSave };
}

export function BodyTrendCharts({
  selectedDate,
  dailyLogs,
  profile,
  onSaveBodyMetrics,
}: BodyTrendChartsProps) {
  const rollingWeight = useMemo(() => calculate7DayRollingWeight(dailyLogs, 90), [dailyLogs]);
  const waistTrend = useMemo(() => calculateWeeklyWaistTrend(dailyLogs, 24), [dailyLogs]);
  const selectedLog = useMemo(() => dailyLogs.find((d) => d.date === selectedDate && !d.deletedAt), [dailyLogs, selectedDate]);

  const form = useBodyCheckInForm({
    selectedDate,
    selectedLog,
    latestWeightKg: rollingWeight.latestWeightKg,
    latestWaistInches: waistTrend.latestWaistInches,
    profileWeightKg: profile?.currentWeightKg,
    onSaveBodyMetrics,
  });

  return (
    <div className="space-y-5">
      <BodyCheckInFormCard
        selectedDate={selectedDate}
        rollingWeight={rollingWeight}
        waistTrend={waistTrend}
        targetWeightKg={profile?.targetWeightKg}
        weightInput={form.weightInput}
        waistInput={form.waistInput}
        saving={form.saving}
        onWeightChange={form.setWeightInput}
        onWaistChange={form.setWaistInput}
        onSubmit={form.handleSave}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RollingWeightChartCard rollingWeight={rollingWeight} targetWeightKg={profile?.targetWeightKg} />
        <WaistTrendChartCard waistTrend={waistTrend} targetWaistInches={profile?.targetWaistInches} />
      </div>
    </div>
  );
}
