import type {
  AudioPort,
  EnvPort,
  HapticsPort,
  NotifyPort,
  StoragePort,
} from '@cs-rio/platform';
import { createContext, useContext, type ReactNode } from 'react';

export interface PlatformPorts {
  audio: AudioPort;
  env: EnvPort;
  haptics: HapticsPort;
  notify: NotifyPort;
  storage: StoragePort;
}

const PlatformContext = createContext<PlatformPorts | null>(null);

interface PlatformProviderProps {
  children: ReactNode;
  ports: PlatformPorts;
}

export function PlatformProvider({ children, ports }: PlatformProviderProps): JSX.Element {
  return <PlatformContext.Provider value={ports}>{children}</PlatformContext.Provider>;
}

export function usePlatform(): PlatformPorts {
  const context = useContext(PlatformContext);

  if (!context) {
    throw new Error('PlatformProvider ausente na arvore React.');
  }

  return context;
}
