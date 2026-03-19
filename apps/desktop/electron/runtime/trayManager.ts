import { Menu, Notification, Tray, nativeImage, type BrowserWindow } from 'electron';

interface TrayManagerOptions {
  onQuit: () => void;
  onToggleNotifications: () => boolean;
  resolveWindow: () => BrowserWindow | null;
}

const TRAY_TOOLTIP = 'CS Rio Desktop';

export class DesktopTrayManager {
  private tray: Tray | null = null;
  private notificationsEnabled = true;
  private readonly onQuit: TrayManagerOptions['onQuit'];
  private readonly onToggleNotifications: TrayManagerOptions['onToggleNotifications'];
  private readonly resolveWindow: TrayManagerOptions['resolveWindow'];

  public constructor(options: TrayManagerOptions) {
    this.onQuit = options.onQuit;
    this.onToggleNotifications = options.onToggleNotifications;
    this.resolveWindow = options.resolveWindow;
  }

  public attach(): void {
    if (this.tray) {
      return;
    }

    this.tray = new Tray(buildTrayIcon());
    this.tray.setToolTip(TRAY_TOOLTIP);
    this.tray.on('click', () => {
      this.toggleWindowVisibility();
    });
    this.refreshMenu();
  }

  public destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }

  public notifyHiddenToTray(): void {
    if (!this.notificationsEnabled || !Notification.isSupported()) {
      return;
    }

    new Notification({
      body: 'O jogo segue ativo na bandeja. Use o icone para reabrir ou sair.',
      title: 'CS Rio Desktop minimizado',
    }).show();
  }

  public setNotificationsEnabled(enabled: boolean): void {
    this.notificationsEnabled = enabled;
    this.refreshMenu();
  }

  public revealWindow(): void {
    const window = this.resolveWindow();

    if (!window) {
      return;
    }

    if (window.isMinimized()) {
      window.restore();
    }

    window.show();
    window.focus();
  }

  private refreshMenu(): void {
    if (!this.tray) {
      return;
    }

    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          click: () => {
            this.revealWindow();
          },
          label: 'Abrir CS Rio',
        },
        {
          click: () => {
            const nextValue = this.onToggleNotifications();
            this.setNotificationsEnabled(nextValue);
          },
          label: this.notificationsEnabled ? 'Silenciar notificacoes' : 'Reativar notificacoes',
        },
        {
          click: () => {
            this.toggleWindowVisibility();
          },
          label: 'Ocultar/mostrar janela',
        },
        {
          type: 'separator',
        },
        {
          click: () => {
            this.onQuit();
          },
          label: 'Sair',
        },
      ]),
    );
  }

  private toggleWindowVisibility(): void {
    const window = this.resolveWindow();

    if (!window) {
      return;
    }

    if (window.isVisible()) {
      window.hide();
      return;
    }

    this.revealWindow();
  }
}

function buildTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="16" fill="#071116" />
      <path d="M14 34c0-11.05 8.95-20 20-20h12v10H34c-5.523 0-10 4.477-10 10s4.477 10 10 10h16v10H34c-11.05 0-20-8.95-20-20Z" fill="#f4d06f" />
      <circle cx="46" cy="34" r="8" fill="#ef7e44" />
    </svg>
  `.trim();

  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}
