import { type AssassinationContractNotification, type PlayerProfile } from '@cs-rio/shared';

import { type EventNotificationItem } from './events';
import { resolveContractNotificationLabel } from './contracts';

export type NotificationPermissionState = 'denied' | 'granted' | 'undetermined';

export interface LocalNotificationDraft {
  body: string;
  key: string;
  secondsUntilTrigger?: number;
  title: string;
}

export function buildAttackNotificationDraft(
  notification: AssassinationContractNotification,
): LocalNotificationDraft {
  return {
    body: notification.message,
    key: `attack:${notification.id}`,
    title: resolveContractNotificationLabel(notification.type),
  };
}

export function buildEventNotificationDraft(
  notification: EventNotificationItem,
): LocalNotificationDraft {
  return {
    body: notification.body,
    key: `event:${notification.id}`,
    title: notification.title,
  };
}

export function buildTimerNotificationDrafts(
  player: Pick<PlayerProfile, 'hospitalization' | 'prison'> | null | undefined,
  nowMs = Date.now(),
): LocalNotificationDraft[] {
  if (!player) {
    return [];
  }

  const drafts: LocalNotificationDraft[] = [];

  if (player.prison?.isImprisoned && player.prison.endsAt) {
    const remainingSeconds = Math.ceil((new Date(player.prison.endsAt).getTime() - nowMs) / 1000);

    if (remainingSeconds > 1) {
      drafts.push({
        body: 'Sua pena terminou. Volte ao jogo e confira as opções liberadas.',
        key: `timer:prison:${player.prison.endsAt}`,
        secondsUntilTrigger: remainingSeconds,
        title: 'Prisão: soltura disponível',
      });
    }
  }

  if (player.hospitalization?.isHospitalized && player.hospitalization.endsAt) {
    const remainingSeconds = Math.ceil(
      (new Date(player.hospitalization.endsAt).getTime() - nowMs) / 1000,
    );

    if (remainingSeconds > 1) {
      drafts.push({
        body: 'A internação terminou. Volte ao jogo para retomar o fluxo do personagem.',
        key: `timer:hospital:${player.hospitalization.endsAt}`,
        secondsUntilTrigger: remainingSeconds,
        title: 'Hospital: alta liberada',
      });
    }
  }

  return drafts;
}

export function formatNotificationPermissionStatus(
  status: NotificationPermissionState,
): string {
  switch (status) {
    case 'granted':
      return 'Permitidas';
    case 'denied':
      return 'Bloqueadas';
    case 'undetermined':
    default:
      return 'Não definidas';
  }
}
