'use client';

import React, { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
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
import { Button } from '@/components/ui/button';
import { LayoutGrid, Check, Eye, RefreshCw, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DashboardWidgetConfig } from '@/lib/types';

interface BentoGridProps {
  widgets: Record<string, React.ReactNode>;
}

export function BentoGrid({ widgets }: BentoGridProps) {
  const [isCustomizing, setIsCustomizing] = useState(false);
  
  const { dashboardLayout, updateDashboardLayout } = useUIStore(
    useShallow((s) => ({
      dashboardLayout: s.dashboardLayout,
      updateDashboardLayout: s.updateDashboardLayout
    }))
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = dashboardLayout.findIndex(w => w.id === active.id);
      const newIndex = dashboardLayout.findIndex(w => w.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newLayout = arrayMove(dashboardLayout, oldIndex, newIndex);
        updateDashboardLayout(newLayout);
      }
    }
  };

  // Filter out any widgets from layout that are not provided in `widgets` prop
  const activeLayout = useMemo(() => {
    const availableWidgets = Object.keys(widgets);
    const layoutMap = new Set(dashboardLayout.map(w => w.id));
    
    // Default initializer for widgets not present in layout
    const missing: DashboardWidgetConfig[] = availableWidgets
      .filter(w => !layoutMap.has(w))
      .map(w => {
        let size: DashboardWidgetConfig['size'] = 'full';
        if (w === 'habit-overview' || w === 'focus-goal' || w === 'weekly-review') {
          size = '1/2';
        }
        return { id: w, size, hidden: false, pinned: false };
      });
    
    // Keep configurations for widgets that actually exist in the widgets prop
    const existing = dashboardLayout.filter(w => widgets[w.id]);
    return [...existing, ...missing];
  }, [dashboardLayout, widgets]);

  const visibleWidgets = useMemo(() => activeLayout.filter(w => !w.hidden), [activeLayout]);
  const hiddenWidgets = useMemo(() => activeLayout.filter(w => w.hidden), [activeLayout]);

  const persistLayoutChanges = async (newLayout: DashboardWidgetConfig[]) => {
    updateDashboardLayout(newLayout);
    try {
      const { getSupabaseClient } = await import('@/lib/supabase/client');
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        const { updateSettings } = await import('@/lib/db');
        await updateSettings({
          userId: data.session.user.id,
          dashboardLayout: newLayout
        });
      }
    } catch (e) {
      console.error("Failed to sync layout configuration:", e);
    }
  };

  const handleTogglePin = (widgetId: string) => {
    const newLayout = dashboardLayout.map(w => {
      if (w.id === widgetId) {
        return { ...w, pinned: !w.pinned };
      }
      return w;
    });
    updateDashboardLayout(newLayout);
  };

  const handleResize = (widgetId: string, newSize: DashboardWidgetConfig['size']) => {
    const newLayout = dashboardLayout.map(w => {
      if (w.id === widgetId) {
        return { ...w, size: newSize };
      }
      return w;
    });
    updateDashboardLayout(newLayout);
  };

  const handleHide = (widgetId: string) => {
    const newLayout = dashboardLayout.map(w => {
      if (w.id === widgetId) {
        return { ...w, hidden: true };
      }
      return w;
    });
    updateDashboardLayout(newLayout);
  };

  const handleShow = (widgetId: string) => {
    const newLayout = dashboardLayout.map(w => {
      if (w.id === widgetId) {
        return { ...w, hidden: false };
      }
      return w;
    });
    updateDashboardLayout(newLayout);
  };

  const handleResetLayout = async () => {
    const defaultLayout: DashboardWidgetConfig[] = [
      { id: 'metrics', size: 'full', hidden: false, pinned: true },
      { id: 'today-tasks', size: 'full', hidden: false, pinned: false },
      { id: 'habit-overview', size: '1/2', hidden: false, pinned: false },
      { id: 'focus-goal', size: '1/2', hidden: false, pinned: false },
      { id: 'ai-coach', size: '1/2', hidden: false, pinned: false },
      { id: 'weekly-review', size: '1/2', hidden: false, pinned: false }
    ];
    await persistLayoutChanges(defaultLayout);
  };

  const handleDoneCustomizing = async () => {
    setIsCustomizing(false);
    await persistLayoutChanges(dashboardLayout);
  };

  return (
    <div className="space-y-6 w-full relative">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleWidgets.map(w => w.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 w-full items-stretch">
            {visibleWidgets.map((widget) => {
              const id = widget.id;
              
              // Map size to grid layout classes
              let colSpan = 'lg:col-span-12';
              if (widget.size === '1/4') colSpan = 'lg:col-span-3 md:col-span-6 col-span-12';
              else if (widget.size === '1/2') colSpan = 'lg:col-span-6 md:col-span-6 col-span-12';
              else if (widget.size === '2/3') colSpan = 'lg:col-span-8 md:col-span-12 col-span-12';
              else if (widget.size === 'full') colSpan = 'lg:col-span-12 md:col-span-12 col-span-12';

              return (
                <div key={id} className={`w-full h-full ${colSpan} transition-all duration-300`}>
                  <SortableWidget
                    id={id}
                    disableDrag={widget.pinned || id === 'hero'}
                    isCustomizing={isCustomizing}
                    pinned={widget.pinned}
                    size={widget.size}
                    onTogglePin={() => handleTogglePin(id)}
                    onResize={(sz) => handleResize(id, sz)}
                    onHide={() => handleHide(id)}
                  >
                    {widgets[id]}
                  </SortableWidget>
                </div>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Control bar */}
      <div className="flex items-center justify-between bg-card/40 dark:bg-slate-900/30 backdrop-blur border border-border/40 p-3 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-indigo-500" />
          <span className="text-sm font-semibold text-foreground">Dashboard Customization</span>
        </div>
        <div className="flex gap-2">
          {isCustomizing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetLayout}
                className="text-xs h-8 border-border/80"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Reset Layout
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleDoneCustomizing}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 shadow-md"
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                Done
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCustomizing(true)}
              className="text-xs h-8 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 font-semibold"
            >
              <LayoutGrid className="w-3.5 h-3.5 mr-1" />
              Customize Layout
            </Button>
          )}
        </div>
      </div>

      {/* Hidden Widgets Drawer */}
      <AnimatePresence>
        {isCustomizing && hiddenWidgets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="sticky bottom-6 left-0 right-0 bg-background/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl rounded-2xl border border-indigo-500/30 p-4 z-40 max-w-4xl mx-auto"
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <Eye className="w-4 h-4 text-indigo-500" />
                Hidden Widgets ({hiddenWidgets.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {hiddenWidgets.map((widget) => {
                  const widgetName = widget.id
                    .replace('-', ' ')
                    .replace(/\b\w/g, c => c.toUpperCase());
                  return (
                    <Button
                      key={widget.id}
                      variant="outline"
                      size="sm"
                      onClick={() => handleShow(widget.id)}
                      className="text-xs h-8 border-indigo-200 dark:border-indigo-900 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl"
                    >
                      <Sparkles className="w-3 h-3 mr-1.5" />
                      Add {widgetName}
                    </Button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
