import { describe, expect, it } from 'vitest';

import { useAppStore } from '../src/stores/appStore';

describe('app store bootstrap state', () => {
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
});
