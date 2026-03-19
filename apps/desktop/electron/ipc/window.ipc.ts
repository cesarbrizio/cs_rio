import { BrowserWindow, ipcMain } from 'electron';

import { shouldMinimizeToTray } from '../runtime/shellState';

const WINDOW_CLOSE_CHANNEL = 'window:close';
const WINDOW_FULLSCREEN_CHANNEL = 'window:fullscreen';
const WINDOW_MAXIMIZE_CHANNEL = 'window:maximize';
const WINDOW_MINIMIZE_CHANNEL = 'window:minimize';

function resolveSenderWindow(webContentsId: number): BrowserWindow | null {
  return BrowserWindow.getAllWindows().find(
    (candidateWindow) => candidateWindow.webContents.id === webContentsId,
  ) ?? null;
}

export function registerWindowIpcHandlers(): void {
  ipcMain.removeAllListeners(WINDOW_MINIMIZE_CHANNEL);
  ipcMain.removeAllListeners(WINDOW_MAXIMIZE_CHANNEL);
  ipcMain.removeAllListeners(WINDOW_CLOSE_CHANNEL);
  ipcMain.removeAllListeners(WINDOW_FULLSCREEN_CHANNEL);

  ipcMain.on(WINDOW_MINIMIZE_CHANNEL, (event) => {
    const window = resolveSenderWindow(event.sender.id);

    if (!window) {
      return;
    }

    if (shouldMinimizeToTray()) {
      window.hide();
      return;
    }

    window.minimize();
  });

  ipcMain.on(WINDOW_MAXIMIZE_CHANNEL, (event) => {
    const window = resolveSenderWindow(event.sender.id);

    if (!window) {
      return;
    }

    if (window.isMaximized()) {
      window.unmaximize();
      return;
    }

    window.maximize();
  });

  ipcMain.on(WINDOW_CLOSE_CHANNEL, (event) => {
    resolveSenderWindow(event.sender.id)?.close();
  });

  ipcMain.on(WINDOW_FULLSCREEN_CHANNEL, (event, enabled: boolean) => {
    resolveSenderWindow(event.sender.id)?.setFullScreen(enabled);
  });
}
