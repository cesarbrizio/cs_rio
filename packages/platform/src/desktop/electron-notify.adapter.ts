import type { NotifyPort, NotificationMessage, ScheduledNotificationMessage } from '../contracts/notify.port';

function resolveNotifyBridge(): NonNullable<NonNullable<Window['electronAPI']>['notify']> {
  if (!window.electronAPI?.notify) {
    throw new Error('Electron notify bridge indisponivel.');
  }

  return window.electronAPI.notify;
}

export const electronNotify: NotifyPort = {
  async cancel(id) {
    const notifyBridge = resolveNotifyBridge();
    await notifyBridge.cancel(id);
  },
  async cancelAll() {
    const notifyBridge = resolveNotifyBridge();
    await notifyBridge.cancelAll();
  },
  async hasPermission() {
    const notifyBridge = resolveNotifyBridge();
    return notifyBridge.hasPermission();
  },
  async requestPermission() {
    const notifyBridge = resolveNotifyBridge();
    return notifyBridge.requestPermission();
  },
  async schedule(message: ScheduledNotificationMessage) {
    const notifyBridge = resolveNotifyBridge();

    return notifyBridge.schedule({
      body: message.body,
      id: message.id,
      title: message.title,
      triggerAt: message.triggerAt.getTime(),
    });
  },
  async show(message: NotificationMessage) {
    const notifyBridge = resolveNotifyBridge();
    return notifyBridge.show(message);
  },
};
