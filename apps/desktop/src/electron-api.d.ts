export interface ElectronAPI {
  notify: {
    cancel: (id: string) => Promise<void>;
    cancelAll: () => Promise<void>;
    hasPermission: () => Promise<boolean>;
    requestPermission: () => Promise<boolean>;
    schedule: (payload: {
      body: string;
      id: string;
      title: string;
      triggerAt: number;
    }) => Promise<boolean>;
    show: (payload: {
      body: string;
      id: string;
      title: string;
    }) => Promise<boolean>;
  };
  storage: {
    getItem: (key: string) => Promise<string | null>;
    removeItem: (key: string) => Promise<void>;
    setItem: (key: string, value: string) => Promise<void>;
  };
  shell: {
    onNotificationsEnabledChange: (listener: (enabled: boolean) => void) => () => void;
    quit: () => void;
    syncSettings: (payload: {
      displayMode: 'borderless' | 'fullscreen' | 'windowed';
      minimizeToTray: boolean;
      notificationsEnabled: boolean;
      resolutionPresetId: string;
    }) => Promise<void>;
    toggleFullscreen: () => Promise<boolean>;
  };
  window: {
    close: () => void;
    maximize: () => void;
    minimize: () => void;
    setFullscreen: (enabled: boolean) => void;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
