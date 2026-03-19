import {
  buildContractExecutionHighlights,
  buildContractTargets,
  formatContractCountdown,
  formatContractTimestamp,
  resolveContractNotificationLabel,
  resolveContractStatusLabel,
} from '@cs-rio/ui/hooks';
import { useEffect, useMemo, useState } from 'react';

import { Badge, Button, Card } from '../components/ui';
import { pvpApi } from '../services/api';
import { colyseusService } from '../services/realtime';
import { useAuthStore } from '../stores/authStore';
import {
  FeedbackCard,
  FormField,
  MetricCard,
  ScreenHero,
  formatMoney,
} from './shared/DesktopScreenPrimitives';

export function ContractsScreen(): JSX.Element {
  const player = useAuthStore((state) => state.player);
  const token = useAuthStore((state) => state.token);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const [snapshot, setSnapshot] = useState(colyseusService.getSnapshot());
  const [nowMs, setNowMs] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [contractsBook, setContractsBook] = useState<Awaited<ReturnType<typeof pvpApi.listContracts>> | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [rewardInput, setRewardInput] = useState('25000');
  const [lastExecution, setLastExecution] = useState<Awaited<ReturnType<typeof pvpApi.executeContract>> | null>(null);

  useEffect(() => colyseusService.subscribe(setSnapshot), []);

  useEffect(() => {
    if (!player?.hasCharacter || !token) {
      return;
    }

    void colyseusService.connectToRegionRoom({
      accessToken: token,
      regionId: player.regionId,
    });
  }, [player?.hasCharacter, player?.regionId, token]);

  useEffect(() => {
    void loadContracts();
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const targetOptions = useMemo(
    () =>
      buildContractTargets({
        currentPlayerId: player?.id,
        realtimePlayers: snapshot.players,
      }),
    [player?.id, snapshot.players],
  );
  const selectedTarget = useMemo(
    () => targetOptions.find((target) => target.id === selectedTargetId) ?? targetOptions[0] ?? null,
    [selectedTargetId, targetOptions],
  );

  useEffect(() => {
    if (!selectedTarget && targetOptions.length > 0) {
      const nextTargetId = targetOptions[0]?.id;

      if (nextTargetId) {
        setSelectedTargetId(nextTargetId);
      }
    }
  }, [selectedTarget, targetOptions]);

  async function loadContracts(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const response = await pvpApi.listContracts();
      setContractsBook(response);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao carregar os contratos.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateContract(): Promise<void> {
    if (!selectedTarget) {
      setError('Escolha um alvo online antes de criar o contrato.');
      return;
    }

    const reward = Math.max(0, Math.round(Number.parseInt(rewardInput.replace(/\D/g, ''), 10) || 0));

    if (reward <= 0) {
      setError('Defina uma recompensa valida antes de abrir o contrato.');
      return;
    }

    setIsMutating(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await pvpApi.createContract(selectedTarget.id, reward);
      await Promise.all([loadContracts(), refreshPlayerProfile()]);
      setFeedback(`Contrato aberto contra ${response.contract.targetNickname}. Total travado: ${formatMoney(response.contract.totalCost)}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao criar o contrato.');
    } finally {
      setIsMutating(false);
    }
  }

  async function handleAcceptContract(contractId: string): Promise<void> {
    setIsMutating(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await pvpApi.acceptContract(contractId);
      await loadContracts();
      setFeedback(`Contrato aceito: ${response.contract.targetNickname} agora esta na sua mira.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao aceitar o contrato.');
    } finally {
      setIsMutating(false);
    }
  }

  async function handleExecuteContract(contractId: string): Promise<void> {
    setIsMutating(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await pvpApi.executeContract(contractId);
      setLastExecution(response);
      await Promise.all([loadContracts(), refreshPlayerProfile()]);
      setFeedback(response.message);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao executar o contrato.');
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <section className="desktop-screen">
      <ScreenHero
        actions={
          <Button onClick={() => void loadContracts()} variant="secondary">
            {isLoading ? 'Sincronizando...' : 'Atualizar mural'}
          </Button>
        }
        badges={[
          { label: `${contractsBook?.availableContracts.length ?? 0} abertos`, tone: 'warning' },
          { label: `${contractsBook?.acceptedContracts.length ?? 0} aceitos`, tone: 'info' },
          { label: `${contractsBook?.notifications.length ?? 0} alertas`, tone: 'success' },
        ]}
        description="Mural de contratos PvP com criacao em alvo online, aceite por bounty e execucao real do backend no shell desktop."
        title="Contratos"
      />

      {feedback ? <FeedbackCard message={feedback} title="Contratos sincronizados" tone="success" /> : null}
      {error ? <FeedbackCard message={error} title="Falha nos contratos" tone="danger" /> : null}

      <div className="desktop-metric-grid">
        <MetricCard label="Alvos online" tone="info" value={`${targetOptions.length}`} />
        <MetricCard label="Abertos" tone="warning" value={`${contractsBook?.availableContracts.length ?? 0}`} />
        <MetricCard label="Aceitos" tone="success" value={`${contractsBook?.acceptedContracts.length ?? 0}`} />
        <MetricCard label="Solicitados" tone="neutral" value={`${contractsBook?.requestedContracts.length ?? 0}`} />
      </div>

      <div className="desktop-grid-2">
        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Lancar contrato</h3>
            <Badge tone="neutral">{selectedTarget?.nickname ?? 'Sem alvo'}</Badge>
          </div>
          <div className="desktop-scroll-list">
            {targetOptions.map((target) => (
              <button
                className={`desktop-list-row desktop-list-row--clickable ${selectedTarget?.id === target.id ? 'desktop-list-row--active' : ''}`}
                key={target.id}
                onClick={() => setSelectedTargetId(target.id)}
                type="button"
              >
                <div className="desktop-list-row__headline">
                  <strong>{target.nickname}</strong>
                  <Badge tone="info">{target.title}</Badge>
                </div>
                <small>{target.subtitle}</small>
              </button>
            ))}
          </div>
          <FormField label="Recompensa">
            <input onChange={(event) => setRewardInput(event.target.value)} value={rewardInput} />
          </FormField>
          <Button disabled={isMutating || !selectedTarget} onClick={() => void handleCreateContract()} variant="primary">
            {isMutating ? 'Processando...' : 'Abrir contrato'}
          </Button>
        </Card>

        <div className="desktop-screen__stack">
          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <h3>Mural aberto</h3>
              <Badge tone="warning">{contractsBook?.availableContracts.length ?? 0}</Badge>
            </div>
            <div className="desktop-scroll-list">
              {(contractsBook?.availableContracts ?? []).map((contract) => (
                <div className="desktop-list-row" key={contract.id}>
                  <div className="desktop-list-row__headline">
                    <strong>{contract.targetNickname}</strong>
                    <Badge tone="warning">{resolveContractStatusLabel(contract.status)}</Badge>
                  </div>
                  <small>Recompensa {formatMoney(contract.reward)} · total {formatMoney(contract.totalCost)}</small>
                  <small>Expira em {formatContractCountdown(contract.expiresAt, nowMs)}</small>
                  <Button disabled={isMutating || !contract.canAccept} onClick={() => void handleAcceptContract(contract.id)} variant="secondary">
                    {isMutating ? 'Processando...' : 'Aceitar contrato'}
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <h3>Contratos aceitos</h3>
              <Badge tone="info">{contractsBook?.acceptedContracts.length ?? 0}</Badge>
            </div>
            <div className="desktop-scroll-list">
              {(contractsBook?.acceptedContracts ?? []).map((contract) => (
                <div className="desktop-list-row" key={contract.id}>
                  <div className="desktop-list-row__headline">
                    <strong>{contract.targetNickname}</strong>
                    <Badge tone="info">{resolveContractStatusLabel(contract.status)}</Badge>
                  </div>
                  <small>Aceito em {contract.acceptedAt ? formatContractTimestamp(contract.acceptedAt) : '--'}</small>
                  <small>Expira em {formatContractCountdown(contract.expiresAt, nowMs)}</small>
                  <Button disabled={isMutating} onClick={() => void handleExecuteContract(contract.id)} variant="primary">
                    {isMutating ? 'Processando...' : 'Executar contrato'}
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <h3>Alertas do mural</h3>
              <Badge tone="success">{contractsBook?.notifications.length ?? 0}</Badge>
            </div>
            <div className="desktop-scroll-list">
              {(contractsBook?.notifications ?? []).map((notification) => (
                <div className="desktop-list-row" key={notification.id}>
                  <div className="desktop-list-row__headline">
                    <strong>{resolveContractNotificationLabel(notification.type)}</strong>
                    <small>{formatContractTimestamp(notification.createdAt)}</small>
                  </div>
                  <p>{notification.message}</p>
                </div>
              ))}
            </div>
          </Card>

          {lastExecution ? (
            <Card className="desktop-panel">
              <div className="desktop-panel__header">
                <h3>Ultima execucao</h3>
                <Badge tone={lastExecution.success ? 'success' : 'danger'}>
                  {lastExecution.success ? 'Sucesso' : 'Falha'}
                </Badge>
              </div>
              <div className="desktop-grid-3">
                <MetricCard label="Tier" tone="warning" value={lastExecution.tier} />
                <MetricCard label="Razao de poder" tone="info" value={lastExecution.powerRatio.toFixed(2)} />
                <MetricCard label="Loot" tone="success" value={formatMoney(lastExecution.loot?.amount ?? 0)} />
              </div>
              <div className="desktop-detail-list">
                {buildContractExecutionHighlights(lastExecution).map((line) => (
                  <div key={line}>
                    <strong>Leitura</strong>
                    <small>{line}</small>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </section>
  );
}
