'use client';

import { useEffect, useRef, useState } from 'react';
import { Share2, Download, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { useUserStore } from '@/lib/stores/user-store';
import type { Habit } from '@/lib/types';

interface ShareCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit: Habit | null;
  streak: number;
}

const CATEGORY_COLORS: Record<string, { primary: string; secondary: string; glow: string }> = {
  health: { primary: '#10b981', secondary: '#059669', glow: 'rgba(16, 185, 129, 0.4)' },
  work: { primary: '#6366f1', secondary: '#4f46e5', glow: 'rgba(99, 102, 241, 0.4)' },
  learning: { primary: '#f59e0b', secondary: '#d97706', glow: 'rgba(245, 158, 11, 0.4)' },
  personal: { primary: '#ec4899', secondary: '#db2777', glow: 'rgba(236, 72, 153, 0.4)' },
  finance: { primary: '#0ea5e9', secondary: '#0284c7', glow: 'rgba(14, 165, 233, 0.4)' },
  relationships: { primary: '#f97316', secondary: '#ea580c', glow: 'rgba(249, 115, 22, 0.4)' },
  default: { primary: '#a855f7', secondary: '#9333ea', glow: 'rgba(168, 85, 247, 0.4)' },
};

export function ShareCardModal({ open, onOpenChange, habit, streak }: ShareCardModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const { level } = useGamificationStore();
  const { displayName } = useUserStore();

  const colors = habit ? (CATEGORY_COLORS[habit.category] || CATEGORY_COLORS.default) : CATEGORY_COLORS.default;

  const drawCard = () => {
    if (!canvasRef.current || !habit) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, 600, 800);

    // 1. Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 800);
    bgGrad.addColorStop(0, '#090d16');
    bgGrad.addColorStop(0.5, '#0f172a');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 600, 800);

    // 2. Circular accent glows
    const radialGrad = ctx.createRadialGradient(300, 400, 50, 300, 400, 350);
    radialGrad.addColorStop(0, colors.glow);
    radialGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = radialGrad;
    ctx.fillRect(0, 0, 600, 800);

    // 3. Neon Outline border
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, 586, 786);

    // Inner subtle border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, 540, 740);

    // 4. Header Watermark Logo
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
    ctx.fillText('HABIT FLOW', 50, 75);

    ctx.fillStyle = colors.primary;
    ctx.font = 'semibold 14px system-ui, -apple-system, sans-serif';
    ctx.fillText('STREAK ACHIEVER', 430, 75);

    // 5. Large Category Icon / Badge in Center
    const iconSize = 90;
    ctx.shadowColor = colors.primary;
    ctx.shadowBlur = 20;
    
    // Draw central card box
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    // rounded rect function path
    ctx.beginPath();
    ctx.roundRect(80, 150, 440, 500, 24);
    ctx.fill();
    ctx.stroke();

    // Reset shadow for details
    ctx.shadowBlur = 0;

    // Draw Emoji icon
    ctx.font = '64px serif';
    ctx.textAlign = 'center';
    ctx.fillText(habit.icon || '✓', 300, 250);

    // 6. Habit Details
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '500 16px system-ui, sans-serif';
    ctx.fillText(habit.category.toUpperCase(), 300, 310);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillText(habit.name, 300, 355);

    // Divider
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(150, 400);
    ctx.lineTo(450, 400);
    ctx.stroke();

    // 7. Streak Count
    ctx.fillStyle = colors.primary;
    ctx.font = 'bold 84px system-ui, sans-serif';
    // Draw fire glow for streak
    ctx.shadowColor = colors.primary;
    ctx.shadowBlur = 25;
    ctx.fillText(String(streak), 300, 510);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(streak === 1 ? 'DAY STREAK' : 'DAY STREAK!', 300, 555);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'normal 14px system-ui, sans-serif';
    ctx.fillText('Building consistency daily', 300, 595);

    // 8. Footer (User metadata)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(displayName || 'Habit Flow User', 50, 715);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '500 13px system-ui, sans-serif';
    ctx.fillText(`RPG Level ${level}`, 50, 735);

    // Right logo info
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('habitflow.app', 550, 725);

    // Convert canvas to image URL
    try {
      const dataUrl = canvas.toDataURL('image/png');
      setPreviewUrl(dataUrl);
    } catch (e) {
      console.error('Failed to generate preview url', e);
    }
  };

  useEffect(() => {
    if (open && habit) {
      // Draw canvas after render has settled
      setTimeout(drawCard, 200);
    }
  }, [open, habit, streak, displayName, level]);

  const handleDownload = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `habit-streak-${habit?.name.toLowerCase().replace(/\s+/g, '-')}-${streak}d.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Card downloaded successfully!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto flex flex-col items-center">
        <DialogHeader className="w-full text-center">
          <DialogTitle className="flex items-center justify-center gap-2">
            <Share2 className="h-5 w-5 text-indigo-500" />
            <span>Share Achievement</span>
          </DialogTitle>
        </DialogHeader>

        {habit && (
          <div className="flex flex-col items-center justify-center w-full mt-4 space-y-6">
            {/* Hidden canvas for drawing */}
            <canvas
              ref={canvasRef}
              width={600}
              height={800}
              className="hidden"
            />

            {/* Premium visual preview card */}
            {previewUrl ? (
              <div className="relative border border-border/60 rounded-xl overflow-hidden shadow-2xl max-w-[280px] sm:max-w-[320px] aspect-[3/4] select-none hover:scale-[1.01] transition-transform duration-300">
                <img
                  src={previewUrl}
                  alt="Shareable Streak Card Preview"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-[300px] aspect-[3/4] border rounded-xl flex items-center justify-center bg-muted/30">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            )}

            <div className="flex w-full gap-2.5">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Close
              </Button>
              <Button
                onClick={handleDownload}
                disabled={!previewUrl}
                className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Download className="h-4 w-4" />
                Download PNG
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
