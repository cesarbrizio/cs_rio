import {
  buildControlledTribunalFavelas,
  formatTribunalDeadlineLabel,
  formatTribunalTimestamp,
  pickInitialTribunalFavelaId,
  resolveTribunalCaseStatusLabel,
  resolveTribunalJudgmentReadLabel,
  resolveTribunalPunishmentLabel,
  resolveTribunalPunishmentReadLabel,
  resolveTribunalRegionLabel,
  resolveTribunalResolutionSourceLabel,
  resolveTribunalSeverityLabel,
  resolveTribunalSideLabel,
} from '@cs-rio/ui/hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge, Button, Card } from '../components/ui';
import { territoryApi, tribunalApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import {
  FeedbackCard,
  MetricCard,
  ScreenHero,
} from './shared/DesktopScreenPrimitives';

export function TribunalScreen(): JSX.Element {
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const [nowMs, setNowMs] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof territoryApi.list>> | null>(null);
  const [center, setCenter] = useState<Awaited<ReturnType<typeof tribunalApi.getCenter>> | null>(null);
  const [cues, setCues] = useState<Awaited<ReturnType<typeof tribunalApi.getCues>> | null>(null);
  const [selectedFavelaId, setSelectedFavelaId] = useState<string | null>(null);
  const [selectedPunishment, setSelectedPunishment] = useState<string | null>(null);

  const controlledFavelas = useMemo(
    () => buildControlledTribunalFavelas(overview),
    [overview],
  );
  const selectedFavela = useMemo(
    () => controlledFavelas.find((favela) => favela.id === selectedFavelaId) ?? controlledFavelas[0] ?? null,
    [controlledFavelas, selectedFavelaId],
  );
  const activeCase = center?.activeCase?.judgedAt ? null : (center?.activeCase ?? null);

  const loadHub = useCallback(async (preferredFavelaId?: string | null): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const [nextOverview, nextCues] = await Promise.all([
        territoryApi.list(),
        tribunalApi.getCues(),
      ]);
      const nextControlled = buildControlledTribunalFavelas(nextOverview);
      const nextFavelaId = pickInitialTribunalFavelaId(nextControlled, preferredFavelaId);

      setOverview(nextOverview);
      setCues(nextCues);
      setSelectedFavelaId(nextFavelaId);

      if (nextFavelaId) {
        const nextCenter = await tribunalApi.getCenter(nextFavelaId);
        setCenter(nextCenter);
      } else {
        setCenter(null);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao carregar o tribunal.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHub();
  }, [loadHub]);

  useEffect(() => {
    if (!activeCase) {
      setSelectedPunishment(null);
      return;
    }

    const nextPunishment = activeCase.antigaoSuggestedPunishment ?? activeCase.definition.allowedPunishments[0] ?? null;
    setSelectedPunishment((current) => {
      if (current && activeCase.definition.allowedPunishments.includes(current as never)) {
        return current;
      }

      return nextPunishment;
    });
  }, [activeCase]);

  useEffect(() => {
    if (!activeCase) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeCase]);

  async function loadCenterForFavela(favelaId: string): Promise<void> {
    try {
      const response = await tribunalApi.getCenter(favelaId);
      setCenter(response);
      setSelectedFavelaId(favelaId);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao carregar a favela do tribunal.');
    }
  }

  async function handleGenerateCase(): Promise<void> {
    if (!selectedFavela) {
      return;
    }

    setIsMutating(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await tribunalApi.generateCase(selectedFavela.id);
      setCenter(response);
      setFeedback(response.created ? 'Novo caso gerado no tribunal da favela.' : 'Ja existe um caso aberto nesta favela.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao gerar o caso.');
    } finally {
      setIsMutating(false);
    }
  }

  async function handleJudgeCase(): Promise<void> {
    if (!selectedFavela || !activeCase || !selectedPunishment) {
      return;
    }

    setIsMutating(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await tribunalApi.judgeCase(selectedFavela.id, {
        punishment: selectedPunishment as never,
      });
      setCenter(response);
      await refreshPlayerProfile();
      setFeedback(`Julgamento concluido: ${resolveTribunalJudgmentReadLabel(response.judgment.read)}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao julgar o caso.');
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <section className="desktop-screen">
      <ScreenHero
        actions={
          <Button onClick={() => void loadHub()} variant="secondary">
            {isLoading ? 'Sincronizando...' : 'Atualizar tribunal'}
          </Button>
        }
        badges={[
          { label: `${controlledFavelas.length} favelas`, tone: 'info' },
          { label: `${cues?.cues.length ?? 0} avisos`, tone: 'warning' },
          { label: activeCase ? 'Caso aberto' : 'Sem pauta', tone: activeCase ? 'danger' : 'success' },
        ]}
        description="Julgue os casos da favela, acompanhe os avisos recentes e decida o destino da pauta."
        title="Julgar caso"
      />

      {feedback ? <FeedbackCard message={feedback} title="Tribunal atualizado" tone="success" /> : null}
      {error ? <FeedbackCard message={error} title="Falha no tribunal" tone="danger" /> : null}

      <div className="desktop-metric-grid">
        <MetricCard label="Favelas controladas" tone="info" value={`${controlledFavelas.length}`} />
        <MetricCard label="Caso atual" tone={activeCase ? 'warning' : 'neutral'} value={activeCase ? resolveTribunalCaseStatusLabel(activeCase.status) : 'Nenhum'} />
        <MetricCard label="Prazo" tone="danger" value={activeCase ? formatTribunalDeadlineLabel(activeCase.decisionDeadlineAt, nowMs) : '--'} />
        <MetricCard label="Ultimo cue" tone="success" value={cues?.cues[0] ? formatTribunalTimestamp(cues.cues[0].occurredAt) : '--'} />
      </div>

      <div className="desktop-grid-2">
        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Favelas sob comando</h3>
            <Badge tone="neutral">{controlledFavelas.length}</Badge>
          </div>
          <div className="desktop-scroll-list">
            {controlledFavelas.map((favela) => (
              <button
                className={`desktop-list-row desktop-list-row--clickable ${selectedFavela?.id === favela.id ? 'desktop-list-row--active' : ''}`}
                key={favela.id}
                onClick={() => void loadCenterForFavela(favela.id)}
                type="button"
              >
                <div className="desktop-list-row__headline">
                  <strong>{favela.name}</strong>
                  <Badge tone="info">{resolveTribunalRegionLabel(favela.regionId)}</Badge>
                </div>
                <small>Dificuldade {favela.difficulty} · satisfacao {Math.round(favela.satisfaction)}%</small>
              </button>
            ))}
          </div>
        </Card>

        <div className="desktop-screen__stack">
          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <div>
                <h3>{selectedFavela?.name ?? 'Selecione uma favela'}</h3>
                <p>{selectedFavela ? resolveTribunalRegionLabel(selectedFavela.regionId) : 'A favela escolhida define o caso carregado.'}</p>
              </div>
              <Button disabled={isMutating || !selectedFavela} onClick={() => void handleGenerateCase()} variant="secondary">
                {isMutating ? 'Processando...' : 'Gerar/renovar caso'}
              </Button>
            </div>
            {activeCase ? (
              <>
                <div className="desktop-grid-3">
                  <MetricCard label="Severidade" tone="warning" value={resolveTribunalSeverityLabel(activeCase.definition.severity)} />
                  <MetricCard label="Prazo" tone="danger" value={formatTribunalDeadlineLabel(activeCase.decisionDeadlineAt, nowMs)} />
                  <MetricCard label="Status" tone="info" value={resolveTribunalCaseStatusLabel(activeCase.status)} />
                </div>
                <div className="desktop-detail-list">
                  <div>
                    <strong>Resumo</strong>
                    <small>{activeCase.summary}</small>
                  </div>
                  <div>
                    <strong>Acusador</strong>
                    <small>{resolveTribunalSideLabel('accuser')}: {activeCase.accuser.name} · {activeCase.accuser.statement}</small>
                  </div>
                  <div>
                    <strong>Acusado</strong>
                    <small>{resolveTribunalSideLabel('accused')}: {activeCase.accused.name} · {activeCase.accused.statement}</small>
                  </div>
                  <div>
                    <strong>Leitura do antigao</strong>
                    <small>{activeCase.antigaoHint}</small>
                  </div>
                </div>
                <div className="desktop-scroll-list">
                  {activeCase.definition.allowedPunishments.map((punishment) => {
                    const insight = activeCase.antigaoAdvice.punishmentInsights.find((entry) => entry.punishment === punishment) ?? null;

                    return (
                      <button
                        className={`desktop-list-row desktop-list-row--clickable ${selectedPunishment === punishment ? 'desktop-list-row--active' : ''}`}
                        key={punishment}
                        onClick={() => setSelectedPunishment(punishment)}
                        type="button"
                      >
                        <div className="desktop-list-row__headline">
                          <strong>{resolveTribunalPunishmentLabel(punishment)}</strong>
                          <Badge tone={insight?.recommended ? 'success' : 'neutral'}>
                            {insight ? resolveTribunalPunishmentReadLabel(insight.read) : 'Sem leitura'}
                          </Badge>
                        </div>
                        <small>{insight?.note ?? 'Sem insight complementar para este castigo.'}</small>
                      </button>
                    );
                  })}
                </div>
                <Button disabled={isMutating || !selectedPunishment} onClick={() => void handleJudgeCase()} variant="primary">
                  {isMutating ? 'Processando...' : 'Julgar caso'}
                </Button>
              </>
            ) : (
              <p>Sem caso aberto na favela selecionada. Gere um caso para abrir a pauta no desktop.</p>
            )}
          </Card>

          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <h3>Ultimo desfecho</h3>
              <Badge tone="info">{center?.latestResolvedOutcome ? resolveTribunalResolutionSourceLabel(center.latestResolvedOutcome.resolutionSource) : 'Sem historico'}</Badge>
            </div>
            {center?.latestResolvedOutcome ? (
              <div className="desktop-detail-list">
                <div>
                  <strong>Resumo</strong>
                  <small>{center.latestResolvedOutcome.summary}</small>
                </div>
                <div>
                  <strong>Leitura</strong>
                  <small>{resolveTribunalJudgmentReadLabel(center.latestResolvedOutcome.read)}</small>
                </div>
                <div>
                  <strong>Punicao</strong>
                  <small>{resolveTribunalPunishmentLabel(center.latestResolvedOutcome.punishmentChosen)}</small>
                </div>
              </div>
            ) : (
              <p>Nenhum julgamento recente para a favela selecionada.</p>
            )}
          </Card>

          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <h3>Feed de cues</h3>
              <Badge tone="warning">{cues?.cues.length ?? 0}</Badge>
            </div>
            <div className="desktop-scroll-list">
              {(cues?.cues ?? []).map((cue) => (
                <div className="desktop-list-row" key={`${cue.case.id}:${cue.occurredAt}`}>
                  <div className="desktop-list-row__headline">
                    <strong>{cue.title}</strong>
                    <small>{formatTribunalTimestamp(cue.occurredAt)}</small>
                  </div>
                  <small>{cue.headline}</small>
                  <small>{cue.outcome ? resolveTribunalJudgmentReadLabel(cue.outcome.read) : 'Caso aberto'}</small>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
