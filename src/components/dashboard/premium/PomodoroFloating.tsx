'use client';

import dynamic from 'next/dynamic';
import { AnimatePresence } from 'framer-motion';
import { usePomodoroController } from './pomodoro/usePomodoroController';
import { PomodoroExpandedPanel } from './pomodoro/PomodoroExpandedPanel';
import { PomodoroCollapsedPills } from './pomodoro/PomodoroTimerControls';

const AddTransactionModal = dynamic(
  () => import('@/components/finance/AddTransactionModal').then((m) => ({ default: m.AddTransactionModal })),
  { ssr: false }
);

export function PomodoroFloating() {
  const {
    store,
    feedback,
    isExpanded,
    setIsExpanded,
    showExpenseModal,
    setShowExpenseModal,
    isEditingTime,
    setIsEditingTime,
    customMinutes,
    setCustomMinutes,
    isAppRoute,
    activeColor,
  } = usePomodoroController();

  if (!isAppRoute) return null;

  return (
    <>
      <div className="fixed bottom-[76px] right-4 md:bottom-6 md:right-6 z-50 select-none flex flex-col items-end gap-2.5">
        <AnimatePresence mode="wait">
          {isExpanded ? (
            <PomodoroExpandedPanel
              mode={store.mode}
              activeColor={activeColor}
              activeTaskTitle={store.activeTaskTitle}
              timeLeft={store.timeLeft}
              isRunning={store.isRunning}
              completedSessions={store.completedSessions}
              pendingUrgeReflection={store.pendingUrgeReflection}
              urgeHabitName={store.urgeHabitName}
              isEditingTime={isEditingTime}
              customMinutes={customMinutes}
              setCustomMinutes={setCustomMinutes}
              setIsEditingTime={setIsEditingTime}
              adjustDuration={store.adjustDuration}
              resolveUrgeReflection={store.resolveUrgeReflection}
              startPresetTimer={store.startPresetTimer}
              setMode={store.setMode}
              resetTimer={store.resetTimer}
              pauseTimer={store.pauseTimer}
              resumeTimer={store.resumeTimer}
              onMinimize={() => setIsExpanded(false)}
              feedback={feedback}
            />
          ) : (
            <PomodoroCollapsedPills
              mode={store.mode}
              timeLeft={store.timeLeft}
              isRunning={store.isRunning}
              pendingUrgeReflection={store.pendingUrgeReflection}
              activeColor={activeColor}
              onOpenExpense={() => setShowExpenseModal(true)}
              onExpand={() => setIsExpanded(true)}
            />
          )}
        </AnimatePresence>
      </div>
      {showExpenseModal && <AddTransactionModal open={showExpenseModal} onOpenChange={setShowExpenseModal} />}
    </>
  );
}
