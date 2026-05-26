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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: disableDrag || pinned });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  const handleResizeCycle = () => {
    if (!onResize) return;
    const sizes: ('1/4' | '1/2' | '2/3' | 'full')[] = ['1/4', '1/2', '2/3', 'full'];
    const currentIndex = sizes.indexOf(size);
    const nextIndex = (currentIndex + 1) % sizes.length;
    onResize(sizes[nextIndex]);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group transition-all h-full flex flex-col rounded-xl overflow-hidden',
        isDragging && 'opacity-50 scale-[1.02] shadow-xl ring-2 ring-primary/20',
        isCustomizing && 'ring-1 ring-dashed ring-primary/30 bg-muted/5',
        className
      )}
    >
      {/* Customization Overlay */}
      {isCustomizing && (
        <div className="absolute inset-0 bg-background/40 dark:bg-slate-950/40 backdrop-blur-[1px] border-2 border-dashed border-indigo-500/30 rounded-xl z-30 flex flex-col items-center justify-center p-4 transition-all duration-300">
          <div className="bg-background/95 dark:bg-slate-900/95 backdrop-blur shadow-2xl rounded-2xl border border-border/80 p-3 flex items-center gap-2.5 scale-95 md:scale-100 transition-transform">
            
            {/* Drag Handle */}
            {!pinned && (
              <div
                {...attributes}
                {...listeners}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary cursor-grab active:cursor-grabbing transition-colors"
                title="Drag to reorder"
              >
                <GripHorizontal className="w-4 h-4" />
              </div>
            )}

            {/* Pin Toggle */}
            {onTogglePin && (
              <button
                type="button"
                onClick={onTogglePin}
                className={cn(
                  "p-2 rounded-xl transition-colors",
                  pinned 
                    ? "text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/40" 
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
                title={pinned ? "Unpin widget" : "Pin widget (lock location)"}
              >
                {pinned ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </button>
            )}

            {/* Resize Trigger */}
            {onResize && (
              <button
                type="button"
                onClick={handleResizeCycle}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-1.5"
                title="Cycle widget width"
              >
                <Maximize2 className="w-4 h-4" />
                <span className="text-xs font-bold font-mono">{size}</span>
              </button>
            )}

            {/* Hide Trigger */}
            {onHide && (
              <button
                type="button"
                onClick={onHide}
                className="p-2 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                title="Hide widget"
              >
                <EyeOff className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <div className="absolute bottom-2 text-[10px] font-semibold text-muted-foreground/80 bg-background/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-full border border-border/40">
            {id.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </div>
        </div>
      )}

      {/* Default non-edit Drag Handle (subtle hover state when NOT customizing) */}
      {!isCustomizing && !disableDrag && !pinned && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 right-2 p-1.5 rounded-md text-muted-foreground/20 opacity-0 group-hover:opacity-100 hover:bg-secondary hover:text-foreground hover:text-muted-foreground/80 cursor-grab active:cursor-grabbing transition-all z-10"
          title="Drag widget"
        >
          <GripHorizontal className="w-4 h-4" />
        </div>
      )}

      {/* Widget Content */}
      <div className="flex-1 w-full h-full">
        {children}
      </div>
    </div>
  );
}
