'use client';

import React, { useRef } from 'react';
import { Loader2, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CaptureActionsList } from './CaptureActionPreview';
import { CaptureClarificationBanner } from './CaptureClarificationBanner';
import { CaptureEmptyQuickLog, CaptureInputBar } from './CaptureQuickBar';
import { useQuickCaptureController } from './useQuickCaptureController';

export function QuickCaptureModal({
  defaultOpen = false,
  initialVoiceText,
  initialVoiceSeq,
}: {
  defaultOpen?: boolean;
  initialVoiceText?: string;
  initialVoiceSeq?: number;
} = {}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const vm = useQuickCaptureController({ defaultOpen, inputRef, initialVoiceText, initialVoiceSeq });

  return (
    <Dialog open={vm.isOpen} onOpenChange={vm.setIsOpen}>
      <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto p-0 border-border/80 bg-card shadow-2xl rounded-2xl">
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-border/60">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Zap className="h-4 w-4 text-primary" />
              10-Second Universal Capture
            </DialogTitle>
            <div className="flex items-center gap-1.5 mr-6">
              <Badge variant="outline" className="text-[10px] font-normal">Hinglish + Compound</Badge>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border border-border text-muted-foreground">⌘K</kbd>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={vm.handleSubmit} className="p-4 space-y-3.5">
          <CaptureInputBar
            inputRef={inputRef}
            inputText={vm.inputText}
            onChangeText={(text) => { vm.setAiEnhancedInput(null); vm.setInputText(text); }}
            onClear={() => { vm.setInputText(''); vm.setActions([]); }}
            hasMicSupport={vm.hasMicSupport}
            isListening={vm.isListening}
            onToggleVoice={vm.toggleVoiceInput}
            isAiParsing={vm.isAiParsing}
            onAiEnhance={vm.handleAiEnhance}
          />

          {!vm.inputText.trim() && (
            <CaptureEmptyQuickLog
              isFitnessEnabled={vm.isFitnessEnabled}
              pinnedTemplates={vm.pinnedTemplates}
              onSelectSample={vm.setInputText}
              onQuickWater={vm.handleQuickWater}
              onQuickSteps={vm.handleQuickSteps}
              onQuickStaple={vm.handleQuickStaple}
            />
          )}

          <CaptureClarificationBanner
            ambiguities={vm.ambiguities}
            duplicateWarnings={vm.duplicateWarnings}
            onResolveAmbiguity={vm.resolveAmbiguity}
            onResolveDuplicate={vm.resolveDuplicate}
          />

          <CaptureActionsList
            actions={vm.actions}
            enabledCount={vm.enabledCount}
            accounts={vm.accounts}
            updateAction={vm.updateAction}
          />

          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <span className="text-[11px] text-muted-foreground">
              {vm.hasPendingClarifications
                ? 'Resolve clarification above to log'
                : vm.isListening
                  ? 'Listening (en-IN)… speak naturally'
                  : 'Offline-first · Auto-syncs across devices'}
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => vm.setIsOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={vm.enabledCount === 0 || vm.isSubmitting || vm.hasPendingClarifications} className="gap-1.5">
                {vm.isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Log {vm.enabledCount > 1 ? `All (${vm.enabledCount})` : vm.enabledCount === 1 ? 'Item' : ''}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
