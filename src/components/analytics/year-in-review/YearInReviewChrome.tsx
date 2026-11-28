'use client';

import { ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react';

export function WrappedSlideProgressBar({
  totalSlides,
  currentSlide,
  progress,
}: {
  totalSlides: number;
  currentSlide: number;
  progress: number;
}) {
  return (
    <div className="absolute top-4 left-4 right-4 flex gap-1.5 z-30 hide-in-share">
      {Array.from({ length: totalSlides }).map((_, idx) => {
        const width = idx < currentSlide ? '100%' : idx === currentSlide ? `${progress}%` : '0%';
        return (
          <div key={idx} className="h-1 bg-white/20 flex-1 rounded-full overflow-hidden">
            <div className="h-full bg-white transition-all duration-100 ease-linear rounded-full" style={{ width }} />
          </div>
        );
      })}
    </div>
  );
}

export function WrappedSlideHeader({
  subtitle,
  title,
  isPlaying,
  onTogglePlay,
}: {
  subtitle: string;
  title: string;
  isPlaying: boolean;
  onTogglePlay: () => void;
}) {
  return (
    <div className="absolute top-8 left-6 right-6 z-20 flex justify-between items-center">
      <div>
        <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider font-mono">{subtitle}</span>
        <h4 className="text-sm font-bold text-white/90">{title}</h4>
      </div>
      <button
        onClick={onTogglePlay}
        className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:text-white transition-colors hover:bg-white/10 hide-in-share"
      >
        {isPlaying ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
      </button>
      <div className="hidden show-in-share text-right">
        <span className="text-[9px] font-mono font-bold tracking-widest text-emerald-400 block leading-none">HABITFLOW</span>
        <span className="text-[8px] text-white/40 font-mono block mt-0.5 leading-none">habitflow.tech</span>
      </div>
    </div>
  );
}

export function WrappedSlideFooter({
  currentSlide,
  totalSlides,
  onPrev,
  onNext,
}: {
  currentSlide: number;
  totalSlides: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <div className="absolute bottom-4 inset-x-6 z-20 flex justify-between items-center hide-in-share">
        <button
          onClick={onPrev}
          disabled={currentSlide === 0}
          className="p-2 rounded-xl bg-white/5 border border-white/10 text-white disabled:opacity-20 transition-all hover:bg-white/10"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[10px] font-bold text-white/40 tracking-widest font-mono">
          {currentSlide + 1} / {totalSlides}
        </span>
        <button
          onClick={onNext}
          disabled={currentSlide === totalSlides - 1}
          className="p-2 rounded-xl bg-white/5 border border-white/10 text-white disabled:opacity-20 transition-all hover:bg-white/10"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="absolute bottom-6 inset-x-0 hidden text-center show-in-share">
        <p className="text-[10px] font-bold tracking-widest uppercase font-mono text-white/50">
          Tracked on <span className="text-emerald-400">HabitFlow</span>
        </p>
        <p className="text-[8px] font-medium tracking-wide text-white/30 font-sans mt-0.5">habitflow.tech</p>
      </div>
    </>
  );
}
