import { create } from 'zustand';
import type { Category, ModalState, DashboardWidgetConfig } from '../types';

interface UIState {
  // Theme
  theme: 'light' | 'dark' | 'system';
  
  // Modal state
  modal: ModalState;
  
  // Sidebar
  sidebarOpen: boolean;
  
  // Loading states
  globalLoading: boolean;
  
  // Toast/notifications
  toasts: Toast[];
  
  // Dashboard Layout
  dashboardLayout: DashboardWidgetConfig[];
  
  // Actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  openModal: (type: ModalState['type'], data?: unknown) => void;
  closeModal: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setGlobalLoading: (loading: boolean) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  updateDashboardLayout: (layout: DashboardWidgetConfig[]) => void;
  loadDashboardLayout: (userId: string) => Promise<void>;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
  duration?: number;
}

export const normalizeLayout = (layout?: any[]): DashboardWidgetConfig[] => {
  const defaultLayout: DashboardWidgetConfig[] = [
    { id: 'metrics', size: 'full', hidden: false, pinned: true },
    { id: 'today-tasks', size: 'full', hidden: false, pinned: false },
    { id: 'habit-overview', size: '1/2', hidden: false, pinned: false },
    { id: 'focus-goal', size: '1/2', hidden: false, pinned: false },
    { id: 'ai-quote', size: 'full', hidden: false, pinned: false },
    { id: 'ai-coach', size: '1/2', hidden: false, pinned: false },
    { id: 'weekly-review', size: '1/2', hidden: false, pinned: false }
  ];

  if (!layout || !Array.isArray(layout) || layout.length === 0) {
    return defaultLayout;
  }

  const normalized = layout.map(item => {
    if (typeof item === 'string') {
      const defaultMatch = defaultLayout.find(d => d.id === item);
      return {
        id: item,
        size: defaultMatch?.size || 'full',
        hidden: false,
        pinned: item === 'hero' || item === 'metrics'
      };
    }
    return {
      id: item.id,
      size: item.size || 'full',
      hidden: !!item.hidden,
      pinned: !!item.pinned
    };
  });

  // Ensure all defaultLayout widgets exist in the returned layout
  const existingIds = new Set(normalized.map(n => n.id));
  const missing = defaultLayout.filter(d => !existingIds.has(d.id));

  return [...normalized, ...missing];
};

export const useUIStore = create<UIState>((set, get) => ({
  theme: 'system',
  modal: { isOpen: false, type: null },
  sidebarOpen: false,
  globalLoading: false,
  toasts: [],
  dashboardLayout: normalizeLayout([]),

  setTheme: (theme) => {
    set({ theme });
    localStorage.setItem('theme', theme);
  },

  openModal: (type, data) => {
    set({ modal: { isOpen: true, type, data } });
  },

  closeModal: () => {
    set({ modal: { isOpen: false, type: null, data: undefined } });
  },

  toggleSidebar: () => {
    set(state => ({ sidebarOpen: !state.sidebarOpen }));
  },

  setSidebarOpen: (open) => {
    set({ sidebarOpen: open });
  },

  setGlobalLoading: (loading) => {
    set({ globalLoading: loading });
  },

  addToast: (toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast = { ...toast, id };
    
    set(state => ({ toasts: [...state.toasts, newToast] }));
    
    // Auto-remove after duration
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
  },

  removeToast: (id) => {
    set(state => ({
      toasts: state.toasts.filter(t => t.id !== id),
    }));
  },

  updateDashboardLayout: (layout) => {
    set({ dashboardLayout: layout });
  },

  loadDashboardLayout: async (userId) => {
    try {
      const { getSettings } = await import('../db');
      const settings = await getSettings(userId);
      if (settings?.dashboardLayout) {
        set({ dashboardLayout: normalizeLayout(settings.dashboardLayout) });
      }
    } catch (e) {
      console.error("Failed to load dashboard layout", e);
    }
  }
}));
