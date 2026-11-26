'use client';

import React from 'react';
import Link from 'next/link';
import {
  BookOpen, CheckSquare, ChevronDown, Download, Dumbbell, HelpCircle, LayoutDashboard, ListTodo, RefreshCw, RotateCcw, Target, Trash2, Upload, Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const TOUR_REPLAY_OPTIONS = [
  { key: 'dashboard', path: '/dashboard', label: 'Dashboard Tour', icon: LayoutDashboard, color: 'text-primary' },
  { key: 'habits', path: '/habits', label: 'Habits Consistency', icon: CheckSquare, color: 'text-emerald-500' },
  { key: 'tasks', path: '/tasks', label: 'Task Manager', icon: ListTodo, color: 'text-sky-500' },
  { key: 'goals', path: '/goals', label: 'Goals & Milestones', icon: Target, color: 'text-rose-500' },
  { key: 'fitness', path: '/fitness', label: 'Fitness & Body Hub', icon: Dumbbell, color: 'text-amber-500' },
  { key: 'finance', path: '/finance', label: 'Finance Hub', icon: Wallet, color: 'text-emerald-600' },
];

export function SettingsUtilityRow(params: {
  showDevTools: boolean;
  isForceSyncing: boolean;
  onResetAllTours: () => void;
  onReplayTour: (tourKey: string, path: string) => void;
  onForcePush: () => void;
  onForcePull: () => void;
  onOpenClearDialog: () => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      <section className={cn('rounded-2xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4', params.showDevTools ? 'lg:col-span-5' : 'lg:col-span-6')}>
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0"><HelpCircle className="h-4 w-4" /></div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground tracking-tight">Help &amp; Guides</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Replay interactive tours for any section or explore the complete Life OS Academy.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-3 text-xs gap-1.5 whitespace-nowrap" title="Select a tour to replay">
                <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                <span>Replay Tour</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl">
              <DropdownMenuLabel className="text-xs font-bold">Guided Tours</DropdownMenuLabel>
              <DropdownMenuItem onClick={params.onResetAllTours} className="gap-2 cursor-pointer font-medium text-primary">
                <RotateCcw className="h-4 w-4" /> <span>Reset All Tours</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {TOUR_REPLAY_OPTIONS.map((item) => (
                <DropdownMenuItem key={item.key} onClick={() => params.onReplayTour(item.key, item.path)} className="gap-2 cursor-pointer">
                  <item.icon className={cn('h-4 w-4', item.color)} />
                  <span>{item.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" asChild className="h-9 px-3 text-xs gap-1.5 whitespace-nowrap">
            <Link href="/tutorial"><BookOpen className="h-3.5 w-3.5 shrink-0" /> <span>Academy Guide</span></Link>
          </Button>
        </div>
      </section>

      {params.showDevTools && (
        <section className="lg:col-span-3 rounded-2xl border border-border bg-card p-5 flex flex-col justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground tracking-tight">Developer Sync</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Manual cloud override actions</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={params.onForcePush} disabled={params.isForceSyncing} className="h-9 px-2.5 text-xs gap-1.5 whitespace-nowrap" title="Overwrite Cloud Data">
              <Upload className="h-3.5 w-3.5 shrink-0" /> <span>Push</span>
            </Button>
            <Button variant="outline" size="sm" onClick={params.onForcePull} disabled={params.isForceSyncing} className="h-9 px-2.5 text-xs gap-1.5 whitespace-nowrap" title="Overwrite Local Data">
              <Download className="h-3.5 w-3.5 shrink-0" /> <span>Pull</span>
            </Button>
          </div>
        </section>
      )}

      <section className={cn('rounded-2xl border border-destructive/25 bg-destructive/5 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4', params.showDevTools ? 'lg:col-span-4' : 'lg:col-span-6')}>
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-destructive/15 text-destructive shrink-0"><Trash2 className="h-4 w-4" /></div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground tracking-tight">Danger Zone</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Permanently clear local habits, goals, and synced workspace data.</p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={params.onOpenClearDialog} className="h-9 px-4 text-xs font-medium whitespace-nowrap shrink-0">
          Reset All
        </Button>
      </section>
    </div>
  );
}
