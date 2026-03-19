import { REGIONS } from '@cs-rio/shared';
import { useMapController } from '@cs-rio/ui/hooks';
import { useNavigate } from 'react-router-dom';

import { Badge, Button, Card } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import {
  FeedbackCard,
  formatMoney,
  MetricCard,
  ScreenHero,
} from './shared/DesktopScreenPrimitives';

export function MapScreen(): JSX.Element {
  const navigate = useNavigate();
  const player = useAuthStore((state) => state.player);
  const travelToRegion = useAuthStore((state) => state.travelToRegion);
  const {
    currentRegion,
    error,
    feedback,
    isTraveling,
    routeEstimate,
    selectedRegion,
    selectedRegionId,
    setSelectedRegionId,
    travel,
  } = useMapController({
    player,
    travelToRegion,
  });

  if (!player) {
    return <></>;
  }

  return (
    <section className="desktop-screen">
      <ScreenHero
        actions={
          <>
            <Button onClick={() => navigate('/territory')} variant="secondary">
              Ver territorio
            </Button>
            <Button onClick={() => navigate('/map/fullscreen')} variant="ghost">
              Mapa focado
            </Button>
          </>
        }
        badges={[
          { label: currentRegion?.label ?? player.regionId, tone: 'success' },
          { label: selectedRegion?.label ?? 'Destino', tone: 'warning' },
          { label: isTraveling ? 'Viajando' : 'Pronto', tone: isTraveling ? 'warning' : 'neutral' },
        ]}
        description="Macro mapa do Rio para deslocamento regional. O desktop agora usa a action real de viagem e compara custo e tempo antes da confirmacao."
        title="Mapa do Rio"
      />

      {feedback ? <FeedbackCard message={feedback} title="Deslocamento" tone="success" /> : null}
      {error ? <FeedbackCard message={error} title="Falha de viagem" tone="danger" /> : null}

      <div className="desktop-metric-grid">
        <MetricCard label="Origem" tone="success" value={currentRegion?.label ?? player.regionId} />
        <MetricCard label="Destino" tone="warning" value={selectedRegion?.label ?? '--'} />
        <MetricCard label="Custo" tone="danger" value={formatMoney(routeEstimate.cost)} />
        <MetricCard label="Tempo" tone="info" value={`${routeEstimate.minutes} min`} />
      </div>

      <div className="desktop-grid-2">
        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Regioes</h3>
            <Badge tone="neutral">{REGIONS.length} pontos</Badge>
          </div>
          <div className="desktop-region-grid">
            {REGIONS.map((region) => {
              const isCurrent = region.id === player.regionId;
              const isSelected = region.id === selectedRegionId;

              return (
                <button
                  className={`desktop-region-card ${isCurrent ? 'desktop-region-card--current' : ''} ${isSelected ? 'desktop-region-card--active' : ''}`}
                  key={region.id}
                  onClick={() => setSelectedRegionId(region.id)}
                  type="button"
                >
                  <strong>{region.label}</strong>
                  <small>{isCurrent ? 'Voce esta aqui' : 'Selecionar destino'}</small>
                  <small>
                    Densidade {region.density} · riqueza {region.wealth}
                  </small>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="desktop-screen__stack">
          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <h3>Rota selecionada</h3>
              <Badge tone={selectedRegionId === player.regionId ? 'neutral' : 'warning'}>
                {selectedRegionId === player.regionId ? 'Atual' : 'Mototaxi'}
              </Badge>
            </div>
            <div className="desktop-grid-3">
              <MetricCard label="Origem" tone="success" value={currentRegion?.label ?? '--'} />
              <MetricCard label="Destino" tone="warning" value={selectedRegion?.label ?? '--'} />
              <MetricCard label="Tempo" tone="info" value={`${routeEstimate.minutes} min`} />
            </div>
            <p>
              {selectedRegionId === player.regionId
                ? 'Use o macro mapa para comparar regioes, planejar expansao e preparar o proximo deslocamento da rodada.'
                : `Rota estimada para ${selectedRegion?.label}: ${formatMoney(routeEstimate.cost)} e ${routeEstimate.minutes} minutos.`}
            </p>
            <Button
              disabled={isTraveling}
              onClick={() => void travel()}
              variant={selectedRegionId === player.regionId ? 'ghost' : 'primary'}
            >
              {selectedRegionId === player.regionId
                ? 'Regiao atual'
                : isTraveling
                  ? 'Viajando...'
                  : `Ir para ${selectedRegion?.label ?? 'destino'}`}
            </Button>
          </Card>

          <Card className="desktop-panel">
            <h3>Leitura da regiao</h3>
            <div className="desktop-detail-list">
              <div>
                <strong>Densidade</strong>
                <small>{selectedRegion?.density ?? '--'}</small>
              </div>
              <div>
                <strong>Riqueza</strong>
                <small>{selectedRegion?.wealth ?? '--'}</small>
              </div>
              <div>
                <strong>Papel atual</strong>
                <small>
                  {selectedRegionId === player.regionId
                    ? 'Sua base operacional atual.'
                    : 'Destino macro para reposicionamento, mercado e dominio territorial.'}
                </small>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
