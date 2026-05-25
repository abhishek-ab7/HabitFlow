import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableWidgetProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  disableDrag?: boolean;
}

export function SortableWidget({ id, children, className, disableDrag = false }: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: disableDrag });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group transition-all h-full flex flex-col',
        isDragging && 'opacity-50 scale-[1.02] shadow-xl ring-2 ring-primary/20',
        className
      )}
    >
      {!disableDrag && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 right-2 p-1.5 rounded-md text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:bg-secondary hover:text-foreground cursor-grab active:cursor-grabbing transition-all z-10"
        >
          <GripHorizontal className="w-4 h-4" />
        </div>
      )}
      <div className="flex-1 w-full h-full">
        {children}
      </div>
    </div>
  );
}
