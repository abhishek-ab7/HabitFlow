'use client';

import React, { useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy
} from '@dnd-kit/sortable';
import { useUIStore } from '@/lib/stores/ui-store';
import { SortableWidget } from './SortableWidget';
import { useUserStore } from '@/lib/stores/user-store';

interface BentoGridProps {
  widgets: Record<string, React.ReactNode>;
}

export function BentoGrid({ widgets }: BentoGridProps) {
  const { dashboardLayout, updateDashboardLayout } = useUIStore();
  const { saveDisplayNameToServer } = useUserStore(); // We'll just trigger sync engine separately if needed, or we just persist locally and rely on another process. But wait, updateSettings is best used directly.

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = dashboardLayout.indexOf(active.id as string);
      const newIndex = dashboardLayout.indexOf(over.id as string);

      const newLayout = arrayMove(dashboardLayout, oldIndex, newIndex);
      updateDashboardLayout(newLayout);
      
      // We should ideally sync this to DB here.
      import('@/lib/supabase/client').then(({ getSupabaseClient }) => {
        getSupabaseClient().auth.getSession().then(({ data }) => {
          if (data?.session?.user) {
            import('@/lib/db').then(({ updateSettings }) => {
              updateSettings({
                userId: data.session!.user.id,
                dashboardLayout: newLayout
              });
            });
          }
        });
      });
    }
  };

  // Filter out any widgets from layout that are not provided in `widgets` prop
  const activeLayout = useMemo(() => {
    // Add any widgets not in layout to the end
    const availableWidgets = Object.keys(widgets);
    const layoutMap = new Set(dashboardLayout);
    const missing = availableWidgets.filter(w => !layoutMap.has(w));
    
    return [...dashboardLayout.filter(id => widgets[id]), ...missing];
  }, [dashboardLayout, widgets]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={activeLayout}
        strategy={rectSortingStrategy}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 w-full">
          {activeLayout.map((id) => {
            // Provide different column spans based on the widget
            let colSpan = 'lg:col-span-12'; // default full width
            
            if (id === 'habit-overview') colSpan = 'lg:col-span-6';
            if (id === 'focus-goal') colSpan = 'lg:col-span-6';
            if (id === 'ai-quote') colSpan = 'lg:col-span-12';
            if (id === 'ai-coach') colSpan = 'lg:col-span-12';
            if (id === 'quick-actions') colSpan = 'lg:col-span-12';
            if (id === 'today-tasks') colSpan = 'lg:col-span-12';
            if (id === 'metrics') colSpan = 'lg:col-span-12';

            return (
              <div key={id} className={`w-full ${colSpan}`}>
                <SortableWidget id={id} disableDrag={id === 'hero'}>
                  {widgets[id]}
                </SortableWidget>
              </div>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
