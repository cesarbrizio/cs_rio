import {
  type AuthLoginInput,
  type AuthRegisterInput,
  type AuthSession,
  type DrugConsumeResponse,
  type PlayerCreationInput,
  type PlayerProfile,
  type RegionId,
} from '@cs-rio/shared';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import {
  authApi,
  formatApiError,
  inventoryApi,
  installAuthInterceptors,
  playerApi,
} from '../services/api';

const ACCESS_TOKEN_KEY = 'cs_rio_access_token';
const REFRESH_TOKEN_KEY = 'cs_rio_refresh_token';

interface AuthStore {
  consumeDrugInventoryItem: (inventoryItemId: string) => Promise<DrugConsumeResponse>;
  createCharacter: (input: PlayerCreationInput) => Promise<PlayerProfile>;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  loadStoredAuth: () => Promise<void>;
  login: (input: AuthLoginInput) => Promise<void>;
  logout: () => Promise<void>;
  player: PlayerProfile | null;
  refreshPlayerProfile: () => Promise<PlayerProfile | null>;
  refreshAuth: () => Promise<string | null>;
  refreshToken: string | null;
  register: (input: AuthRegisterInput & {
    confirmPassword: string;
  }) => Promise<void>;
  token: string | null;
  travelToRegion: (regionId: RegionId) => Promise<PlayerProfile>;
}

let refreshPromise: Promise<string | null> | null = null;

export const useAuthStore = create<AuthStore>((set, get) => ({
  async consumeDrugInventoryItem(inventoryItemId) {
    set({ isLoading: true });

    try {
      const response = await inventoryApi.consume(inventoryItemId);
      set({
        isLoading: false,
        player: response.player,
      });

      return response;
    } catch (error) {
      set({ isLoading: false });
      throw formatApiError(error);
    }
  },
  async createCharacter(input) {
    set({ isLoading: true });

    try {
      const payload = sanitizeCharacterCreationInput(input);
      const player = await playerApi.createCharacter(payload);
      set({
        isAuthenticated: true,
        isLoading: false,
        player,
      });

      return player;
    } catch (error) {
      set({ isLoading: false });
      throw formatApiError(error);
    }
  },
  isAuthenticated: false,
  isHydrated: false,
  isLoading: false,
  async loadStoredAuth() {
    set({ isLoading: true });

    try {
      const [token, refreshToken] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
      ]);

      if (!token || !refreshToken) {
        await clearStoredSession();
        set({
          isAuthenticated: false,
          isHydrated: true,
          isLoading: false,
          player: null,
          refreshToken: null,
          token: null,
        });
        return;
      }

      set({
        isAuthenticated: true,
        player: null,
        refreshToken,
        token,
      });

      try {
        const player = await playerApi.getProfile();
        set({
          isAuthenticated: true,
          isHydrated: true,
          isLoading: false,
          player,
        });
      } catch {
        const nextToken = await get().refreshAuth();

        if (!nextToken) {
          await get().logout();
          set({ isHydrated: true, isLoading: false });
          return;
        }

        const player = await playerApi.getProfile();
        set({
          isAuthenticated: true,
          isHydrated: true,
          isLoading: false,
          player,
          token: nextToken,
        });
      }
    } catch {
      await get().logout();
      set({
        isHydrated: true,
        isLoading: false,
      });
    }
  },
  async login(input) {
    set({ isLoading: true });

    try {
      validateEmail(input.email);
      validatePassword(input.password);

      const session = await authApi.login({
        email: input.email.trim().toLowerCase(),
        password: input.password.trim(),
      });
      const player = await applySession(session);

      set({
        isAuthenticated: true,
        isLoading: false,
        player,
        refreshToken: session.refreshToken,
        token: session.accessToken,
      });
    } catch (error) {
      set({ isLoading: false });
      throw formatApiError(error);
    }
  },
  async logout() {
    await clearStoredSession();
    set({
      isAuthenticated: false,
      isHydrated: true,
      isLoading: false,
      player: null,
      refreshToken: null,
      token: null,
    });
  },
  player: null,
  async refreshPlayerProfile() {
    const token = get().token;

    if (!token) {
      return null;
    }

    try {
      const player = await playerApi.getProfile();
      set({ player });
      return player;
    } catch (error) {
      throw formatApiError(error);
    }
  },
  async refreshAuth() {
    const currentRefreshToken = get().refreshToken;

    if (!currentRefreshToken) {
      return null;
    }

    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const session = await authApi.refresh({
            refreshToken: currentRefreshToken,
          });

          await storeSessionTokens(session.accessToken, session.refreshToken);
          set({
            isAuthenticated: true,
            refreshToken: session.refreshToken,
            token: session.accessToken,
          });

          return session.accessToken;
        } catch {
          await get().logout();
          return null;
        } finally {
          refreshPromise = null;
        }
      })();
    }

    return refreshPromise;
  },
  refreshToken: null,
  async register(input) {
    set({ isLoading: true });

    try {
      validateEmail(input.email);
      validateNickname(input.nickname);
      validatePassword(input.password);

      if (input.password !== input.confirmPassword) {
        throw new Error('As senhas não conferem.');
      }

      const session = await authApi.register({
        email: input.email.trim().toLowerCase(),
        nickname: input.nickname.trim(),
        password: input.password.trim(),
      });
      const player = await applySession(session);

      set({
        isAuthenticated: true,
        isLoading: false,
        player,
        refreshToken: session.refreshToken,
        token: session.accessToken,
      });
    } catch (error) {
      set({ isLoading: false });
      throw formatApiError(error);
    }
  },
  token: null,
  async travelToRegion(regionId) {
    set({ isLoading: true });

    try {
      const player = await playerApi.travel({ regionId });
      set({
        isLoading: false,
        player,
      });

      return player;
    } catch (error) {
      set({ isLoading: false });
      throw formatApiError(error);
    }
  },
}));

installApiInterceptors();

async function applySession(session: AuthSession): Promise<PlayerProfile> {
  await storeSessionTokens(session.accessToken, session.refreshToken);
  useAuthStore.setState({
    isAuthenticated: true,
    refreshToken: session.refreshToken,
    token: session.accessToken,
  });

  return playerApi.getProfile();
}

async function clearStoredSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}

function installApiInterceptors(): void {
  installAuthInterceptors({
    getAccessToken: () => useAuthStore.getState().token,
    refreshAccessToken: () => useAuthStore.getState().refreshAuth(),
  });
}

function sanitizeCharacterCreationInput(input: PlayerCreationInput): PlayerCreationInput {
  return {
    appearance: {
      hair: sanitizeAppearanceField(input.appearance?.hair, 'corte_curto'),
      outfit: sanitizeAppearanceField(input.appearance?.outfit, 'camisa_branca'),
      skin: sanitizeAppearanceField(input.appearance?.skin, 'pele_media'),
    },
    vocation: input.vocation,
  };
}

function sanitizeAppearanceField(value: string | undefined, fallback: string): string {
  const sanitized = value?.trim();

  if (!sanitized) {
    return fallback;
  }

  return sanitized;
}

async function storeSessionTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

function validateEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email.trim())) {
    throw new Error('Email inválido.');
  }
}

function validateNickname(nickname: string): void {
  if (!/^[A-Za-z0-9_]{3,16}$/u.test(nickname.trim())) {
    throw new Error('Nickname deve ter entre 3 e 16 caracteres usando letras, números e underscore.');
  }
}

function validatePassword(password: string): void {
  if (password.trim().length < 8) {
    throw new Error('Senha deve ter no mínimo 8 caracteres.');
  }
}
