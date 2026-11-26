'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { SpeechRecognitionInstance } from './capture-types';

function getSpeechCtor(): (new () => SpeechRecognitionInstance) | undefined {
  if (typeof window === 'undefined') return undefined;
  const win = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition;
}

function startSpeechRecognition(params: {
  SpeechCtor: new () => SpeechRecognitionInstance;
  baseText: string;
  onTranscript: (combined: string) => void;
  onStop: () => void;
  onError: () => void;
}): SpeechRecognitionInstance {
  const recognition = new params.SpeechCtor();
  recognition.lang = 'en-IN';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0]?.transcript || '';
    params.onTranscript(params.baseText ? `${params.baseText} + ${transcript.trim()}` : transcript.trim());
  };
  recognition.onerror = params.onError;
  recognition.onend = params.onStop;
  recognition.start();
  return recognition;
}

export function useVoiceCapture(params: {
  isOpen: boolean;
  inputText: string;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  setAiEnhancedInput: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const { isOpen, inputText, setInputText, setAiEnhancedInput } = params;
  const [isListening, setIsListening] = useState(false);
  const [hasMicSupport, setHasMicSupport] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    setHasMicSupport(Boolean(getSpeechCtor()));
  }, []);

  useEffect(() => {
    if (isOpen) return;
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    setIsListening(false);
  }, [isOpen]);

  const toggleVoiceInput = useCallback(() => {
    if (isListening) {
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
      return void setIsListening(false);
    }
    const SpeechCtor = getSpeechCtor();
    if (!SpeechCtor) return void toast.error('Voice capture is not supported in this browser');

    try {
      recognitionRef.current = startSpeechRecognition({
        SpeechCtor,
        baseText: inputText.trim(),
        onTranscript: (combined) => { setAiEnhancedInput(null); setInputText(combined); },
        onStop: () => setIsListening(false),
        onError: () => { setIsListening(false); toast.error('Microphone error — check permission or type manually'); },
      });
      setIsListening(true);
    } catch {
      setIsListening(false);
      toast.error('Could not start voice capture');
    }
  }, [isListening, inputText, setInputText, setAiEnhancedInput]);

  return { isListening, hasMicSupport, toggleVoiceInput };
}
