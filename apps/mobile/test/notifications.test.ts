import { describe, expect, it } from 'vitest';

import {
  buildAttackNotificationDraft,
  buildAsyncActivityNotificationDraft,
  buildEventNotificationDraft,
  buildEventResultNotificationDraft,
  buildPrivateMessageNotificationDraft,
  buildSabotageNotificationDraft,
  buildTerritoryLossNotificationDraft,
  buildTimerNotificationDrafts,
  buildTribunalCueNotificationDraft,
  buildWarResultNotificationDraft,
  formatNotificationPermissionStatus,
} from '../src/features/notifications';

describe('notification helpers', () => {
  it('builds local drafts for events and attack alerts', () => {
    expect(
      buildEventNotificationDraft({
        body: 'BOPE subiu o morro.',
        id: 'evt-1',
        title: 'Faca na Caveira',
      } as never),
    ).toEqual({
      body: 'BOPE subiu o morro.',
      key: 'event:evt-1',
      title: 'Faca na Caveira',
    });

    expect(
      buildAttackNotificationDraft({
        id: 'atk-1',
        message: 'Seu alvo foi avisado.',
        type: 'target_warned',
      } as never),
    ).toEqual({
      body: 'Seu alvo foi avisado.',
      key: 'attack:atk-1',
      title: 'Alvo avisado',
    });

    expect(
      buildWarResultNotificationDraft({
        body: 'CV venceu. Complexo da Penha mudou de dono.',
        key: 'war:1',
        title: 'Complexo da Penha: CV venceu',
      }),
    ).toEqual({
      body: 'CV venceu. Complexo da Penha mudou de dono.',
      key: 'war:1',
      title: 'Complexo da Penha: CV venceu',
    });

    expect(
      buildAsyncActivityNotificationDraft({
        body: 'Mão Leve terminou e o passivo já foi aplicado.',
        key: 'university:mao_leve:2026-03-14T12:10:00.000Z',
        title: 'Mão Leve concluído',
      }),
    ).toEqual({
      body: 'Mão Leve terminou e o passivo já foi aplicado.',
      key: 'university:mao_leve:2026-03-14T12:10:00.000Z',
      title: 'Mão Leve concluído',
    });

    expect(
      buildTerritoryLossNotificationDraft({
        body: 'CV perdeu o Morro da Coroa. Controle agora com Estado.',
        key: 'territory-loss:war_defeat:favela-1:faction-cv:state:2026-03-11T13:00:00.000Z',
        title: 'Morro da Coroa: tomada estatal',
      } as never),
    ).toEqual({
      body: 'CV perdeu o Morro da Coroa. Controle agora com Estado.',
      key: 'territory-loss:war_defeat:favela-1:faction-cv:state:2026-03-11T13:00:00.000Z',
      title: 'Morro da Coroa: tomada estatal',
    });

    expect(
      buildEventResultNotificationDraft({
        body: 'A janela premium das docas fechou no Centro.',
        key: 'event-result:dock-1:2026-03-11T17:00:00.000Z',
        title: 'Navio nas Docas · Centro',
      }),
    ).toEqual({
        body: 'A janela premium das docas fechou no Centro.',
        key: 'event-result:dock-1:2026-03-11T17:00:00.000Z',
        title: 'Navio nas Docas · Centro',
      });

    expect(
      buildPrivateMessageNotificationDraft({
        body: 'Chega no barraco agora.',
        key: 'private-message:partner-1:msg-1',
        title: 'Mensagem de Radar',
      }),
    ).toEqual({
      body: 'Chega no barraco agora.',
      key: 'private-message:partner-1:msg-1',
      title: 'Mensagem de Radar',
    });

    expect(
      buildSabotageNotificationDraft({
        body: 'Sua boca foi destruída e travou até a reconstrução.',
        key: 'sabotage:defense:log-1:2026-03-16T10:00:00.000Z',
        title: 'Boca: alerta de sabotagem',
      }),
    ).toEqual({
      body: 'Sua boca foi destruída e travou até a reconstrução.',
      key: 'sabotage:defense:log-1:2026-03-16T10:00:00.000Z',
      title: 'Boca: alerta de sabotagem',
    });

    expect(
      buildTribunalCueNotificationDraft({
        body: 'Você perdeu o prazo e o comando local decidiu o tribunal.',
        key: 'tribunal:resolved:case-1:2026-03-11T13:30:00.000Z',
        title: 'Tribunal decidido sem você · Morro da Coroa',
      } as never),
    ).toEqual({
      body: 'Você perdeu o prazo e o comando local decidiu o tribunal.',
      key: 'tribunal:resolved:case-1:2026-03-11T13:30:00.000Z',
      title: 'Tribunal decidido sem você · Morro da Coroa',
    });
  });

  it('creates timer reminders for prison, hospital, training and university states', () => {
    const drafts = buildTimerNotificationDrafts(
      {
        player: {
          hospitalization: {
            endsAt: new Date('2026-03-12T04:10:00.000Z').toISOString(),
            isHospitalized: true,
          },
          prison: {
            endsAt: new Date('2026-03-12T04:05:00.000Z').toISOString(),
            isImprisoned: true,
          },
        } as never,
        trainingSession: {
          endsAt: new Date('2026-03-12T04:15:00.000Z').toISOString(),
          id: 'session-1',
          readyToClaim: false,
          type: 'advanced',
        },
        universityCourse: {
          code: 'mao_leve',
          endsAt: new Date('2026-03-12T04:20:00.000Z').toISOString(),
          isInProgress: true,
          label: 'Mão Leve',
        },
      },
      new Date('2026-03-12T04:00:00.000Z').getTime(),
    );

    expect(drafts).toHaveLength(4);
    expect(drafts.some((draft) => draft.key.includes('timer:prison:'))).toBe(true);
    expect(drafts.some((draft) => draft.key.includes('timer:hospital:'))).toBe(true);
    expect(drafts.some((draft) => draft.key.includes('timer:training:'))).toBe(true);
    expect(drafts.some((draft) => draft.key.includes('timer:university:'))).toBe(true);
  });

  it('formats permission labels for settings UI', () => {
    expect(formatNotificationPermissionStatus('granted')).toBe('Permitidas');
    expect(formatNotificationPermissionStatus('denied')).toBe('Bloqueadas');
    expect(formatNotificationPermissionStatus('undetermined')).toBe('Não definidas');
  });
});
