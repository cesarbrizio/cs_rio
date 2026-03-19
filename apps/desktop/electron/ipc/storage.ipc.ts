import { ipcMain } from 'electron';

import { desktopStore } from '../runtime/desktopStore';

const STORAGE_GET_CHANNEL = 'storage:get';
const STORAGE_REMOVE_CHANNEL = 'storage:remove';
const STORAGE_SET_CHANNEL = 'storage:set';

export function registerStorageIpcHandlers(): void {
  ipcMain.removeHandler(STORAGE_GET_CHANNEL);
  ipcMain.removeHandler(STORAGE_SET_CHANNEL);
  ipcMain.removeHandler(STORAGE_REMOVE_CHANNEL);

  ipcMain.handle(STORAGE_GET_CHANNEL, async (_event, key: string) => {
    return desktopStore.get(key) ?? null;
  });

  ipcMain.handle(STORAGE_SET_CHANNEL, async (_event, key: string, value: string) => {
    desktopStore.set(key, value);
  });

  ipcMain.handle(STORAGE_REMOVE_CHANNEL, async (_event, key: string) => {
    desktopStore.delete(key);
  });
}
