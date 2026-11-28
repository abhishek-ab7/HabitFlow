'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import type {
  YearInReviewFinanceProps,
  YearInReviewFitnessProps,
} from '@/lib/analytics/year-in-review-metrics';
import { useYearInReviewController } from './year-in-review/useYearInReviewController';
import {
  WrappedSlideFooter,
  WrappedSlideHeader,
  WrappedSlideProgressBar,
} from './year-in-review/YearInReviewChrome';
import { cn } from '@/lib/utils';

export type { YearInReviewFinanceProps, YearInReviewFitnessProps };

interface YearInReviewProps {
  financeSummary?: YearInReviewFinanceProps;
  fitnessSummary?: YearInReviewFitnessProps;
}

export function YearInReview({ financeSummary, fitnessSummary }: YearInReviewProps = {}) {
  const c = useYearInReviewController({ financeSummary, fitnessSummary });

  return (
    <Card ref={c.cardRef} className="border border-border/60 bg-card rounded-2xl shadow-xl overflow-hidden max-w-md mx-auto relative h-[520px]">
      <div className={cn('absolute inset-0 bg-gradient-to-b transition-all duration-1000 ease-in-out opacity-90', c.activeSlide.gradient)} />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <WrappedSlideProgressBar totalSlides={c.totalSlides} currentSlide={c.currentSlide} progress={c.progress} />

      <div className="absolute inset-x-0 top-12 bottom-12 z-10 flex hide-in-share">
        <div onClick={c.handlePrev} className="w-1/3 h-full cursor-w-resize" title="Previous slide" />
        <div onClick={() => c.setIsPlaying(!c.isPlaying)} className="w-1/3 h-full cursor-pointer" title={c.isPlaying ? 'Pause' : 'Resume'} />
        <div onClick={c.handleNext} className="w-1/3 h-full cursor-e-resize" title="Next slide" />
      </div>

      <WrappedSlideHeader
        subtitle={c.activeSlide.subtitle}
        title={c.activeSlide.title}
        isPlaying={c.isPlaying}
        onTogglePlay={() => c.setIsPlaying(!c.isPlaying)}
      />

      <div className="absolute inset-0 pt-16 pb-12 flex flex-col justify-center z-20 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={c.currentSlide}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.3 }}
            className="h-full w-full"
          >
            {c.activeSlide.content}
          </motion.div>
        </AnimatePresence>
      </div>

      <WrappedSlideFooter
        currentSlide={c.currentSlide}
        totalSlides={c.totalSlides}
        onPrev={c.handlePrev}
        onNext={c.handleNext}
      />
    </Card>
  );
}
