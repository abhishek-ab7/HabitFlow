'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  HelpCircle, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  Play, 
  Check, 
  Volume2, 
  VolumeX,
  Keyboard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DashboardTourProps {
  onClose: () => void;
}

interface TourStep {
  target: string;
  title: string;
  content: string;
  benefit: string;
  placement: 'top' | 'bottom' | 'center';
}

export default function DashboardTour({ onClose }: DashboardTourProps) {
  const [showPrompt, setShowPrompt] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [activeRect, setActiveRect] = useState<DOMRect | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  
  const cardRef = useRef<HTMLDivElement>(null);
  const isTransitioningRef = useRef(false);

  // Initialize responsive state & sound preferences
  useEffect(() => {
    setIsDesktop(window.innerWidth >= 768);
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);

    const feedbackSettings = localStorage.getItem('feedback_settings');
    if (feedbackSettings) {
      try {
        setAudioEnabled(JSON.parse(feedbackSettings).sound !== false);
      } catch (e) {}
    }

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Soft premium UI chimes via Web Audio API
  const playTourSound = (type: 'pop' | 'success' | 'close') => {
    if (!audioEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'pop') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.setValueAtTime(780, ctx.currentTime + 0.08);
        osc.frequency.setValueAtTime(1040, ctx.currentTime + 0.16);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'close') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch (e) {
      console.warn('Audio synthesis failed:', e);
    }
  };

  // Build steps list dynamically based on device features (desktop shortcuts)
  const getTourSteps = (): TourStep[] => {
    const steps: TourStep[] = [
      {
        target: 'body',
        title: 'Welcome to HabitFlow! 🚀',
        content: 'HabitFlow is your gamified discipline workspace. Let\'s take a short interactive walkthrough to understand the workflow and tabs.',
        benefit: 'Complete this quick tour to learn the streak mechanics, shortcut keys, and tabs.',
        placement: 'center'
      },
      // 1. MINIMAL DASHBOARD STEPS
      {
        target: '.tour-hero-section',
        title: 'Dashboard Workspace 🏠',
        content: 'Your daily center. This displays your today\'s focus, habits grid, and helpful insights from your AI Coach.',
        benefit: 'Consolidates all high-level inputs in a single premium viewport.',
        placement: 'bottom'
      },
      {
        target: '.tour-momentum-card',
        title: 'Daily Progress & Streaks ⚡',
        content: 'Your Momentum Score updates live based on checked habits (60% weight) and completed tasks (40% weight). Log items consecutively to maintain streaks.',
        benefit: 'Stack streaks to earn Gems, XP, and keep your leveling progression active.',
        placement: 'bottom'
      },
      // 2. NAVBAR SECTIONS
      {
        target: '.tour-nav-dashboard, .tour-mobile-nav-dashboard',
        title: 'Dashboard Tab 🏠',
        content: 'Access your daily productivity logs, quick stats, and check-in panels in a single layout.',
        benefit: 'Your main routine checklist page.',
        placement: 'bottom'
      },
      {
        target: '.tour-nav-tasks, .tour-mobile-nav-tasks',
        title: 'Tasks Planner 📋',
        content: 'Create checklists, group by priority labels (High, Med, Low), set deadlines, and organize items via the Eisenhower Priority matrix.',
        benefit: 'Keeps your daily tasks clear and reduces decision fatigue.',
        placement: 'bottom'
      },
      {
        target: '.tour-nav-routines, .tour-mobile-nav-routines',
        title: 'Routine Builder 🌅',
        content: 'Build morning and evening stacks. Chain habits consecutively (habit stacking) to execute them smoothly.',
        benefit: 'Helps automate routines so you baseline your consistency early in the day.',
        placement: 'bottom'
      },
      {
        target: '.tour-nav-habits, .tour-mobile-nav-habits',
        title: 'Habits Consistency 🗓️',
        content: 'Set recurring habits, track Streaks, and write notes. If you are busy, freeze a habit (Right-click cell on Desktop or tap dropdown option on Mobile) to protect your streak. Freezing uses Streak Shields purchased in settings.',
        benefit: 'Streak Shield protection blocks streak resets so your hard work isn\'t lost.',
        placement: 'bottom'
      },
      {
        target: '.tour-nav-goals, .tour-mobile-nav-goals',
        title: '90-Day Goals 🎯',
        content: 'Set long-term life vision targets and outline sub-milestones to build focus loops.',
        benefit: 'Visual progress meters track sub-milestones towards your overall target.',
        placement: 'bottom'
      },
      {
        target: '.tour-nav-analytics, .tour-mobile-nav-analytics',
        title: 'Productivity Analytics 📊',
        content: 'Review consistency charts, check-in activity heatmaps, and unlock your comprehensive Sunday morning reviews.',
        benefit: 'Track historical trends to optimize your daily schedules.',
        placement: 'bottom'
      },
      {
        target: '.tour-nav-leaderboard, .tour-mobile-nav-leaderboard',
        title: 'Competitive Leaderboard 🏆',
        content: 'Earn XP, unlock custom badges, and compare scores with peers on weekly league leaderboards.',
        benefit: 'Gamified ranks maintain accountability and friendly discipline.',
        placement: 'bottom'
      }
    ];

    // Conditional: Add keyboard shortcuts step ONLY on desktop
    if (isDesktop) {
      steps.push({
        target: '.tour-nav-shortcuts',
        title: 'Keyboard Shortcuts ⌨️',
        content: 'Boost your tracking speed! Quickly trigger actions without taking your hands off the keyboard.',
        benefit: 'Press ? to toggle the shortcuts panel anytime.',
        placement: 'bottom'
      });
    }

    return steps;
  };

  const steps = getTourSteps();
  const currentStepData = steps[currentStep] || steps[0];

  // Auto Scroll, centering, and coordinates calculation hook
  useEffect(() => {
    if (showPrompt) return;

    const updateCoordinates = (forceScroll = false) => {
      if (currentStepData.target === 'body') {
        setActiveRect(null);
        return;
      }

      const element = document.querySelector(currentStepData.target) as HTMLElement;
      if (element) {
        const rect = element.getBoundingClientRect();
        
        if (rect.width > 0 && rect.height > 0) {
          if (forceScroll) {
            isTransitioningRef.current = true;
            
            // Calculate absolute page coordinates
            const elementTop = rect.top + window.scrollY;
            const elementLeft = rect.left + window.scrollX;
            const elementHeight = rect.height;
            
            // Intelligently center the target element vertically in the viewport
            const targetScrollY = elementTop - (window.innerHeight / 2) + (elementHeight / 2);
            const maxScrollY = document.documentElement.scrollHeight - window.innerHeight;
            const safeScrollY = Math.max(0, Math.min(targetScrollY, maxScrollY));
            
            // Smoothly scroll the window to focus
            window.scrollTo({ top: safeScrollY, behavior: 'smooth' });
            
            // Calculate what the viewport coordinates will be AFTER the smooth scroll completes
            const finalViewportTop = elementTop - safeScrollY;
            const finalViewportLeft = elementLeft - window.scrollX;
            
            const finalRect = {
              x: finalViewportLeft,
              y: finalViewportTop,
              width: rect.width,
              height: rect.height,
              top: finalViewportTop,
              bottom: finalViewportTop + rect.height,
              left: finalViewportLeft,
              right: finalViewportLeft + rect.width,
              toJSON: () => {}
            } as DOMRect;
            
            setActiveRect(finalRect);
            
            // Unblock coordinates recalculations after transition finishes
            setTimeout(() => {
              isTransitioningRef.current = false;
              const currentElement = document.querySelector(currentStepData.target);
              if (currentElement) {
                setActiveRect(currentElement.getBoundingClientRect());
              }
            }, 600);
          } else if (!isTransitioningRef.current) {
            setActiveRect(rect);
          }
        } else {
          setActiveRect(null);
        }
      } else {
        setActiveRect(null);
      }
    };

    // Calculate coordinates and trigger centering scroll instantly on step change
    updateCoordinates(true);

    const handleScrollOrResize = () => {
      if (!isTransitioningRef.current) {
        window.requestAnimationFrame(() => {
          updateCoordinates(false);
        });
      }
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize);
    };
  }, [currentStep, showPrompt, currentStepData.target]);

  const handleStartTour = () => {
    playTourSound('pop');
    setShowPrompt(false);
  };

  const handleSkipOrClose = () => {
    playTourSound('close');
    localStorage.setItem('habitflow_dashboard_tutorial_completed', 'true');
    onClose();
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      playTourSound('pop');
      setCurrentStep(prev => prev + 1);
    } else {
      playTourSound('success');
      localStorage.setItem('habitflow_dashboard_tutorial_completed', 'true');
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      playTourSound('pop');
      setCurrentStep(prev => prev - 1);
    }
  };

  const getTooltipStyle = () => {
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const tooltipWidth = 340; // Tooltip card width
    const tooltipHeight = 260; // Tooltip card height

    let top = 0;
    let left = 0;

    if (!activeRect) {
      top = windowHeight / 2 - tooltipHeight / 2;
      left = windowWidth / 2 - tooltipWidth / 2;
      return {
        top: `${top}px`,
        left: `${left}px`,
      };
    }

    const spaceBelow = windowHeight - activeRect.bottom;
    const spaceAbove = activeRect.top;

    if (currentStepData.placement === 'bottom' && spaceBelow > tooltipHeight + 20) {
      top = activeRect.bottom + 12;
    } else if (currentStepData.placement === 'top' && spaceAbove > tooltipHeight + 20) {
      top = activeRect.top - tooltipHeight - 12;
    } else {
      // Auto-fallback
      if (spaceBelow > spaceAbove) {
        top = activeRect.bottom + 12;
      } else {
        top = activeRect.top - tooltipHeight - 12;
      }
    }

    // Keep top coordinate within viewport boundaries
    if (top < 16) top = 16;
    if (top + tooltipHeight > windowHeight - 16) {
      top = windowHeight - tooltipHeight - 16;
    }

    // Center horizontally
    left = activeRect.left + activeRect.width / 2 - tooltipWidth / 2;

    // Boundary protection
    if (left < 16) left = 16;
    if (left + tooltipWidth > windowWidth - 16) {
      left = windowWidth - tooltipWidth - 16;
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
    };
  };

  const toggleSoundPreference = () => {
    const nextVal = !audioEnabled;
    setAudioEnabled(nextVal);
    const feedbackSettings = localStorage.getItem('feedback_settings');
    let current = {};
    if (feedbackSettings) {
      try {
        current = JSON.parse(feedbackSettings);
      } catch (e) {}
    }
    localStorage.setItem('feedback_settings', JSON.stringify({ ...current, sound: nextVal }));
  };

  return (
    <div className="fixed inset-0 z-[1000] overflow-y-auto">
      {/* Dynamic SVG Spotlight Cutout Mask */}
      <AnimatePresence>
        {!showPrompt && activeRect && (
          <motion.svg 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 w-full h-full pointer-events-none z-[1001]"
          >
            <defs>
              <mask id="tour-spotlight-cutout">
                {/* Fully covers screen in solid white */}
                <rect width="100%" height="100%" fill="white" />
                {/* Spotlight hole in black (cutout) */}
                <motion.rect
                  animate={{
                    x: activeRect.x - 8,
                    y: activeRect.y - 8,
                    width: activeRect.width + 16,
                    height: activeRect.height + 16
                  }}
                  transition={{ type: 'spring', damping: 28, stiffness: 180 }}
                  rx="16"
                  fill="black"
                />
              </mask>
            </defs>
            {/* Masked Backdrop overlay */}
            <rect
              width="100%"
              height="100%"
              fill="rgba(0, 0, 0, 0.45)"
              className="backdrop-blur-[1px]"
              mask="url(#tour-spotlight-cutout)"
              style={{ pointerEvents: 'auto' }}
            />
          </motion.svg>
        )}
      </AnimatePresence>

      {/* Screen Backdrop if no active element or showPrompt */}
      {(showPrompt || !activeRect) && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1001]" 
          onClick={handleSkipOrClose}
        />
      )}

      {/* Main Tour Elements */}
      <div className="relative w-full h-full min-h-screen">
        <AnimatePresence mode="wait">
          {showPrompt ? (
            /* Prompt Invitation Modal */
            <motion.div
              key="prompt"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-card/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/10 dark:border-white/5 rounded-3xl p-6 md:p-8 shadow-2xl z-[1050] text-center space-y-6"
            >
              <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                <HelpCircle className="w-8 h-8 animate-pulse" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-foreground tracking-tight">Quick Platform Tour?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Would you like a quick interactive tour of your new workspace? We will highlight major widgets and show you how to start building consistency!
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={handleSkipOrClose}
                  className="flex-1 rounded-xl h-11 border-border/80 text-muted-foreground hover:bg-muted font-bold text-xs uppercase tracking-wider"
                >
                  Skip Tour
                </Button>
                <Button
                  onClick={handleStartTour}
                  className="flex-1 rounded-xl h-11 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs uppercase tracking-wider shadow-lg shadow-primary/25"
                >
                  Start Tour
                  <Play className="w-3.5 h-3.5 ml-1.5 fill-current" />
                </Button>
              </div>
            </motion.div>
          ) : (
            /* Tooltip Step Dialog Card (slides smoothly between targets) */
            <motion.div
              key="tour-card"
              ref={cardRef}
              style={{
                position: 'absolute' as const,
                zIndex: 1050,
              }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                ...getTooltipStyle()
              }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 28, stiffness: 180 }}
              className="w-[340px] bg-card/95 dark:bg-slate-900/95 backdrop-blur-xl border border-white/10 dark:border-white/5 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-left border-indigo-500/20"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col gap-4 w-full h-full"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between pb-1 border-b border-border/40">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-500 fill-current" />
                      <span className="text-[11px] font-black uppercase text-indigo-500 tracking-wider">
                        Tutorial Tour
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/* Sound Toggle */}
                      <button
                        onClick={toggleSoundPreference}
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                        title={audioEnabled ? "Disable sound" : "Enable sound"}
                      >
                        {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                      </button>
                      {/* Close button */}
                      <button 
                        onClick={handleSkipOrClose}
                        className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Body */}
                  <div className="space-y-1.5">
                    <h4 className="text-base font-bold text-foreground leading-snug">
                      {currentStepData.title}
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {currentStepData.content}
                    </p>
                    
                    {/* Render Keyboard Shortcuts custom UI block on desktop */}
                    {currentStepData.target === '.tour-nav-shortcuts' && (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3 pt-3 border-t border-border/40 text-[11px] font-medium text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>Quick Add Task</span>
                          <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[10px] font-mono font-bold shadow-sm">N</kbd>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Command Menu</span>
                          <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[10px] font-mono font-bold shadow-sm">S</kbd>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Navigate Tabs</span>
                          <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[10px] font-mono font-bold shadow-sm">1-7</kbd>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Toggle Task</span>
                          <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[10px] font-mono font-bold shadow-sm">Space</kbd>
                        </div>
                        <div className="flex items-center justify-between col-span-2 mt-1 pt-1 border-t border-dashed border-border/30">
                          <span>Open Help / Academy</span>
                          <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[10px] font-mono font-bold shadow-sm">?</kbd>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Gamified Benefit Box */}
                  <div className="bg-indigo-500/5 dark:bg-indigo-400/5 border border-indigo-500/10 p-3 rounded-xl flex items-start gap-2">
                    <span className="text-sm mt-0.5">💡</span>
                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold leading-relaxed">
                      {currentStepData.benefit}
                    </p>
                  </div>

                  {/* Navigation Actions */}
                  <div className="flex items-center justify-between mt-1 pt-3 border-t border-border/40">
                    {/* Step indicators */}
                    <div className="text-[10px] font-bold text-muted-foreground font-mono">
                      {currentStep + 1} / {steps.length}
                    </div>

                    <div className="flex gap-2">
                      {currentStep > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleBack}
                          className="h-8 rounded-lg text-xs font-semibold px-3 flex items-center gap-1 hover:bg-muted"
                        >
                          <ArrowLeft className="w-3 h-3" />
                          Prev
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={handleNext}
                        className="h-8 rounded-lg text-xs font-bold px-4 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/25 flex items-center gap-1"
                      >
                        {currentStep === steps.length - 1 ? (
                          <>
                            Finish
                            <Check className="w-3.5 h-3.5 ml-0.5" />
                          </>
                        ) : (
                          <>
                            Next
                            <ArrowRight className="w-3 h-3 ml-0.5" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
