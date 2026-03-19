import {
  formatTrainingCurrency,
  formatTrainingDuration,
  formatTrainingGains,
  formatTrainingRemaining,
  formatTrainingTypeLabel,
  getLiveTrainingSessionState,
  sortTrainingCatalog,
} from '@cs-rio/ui/hooks';
import { useEffect, useMemo, useState } from 'react';

import { Badge, Button, Card, ProgressBar } from '../components/ui';
import { trainingApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import {
  FeedbackCard,
  MetricCard,
  ScreenHero,
} from './shared/DesktopScreenPrimitives';

export function TrainingScreen(): JSX.Element {
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const player = useAuthStore((state) => state.player);
  const [nowMs, setNowMs] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [center, setCenter] = useState<Awaited<ReturnType<typeof trainingApi.getCenter>> | null>(null);
  const [selectedType, setSelectedType] = useState<'advanced' | 'basic' | 'intensive'>('basic');

  const sortedCatalog = useMemo(
    () => sortTrainingCatalog(center?.catalog ?? []),
    [center?.catalog],
  );
  const selectedTraining = useMemo(
    () => sortedCatalog.find((entry) => entry.type === selectedType) ?? sortedCatalog[0] ?? null,
    [selectedType, sortedCatalog],
  );
  const activeSession = useMemo(() => {
    if (!center?.activeSession) {
      return null;
    }

    return {
      ...center.activeSession,
      ...getLiveTrainingSessionState(center.activeSession, nowMs),
    };
  }, [center?.activeSession, nowMs]);

  useEffect(() => {
    void loadCenter();
  }, []);

  useEffect(() => {
    if (!activeSession) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeSession]);

  useEffect(() => {
    if (sortedCatalog.length === 0) {
      return;
    }

    if (!sortedCatalog.some((entry) => entry.type === selectedType)) {
      const nextType = sortedCatalog[0]?.type;

      if (nextType) {
        setSelectedType(nextType);
      }
    }
  }, [selectedType, sortedCatalog]);

  async function loadCenter(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const response = await trainingApi.getCenter();
      setCenter(response);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao carregar o centro de treino.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStartTraining(): Promise<void> {
    if (!selectedTraining?.isRunnable) {
      setError(selectedTraining?.lockReason ?? 'Esse treino nao pode ser iniciado agora.');
      return;
    }

    setIsMutating(true);
    setError(null);
    setFeedback(null);

    try {
      await trainingApi.start({
        type: selectedTraining.type,
      });
      await Promise.all([loadCenter(), refreshPlayerProfile()]);
      setFeedback(
        `${selectedTraining.label} iniciado. Resgate em ${formatTrainingDuration(selectedTraining.durationMinutes)}.`,
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao iniciar o treino.');
    } finally {
      setIsMutating(false);
    }
  }

  async function handleClaimTraining(): Promise<void> {
    if (!center?.activeSession) {
      return;
    }

    setIsMutating(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await trainingApi.claim(center.activeSession.id);
      await Promise.all([loadCenter(), refreshPlayerProfile()]);
      setFeedback(`${formatTrainingTypeLabel(response.session.type)} concluido: ${formatTrainingGains(response.appliedGains)}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao resgatar o treino.');
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <section className="desktop-screen">
      <ScreenHero
        actions={
          <Button onClick={() => void loadCenter()} variant="secondary">
            {isLoading ? 'Sincronizando...' : 'Atualizar centro'}
          </Button>
        }
        badges={[
          { label: `${player?.resources.cansaco ?? center?.player.resources.cansaco ?? 0} cansaco`, tone: 'info' },
          { label: `${center?.completedBasicSessions ?? 0} basicos`, tone: 'neutral' },
          { label: `${(center?.nextDiminishingMultiplier ?? 1).toFixed(2)}x`, tone: 'warning' },
        ]}
        description="Treinos assincronos reais do backend, com progressao por tempo, custos, ganhos projetados e resgate no fim da sessao."
        title="Centro de Treino"
      />

      {feedback ? <FeedbackCard message={feedback} title="Treino sincronizado" tone="success" /> : null}
      {error ? <FeedbackCard message={error} title="Falha no treino" tone="danger" /> : null}

      <div className="desktop-metric-grid">
        <MetricCard label="Caixa" tone="warning" value={formatTrainingCurrency(center?.player.resources.money ?? player?.resources.money ?? 0)} />
        <MetricCard label="Cansaco" tone="info" value={`${center?.player.resources.cansaco ?? player?.resources.cansaco ?? 0}`} />
        <MetricCard label="Ativo" tone={activeSession ? 'warning' : 'neutral'} value={activeSession ? 'Em curso' : 'Livre'} />
        <MetricCard label="Prox. mult." tone="success" value={`${(center?.nextDiminishingMultiplier ?? 1).toFixed(2)}x`} />
      </div>

      <div className="desktop-grid-2">
        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Catalogo de treino</h3>
            <Badge tone="neutral">{sortedCatalog.length} opcoes</Badge>
          </div>
          <div className="desktop-scroll-list">
            {sortedCatalog.map((entry) => (
              <button
                className={`desktop-list-row desktop-list-row--clickable ${selectedTraining?.type === entry.type ? 'desktop-list-row--active' : ''}`}
                key={entry.type}
                onClick={() => setSelectedType(entry.type)}
                type="button"
              >
                <div className="desktop-list-row__headline">
                  <strong>{entry.label}</strong>
                  <Badge tone={entry.isRunnable ? 'success' : entry.isLocked ? 'danger' : 'warning'}>
                    {entry.isRunnable ? 'Pronto' : entry.isLocked ? 'Travado' : 'Bloqueado'}
                  </Badge>
                </div>
                <small>{formatTrainingTypeLabel(entry.type)} · desbloqueia no nivel {entry.unlockLevel}</small>
                <small>{formatTrainingCurrency(entry.moneyCost)} · {entry.cansacoCost} cansaco · {formatTrainingDuration(entry.durationMinutes)}</small>
              </button>
            ))}
          </div>
        </Card>

        <div className="desktop-screen__stack">
          {selectedTraining ? (
            <Card className="desktop-panel">
              <div className="desktop-panel__header">
                <div>
                  <h3>{selectedTraining.label}</h3>
                  <p>{formatTrainingTypeLabel(selectedTraining.type)} · multiplicador {selectedTraining.nextDiminishingMultiplier.toFixed(2)}x</p>
                </div>
                <Button
                  disabled={Boolean(activeSession) || !selectedTraining.isRunnable || isMutating}
                  onClick={() => void handleStartTraining()}
                  variant={selectedTraining.isRunnable ? 'primary' : 'ghost'}
                >
                  {isMutating ? 'Processando...' : 'Iniciar treino'}
                </Button>
              </div>
              <div className="desktop-grid-3">
                <MetricCard label="Duracao" tone="info" value={formatTrainingDuration(selectedTraining.durationMinutes)} />
                <MetricCard label="Custo" tone="warning" value={formatTrainingCurrency(selectedTraining.moneyCost)} />
                <MetricCard label="Cansaco" tone="danger" value={`${selectedTraining.cansacoCost}`} />
              </div>
              <div className="desktop-detail-list">
                <div>
                  <strong>Ganhos projetados</strong>
                  <small>{formatTrainingGains(selectedTraining.projectedGains)}</small>
                </div>
                <div>
                  <strong>Status</strong>
                  <small>{selectedTraining.lockReason ?? 'Treino liberado para iniciar agora.'}</small>
                </div>
              </div>
            </Card>
          ) : null}

          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <h3>Sessao ativa</h3>
              <Badge tone={activeSession ? 'warning' : 'neutral'}>
                {activeSession ? 'Rodando' : 'Nenhuma'}
              </Badge>
            </div>
            {activeSession ? (
              <>
                <ProgressBar
                  label={`${formatTrainingTypeLabel(activeSession.type)} em andamento`}
                  tone={activeSession.readyToClaim ? 'success' : 'info'}
                  value={Math.round(activeSession.progressRatio * 100)}
                />
                <div className="desktop-grid-3">
                  <MetricCard label="Restante" tone="info" value={formatTrainingRemaining(activeSession.remainingSeconds)} />
                  <MetricCard label="Streak" tone="warning" value={`${activeSession.streakIndex + 1}`} />
                  <MetricCard label="Mult." tone="success" value={`${activeSession.diminishingMultiplier.toFixed(2)}x`} />
                </div>
                <div className="desktop-detail-list">
                  <div>
                    <strong>Ganhos na fila</strong>
                    <small>{formatTrainingGains(activeSession.projectedGains)}</small>
                  </div>
                  <div>
                    <strong>Custos ja consumidos</strong>
                    <small>{formatTrainingCurrency(activeSession.costMoney)} · {activeSession.costCansaco} cansaco</small>
                  </div>
                </div>
                <Button
                  disabled={!activeSession.readyToClaim || isMutating}
                  onClick={() => void handleClaimTraining()}
                  variant={activeSession.readyToClaim ? 'primary' : 'ghost'}
                >
                  {isMutating ? 'Processando...' : 'Resgatar treino'}
                </Button>
              </>
            ) : (
              <p>Nenhum treino em andamento. Escolha uma opcao no catalogo para iniciar uma sessao.</p>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
}
