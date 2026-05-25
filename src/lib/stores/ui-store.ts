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
  
  // Actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  openModal: (type: ModalState['type'], data?: unknown) => void;
  closeModal: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setGlobalLoading: (loading: boolean) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
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
}));
