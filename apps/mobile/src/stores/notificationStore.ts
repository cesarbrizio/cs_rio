import { create } from 'zustand';

import { type NotificationPermissionState } from '../features/notifications';

export interface NotificationSettingsState {
  enabled: boolean;
  permissionStatus: NotificationPermissionState;
}

interface NotificationStoreState {
  notificationSettings: NotificationSettingsState;
  resetNotificationSettings: (permissionStatus?: NotificationPermissionState) => void;
  setNotificationPermissionStatus: (status: NotificationPermissionState) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettingsState = {
  enabled: true,
  permissionStatus: 'undetermined',
};

export const useNotificationStore = create<NotificationStoreState>((set) => ({
  notificationSettings: {
    ...DEFAULT_NOTIFICATION_SETTINGS,
  },
  resetNotificationSettings: (permissionStatus) =>
    set({
      notificationSettings: {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        permissionStatus:
          permissionStatus ?? DEFAULT_NOTIFICATION_SETTINGS.permissionStatus,
      },
    }),
  setNotificationPermissionStatus: (permissionStatus) =>
    set((state) => ({
      notificationSettings: {
        ...state.notificationSettings,
        permissionStatus,
      },
    })),
  setNotificationsEnabled: (enabled) =>
    set((state) => ({
      notificationSettings: {
        ...state.notificationSettings,
        enabled,
      },
    })),
}));
