import { create } from 'zustand';
import type { UnifiedAdvanceAlert } from './alert-computation';

interface UnifiedAlertStoreState {
  alerts: UnifiedAdvanceAlert[];
  dismissedIds: string[];
  hasScanned: boolean;
  notificationPermission: NotificationPermission | 'unsupported';
  setAlerts: (alerts: UnifiedAdvanceAlert[]) => void;
  dismissAlert: (id: string) => void;
  syncPermissionState: () => void;
  requestBrowserPermission: () => Promise<NotificationPermission | 'unsupported'>;
}

function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export const useUnifiedAlertStore = create<UnifiedAlertStoreState>((set) => ({
  alerts: [],
  dismissedIds: [],
  hasScanned: false,
  notificationPermission: getBrowserNotificationPermission(),
  setAlerts: (alerts) => set({ alerts, hasScanned: true }),
  dismissAlert: (id) =>
    set((s) => ({
      dismissedIds: s.dismissedIds.includes(id) ? s.dismissedIds : [...s.dismissedIds, id],
    })),
  syncPermissionState: () => set({ notificationPermission: getBrowserNotificationPermission() }),
  requestBrowserPermission: async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      set({ notificationPermission: 'unsupported' });
      return 'unsupported';
    }
    const result = await Notification.requestPermission();
    set({ notificationPermission: result });
    return result;
  },
}));
