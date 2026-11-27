'use client';

import { useRef } from 'react';
import { useTheme } from '@/providers/theme-provider';
import { LandingAutoPlayBanner, LandingFooter, LandingHeader, LandingHeroZone } from './sections/LandingHeaderAndHero';
import { LandingShowcaseSection } from './sections/LandingShowcaseSection';
import { LandingSimulatorSection } from './sections/LandingSimulatorSection';
import { LandingCtaSection, LandingDeepWorkFeatures, LandingFocusHubSection } from './sections/LandingFocusAndFeatures';
import { useLandingDemoState } from './sections/useLandingDemoState';

export function LandingPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const pageRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);
  const focusHubRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const simulatorRef = useRef<HTMLDivElement>(null);

  const demo = useLandingDemoState({ mockupRef, focusHubRef, simulatorRef });

  return (
    <div ref={pageRef} className="landing-mesh min-h-screen relative overflow-x-hidden flex flex-col font-sans text-foreground transition-colors duration-300">
      <style jsx global>{`
        .perspective-container { perspective: 1000px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <LandingHeader isDark={isDark} onToggleTheme={() => setTheme(isDark ? 'light' : 'dark')} />

      <div className="flex-grow pt-24 flex flex-col items-center">
        <LandingHeroZone />

        <LandingAutoPlayBanner
          isDemoActive={demo.isDemoActive}
          onToggle={() => {
            const next = !demo.isDemoActive;
            demo.setIsDemoActive(next);
            if (next) demo.setDemoStep(0);
          }}
        />

        <LandingShowcaseSection
          mockupRef={mockupRef}
          rotateX={demo.mockupRotateX}
          translateY={demo.mockupTranslateY}
          scale={demo.mockupScale}
          opacity={demo.mockupOpacity}
          mockHabits={demo.mockHabits}
          mockRoutines={demo.mockRoutines}
          mockGraphRange={demo.mockGraphRange}
          floatingFeedbacks={demo.floatingFeedbacks}
          onToggleHabit={demo.handleToggleMockHabit}
          onToggleRoutine={demo.handleToggleMockRoutine}
          onChangeRange={(r) => { demo.handleManualInteraction(); demo.setMockGraphRange(r); }}
        />

        <LandingSimulatorSection
          simulatorRef={simulatorRef}
          companionDialogue={demo.companionDialogue}
          flowStage={demo.flowStage}
          momentum={demo.momentum}
          activeTab={demo.activeTab}
          completedHabits={demo.completedHabits}
          completedTasks={demo.completedTasks}
          completedTotal={demo.completedTotal}
          showFlowComplete={demo.showFlowComplete}
          floatingFeedbacks={demo.floatingFeedbacks}
          onCompanionClick={() => demo.handleCompanionClick(null)}
          onSelectTab={(tab) => { demo.handleManualInteraction(); demo.setActiveTab(tab); }}
          onCompleteHabit={demo.handleCompleteHabit}
          onCompleteTask={demo.handleCompleteTask}
        />

        <LandingFocusHubSection
          focusHubRef={focusHubRef}
          pomodoroSeconds={demo.pomodoroSeconds}
          isTimerRunning={demo.isTimerRunning}
          pomodoroScrollOffset={demo.pomodoroScrollOffset}
          onToggleTimer={() => {
            if (!demo.isTimerRunning) demo.handleManualInteraction();
            demo.setIsTimerRunning(!demo.isTimerRunning);
          }}
          onResetTimer={() => { demo.setIsTimerRunning(false); demo.setPomodoroSeconds(1500); }}
        />

        <LandingDeepWorkFeatures featuresRef={featuresRef} isDark={isDark} />
        <LandingCtaSection />
      </div>

      <LandingFooter />
    </div>
  );
}
