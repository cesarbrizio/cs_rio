export interface NotificationMessage {
  body: string;
  id: string;
  title: string;
}

export interface ScheduledNotificationMessage extends NotificationMessage {
  triggerAt: Date;
}

export interface NotifyPort {
  show(message: NotificationMessage): Promise<boolean>;
  schedule(message: ScheduledNotificationMessage): Promise<boolean>;
  cancel(id: string): Promise<void>;
  cancelAll(): Promise<void>;
  requestPermission(): Promise<boolean>;
  hasPermission(): Promise<boolean>;
}
