import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  notify: {
    cancel: (id: string) => ipcRenderer.invoke('notify:cancel', id) as Promise<void>,
    cancelAll: () => ipcRenderer.invoke('notify:cancel-all') as Promise<void>,
    hasPermission: () => ipcRenderer.invoke('notify:has-permission') as Promise<boolean>,
    requestPermission: () => ipcRenderer.invoke('notify:request-permission') as Promise<boolean>,
    schedule: (payload: { body: string; id: string; title: string; triggerAt: number }) =>
      ipcRenderer.invoke('notify:schedule', payload) as Promise<boolean>,
    show: (payload: { body: string; id: string; title: string }) =>
      ipcRenderer.invoke('notify:show', payload.title, payload.body) as Promise<boolean>,
  },
  storage: {
    getItem: (key: string) => ipcRenderer.invoke('storage:get', key) as Promise<string | null>,
    removeItem: (key: string) => ipcRenderer.invoke('storage:remove', key) as Promise<void>,
    setItem: (key: string, value: string) =>
      ipcRenderer.invoke('storage:set', key, value) as Promise<void>,
  },
  shell: {
    onNotificationsEnabledChange: (listener: (enabled: boolean) => void) => {
      const wrappedListener = (_event: Electron.IpcRendererEvent, enabled: boolean) => {
        listener(enabled);
      };

      ipcRenderer.on('shell:notifications-enabled-changed', wrappedListener);

      return () => {
        ipcRenderer.removeListener('shell:notifications-enabled-changed', wrappedListener);
      };
    },
    quit: () => ipcRenderer.send('shell:quit'),
    syncSettings: (payload: {
      displayMode: 'borderless' | 'fullscreen' | 'windowed';
      minimizeToTray: boolean;
      notificationsEnabled: boolean;
      resolutionPresetId: string;
    }) => ipcRenderer.invoke('shell:sync-settings', payload) as Promise<void>,
    toggleFullscreen: () => ipcRenderer.invoke('shell:toggle-fullscreen') as Promise<boolean>,
  },
  window: {
    close: () => ipcRenderer.send('window:close'),
    maximize: () => ipcRenderer.send('window:maximize'),
    minimize: () => ipcRenderer.send('window:minimize'),
    setFullscreen: (enabled: boolean) => ipcRenderer.send('window:fullscreen', enabled),
  },
} as const;

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
