import { create } from 'zustand';
import type { Category, ModalState } from '../types';

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
  dashboardLayout: string[];
  
  // Actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  openModal: (type: ModalState['type'], data?: unknown) => void;
  closeModal: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setGlobalLoading: (loading: boolean) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  updateDashboardLayout: (layout: string[]) => void;
  loadDashboardLayout: (userId: string) => Promise<void>;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
  duration?: number;
}

export const useUIStore = create<UIState>((set, get) => ({
  theme: 'system',
  modal: { isOpen: false, type: null },
  sidebarOpen: false,
  globalLoading: false,
  toasts: [],
  dashboardLayout: [
    'hero',
    'metrics',
    'today-tasks',
    'habit-overview',
    'focus-goal',
    'ai-quote',
    'ai-coach',
    'quick-actions'
  ],

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
    // Note: To persist this to DB/SyncEngine, it will be done via a dedicated hook or effect in the component
    // or by importing getSettings/updateSettings here, but to avoid circular deps we'll do it where it's used.
  },

  loadDashboardLayout: async (userId) => {
    try {
      // Dynamic import to avoid circular dependency issues
      const { getSettings } = await import('../db');
      const settings = await getSettings(userId);
      if (settings?.dashboardLayout && settings.dashboardLayout.length > 0) {
        set({ dashboardLayout: settings.dashboardLayout });
      }
    } catch (e) {
      console.error("Failed to load dashboard layout", e);
    }
  }
}));
