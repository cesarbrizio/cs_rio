import type { StoragePort } from '@cs-rio/platform';
import {
  hasValidPasswordLength,
  isValidAuthNickname,
  isValidEmail,
  normalizeAuthNickname,
  normalizeEmail,
  normalizePasswordInput,
  type AuthLoginInput,
  type AuthRefreshInput,
  type AuthRegisterInput,
  type AuthSession,
  type PlayerCreationInput,
  type PlayerProfile,
  type RegionId,
} from '@cs-rio/shared';
import { create } from 'zustand';

const ACCESS_TOKEN_KEY = 'cs_rio_access_token';
const REFRESH_TOKEN_KEY = 'cs_rio_refresh_token';

export interface AuthStoreState {
  createCharacter: (input: PlayerCreationInput) => Promise<PlayerProfile>;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  loadStoredAuth: () => Promise<void>;
  login: (input: AuthLoginInput) => Promise<void>;
  logout: () => Promise<void>;
  player: PlayerProfile | null;
  refreshAuth: () => Promise<string | null>;
  refreshPlayerProfile: () => Promise<PlayerProfile | null>;
  refreshToken: string | null;
  register: (input: AuthRegisterInput & { confirmPassword: string }) => Promise<void>;
  token: string | null;
  travelToRegion: (regionId: RegionId) => Promise<PlayerProfile>;
}

export interface AuthStoreDependencies {
  authApi: {
    login: (input: AuthLoginInput) => Promise<AuthSession>;
    refresh: (input: AuthRefreshInput) => Promise<AuthSession>;
    register: (input: AuthRegisterInput) => Promise<AuthSession>;
  };
  formatApiError: (error: unknown) => Error;
  installApiObservabilityInterceptors: () => void;
  installAuthInterceptors: (options: {
    getAccessToken: () => string | null;
    refreshAccessToken: () => Promise<string | null>;
  }) => void;
  onLogout?: () => void | Promise<void>;
  playerApi: {
    createCharacter: (input: PlayerCreationInput) => Promise<PlayerProfile>;
    getProfile: () => Promise<PlayerProfile>;
    travel: (input: { regionId: RegionId }) => Promise<PlayerProfile>;
  };
  storage: StoragePort;
}

export function createAuthStore(dependencies: AuthStoreDependencies) {
  let refreshPromise: Promise<string | null> | null = null;

  const useAuthStore = create<AuthStoreState>((set, get) => ({
    async createCharacter(input) {
      set({ isLoading: true });

      try {
        const payload = sanitizeCharacterCreationInput(input);
        const player = await dependencies.playerApi.createCharacter(payload);
        set({
          isAuthenticated: true,
          isLoading: false,
          player,
        });

        return player;
      } catch (error) {
        set({ isLoading: false });
        throw dependencies.formatApiError(error);
      }
    },
    isAuthenticated: false,
    isHydrated: false,
    isLoading: false,
    async loadStoredAuth() {
      set({ isLoading: true });

      try {
        const [token, refreshToken] = await Promise.all([
          dependencies.storage.getItem(ACCESS_TOKEN_KEY),
          dependencies.storage.getItem(REFRESH_TOKEN_KEY),
        ]);

        if (!token || !refreshToken) {
          await clearStoredSession(dependencies.storage);
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
          const player = await dependencies.playerApi.getProfile();
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

          const player = await dependencies.playerApi.getProfile();
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

        const session = await dependencies.authApi.login({
          email: normalizeEmail(input.email),
          password: normalizePasswordInput(input.password),
        });
        const player = await applySession(useAuthStore, dependencies, session);

        set({
          isAuthenticated: true,
          isLoading: false,
          player,
          refreshToken: session.refreshToken,
          token: session.accessToken,
        });
      } catch (error) {
        set({ isLoading: false });
        throw dependencies.formatApiError(error);
      }
    },
    async logout() {
      await clearStoredSession(dependencies.storage);
      refreshPromise = null;
      await dependencies.onLogout?.();
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
    async refreshAuth() {
      const currentRefreshToken = get().refreshToken;

      if (!currentRefreshToken) {
        return null;
      }

      if (!refreshPromise) {
        refreshPromise = (async () => {
          try {
            const session = await dependencies.authApi.refresh({
              refreshToken: currentRefreshToken,
            });

            await storeSessionTokens(
              dependencies.storage,
              session.accessToken,
              session.refreshToken,
            );
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
    async refreshPlayerProfile() {
      const token = get().token;

      if (!token) {
        return null;
      }

      try {
        const player = await dependencies.playerApi.getProfile();
        set({ player });
        return player;
      } catch (error) {
        throw dependencies.formatApiError(error);
      }
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

        const session = await dependencies.authApi.register({
          email: normalizeEmail(input.email),
          nickname: normalizeAuthNickname(input.nickname),
          password: normalizePasswordInput(input.password),
        });
        const player = await applySession(useAuthStore, dependencies, session);

        set({
          isAuthenticated: true,
          isLoading: false,
          player,
          refreshToken: session.refreshToken,
          token: session.accessToken,
        });
      } catch (error) {
        set({ isLoading: false });
        throw dependencies.formatApiError(error);
      }
    },
    token: null,
    async travelToRegion(regionId) {
      set({ isLoading: true });

      try {
        const player = await dependencies.playerApi.travel({ regionId });
        set({
          isLoading: false,
          player,
        });

        return player;
      } catch (error) {
        set({ isLoading: false });
        throw dependencies.formatApiError(error);
      }
    },
  }));

  dependencies.installAuthInterceptors({
    getAccessToken: () => useAuthStore.getState().token,
    refreshAccessToken: () => useAuthStore.getState().refreshAuth(),
  });
  dependencies.installApiObservabilityInterceptors();

  return useAuthStore;
}

async function applySession(
  useAuthStore: ReturnType<typeof createAuthStore>,
  dependencies: AuthStoreDependencies,
  session: AuthSession,
): Promise<PlayerProfile> {
  await storeSessionTokens(
    dependencies.storage,
    session.accessToken,
    session.refreshToken,
  );
  useAuthStore.setState({
    isAuthenticated: true,
    refreshToken: session.refreshToken,
    token: session.accessToken,
  });

  return dependencies.playerApi.getProfile();
}

async function clearStoredSession(storage: StoragePort): Promise<void> {
  await Promise.all([
    storage.removeItem(ACCESS_TOKEN_KEY),
    storage.removeItem(REFRESH_TOKEN_KEY),
  ]);
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

async function storeSessionTokens(
  storage: StoragePort,
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await Promise.all([
    storage.setItem(ACCESS_TOKEN_KEY, accessToken),
    storage.setItem(REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

function validateEmail(email: string): void {
  if (!isValidEmail(email)) {
    throw new Error('Email inválido.');
  }
}

function validateNickname(nickname: string): void {
  if (!isValidAuthNickname(nickname)) {
    throw new Error(
      'Nickname deve ter entre 3 e 16 caracteres usando letras, números e underscore.',
    );
  }
}

function validatePassword(password: string): void {
  if (!hasValidPasswordLength(password)) {
    throw new Error('Senha deve ter no mínimo 8 caracteres.');
  }
}
