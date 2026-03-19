import {
  resolveRegionLabel,
  resolveWarSideForPlayer,
  resolveWarSideLabel,
  resolveWarStatusLabel,
} from '@cs-rio/ui/hooks';
import type {
  FactionWarDeclareResponse,
  FactionWarPrepareResponse,
  FactionWarRoundResponse,
  FactionWarStatusResponse,
} from '@cs-rio/shared';
import { useEffect, useMemo, useState } from 'react';

import { Badge, Button, Card } from '../components/ui';
import { territoryApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import {
  FeedbackCard,
  FormField,
  MetricCard,
  ScreenHero,
  formatMoney,
  formatTimestamp,
} from './shared/DesktopScreenPrimitives';

export function WarScreen(): JSX.Element {
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof territoryApi.list>> | null>(null);
  const [warCenter, setWarCenter] = useState<Awaited<ReturnType<typeof territoryApi.getWar>> | null>(null);
  const [selectedFavelaId, setSelectedFavelaId] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState('25000');
  const [soldierCommitmentInput, setSoldierCommitmentInput] = useState('12');

  const relevantFavelas = useMemo(() => {
    if (!overview?.playerFactionId) {
      return [];
    }

    return overview.favelas.filter((favela) => {
      if (favela.controllingFaction?.id === overview.playerFactionId) {
        return true;
      }

      return (
        favela.war?.attackerFaction.id === overview.playerFactionId ||
        favela.war?.defenderFaction.id === overview.playerFactionId
      );
    });
  }, [overview]);
  const selectedFavela = useMemo(
    () => relevantFavelas.find((favela) => favela.id === selectedFavelaId) ?? relevantFavelas[0] ?? null,
    [relevantFavelas, selectedFavelaId],
  );
  const war = warCenter?.war ?? selectedFavela?.war ?? null;
  const playerSide = resolveWarSideForPlayer(overview?.playerFactionId ?? null, war);

  useEffect(() => {
    void loadWarHub();
  }, []);

  useEffect(() => {
    if (selectedFavela && selectedFavela.id !== selectedFavelaId) {
      setSelectedFavelaId(selectedFavela.id);
    }
  }, [selectedFavela, selectedFavelaId]);

  async function loadWarHub(preferredFavelaId?: string | null): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const nextOverview = await territoryApi.list();
      setOverview(nextOverview);
      const nextFavela =
        nextOverview.favelas.find((favela) => favela.id === preferredFavelaId) ??
        nextOverview.favelas.find((favela) => favela.controllingFaction?.id === nextOverview.playerFactionId) ??
        nextOverview.favelas[0] ??
        null;

      if (nextFavela) {
        setSelectedFavelaId(nextFavela.id);
        const nextWarCenter = await territoryApi.getWar(nextFavela.id);
        setWarCenter(nextWarCenter);
      } else {
        setWarCenter(null);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao carregar a central de guerra.');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadWarCenter(favelaId: string): Promise<void> {
    try {
      const response = await territoryApi.getWar(favelaId);
      setSelectedFavelaId(favelaId);
      setWarCenter(response);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao carregar a favela em guerra.');
    }
  }

  async function handleDeclareWar(): Promise<void> {
    if (!selectedFavela) {
      return;
    }

    await runWarAction(async () => territoryApi.declareWar(selectedFavela.id));
  }

  async function handlePrepareWar(): Promise<void> {
    if (!selectedFavela) {
      return;
    }

    await runWarAction(async () =>
      territoryApi.prepareWar(selectedFavela.id, {
        budget: Math.max(0, Number.parseInt(budgetInput.replace(/\D/g, ''), 10) || 0),
        soldierCommitment: Math.max(0, Number.parseInt(soldierCommitmentInput.replace(/\D/g, ''), 10) || 0),
      }),
    );
  }

  async function handleResolveRound(): Promise<void> {
    if (!selectedFavela) {
      return;
    }

    await runWarAction(async () => territoryApi.resolveWarRound(selectedFavela.id));
  }

  async function runWarAction(
    callback: () => Promise<FactionWarDeclareResponse | FactionWarPrepareResponse | FactionWarRoundResponse>,
  ): Promise<void> {
    setIsMutating(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await callback();
      const nextWarCenter: FactionWarStatusResponse = response;
      setWarCenter(nextWarCenter);
      await Promise.all([loadWarHub(response.favela.id), refreshPlayerProfile()]);
      setFeedback(response.message);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao operar a guerra.');
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <section className="desktop-screen">
      <ScreenHero
        actions={
          <Button onClick={() => void loadWarHub(selectedFavelaId)} variant="secondary">
            {isLoading ? 'Sincronizando...' : 'Atualizar guerra'}
          </Button>
        }
        badges={[
          { label: `${relevantFavelas.length} favelas`, tone: 'info' },
          { label: war ? resolveWarStatusLabel(war.status) : 'Sem guerra', tone: war ? 'warning' : 'success' },
          { label: playerSide ? resolveWarSideLabel(playerSide) : 'Sem lado', tone: 'neutral' },
        ]}
        description="Painel de guerra de faccao com declaracao, preparacao, rodada e leitura do conflito em cada favela relevante."
        title="Guerra"
      />

      {feedback ? <FeedbackCard message={feedback} title="Guerra sincronizada" tone="success" /> : null}
      {error ? <FeedbackCard message={error} title="Falha na guerra" tone="danger" /> : null}

      <div className="desktop-metric-grid">
        <MetricCard label="Favela" tone="info" value={selectedFavela?.name ?? '--'} />
        <MetricCard label="Status" tone="warning" value={war ? resolveWarStatusLabel(war.status) : 'Sem guerra'} />
        <MetricCard label="Placar" tone="neutral" value={war ? `${war.attackerScore} x ${war.defenderScore}` : '--'} />
        <MetricCard label="Loot" tone="success" value={war ? formatMoney(war.lootMoney) : '--'} />
      </div>

      <div className="desktop-grid-2">
        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Favelas relevantes</h3>
            <Badge tone="neutral">{relevantFavelas.length}</Badge>
          </div>
          <div className="desktop-scroll-list">
            {relevantFavelas.map((favela) => (
              <button
                className={`desktop-list-row desktop-list-row--clickable ${selectedFavela?.id === favela.id ? 'desktop-list-row--active' : ''}`}
                key={favela.id}
                onClick={() => void loadWarCenter(favela.id)}
                type="button"
              >
                <div className="desktop-list-row__headline">
                  <strong>{favela.name}</strong>
                  <Badge tone={favela.war ? 'warning' : 'neutral'}>
                    {favela.war ? resolveWarStatusLabel(favela.war.status) : 'Sem guerra'}
                  </Badge>
                </div>
                <small>{resolveRegionLabel(favela.regionId)} · controlador {favela.controllingFaction?.abbreviation ?? 'Nenhum'}</small>
              </button>
            ))}
          </div>
        </Card>

        <div className="desktop-screen__stack">
          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <div>
                <h3>{selectedFavela?.name ?? 'Selecione uma favela'}</h3>
                <p>{selectedFavela ? resolveRegionLabel(selectedFavela.regionId) : 'A favela define o conflito carregado.'}</p>
              </div>
              <Badge tone={playerSide ? 'info' : 'neutral'}>
                {playerSide ? resolveWarSideLabel(playerSide) : 'Sem lado'}
              </Badge>
            </div>
            <div className="desktop-grid-3">
              <MetricCard label="Status" tone="warning" value={war ? resolveWarStatusLabel(war.status) : 'Sem guerra'} />
              <MetricCard label="Placar" tone="info" value={war ? `${war.attackerScore} x ${war.defenderScore}` : '--'} />
              <MetricCard label="Rounds" tone="neutral" value={war ? `${war.roundsResolved}/${war.roundsTotal}` : '--'} />
            </div>
            <div className="desktop-detail-list">
              <div>
                <strong>Atacante</strong>
                <small>{war?.attackerFaction.name ?? '--'} · preparo {war?.attackerPreparation ? formatMoney(war.attackerPreparation.budget) : '--'}</small>
              </div>
              <div>
                <strong>Defensor</strong>
                <small>{war?.defenderFaction.name ?? '--'} · preparo {war?.defenderPreparation ? formatMoney(war.defenderPreparation.budget) : '--'}</small>
              </div>
              <div>
                <strong>Marcos</strong>
                <small>Declarada {formatTimestamp(war?.declaredAt)} · inicia {formatTimestamp(war?.startsAt)} · proxima {formatTimestamp(war?.nextRoundAt)}</small>
              </div>
            </div>
            <div className="desktop-inline-actions">
              <Button disabled={isMutating || !selectedFavela} onClick={() => void handleDeclareWar()} variant="danger">
                {isMutating ? 'Processando...' : 'Declarar guerra'}
              </Button>
              <Button disabled={isMutating || !selectedFavela} onClick={() => void handleResolveRound()} variant="secondary">
                {isMutating ? 'Processando...' : 'Resolver round'}
              </Button>
            </div>
          </Card>

          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <h3>Preparacao</h3>
              <Badge tone="warning">{war?.preparationEndsAt ? formatTimestamp(war.preparationEndsAt) : '--'}</Badge>
            </div>
            <div className="desktop-grid-2">
              <FormField label="Budget">
                <input onChange={(event) => setBudgetInput(event.target.value)} value={budgetInput} />
              </FormField>
              <FormField label="Soldados">
                <input onChange={(event) => setSoldierCommitmentInput(event.target.value)} value={soldierCommitmentInput} />
              </FormField>
            </div>
            <Button disabled={isMutating || !selectedFavela} onClick={() => void handlePrepareWar()} variant="primary">
              {isMutating ? 'Processando...' : 'Enviar preparacao'}
            </Button>
          </Card>

          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <h3>Rounds resolvidos</h3>
              <Badge tone="info">{war?.rounds.length ?? 0}</Badge>
            </div>
            <div className="desktop-scroll-list">
              {(war?.rounds ?? []).map((round) => (
                <div className="desktop-list-row" key={`${round.roundNumber}:${round.resolvedAt}`}>
                  <div className="desktop-list-row__headline">
                    <strong>Round {round.roundNumber}</strong>
                    <Badge tone={round.outcome === 'draw' ? 'neutral' : 'warning'}>
                      {round.outcome}
                    </Badge>
                  </div>
                  <small>{round.message}</small>
                  <small>Atacante {round.attackerPower} · Defensor {round.defenderPower} · {formatTimestamp(round.resolvedAt)}</small>
                </div>
              ))}
              {!war?.rounds.length ? <p>Nenhum round resolvido ainda.</p> : null}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
