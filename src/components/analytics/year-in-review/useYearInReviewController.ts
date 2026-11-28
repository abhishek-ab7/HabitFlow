'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useGoalStore } from '@/lib/stores/goal-store';
import { useTaskStore } from '@/lib/stores/task-store';
import {
  compute2026Stats,
  type YearInReviewFinanceProps,
  type YearInReviewFitnessProps,
} from '@/lib/analytics/year-in-review-metrics';
import {
  buildCoreWrappedSlides,
  buildDomainWrappedSlides,
  buildScorecardSlide,
  type WrappedSlide,
} from './YearInReviewSlides';
import { toast } from 'sonner';

async function copyShareTextFallback(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to execCommand
    }
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textArea);
    return copied;
  } catch {
    return false;
  }
}

async function tryNativeFileShare(file: File, text: string, shareToastId: string | number): Promise<'done' | 'fallback'> {
  if (!navigator.share || !navigator.canShare?.({ files: [file] })) return 'fallback';
  try {
    await navigator.share({ files: [file], title: 'My 2026 Habit Scorecard | HabitFlow', text });
    toast.dismiss(shareToastId);
    toast.success('Stats shared successfully!');
    return 'done';
  } catch (err) {
    if ((err as Error).name !== 'AbortError') return 'fallback';
    toast.dismiss(shareToastId);
    return 'done';
  }
}

async function tryClipboardImageCopy(blob: Blob, text: string, shareToastId: string | number): Promise<boolean> {
  if (!navigator.clipboard?.write) return false;
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob, 'text/plain': new Blob([text], { type: 'text/plain' }) }),
    ]);
    toast.dismiss(shareToastId);
    toast.success('Scorecard image and text copied to clipboard!');
    return true;
  } catch {
    return false;
  }
}

async function shareScorecardBlob(blob: Blob, canvas: HTMLCanvasElement, text: string, shareToastId: string | number): Promise<void> {
  const file = new File([blob], 'habitflow-2026-wrapped.png', { type: 'image/png' });
  if ((await tryNativeFileShare(file, text, shareToastId)) === 'done') return;
  if (await tryClipboardImageCopy(blob, text, shareToastId)) return;

  const textCopied = await copyShareTextFallback(text);
  try {
    const link = document.createElement('a');
    link.download = 'habitflow-2026-wrapped.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.dismiss(shareToastId);
    toast.success(textCopied ? 'Stats copied to clipboard & image downloaded!' : 'Scorecard image downloaded!');
  } catch {
    toast.dismiss(shareToastId);
    toast.error('Failed to share or download scorecard.');
  }
}
async function captureScorecardCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  const html2canvas = (await import('html2canvas-pro')).default;
  return html2canvas(element, {
    useCORS: true,
    allowTaint: true,
    scale: 2,
    backgroundColor: null,
    onclone: (clonedDoc) => {
      clonedDoc.querySelectorAll('.hide-in-share').forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });
      clonedDoc.querySelectorAll('.show-in-share').forEach((el) => {
        (el as HTMLElement).style.setProperty('display', 'block', 'important');
      });
      const clonedCard = clonedDoc.querySelector('[data-slot="card"]') as HTMLElement | null;
      if (clonedCard) {
        clonedCard.style.height = '520px';
        clonedCard.style.maxHeight = '520px';
        clonedCard.style.borderRadius = '1.5rem';
        clonedCard.style.overflow = 'hidden';
      }
    },
  });
}

function useYearInReviewPlayback(totalSlides: number) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isPlaying) return;
    const step = 100 / 80;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 100) return prev + step;
        setCurrentSlide((curr) => {
          if (curr >= totalSlides - 1) {
            setIsPlaying(false);
            return curr;
          }
          return curr + 1;
        });
        return 0;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, currentSlide, totalSlides]);

  const handleNext = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(currentSlide + 1);
      setProgress(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
      setProgress(100);
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
      setProgress(0);
      setIsPlaying(true);
    }
  };

  const handleReplay = () => {
    setCurrentSlide(0);
    setProgress(0);
    setIsPlaying(true);
  };

  return { currentSlide, isPlaying, setIsPlaying, progress, handleNext, handlePrev, handleReplay };
}

export function useYearInReviewController(params: {
  financeSummary?: YearInReviewFinanceProps;
  fitnessSummary?: YearInReviewFitnessProps;
}) {
  const { financeSummary, fitnessSummary } = params;
  const { habits, completions } = useHabitStore();
  const { goals } = useGoalStore();
  const { tasks } = useTaskStore();
  const cardRef = useRef<HTMLDivElement>(null);

  const stats2026 = useMemo(
    () => compute2026Stats({ habits, completions, goals, tasks }),
    [habits, completions, goals, tasks]
  );

  const domainSlides = useMemo(
    () => buildDomainWrappedSlides(financeSummary, fitnessSummary),
    [financeSummary, fitnessSummary]
  );
  const totalSlides = 5 + domainSlides.length;

  const playback = useYearInReviewPlayback(totalSlides);

  const handleShare = async () => {
    const wasPlaying = playback.isPlaying;
    playback.setIsPlaying(false);
    const text = `I completed ${stats2026.totalCompletions} habits in 2026 with a ${stats2026.bestStreak} day streak on HabitFlow! 🚀 Check out your 2026 scorecard at habitflow.tech #HabitFlowWrapped`;

    const element = cardRef.current;
    if (!element) {
      toast.error('Card element not found.');
      if (wasPlaying) playback.setIsPlaying(true);
      return;
    }

    const shareToastId = toast.loading('Generating your scorecard share card...');
    try {
      const canvas = await captureScorecardCanvas(element);
      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.dismiss(shareToastId);
          toast.error('Failed to render card image.');
        } else {
          await shareScorecardBlob(blob, canvas, text, shareToastId);
        }
        if (wasPlaying) playback.setIsPlaying(true);
      }, 'image/png');
    } catch (err) {
      console.error('Failed to capture card:', err);
      toast.dismiss(shareToastId);
      toast.error('Failed to capture card image.');
      if (wasPlaying) playback.setIsPlaying(true);
    }
  };

  const slides: WrappedSlide[] = [
    ...buildCoreWrappedSlides(stats2026),
    buildScorecardSlide({
      stats2026,
      financeSummary,
      fitnessSummary,
      onReplay: playback.handleReplay,
      onShare: handleShare,
    }),
    ...domainSlides,
  ];

  return {
    cardRef,
    slides,
    activeSlide: slides[playback.currentSlide],
    totalSlides,
    ...playback,
  };
}
