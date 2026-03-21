import {
  type PlayerProfile,
  type UniversityCourseSummary,
} from '@cs-rio/shared';

import { type EventNotificationItem } from './events';
import { type AsyncActivityCue } from './activity-results';
import { type EventResultCue } from './event-results';
import { type FactionPromotionCue } from './faction-promotion';
import { type PrivateMessageCue } from './private-messages';
import { type TerritoryAlertCue } from './territory-alerts';
import { type TerritoryLossCue } from './territory-loss';
import { type TribunalCue } from './tribunal-results';
import { type WarResultCue } from './war-results';

export type NotificationPermissionState = 'denied' | 'granted' | 'undetermined';

export interface LocalNotificationDraft {
  body: string;
  key: string;
  secondsUntilTrigger?: number;
  title: string;
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

export function buildWarResultNotificationDraft(
  cue: Pick<WarResultCue, 'body' | 'key' | 'title'>,
): LocalNotificationDraft {
  return {
    body: cue.body,
    key: cue.key,
    title: cue.title,
  };
}

export function buildTerritoryLossNotificationDraft(
  cue: Pick<TerritoryLossCue, 'body' | 'key' | 'title'>,
): LocalNotificationDraft {
  return {
    body: cue.body,
    key: cue.key,
    title: cue.title,
  };
}

export function buildEventResultNotificationDraft(
  cue: Pick<EventResultCue, 'body' | 'key' | 'title'>,
): LocalNotificationDraft {
  return {
    body: cue.body,
    key: cue.key,
    title: cue.title,
  };
}

export function buildAsyncActivityNotificationDraft(
  cue: Pick<AsyncActivityCue, 'body' | 'key' | 'title'>,
): LocalNotificationDraft {
  return {
    body: cue.body,
    key: cue.key,
    title: cue.title,
  };
}

export function buildFactionPromotionNotificationDraft(
  cue: Pick<FactionPromotionCue, 'body' | 'key' | 'title'>,
): LocalNotificationDraft {
  return {
    body: cue.body,
    key: cue.key,
    title: cue.title,
  };
}

export function buildTerritoryAlertNotificationDraft(
  cue: Pick<TerritoryAlertCue, 'body' | 'key' | 'title'>,
): LocalNotificationDraft {
  return {
    body: cue.body,
    key: cue.key,
    title: cue.title,
  };
}

export function buildPrivateMessageNotificationDraft(
  cue: Pick<PrivateMessageCue, 'body' | 'key' | 'title'>,
): LocalNotificationDraft {
  return {
    body: cue.body,
    key: cue.key,
    title: cue.title,
  };
}

export function buildTribunalCueNotificationDraft(
  cue: Pick<TribunalCue, 'body' | 'key' | 'title'>,
): LocalNotificationDraft {
  return {
    body: cue.body,
    key: cue.key,
    title: cue.title,
  };
}

export function buildTimerNotificationDrafts(
  input: {
    player: Pick<PlayerProfile, 'hospitalization' | 'prison'> | null | undefined;
    universityCourse?: Pick<
      UniversityCourseSummary,
      'code' | 'endsAt' | 'isInProgress' | 'label'
    > | null;
  },
  nowMs = Date.now(),
): LocalNotificationDraft[] {
  const drafts: LocalNotificationDraft[] = [];
  const player = input.player;

  if (player?.prison?.isImprisoned && player.prison.endsAt) {
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

  if (player?.hospitalization?.isHospitalized && player.hospitalization.endsAt) {
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

  if (input.universityCourse?.isInProgress && input.universityCourse.endsAt) {
    const remainingSeconds = Math.ceil(
      (new Date(input.universityCourse.endsAt).getTime() - nowMs) / 1000,
    );

    if (remainingSeconds > 1) {
      drafts.push({
        body: `${input.universityCourse.label} terminou. Volte ao jogo para revisar o passivo liberado.`,
        key: `timer:university:${input.universityCourse.code}:${input.universityCourse.endsAt}`,
        secondsUntilTrigger: remainingSeconds,
        title: 'Universidade: curso concluído',
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
