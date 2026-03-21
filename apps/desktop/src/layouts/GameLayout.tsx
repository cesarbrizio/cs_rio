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
        description: 'Abra a versao de desktop para controlar a janela deste aparelho.',
        title: 'Controle da janela indisponivel',
        tone: 'danger',
      });
      return;
    }

    void window.electronAPI.shell.toggleFullscreen().then((nextValue) => {
      setShellDisplayMode(nextValue ? 'fullscreen' : 'windowed');
      pushToast({
        description: nextValue ? 'Janela enviada para fullscreen.' : 'Janela retornou ao modo janela.',
        title: 'Janela atualizada',
        tone: 'info',
      });
    });
  };

  const handleLogout = async () => {
    await logout();
    pushToast({
      description: 'Sua sessao foi encerrada neste aparelho.',
      title: 'Sessao encerrada',
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
                {isWindowFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
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
              <span className="eyebrow">CS Rio</span>
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
        Seu acesso sera removido deste aparelho e o jogo volta para a tela de entrada.
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
  if (pathname.startsWith('/drug-use')) {
    return 'Rave / Baile';
  }

  const match = primaryNavigationItems.find((item) => pathname.startsWith(item.path));

  return match?.label ?? 'CS Rio';
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}
