import { useDesktopRuntimeStore } from '../stores/desktopRuntimeStore';
import { Button, Card } from '../components/ui';
import {
  MetricCard,
  ScreenHero,
} from './shared/DesktopScreenPrimitives';

export function NotificationsScreen(): JSX.Element {
  const history = useDesktopRuntimeStore((state) => state.notificationHistory);
  const notificationSettings = useDesktopRuntimeStore((state) => state.notificationSettings);
  const clearNotificationHistory = useDesktopRuntimeStore((state) => state.clearNotificationHistory);

  return (
    <section className="desktop-screen">
      <ScreenHero
        actions={
          <Button onClick={() => clearNotificationHistory()} variant="ghost">
            Limpar historico
          </Button>
        }
        badges={[
          { label: notificationSettings.enabled ? 'Ativas' : 'Silenciadas', tone: notificationSettings.enabled ? 'success' : 'warning' },
          { label: notificationSettings.permissionStatus, tone: 'info' },
          { label: `${history.length} itens`, tone: 'neutral' },
        ]}
        description="Historico local das notificacoes do desktop, com eventos, mensagens, contratos, guerra, sabotagem e atividades assincronas."
        title="Notificacoes"
      />

      <div className="desktop-metric-grid">
        <MetricCard label="Historico" tone="info" value={`${history.length}`} />
        <MetricCard label="Estado" tone={notificationSettings.enabled ? 'success' : 'warning'} value={notificationSettings.enabled ? 'Ativo' : 'Silenciado'} />
        <MetricCard label="Permissao" tone="neutral" value={notificationSettings.permissionStatus} />
        <MetricCard label="Ultimo item" tone="warning" value={history[0] ? new Date(history[0].createdAt).toLocaleString('pt-BR') : '--'} />
      </div>

      <Card className="desktop-panel">
        <div className="desktop-scroll-list">
          {history.map((entry) => (
            <div className="desktop-list-row" key={entry.id}>
              <div className="desktop-list-row__headline">
                <strong>{entry.title}</strong>
                <small>{new Date(entry.createdAt).toLocaleString('pt-BR')}</small>
              </div>
              <small>{entry.kind}</small>
              <p>{entry.body}</p>
            </div>
          ))}
          {!history.length ? <p>Nenhuma notificacao registrada ainda nesta sessao.</p> : null}
        </div>
      </Card>
    </section>
  );
}
