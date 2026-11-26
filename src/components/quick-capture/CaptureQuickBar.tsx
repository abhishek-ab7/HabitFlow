'use client';

import React from 'react';
import { Droplets, Footprints, Loader2, Mic, MicOff, Sparkles, Utensils, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { MealTemplate } from '@/lib/types';

const EXAMPLE_PROMPTS = [
  'momo 60 slice',
  '4 eggs + oats + milk',
  'push workout 45m + 9000 steps',
  '7.5h sleep, energy 4, 74.2 kg',
];

export function CaptureInputBar({
  inputRef,
  inputText,
  onChangeText,
  onClear,
  hasMicSupport,
  isListening,
  onToggleVoice,
  isAiParsing,
  onAiEnhance,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  inputText: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  hasMicSupport: boolean;
  isListening: boolean;
  onToggleVoice: () => void;
  isAiParsing: boolean;
  onAiEnhance: () => void;
}) {
  return (
    <div className="relative flex items-center gap-1.5 rounded-xl border border-input bg-background px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-primary/30">
      <Input
        ref={inputRef}
        value={inputText}
        onChange={(e) => onChangeText(e.target.value)}
        placeholder='Try: "momo 60 slice", "4 eggs + oats + milk", "push workout 45m + 9000 steps"'
        className="border-0 bg-transparent px-1 py-1 text-sm sm:text-base shadow-none focus-visible:ring-0"
        autoComplete="off"
      />
      {inputText && (
        <button type="button" onClick={onClear} aria-label="Clear capture text" className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg">
          <X className="h-4 w-4" />
        </button>
      )}
      {hasMicSupport && (
        <Button
          type="button"
          size="icon"
          variant={isListening ? 'destructive' : 'ghost'}
          onClick={onToggleVoice}
          title="Speak in Hinglish / English (en-IN)"
          className={cn('h-8 w-8 shrink-0 rounded-lg', isListening && 'animate-pulse')}
        >
          {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={!inputText.trim() || isAiParsing}
        onClick={onAiEnhance}
        title="Refine compound log with Gemini"
        className="h-8 px-2.5 text-xs shrink-0 gap-1"
      >
        {isAiParsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-amber-500" />}
        <span className="hidden sm:inline">AI</span>
      </Button>
    </div>
  );
}

export function CaptureEmptyQuickLog(params: {
  isFitnessEnabled: boolean;
  pinnedTemplates: MealTemplate[];
  onSelectSample: (sample: string) => void;
  onQuickWater: (ml: number) => void;
  onQuickSteps: (delta: number) => void;
  onQuickStaple: (template: { id: string; name: string }) => void;
}) {
  const samples = params.isFitnessEnabled ? EXAMPLE_PROMPTS : [EXAMPLE_PROMPTS[0]];
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        {samples.map((sample) => (
          <button
            key={sample}
            type="button"
            onClick={() => params.onSelectSample(sample)}
            className="text-[11px] px-2.5 py-1 rounded-full bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            {sample}
          </button>
        ))}
      </div>

      {params.isFitnessEnabled && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">1-Tap Instant Log</span>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => params.onQuickWater(250)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[11px] font-medium hover:bg-sky-500/20">
                <Droplets className="h-3 w-3" /> +250ml
              </button>
              <button type="button" onClick={() => params.onQuickWater(500)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[11px] font-medium hover:bg-sky-500/20">
                <Droplets className="h-3 w-3" /> +500ml
              </button>
              <button type="button" onClick={() => params.onQuickSteps(2000)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium hover:bg-emerald-500/20">
                <Footprints className="h-3 w-3" /> +2k steps
              </button>
            </div>
          </div>

          {params.pinnedTemplates.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {params.pinnedTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => params.onQuickStaple({ id: tpl.id, name: tpl.name })}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/70 bg-background hover:border-primary/50 text-xs transition-colors"
                >
                  <Utensils className="h-3 w-3 text-primary" />
                  <span className="font-medium">{tpl.name}</span>
                  <span className="text-[10px] text-muted-foreground">{tpl.calories}k · {tpl.proteinG}g</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
