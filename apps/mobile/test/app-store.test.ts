import { beforeEach, describe, expect, it } from 'vitest';
import { LevelTitle, VocationType } from '@cs-rio/shared';

import { useAppStore } from '../src/stores/appStore';

describe('app store bootstrap state', () => {
  beforeEach(() => {
    useAppStore.getState().resetForLogout();
  });

  it('exposes and updates bootstrap status', () => {
    expect(useAppStore.getState().bootstrapStatus).toContain('Ações rápidas');

    useAppStore.getState().setBootstrapStatus('Fluxo inicial pronto para jogar');

    expect(useAppStore.getState().bootstrapStatus).toBe('Fluxo inicial pronto para jogar');
  });

  it('clamps and updates audio settings globally', () => {
    useAppStore.getState().setMusicEnabled(false);
    useAppStore.getState().setMusicVolume(130);
    useAppStore.getState().setSfxEnabled(false);
    useAppStore.getState().setSfxVolume(-10);

    expect(useAppStore.getState().audioSettings).toEqual({
      musicEnabled: false,
      musicVolume: 100,
      sfxEnabled: false,
      sfxVolume: 0,
    });

    useAppStore.setState({
      audioSettings: {
        musicEnabled: true,
        musicVolume: 70,
        sfxEnabled: true,
        sfxVolume: 80,
      },
    });
  });

  it('tracks notification settings globally', () => {
    useAppStore.getState().setNotificationsEnabled(false);
    useAppStore.getState().setNotificationPermissionStatus('granted');

    expect(useAppStore.getState().notificationSettings).toEqual({
      enabled: false,
      permissionStatus: 'granted',
    });

    useAppStore.setState({
      notificationSettings: {
        enabled: true,
        permissionStatus: 'undetermined',
      },
    });
  });

  it('stores and resets the private message feed globally', () => {
    useAppStore.getState().setPrivateMessageFeed({
      generatedAt: '2026-03-16T16:00:00.000Z',
      threads: [
        {
          contact: {
            contactId: 'partner-1',
            faction: null,
            level: 7,
            nickname: 'Radar',
            origin: 'same_faction',
            since: '2026-03-15T10:00:00.000Z',
            title: LevelTitle.Frente,
            type: 'partner',
            vocation: VocationType.Soldado,
          },
          lastMessage: {
            id: 'msg-1',
            message: 'Chega no barraco',
            senderId: 'partner-1',
            senderNickname: 'Radar',
            sentAt: '2026-03-16T15:50:00.000Z',
          },
          messageCount: 4,
          threadId: 'owner:partner-1',
          updatedAt: '2026-03-16T15:50:00.000Z',
        },
      ],
    });

    expect(useAppStore.getState().privateMessageThreads).toHaveLength(1);
    expect(useAppStore.getState().lastPrivateMessageSyncAt).toBe('2026-03-16T16:00:00.000Z');

    useAppStore.getState().resetPrivateMessageFeed();

    expect(useAppStore.getState().privateMessageThreads).toEqual([]);
    expect(useAppStore.getState().lastPrivateMessageSyncAt).toBeNull();
  });

  it('boots and advances the interactive tutorial per player', () => {
    useAppStore.getState().bootstrapTutorial('player-1');

    expect(useAppStore.getState().tutorial.playerId).toBe('player-1');
    expect(useAppStore.getState().tutorial.startedAt).toBeTruthy();
    expect(useAppStore.getState().tutorial.completedStepIds).toEqual([]);

    useAppStore.getState().completeTutorialStep('move');
    useAppStore.getState().completeTutorialStep('crimes');
    useAppStore.getState().dismissTutorial();

    expect(useAppStore.getState().tutorial.completedStepIds).toEqual(['move', 'crimes']);
    expect(useAppStore.getState().tutorial.dismissed).toBe(true);

    useAppStore.getState().bootstrapTutorial('player-2');

    expect(useAppStore.getState().tutorial.playerId).toBe('player-2');
    expect(useAppStore.getState().tutorial.completedStepIds).toEqual([]);
    expect(useAppStore.getState().tutorial.dismissed).toBe(false);
  });

  it('resets player-scoped state on logout without losing device permission status', () => {
    useAppStore.setState({
      activeEventToast: {
        body: 'Evento em andamento',
        destination: 'map',
        id: 'event-1',
        regionLabel: 'Centro',
        remainingSeconds: 120,
        severity: 'danger',
        startedAt: '2026-03-16T17:58:00.000Z',
        title: 'Evento',
      },
      audioSettings: {
        musicEnabled: false,
        musicVolume: 10,
        sfxEnabled: false,
        sfxVolume: 20,
      },
      bootstrapStatus: 'Estado temporario',
      dismissedEventIds: ['event-1'],
      eventBanner: {
        body: 'Banner',
        destination: 'territory',
        id: 'event-1',
        regionLabel: 'Zona Norte',
        remainingSeconds: 240,
        severity: 'warning',
        startedAt: '2026-03-16T17:56:00.000Z',
        title: 'Evento',
      },
      eventNotifications: [
        {
          body: 'Banner',
          destination: 'territory',
          id: 'event-1',
          regionLabel: 'Zona Norte',
          remainingSeconds: 240,
          severity: 'warning',
          startedAt: '2026-03-16T17:56:00.000Z',
          title: 'Evento',
        },
      ],
      eventResultHistory: [],
      lastEventResultSyncAt: '2026-03-16T18:00:00.000Z',
      lastEventSyncAt: '2026-03-16T18:00:00.000Z',
      lastPrivateMessageSyncAt: '2026-03-16T18:00:00.000Z',
      mapReturnCue: {
        message: 'Volte para o mapa',
      },
      notificationSettings: {
        enabled: false,
        permissionStatus: 'granted',
      },
      privateMessageThreads: [
        {
          contact: {
            contactId: 'known-1',
            faction: null,
            level: 4,
            nickname: 'Radar',
            origin: 'same_faction',
            since: '2026-03-15T10:00:00.000Z',
            title: LevelTitle.Pivete,
            type: 'known',
            vocation: VocationType.Cria,
          },
          lastMessage: {
            id: 'msg-1',
            message: 'Passa na boca',
            senderId: 'known-1',
            senderNickname: 'Radar',
            sentAt: '2026-03-16T17:50:00.000Z',
          },
          messageCount: 1,
          threadId: 'owner:known-1',
          updatedAt: '2026-03-16T17:50:00.000Z',
        },
      ],
      tutorial: {
        completedStepIds: ['move'],
        dismissed: true,
        playerId: 'player-1',
        startedAt: '2026-03-16T17:00:00.000Z',
      },
    });

    useAppStore.getState().resetForLogout();

    expect(useAppStore.getState().bootstrapStatus).toContain('Ações rápidas');
    expect(useAppStore.getState().audioSettings).toEqual({
      musicEnabled: true,
      musicVolume: 70,
      sfxEnabled: true,
      sfxVolume: 80,
    });
    expect(useAppStore.getState().notificationSettings).toEqual({
      enabled: true,
      permissionStatus: 'granted',
    });
    expect(useAppStore.getState().privateMessageThreads).toEqual([]);
    expect(useAppStore.getState().dismissedEventIds).toEqual([]);
    expect(useAppStore.getState().tutorial).toEqual({
      completedStepIds: [],
      dismissed: false,
      playerId: null,
      startedAt: null,
    });
  });
});
