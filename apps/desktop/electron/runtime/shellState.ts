import type { BrowserWindow, Rectangle } from 'electron';

import { resolveResolutionPreset } from '../../src/runtime/desktopShell';

import { patchRuntimeSnapshot, readRuntimeSnapshot } from './desktopStore';

export type ElectronDisplayMode = 'borderless' | 'fullscreen' | 'windowed';

export interface ShellSyncSettings {
  displayMode: ElectronDisplayMode;
  minimizeToTray: boolean;
  notificationsEnabled: boolean;
  resolutionPresetId: string;
}

type ShellStateSnapshot = ShellSyncSettings;

const DEFAULT_SHELL_STATE: ShellStateSnapshot = {
  displayMode: 'windowed',
  minimizeToTray: true,
  notificationsEnabled: true,
  resolutionPresetId: '1280x720',
};

let shellState = loadInitialShellState();
let lastWindowBounds: Rectangle | null = null;

export function getShellState(): ShellStateSnapshot {
  return {
    ...shellState,
  };
}

export function applyShellState(window: BrowserWindow, nextState: ShellSyncSettings): void {
  shellState = {
    ...nextState,
  };
  persistShellState();
  window.setAutoHideMenuBar(true);
  window.setMenuBarVisibility(false);

  if (shellState.displayMode === 'fullscreen') {
    window.setResizable(true);
    window.setFullScreen(true);
    return;
  }

  if (window.isFullScreen()) {
    window.setFullScreen(false);
  }

  if (!window.isDestroyed()) {
    applyWindowedGeometry(window, shellState);
  }
}

export function shouldMinimizeToTray(): boolean {
  return shellState.minimizeToTray;
}

export function shouldShowNativeNotifications(): boolean {
  return shellState.notificationsEnabled;
}

export function toggleNotificationsEnabled(): boolean {
  shellState = {
    ...shellState,
    notificationsEnabled: !shellState.notificationsEnabled,
  };
  persistShellState();
  return shellState.notificationsEnabled;
}

export function rememberWindowBounds(window: BrowserWindow): void {
  if (window.isDestroyed() || window.isFullScreen() || window.isMaximized()) {
    return;
  }

  lastWindowBounds = window.getBounds();
}

function applyWindowedGeometry(window: BrowserWindow, state: ShellSyncSettings): void {
  const preset = resolveResolutionPreset(state.resolutionPresetId);
  const currentBounds = window.getBounds();
  const targetBounds = lastWindowBounds ?? {
    height: preset.height,
    width: preset.width,
    x: currentBounds.x,
    y: currentBounds.y,
  };

  window.setResizable(state.displayMode === 'windowed');

  if (window.isMaximized()) {
    window.unmaximize();
  }

  window.setBounds({
    height: targetBounds.height,
    width: targetBounds.width,
    x: targetBounds.x,
    y: targetBounds.y,
  });

  if (state.displayMode === 'borderless') {
    window.maximize();
    window.setResizable(false);
  }
}

function loadInitialShellState(): ShellStateSnapshot {
  const snapshot = readRuntimeSnapshot();
  const notificationSettings = snapshot?.notificationSettings as
    | { enabled?: boolean }
    | undefined;
  const shellSettings = snapshot?.shellSettings as
    | {
        displayMode?: ElectronDisplayMode;
        minimizeToTray?: boolean;
        resolutionPresetId?: string;
      }
    | undefined;

  return {
    displayMode:
      shellSettings?.displayMode === 'borderless' ||
      shellSettings?.displayMode === 'fullscreen' ||
      shellSettings?.displayMode === 'windowed'
        ? shellSettings.displayMode
        : DEFAULT_SHELL_STATE.displayMode,
    minimizeToTray:
      shellSettings?.minimizeToTray ?? DEFAULT_SHELL_STATE.minimizeToTray,
    notificationsEnabled:
      notificationSettings?.enabled ?? DEFAULT_SHELL_STATE.notificationsEnabled,
    resolutionPresetId:
      typeof shellSettings?.resolutionPresetId === 'string'
        ? shellSettings.resolutionPresetId
        : DEFAULT_SHELL_STATE.resolutionPresetId,
  };
}

function persistShellState(): void {
  patchRuntimeSnapshot((current) => {
    const notificationSettings = asRecord(current.notificationSettings);
    const shellSettings = asRecord(current.shellSettings);

    return {
      ...current,
      notificationSettings: {
        ...notificationSettings,
        enabled: shellState.notificationsEnabled,
      },
      shellSettings: {
        ...shellSettings,
        displayMode: shellState.displayMode,
        minimizeToTray: shellState.minimizeToTray,
        resolutionPresetId: shellState.resolutionPresetId,
      },
    };
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
