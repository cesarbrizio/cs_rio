import { useHomeGameplayData } from '@cs-rio/ui/hooks';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge, Button, Card, ContextMenu, ProgressBar, Tabs } from '../components/ui';
import {
  getRegionLabel,
  getVocationLabel,
} from '../features/character/characterOptions';
import { GameCanvas } from '../renderer/GameCanvas';
import type {
  CombatNavigationState,
  MessagesNavigationState,
  ProfileNavigationState,
} from '../router/navigationIntents';
import type { RendererTelemetry } from '../renderer/types';
import {
  eventApi,
  roundApi,
  territoryApi,
} from '../services/api';
import { colyseusService } from '../services/realtime';
import { useAuthStore } from '../stores/authStore';
import { useDesktopRuntimeStore } from '../stores/desktopRuntimeStore';
import {
  formatMoney,
  MetricCard,
  ScreenHero,
} from './shared/DesktopScreenPrimitives';

interface HomeScreenProps {
  mode?: 'default' | 'fullscreen';
}

const homeTabs = [
  {
    description: 'Resumo vivo da rodada, favela em foco e jogadores proximos.',
    id: 'overview',
    label: 'Overview',
  },
  {
    description: 'Resultados recentes de eventos e pressao sistemica da regiao.',
    id: 'events',
    label: 'Eventos',
  },
  {
    description: 'Benchmark do renderer Canvas 2D antes de considerar Pixi.',
    id: 'renderer',
    label: 'Renderer',
  },
] as const;

export function HomeScreen({ mode = 'default' }: HomeScreenProps): JSX.Element {
  const navigate = useNavigate();
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const homeRailVisible = useDesktopRuntimeStore((state) => state.shellSettings.homeRailVisible);
  const token = useAuthStore((state) => state.token);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedMapFavelaId, setSelectedMapFavelaId] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<RendererTelemetry | null>(null);

  const {
    eventResults,
    eventRuntimeState,
    isLoading,
    loadHomeData,
    relevantRemotePlayers,
    roundInflation,
    roundLeaderboard,
    roundSummary,
    territoryOverview,
  } = useHomeGameplayData({
    eventApi,
    player,
    realtimeService: colyseusService,
    refreshPlayerProfile,
    roundApi,
    territoryApi,
    token,
  });

  const currentRegionSummary = useMemo(
    () =>
      territoryOverview?.regions.find((region) => region.regionId === player?.regionId) ?? null,
    [player?.regionId, territoryOverview?.regions],
  );
  const currentRegionFavelas = useMemo(
    () =>
      territoryOverview?.favelas.filter((favela) => favela.regionId === player?.regionId) ?? [],
    [player?.regionId, territoryOverview?.favelas],
  );
  const selectedFavela = useMemo(
    () =>
      currentRegionFavelas.find((favela) => favela.id === selectedMapFavelaId) ??
      currentRegionFavelas[0] ??
      null,
    [currentRegionFavelas, selectedMapFavelaId],
  );

  useEffect(() => {
    if (!currentRegionFavelas.some((favela) => favela.id === selectedMapFavelaId)) {
      setSelectedMapFavelaId(currentRegionFavelas[0]?.id ?? null);
    }
  }, [currentRegionFavelas, selectedMapFavelaId]);

  if (!player) {
    return <></>;
  }

  const playerSpawnPosition = {
    x: player.location.positionX,
    y: player.location.positionY,
  };

  const content = (
    <>
      {mode === 'default' && homeRailVisible ? (
        <section className="desktop-home__rail">
          <ScreenHero
            actions={
              <>
                <Button onClick={() => navigate('/inventory')} variant="secondary">
                  Abrir inventario
                </Button>
                <Button onClick={() => navigate('/territory')} variant="ghost">
                  Ver territorio
                </Button>
                <Button onClick={() => navigate('/map/fullscreen')} variant="ghost">
                  Fullscreen
                </Button>
              </>
            }
            badges={[
              { label: getRegionLabel(player.regionId), tone: 'success' },
              { label: `${player.level} LVL`, tone: 'neutral' },
              { label: player.faction ? player.faction.abbreviation : 'Sem faccao', tone: 'warning' },
            ]}
            description={`${getVocationLabel(player.vocation)} pronto para o loop principal. A Home agora combina renderer, round, eventos e territorio real da regiao atual.`}
            title={player.nickname}
          />

          <div className="desktop-metric-grid">
            <MetricCard
              detail={roundSummary ? `${roundSummary.remainingSeconds}s restantes` : 'Sem round ativo'}
              label="Dia da rodada"
              tone="info"
              value={roundSummary ? `${roundSummary.currentGameDay}/${roundSummary.totalGameDays}` : '--'}
            />
            <MetricCard
              detail={roundInflation ? `${roundInflation.currentSurchargePercent}% surcharge` : 'Sem inflacao'}
              label="Inflacao NPC"
              tone={roundInflation?.tier === 'peak' ? 'danger' : 'warning'}
              value={roundInflation ? `${roundInflation.currentMultiplier.toFixed(2)}x` : '--'}
            />
            <MetricCard
              detail={selectedFavela ? `${selectedFavela.soldiers.active} soldados` : 'Sem favela em foco'}
              label="Presenca na regiao"
              tone="success"
              value={currentRegionSummary ? `${currentRegionSummary.playerFactionControlledFavelas}` : '--'}
            />
            <MetricCard
              detail={relevantRemotePlayers[0] ? `mais perto em ${relevantRemotePlayers[0].distance} tiles` : 'sem contato'}
              label="Jogadores proximos"
              tone="info"
              value={`${relevantRemotePlayers.length}`}
            />
          </div>

          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <h3>Recursos do personagem</h3>
              <Badge tone="neutral">{player.title}</Badge>
            </div>
            <div className="desktop-resource-bars">
              <ProgressBar label="HP" tone="danger" value={player.resources.hp} />
              <ProgressBar label="Disposicao" tone="success" value={player.resources.disposicao} />
              <ProgressBar label="Cansaco" tone="warning" value={player.resources.cansaco} />
              <ProgressBar label="Brisa" tone="info" value={player.resources.brisa} />
              <ProgressBar label="Vicio" tone="danger" value={player.resources.addiction} />
            </div>
            <div className="desktop-grid-2">
              <MetricCard label="Caixa" tone="warning" value={formatMoney(player.resources.money)} />
              <MetricCard label="Banco" tone="info" value={formatMoney(player.resources.bankMoney)} />
            </div>
          </Card>

          <Card className="desktop-panel">
            <Tabs activeId={activeTab} items={[...homeTabs]} onChange={setActiveTab} />
          </Card>

          {activeTab === 'overview' ? (
            <>
              {selectedFavela ? (
                <Card className="desktop-panel">
                  <div className="desktop-panel__header">
                    <h3>Favela em foco</h3>
                    <Button
                      onClick={() => navigate('/territory')}
                      size="sm"
                      variant="secondary"
                    >
                      Abrir territorio
                    </Button>
                  </div>
                  <div className="desktop-detail-list">
                    {currentRegionFavelas.map((favela) => {
                      const active = favela.id === selectedFavela.id;
                      const owner = favela.controllingFaction?.abbreviation ?? 'Neutra';

                      return (
                        <button
                          className={`desktop-list-row desktop-list-row--clickable ${active ? 'desktop-list-row--active' : ''}`}
                          key={favela.id}
                          onClick={() => setSelectedMapFavelaId(favela.id)}
                          type="button"
                        >
                          <div className="desktop-list-row__headline">
                            <strong>{favela.name}</strong>
                            <Badge tone={active ? 'warning' : 'neutral'}>{favela.state}</Badge>
                          </div>
                          <small>{owner} · dificuldade {favela.difficulty}</small>
                          <small>
                            Soldados {favela.soldiers.active}/{favela.soldiers.max} · Bandidos {favela.bandits.active}/{favela.bandits.targetActive}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                </Card>
              ) : null}

              <Card className="desktop-panel">
                <div className="desktop-panel__header">
                  <h3>Top da rodada</h3>
                  <Button onClick={() => void loadHomeData()} size="sm" variant="ghost">
                    {isLoading ? 'Sincronizando...' : 'Atualizar'}
                  </Button>
                </div>
                <div className="desktop-scroll-list">
                  {roundLeaderboard.slice(0, 6).map((entry) => (
                    <div className="desktop-list-row" key={entry.playerId}>
                      <div className="desktop-list-row__headline">
                        <strong>
                          #{entry.rank} {entry.nickname}
                        </strong>
                        <Badge tone="warning">{entry.level} LVL</Badge>
                      </div>
                      <small>
                        Conceito {entry.conceito} · {entry.factionAbbreviation ?? 'sem faccao'}
                      </small>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="desktop-panel">
                <div className="desktop-panel__header">
                  <h3>Contato na regiao</h3>
                  <Badge tone="info">{relevantRemotePlayers.length} visiveis</Badge>
                </div>
                <div className="desktop-scroll-list">
                  {relevantRemotePlayers.length > 0 ? (
                    relevantRemotePlayers.map((entry) => (
                      <ContextMenu
                        items={[
                          {
                            id: 'open-profile',
                            label: 'Ver perfil',
                            onSelect: () =>
                              navigate('/profile', {
                                state: {
                                  publicNickname: entry.player.nickname,
                                } satisfies ProfileNavigationState,
                              }),
                          },
                          {
                            id: 'open-combat',
                            label: 'Atacar',
                            onSelect: () =>
                              navigate('/combat', {
                                state: {
                                  preselectedTargetId: entry.player.playerId,
                                } satisfies CombatNavigationState,
                              }),
                          },
                          {
                            id: 'open-message',
                            label: 'Mandar mensagem',
                            onSelect: () =>
                              navigate('/messages', {
                                state: {
                                  prefillContactNickname: entry.player.nickname,
                                } satisfies MessagesNavigationState,
                              }),
                          },
                        ]}
                        key={entry.player.playerId}
                      >
                        <div className="desktop-list-row">
                          <div className="desktop-list-row__headline">
                            <strong>{entry.player.nickname}</strong>
                            <Badge tone="neutral">{entry.distance} tiles</Badge>
                          </div>
                          <small>
                            Posicao {entry.player.x}, {entry.player.y}
                          </small>
                        </div>
                      </ContextMenu>
                    ))
                  ) : (
                    <div className="desktop-list-row">
                      <strong>Sem jogadores relevantes por perto.</strong>
                      <small>O renderer continua ativo e vai destacar novos contatos em tempo real.</small>
                    </div>
                  )}
                </div>
              </Card>
            </>
          ) : null}

          {activeTab === 'events' ? (
            <>
              {eventRuntimeState ? (
                <div className="desktop-grid-3">
                  <MetricCard
                    detail={eventRuntimeState.docks.regionId}
                    label="Docas"
                    tone={eventRuntimeState.docks.isActive ? 'warning' : 'neutral'}
                    value={eventRuntimeState.docks.isActive ? 'Ativas' : 'Paradas'}
                  />
                  <MetricCard
                    detail={`${eventRuntimeState.police.events.length} operacoes`}
                    label="Pressao policial"
                    tone="danger"
                    value={`${eventRuntimeState.police.events.length}`}
                  />
                  <MetricCard
                    detail={`${eventRuntimeState.seasonal.events.length} eventos`}
                    label="Sazonal"
                    tone="info"
                    value={eventRuntimeState.seasonal.events.length > 0 ? 'Ativo' : 'Dormindo'}
                  />
                </div>
              ) : null}

              <Card className="desktop-panel">
                <h3>Resultados recentes</h3>
                <div className="desktop-scroll-list">
                  {eventResults.length > 0 ? (
                    eventResults.map((result) => (
                      <div className="desktop-list-row" key={result.id}>
                        <div className="desktop-list-row__headline">
                          <strong>{result.title}</strong>
                          <Badge tone={resolveSeverityTone(result.severity)}>{result.severity}</Badge>
                        </div>
                        <small>{result.headline}</small>
                        <small>{result.body}</small>
                        <small>
                          {result.destination} · {formatTimestamp(result.resolvedAt)}
                        </small>
                      </div>
                    ))
                  ) : (
                    <div className="desktop-list-row">
                      <strong>Nenhum evento recente carregado.</strong>
                      <small>Assim que o backend devolver resultados, eles aparecem aqui.</small>
                    </div>
                  )}
                </div>
              </Card>
            </>
          ) : null}

          {activeTab === 'renderer' ? (
            <Card className="desktop-panel">
              <div className="desktop-panel__header">
                <h3>Renderer Canvas 2D</h3>
                <Badge tone="info">Fase 4A</Badge>
              </div>
              <div className="desktop-grid-3">
                <MetricCard label="FPS atual" value={telemetry ? telemetry.benchmark.currentFps.toFixed(1) : '--'} />
                <MetricCard label="FPS medio" value={telemetry ? telemetry.benchmark.averageFps.toFixed(1) : '--'} />
                <MetricCard label="Pior FPS" value={telemetry ? telemetry.benchmark.lowestFps.toFixed(1) : '--'} />
              </div>
              <div className="desktop-detail-list">
                <div>
                  <strong>Recomendacao</strong>
                  <small>{formatRecommendation(telemetry)}</small>
                </div>
                <div>
                  <strong>Hover</strong>
                  <small>{formatTile(telemetry?.hoveredTile ?? null)}</small>
                </div>
                <div>
                  <strong>Destino</strong>
                  <small>{formatTile(telemetry?.selectedTile ?? null)}</small>
                </div>
              </div>
            </Card>
          ) : null}
        </section>
      ) : null}

      <section
        className={`desktop-home__stage ${mode === 'fullscreen' ? 'desktop-home__stage--fullscreen' : ''} ${mode === 'default' && !homeRailVisible ? 'desktop-home__stage--expanded' : ''}`}
      >
        <GameCanvas
          eventRuntimeState={eventRuntimeState}
          onTelemetryChange={setTelemetry}
          playerFaction={player.faction ? { abbreviation: player.faction.abbreviation, id: player.faction.id } : null}
          playerRegionId={player.regionId}
          playerSpawnPosition={playerSpawnPosition}
          relevantRemotePlayers={relevantRemotePlayers}
          selectedMapFavelaId={selectedFavela?.id ?? null}
          territoryOverview={territoryOverview}
        />
        {mode === 'fullscreen' ? (
          <div className="desktop-home__floating">
            <Card className="desktop-home__floating-card" padding="sm">
              <Badge tone="success">{getRegionLabel(player.regionId)}</Badge>
              <strong>{player.nickname}</strong>
              <p>{getVocationLabel(player.vocation)}</p>
            </Card>
            <Button onClick={() => navigate('/home')} variant="secondary">
              Voltar ao shell
            </Button>
          </div>
        ) : null}
        {mode === 'default' && !homeRailVisible ? (
          <div className="desktop-home__floating">
            <Card className="desktop-home__floating-card" padding="sm">
              <Badge tone="warning">Painel recolhido</Badge>
              <strong>Tab alterna o painel</strong>
              <p>Use o atalho para voltar ao shell lateral sem sair do mapa.</p>
            </Card>
          </div>
        ) : null}
      </section>
    </>
  );

  if (mode === 'fullscreen') {
    return <section className="desktop-home desktop-home--fullscreen">{content}</section>;
  }

  return <section className="desktop-home">{content}</section>;
}

function resolveSeverityTone(
  severity: string,
): 'danger' | 'info' | 'neutral' | 'success' | 'warning' {
  if (severity === 'critical' || severity === 'danger') {
    return 'danger';
  }

  if (severity === 'warning') {
    return 'warning';
  }

  if (severity === 'success') {
    return 'success';
  }

  return 'info';
}

function formatRecommendation(telemetry: RendererTelemetry | null): string {
  if (!telemetry || telemetry.benchmark.recommendation === 'warming') {
    return 'Aquecendo benchmark do renderer.';
  }

  if (telemetry.benchmark.recommendation === 'keep-canvas') {
    return 'Canvas 2D sustentou a carga atual.';
  }

  return 'Canvas 2D abaixo da meta. PixiJS vira o fallback.';
}

function formatTile(tile: RendererTelemetry['hoveredTile']): string {
  return tile ? `${tile.x}, ${tile.y}` : 'sem foco';
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return '--';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
}
