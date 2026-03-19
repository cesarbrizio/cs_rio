import type * as ExpoNotifications from 'expo-notifications';
import * as Notifications from 'expo-notifications';
import type { NotifyPort, NotificationMessage, ScheduledNotificationMessage } from '../contracts/notify.port';

type ExpoNotificationsModule = typeof ExpoNotifications;

async function loadExpoNotificationsModule(): Promise<ExpoNotificationsModule> {
  return Notifications;
}

function toDelaySeconds(triggerAt: Date): number {
  return Math.max(1, Math.ceil((triggerAt.getTime() - Date.now()) / 1000));
}

export function createExpoNotifyPort(
  loadModule: () => Promise<ExpoNotificationsModule> = loadExpoNotificationsModule,
): NotifyPort {
  return {
    async cancel(id: string) {
      const notifications = await loadModule();
      await notifications.cancelScheduledNotificationAsync(id);
    },
    async cancelAll() {
      const notifications = await loadModule();
      await notifications.cancelAllScheduledNotificationsAsync();
    },
    async hasPermission() {
      const notifications = await loadModule();
      const permissions = await notifications.getPermissionsAsync();
      return permissions.status === 'granted';
    },
    async requestPermission() {
      const notifications = await loadModule();
      const permissions = await notifications.requestPermissionsAsync();
      return permissions.status === 'granted';
    },
    async schedule(message: ScheduledNotificationMessage) {
      const notifications = await loadModule();

      await notifications.scheduleNotificationAsync({
        content: {
          body: message.body,
          data: {
            id: message.id,
          },
          sound: true,
          title: message.title,
        },
        identifier: message.id,
        trigger: {
          seconds: toDelaySeconds(message.triggerAt),
          type: notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        },
      });

      return true;
    },
    async show(message: NotificationMessage) {
      const notifications = await loadModule();

      await notifications.scheduleNotificationAsync({
        content: {
          body: message.body,
          data: {
            id: message.id,
          },
          sound: true,
          title: message.title,
        },
        identifier: message.id,
        trigger: null,
      });

      return true;
    },
  };
}

export const expoNotify = createExpoNotifyPort();
