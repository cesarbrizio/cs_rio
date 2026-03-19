import {
  createHowlerAudioPort,
  desktopStorage,
  electronNotify,
  noopHaptics,
  viteEnv,
} from '@cs-rio/platform/desktop';
import { PlatformProvider } from '@cs-rio/ui';
import { type ReactNode, useEffect, useRef } from 'react';

import { ToastProvider } from '../components/ui';
import {
  DESKTOP_AUDIO_MUSIC_SOURCES,
  DESKTOP_AUDIO_SFX_SOURCES,
} from '../runtime/audioCatalog';
import { useAuthStore } from '../stores/authStore';
import { DesktopRuntimeProvider } from './DesktopRuntimeProvider';

const desktopPorts = {
  audio: createHowlerAudioPort({
    musicSources: DESKTOP_AUDIO_MUSIC_SOURCES,
    sfxSources: DESKTOP_AUDIO_SFX_SOURCES,
  }),
  env: viteEnv,
  haptics: noopHaptics,
  notify: electronNotify,
  storage: desktopStorage,
};

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps): JSX.Element {
  return (
    <PlatformProvider ports={desktopPorts}>
      <ToastProvider>
        <AuthBootstrap>
          <DesktopRuntimeProvider>{children}</DesktopRuntimeProvider>
        </AuthBootstrap>
      </ToastProvider>
    </PlatformProvider>
  );
}

function AuthBootstrap({ children }: AppProvidersProps): JSX.Element {
  const bootedRef = useRef(false);
  const loadStoredAuth = useAuthStore((state) => state.loadStoredAuth);

  useEffect(() => {
    if (bootedRef.current) {
      return;
    }

    bootedRef.current = true;
    void loadStoredAuth();
  }, [loadStoredAuth]);

  return <>{children}</>;
}
