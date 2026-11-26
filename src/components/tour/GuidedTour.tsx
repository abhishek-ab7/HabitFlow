'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TourStep } from './tour-definitions';

export interface GuidedTourProps {
  tourKey: string;
  pageTitle: string;
  welcomeTitle?: string;
  welcomeDescription?: string;
  welcomeBenefit?: string;
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  startImmediately?: boolean;
}

function findVisibleTargetElement(targetSelector: string): HTMLElement | null {
  const selectors = targetSelector.split(',').map((s) => s.trim());
  for (const selector of selectors) {
    const found = document.querySelector(selector) as HTMLElement | null;
    if (found && found.offsetParent !== null) return found;
  }
  return null;
}

function buildScrolledRect(rect: DOMRect): DOMRect {
  const elementTop = rect.top + window.scrollY;
  const elementLeft = rect.left + window.scrollX;
  const padding = 100;
  const isFullyVisible =
    rect.top >= padding &&
    rect.bottom <= window.innerHeight - padding &&
    rect.left >= 0 &&
    rect.right <= window.innerWidth;

  let safeScrollY = window.scrollY;
  if (!isFullyVisible) {
    const targetScrollY = elementTop - window.innerHeight / 2 + rect.height / 2;
    const maxScrollY = document.documentElement.scrollHeight - window.innerHeight;
    safeScrollY = Math.max(0, Math.min(targetScrollY, maxScrollY));
    window.scrollTo({ top: safeScrollY, behavior: 'smooth' });
  }

  const finalTop = elementTop - safeScrollY;
  const finalLeft = elementLeft - window.scrollX;
  return {
    x: finalLeft,
    y: finalTop,
    width: rect.width,
    height: rect.height,
    top: finalTop,
    bottom: finalTop + rect.height,
    left: finalLeft,
    right: finalLeft + rect.width,
    toJSON: () => {},
  } as DOMRect;
}

export function GuidedTour({
  tourKey,
  pageTitle,
  welcomeTitle = `Welcome to ${pageTitle}! 🚀`,
  welcomeDescription = `Take a short interactive walkthrough to master the key features of ${pageTitle}.`,
  welcomeBenefit = 'Complete this quick tour to learn core mechanics, shortcuts, and best practices.',
  steps,
  isOpen,
  onClose,
  onComplete,
  startImmediately = false,
}: GuidedTourProps) {
  const [showPrompt, setShowPrompt] = useState(!startImmediately);
  const [currentStep, setCurrentStep] = useState(0);
  const [activeRect, setActiveRect] = useState<DOMRect | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const isTransitioningRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize responsive state & sound preferences
  useEffect(() => {
    setIsDesktop(window.innerWidth >= 768);
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);

    try {
      const feedbackSettings = localStorage.getItem('feedback_settings');
      if (feedbackSettings) {
        setAudioEnabled(JSON.parse(feedbackSettings).sound !== false);
      }
    } catch (e) {}

    return () => {
      window.removeEventListener('resize', handleResize);
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  // Reset step when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setShowPrompt(!startImmediately);
    }
  }, [isOpen, startImmediately]);

  // Audio chimes synthesized via Web Audio API
  const playTourSound = useCallback((type: 'pop' | 'success' | 'close') => {
    if (!audioEnabled) return;
    try {
      const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtor) return;
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtor();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
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
      // Audio fallback
    }
  }, [audioEnabled]);

  const currentStepData = steps[currentStep] || steps[0];

  // Auto-scroll and target coordinate calculation
  useEffect(() => {
    if (!isOpen || showPrompt || !currentStepData) return;

    const updateCoordinates = (forceScroll = false) => {
      if (currentStepData.target === 'body') {
        setActiveRect(null);
        return;
      }

      const element = findVisibleTargetElement(currentStepData.target);
      const rect = element?.getBoundingClientRect();
      if (!element || !rect || rect.width <= 0 || rect.height <= 0) {
        setActiveRect(null);
        return;
      }

      if (!forceScroll) {
        if (!isTransitioningRef.current) setActiveRect(rect);
        return;
      }

      isTransitioningRef.current = true;
      setActiveRect(buildScrolledRect(rect));
      if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = setTimeout(() => {
        transitionTimeoutRef.current = null;
        isTransitioningRef.current = false;
        setActiveRect(element.getBoundingClientRect());
      }, 600);
    };

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
  }, [isOpen, showPrompt, currentStep, currentStepData]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return handleSkipOrClose();
      if (showPrompt) return;
      if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft' && currentStep > 0) handleBack();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showPrompt, currentStep, steps.length]);

  const handleStartTour = () => {
    playTourSound('pop');
    setShowPrompt(false);
  };

  const handleSkipOrClose = () => {
    playTourSound('close');
    try {
      localStorage.setItem(`habitflow_tour_${tourKey}_completed`, 'true');
      if (tourKey === 'dashboard') {
        localStorage.setItem('habitflow_dashboard_tutorial_completed', 'true');
      }
    } catch (e) {}
    onClose();
    if (onComplete) onComplete();
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      playTourSound('pop');
      setCurrentStep((prev) => prev + 1);
    } else {
      playTourSound('success');
      try {
        localStorage.setItem(`habitflow_tour_${tourKey}_completed`, 'true');
        if (tourKey === 'dashboard') {
          localStorage.setItem('habitflow_dashboard_tutorial_completed', 'true');
        }
      } catch (e) {}
      onClose();
      if (onComplete) onComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      playTourSound('pop');
      setCurrentStep((prev) => prev - 1);
    }
  };

  const toggleSoundPreference = () => {
    const nextVal = !audioEnabled;
    setAudioEnabled(nextVal);
    try {
      const feedbackSettings = localStorage.getItem('feedback_settings');
      let current = {};
      if (feedbackSettings) {
        current = JSON.parse(feedbackSettings);
      }
      localStorage.setItem('feedback_settings', JSON.stringify({ ...current, sound: nextVal }));
    } catch (e) {}
  };

function clampCoordinate(value: number, size: number, viewportSize: number) {
  return Math.max(16, Math.min(value, viewportSize - size - 16));
}

function computeTooltipPosition(activeRect: DOMRect | null, placement?: string) {
  const windowHeight = window.innerHeight;
  const windowWidth = window.innerWidth;
  const tooltipWidth = Math.min(360, windowWidth - 32);
  const tooltipHeight = 280;

  if (!activeRect) {
    return {
      top: `${Math.max(16, windowHeight / 2 - tooltipHeight / 2)}px`,
      left: `${Math.max(16, windowWidth / 2 - tooltipWidth / 2)}px`,
      width: `${tooltipWidth}px`,
    };
  }

  const spaceBelow = windowHeight - activeRect.bottom;
  const spaceAbove = activeRect.top;
  const placeBelow =
    placement === 'bottom'
      ? spaceBelow > tooltipHeight + 20
      : placement === 'top'
        ? !(spaceAbove > tooltipHeight + 20)
        : spaceBelow > spaceAbove;

  const rawTop = placeBelow ? activeRect.bottom + 12 : activeRect.top - tooltipHeight - 12;
  const rawLeft = activeRect.left + activeRect.width / 2 - tooltipWidth / 2;

  return {
    top: `${clampCoordinate(rawTop, tooltipHeight, windowHeight)}px`,
    left: `${clampCoordinate(rawLeft, tooltipWidth, windowWidth)}px`,
    width: `${tooltipWidth}px`,
  };
}

  // Tooltip position calculation
  const getTooltipStyle = () => computeTooltipPosition(activeRect, currentStepData.placement);

  const getArrowDetails = () => {
    if (!activeRect) return null;

    const windowHeight = window.innerHeight;
    const tooltipHeight = 280;
    const tooltipStyle = getTooltipStyle();
    const tooltipWidth = parseFloat(tooltipStyle.width);

    const spaceBelow = windowHeight - activeRect.bottom;
    const spaceAbove = activeRect.top;

    let isBelow = true;
    if (currentStepData.placement === 'bottom' && spaceBelow > tooltipHeight + 20) {
      isBelow = true;
    } else if (currentStepData.placement === 'top' && spaceAbove > tooltipHeight + 20) {
      isBelow = false;
    } else {
      isBelow = spaceBelow > spaceAbove;
    }

    const cardLeft = parseFloat(tooltipStyle.left);
    const elementCenter = activeRect.left + activeRect.width / 2;
    let arrowLeft = elementCenter - cardLeft;
    arrowLeft = Math.max(24, Math.min(tooltipWidth - 24, arrowLeft));

    return {
      isBelow,
      left: `${arrowLeft}px`,
    };
  };

  if (!isOpen) return null;

  const arrowDetails = getArrowDetails();

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
              <mask id={`tour-cutout-${tourKey}`}>
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                <rect
                  x={activeRect.x - 6}
                  y={activeRect.y - 6}
                  width={activeRect.width + 12}
                  height={activeRect.height + 12}
                  rx="14"
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(0, 0, 0, 0.72)"
              mask={`url(#tour-cutout-${tourKey})`}
            />
            {/* Soft highlight border glow */}
            <rect
              x={activeRect.x - 6}
              y={activeRect.y - 6}
              width={activeRect.width + 12}
              height={activeRect.height + 12}
              rx="14"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              className="animate-pulse"
            />
          </motion.svg>
        )}
      </AnimatePresence>

      {/* Dark overlay backdrop for prompt or fallback */}
      <AnimatePresence>
        {(showPrompt || !activeRect) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[1001]"
            onClick={showPrompt ? handleSkipOrClose : undefined}
          />
        )}
      </AnimatePresence>

      <div className="relative min-h-screen z-[1002] pointer-events-none">
        <AnimatePresence mode="wait">
          {/* STEP 0: FIRST-TIME PROMPT DIALOG */}
          {showPrompt ? (
            <div className="fixed inset-0 flex items-center justify-center p-4 z-[1003] pointer-events-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-md bg-card border border-border/80 shadow-2xl rounded-2xl p-6 relative overflow-hidden"
              >
                {/* Close Button */}
                <button
                  onClick={handleSkipOrClose}
                  className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Skip Tour"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    {pageTitle} Tour
                  </span>
                </div>

                <h3 className="text-xl font-extrabold tracking-tight text-foreground mb-2">
                  {welcomeTitle}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                  {welcomeDescription}
                </p>

                <div className="bg-primary/5 border border-primary/20 p-3 rounded-xl flex items-start gap-2.5 mb-6">
                  <span className="text-sm mt-0.5">💡</span>
                  <p className="text-[11px] text-primary font-medium leading-relaxed">
                    {welcomeBenefit}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSkipOrClose}
                    className="text-xs text-muted-foreground hover:text-foreground h-9"
                  >
                    Maybe Later
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleStartTour}
                    className="h-9 px-4 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-1.5 rounded-xl"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Start Tour
                  </Button>
                </div>
              </motion.div>
            </div>
          ) : (
            /* STEP 1..N: FLOATING SPOTLIGHT TOOLTIP */
            <motion.div
              ref={cardRef}
              style={getTooltipStyle()}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.2 }}
              className="fixed z-[1003] pointer-events-auto"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="bg-card border border-border shadow-2xl rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3 relative text-left"
                >
                  {/* Tooltip Connector Arrow */}
                  {arrowDetails && (
                    <div
                      className={cn(
                        'absolute w-3 h-3 bg-card border-border transform rotate-45 pointer-events-none',
                        arrowDetails.isBelow
                          ? '-top-1.5 border-t border-l'
                          : '-bottom-1.5 border-b border-r'
                      )}
                      style={{ left: arrowDetails.left }}
                    />
                  )}

                  {/* Header row: badge, sound toggle, skip/close */}
                  <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="p-1 rounded-md bg-primary/10 text-primary">
                        <HelpCircle className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                        {pageTitle} Tour
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={toggleSoundPreference}
                        className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                        title={audioEnabled ? 'Mute tour sound' : 'Enable tour sound'}
                        aria-label="Toggle Sound"
                      >
                        {audioEnabled ? (
                          <Volume2 className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <VolumeX className="w-3.5 h-3.5 opacity-50" />
                        )}
                      </button>

                      <button
                        onClick={handleSkipOrClose}
                        className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                        title="Skip Tour"
                        aria-label="Close Tour"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Body */}
                  <div className="space-y-1.5">
                    <h4 className="text-sm sm:text-base font-bold text-foreground leading-snug">
                      {currentStepData.title}
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {currentStepData.content}
                    </p>
                  </div>

                  {/* Benefit Card */}
                  <div className="bg-primary/5 border border-primary/20 p-2.5 rounded-xl flex items-start gap-2">
                    <span className="text-xs mt-0.5">💡</span>
                    <p className="text-[10px] text-primary font-semibold leading-relaxed">
                      {currentStepData.benefit}
                    </p>
                  </div>

                  {/* Navigation Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <div className="text-[10px] font-bold text-muted-foreground font-mono">
                      {currentStep + 1} / {steps.length}
                    </div>

                    <div className="flex gap-2">
                      {currentStep > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleBack}
                          className="h-8 rounded-xl text-xs font-semibold px-3 flex items-center gap-1 hover:bg-muted"
                        >
                          <ArrowLeft className="w-3 h-3" />
                          Prev
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={handleNext}
                        className="h-8 rounded-xl text-xs font-bold px-4 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs flex items-center gap-1"
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
export default GuidedTour;
