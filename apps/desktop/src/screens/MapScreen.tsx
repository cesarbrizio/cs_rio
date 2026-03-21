import { REGIONS } from '@cs-rio/shared';
import {
  estimateMacroRegionTravel,
  getMacroRegionMeta,
  useMapController,
} from '@cs-rio/ui/hooks';
import { useNavigate } from 'react-router-dom';

import rjMapSource from '../../../mobile/assets/maps/rj.webp';
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
    currentRegionId,
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
              Dominar area
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
        description="Escolha a proxima regiao com visao ampla da cidade, comparando rota, custo e tempo antes de viajar."
        title="Mapa"
      />

      {feedback ? <FeedbackCard message={feedback} title="Deslocamento" tone="success" /> : null}
      {error ? <FeedbackCard message={error} title="Falha de viagem" tone="danger" /> : null}

      <div className="desktop-metric-grid">
        <MetricCard label="Origem" tone="success" value={currentRegion?.label ?? player.regionId} />
        <MetricCard label="Destino" tone="warning" value={selectedRegion?.label ?? '--'} />
        <MetricCard label="Custo" tone="danger" value={formatMoney(routeEstimate.cost)} />
        <MetricCard label="Tempo" tone="info" value={`${routeEstimate.minutes} min`} />
      </div>

      <Card className="desktop-map-visual" padding="sm">
        <div
          className="desktop-map-board"
          style={{
            backgroundImage: `url(${rjMapSource})`,
          }}
        >
          <div className="desktop-map-board__scrim" />
          <div className="desktop-map-board__header">
            <div className="desktop-map-badge desktop-map-badge--current">
              <span className="desktop-map-badge__eyebrow">Você está aqui</span>
              <strong>{currentRegion?.label ?? 'Região atual'}</strong>
            </div>
            <div
              className={`desktop-map-badge ${
                selectedRegionId === currentRegionId
                  ? 'desktop-map-badge--muted'
                  : 'desktop-map-badge--destination'
              }`}
            >
              <span className="desktop-map-badge__eyebrow">Destino em foco</span>
              <strong>{selectedRegion?.label ?? 'Selecione uma região'}</strong>
            </div>
          </div>

          {selectedRegionId !== currentRegionId ? (
            <RouteRibbon from={getMacroRegionMeta(currentRegionId)} to={getMacroRegionMeta(selectedRegionId)} />
          ) : null}

          {REGIONS.map((region) => {
            const meta = getMacroRegionMeta(region.id);
            const isCurrent = region.id === currentRegionId;
            const isSelected = region.id === selectedRegionId;

            return (
              <button
                className={`desktop-map-node ${isCurrent ? 'desktop-map-node--current' : ''} ${isSelected ? 'desktop-map-node--active' : ''}`}
                key={region.id}
                onClick={() => setSelectedRegionId(region.id)}
                style={{
                  left: `${meta.x}%`,
                  top: `${meta.y}%`,
                }}
                type="button"
              >
                <span
                  className={`desktop-map-node__halo ${isSelected ? 'desktop-map-node__halo--active' : ''}`}
                  style={{
                    backgroundColor: `${meta.accent}22`,
                  }}
                />
                {isCurrent ? <span className="desktop-map-node__chip">Você está aqui</span> : null}
                <strong>{region.label}</strong>
                <small>
                  {region.density} densidade · {region.wealth} riqueza
                </small>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="desktop-map-grid">
        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Rota selecionada</h3>
            <Badge tone={selectedRegionId === currentRegionId ? 'neutral' : 'warning'}>
              {selectedRegionId === currentRegionId ? 'Atual' : 'Mototaxi'}
            </Badge>
          </div>
          <div className="desktop-grid-2">
            <MetricCard label="Origem" tone="success" value={currentRegion?.label ?? '--'} />
            <MetricCard label="Destino" tone="warning" value={selectedRegion?.label ?? '--'} />
            <MetricCard label="Custo" tone="danger" value={formatMoney(routeEstimate.cost)} />
            <MetricCard label="Tempo" tone="info" value={`${routeEstimate.minutes} min`} />
          </div>
          <p>
            {selectedRegionId === currentRegionId
              ? 'Use o macro mapa para comparar regioes, planejar expansao e preparar o proximo deslocamento da rodada.'
              : `Rota estimada para ${selectedRegion?.label}: ${formatMoney(routeEstimate.cost)} e ${routeEstimate.minutes} minutos.`}
          </p>
          <p>{getMacroRegionMeta(selectedRegionId).note}</p>
          <Button
            disabled={isTraveling}
            onClick={() => void travel()}
            variant={selectedRegionId === currentRegionId ? 'ghost' : 'primary'}
          >
            {selectedRegionId === currentRegionId
              ? 'Região atual'
              : isTraveling
                ? 'Viajando...'
                : `Ir para ${selectedRegion?.label ?? 'destino'}`}
          </Button>
        </Card>

        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Regiões do Rio</h3>
            <Badge tone="neutral">{REGIONS.length} pontos</Badge>
          </div>
          <div className="desktop-region-grid">
            {REGIONS.map((region) => {
              const isCurrent = region.id === player.regionId;
              const isSelected = region.id === selectedRegionId;
              const estimate = estimateMacroRegionTravel(currentRegionId, region.id);

              return (
                <button
                  className={`desktop-region-card ${isCurrent ? 'desktop-region-card--current' : ''} ${isSelected ? 'desktop-region-card--active' : ''}`}
                  key={region.id}
                  onClick={() => setSelectedRegionId(region.id)}
                  type="button"
                >
                  <strong>{region.label}</strong>
                  <small>{isCurrent ? 'Você está aqui' : `Mototáxi: ${formatMoney(estimate.cost)} · ${estimate.minutes} min`}</small>
                  <small>{getMacroRegionMeta(region.id).note}</small>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </section>
  );
}

function RouteRibbon(props: {
  from: ReturnType<typeof getMacroRegionMeta>;
  to: ReturnType<typeof getMacroRegionMeta>;
}): JSX.Element {
  const dx = props.to.x - props.from.x;
  const dy = props.to.y - props.from.y;
  const angle = `${Math.atan2(dy, dx)}rad`;
  const length = Math.max(160, Math.round(Math.hypot(dx, dy) * 5.4));

  return (
    <div
      className="desktop-map-route"
      style={{
        left: `${props.from.x}%`,
        top: `${props.from.y}%`,
        transform: `rotate(${angle})`,
        width: `${length}px`,
      }}
    />
  );
}
