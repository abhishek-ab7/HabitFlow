'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface TourTriggerButtonProps {
  onClick: () => void;
  pageTitle?: string;
  className?: string;
  variant?: 'outline' | 'ghost' | 'default' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  hideTextOnMobile?: boolean;
}

export function TourTriggerButton({
  onClick,
  pageTitle,
  className,
  variant = 'outline',
  size = 'sm',
  hideTextOnMobile = true,
}: TourTriggerButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      className={cn(
        'h-8 px-2.5 text-xs gap-1.5 rounded-xl border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-all shadow-xs shrink-0',
        className
      )}
      title={pageTitle ? `Start ${pageTitle} Tour` : 'Start Guided Tour'}
      aria-label={pageTitle ? `Start ${pageTitle} Tour` : 'Start Guided Tour'}
    >
      <HelpCircle className="w-3.5 h-3.5 text-primary shrink-0" />
      <span className={cn(hideTextOnMobile && 'hidden sm:inline')}>
        Tour
      </span>
    </Button>
  );
}
