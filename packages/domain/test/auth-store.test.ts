import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAuthStore } from '../src/stores/authStore';

const storageState = new Map<string, string>();

const storage = {
  getItem: vi.fn(async (key: string) => storageState.get(key) ?? null),
  removeItem: vi.fn(async (key: string) => {
    storageState.delete(key);
  }),
  setItem: vi.fn(async (key: string, value: string) => {
    storageState.set(key, value);
  }),
};

const authApi = {
  login: vi.fn(),
  refresh: vi.fn(),
  register: vi.fn(),
};

const playerApi = {
  createCharacter: vi.fn(),
  getProfile: vi.fn(),
  travel: vi.fn(),
};

const installAuthInterceptors = vi.fn();
const installApiObservabilityInterceptors = vi.fn();
const onLogout = vi.fn();

describe('createAuthStore', () => {
  beforeEach(() => {
    storageState.clear();
    storage.getItem.mockClear();
    storage.removeItem.mockClear();
    storage.setItem.mockClear();
    authApi.login.mockReset();
    authApi.refresh.mockReset();
    authApi.register.mockReset();
    playerApi.createCharacter.mockReset();
    playerApi.getProfile.mockReset();
    playerApi.travel.mockReset();
    installAuthInterceptors.mockClear();
    installApiObservabilityInterceptors.mockClear();
    onLogout.mockClear();
  });

  it('registers, persists tokens and hydrates the profile', async () => {
    authApi.register.mockResolvedValue({
      accessToken: 'access-1',
      expiresIn: 900,
      player: {
        id: 'player-1',
        nickname: 'Player_01',
      },
      refreshExpiresIn: 2592000,
      refreshToken: 'refresh-1',
    });
    playerApi.getProfile.mockResolvedValue({
      appearance: {
        hair: 'corte_curto',
        outfit: 'camisa_branca',
        skin: 'pele_media',
      },
      attributes: {
        carisma: 10,
        forca: 30,
        inteligencia: 10,
        resistencia: 20,
      },
      faction: null,
      hasCharacter: true,
      id: 'player-1',
      inventory: [],
      level: 1,
      location: {
        positionX: 0,
        positionY: 0,
        regionId: 'centro',
      },
      nickname: 'Player_01',
      properties: [],
      regionId: 'centro',
      resources: {
        addiction: 0,
        bankMoney: 0,
        brisa: 100,
        cansaco: 100,
        conceito: 0,
        disposicao: 100,
        hp: 100,
        money: 0,
      },
      title: 'pivete',
      vocation: 'cria',
    });

    const useAuthStore = createAuthStore({
      authApi,
      formatApiError: (error) =>
        error instanceof Error ? error : new Error('api error'),
      installApiObservabilityInterceptors,
      installAuthInterceptors,
      onLogout,
      playerApi,
      storage,
    });

    await useAuthStore.getState().register({
      confirmPassword: 'segredo123',
      email: 'player01@csrio.test',
      nickname: 'Player_01',
      password: 'segredo123',
    });

    expect(installAuthInterceptors).toHaveBeenCalledTimes(1);
    expect(installApiObservabilityInterceptors).toHaveBeenCalledTimes(1);
    expect(storageState.get('cs_rio_access_token')).toBe('access-1');
    expect(storageState.get('cs_rio_refresh_token')).toBe('refresh-1');
    expect(useAuthStore.getState().player?.nickname).toBe('Player_01');
  });

  it('clears persisted auth and runs the logout callback', async () => {
    storageState.set('cs_rio_access_token', 'access-2');
    storageState.set('cs_rio_refresh_token', 'refresh-2');

    const useAuthStore = createAuthStore({
      authApi,
      formatApiError: (error) =>
        error instanceof Error ? error : new Error('api error'),
      installApiObservabilityInterceptors,
      installAuthInterceptors,
      onLogout,
      playerApi,
      storage,
    });

    await useAuthStore.getState().logout();

    expect(storageState.get('cs_rio_access_token')).toBeUndefined();
    expect(storageState.get('cs_rio_refresh_token')).toBeUndefined();
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
