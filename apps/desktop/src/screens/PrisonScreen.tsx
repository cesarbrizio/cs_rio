import {
  buildPrisonActionCopy,
  formatPrisonHeatTier,
  formatPrisonRemaining,
  getLivePrisonStatus,
  hasImmediatePrisonEscapeOptions,
} from '@cs-rio/ui/hooks';
import { useEffect, useMemo, useState } from 'react';

import { Badge, Button, Card } from '../components/ui';
import { prisonApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import {
  FeedbackCard,
  MetricCard,
  ScreenHero,
} from './shared/DesktopScreenPrimitives';

type PrisonActionId = 'bail' | 'bribe' | 'escape';

export function PrisonScreen(): JSX.Element {
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const [nowMs, setNowMs] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [pendingAction, setPendingAction] = useState<PrisonActionId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [center, setCenter] = useState<Awaited<ReturnType<typeof prisonApi.getCenter>> | null>(null);

  const livePrison = useMemo(
    () => getLivePrisonStatus(center?.prison ?? player?.prison ?? emptyPrisonState(), nowMs),
    [center?.prison, nowMs, player?.prison],
  );

  useEffect(() => {
    void loadCenter();
  }, []);

  useEffect(() => {
    if (!livePrison.isImprisoned) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [livePrison.isImprisoned]);

  async function loadCenter(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const response = await prisonApi.getCenter();
      setCenter(response);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao carregar a prisao.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAction(actionId: PrisonActionId): Promise<void> {
    setIsMutating(true);
    setPendingAction(actionId);
    setError(null);
    setFeedback(null);

    try {
      const response =
        actionId === 'bail'
          ? await prisonApi.bail()
          : actionId === 'bribe'
            ? await prisonApi.bribe()
            : await prisonApi.escape();
      await Promise.all([loadCenter(), refreshPlayerProfile()]);
      setFeedback(response.message);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao processar a acao prisional.');
    } finally {
      setIsMutating(false);
      setPendingAction(null);
    }
  }

  return (
    <section className="desktop-screen">
      <ScreenHero
        actions={
          <Button onClick={() => void loadCenter()} variant="secondary">
            {isLoading ? 'Sincronizando...' : 'Atualizar prisao'}
          </Button>
        }
        badges={[
          { label: livePrison.isImprisoned ? 'Preso' : 'Livre', tone: livePrison.isImprisoned ? 'danger' : 'success' },
          { label: `calor ${livePrison.heatScore}`, tone: 'warning' },
          { label: formatPrisonHeatTier(livePrison.heatTier), tone: 'info' },
        ]}
        description="Acompanhe a pena, o calor da policia e as saidas que podem te colocar de volta na rua."
        title="Prisao"
      />

      {feedback ? <FeedbackCard message={feedback} title="Prisao atualizada" tone="success" /> : null}
      {error ? <FeedbackCard message={error} title="Falha na prisao" tone="danger" /> : null}

      <div className="desktop-metric-grid">
        <MetricCard label="Status" tone={livePrison.isImprisoned ? 'danger' : 'success'} value={livePrison.isImprisoned ? 'Preso' : 'Livre'} />
        <MetricCard label="Restante" tone="warning" value={formatPrisonRemaining(livePrison.remainingSeconds)} />
        <MetricCard label="Calor" tone="info" value={`${livePrison.heatScore}`} />
        <MetricCard label="Faixa" tone="neutral" value={formatPrisonHeatTier(livePrison.heatTier)} />
      </div>

      <div className="desktop-grid-2">
        <Card className="desktop-panel">
          <h3>Situacao atual</h3>
          <div className="desktop-detail-list">
            <div>
              <strong>Motivo</strong>
              <small>{livePrison.reason ?? 'Sem prisao ativa registrada.'}</small>
            </div>
            <div>
              <strong>Sentenca</strong>
              <small>{livePrison.sentencedAt ? new Date(livePrison.sentencedAt).toLocaleString('pt-BR') : '--'}</small>
            </div>
            <div>
              <strong>Soltura prevista</strong>
              <small>{livePrison.endsAt ? new Date(livePrison.endsAt).toLocaleString('pt-BR') : 'agora'}</small>
            </div>
            <div>
              <strong>Janela operacional</strong>
              <small>
                {hasImmediatePrisonEscapeOptions(center)
                  ? 'Ha opcoes de saida imediata liberadas agora.'
                  : 'Nenhuma saida imediata liberada neste momento.'}
              </small>
            </div>
          </div>
        </Card>

        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Saidas imediatas</h3>
            <Badge tone="warning">{hasImmediatePrisonEscapeOptions(center) ? 'Liberadas' : 'Travadas'}</Badge>
          </div>
          <div className="desktop-detail-list">
            <div>
              <strong>Fianca</strong>
              <small>{buildPrisonActionCopy('bail', center?.actions.bail ?? unavailableAction())}</small>
              <Button
                disabled={isMutating || !center?.actions.bail.available}
                onClick={() => void handleAction('bail')}
                variant="secondary"
              >
                {pendingAction === 'bail' ? 'Processando...' : 'Pedir fianca'}
              </Button>
            </div>
            <div>
              <strong>Suborno</strong>
              <small>{buildPrisonActionCopy('bribe', center?.actions.bribe ?? unavailableAction())}</small>
              <Button
                disabled={isMutating || !center?.actions.bribe.available}
                onClick={() => void handleAction('bribe')}
                variant="ghost"
              >
                {pendingAction === 'bribe' ? 'Processando...' : 'Negociar suborno'}
              </Button>
            </div>
            <div>
              <strong>Fuga</strong>
              <small>{buildPrisonActionCopy('escape', center?.actions.escape ?? unavailableAction())}</small>
              <Button
                disabled={isMutating || !center?.actions.escape.available}
                onClick={() => void handleAction('escape')}
                variant="danger"
              >
                {pendingAction === 'escape' ? 'Processando...' : 'Forcar fuga'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}

function unavailableAction() {
  return {
    available: false,
    creditsCost: null,
    factionBankCost: null,
    moneyCost: null,
    reason: 'Indisponivel agora.',
    successChancePercent: null,
  };
}

function emptyPrisonState() {
  return {
    endsAt: null,
    heatScore: 0,
    heatTier: 'frio' as const,
    isImprisoned: false,
    reason: null,
    remainingSeconds: 0,
    sentencedAt: null,
  };
}
