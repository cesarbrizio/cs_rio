import { describe, expect, it } from 'vitest';

import {
  buildAttackNotificationDraft,
  buildEventNotificationDraft,
  buildTimerNotificationDrafts,
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
  });

  it('creates timer reminders only for active prison and hospital states', () => {
    const drafts = buildTimerNotificationDrafts(
      {
        hospitalization: {
          endsAt: new Date('2026-03-12T04:10:00.000Z').toISOString(),
          isHospitalized: true,
        },
        prison: {
          endsAt: new Date('2026-03-12T04:05:00.000Z').toISOString(),
          isImprisoned: true,
        },
      } as never,
      new Date('2026-03-12T04:00:00.000Z').getTime(),
    );

    expect(drafts).toHaveLength(2);
    expect(drafts[0]?.key).toContain('timer:prison:');
    expect(drafts[1]?.key).toContain('timer:hospital:');
  });

  it('formats permission labels for settings UI', () => {
    expect(formatNotificationPermissionStatus('granted')).toBe('Permitidas');
    expect(formatNotificationPermissionStatus('denied')).toBe('Bloqueadas');
    expect(formatNotificationPermissionStatus('undetermined')).toBe('Não definidas');
  });
});
