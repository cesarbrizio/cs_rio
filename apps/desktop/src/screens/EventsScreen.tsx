import { formatNotificationPermissionStatus } from '@cs-rio/domain/notify';

import { Button, Card } from '../components/ui';
import { useDesktopRuntimeStore } from '../stores/desktopRuntimeStore';
import {
  MetricCard,
  ScreenHero,
} from './shared/DesktopScreenPrimitives';

export function EventsScreen(): JSX.Element {
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
          { label: notificationSettings.enabled ? 'Alertas ativos' : 'Alertas silenciados', tone: notificationSettings.enabled ? 'success' : 'warning' },
          { label: formatNotificationPermissionStatus(notificationSettings.permissionStatus), tone: 'info' },
          { label: `${history.length} registros`, tone: 'neutral' },
        ]}
        description="Veja eventos, retornos de guerra, recados, tribunal e alertas importantes que passaram pelo aparelho."
        title="Ver eventos"
      />

      <div className="desktop-metric-grid">
        <MetricCard label="Historico" tone="info" value={`${history.length}`} />
        <MetricCard label="Alertas" tone={notificationSettings.enabled ? 'success' : 'warning'} value={notificationSettings.enabled ? 'Ligados' : 'Silenciados'} />
        <MetricCard label="Permissao" tone="neutral" value={formatNotificationPermissionStatus(notificationSettings.permissionStatus)} />
        <MetricCard label="Ultimo registro" tone="warning" value={history[0] ? new Date(history[0].createdAt).toLocaleString('pt-BR') : '--'} />
      </div>

      <Card className="desktop-panel">
        <div className="desktop-panel__header">
          <h3>Feed recente</h3>
          <span>{history.length} itens</span>
        </div>
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
          {!history.length ? <p>Nenhum evento relevante foi registrado ainda nesta sessao.</p> : null}
        </div>
      </Card>
    </section>
  );
}
