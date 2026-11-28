'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Loader2, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHoldToTalkVoice } from './useHoldToTalkVoice';

interface VoiceOrbButtonProps {
  onTranscriptReady: (transcript: string) => void;
}

export function VoiceOrbButton({ onTranscriptReady }: VoiceOrbButtonProps) {
  const pathname = usePathname() ?? '';
  const { status, livePreview, isSupported, startHold, stopHold } = useHoldToTalkVoice(onTranscriptReady);

  const isAppRoute = pathname !== '/' && pathname !== '/login' && !pathname.startsWith('/auth');
  if (!isAppRoute || !isSupported) return null;

  const isListening = status === 'listening';
  const isTranscribing = status === 'transcribing';

  return (
    <div className="fixed bottom-[132px] right-4 md:bottom-20 md:right-6 z-40 flex flex-col items-end gap-2 pointer-events-none">
      {(isListening || isTranscribing) && (
        <div
          data-testid="voice-orb-preview"
          className="pointer-events-auto max-w-[260px] rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-md px-3.5 py-2 shadow-xl text-xs text-foreground"
        >
          <p className="font-semibold text-primary text-[10px] uppercase tracking-wider">
            {isTranscribing ? 'Transcribing with Gemini…' : 'Listening (release to capture)…'}
          </p>
          {livePreview && <p className="mt-0.5 line-clamp-2">{livePreview}</p>}
        </div>
      )}

      <button
        type="button"
        data-testid="hold-to-talk-voice-orb"
        aria-label="Hold to speak quick capture"
        title="Hold to speak (release to capture)"
        onPointerDown={(e) => {
          e.preventDefault();
          void startHold();
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          stopHold();
        }}
        onPointerCancel={stopHold}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          'pointer-events-auto h-12 w-12 rounded-full flex items-center justify-center shadow-lg border transition-all touch-none select-none',
          isListening
            ? 'bg-rose-500 text-white border-rose-400 scale-110 ring-4 ring-rose-500/30 animate-pulse'
            : isTranscribing
              ? 'bg-primary text-primary-foreground border-primary/40'
              : 'bg-card/95 hover:bg-primary hover:text-primary-foreground text-foreground border-border/80 backdrop-blur-md'
        )}
      >
        {isTranscribing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
      </button>
    </div>
  );
}
