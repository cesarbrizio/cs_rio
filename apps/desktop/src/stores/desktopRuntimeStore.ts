import { type NotificationPermissionState } from '@cs-rio/domain/notify';
import { desktopStorage } from '@cs-rio/platform/desktop';
import { create } from 'zustand';

import {
  type DesktopDisplayMode,
  type DesktopGraphicsDetailLevel,
  type DesktopShortcutActionId,
  type DesktopShortcutMap,
  DEFAULT_DESKTOP_RESOLUTION_PRESET,
  DEFAULT_DESKTOP_SHORTCUTS,
  DESKTOP_FPS_CAP_OPTIONS,
  DESKTOP_RESOLUTION_PRESETS,
} from '../runtime/desktopShell';

const STORAGE_KEY = 'cs_rio_desktop_runtime_v1';
const MAX_HISTORY_ITEMS = 120;

export interface DesktopAudioSettings {
  musicEnabled: boolean;
  musicVolume: number;
  sfxEnabled: boolean;
  sfxVolume: number;
}

export interface DesktopGraphicsSettings {
  detailLevel: DesktopGraphicsDetailLevel;
  fpsCap: number;
}

export interface DesktopNotificationSettings {
  enabled: boolean;
  permissionStatus: NotificationPermissionState;
}

export interface DesktopNotificationHistoryEntry {
  body: string;
  createdAt: string;
  id: string;
  kind: string;
  title: string;
  tone: 'danger' | 'info' | 'success' | 'warning';
}

export interface DesktopShellSettings {
  customCursorEnabled: boolean;
  displayMode: DesktopDisplayMode;
  homeRailVisible: boolean;
  keybindings: DesktopShortcutMap;
  minimizeToTray: boolean;
  resolutionPresetId: string;
}

interface DesktopRuntimeSnapshot {
  audioSettings: DesktopAudioSettings;
  graphicsSettings: DesktopGraphicsSettings;
  notificationHistory: DesktopNotificationHistoryEntry[];
  notificationSettings: DesktopNotificationSettings;
  shellSettings: DesktopShellSettings;
}

interface DesktopRuntimeStoreState extends DesktopRuntimeSnapshot {
  clearNotificationHistory: () => void;
  hasHydrated: boolean;
  hydratePreferences: () => Promise<void>;
  pushNotificationHistory: (entry: Omit<DesktopNotificationHistoryEntry, 'createdAt' | 'id'>) => void;
  resetKeybindings: () => void;
  setCustomCursorEnabled: (enabled: boolean) => void;
  setGraphicsDetailLevel: (detailLevel: DesktopGraphicsDetailLevel) => void;
  setGraphicsFpsCap: (fpsCap: number) => void;
  setHomeRailVisible: (visible: boolean) => void;
  setKeybinding: (actionId: DesktopShortcutActionId, binding: string) => void;
  setMinimizeToTray: (enabled: boolean) => void;
  setMusicEnabled: (enabled: boolean) => void;
  setMusicVolume: (volume: number) => void;
  setNotificationPermissionStatus: (status: NotificationPermissionState) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setResolutionPresetId: (presetId: string) => void;
  setShellDisplayMode: (displayMode: DesktopDisplayMode) => void;
  setSfxEnabled: (enabled: boolean) => void;
  setSfxVolume: (volume: number) => void;
  toggleHomeRailVisibility: () => void;
}

export const DEFAULT_DESKTOP_AUDIO_SETTINGS: DesktopAudioSettings = {
  musicEnabled: true,
  musicVolume: 70,
  sfxEnabled: true,
  sfxVolume: 80,
};

export const DEFAULT_DESKTOP_GRAPHICS_SETTINGS: DesktopGraphicsSettings = {
  detailLevel: 'balanced',
  fpsCap: 60,
};

export const DEFAULT_DESKTOP_NOTIFICATION_SETTINGS: DesktopNotificationSettings = {
  enabled: true,
  permissionStatus: 'undetermined',
};

export const DEFAULT_DESKTOP_SHELL_SETTINGS: DesktopShellSettings = {
  customCursorEnabled: true,
  displayMode: 'windowed',
  homeRailVisible: true,
  keybindings: {
    ...DEFAULT_DESKTOP_SHORTCUTS,
  },
  minimizeToTray: true,
  resolutionPresetId: DEFAULT_DESKTOP_RESOLUTION_PRESET.id,
};

const DEFAULT_RUNTIME_SNAPSHOT: DesktopRuntimeSnapshot = {
  audioSettings: {
    ...DEFAULT_DESKTOP_AUDIO_SETTINGS,
  },
  graphicsSettings: {
    ...DEFAULT_DESKTOP_GRAPHICS_SETTINGS,
  },
  notificationHistory: [],
  notificationSettings: {
    ...DEFAULT_DESKTOP_NOTIFICATION_SETTINGS,
  },
  shellSettings: {
    ...DEFAULT_DESKTOP_SHELL_SETTINGS,
    keybindings: {
      ...DEFAULT_DESKTOP_SHELL_SETTINGS.keybindings,
    },
  },
};

export const useDesktopRuntimeStore = create<DesktopRuntimeStoreState>((set, get) => ({
  ...DEFAULT_RUNTIME_SNAPSHOT,
  clearNotificationHistory: () => {
    set({ notificationHistory: [] });
    void persistRuntimeSnapshot(pickSnapshot(get()));
  },
  hasHydrated: false,
  async hydratePreferences() {
    if (get().hasHydrated) {
      return;
    }

    try {
      const raw = await desktopStorage.getItem(STORAGE_KEY);

      if (!raw) {
        set({ hasHydrated: true });
        return;
      }

      const parsed = JSON.parse(raw) as Partial<DesktopRuntimeSnapshot>;

      set({
        audioSettings: sanitizeAudioSettings(parsed.audioSettings),
        graphicsSettings: sanitizeGraphicsSettings(parsed.graphicsSettings),
        hasHydrated: true,
        notificationHistory: sanitizeHistory(parsed.notificationHistory),
        notificationSettings: sanitizeNotificationSettings(parsed.notificationSettings),
        shellSettings: sanitizeShellSettings(parsed.shellSettings),
      });
    } catch (error) {
      console.warn('[desktop runtime] falha ao carregar preferencias persistidas.', error);
      set({ hasHydrated: true });
    }
  },
  pushNotificationHistory(entry) {
    const nextEntry: DesktopNotificationHistoryEntry = {
      ...entry,
      createdAt: new Date().toISOString(),
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    };
    const nextHistory = [nextEntry, ...get().notificationHistory].slice(0, MAX_HISTORY_ITEMS);

    set({ notificationHistory: nextHistory });
    void persistRuntimeSnapshot(pickSnapshot(get()));
  },
  resetKeybindings() {
    set((state) => ({
      shellSettings: {
        ...state.shellSettings,
        keybindings: {
          ...DEFAULT_DESKTOP_SHORTCUTS,
        },
      },
    }));
    void persistRuntimeSnapshot(pickSnapshot(get()));
  },
  setCustomCursorEnabled(customCursorEnabled) {
    set((state) => ({
      shellSettings: {
        ...state.shellSettings,
        customCursorEnabled,
      },
    }));
    void persistRuntimeSnapshot(pickSnapshot(get()));
  },
  setGraphicsDetailLevel(detailLevel) {
    set((state) => ({
      graphicsSettings: {
        ...state.graphicsSettings,
        detailLevel,
      },
    }));
    void persistRuntimeSnapshot(pickSnapshot(get()));
  },
  setGraphicsFpsCap(fpsCap) {
    set((state) => ({
      graphicsSettings: {
        ...state.graphicsSettings,
        fpsCap: clampFpsCap(fpsCap),
      },
    }));
    void persistRuntimeSnapshot(pickSnapshot(get()));
  },
  setHomeRailVisible(homeRailVisible) {
    set((state) => ({
      shellSettings: {
        ...state.shellSettings,
        homeRailVisible,
      },
    }));
    void persistRuntimeSnapshot(pickSnapshot(get()));
  },
  setKeybinding(actionId, binding) {
    set((state) => ({
      shellSettings: {
        ...state.shellSettings,
        keybindings: {
          ...state.shellSettings.keybindings,
          [actionId]: binding,
        },
      },
    }));
    void persistRuntimeSnapshot(pickSnapshot(get()));
  },
  setMinimizeToTray(minimizeToTray) {
    set((state) => ({
      shellSettings: {
        ...state.shellSettings,
        minimizeToTray,
      },
    }));
    void persistRuntimeSnapshot(pickSnapshot(get()));
  },
  setMusicEnabled(musicEnabled) {
    set((state) => ({
      audioSettings: {
        ...state.audioSettings,
        musicEnabled,
      },
    }));
    void persistRuntimeSnapshot(pickSnapshot(get()));
  },
  setMusicVolume(musicVolume) {
    set((state) => ({
      audioSettings: {
        ...state.audioSettings,
        musicVolume: clampVolume(musicVolume),
      },
    }));
    void persistRuntimeSnapshot(pickSnapshot(get()));
  },
  setNotificationPermissionStatus(permissionStatus) {
    set((state) => ({
      notificationSettings: {
        ...state.notificationSettings,
        permissionStatus,
      },
    }));
    void persistRuntimeSnapshot(pickSnapshot(get()));
  },
  setNotificationsEnabled(enabled) {
    set((state) => ({
      notificationSettings: {
        ...state.notificationSettings,
        enabled,
      },
    }));
    void persistRuntimeSnapshot(pickSnapshot(get()));
  },
  setResolutionPresetId(resolutionPresetId) {
    set((state) => ({
      shellSettings: {
        ...state.shellSettings,
        resolutionPresetId: sanitizeResolutionPresetId(resolutionPresetId),
      },
    }));
    void persistRuntimeSnapshot(pickSnapshot(get()));
  },
  setShellDisplayMode(displayMode) {
    set((state) => ({
      shellSettings: {
        ...state.shellSettings,
        displayMode,
      },
    }));
    void persistRuntimeSnapshot(pickSnapshot(get()));
  },
  setSfxEnabled(sfxEnabled) {
    set((state) => ({
      audioSettings: {
        ...state.audioSettings,
        sfxEnabled,
      },
    }));
    void persistRuntimeSnapshot(pickSnapshot(get()));
  },
  setSfxVolume(sfxVolume) {
    set((state) => ({
      audioSettings: {
        ...state.audioSettings,
        sfxVolume: clampVolume(sfxVolume),
      },
    }));
    void persistRuntimeSnapshot(pickSnapshot(get()));
  },
  toggleHomeRailVisibility() {
    set((state) => ({
      shellSettings: {
        ...state.shellSettings,
        homeRailVisible: !state.shellSettings.homeRailVisible,
      },
    }));
    void persistRuntimeSnapshot(pickSnapshot(get()));
  },
}));

async function persistRuntimeSnapshot(snapshot: DesktopRuntimeSnapshot): Promise<void> {
  try {
    await desktopStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn('[desktop runtime] falha ao persistir preferencias.', error);
  }
}

function pickSnapshot(state: DesktopRuntimeStoreState): DesktopRuntimeSnapshot {
  return {
    audioSettings: state.audioSettings,
    graphicsSettings: state.graphicsSettings,
    notificationHistory: state.notificationHistory,
    notificationSettings: state.notificationSettings,
    shellSettings: state.shellSettings,
  };
}

function sanitizeAudioSettings(value: Partial<DesktopAudioSettings> | undefined): DesktopAudioSettings {
  return {
    musicEnabled: value?.musicEnabled ?? DEFAULT_DESKTOP_AUDIO_SETTINGS.musicEnabled,
    musicVolume: clampVolume(value?.musicVolume ?? DEFAULT_DESKTOP_AUDIO_SETTINGS.musicVolume),
    sfxEnabled: value?.sfxEnabled ?? DEFAULT_DESKTOP_AUDIO_SETTINGS.sfxEnabled,
    sfxVolume: clampVolume(value?.sfxVolume ?? DEFAULT_DESKTOP_AUDIO_SETTINGS.sfxVolume),
  };
}

function sanitizeGraphicsSettings(
  value: Partial<DesktopGraphicsSettings> | undefined,
): DesktopGraphicsSettings {
  return {
    detailLevel: sanitizeDetailLevel(
      value?.detailLevel ?? DEFAULT_DESKTOP_GRAPHICS_SETTINGS.detailLevel,
    ),
    fpsCap: clampFpsCap(value?.fpsCap ?? DEFAULT_DESKTOP_GRAPHICS_SETTINGS.fpsCap),
  };
}

function sanitizeNotificationSettings(
  value: Partial<DesktopNotificationSettings> | undefined,
): DesktopNotificationSettings {
  return {
    enabled: value?.enabled ?? DEFAULT_DESKTOP_NOTIFICATION_SETTINGS.enabled,
    permissionStatus:
      value?.permissionStatus ?? DEFAULT_DESKTOP_NOTIFICATION_SETTINGS.permissionStatus,
  };
}

function sanitizeHistory(
  value: DesktopNotificationHistoryEntry[] | undefined,
): DesktopNotificationHistoryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => Boolean(entry?.id && entry?.title && entry?.body))
    .slice(0, MAX_HISTORY_ITEMS);
}

function sanitizeShellSettings(value: Partial<DesktopShellSettings> | undefined): DesktopShellSettings {
  return {
    customCursorEnabled:
      value?.customCursorEnabled ?? DEFAULT_DESKTOP_SHELL_SETTINGS.customCursorEnabled,
    displayMode: sanitizeDisplayMode(
      value?.displayMode ?? DEFAULT_DESKTOP_SHELL_SETTINGS.displayMode,
    ),
    homeRailVisible: value?.homeRailVisible ?? DEFAULT_DESKTOP_SHELL_SETTINGS.homeRailVisible,
    keybindings: sanitizeKeybindings(value?.keybindings),
    minimizeToTray: value?.minimizeToTray ?? DEFAULT_DESKTOP_SHELL_SETTINGS.minimizeToTray,
    resolutionPresetId: sanitizeResolutionPresetId(
      value?.resolutionPresetId ?? DEFAULT_DESKTOP_SHELL_SETTINGS.resolutionPresetId,
    ),
  };
}

function sanitizeKeybindings(value: Partial<DesktopShortcutMap> | undefined): DesktopShortcutMap {
  return {
    ...DEFAULT_DESKTOP_SHORTCUTS,
    ...(value ?? {}),
  };
}

function sanitizeDisplayMode(value: string): DesktopDisplayMode {
  if (value === 'borderless' || value === 'fullscreen' || value === 'windowed') {
    return value;
  }

  return DEFAULT_DESKTOP_SHELL_SETTINGS.displayMode;
}

function sanitizeDetailLevel(value: string): DesktopGraphicsDetailLevel {
  if (value === 'low' || value === 'balanced' || value === 'high') {
    return value;
  }

  return DEFAULT_DESKTOP_GRAPHICS_SETTINGS.detailLevel;
}

function sanitizeResolutionPresetId(value: string): string {
  return (
    DESKTOP_RESOLUTION_PRESETS.find((preset) => preset.id === value)?.id ??
    DEFAULT_DESKTOP_SHELL_SETTINGS.resolutionPresetId
  );
}

function clampFpsCap(value: number): number {
  const normalized = Number.isFinite(value) ? Math.round(value) : DEFAULT_DESKTOP_GRAPHICS_SETTINGS.fpsCap;
  const allowed = [...DESKTOP_FPS_CAP_OPTIONS];

  return allowed.find((candidate) => candidate === normalized) ?? DEFAULT_DESKTOP_GRAPHICS_SETTINGS.fpsCap;
}

function clampVolume(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}
