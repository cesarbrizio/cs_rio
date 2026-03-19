import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { app, BrowserWindow, net, protocol } from 'electron';

import { registerNotifyIpcHandlers } from './ipc/notify.ipc';
import {
  emitNotificationsEnabledChanged,
  registerShellIpcHandlers,
} from './ipc/shell.ipc';
import { registerStorageIpcHandlers } from './ipc/storage.ipc';
import { registerWindowIpcHandlers } from './ipc/window.ipc';
import { DesktopTrayManager } from './runtime/trayManager';
import {
  applyShellState,
  getShellState,
  rememberWindowBounds,
  shouldMinimizeToTray,
  toggleNotificationsEnabled,
} from './runtime/shellState';

protocol.registerSchemesAsPrivileged([
  {
    privileges: {
      corsEnabled: true,
      secure: true,
      standard: true,
      stream: true,
      supportFetchAPI: true,
    },
    scheme: 'csrio',
  },
]);

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);
const preloadPath = path.join(currentDir, 'preload.js');
const rendererDistPath = path.resolve(currentDir, '../dist');

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

const trayManager = new DesktopTrayManager({
  onQuit: requestQuit,
  onToggleNotifications: () => {
    const nextValue = toggleNotificationsEnabled();

    emitNotificationsEnabledChanged(nextValue);

    return nextValue;
  },
  resolveWindow: () => mainWindow,
});

function resolveRendererAssetPath(requestUrl: string): string {
  const url = new URL(requestUrl);
  const normalizedRequestPath =
    url.pathname && url.pathname !== '/'
      ? url.pathname
      : '/index.html';
  const sanitizedPath = path
    .normalize(decodeURIComponent(normalizedRequestPath))
    .replace(/^(\.\.(\/|\\|$))+/, '')
    .replace(/^[/\\]+/, '');
  const candidatePath = path.join(rendererDistPath, sanitizedPath);

  if (fs.existsSync(candidatePath)) {
    return candidatePath;
  }

  return path.join(rendererDistPath, 'index.html');
}

async function registerCsrioProtocol(): Promise<void> {
  if (protocol.isProtocolHandled('csrio')) {
    return;
  }

  await protocol.handle('csrio', (request) => {
    const assetPath = resolveRendererAssetPath(request.url);

    return net.fetch(pathToFileURL(assetPath).toString());
  });
}

function createMainWindow(): BrowserWindow {
  const nextWindow = new BrowserWindow({
    backgroundColor: '#071116',
    height: 720,
    minHeight: 640,
    minWidth: 1024,
    show: false,
    title: 'CS Rio Desktop',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      sandbox: true,
    },
    width: 1280,
  });

  mainWindow = nextWindow;
  applyShellState(nextWindow, getShellState());
  trayManager.setNotificationsEnabled(getShellState().notificationsEnabled);

  nextWindow.once('ready-to-show', () => {
    nextWindow.show();
  });

  nextWindow.on('close', (event) => {
    if (isQuitting || !shouldMinimizeToTray()) {
      return;
    }

    event.preventDefault();
    nextWindow.hide();
    trayManager.notifyHiddenToTray();
  });

  nextWindow.on('closed', () => {
    if (mainWindow === nextWindow) {
      mainWindow = null;
    }
  });

  nextWindow.on('move', () => {
    rememberWindowBounds(nextWindow);
  });

  nextWindow.on('resize', () => {
    rememberWindowBounds(nextWindow);
  });

  if (isDevelopment && process.env.VITE_DEV_SERVER_URL) {
    void nextWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void nextWindow.loadURL('csrio://app/index.html');
  }

  return nextWindow;
}

async function bootstrap(): Promise<void> {
  registerStorageIpcHandlers();
  registerNotifyIpcHandlers();
  registerWindowIpcHandlers();
  registerShellIpcHandlers({
    requestQuit,
    resolveMainWindow: () => mainWindow,
    trayManager,
  });
  trayManager.attach();

  if (!isDevelopment) {
    await registerCsrioProtocol();
  }

  createMainWindow();
}

void app.whenReady().then(bootstrap);

app.on('before-quit', () => {
  requestQuit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
    return;
  }

  trayManager.revealWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  trayManager.destroy();
});

function requestQuit(): void {
  isQuitting = true;
}
