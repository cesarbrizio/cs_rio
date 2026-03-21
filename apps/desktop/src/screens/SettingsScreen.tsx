import { formatNotificationPermissionStatus } from '@cs-rio/domain/notify';
import { usePlatform } from '@cs-rio/ui';
import { useEffect, useState } from 'react';

import { Button, Card, useToast } from '../components/ui';
import {
  captureDesktopShortcut,
  DESKTOP_FPS_CAP_OPTIONS,
  DESKTOP_RESOLUTION_PRESETS,
  DESKTOP_SHORTCUT_LABELS,
  formatDesktopShortcut,
  type DesktopGraphicsDetailLevel,
  type DesktopShortcutActionId,
} from '../runtime/desktopShell';
import { useDesktopRuntimeStore } from '../stores/desktopRuntimeStore';
import { FormField, MetricCard, ScreenHero } from './shared/DesktopScreenPrimitives';

function formatDisplayMode(mode: 'borderless' | 'fullscreen' | 'windowed'): string {
  if (mode === 'fullscreen') {
    return 'Tela cheia';
  }

  if (mode === 'borderless') {
    return 'Sem borda';
  }

  return 'Janela';
}

export function SettingsScreen(): JSX.Element {
  const { audio, notify } = usePlatform();
  const { pushToast } = useToast();
  const audioSettings = useDesktopRuntimeStore((state) => state.audioSettings);
  const graphicsSettings = useDesktopRuntimeStore((state) => state.graphicsSettings);
  const notificationSettings = useDesktopRuntimeStore((state) => state.notificationSettings);
  const resetKeybindings = useDesktopRuntimeStore((state) => state.resetKeybindings);
  const setCustomCursorEnabled = useDesktopRuntimeStore((state) => state.setCustomCursorEnabled);
  const setGraphicsDetailLevel = useDesktopRuntimeStore((state) => state.setGraphicsDetailLevel);
  const setGraphicsFpsCap = useDesktopRuntimeStore((state) => state.setGraphicsFpsCap);
  const setKeybinding = useDesktopRuntimeStore((state) => state.setKeybinding);
  const setMinimizeToTray = useDesktopRuntimeStore((state) => state.setMinimizeToTray);
  const setMusicEnabled = useDesktopRuntimeStore((state) => state.setMusicEnabled);
  const setMusicVolume = useDesktopRuntimeStore((state) => state.setMusicVolume);
  const setNotificationsEnabled = useDesktopRuntimeStore((state) => state.setNotificationsEnabled);
  const setNotificationPermissionStatus = useDesktopRuntimeStore((state) => state.setNotificationPermissionStatus);
  const setResolutionPresetId = useDesktopRuntimeStore((state) => state.setResolutionPresetId);
  const setShellDisplayMode = useDesktopRuntimeStore((state) => state.setShellDisplayMode);
  const setSfxEnabled = useDesktopRuntimeStore((state) => state.setSfxEnabled);
  const setSfxVolume = useDesktopRuntimeStore((state) => state.setSfxVolume);
  const shellSettings = useDesktopRuntimeStore((state) => state.shellSettings);
  const [capturingActionId, setCapturingActionId] = useState<DesktopShortcutActionId | null>(null);

  useEffect(() => {
    if (!capturingActionId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      const binding = captureDesktopShortcut(event);

      if (!binding) {
        return;
      }

      setKeybinding(capturingActionId, binding);
      setCapturingActionId(null);
      pushToast({
        description: `${DESKTOP_SHORTCUT_LABELS[capturingActionId]} agora usa ${formatDesktopShortcut(binding)}.`,
        title: 'Atalho atualizado',
        tone: 'success',
      });
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [capturingActionId, pushToast, setKeybinding]);

  const handleProbeNotifications = async () => {
    try {
      const supported = await notify.hasPermission();

      setNotificationPermissionStatus(supported ? 'granted' : 'undetermined');
      pushToast({
        description: supported
          ? 'Este aparelho pode exibir alertas do jogo.'
          : 'Este aparelho nao liberou alertas do sistema.',
        title: 'Verificacao concluida',
        tone: supported ? 'success' : 'warning',
      });
    } catch (error) {
      pushToast({
        description: error instanceof Error ? error.message : 'Falha ao consultar os alertas deste aparelho.',
        title: 'Falha na janela',
        tone: 'danger',
      });
    }
  };

  const handleRequestNotifications = async () => {
    try {
      const granted = await notify.requestPermission();

      setNotificationPermissionStatus(granted ? 'granted' : 'denied');

      pushToast({
        description: granted ? 'Permissao concedida.' : 'Permissao negada neste aparelho.',
        title: 'Alertas do jogo',
        tone: granted ? 'success' : 'warning',
      });
    } catch (error) {
      pushToast({
        description: error instanceof Error ? error.message : 'Falha ao requisitar notificacoes.',
        title: 'Falha na janela',
        tone: 'danger',
      });
    }
  };

  const handleTestNotification = async () => {
    try {
      await notify.show({
        body: 'Se este aviso chegou, os alertas do jogo estao funcionando neste aparelho.',
        id: `desktop-test:${Date.now()}`,
        title: 'Teste de notificacao',
      });
      pushToast({
        description: 'O alerta de teste foi enviado para este aparelho.',
        title: 'Alertas do jogo',
        tone: 'success',
      });
    } catch (error) {
      pushToast({
        description: error instanceof Error ? error.message : 'Falha ao disparar notificacao de teste.',
        title: 'Falha na janela',
        tone: 'danger',
      });
    }
  };

  const handleTestAudio = async () => {
    try {
      await audio.playSfx('notification');
      pushToast({
        description: 'O som de alerta tocou neste aparelho.',
        title: 'Audio do jogo',
        tone: 'success',
      });
    } catch (error) {
      pushToast({
        description: error instanceof Error ? error.message : 'Falha ao tocar o audio.',
        title: 'Falha na janela',
        tone: 'danger',
      });
    }
  };

  return (
    <section className="desktop-screen">
      <ScreenHero
        badges={[
          { label: formatDisplayMode(shellSettings.displayMode), tone: 'neutral' },
          { label: `${graphicsSettings.fpsCap} FPS`, tone: 'warning' },
          { label: notificationSettings.enabled ? 'Notificacoes ativas' : 'Notificacoes off', tone: notificationSettings.enabled ? 'success' : 'warning' },
        ]}
        description="Ajuste som, janela, atalhos e alertas para deixar o jogo do seu jeito neste aparelho."
        title="Ajustar jogo"
      />

      <div className="desktop-metric-grid">
        <MetricCard label="Resolucao" tone="info" value={shellSettings.resolutionPresetId} />
        <MetricCard label="Modo" tone="neutral" value={formatDisplayMode(shellSettings.displayMode)} />
        <MetricCard label="Detalhe" tone="warning" value={graphicsSettings.detailLevel} />
        <MetricCard label="Permissao" tone="success" value={formatNotificationPermissionStatus(notificationSettings.permissionStatus)} />
      </div>

      <div className="desktop-grid-2">
        <Card>
          <h3>Janela e bandeja</h3>
          <div className="desktop-grid-2">
            <FormField label="Resolucao">
              <select
                onChange={(event) => setResolutionPresetId(event.target.value)}
                value={shellSettings.resolutionPresetId}
              >
                {DESKTOP_RESOLUTION_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Modo da janela">
              <select
                onChange={(event) =>
                  setShellDisplayMode(
                    event.target.value as 'borderless' | 'fullscreen' | 'windowed',
                  )
                }
                value={shellSettings.displayMode}
              >
                <option value="windowed">Janela</option>
                <option value="borderless">Sem borda</option>
                <option value="fullscreen">Tela cheia</option>
              </select>
            </FormField>
          </div>
          <div className="desktop-settings-toggle">
            <label>
              <input
                checked={shellSettings.minimizeToTray}
                onChange={(event) => setMinimizeToTray(event.target.checked)}
                type="checkbox"
              />
              Minimizar para bandeja
            </label>
            <label>
              <input
                checked={shellSettings.customCursorEnabled}
                onChange={(event) => setCustomCursorEnabled(event.target.checked)}
                type="checkbox"
              />
              Cursor customizado
            </label>
          </div>
          <div className="settings-screen__actions">
            <Button
              onClick={() => {
                window.electronAPI?.window.minimize();
              }}
              variant="secondary"
            >
              Minimizar
            </Button>
            <Button
              onClick={() => {
                window.electronAPI?.window.maximize();
              }}
              variant="ghost"
            >
              Maximizar
            </Button>
            <Button
              onClick={() => {
                void window.electronAPI?.shell?.toggleFullscreen().then((isFullscreen) => {
                  setShellDisplayMode(isFullscreen ? 'fullscreen' : 'windowed');
                });
              }}
              variant="ghost"
            >
              Alternar tela cheia
            </Button>
          </div>
        </Card>

        <Card>
          <h3>Video e atalhos</h3>
          <div className="desktop-grid-2">
            <FormField label="Limite de FPS">
              <select
                onChange={(event) => setGraphicsFpsCap(Number(event.target.value))}
                value={graphicsSettings.fpsCap}
              >
                {DESKTOP_FPS_CAP_OPTIONS.map((fpsCap) => (
                  <option key={fpsCap} value={fpsCap}>
                    {fpsCap} FPS
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Nivel de detalhe">
              <select
                onChange={(event) =>
                  setGraphicsDetailLevel(event.target.value as DesktopGraphicsDetailLevel)
                }
                value={graphicsSettings.detailLevel}
              >
                <option value="low">Baixo</option>
                <option value="balanced">Balanceado</option>
                <option value="high">Alto</option>
              </select>
            </FormField>
          </div>
          <div className="desktop-detail-list">
            <div>
              <strong>Painel lateral</strong>
              <small>`Tab` recolhe ou revela o painel da home/mapa.</small>
            </div>
            <div>
              <strong>Atalhos primarios</strong>
              <small>`1-9`, `E`, `C`, `M`, `F11` e `Ctrl+Q` podem ser rebindados abaixo.</small>
            </div>
          </div>
        </Card>

        <Card>
          <h3>Audio</h3>
          <div className="desktop-settings-toggle">
            <label>
              <input checked={audioSettings.musicEnabled} onChange={(event) => setMusicEnabled(event.target.checked)} type="checkbox" />
              Ativar musica
            </label>
            <label>
              <input checked={audioSettings.sfxEnabled} onChange={(event) => setSfxEnabled(event.target.checked)} type="checkbox" />
              Ativar SFX
            </label>
          </div>
          <div className="desktop-grid-2">
            <FormField hint={`${audioSettings.musicVolume}%`} label="Volume da musica">
              <input max="100" min="0" onChange={(event) => setMusicVolume(Number(event.target.value))} type="range" value={audioSettings.musicVolume} />
            </FormField>
            <FormField hint={`${audioSettings.sfxVolume}%`} label="Volume dos efeitos">
              <input max="100" min="0" onChange={(event) => setSfxVolume(Number(event.target.value))} type="range" value={audioSettings.sfxVolume} />
            </FormField>
          </div>
          <Button onClick={() => void handleTestAudio()} variant="secondary">
            Tocar teste de audio
          </Button>
        </Card>

        <Card>
          <h3>Notificacoes</h3>
          <p>Status atual: {formatNotificationPermissionStatus(notificationSettings.permissionStatus)}</p>
          <div className="desktop-settings-toggle">
            <label>
              <input checked={notificationSettings.enabled} onChange={(event) => setNotificationsEnabled(event.target.checked)} type="checkbox" />
              Ativar pipeline de notificacoes
            </label>
          </div>
          <div className="settings-screen__actions">
            <Button onClick={() => void handleProbeNotifications()} variant="secondary">
              Verificar suporte
            </Button>
            <Button onClick={() => void handleRequestNotifications()} variant="ghost">
              Solicitar permissao
            </Button>
            <Button onClick={() => void handleTestNotification()} variant="ghost">
              Enviar teste
            </Button>
          </div>
        </Card>
      </div>

      <Card className="desktop-panel">
        <div className="desktop-panel__header">
          <div>
            <h3>Rebind de atalhos</h3>
            <p>Clique em &quot;Capturar&quot; e pressione a combinacao desejada.</p>
          </div>
          <Button
            onClick={() => {
              resetKeybindings();
              pushToast({
                description: 'Mapa de atalhos voltou para o padrao da Fase 9.',
                title: 'Atalhos restaurados',
                tone: 'info',
              });
            }}
            variant="ghost"
          >
            Restaurar padrao
          </Button>
        </div>
        <div className="desktop-shortcut-grid">
          {(Object.keys(DESKTOP_SHORTCUT_LABELS) as DesktopShortcutActionId[]).map((actionId) => (
            <div className="desktop-shortcut-row" key={actionId}>
              <div>
                <strong>{DESKTOP_SHORTCUT_LABELS[actionId]}</strong>
                <small>{formatDesktopShortcut(shellSettings.keybindings[actionId])}</small>
              </div>
              <Button
                onClick={() =>
                  setCapturingActionId((current) => (current === actionId ? null : actionId))
                }
                variant={capturingActionId === actionId ? 'danger' : 'secondary'}
              >
                {capturingActionId === actionId ? 'Pressione uma tecla...' : 'Capturar'}
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
