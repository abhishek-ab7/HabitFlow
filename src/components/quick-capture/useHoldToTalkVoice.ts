'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { SpeechRecognitionInstance } from './capture-types';

export type HoldVoiceStatus = 'idle' | 'listening' | 'transcribing';

const MIN_HOLD_MS = 250;
const MAX_HOLD_MS = 25_000;

function getSpeechCtor(): (new () => SpeechRecognitionInstance) | undefined {
  if (typeof window === 'undefined') return undefined;
  const win = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Failed to read audio blob'));
    reader.readAsDataURL(blob);
  });
}

export function useHoldToTalkVoice(onTranscriptReady: (transcript: string) => void) {
  const [status, setStatus] = useState<HoldVoiceStatus>('idle');
  const [livePreview, setLivePreview] = useState('');
  const [isSupported, setIsSupported] = useState(false);

  const startedAtRef = useRef<number>(0);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptRef = useRef<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const hasSpeech = Boolean(getSpeechCtor());
    const hasMedia = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
    setIsSupported(hasSpeech || hasMedia);
    return () => {
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    };
  }, []);

  const clearTimer = () => {
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  };

  const finishMediaUpload = useCallback(
    async (mimeType: string) => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];
      if (blob.size < 400) {
        setStatus('idle');
        return;
      }
      setStatus('transcribing');
      try {
        const audioBase64 = await blobToBase64(blob);
        const res = await fetch('/api/ai/transcribe-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioBase64, mimeType }),
        });
        if (!res.ok) throw new Error('Transcription failed');
        const data = (await res.json()) as { transcript?: string };
        const clean = (data.transcript || '').trim();
        if (clean) onTranscriptReady(clean);
        else toast.info('Could not catch that — try holding a bit longer');
      } catch {
        toast.error('Voice transcription failed — tap ⌘K to type');
      } finally {
        setStatus('idle');
      }
    },
    [onTranscriptReady]
  );

  const stopHold = useCallback(() => {
    clearTimer();
    const heldMs = Date.now() - startedAtRef.current;

    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      try { rec.stop(); } catch { /* ignore */ }
      setStatus('idle');
      const finalText = transcriptRef.current.trim();
      setLivePreview('');
      if (heldMs >= MIN_HOLD_MS && finalText) {
        onTranscriptReady(finalText);
      }
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      const recorder = mediaRecorderRef.current;
      mediaRecorderRef.current = null;
      if (heldMs < MIN_HOLD_MS) {
        chunksRef.current = [];
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.stop();
        recorder.stream.getTracks().forEach((t) => t.stop());
        setStatus('idle');
        return;
      }
      recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
    }
  }, [onTranscriptReady]);

  const startHold = useCallback(async () => {
    if (status !== 'idle') return;
    startedAtRef.current = Date.now();
    transcriptRef.current = '';
    setLivePreview('');

    const SpeechCtor = getSpeechCtor();
    if (SpeechCtor) {
      try {
        const rec = new SpeechCtor();
        rec.lang = 'en-IN';
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (event) => {
          let text = '';
          for (let i = 0; i < event.results.length; i++) {
            text += event.results[i][0]?.transcript || '';
          }
          transcriptRef.current = text.trim();
          setLivePreview(text.trim());
        };
        rec.onerror = () => {
          recognitionRef.current = null;
          setStatus('idle');
          setLivePreview('');
          toast.error('Microphone error — check permission');
        };
        rec.onend = () => {
          if (recognitionRef.current === rec) {
            recognitionRef.current = null;
            setStatus('idle');
          }
        };
        recognitionRef.current = rec;
        rec.start();
        setStatus('listening');
        maxTimerRef.current = setTimeout(stopHold, MAX_HOLD_MS);
        return;
      } catch {
        recognitionRef.current = null;
      }
    }

    // Fallback: MediaRecorder -> Gemini multimodal audio transcription
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('Voice capture is not supported in this browser');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        void finishMediaUpload(mimeType);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus('listening');
      maxTimerRef.current = setTimeout(stopHold, MAX_HOLD_MS);
    } catch {
      setStatus('idle');
      toast.error('Microphone permission denied');
    }
  }, [status, stopHold, finishMediaUpload]);

  return { status, livePreview, isSupported, startHold, stopHold };
}
