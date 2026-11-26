'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripHorizontal, Pin, EyeOff, Maximize2, Lock, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableWidgetProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  disableDrag?: boolean;
  isCustomizing?: boolean;
  pinned?: boolean;
  size?: '1/4' | '1/2' | '2/3' | 'full';
  onTogglePin?: () => void;
  onResize?: (size: '1/4' | '1/2' | '2/3' | 'full') => void;
  onHide?: () => void;
}

function WidgetCustomizeOverlay(props: {
  id: string;
  pinned: boolean;
  size: '1/4' | '1/2' | '2/3' | 'full';
  attributes: ReturnType<typeof useSortable>['attributes'];
  listeners: ReturnType<typeof useSortable>['listeners'];
  onTogglePin?: () => void;
  onResize?: (size: '1/4' | '1/2' | '2/3' | 'full') => void;
  onResizeCycle: () => void;
  onHide?: () => void;
}) {
  const { id, pinned, size, attributes, listeners, onTogglePin, onResize, onResizeCycle, onHide } = props;
  const formattedTitle = id.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="absolute inset-0 bg-background/85 md:bg-background/70 border-2 border-dashed border-primary/35 rounded-xl z-30 flex flex-col items-center justify-center p-4 transition-opacity duration-200">
      <div className="surface-card shadow-xl p-3 flex items-center gap-2.5 scale-95 md:scale-100 transition-transform">
        {!pinned && (
          <div
            {...attributes}
            {...listeners}
            className="touch-none p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary cursor-grab active:cursor-grabbing transition-colors"
            title="Drag to reorder"
          >
            <GripHorizontal className="w-4 h-4" />
          </div>
        )}

        {onTogglePin && (
          <button
            type="button"
            onClick={onTogglePin}
            className={cn('p-2 rounded-xl transition-colors', pinned ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-secondary')}
            title={pinned ? 'Unpin widget' : 'Pin widget (lock location)'}
          >
            {pinned ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>
        )}

        {onResize && (
          <button
            type="button"
            onClick={onResizeCycle}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-1.5"
            title="Cycle widget width"
          >
            <Maximize2 className="w-4 h-4" />
            <span className="text-xs font-bold font-mono">{size}</span>
          </button>
        )}

        {onHide && (
          <button type="button" onClick={onHide} className="p-2 rounded-xl text-destructive hover:bg-destructive/10 transition-colors" title="Hide widget">
            <EyeOff className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="absolute bottom-2 text-[10px] font-semibold text-muted-foreground bg-card px-2 py-0.5 rounded-full border border-border">
        {formattedTitle}
      </div>
    </div>
  );
}

function WidgetHoverDragHandle({
  attributes,
  listeners,
}: {
  attributes: ReturnType<typeof useSortable>['attributes'];
  listeners: ReturnType<typeof useSortable>['listeners'];
}) {
  return (
    <div
      {...attributes}
      {...listeners}
      className="hidden md:block touch-none absolute top-2 right-2 p-1.5 rounded-md text-muted-foreground/20 opacity-0 group-hover:opacity-100 hover:bg-secondary hover:text-foreground hover:text-muted-foreground/80 cursor-grab active:cursor-grabbing transition-opacity z-10"
      title="Drag widget"
    >
      <GripHorizontal className="w-4 h-4" />
    </div>
  );
}

const WIDGET_SIZES: ('1/4' | '1/2' | '2/3' | 'full')[] = ['1/4', '1/2', '2/3', 'full'];

function nextWidgetSize(size: '1/4' | '1/2' | '2/3' | 'full') {
  return WIDGET_SIZES[(WIDGET_SIZES.indexOf(size) + 1) % WIDGET_SIZES.length];
}

function getSortableWidgetClass(isDragging: boolean, isCustomizing: boolean, className?: string) {
  return cn(
    'relative group transition-all h-full flex flex-col rounded-xl overflow-hidden',
    isDragging && 'opacity-50 scale-[1.02] shadow-xl ring-2 ring-primary/20',
    isCustomizing && 'ring-1 ring-dashed ring-primary/30 bg-muted/5',
    className
  );
}

export function SortableWidget({
  id,
  children,
  className,
  disableDrag = false,
  isCustomizing = false,
  pinned = false,
  size = 'full',
  onTogglePin,
  onResize,
  onHide
}: SortableWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: disableDrag || pinned,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  const handleResizeCycle = onResize ? () => onResize(nextWidgetSize(size)) : undefined;
  const showHoverDrag = !isCustomizing && !disableDrag && !pinned;

  return (
    <div ref={setNodeRef} style={style} className={getSortableWidgetClass(isDragging, isCustomizing, className)}>
      {isCustomizing && (
        <WidgetCustomizeOverlay
          id={id}
          pinned={pinned}
          size={size}
          attributes={attributes}
          listeners={listeners}
          onTogglePin={onTogglePin}
          onResize={onResize}
          onResizeCycle={handleResizeCycle ?? (() => {})}
          onHide={onHide}
        />
      )}

      {showHoverDrag && <WidgetHoverDragHandle attributes={attributes} listeners={listeners} />}

      <div className="flex-1 w-full h-full">{children}</div>
    </div>
  );
}
