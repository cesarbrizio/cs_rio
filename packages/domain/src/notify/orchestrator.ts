import type { NotifyPort } from '@cs-rio/platform';

import type { LocalNotificationDraft } from './drafts';

export interface SyncDraftsInput {
  drafts: LocalNotificationDraft[];
  enabled?: boolean;
}

export class NotificationOrchestrator {
  private readonly deliveredIds = new Set<string>();

  private readonly scheduledIds = new Set<string>();

  constructor(private readonly notify: NotifyPort) {}

  async hasPermission(): Promise<boolean> {
    return this.notify.hasPermission();
  }

  async requestPermission(): Promise<boolean> {
    return this.notify.requestPermission();
  }

  async showDraft(
    draft: LocalNotificationDraft,
    options: {
      enabled?: boolean;
      force?: boolean;
    } = {},
  ): Promise<boolean> {
    if (options.enabled === false) {
      return false;
    }

    if (!options.force && this.deliveredIds.has(draft.key)) {
      return false;
    }

    const delivered = await this.notify.show({
      body: draft.body,
      id: draft.key,
      title: draft.title,
    });

    if (delivered) {
      this.deliveredIds.add(draft.key);
    }

    return delivered;
  }

  async showManyDrafts(
    drafts: LocalNotificationDraft[],
    options: {
      enabled?: boolean;
    } = {},
  ): Promise<string[]> {
    const deliveredIds: string[] = [];

    for (const draft of drafts) {
      const delivered = await this.showDraft(draft, options);

      if (delivered) {
        deliveredIds.push(draft.key);
      }
    }

    return deliveredIds;
  }

  async syncScheduledDrafts(input: SyncDraftsInput): Promise<void> {
    if (input.enabled === false) {
      await this.cancelAll();
      return;
    }

    const nextScheduledIds = new Set<string>();

    for (const draft of input.drafts) {
      if (!draft.secondsUntilTrigger || draft.secondsUntilTrigger <= 0) {
        continue;
      }

      nextScheduledIds.add(draft.key);

      if (this.scheduledIds.has(draft.key)) {
        continue;
      }

      const scheduled = await this.notify.schedule({
        body: draft.body,
        id: draft.key,
        title: draft.title,
        triggerAt: new Date(Date.now() + draft.secondsUntilTrigger * 1000),
      });

      if (scheduled) {
        this.scheduledIds.add(draft.key);
      }
    }

    for (const scheduledId of [...this.scheduledIds]) {
      if (nextScheduledIds.has(scheduledId)) {
        continue;
      }

      await this.notify.cancel(scheduledId);
      this.scheduledIds.delete(scheduledId);
    }
  }

  async cancelAll(): Promise<void> {
    await this.notify.cancelAll();
    this.scheduledIds.clear();
  }

  markDelivered(id: string): void {
    this.deliveredIds.add(id);
  }
}
