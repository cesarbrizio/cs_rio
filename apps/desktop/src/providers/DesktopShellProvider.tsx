import { useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { primaryNavigationItems } from '../config/navigation';
import {
  formatDesktopShortcut,
  isEditableKeyboardTarget,
  matchDesktopShortcut,
} from '../runtime/desktopShell';
import { useDesktopRuntimeStore } from '../stores/desktopRuntimeStore';
import { useToast } from '../components/ui';

interface DesktopShellProviderProps {
  children: ReactNode;
}

export function DesktopShellProvider({
  children,
}: DesktopShellProviderProps): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const hasHydrated = useDesktopRuntimeStore((state) => state.hasHydrated);
  const notificationSettings = useDesktopRuntimeStore((state) => state.notificationSettings);
  const setNotificationsEnabled = useDesktopRuntimeStore((state) => state.setNotificationsEnabled);
  const setShellDisplayMode = useDesktopRuntimeStore((state) => state.setShellDisplayMode);
  const shellSettings = useDesktopRuntimeStore((state) => state.shellSettings);
  const toggleHomeRailVisibility = useDesktopRuntimeStore((state) => state.toggleHomeRailVisibility);

  useEffect(() => {
    if (!hasHydrated || !window.electronAPI?.shell) {
      return;
    }

    void window.electronAPI.shell.syncSettings({
      displayMode: shellSettings.displayMode,
      minimizeToTray: shellSettings.minimizeToTray,
      notificationsEnabled: notificationSettings.enabled,
      resolutionPresetId: shellSettings.resolutionPresetId,
    });
  }, [
    hasHydrated,
    notificationSettings.enabled,
    shellSettings.displayMode,
    shellSettings.minimizeToTray,
    shellSettings.resolutionPresetId,
  ]);

  useEffect(() => {
    if (!window.electronAPI?.shell) {
      return;
    }

    return window.electronAPI.shell.onNotificationsEnabledChange((enabled) => {
      setNotificationsEnabled(enabled);
      pushToast({
        description: enabled
          ? 'Notificacoes nativas foram reativadas pela bandeja.'
          : 'Notificacoes nativas foram silenciadas pela bandeja.',
        title: 'Tray desktop',
        tone: enabled ? 'success' : 'warning',
      });
    });
  }, [pushToast, setNotificationsEnabled]);

  useEffect(() => {
    document.body.classList.toggle('desktop-cursor--custom', shellSettings.customCursorEnabled);

    return () => {
      document.body.classList.remove('desktop-cursor--custom');
    };
  }, [shellSettings.customCursorEnabled]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const matchedActionId = Object.entries(shellSettings.keybindings).find(([, binding]) =>
        matchDesktopShortcut(event, binding),
      )?.[0];

      if (!matchedActionId) {
        return;
      }

      if (isEditableKeyboardTarget(event.target) && matchedActionId !== 'close_or_back') {
        return;
      }

      event.preventDefault();

      switch (matchedActionId) {
        case 'close_or_back':
          handleCloseOrBack(location.pathname, navigate);
          return;
        case 'confirm_action':
          triggerConfirmAction();
          return;
        case 'toggle_panel':
          if (location.pathname.startsWith('/home') || location.pathname.startsWith('/map')) {
            toggleHomeRailVisibility();
          }
          return;
        case 'toggle_fullscreen':
          if (!window.electronAPI?.shell) {
            return;
          }

          void window.electronAPI.shell.toggleFullscreen().then((isFullscreen) => {
            setShellDisplayMode(isFullscreen ? 'fullscreen' : 'windowed');
          });
          return;
        case 'quit_app':
          window.electronAPI?.shell?.quit();
          return;
        case 'open_inventory':
          navigate('/inventory');
          return;
        case 'open_crimes':
          navigate('/crimes');
          return;
        case 'open_map':
          navigate('/map');
          return;
        default:
          if (matchedActionId.startsWith('quick_nav_')) {
            const index = Number.parseInt(matchedActionId.replace('quick_nav_', ''), 10) - 1;
            const target = primaryNavigationItems[index];

            if (target) {
              navigate(target.path);
            }
          }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [location.pathname, navigate, setShellDisplayMode, shellSettings.keybindings, toggleHomeRailVisibility]);

  return <>{children}</>;
}

function handleCloseOrBack(
  pathname: string,
  navigate: ReturnType<typeof useNavigate>,
): void {
  if (document.querySelector('.ui-modal')) {
    return;
  }

  if (pathname === '/register') {
    navigate('/login');
    return;
  }

  if (pathname === '/map/fullscreen') {
    navigate('/home');
    return;
  }

  if (pathname !== '/home' && pathname !== '/login') {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/home');
  }
}

function triggerConfirmAction(): void {
  const activeElement = document.activeElement;

  if (activeElement instanceof HTMLButtonElement && !activeElement.disabled) {
    activeElement.click();
    return;
  }

  const modalPrimaryAction = document.querySelector<HTMLButtonElement>(
    '.ui-modal .ui-button--danger:not(:disabled), .ui-modal .ui-button--primary:not(:disabled)',
  );

  if (isClickableButton(modalPrimaryAction)) {
    modalPrimaryAction.click();
    return;
  }

  const primaryAction = document.querySelector<HTMLButtonElement>(
    '[data-desktop-primary-action="true"]:not(:disabled)',
  );

  if (isClickableButton(primaryAction)) {
    primaryAction.click();
  }
}

function isClickableButton(button: HTMLButtonElement | null): button is HTMLButtonElement {
  return Boolean(button && button.offsetParent !== null && !button.disabled);
}

export function buildShortcutBadge(binding: string): string {
  return formatDesktopShortcut(binding);
}
