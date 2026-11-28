'use client';

import { motion } from 'framer-motion';
import {
  X,
  Timer,
  Coffee,
  Plus,
  Minus,
  Check,
  ShieldCheck,
  Dumbbell,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import type { PomodoroMode } from '@/lib/stores/pomodoro-store';
import type { useFeedback } from '@/hooks/use-feedback';
import {
  MODE_COLORS,
  MODE_LABELS,
  MODE_PILL_SHORT,
  formatTimerDisplay,
} from '@/lib/pomodoro/pomodoro-helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const MODE_ICON_MAP: Record<PomodoroMode, typeof Timer> = {
  focus: Timer,
  short_break: Coffee,
  long_break: Coffee,
  gym_rest: Dumbbell,
  urge_10m: ShieldCheck,
  starter_2m: Zap,
};

export function ModeIcon({ mode, colorClass }: { mode: PomodoroMode; colorClass: string }) {
  const Icon = MODE_ICON_MAP[mode];
  return <Icon className={cn('h-4 w-4', colorClass)} />;
}

export function UrgeReflectionPrompt({
  urgeHabitName,
  onResolve,
  feedback,
}: {
  urgeHabitName: string | null | undefined;
  onResolve: (outcome: 'passed' | 'gave_in') => void;
  feedback: ReturnType<typeof useFeedback>;
}) {
  return (
    <div className="rounded-xl border border-violet-500/35 bg-violet-500/10 p-3 space-y-2.5">
      <div className="flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-foreground">10-Min Urge Timer Done</p>
          <p className="text-[11px] text-muted-foreground">
            {urgeHabitName ? `Did you hold strong on "${urgeHabitName}"?` : 'Did the craving pass?'}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          size="sm"
          className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1"
          onClick={() => {
            feedback.complete();
            onResolve('passed');
            toast.success('Craving passed! Streak protected.');
          }}
        >
          <Check className="h-3.5 w-3.5" /> Craving Passed
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-semibold gap-1"
          onClick={() => {
            feedback.warning();
            onResolve('gave_in');
            toast.info('Logged honestly — reset and go again.');
          }}
        >
          <AlertTriangle className="h-3.5 w-3.5" /> Gave In
        </Button>
      </div>
    </div>
  );
}

function PomodoroDurationEditor({
  customMinutes,
  setCustomMinutes,
  onSave,
  onCancel,
}: {
  customMinutes: number;
  setCustomMinutes: (m: number) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min="1"
        max="180"
        value={customMinutes}
        onChange={(e) => setCustomMinutes(Math.max(1, Math.min(180, parseInt(e.target.value, 10) || 1)))}
        className="w-20 text-center text-2xl font-bold font-mono bg-muted/50 border-border h-10"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave();
          else if (e.key === 'Escape') onCancel();
        }}
      />
      <Button size="icon" className="h-9 w-9 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg" onClick={onSave} title="Save duration">
        <Check className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="outline" className="h-9 w-9 rounded-lg" onClick={onCancel} title="Cancel">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function PomodoroReadoutRow({
  timeLeft,
  isRunning,
  onStepDown,
  onStepUp,
  onStartEdit,
}: {
  timeLeft: number;
  isRunning: boolean;
  onStepDown: () => void;
  onStepUp: () => void;
  onStartEdit: () => void;
}) {
  return (
    <div className="flex items-center gap-3 group">
      {!isRunning && (
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 rounded-full opacity-75 md:opacity-0 md:group-hover:opacity-100 transition-all"
          onClick={onStepDown}
          title="Decrease duration"
        >
          <Minus className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </Button>
      )}
      <div
        className={cn(
          'text-4xl font-extrabold font-mono tracking-tight text-foreground tabular-nums select-all',
          !isRunning && 'cursor-pointer hover:text-primary transition-colors'
        )}
        onClick={onStartEdit}
        title={!isRunning ? 'Click to edit duration' : undefined}
      >
        {formatTimerDisplay(timeLeft)}
      </div>
      {!isRunning && (
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 rounded-full opacity-75 md:opacity-0 md:group-hover:opacity-100 transition-all"
          onClick={onStepUp}
          title="Increase duration"
        >
          <Plus className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </Button>
      )}
    </div>
  );
}

export function PomodoroTimerDisplay(props: {
  mode: PomodoroMode;
  timeLeft: number;
  isRunning: boolean;
  isEditingTime: boolean;
  customMinutes: number;
  setCustomMinutes: (m: number) => void;
  setIsEditingTime: (v: boolean) => void;
  adjustDuration: (deltaSecs: number) => void;
}) {
  const { mode, timeLeft, isRunning, isEditingTime, customMinutes, setCustomMinutes, setIsEditingTime, adjustDuration } = props;
  const commitCustomMinutes = () => {
    const mins = Math.max(1, Math.min(180, customMinutes));
    adjustDuration(mins * 60 - timeLeft);
    setIsEditingTime(false);
    toast.success(`Duration set to ${mins}m`);
  };

  const handleStepDown = () => {
    const step = mode === 'gym_rest' ? -15 : -60;
    const minAllowed = mode === 'gym_rest' ? 15 : 60;
    if (timeLeft > minAllowed) adjustDuration(step);
    else toast.error(`Minimum duration is ${minAllowed}s`);
  };

  const handleStepUp = () => {
    const step = mode === 'gym_rest' ? 15 : 60;
    if (timeLeft < 180 * 60) adjustDuration(step);
  };

  const handleStartEdit = () => {
    if (isRunning) return;
    setIsEditingTime(true);
    setCustomMinutes(Math.max(1, Math.floor(timeLeft / 60)));
  };

  return (
    <div className="flex flex-col items-center justify-center py-1 relative">
      {isEditingTime ? (
        <PomodoroDurationEditor
          customMinutes={customMinutes}
          setCustomMinutes={setCustomMinutes}
          onSave={commitCustomMinutes}
          onCancel={() => setIsEditingTime(false)}
        />
      ) : (
        <PomodoroReadoutRow
          timeLeft={timeLeft}
          isRunning={isRunning}
          onStepDown={handleStepDown}
          onStepUp={handleStepUp}
          onStartEdit={handleStartEdit}
        />
      )}
      <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mt-1">
        {MODE_LABELS[mode]}
      </div>
    </div>
  );
}
export function PomodoroCollapsedPills({
  mode,
  timeLeft,
  isRunning,
  pendingUrgeReflection,
  activeColor,
  onOpenExpense,
  onExpand,
}: {
  mode: PomodoroMode;
  timeLeft: number;
  isRunning: boolean;
  pendingUrgeReflection: boolean;
  activeColor: (typeof MODE_COLORS)[PomodoroMode];
  onOpenExpense: () => void;
  onExpand: () => void;
}) {
  const pillText = isRunning
    ? `${MODE_PILL_SHORT[mode]} ${formatTimerDisplay(timeLeft)}`
    : pendingUrgeReflection
      ? 'Reflect'
      : 'Timer';

  return (
    <div key="collapsed-controls" className="flex flex-col items-end gap-2">
      <motion.button
        type="button"
        data-testid="quick-expense-lightning-pill"
        onClick={onOpenExpense}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.94 }}
        aria-label="Add expense entry"
        className="inline-flex items-center justify-center h-11 w-11 rounded-full border border-primary/35 shadow-lg bg-card md:bg-card/95 md:backdrop-blur-xl text-primary transition-colors hover:border-primary/60 hover:bg-primary/10"
      >
        <Zap className="h-4 w-4 fill-primary/20" />
      </motion.button>
      <motion.button
        type="button"
        data-testid="pomodoro-live-pill"
        onClick={onExpand}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.96 }}
        aria-label={isRunning ? `${MODE_LABELS[mode]} ${formatTimerDisplay(timeLeft)} remaining` : 'Open Focus & Habit Timers'}
        className={cn(
          'inline-flex items-center gap-2 h-11 rounded-full border shadow-lg bg-card md:bg-card/95 md:backdrop-blur-xl text-foreground transition-colors hover:border-primary/40',
          isRunning ? 'px-3.5 ring-2 ring-primary/15' : 'px-3',
          activeColor.border
        )}
      >
        <span className="relative flex items-center justify-center">
          <ModeIcon mode={mode} colorClass={activeColor.text} />
          {isRunning && <span className={cn('absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full animate-ping', activeColor.dot)} />}
        </span>
        <span className="text-xs font-semibold font-mono tabular-nums">{pillText}</span>
      </motion.button>
    </div>
  );
}
