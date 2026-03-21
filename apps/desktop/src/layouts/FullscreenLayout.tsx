import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { Badge, Button, Card, useToast } from '../components/ui';
import { useDesktopRuntimeStore } from '../stores/desktopRuntimeStore';

export function FullscreenLayout(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const displayMode = useDesktopRuntimeStore((state) => state.shellSettings.displayMode);
  const setShellDisplayMode = useDesktopRuntimeStore((state) => state.setShellDisplayMode);
  const isWindowFullscreen = displayMode === 'fullscreen';
  const isCharacterCreationRoute = location.pathname === '/create-char';

  const handleToggleWindowFullscreen = () => {
    if (!window.electronAPI) {
      pushToast({
        description: 'Esta troca de modo nao esta disponivel nesta sessao.',
        title: 'Acao indisponivel',
        tone: 'danger',
      });
      return;
    }

    void window.electronAPI.shell.toggleFullscreen().then((nextValue) => {
      setShellDisplayMode(nextValue ? 'fullscreen' : 'windowed');
    });
  };

  return (
    <main className="fullscreen-layout">
      <header
        className={`fullscreen-layout__header ${isCharacterCreationRoute ? 'fullscreen-layout__header--compact' : ''}`}
      >
        {!isCharacterCreationRoute ? (
          <div>
            <Badge tone="warning">Fase 6</Badge>
            <h1>Modo desktop focado</h1>
          </div>
        ) : null}
        <Card className="fullscreen-layout__actions" padding="sm">
          {!isCharacterCreationRoute ? (
            <Button onClick={() => navigate(-1)} variant="ghost">
              Voltar
            </Button>
          ) : null}
          <Button onClick={handleToggleWindowFullscreen} variant="secondary">
            {isWindowFullscreen ? 'Janela normal' : 'Janela fullscreen'}
          </Button>
        </Card>
      </header>

      <section className="fullscreen-layout__content">
        <Outlet />
      </section>
    </main>
  );
}
