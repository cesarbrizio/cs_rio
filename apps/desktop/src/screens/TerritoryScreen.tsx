import {
  buildFavelaAlertLines,
  buildFavelaForceSummaryLines,
  formatTerritoryCountdown,
  formatTerritoryCurrency,
  formatTerritoryTimestamp,
  resolveWarSideForPlayer,
  resolveWarSideLabel,
  resolveBaileStatusLabel,
  resolveFavelaStateLabel,
  resolvePropinaStatusLabel,
  resolveRegionLabel,
  resolveSatisfactionTierLabel,
  resolveServiceStatusLabel,
  resolveTerritoryActionVisibility,
  resolveWarStatusLabel,
  resolveX9StatusLabel,
  useTerritoryController,
} from '@cs-rio/ui/hooks';
import type { FactionWarPrepareInput } from '@cs-rio/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge, Button, Card } from '../components/ui';
import { territoryApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import {
  FeedbackCard,
  FormField,
  MetricCard,
  ScreenHero,
} from './shared/DesktopScreenPrimitives';

export function TerritoryScreen(): JSX.Element {
  const navigate = useNavigate();
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const [warBudgetInput, setWarBudgetInput] = useState('25000');
  const [warSoldierCommitmentInput, setWarSoldierCommitmentInput] = useState('12');
  const [warError, setWarError] = useState<string | null>(null);
  const [warFeedback, setWarFeedback] = useState<string | null>(null);
  const [isWarMutating, setIsWarMutating] = useState(false);
  const {
    baileBook,
    conquerSelectedFavela,
    declareWarOnSelectedFavela,
    error,
    feedback,
    headlineStats,
    installSelectedService,
    isDetailLoading,
    isLoading,
    isMutating,
    loadTerritoryHub,
    lossFeed,
    negotiateSelectedPropina,
    nowMs,
    overview,
    regionGroups,
    selectFavela,
    selectedFavela,
    selectedRegionId,
    servicesBook,
    setSelectedRegionId,
    warBook,
  } = useTerritoryController({
    player,
    refreshPlayerProfile,
    territoryApi,
  });

  if (!player) {
    return <></>;
  }

  const playerFactionId = overview?.playerFactionId ?? player.faction?.id ?? null;
  const selectedServices = servicesBook?.services ?? [];
  const selectedWar = warBook?.war ?? selectedFavela?.war ?? null;
  const selectedWarSide = resolveWarSideForPlayer(playerFactionId, selectedWar);
  const selectedWarPreparation =
    selectedWar && selectedWarSide
      ? selectedWarSide === 'attacker'
        ? selectedWar.attackerPreparation
        : selectedWar.defenderPreparation
      : null;
  const selectedAlerts = selectedFavela ? buildFavelaAlertLines(selectedFavela) : [];
  const selectedForceLines = selectedFavela ? buildFavelaForceSummaryLines(selectedFavela) : [];
  const selectedActionVisibility = resolveTerritoryActionVisibility({
    favela: selectedFavela,
    playerFactionId,
  });
  const canPrepareSelectedWar = Boolean(
    selectedWar &&
      selectedWarSide &&
      (selectedWar.status === 'declared' || selectedWar.status === 'preparing') &&
      !selectedWarPreparation,
  );
  const canAdvanceSelectedWarRound = Boolean(
    selectedWar &&
      selectedWarSide &&
      selectedWar.status === 'active',
  );
  const visibleFeedback = warFeedback ?? feedback;
  const visibleError = warError ?? error;
  const isAnyMutating = isMutating || isWarMutating;

  async function handlePrepareWar(): Promise<void> {
    if (!selectedFavela) {
      return;
    }

    const parsedInput = parseWarPreparationInput(warBudgetInput, warSoldierCommitmentInput);

    if (!parsedInput) {
      setWarError('Informe budget e comprometimento de soldados validos para a guerra.');
      setWarFeedback(null);
      return;
    }

    setIsWarMutating(true);
    setWarError(null);
    setWarFeedback(null);

    try {
      const response = await territoryApi.prepareWar(selectedFavela.id, parsedInput);
      await refreshPlayerProfile();
      await loadTerritoryHub();
      setWarFeedback(response.message);
    } catch (nextError) {
      setWarError(nextError instanceof Error ? nextError.message : 'Falha ao preparar o lado na guerra.');
    } finally {
      setIsWarMutating(false);
    }
  }

  async function handleResolveWarRound(): Promise<void> {
    if (!selectedFavela) {
      return;
    }

    setIsWarMutating(true);
    setWarError(null);
    setWarFeedback(null);

    try {
      const response = await territoryApi.resolveWarRound(selectedFavela.id);
      await refreshPlayerProfile();
      await loadTerritoryHub();
      setWarFeedback(response.message ?? `Round de guerra resolvido em ${selectedFavela.name}.`);
    } catch (nextError) {
      setWarError(nextError instanceof Error ? nextError.message : 'Falha ao resolver o round de guerra.');
    } finally {
      setIsWarMutating(false);
    }
  }

  return (
    <section className="desktop-screen">
      <ScreenHero
        actions={
          <>
            <Button onClick={() => navigate('/map')} variant="secondary">
              Ver mapa
            </Button>
            <Button onClick={() => navigate('/home')} variant="ghost">
              Voltar para Home
            </Button>
          </>
        }
        badges={[
          { label: resolveRegionLabel(selectedRegionId ?? player.regionId), tone: 'success' },
          { label: selectedFavela ? selectedFavela.name : 'Sem favela', tone: 'warning' },
          { label: isLoading || isDetailLoading ? 'Sincronizando' : 'Ao vivo', tone: isLoading || isDetailLoading ? 'warning' : 'info' },
        ]}
        description="Leia cada favela de forma direta: dominio, servicos, arrego, X9 e guerra no mesmo painel."
        title="Dominar area"
      />

      {visibleFeedback ? <FeedbackCard message={visibleFeedback} title="Area atualizada" tone="success" /> : null}
      {visibleError ? <FeedbackCard message={visibleError} title="Falha territorial" tone="danger" /> : null}

      <div className="desktop-metric-grid">
        <MetricCard label="Total de favelas" tone="neutral" value={`${headlineStats.totalFavelas}`} />
        <MetricCard label="Controladas" tone="success" value={`${headlineStats.playerControlledFavelas}`} />
        <MetricCard label="Em guerra" tone="danger" value={`${headlineStats.atWarFavelas}`} />
        <MetricCard label="X9 ativo" tone="warning" value={`${headlineStats.x9ActiveFavelas}`} />
      </div>

      <div className="desktop-territory-grid">
        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Regioes e favelas</h3>
            <Badge tone="info">{regionGroups.length} regioes</Badge>
          </div>
          <div className="desktop-chip-row">
            {regionGroups.map((group) => (
              <Button
                key={group.region.regionId}
                onClick={() => {
                  setSelectedRegionId(group.region.regionId);
                  if (group.favelas[0]) {
                    void selectFavela(group.favelas[0].id);
                  }
                }}
                variant={selectedRegionId === group.region.regionId ? 'primary' : 'ghost'}
              >
                {resolveRegionLabel(group.region.regionId)}
              </Button>
            ))}
          </div>
          <div className="desktop-scroll-list">
            {(regionGroups.find((group) => group.region.regionId === selectedRegionId)?.favelas ?? []).map((favela) => (
              <button
                className={`desktop-list-row desktop-list-row--clickable ${selectedFavela?.id === favela.id ? 'desktop-list-row--active' : ''}`}
                key={favela.id}
                onClick={() => void selectFavela(favela.id)}
                type="button"
              >
                <div className="desktop-list-row__headline">
                  <strong>{favela.name}</strong>
                  <Badge tone={favela.state === 'at_war' ? 'danger' : favela.state === 'controlled' ? 'success' : 'neutral'}>
                    {resolveFavelaStateLabel(favela.state)}
                  </Badge>
                </div>
                <small>{favela.controllingFaction?.abbreviation ?? 'Neutra'} · dificuldade {favela.difficulty}</small>
                <small>
                  Soldados {favela.soldiers.active}/{favela.soldiers.max} · Bandidos {favela.bandits.active}/{favela.bandits.targetActive}
                </small>
              </button>
            ))}
          </div>
        </Card>

        <div className="desktop-screen__stack">
          {selectedFavela ? (
            <>
              <Card className="desktop-panel">
                <div className="desktop-panel__header">
                  <div>
                    <h3>{selectedFavela.name}</h3>
                    <p>
                      {selectedFavela.controllingFaction?.name ?? 'Sem faccao'} · satisfacao {selectedFavela.satisfaction}
                    </p>
                  </div>
                  <Badge tone={selectedFavela.state === 'at_war' ? 'danger' : 'warning'}>
                    {resolveFavelaStateLabel(selectedFavela.state)}
                  </Badge>
                </div>
                <div className="desktop-grid-4">
                  <MetricCard label="Populacao" tone="neutral" value={`${selectedFavela.population}`} />
                  <MetricCard label="Soldados" tone="success" value={`${selectedFavela.soldiers.active}/${selectedFavela.soldiers.max}`} />
                  <MetricCard label="Bandidos" tone="danger" value={`${selectedFavela.bandits.active}/${selectedFavela.bandits.targetActive}`} />
                  <MetricCard label="Arrego" tone="warning" value={formatTerritoryCurrency(selectedFavela.propinaValue)} />
                </div>
                <div className="desktop-detail-list">
                  {selectedForceLines.map((line) => (
                    <div key={line}>
                      <strong>Forca operacional</strong>
                      <small>{line}</small>
                    </div>
                  ))}
                  <div>
                    <strong>Satisfacao</strong>
                    <small>{resolveSatisfactionTierLabel(selectedFavela.satisfactionProfile.tier)}</small>
                  </div>
                  <div>
                    <strong>Propina</strong>
                    <small>
                      {selectedFavela.propina
                        ? resolvePropinaStatusLabel(selectedFavela.propina.status)
                        : 'Sem propina ativa'}
                    </small>
                  </div>
                  <div>
                    <strong>X9</strong>
                    <small>
                      {selectedFavela.x9 ? resolveX9StatusLabel(selectedFavela.x9.status) : 'Sem alerta'}
                    </small>
                  </div>
                </div>
                <div className="desktop-inline-actions">
                  {selectedActionVisibility.canConquer ? (
                    <Button
                      disabled={isAnyMutating}
                      onClick={() => void conquerSelectedFavela()}
                      variant="primary"
                    >
                      Conquistar
                    </Button>
                  ) : null}
                  {selectedActionVisibility.canDeclareWar ? (
                    <Button
                      disabled={isAnyMutating}
                      onClick={() => void declareWarOnSelectedFavela()}
                      variant="secondary"
                    >
                      Declarar guerra
                    </Button>
                  ) : null}
                  {selectedActionVisibility.showNegotiatePropina ? (
                    <Button
                      disabled={isAnyMutating}
                      onClick={() => void negotiateSelectedPropina()}
                      variant="ghost"
                    >
                      Negociar arrego
                    </Button>
                  ) : null}
                </div>
                {!selectedActionVisibility.canConquer &&
                !selectedActionVisibility.canDeclareWar &&
                !selectedActionVisibility.showNegotiatePropina ? (
                  <small>
                    Sem acao imediata liberada neste estado. Arrego, servicos e baile so aparecem quando sua faccao domina a favela.
                  </small>
                ) : null}
              </Card>

              {selectedAlerts.length > 0 ? (
                <Card className="desktop-panel">
                  <h3>Alertas da favela</h3>
                  <div className="desktop-detail-list">
                    {selectedAlerts.map((line) => (
                      <div key={line}>
                        <strong>Risco</strong>
                        <small>{line}</small>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null}

              <div className="desktop-grid-2">
                <Card className="desktop-panel">
                  <div className="desktop-panel__header">
                    <h3>{selectedActionVisibility.showServices ? 'Servicos' : 'Comando local'}</h3>
                    <Badge tone="info">
                      {selectedActionVisibility.showServices ? `${selectedServices.length} linhas` : 'bloqueado'}
                    </Badge>
                  </div>
                  {selectedActionVisibility.showServices ? (
                    servicesBook ? (
                      <div className="desktop-scroll-list">
                        {selectedServices.map((service) => (
                          <div className="desktop-list-row" key={service.definition.type}>
                            <div className="desktop-list-row__headline">
                              <strong>{service.definition.label}</strong>
                              <Badge tone={service.active ? 'success' : service.installed ? 'warning' : 'neutral'}>
                                {resolveServiceStatusLabel(service)}
                              </Badge>
                            </div>
                            <small>
                              Receita diaria {formatTerritoryCurrency(service.currentDailyRevenue)} · custo {formatTerritoryCurrency(service.definition.installCost)}
                            </small>
                            <small>{servicesBook.canManage ? 'Instalacao disponivel.' : 'Sem permissao para instalar.'}</small>
                            <Button
                              disabled={isAnyMutating || service.installed || !servicesBook.canManage}
                              onClick={() => void installSelectedService(service.definition.type)}
                              size="sm"
                              variant="secondary"
                            >
                              Instalar
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p>Os servicos desta favela nao puderam ser carregados agora.</p>
                    )
                  ) : (
                    <p>Sua faccao precisa dominar a favela para liberar arrego, servicos e baile.</p>
                  )}
                </Card>

                <Card className="desktop-panel">
                  <div className="desktop-panel__header">
                    <h3>{selectedActionVisibility.showBaile ? 'Baile e guerra' : 'Conflito territorial'}</h3>
                    <Badge tone="warning">{selectedWar ? resolveWarStatusLabel(selectedWar.status) : 'Sem guerra'}</Badge>
                  </div>
                  <div className="desktop-detail-list">
                    {selectedActionVisibility.showBaile ? (
                      <>
                        <div>
                          <strong>Baile</strong>
                          <small>
                            {baileBook
                              ? `${resolveBaileStatusLabel(baileBook.baile.status)} · budget ${formatTerritoryCurrency(baileBook.baile.budget ?? 0)}`
                              : 'Baile indisponivel'}
                          </small>
                        </div>
                        <div>
                          <strong>Cooldown baile</strong>
                          <small>{formatTerritoryCountdown(baileBook?.baile.cooldownEndsAt ?? null, nowMs) ?? '--'}</small>
                        </div>
                      </>
                    ) : (
                      <div>
                        <strong>Gestao local</strong>
                        <small>Baile e arrego so ficam disponiveis quando a favela esta sob a sua faccao.</small>
                      </div>
                    )}
                    <div>
                      <strong>Guerra</strong>
                      <small>
                        {selectedWar
                          ? `${selectedWar.attackerFaction.abbreviation} ${selectedWar.attackerScore} x ${selectedWar.defenderScore} ${selectedWar.defenderFaction.abbreviation}`
                          : 'Sem guerra ativa'}
                      </small>
                    </div>
                    <div>
                      <strong>Seu lado</strong>
                      <small>{selectedWarSide ? resolveWarSideLabel(selectedWarSide) : 'Fora do conflito'}</small>
                    </div>
                    {selectedWarPreparation ? (
                      <div>
                        <strong>Seu preparo</strong>
                        <small>
                          Budget {formatTerritoryCurrency(selectedWarPreparation.budget)} · soldados {selectedWarPreparation.soldierCommitment}
                        </small>
                      </div>
                    ) : null}
                    <div>
                      <strong>Proximo marco</strong>
                      <small>
                        {selectedWar
                          ? formatTerritoryCountdown(selectedWar.nextRoundAt ?? selectedWar.preparationEndsAt, nowMs) ?? '--'
                          : '--'}
                      </small>
                    </div>
                    {selectedWar?.rounds[0] ? (
                      <div>
                        <strong>Ultimo round</strong>
                        <small>
                          {selectedWar.rounds[0].message} · {formatTerritoryTimestamp(selectedWar.rounds[0].resolvedAt)}
                        </small>
                      </div>
                    ) : null}
                  </div>
                  {canPrepareSelectedWar ? (
                    <div className="desktop-screen__stack">
                      <div className="desktop-grid-2">
                        <FormField label="Budget de guerra">
                          <input onChange={(event) => setWarBudgetInput(event.target.value)} value={warBudgetInput} />
                        </FormField>
                        <FormField label="Comprometimento de soldados">
                          <input onChange={(event) => setWarSoldierCommitmentInput(event.target.value)} value={warSoldierCommitmentInput} />
                        </FormField>
                      </div>
                      <Button disabled={isAnyMutating} onClick={() => void handlePrepareWar()} variant="danger">
                        {isWarMutating ? 'Processando...' : 'Preparar lado'}
                      </Button>
                    </div>
                  ) : null}
                  {canAdvanceSelectedWarRound ? (
                    <Button disabled={isAnyMutating} onClick={() => void handleResolveWarRound()} variant="danger">
                      {isWarMutating ? 'Processando...' : 'Resolver round'}
                    </Button>
                  ) : null}
                  {selectedWar?.rounds.length ? (
                    <div className="desktop-scroll-list">
                      {selectedWar.rounds
                        .slice()
                        .reverse()
                        .map((round) => (
                          <div className="desktop-list-row" key={`${round.roundNumber}-${round.resolvedAt}`}>
                            <div className="desktop-list-row__headline">
                              <strong>Round {round.roundNumber}</strong>
                              <Badge tone={round.outcome === 'draw' ? 'neutral' : 'warning'}>
                                {round.outcome}
                              </Badge>
                            </div>
                            <small>
                              Poder {Math.round(round.attackerPower)} x {Math.round(round.defenderPower)} · HP {round.attackerHpLoss}/{round.defenderHpLoss}
                            </small>
                            <small>{round.message}</small>
                          </div>
                        ))}
                    </div>
                  ) : null}
                </Card>
              </div>
            </>
          ) : (
            <Card className="desktop-panel">
              <strong>Nenhuma favela selecionada.</strong>
              <p>Escolha uma favela da regiao para abrir servicos, guerra, X9 e arrego.</p>
            </Card>
          )}

          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <h3>Perdas recentes</h3>
              <Badge tone="danger">{lossFeed.length} eventos</Badge>
            </div>
            <div className="desktop-scroll-list">
              {lossFeed.map((cue) => (
                <div className="desktop-list-row" key={cue.occurredAt + cue.title}>
                  <div className="desktop-list-row__headline">
                    <strong>{cue.title}</strong>
                    <Badge tone="neutral">{formatTerritoryTimestamp(cue.occurredAt)}</Badge>
                  </div>
                  <small>{cue.body}</small>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

function parseWarPreparationInput(
  budgetValue: string,
  soldierCommitmentValue: string,
): FactionWarPrepareInput | null {
  const budget = parsePositiveInteger(budgetValue);
  const soldierCommitment = parsePositiveInteger(soldierCommitmentValue);

  if (budget === null || soldierCommitment === null) {
    return null;
  }

  return {
    budget,
    soldierCommitment,
  };
}

function parsePositiveInteger(value: string): number | null {
  const parsed = Number.parseInt(value.replace(/\D/g, ''), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}
