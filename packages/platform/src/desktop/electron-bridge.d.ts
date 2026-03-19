declare global {
  interface Window {
    electronAPI?: {
      notify?: {
        cancel(id: string): Promise<void>;
        cancelAll(): Promise<void>;
        hasPermission(): Promise<boolean>;
        requestPermission(): Promise<boolean>;
        schedule(payload: {
          body: string;
          id: string;
          title: string;
          triggerAt: number;
        }): Promise<boolean>;
        show(payload: {
          body: string;
          id: string;
          title: string;
        }): Promise<boolean>;
      };
      storage?: {
        getItem(key: string): Promise<string | null>;
        removeItem(key: string): Promise<void>;
        setItem(key: string, value: string): Promise<void>;
      };
    };
  }
}

export {};
