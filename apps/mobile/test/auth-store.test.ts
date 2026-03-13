import { beforeEach, describe, expect, it, vi } from 'vitest';

const secureStoreState = new Map<string, string>();
type AuthStoreModule = {
  useAuthStore: {
    getState: () => {
      isAuthenticated: boolean;
      isHydrated: boolean;
      loadStoredAuth: () => Promise<void>;
      player: { hasCharacter: boolean; nickname: string } | null;
      refreshToken: string | null;
      register: (input: {
        confirmPassword: string;
        email: string;
        nickname: string;
        password: string;
      }) => Promise<void>;
      token: string | null;
    };
  };
};

const apiState = {
  get: vi.fn(),
  post: vi.fn(),
};

const installAuthInterceptors = vi.fn();

vi.mock('expo-secure-store', () => ({
  deleteItemAsync: vi.fn(async (key: string) => {
    secureStoreState.delete(key);
  }),
  getItemAsync: vi.fn(async (key: string) => secureStoreState.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    secureStoreState.set(key, value);
  }),
}));

vi.mock('../src/services/api', () => ({
  authApi: {
    login: (input: unknown) =>
      apiState.post('/auth/login', input).then((response: { data: unknown }) => response.data),
    refresh: (input: unknown) =>
      apiState.post('/auth/refresh', input).then((response: { data: unknown }) => response.data),
    register: (input: unknown) =>
      apiState.post('/auth/register', input).then((response: { data: unknown }) => response.data),
  },
  formatApiError: (error: unknown) => {
    const maybeError = error as { response?: { data?: { message?: string } } };
    const message = maybeError.response?.data?.message;
    return message ? new Error(message) : error instanceof Error ? error : new Error('api error');
  },
  installAuthInterceptors,
  inventoryApi: {
    consume: (inventoryItemId: string) =>
      apiState.post(`/inventory/${inventoryItemId}/consume`).then((response: { data: unknown }) => response.data),
    repair: (inventoryItemId: string) =>
      apiState.post(`/inventory/${inventoryItemId}/repair`).then((response: { data: unknown }) => response.data),
  },
  playerApi: {
    createCharacter: (input: unknown) =>
      apiState.post('/players/create', input).then((response: { data: unknown }) => response.data),
    getProfile: () =>
      apiState.get('/players/me').then((response: { data: unknown }) => response.data),
  },
  api: {
    get: (...args: unknown[]) => apiState.get(...args),
    post: (...args: unknown[]) => apiState.post(...args),
    interceptors: {
      request: {
        use: vi.fn(),
      },
      response: {
        use: vi.fn(),
      },
    },
  },
}));

describe('auth store', () => {
  beforeEach(async () => {
    secureStoreState.clear();
    apiState.get.mockReset();
    apiState.post.mockReset();
    installAuthInterceptors.mockClear();

    vi.resetModules();
  });

  it('registers, stores tokens and hydrates the player profile', async () => {
    apiState.post.mockResolvedValueOnce({
      data: {
        accessToken: 'access-1',
        expiresIn: 900,
        player: {
          id: 'player-1',
          nickname: 'Player_01',
        },
        refreshExpiresIn: 2592000,
        refreshToken: 'refresh-1',
      },
    });
    apiState.get.mockResolvedValueOnce({
      data: {
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
        hasCharacter: false,
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
          conceito: 0,
          hp: 100,
          morale: 100,
          money: 0,
          nerve: 100,
          stamina: 100,
        },
        title: 'pivete',
        vocation: 'cria',
      },
    });

    const { useAuthStore } = await vi.importActual<AuthStoreModule>('../src/stores/authStore');

    await useAuthStore.getState().register({
      confirmPassword: 'segredo123',
      email: 'player01@csrio.test',
      nickname: 'Player_01',
      password: 'segredo123',
    });

    expect(secureStoreState.get('cs_rio_access_token')).toBe('access-1');
    expect(secureStoreState.get('cs_rio_refresh_token')).toBe('refresh-1');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().player?.nickname).toBe('Player_01');
  });

  it('loads stored auth and refreshes the session after a 401 on /players/me', async () => {
    secureStoreState.set('cs_rio_access_token', 'expired-access');
    secureStoreState.set('cs_rio_refresh_token', 'refresh-2');

    apiState.get.mockRejectedValueOnce({
      response: {
        status: 401,
      },
    });
    apiState.post.mockResolvedValueOnce({
      data: {
        accessToken: 'access-2',
        expiresIn: 900,
        player: {
          id: 'player-2',
          nickname: 'Player_02',
        },
        refreshExpiresIn: 2592000,
        refreshToken: 'refresh-2b',
      },
    });
    apiState.get.mockResolvedValueOnce({
      data: {
        appearance: {
          hair: 'tranca_media',
          outfit: 'camisa_flamengo',
          skin: 'pele_escura',
        },
        attributes: {
          carisma: 10,
          forca: 25,
          inteligencia: 20,
          resistencia: 15,
        },
        faction: null,
        hasCharacter: true,
        id: 'player-2',
        inventory: [],
        level: 1,
        location: {
          positionX: 102,
          positionY: 96,
          regionId: 'centro',
        },
        nickname: 'Player_02',
        properties: [],
        regionId: 'centro',
        resources: {
          addiction: 0,
          bankMoney: 0,
          conceito: 0,
          hp: 100,
          morale: 100,
          money: 0,
          nerve: 100,
          stamina: 100,
        },
        title: 'pivete',
        vocation: 'soldado',
      },
    });

    const { useAuthStore } = await vi.importActual<AuthStoreModule>('../src/stores/authStore');

    await useAuthStore.getState().loadStoredAuth();

    expect(useAuthStore.getState().isHydrated).toBe(true);
    expect(useAuthStore.getState().token).toBe('access-2');
    expect(useAuthStore.getState().refreshToken).toBe('refresh-2b');
    expect(useAuthStore.getState().player?.hasCharacter).toBe(true);
  });
});
