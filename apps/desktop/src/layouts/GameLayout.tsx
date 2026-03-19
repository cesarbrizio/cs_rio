import { type PlayerProfile } from '@cs-rio/shared';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { Badge, Button, Card, Modal, Sidebar, useToast } from '../components/ui';
import { primaryNavigationItems } from '../config/navigation';
import { useAuthStore } from '../stores/authStore';
import { useDesktopRuntimeStore } from '../stores/desktopRuntimeStore';

export function GameLayout(): JSX.Element {
  const player = useAuthStore((state) => state.player);
  const logout = useAuthStore((state) => state.logout);
  const location = useLocation();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const displayMode = useDesktopRuntimeStore((state) => state.shellSettings.displayMode);
  const setShellDisplayMode = useDesktopRuntimeStore((state) => state.setShellDisplayMode);
  const isWindowFullscreen = displayMode === 'fullscreen';

  if (!player) {
    return <Outlet />;
  }

  const handleToggleWindowFullscreen = () => {
    if (!window.electronAPI) {
      pushToast({
        description: 'Abra o shell pelo Electron para controlar a janela nativa.',
        title: 'Bridge IPC indisponivel',
        tone: 'danger',
      });
      return;
    }

    void window.electronAPI.shell.toggleFullscreen().then((nextValue) => {
      setShellDisplayMode(nextValue ? 'fullscreen' : 'windowed');
      pushToast({
        description: nextValue ? 'Janela enviada para fullscreen.' : 'Janela retornou ao modo janela.',
        title: 'Shell desktop atualizado',
        tone: 'info',
      });
    });
  };

  const handleLogout = async () => {
    await logout();
    pushToast({
      description: 'Sessao removida do storage local e renderer voltou ao gate publico.',
      title: 'Logout concluido',
      tone: 'info',
    });
    setIsLogoutModalOpen(false);
    navigate('/login', { replace: true });
  };

  return (
    <>
      <main className="game-layout">
        <Sidebar
          footer={
            <div className="game-layout__sidebar-actions">
              <Button onClick={handleToggleWindowFullscreen} variant="secondary">
                {isWindowFullscreen ? 'Sair do fullscreen' : 'Fullscreen'}
              </Button>
              <Button onClick={() => setIsLogoutModalOpen(true)} variant="ghost">
                Encerrar sessao
              </Button>
            </div>
          }
          header={
            <Card className="game-layout__identity" padding="sm">
              <div className="game-layout__identity-top">
                <Badge tone="warning">{player.title}</Badge>
                <Badge tone="neutral">{player.level} LVL</Badge>
              </div>
              <strong>{player.nickname}</strong>
              <span>{player.faction ? `${player.faction.abbreviation} · ${player.faction.name}` : 'Sem faccao'}</span>
            </Card>
          }
          items={primaryNavigationItems}
          pathname={location.pathname}
        />

        <section className="game-layout__content">
          <header className="game-layout__header">
            <div>
              <span className="eyebrow">Desktop jogavel</span>
              <h1>{resolveHeaderTitle(location.pathname)}</h1>
            </div>
            <div className="game-layout__header-meta">
              <PlayerSnapshot player={player} />
            </div>
          </header>
          <Outlet />
        </section>
      </main>

      <Modal
        actions={
          <>
            <Button onClick={() => setIsLogoutModalOpen(false)} variant="ghost">
              Cancelar
            </Button>
            <Button onClick={() => void handleLogout()} variant="danger">
              Confirmar logout
            </Button>
          </>
        }
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        title="Encerrar sessao local?"
      >
        Os tokens persistidos no Electron serao removidos e o app volta para a rota publica de
        login.
      </Modal>
    </>
  );
}

function PlayerSnapshot({ player }: { player: PlayerProfile }): JSX.Element {
  return (
    <div className="game-layout__snapshot">
      <Card className="game-layout__snapshot-card" padding="sm">
        <span>Regiao</span>
        <strong>{player.regionId}</strong>
      </Card>
      <Card className="game-layout__snapshot-card" padding="sm">
        <span>Caixa</span>
        <strong>{formatMoney(player.resources.money)}</strong>
      </Card>
      <Card className="game-layout__snapshot-card" padding="sm">
        <span>Conceito</span>
        <strong>{player.resources.conceito}</strong>
      </Card>
    </div>
  );
}

function resolveHeaderTitle(pathname: string): string {
  const match = primaryNavigationItems.find((item) => pathname.startsWith(item.path));

  return match?.label ?? 'CS Rio Desktop';
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}
