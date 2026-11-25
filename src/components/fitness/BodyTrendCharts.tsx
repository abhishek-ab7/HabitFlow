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
import {
  calculate7DayRollingWeight,
  calculateWeeklyWaistTrend,
} from '@/lib/fitness/shared-analytics';
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

export function BodyTrendCharts({
  selectedDate,
  dailyLogs,
  profile,
  onSaveBodyMetrics,
}: BodyTrendChartsProps) {
  const rollingWeight = useMemo(
    () => calculate7DayRollingWeight(dailyLogs, 90),
    [dailyLogs]
  );
  const waistTrend = useMemo(
    () => calculateWeeklyWaistTrend(dailyLogs, 24),
    [dailyLogs]
  );

  const selectedLog = useMemo(
    () => dailyLogs.find((d) => d.date === selectedDate && !d.deletedAt),
    [dailyLogs, selectedDate]
  );

  const [weightInput, setWeightInput] = useState<string>('');
  const [waistInput, setWaistInput] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const w = selectedLog?.weightKg ?? rollingWeight.latestWeightKg ?? profile?.currentWeightKg;
    const waist = selectedLog?.waistInches ?? waistTrend.latestWaistInches;
    setWeightInput(w != null ? String(w) : '');
    setWaistInput(waist != null ? String(waist) : '');
  }, [
    selectedDate,
    selectedLog?.weightKg,
    selectedLog?.waistInches,
    rollingWeight.latestWeightKg,
    waistTrend.latestWaistInches,
    profile?.currentWeightKg,
  ]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedWeight = weightInput.trim() ? Number(weightInput) : undefined;
    const parsedWaist = waistInput.trim() ? Number(waistInput) : undefined;

    if (
      (parsedWeight === undefined || !Number.isFinite(parsedWeight)) &&
      (parsedWaist === undefined || !Number.isFinite(parsedWaist))
    ) {
      toast.error('Enter a valid weight (kg) or waist measurement (inches)');
      return;
    }

    setSaving(true);
    try {
      await onSaveBodyMetrics({
        ...(parsedWeight !== undefined && Number.isFinite(parsedWeight)
          ? { weightKg: Number(parsedWeight.toFixed(2)) }
          : {}),
        ...(parsedWaist !== undefined && Number.isFinite(parsedWaist)
          ? { waistInches: Number(parsedWaist.toFixed(2)) }
          : {}),
      });
      toast.success(`Saved body check-in for ${selectedDate}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Quick Weight + Waist Logger */}
      <form
        onSubmit={handleSave}
        className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Scale className="h-4 w-4 text-emerald-500" />
              Morning Weigh-In &amp; Weekly Waist ({selectedDate})
            </h3>
            <p className="text-xs text-muted-foreground">
              Daily scale noise smooths out with your 7-day rolling average
            </p>
          </div>
          {rollingWeight.weeklyDeltaKg !== null && (
            <Badge
              variant="secondary"
              className={
                rollingWeight.weeklyDeltaKg <= 0
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0'
              }
            >
              {rollingWeight.weeklyDeltaKg <= 0 ? (
                <TrendingDown className="h-3 w-3 mr-1" />
              ) : (
                <TrendingUp className="h-3 w-3 mr-1" />
              )}
              {rollingWeight.weeklyDeltaKg > 0 ? '+' : ''}
              {rollingWeight.weeklyDeltaKg} kg / 7d
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5" /> Weight (kg)
            </label>
            <Input
              type="number"
              step="0.1"
              min="25"
              max="300"
              placeholder="e.g. 74.2"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Ruler className="h-3.5 w-3.5" /> Waist (inches)
            </label>
            <Input
              type="number"
              step="0.1"
              min="20"
              max="70"
              placeholder="e.g. 32.5"
              value={waistInput}
              onChange={(e) => setWaistInput(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving ? 'Saving...' : 'Save Body Check-In'}
          </Button>
        </div>

        {/* Summary KPI Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-border/60">
          <div className="rounded-xl bg-muted/40 p-2.5">
            <p className="text-[11px] text-muted-foreground">Latest Scale</p>
            <p className="text-base font-bold text-foreground">
              {rollingWeight.latestWeightKg != null
                ? `${rollingWeight.latestWeightKg} kg`
                : '—'}
            </p>
          </div>
          <div className="rounded-xl bg-emerald-500/10 p-2.5">
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
              7-Day Rolling Avg
            </p>
            <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">
              {rollingWeight.latestRollingAvgKg != null
                ? `${rollingWeight.latestRollingAvgKg} kg`
                : '—'}
            </p>
          </div>
          <div className="rounded-xl bg-muted/40 p-2.5">
            <p className="text-[11px] text-muted-foreground">Target Weight</p>
            <p className="text-base font-bold text-foreground">
              {profile?.targetWeightKg != null ? `${profile.targetWeightKg} kg` : 'Not set'}
            </p>
          </div>
          <div className="rounded-xl bg-muted/40 p-2.5">
            <p className="text-[11px] text-muted-foreground">Latest Waist</p>
            <p className="text-base font-bold text-foreground">
              {waistTrend.latestWaistInches != null
                ? `${waistTrend.latestWaistInches}"`
                : '—'}
              {waistTrend.totalDeltaInches !== null && (
                <span className="ml-1.5 text-xs font-medium text-emerald-500">
                  ({waistTrend.totalDeltaInches > 0 ? '+' : ''}
                  {waistTrend.totalDeltaInches}&quot;)
                </span>
              )}
            </p>
          </div>
        </div>
      </form>

      {/* 7-Day Rolling Average Weight Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                7-Day Rolling Average Weight
              </h4>
              <p className="text-xs text-muted-foreground">
                Faded line = daily scale · Bold line = 7-day rolling trend
              </p>
            </div>
          </div>

          {rollingWeight.points.length < 2 ? (
            <div className="h-[220px] flex flex-col items-center justify-center text-center rounded-xl bg-muted/20 border border-dashed border-border px-4">
              <Scale className="h-7 w-7 text-muted-foreground mb-2 opacity-60" />
              <p className="text-sm font-medium text-foreground">
                Log at least 2 weigh-ins to plot your rolling trend
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Tip: Weigh yourself every morning after bathroom &amp; before water
              </p>
            </div>
          ) : (
            <div className="h-[230px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={rollingWeight.points}
                  margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => v.slice(5)}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    domain={['dataMin - 1', 'dataMax + 1']}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value: unknown, name: unknown) => [
                      `${value} kg`,
                      name === 'rolling7DayAvg' ? '7d Avg' : 'Scale',
                    ]}
                  />
                  {profile?.targetWeightKg != null && (
                    <ReferenceLine
                      y={profile.targetWeightKg}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="weightKg"
                    stroke="#94a3b8"
                    strokeOpacity={0.55}
                    strokeWidth={1.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rolling7DayAvg"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Weekly Waist Trend Chart */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Weekly Waist Size Trend
              </h4>
              <p className="text-xs text-muted-foreground">
                Best real-world indicator of fat loss vs water retention
              </p>
            </div>
          </div>

          {waistTrend.points.length < 2 ? (
            <div className="h-[220px] flex flex-col items-center justify-center text-center rounded-xl bg-muted/20 border border-dashed border-border px-4">
              <Ruler className="h-7 w-7 text-muted-foreground mb-2 opacity-60" />
              <p className="text-sm font-medium text-foreground">
                Log waist measurements weekly (Sunday morning)
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                2+ weeks of waist readings unlock your abdominal fat-loss trend
              </p>
            </div>
          ) : (
            <div className="h-[230px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={waistTrend.points}
                  margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                  <XAxis dataKey="weekKey" tick={{ fontSize: 11 }} />
                  <YAxis
                    domain={['dataMin - 0.5', 'dataMax + 0.5']}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value: unknown) => [`${value}"`, 'Waist']}
                  />
                  {profile?.targetWaistInches != null && (
                    <ReferenceLine
                      y={profile.targetWaistInches}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="waistInches"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
