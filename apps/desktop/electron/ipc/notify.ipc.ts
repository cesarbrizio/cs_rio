import { ipcMain, Notification } from 'electron';

import { shouldShowNativeNotifications } from '../runtime/shellState';

const scheduledNotifications = new Map<string, NodeJS.Timeout>();
const NOTIFY_CANCEL_ALL_CHANNEL = 'notify:cancel-all';
const NOTIFY_CANCEL_CHANNEL = 'notify:cancel';
const NOTIFY_HAS_PERMISSION_CHANNEL = 'notify:has-permission';
const NOTIFY_PERMISSION_CHANNEL = 'notify:request-permission';
const NOTIFY_SCHEDULE_CHANNEL = 'notify:schedule';
const NOTIFY_SHOW_CHANNEL = 'notify:show';

function cancelScheduledNotification(id: string): void {
  const timeout = scheduledNotifications.get(id);

  if (!timeout) {
    return;
  }

  clearTimeout(timeout);
  scheduledNotifications.delete(id);
}

export function registerNotifyIpcHandlers(): void {
  ipcMain.removeHandler(NOTIFY_HAS_PERMISSION_CHANNEL);
  ipcMain.removeHandler(NOTIFY_SHOW_CHANNEL);
  ipcMain.removeHandler(NOTIFY_SCHEDULE_CHANNEL);
  ipcMain.removeHandler(NOTIFY_CANCEL_CHANNEL);
  ipcMain.removeHandler(NOTIFY_CANCEL_ALL_CHANNEL);
  ipcMain.removeHandler(NOTIFY_PERMISSION_CHANNEL);

  ipcMain.handle(NOTIFY_HAS_PERMISSION_CHANNEL, async () => Notification.isSupported());

  ipcMain.handle(NOTIFY_SHOW_CHANNEL, async (_event, title: string, body: string) => {
    if (!Notification.isSupported() || !shouldShowNativeNotifications()) {
      return false;
    }

    new Notification({
      body,
      title,
    }).show();

    return true;
  });

  ipcMain.handle(
    NOTIFY_SCHEDULE_CHANNEL,
    async (
      _event,
      payload: { body: string; id: string; title: string; triggerAt: number },
    ) => {
      if (!Notification.isSupported()) {
        return false;
      }

      cancelScheduledNotification(payload.id);

      const delayMs = Math.max(0, payload.triggerAt - Date.now());
      const timeout = setTimeout(() => {
        if (!shouldShowNativeNotifications()) {
          scheduledNotifications.delete(payload.id);
          return;
        }

        new Notification({
          body: payload.body,
          title: payload.title,
        }).show();
        scheduledNotifications.delete(payload.id);
      }, delayMs);

      scheduledNotifications.set(payload.id, timeout);

      return true;
    },
  );

  ipcMain.handle(NOTIFY_CANCEL_CHANNEL, async (_event, id: string) => {
    cancelScheduledNotification(id);
  });

  ipcMain.handle(NOTIFY_CANCEL_ALL_CHANNEL, async () => {
    for (const id of scheduledNotifications.keys()) {
      cancelScheduledNotification(id);
    }
  });

  ipcMain.handle(NOTIFY_PERMISSION_CHANNEL, async () => Notification.isSupported());
}
