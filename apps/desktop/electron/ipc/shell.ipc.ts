import { app, BrowserWindow, ipcMain } from 'electron';

import { type DesktopTrayManager } from '../runtime/trayManager';
import { applyShellState, type ShellSyncSettings } from '../runtime/shellState';

const SHELL_QUIT_CHANNEL = 'shell:quit';
const SHELL_SYNC_SETTINGS_CHANNEL = 'shell:sync-settings';
const SHELL_TOGGLE_FULLSCREEN_CHANNEL = 'shell:toggle-fullscreen';
export const SHELL_NOTIFICATIONS_CHANGED_EVENT = 'shell:notifications-enabled-changed';

interface RegisterShellIpcHandlersInput {
  requestQuit: () => void;
  resolveMainWindow: () => BrowserWindow | null;
  trayManager: DesktopTrayManager;
}

export function emitNotificationsEnabledChanged(enabled: boolean): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(SHELL_NOTIFICATIONS_CHANGED_EVENT, enabled);
  }
}

export function registerShellIpcHandlers({
  requestQuit,
  resolveMainWindow,
  trayManager,
}: RegisterShellIpcHandlersInput): void {
  ipcMain.removeHandler(SHELL_SYNC_SETTINGS_CHANNEL);
  ipcMain.removeHandler(SHELL_TOGGLE_FULLSCREEN_CHANNEL);
  ipcMain.removeAllListeners(SHELL_QUIT_CHANNEL);

  ipcMain.handle(SHELL_SYNC_SETTINGS_CHANNEL, async (_event, settings: ShellSyncSettings) => {
    const window = resolveMainWindow();

    if (window) {
      applyShellState(window, settings);
    }

    trayManager.setNotificationsEnabled(settings.notificationsEnabled);
  });

  ipcMain.handle(SHELL_TOGGLE_FULLSCREEN_CHANNEL, async () => {
    const window = resolveMainWindow();

    if (!window) {
      return false;
    }

    const nextValue = !window.isFullScreen();
    window.setFullScreen(nextValue);

    return nextValue;
  });

  ipcMain.on(SHELL_QUIT_CHANNEL, () => {
    requestQuit();
    app.quit();
  });
}
