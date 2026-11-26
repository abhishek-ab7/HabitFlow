'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Copy, Share2, QrCode, Check } from 'lucide-react';
import type { FriendLedgerGroup } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  formatSettlementShareText,
  generateWhatsAppShareUrl,
  getSavedUpiId,
  setSavedUpiId,
  validateUpiId,
} from '@/lib/finance/settlement-share';

interface ShareSettlementDialogProps {
  group: FriendLedgerGroup | null;
  isOpen: boolean;
  onClose: () => void;
}

type TargetBucket = 'all' | 'everyday_only' | 'loans_only';

const BUCKET_OPTIONS: Array<{ id: TargetBucket; label: string }> = [
  { id: 'all', label: 'All Buckets' },
  { id: 'everyday_only', label: 'Everyday Only' },
  { id: 'loans_only', label: 'Loans Only' },
];

function computeTargetNet(group: FriendLedgerGroup, bucket: TargetBucket): number {
  if (bucket === 'everyday_only') return group.everydayNet;
  if (bucket === 'loans_only') return group.longTermNetPosition;
  return group.everydayNet + group.longTermNetPosition;
}

function BucketSelector({ targetBucket, onChange }: { targetBucket: TargetBucket; onChange: (b: TargetBucket) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Include in Summary</Label>
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted rounded-xl text-xs">
        {BUCKET_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`py-1.5 px-2 rounded-lg font-medium transition-colors ${
              targetBucket === opt.id
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ShareUpiSection(props: {
  upiId: string;
  isUpiValid: boolean;
  includeUpiLink: boolean;
  onUpiChange: (val: string) => void;
  onIncludeLinkChange: (checked: boolean) => void;
}) {
  const { upiId, isUpiValid, includeUpiLink, onUpiChange, onIncludeLinkChange } = props;
  const statusTone = isUpiValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500';
  return (
    <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-2.5">
      <div className="flex items-center justify-between">
        <Label htmlFor="share-upi-id" className="text-xs flex items-center gap-1.5 font-semibold">
          <QrCode className="w-3.5 h-3.5 text-primary" />
          Your UPI ID (For Payment Link)
        </Label>
        {upiId.trim() && (
          <span className={`text-[10px] font-semibold ${statusTone}`}>
            {isUpiValid ? 'Valid VPA' : 'Invalid format'}
          </span>
        )}
      </div>
      <Input
        id="share-upi-id"
        value={upiId}
        onChange={(e) => onUpiChange(e.target.value)}
        placeholder="e.g., yourname@okhdfcbank"
        className="h-8 text-xs font-mono rounded-lg"
      />
      {isUpiValid && (
        <label className="flex items-center gap-2 cursor-pointer text-[11px] text-muted-foreground select-none">
          <input
            type="checkbox"
            checked={includeUpiLink}
            onChange={(e) => onIncludeLinkChange(e.target.checked)}
            className="rounded border-input text-primary focus:ring-primary"
          />
          Include 1-tap `upi://pay` deep link in message
        </label>
      )}
    </div>
  );
}

function ShareMessagePreview({ shareText }: { shareText: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Message Preview</Label>
        <span className="text-[11px] font-mono text-muted-foreground">{shareText.length} chars</span>
      </div>
      <pre className="p-3 rounded-xl border border-border bg-muted/40 text-[11px] font-mono whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto text-foreground/90 select-text">
        {shareText}
      </pre>
    </div>
  );
}

function ShareDialogFooter({ copied, waUrl, onCopy }: { copied: boolean; waUrl: string; onCopy: () => void }) {
  return (
    <DialogFooter className="pt-2 flex-col sm:flex-row gap-2">
      <Button type="button" variant="outline" onClick={onCopy} className="w-full sm:w-auto text-xs rounded-xl gap-1.5">
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Copied!' : 'Copy Text'}
      </Button>
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full sm:w-auto inline-flex items-center justify-center font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-9 px-4 py-2 text-xs rounded-xl gap-1.5 bg-[#25D366] hover:bg-[#20ba5a] text-white shadow-xs"
      >
        <Share2 className="w-3.5 h-3.5" />
        Share on WhatsApp
      </a>
    </DialogFooter>
  );
}

function useShareSettlementState(group: FriendLedgerGroup | null, isOpen: boolean) {
  const [upiId, setUpiId] = useState('');
  const [includeUpiLink, setIncludeUpiLink] = useState(true);
  const [targetBucket, setTargetBucket] = useState<TargetBucket>('all');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setUpiId(getSavedUpiId());
    setCopied(false);
  }, [isOpen]);

  const handleUpiChange = (val: string) => {
    setUpiId(val);
    if (validateUpiId(val) || !val.trim()) setSavedUpiId(val.trim());
  };

  const shareText = useMemo(() => {
    if (!group) return '';
    return formatSettlementShareText(group, {
      userUpiId: upiId.trim(),
      includeUpiLink,
      target: targetBucket,
    });
  }, [group, upiId, includeUpiLink, targetBucket]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast.success('Copied settlement summary to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  return {
    upiId,
    includeUpiLink,
    setIncludeUpiLink,
    targetBucket,
    setTargetBucket,
    copied,
    shareText,
    handleUpiChange,
    handleCopy,
  };
}

export function ShareSettlementDialog({
  group,
  isOpen,
  onClose,
}: ShareSettlementDialogProps) {
  const state = useShareSettlementState(group, isOpen);

  if (!group) return null;

  const isOwedNet = computeTargetNet(group, state.targetBucket) > 0;
  const isUpiValid = validateUpiId(state.upiId.trim());
  const waUrl = generateWhatsAppShareUrl(state.shareText, group.contactInfo);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary" />
            Share Settlement Summary
          </DialogTitle>
          <DialogDescription>
            Share an itemized balance breakdown with {group.friendName} via WhatsApp or copyable text.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <BucketSelector targetBucket={state.targetBucket} onChange={state.setTargetBucket} />
          {isOwedNet && (
            <ShareUpiSection
              upiId={state.upiId}
              isUpiValid={isUpiValid}
              includeUpiLink={state.includeUpiLink}
              onUpiChange={state.handleUpiChange}
              onIncludeLinkChange={state.setIncludeUpiLink}
            />
          )}
          <ShareMessagePreview shareText={state.shareText} />
        </div>

        <ShareDialogFooter copied={state.copied} waUrl={waUrl} onCopy={state.handleCopy} />
      </DialogContent>
    </Dialog>
  );
}
